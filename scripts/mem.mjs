#!/usr/bin/env node
// mem.mjs — thin CLI the orchestrator's agent calls via Bash so memory writes are
// deterministic in headless/CI (no MCP tool-approval friction).
//
//   node scripts/mem.mjs queue                         # print pending items as JSON
//   node scripts/mem.mjs apply  --file PAYLOAD.json     # changeset + log + status from one JSON
//   node scripts/mem.mjs changeset --file PAYLOAD.json  # insert a change_set row from JSON
//   node scripts/mem.mjs log    --file PAYLOAD.json     # insert a decision_log row from JSON
//   node scripts/mem.mjs status --id 42 --to done|escalated|in_progress
//   node scripts/mem.mjs dnt   [URL]                  # do_not_touch guard: exit 2 if URL is protected
//   node scripts/mem.mjs experiment --surface skill --target blog-write --variant v2 --arm treatment --alloc 0.5
//   node scripts/mem.mjs evalset    --type blog-write --label bad --mode placeholder --source synthetic --artifact "..."
//
// SECURITY: content-bearing writes (changeset, log, apply) take a FILE path only — the
// agent writes the JSON payload with the Write tool, and the value travels through the
// file, never interpolated into a shell command. status keys on the queue row id (an
// integer), not the URL. The legacy --flag paths remain for back-compat but the agent
// prompts no longer use them for any untrusted value. See orchestrator/lib/payload.mjs.
import { readFileSync } from "node:fs";
import { pendingQueue, logDecision, insertChangeset, setQueueStatus, setQueueStatusById, doNotTouch, recordExperiment, insertEvalExample } from "../orchestrator/lib/supabase.mjs";
import { assertTaskType } from "../orchestrator/lib/tasks.mjs";
import { parseChangesetPayload, parseLogPayload } from "../orchestrator/lib/payload.mjs";

function args(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i += 2) o[argv[i].replace(/^--/, "")] = argv[i + 1];
  return o;
}

// Path only — the value is read from the file, never from the command line.
const readPayload = (p) => JSON.parse(readFileSync(p, "utf8"));

const [cmd, ...rest] = process.argv.slice(2);
const a = args(rest);

if (cmd === "queue") {
  console.log(JSON.stringify(await pendingQueue(Number(a.limit) || 25)));
} else if (cmd === "dnt") {
  // Protected-URL guard for the seo-fixer's step-2 check. Reads the do_not_touch table
  // (NOT work_queue — the bug this replaces) and signals via exit code so a Bash caller
  // can abort. `dnt <url>` checks one URL; bare `dnt` prints the whole protected list.
  const url = rest[0];
  const protectedUrls = await doNotTouch();
  if (!url) {
    console.log(JSON.stringify([...protectedUrls]));
  } else if (protectedUrls.has(url)) {
    console.error(`PROTECTED: ${url} is in do_not_touch — abort, do not modify`);
    process.exit(2);
  } else {
    console.log(`OK: ${url} is not in do_not_touch`);
  }
} else if (cmd === "apply") {
  // One safe call: changeset + log (+ status by id) from a single JSON payload the agent wrote.
  const payload = readPayload(a.file);
  await insertChangeset(parseChangesetPayload(payload));
  await logDecision(parseLogPayload(payload));
  if (payload.id != null && payload.status_to) await setQueueStatusById(payload.id, payload.status_to);
  console.log(`applied ${payload.field} for ${payload.url}`);
} else if (cmd === "changeset") {
  if (a.file) {
    await insertChangeset(parseChangesetPayload(readPayload(a.file)));
  } else {
    // Legacy flag path (kept for back-compat; prompts no longer use it for untrusted values).
    await insertChangeset({
      platform:   a.platform || process.env.SITE_PLATFORM || "wordpress",
      page_id:    a["page-id"] ?? null,
      url:        a.url,
      field:      a.field,
      base_value: a.base ?? null,
      new_value:  a.new,
      change_type: a.type ?? null,
      status:     "pending",
    });
  }
  console.log("changeset row inserted");
} else if (cmd === "log") {
  if (a.file) {
    await logDecision(parseLogPayload(readPayload(a.file)));
  } else {
    // Reject a non-task --type at the CLI boundary so a stray label can't enter decision_log.
    assertTaskType(a.type);
    // Provenance (model + prompt_variant_id) is stamped from flags-or-env so the frozen
    // orchestrator goal prompt does NOT need to change: when an experiment is active the
    // runner exports PROMPT_VARIANT_ID and every decision is auto-tagged; otherwise null
    // (= baseline). cost_usd stays null per-decision (run-level cost → control.spend_usd).
    await logDecision({
      url: a.url, action: a.action, risk_class: a.risk || "safe",
      change_type: a.type, reason: a.reason, agent: a.agent || "orchestrator", pr_url: a.pr,
      model: a.model || process.env.ORCHESTRATOR_MODEL || "claude-sonnet-4-6",
      prompt_variant_id: a.variant || process.env.PROMPT_VARIANT_ID || null,
      cost_usd: a.cost ? Number(a.cost) : null,
    });
  }
  console.log("logged");
} else if (cmd === "status") {
  if (a.id != null) await setQueueStatusById(a.id, a.to);
  else await setQueueStatus(a.url, a.task, a.to);
  console.log("updated");
} else if (cmd === "experiment") {
  // node scripts/mem.mjs experiment --surface skill --target blog-write --variant v2 --arm treatment --alloc 0.5 --metric avg_effect
  await recordExperiment({
    surface: a.surface, target: a.target, variant_id: a.variant, arm: a.arm,
    allocation: a.alloc ? Number(a.alloc) : 0, metric: a.metric ?? null,
    value: a.value ? Number(a.value) : null, n: a.n ? Number(a.n) : 0,
    status: a.status || "active",
  });
  console.log("experiment row inserted");
} else if (cmd === "evalset") {
  // node scripts/mem.mjs evalset --type blog-write --label bad --mode placeholder --source synthetic --artifact "..." --url U --lift 0.12
  await insertEvalExample({
    change_type: a.type, url: a.url ?? null, artifact: a.artifact ?? null,
    label: a.label, failure_mode: a.mode ?? null,
    realized_lift: a.lift ? Number(a.lift) : null, source: a.source || "human",
  });
  console.log("eval_set row inserted");
} else {
  console.error("unknown command:", cmd);
  process.exit(1);
}
