// goal.mjs — the orchestrator's goal prompts, isolated from run.mjs so prompt
// changes show up as content diffs in PRs instead of being buried in the runner.
// GOAL_REPO is static; the CMS goal interpolates the platform, so it's a function.
//
// SECURITY: neither goal may instruct the agent to place a field value, page content,
// base value, or reason on a Bash command line. Untrusted data travels through JSON files
// written with the Write tool and read by mem.mjs --file / cms-read.mjs. Bash commands
// carry only fixed flags, controlled identifiers (queue URL, row id, field), and file paths.

export const GOAL_REPO = `
You are the SEO orchestrator. Work ONLY from the pending work_queue.

1. Get the queue:  run \`node scripts/mem.mjs queue\`  (Bash). It returns JSON rows {id,url,task,risk_class}.
2. For each row where risk_class == "safe": dispatch the seo-fixer subagent to run the kit
   skill named in \`task\` against \`url\`, then run the validators. If validation fails, revert
   that file and log action="skip".
3. For any row where risk_class != "safe" (or the change would delete/301/touch brand,
   pricing, YMYL, or a do_not_touch URL): DO NOT act. Write the log payload to a JSON file
   with the Write tool, then log from the file (never put the reason on the command line):
   write output/_log/<slug>.escalate.json = {"url":"<U>","action":"escalate","risk_class":"gated","reason":"<why>"}
   then \`node scripts/mem.mjs log --file output/_log/<slug>.escalate.json\`
   and \`node scripts/mem.mjs status --id <row id> --to escalated\`.
4. After each applied fix: write output/_log/<slug>.applied.json =
   {"url":"<U>","action":"applied","risk_class":"safe","change_type":"<task>","reason":"<what>","pr_url":null}
   then \`node scripts/mem.mjs log --file output/_log/<slug>.applied.json\`
   and mark the queue row \`node scripts/mem.mjs status --id <row id> --to done\`.
5. Respect every threshold in CLAUDE.md. Never push to main. Never publish directly.
Stop when the queue is processed. Do not invent data; the 80% rule applies.
`;

// queueAllowlist(queue) — appended to GOAL_REPO by run.mjs so the agent's own
// `mem.mjs queue` re-fetch is a cross-check against the preflight-vetted rows, not the
// source of truth (A8). This NARROWS the preflight→fetch TOCTOU window at the prompt
// level; it is not a deterministic gate — a code-level cross-check of the delivered diff
// against this list is tracked as follow-up. Only four fields are embedded (id numeric,
// risk_class CHECK-constrained, url/task sensor-written non-empty strings) — the agent
// already reads these same raw values via `mem.mjs queue` Bash output, so embedding them
// here adds no new exposure class; free-text columns (reason, etc.) never reach the prompt.
export function queueAllowlist(queue) {
  const rows = queue.map(({ id, url, task, risk_class }) => ({ id, url, task, risk_class }));
  return `
DISPATCH ALLOWLIST — preflight has already vetted exactly these rows (do_not_touch + risk gates):
${JSON.stringify(rows)}
Work ONLY on rows whose id appears in this allowlist. If \`mem.mjs queue\` returns a row that
is NOT in this list, skip it entirely — do not act on it, escalate it, or change its status.
It arrived after preflight and will be vetted on the next run.
`;
}

export function goalCms(platform) {
  return `
You are the SEO orchestrator targeting a live CMS (${platform}).
Work ONLY from the pending work_queue. Do NOT edit files or create git branches.

SECURITY — ABSOLUTE RULE: never place a CMS value, page content, base value, reason, or any
generated text on a Bash command line. Bash commands carry ONLY fixed flags and controlled
values (a URL from the queue, a field name, a row id, a file path). All data travels through
JSON files written with the Write tool and read by scripts.

1. Get the queue:  run \`node scripts/mem.mjs queue\`  (Bash). It returns JSON rows {id,url,task,risk_class}.
2. For each row where risk_class == "safe":
   a. Dispatch the seo-fixer subagent with the url and task. It returns the PATH of a payload
      JSON file it wrote (containing page_id, base_value, new_value, change_type, the row id, etc).
   b. Commit that payload with ONE call — the only value on the line is the file path:
      \`node scripts/mem.mjs apply --file <path>\`
      (apply writes the change_set row, logs the decision, and marks the queue row done.)
3. For any row where risk_class != "safe": escalate — do not write a change_set row. Write
   the log payload to a file, then log + mark escalated (never put the reason on the line):
   write change_set/_pending/<slug>.escalate.json = {"url":"<U>","action":"escalate","risk_class":"gated","reason":"<why>"}
   then \`node scripts/mem.mjs log --file change_set/_pending/<slug>.escalate.json\`
   and \`node scripts/mem.mjs status --id <row id> --to escalated\`.
4. Respect every threshold in CLAUDE.md. Never write to the CMS directly. Never publish.
Stop when the queue is processed. Do not invent data; the 80% rule applies.
`;
}
