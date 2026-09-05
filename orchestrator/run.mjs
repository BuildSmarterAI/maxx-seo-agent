#!/usr/bin/env node
// run.mjs — the orchestrator. Reads the work queue, dispatches the kit skills as
// subagents for SAFE-class items only, validates, and opens ONE pull request.
// Risky classes are logged as escalations and skipped. Human merges the PR.
//
// Thin coordinator: the run/skip decision lives in lib/preflight.mjs, the goal
// prompts in goal.mjs, and repo-mode git delivery in lib/git-delivery.mjs.
import { fileURLToPath } from "node:url";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { addSpend } from "./lib/supabase.mjs";
import { check } from "./lib/preflight.mjs";
import { startBranch, openPR, rollback } from "./lib/git-delivery.mjs";
import { GOAL_REPO, goalCms, queueAllowlist } from "./goal.mjs";

const BUDGET_USD = Number(process.env.MONTHLY_BUDGET_USD || 50);
const PLATFORM = (process.env.SITE_PLATFORM || "repo").toLowerCase();
const IS_CMS = PLATFORM === "wordpress" || PLATFORM === "webflow";

// Hard turn ceiling for one run (SDK maxTurns). A full queue is 25 rows at a handful of
// orchestrator turns each (dispatch, log write, mem log, mem status), so a legitimate run
// sits well under 150 turns; 200 leaves headroom while still stopping a crash-looping
// agent that the monthly budget would otherwise only catch on the NEXT run's preflight.
const MAX_TURNS = Number(process.env.ORCHESTRATOR_MAX_TURNS || 200);

// The SDK stops a run that crosses maxBudgetUsd and reports it as one of these result
// subtypes. Either cap firing means the queue was NOT fully processed — treat it exactly
// like an agent crash (rollback in repo mode), never deliver half-processed work as a PR.
const CAP_SUBTYPES = new Set(["error_max_budget_usd", "error_max_turns"]);

// Only pass maxBudgetUsd when there is a real finite headroom: preflight already refuses
// to run at/over budget, but main() may be bypassed (tests, manual runs) and the SDK must
// never see Infinity.
function capOptions(headroomUsd) {
  return {
    maxTurns: MAX_TURNS,
    ...(Number.isFinite(headroomUsd) ? { maxBudgetUsd: headroomUsd } : {}),
  };
}

// Mark this process tree as the guarded autonomous agent so the PreToolUse hooks
// (.claude/hooks/guard-publish.sh, guard-write.sh) enforce their strict allowlist + write
// scoping. Inherited by the SDK's hook subprocesses. Interactive Claude Code sessions never
// set this, so a developer's own session stays unrestricted.
process.env.SEO_AGENT_GUARDED = "1";

