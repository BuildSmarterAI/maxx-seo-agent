#!/usr/bin/env node
// run.mjs — the orchestrator. Reads the work queue, dispatches the kit skills as
// subagents for SAFE-class items only, validates, and opens ONE pull request.
// Risky classes are logged as escalations and skipped. Human merges the PR.
//
// Reaches L2 locally; the scheduled workflow (Phase 2) calls this after the sensors.
import { query } from "@anthropic-ai/claude-agent-sdk";
import { execSync } from "node:child_process";
import { isPaused, resetMonthIfNew, getMonthSpend, addSpend, pendingQueue } from "./lib/supabase.mjs";

const BUDGET_USD = Number(process.env.MONTHLY_BUDGET_USD || 50);
const PLATFORM = (process.env.SITE_PLATFORM || "repo").toLowerCase();
const IS_CMS = PLATFORM === "wordpress" || PLATFORM === "webflow";
const sh = (c) => execSync(c, { stdio: "pipe" }).toString().trim();
const shq = (c) => { try { return sh(c); } catch { return ""; } };

async function preflight() {
  if (await isPaused()) { console.log("control.paused = true → exiting."); process.exit(0); }
  await resetMonthIfNew();
  const spent = await getMonthSpend();
  if (spent >= BUDGET_USD) { console.log(`budget hit ($${spent}/$${BUDGET_USD}) → exiting.`); process.exit(0); }
  const queue = await pendingQueue(25);
  if (!queue.length) { console.log("queue empty → nothing to do."); process.exit(0); }
  return queue;
}

const GOAL_REPO = `
You are the SEO orchestrator. Work ONLY from the pending work_queue.

1. Get the queue:  run \`node scripts/mem.mjs queue\`  (Bash). It returns JSON rows {url,task,risk_class}.
2. For each row where risk_class == "safe": dispatch the seo-fixer subagent to run the kit
   skill named in \`task\` against \`url\`, then run the validators. If validation fails, revert
   that file and log action="skip".
3. For any row where risk_class != "safe" (or the change would delete/301/touch brand,
   pricing, YMYL, or a do_not_touch URL): DO NOT act. Log it:
   \`node scripts/mem.mjs log --url <U> --action escalate --risk gated --reason "<why>"\`
   and \`node scripts/mem.mjs status --url <U> --task <T> --to escalated\`.
4. After each applied fix:
   \`node scripts/mem.mjs log --url <U> --action applied --risk safe --type <task> --reason "<what>"\`
   and mark the queue row \`--to done\`.
5. Respect every threshold in CLAUDE.md. Never push to main. Never publish directly.
Stop when the queue is processed. Do not invent data; the 80% rule applies.
`;

const GOAL_CMS = `
You are the SEO orchestrator targeting a live CMS (${PLATFORM}).
Work ONLY from the pending work_queue. Do NOT edit files or create git branches.

1. Get the queue:  run \`node scripts/mem.mjs queue\`  (Bash). It returns JSON rows {url,task,risk_class}.
2. For each row where risk_class == "safe":
   a. Dispatch the seo-fixer subagent with the url and task.
   b. The subagent MUST:
      - Resolve page_id: call the ${PLATFORM} API to look up the page by URL/slug.
      - Read base_value: fetch the current live value of the field being changed.
      - Generate the new value using the kit skill named in \`task\`.
      - Write the change_set row (DO NOT write to the CMS directly):
        \`node scripts/mem.mjs changeset --url <U> --page-id <ID> --field <F> --base "<current>" --new "<generated>" --type <task>\`
      - Log the decision:
        \`node scripts/mem.mjs log --url <U> --action queued --risk safe --type <task> --reason "change_set row written, awaiting approval"\`
      - Mark the queue row done:
        \`node scripts/mem.mjs status --url <U> --task <task> --to done\`
3. For any row where risk_class != "safe": escalate — do not write a change_set row.
   \`node scripts/mem.mjs log --url <U> --action escalate --risk gated --reason "<why>"\`
   \`node scripts/mem.mjs status --url <U> --task <T> --to escalated\`
4. Respect every threshold in CLAUDE.md. Never write to the CMS directly. Never publish.
Stop when the queue is processed. Do not invent data; the 80% rule applies.
`;

async function runRepo(queue) {
  const branch = `seo/auto-${new Date().toISOString().slice(0, 10)}-${Date.now().toString().slice(-5)}`;
  sh(`git checkout -b ${branch}`);
  let costUsd = 0;

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

    if (costUsd) await addSpend(costUsd);

    sh("git add -A");
    const dirty = shq("git status --porcelain");
    if (!dirty) { console.log("no changes produced → cleaning up."); sh(`git checkout - && git branch -D ${branch}`); return; }

    sh(`git commit -m "seo: automated safe-class fixes [skip ci]"`);
    sh(`git push -u origin ${branch}`);
    const pr = shq(`gh pr create --fill --label seo-auto`);
    console.log(`PR opened: ${pr}  (cost ≈ $${costUsd.toFixed(2)})`);
  } catch (err) {
    console.error("orchestrator failed, rolling back:", err?.message || err);
    shq("git reset --hard");
    shq(`git checkout - && git branch -D ${branch}`);
    process.exit(1);
  }
}

async function runCms(queue) {
  let costUsd = 0;
  console.log(`CMS mode (${PLATFORM}): writing change_set rows for ${queue.length} pending items.`);

  try {
    for await (const msg of query({
      prompt: GOAL_CMS,
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
  const queue = await preflight();
  if (IS_CMS) {
    await runCms(queue);
  } else {
    await runRepo(queue);
  }
}

main();
