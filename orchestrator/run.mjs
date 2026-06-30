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
    // No [skip ci]: repo-mode PRs carry content (drafts/schema/links), and per
    // .claude/rules/workflow.md content changes MUST trigger the eval-gate. A [skip ci]
    // token here suppresses the eval-gate AND the auto-merge workflow (both on:
    // pull_request), dead-locking delivery on the required check that never reports.
    const { empty, prUrl } = openPR(branch, "seo: automated safe-class fixes", "seo-auto");
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
        allowedTools: ["Read", "Bash", "Agent"],
        permissionMode: "acceptEdits",
        settingSources: ["project"],
        agents: {
          "seo-fixer": {
            description: "Resolves page_id, reads base_value, generates new value, writes change_set row via mem.mjs. Never writes to the CMS directly.",
            prompt: `You are fixing ONE URL on a ${PLATFORM} site. Steps in order:
1. Resolve page_id by calling the ${PLATFORM} API with the URL/slug.
2. Read the current field value (base_value) from the API.
3. Generate the improved value using the named kit skill.
4. Write the change_set row using ONLY these supported field names:
   - post_content  (full HTML post body)
   - title         (Yoast/RankMath SEO title — write as a SEPARATE row from description)
   - description   (Yoast/RankMath meta description — write as a SEPARATE row from title)
   - canonical     (canonical URL)
   - focus         (focus keyword)
   Never use "yoast_meta" or any combined/compound field name.
   node scripts/mem.mjs changeset --url <U> --page-id <ID> --field <F> --base "<current>" --new "<generated>" --type <task>
5. Log: node scripts/mem.mjs log --url <U> --action queued --risk safe --type <task> --reason "change_set row written"
6. Mark done: node scripts/mem.mjs status --url <U> --task <task> --to done
Never write to the CMS directly. Never create git branches.`,
            tools: ["Read", "Bash", "Glob", "Grep"],
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
