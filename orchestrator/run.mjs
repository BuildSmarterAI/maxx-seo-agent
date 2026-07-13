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
import { GOAL_REPO, goalCms } from "./goal.mjs";

const BUDGET_USD = Number(process.env.MONTHLY_BUDGET_USD || 50);
const PLATFORM = (process.env.SITE_PLATFORM || "repo").toLowerCase();
const IS_CMS = PLATFORM === "wordpress" || PLATFORM === "webflow";

// Mark this process tree as the guarded autonomous agent so the PreToolUse hooks
// (.claude/hooks/guard-publish.sh, guard-write.sh) enforce their strict allowlist + write
// scoping. Inherited by the SDK's hook subprocesses. Interactive Claude Code sessions never
// set this, so a developer's own session stays unrestricted.
process.env.SEO_AGENT_GUARDED = "1";

// Why this exists: total_cost_usd rides only on the SDK's terminal `result` message — both the
// 'success' and 'error_*' subtypes carry it (verified against @anthropic-ai/claude-agent-sdk
// 0.1.77 SDKResultMessage), so the read key is already correct. When a run still ends with
// costUsd === 0, either the result message never reached the loop (an early crash / the SDK's
// process-exit shutdown before it) or the run billed nothing to a metered pool. Both leave
// MONTHLY_BUDGET_USD blind, so we surface it loudly rather than silently record nothing (never
// fabricate a cost). apiKeySource comes from the system/init message and is a REQUIRED field
// there (one of 'user'|'project'|'org'|'temporary'), so 'unknown' means init itself never
// arrived — a crash before init, or a non-metered/subscription run — whereas a NAMED source
// paired with $0 is a genuine metered recording gap worth investigating. Pure + exported so the
// regression test asserts the signal without stubbing global console.
export function zeroSpendWarning(apiKeySource) {
  const diagnosis = apiKeySource
    ? `apiKeySource=${apiKeySource} (a metered key source) with $0 usually means the SDK result `
      + "message never arrived — investigate a recording gap."
    : "apiKeySource=unknown — the init message never reached the loop (a crash before init, or a "
      + "non-metered/subscription run).";
  return `spend: run completed with $0 recorded — MONTHLY_BUDGET_USD is blind for this run. ${diagnosis}`;
}

export async function runRepo(queue, deps = {}) {
  const {
    query: runQuery = query,
    addSpend: recordSpend = addSpend,
    startBranch: beginBranch = startBranch,
    openPR: deliver = openPR,
    rollback: revert = rollback,
    warn = console.warn,
    exit = process.exit,
  } = deps;

  const branch = beginBranch();
  let costUsd = 0;
  let apiKeySource;
  let agentFailed = false;

  // Agent failure: roll back the branch and bail — nothing useful was produced.
  try {
    for await (const msg of runQuery({
      prompt: GOAL_REPO,
      options: {
        model: process.env.ORCHESTRATOR_MODEL || "claude-sonnet-4-6",
        allowedTools: ["Read", "Write", "Edit", "Glob", "Grep", "Bash", "Agent"],
        permissionMode: "acceptEdits",
        settingSources: ["project"],
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
      if (msg?.type === "system" && msg?.subtype === "init") apiKeySource = msg.apiKeySource;
      if (typeof msg?.total_cost_usd === "number") costUsd = msg.total_cost_usd;
      if ("result" in msg) console.log(msg.result);
    }
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
    else warn(zeroSpendWarning(apiKeySource));
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

export async function runCms(queue, deps = {}) {
  const {
    query: runQuery = query,
    addSpend: recordSpend = addSpend,
    warn = console.warn,
    exit = process.exit,
  } = deps;

  let costUsd = 0;
  let apiKeySource;
  let failed = false;
  console.log(`CMS mode (${PLATFORM}): writing change_set rows for ${queue.length} pending items.`);

  try {
    for await (const msg of runQuery({
      prompt: goalCms(PLATFORM),
      options: {
        model: process.env.ORCHESTRATOR_MODEL || "claude-sonnet-4-6",
        allowedTools: ["Read", "Write", "Bash", "Agent"],
        permissionMode: "acceptEdits",
        settingSources: ["project"],
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
      if (msg?.type === "system" && msg?.subtype === "init") apiKeySource = msg.apiKeySource;
      if (typeof msg?.total_cost_usd === "number") costUsd = msg.total_cost_usd;
      if ("result" in msg) console.log(msg.result);
    }
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
    else warn(zeroSpendWarning(apiKeySource));
  }
  if (failed) { exit(1); return; }
  console.log(`CMS run complete — check change_set table for pending rows. (cost ≈ $${costUsd.toFixed(2)})`);
}

async function main() {
  const decision = await check(BUDGET_USD);
  if (!decision.ok) { console.log(decision.reason); process.exit(0); }

  if (IS_CMS) {
    await runCms(decision.queue);
  } else {
    await runRepo(decision.queue);
  }
}

// Only run when invoked directly (node run.mjs), not when imported by a test that
// exercises runRepo/runCms with injected deps.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
