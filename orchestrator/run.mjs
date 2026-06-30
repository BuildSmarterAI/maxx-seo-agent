#!/usr/bin/env node
// run.mjs — the orchestrator. Reads the work queue, dispatches the kit skills as
// subagents for SAFE-class items only, validates, and opens ONE pull request.
// Risky classes are logged as escalations and skipped. Human merges the PR.
//
// Thin coordinator: the run/skip decision lives in lib/preflight.mjs, the goal
// prompts in goal.mjs, and repo-mode git delivery in lib/git-delivery.mjs.
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

async function runRepo(queue) {
  const branch = startBranch();
  let costUsd = 0;

  // Agent failure: roll back the branch and bail — nothing useful was produced.
  try {
    for await (const msg of query({
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
      if (typeof msg?.total_cost_usd === "number") costUsd = msg.total_cost_usd;
      if ("result" in msg) console.log(msg.result);
    }
  } catch (err) {
    console.error("orchestrator failed, rolling back:", err?.message || err);
    rollback(branch);
    process.exit(1);
  }

  if (costUsd) await addSpend(costUsd);

  // Delivery failure (commit/push/PR) is handled separately from agent failure.
  try {
    const { empty, prUrl } = openPR(branch, "seo: automated safe-class fixes [skip ci]", "seo-auto");
    if (empty) { console.log("no changes produced → cleaning up."); return; }
    console.log(`PR opened: ${prUrl}  (cost ≈ $${costUsd.toFixed(2)})`);
  } catch (err) {
    // Unlike an agent failure, a delivery failure (push/PR) leaves the agent's work
    // committed locally on `branch` — keep it for hand-inspection/retry rather than
    // discarding it (and the spend) with a hard reset.
    console.error(`delivery failed; changes are committed locally on ${branch}:`, err?.message || err);
    process.exit(1);
  }
}

async function runCms(queue) {
  let costUsd = 0;
  console.log(`CMS mode (${PLATFORM}): writing change_set rows for ${queue.length} pending items.`);

  try {
    for await (const msg of query({
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
      if (typeof msg?.total_cost_usd === "number") costUsd = msg.total_cost_usd;
      if ("result" in msg) console.log(msg.result);
    }

    if (costUsd) await addSpend(costUsd);
    console.log(`CMS run complete — check change_set table for pending rows. (cost ≈ $${costUsd.toFixed(2)})`);
  } catch (err) {
    // The Agent SDK emits "Claude Code process exited with code 1" as a normal
    // shutdown signal after the query loop completes — not a real failure.
    if (/process exited with code 1/i.test(err?.message || "")) {
      console.log(`CMS run complete — check change_set table for pending rows. (cost ≈ $${costUsd.toFixed(2)})`);
      if (costUsd) await addSpend(costUsd);
      return;
    }
    console.error("orchestrator (CMS) failed:", err?.message || err);
    process.exit(1);
  }
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

main();
