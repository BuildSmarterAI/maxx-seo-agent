#!/usr/bin/env node
// run.mjs — the orchestrator. Reads the work queue, dispatches the kit skills as
// subagents for SAFE-class items only, validates, and opens ONE pull request.
// Risky classes are logged as escalations and skipped. Human merges the PR.
//
// Reaches L2 locally; the scheduled workflow (Phase 2) calls this after the sensors.
import { query } from "@anthropic-ai/claude-agent-sdk";
import { execSync } from "node:child_process";
import { isPaused, monthSpend, addSpend, pendingQueue } from "./lib/supabase.mjs";

const BUDGET_USD = Number(process.env.MONTHLY_BUDGET_USD || 50);
const sh = (c) => execSync(c, { stdio: "pipe" }).toString().trim();
const shq = (c) => { try { return sh(c); } catch { return ""; } };

async function preflight() {
  if (await isPaused()) { console.log("control.paused = true → exiting."); process.exit(0); }
  const spent = await monthSpend();
  if (spent >= BUDGET_USD) { console.log(`budget hit ($${spent}/$${BUDGET_USD}) → exiting.`); process.exit(0); }
  const queue = await pendingQueue(25);
  if (!queue.length) { console.log("queue empty → nothing to do."); process.exit(0); }
  return queue;
}

const GOAL = `
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

async function main() {
  await preflight();
  const branch = `seo/auto-${new Date().toISOString().slice(0, 10)}-${Date.now().toString().slice(-5)}`;
  sh(`git checkout -b ${branch}`);
  let costUsd = 0;

  try {
    for await (const msg of query({
      prompt: GOAL,
      options: {
        model: process.env.ORCHESTRATOR_MODEL || "claude-sonnet-4-6",
        allowedTools: ["Read", "Write", "Edit", "Glob", "Grep", "Bash", "Agent"],
        permissionMode: "acceptEdits",
        settingSources: ["project"],         // load .claude/ skills + hooks + CLAUDE.md
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

    // Open a PR only if the agent actually changed something.
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

main();