export async function runRepo(queue, deps = {}, headroomUsd = Infinity) {
  const {
    query: runQuery = query,
    addSpend: recordSpend = addSpend,
    startBranch: beginBranch = startBranch,
    openPR: deliver = openPR,
    rollback: revert = rollback,
    exit = process.exit,
  } = deps;

  const branch = beginBranch();
  let costUsd = 0;
  let agentFailed = false;
  let capStopped = null;

  // Agent failure: roll back the branch and bail — nothing useful was produced.
  try {
    for await (const msg of runQuery({
      prompt: GOAL_REPO + queueAllowlist(queue),
      options: {
        model: process.env.ORCHESTRATOR_MODEL || "claude-sonnet-4-6",
        allowedTools: ["Read", "Write", "Edit", "Glob", "Grep", "Bash", "Agent"],
        permissionMode: "acceptEdits",
        settingSources: ["project"],
        ...capOptions(headroomUsd),
        agents: {
          "seo-fixer": {
            description: "Runs ONE kit skill against ONE url and validates the result.",
            prompt: "Run the named skill for the given url, then run the repo validators "
                  + "(schema validator, vitals check). If any validator fails, revert your "
                  + "edits to that file and report failure. Never delete pages or push to main.",
            tools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
          },
        },
      },
    })) {
      if (typeof msg?.total_cost_usd === "number") costUsd = msg.total_cost_usd;
      if (CAP_SUBTYPES.has(msg?.subtype)) {
        // Keep the SDK's own error detail (errors: string[]) for the thrown message —
        // "which cap" alone is a poor on-call diagnostic.
        capStopped = [msg.subtype, ...(msg.errors ?? [])].join(": ");
      }
      if ("result" in msg) console.log(msg.result);
    }
    // A cap stop ends the loop normally, not with a throw — rethrow it into the failure
    // path so the branch rolls back instead of delivering half-processed work as a PR.
    if (capStopped) throw new Error(`run stopped by SDK cap (${capStopped})`);
  } catch (err) {
    console.error("orchestrator failed, rolling back:", err?.message || err);
    revert(branch);
    agentFailed = true;
  } finally {
    // Record spend on EVERY terminal path (success AND crash): the tokens were billed
    // regardless of whether the output was kept, and MONTHLY_BUDGET_USD must see them or a
    // crash-looping run spends unbounded. One call site (this finally) also preserves the
    // no-double-count invariant a second success/failure billing would break.
    if (costUsd) await recordSpend(costUsd);
  }
  if (agentFailed) { exit(1); return; }

  // Delivery failure (commit/push/PR) is handled separately from agent failure.
  try {
    // No [skip ci]: repo-mode PRs carry content (drafts/schema/links), and per
    // .claude/rules/workflow.md content changes MUST trigger the eval-gate. A [skip ci]
    // token here suppresses the eval-gate AND the auto-merge workflow (both on:
    // pull_request), dead-locking delivery on the required check that never reports.
    const { empty, prUrl } = deliver(branch, "seo: automated safe-class fixes", "seo-auto");
    if (empty) { console.log("no changes produced → cleaning up."); return; }
    console.log(`PR opened: ${prUrl}  (cost ≈ $${costUsd.toFixed(2)})`);
  } catch (err) {
    // Unlike an agent failure, a delivery failure (push/PR) leaves the agent's work
    // committed locally on `branch` — keep it for hand-inspection/retry rather than
    // discarding it (and the spend) with a hard reset.
    console.error(`delivery failed; changes are committed locally on ${branch}:`, err?.message || err);
    exit(1);
    return;
  }
}

export async function runCms(queue, deps = {}, headroomUsd = Infinity) {
  const {
    query: runQuery = query,
    addSpend: recordSpend = addSpend,
    exit = process.exit,
  } = deps;

  let costUsd = 0;
  let failed = false;
  let capStopped = null;
  console.log(`CMS mode (${PLATFORM}): writing change_set rows for ${queue.length} pending items.`);

  try {
    // No queueAllowlist here (deliberate asymmetry with runRepo): a race-fetched row in
    // CMS mode can at worst stage an extra pending change_set row, which the deterministic
    // risk_class + do_not_touch gates in cms.mjs applyRow re-check before any live write.
    for await (const msg of runQuery({
      prompt: goalCms(PLATFORM),
      options: {
        model: process.env.ORCHESTRATOR_MODEL || "claude-sonnet-4-6",
        allowedTools: ["Read", "Write", "Bash", "Agent"],
        permissionMode: "acceptEdits",
        settingSources: ["project"],
        ...capOptions(headroomUsd),
        agents: {
          "seo-fixer": {
            description: "Resolves page_id + base_value via cms-read.mjs, generates the new value, writes a JSON payload FILE, returns its path. Never builds shell strings from data; never writes to the CMS directly.",
            prompt: `You are fixing ONE URL on a ${PLATFORM} site.
SECURITY — ABSOLUTE RULE: never put a field value, page content, base value, or reason on a
Bash command line. Bash commands carry ONLY fixed flags, the queue URL, the field name, and
file paths. All data moves through JSON files you create with the Write tool.

Steps in order:
1. Resolve page_id AND read the current value (base_value) with ONE safe call:
   node scripts/cms-read.mjs --url <U> --platform ${PLATFORM} --field <F>
   (add --collection-id <cId> for a Webflow CMS item). It writes
   change_set/_pending/<slug>.read.json — READ that file with the Read tool to obtain
   page_id and base_value. Do NOT capture the command's stdout into a shell variable.
2. Generate the improved value using the named kit skill. Supported field names ONLY:
   - post_content  (full HTML post body)
   - title         (SEO title — a SEPARATE payload from description)
   - description   (meta description — a SEPARATE payload from title)
   - canonical     (canonical URL)
   - focus         (focus keyword)
   Never use "yoast_meta" or any combined/compound field name.
3. Write the payload JSON with the Write tool to change_set/_pending/<slug>.json:
   {
     "platform": "${PLATFORM}", "url": "<U>", "page_id": "<id from step 1>", "field": "<F>",
     "base_value": <base_value from step 1, copied verbatim>,
     "new_value": <your generated value, as a JSON string>,
     "change_type": "<task>", "action": "queued", "risk_class": "safe",
     "reason": "change_set row written, awaiting approval",
     "id": <queue row id>, "status_to": "done"
   }
   Because this is a JSON file, any quotes/backticks/$()/; in the values are inert data.
4. Return ONLY the path change_set/_pending/<slug>.json to the orchestrator. Do NOT run
   mem.mjs yourself — the orchestrator commits the payload with one apply --file call.
Never write to the CMS directly. Never create git branches.`,
            tools: ["Read", "Write", "Bash", "Glob", "Grep"],
          },
        },
      },
    })) {
      if (typeof msg?.total_cost_usd === "number") costUsd = msg.total_cost_usd;
      if (CAP_SUBTYPES.has(msg?.subtype)) {
        // Keep the SDK's own error detail (errors: string[]) for the thrown message —
        // "which cap" alone is a poor on-call diagnostic.
        capStopped = [msg.subtype, ...(msg.errors ?? [])].join(": ");
      }
      if ("result" in msg) console.log(msg.result);
    }
    // A cap stop means the queue was not fully processed: exit non-zero so the run reads
    // as abnormal. change_set rows already written are fine to keep — they stay pending
    // behind the human approval gate regardless.
    if (capStopped) throw new Error(`run stopped by SDK cap (${capStopped})`);
  } catch (err) {
    // The Agent SDK emits "Claude Code process exited with code 1" as a normal
    // shutdown signal after the query loop completes — not a real failure. Any
    // OTHER error is a real failure: flag it to exit non-zero below (after the finally
    // still records the spend already incurred).
    if (!/process exited with code 1/i.test(err?.message || "")) {
      console.error("orchestrator (CMS) failed:", err?.message || err);
      failed = true;
    }
  } finally {
    // Single accounting point on EVERY path (success, the SDK's exit-code-1 shutdown, AND a
    // real failure): spent tokens must always count against the budget, even on a crash. One
    // call site (this finally) removes the double-count that occurred when both the try-tail
    // and the catch billed the same cost.
    if (costUsd) await recordSpend(costUsd);
  }
  if (failed) { exit(1); return; }
  console.log(`CMS run complete — check change_set table for pending rows. (cost ≈ $${costUsd.toFixed(2)})`);
}

async function main() {
  const decision = await check(BUDGET_USD);
  if (!decision.ok) { console.log(decision.reason); process.exit(0); }

  // What's left of the monthly budget bounds THIS run via the SDK's maxBudgetUsd — before
  // A8 the budget only gated the NEXT run's preflight, so a single run could overshoot
  // MONTHLY_BUDGET_USD without limit.
  const headroomUsd = BUDGET_USD - decision.spent;
  if (IS_CMS) {
    await runCms(decision.queue, {}, headroomUsd);
  } else {
    await runRepo(decision.queue, {}, headroomUsd);
  }
}

// Only run when invoked directly (node run.mjs), not when imported by a test that
// exercises runRepo/runCms with injected deps.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
