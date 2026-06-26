#!/usr/bin/env node
// mem.mjs — thin CLI the orchestrator's agent calls via Bash so memory writes are
// deterministic in headless/CI (no MCP tool-approval friction).
//
//   node scripts/mem.mjs queue                         # print pending items as JSON
//   node scripts/mem.mjs log    --url U --action applied --risk safe --reason "..." --pr URL
//   node scripts/mem.mjs status --url U --task T --to done|escalated|in_progress
//   node scripts/mem.mjs experiment --surface skill --target blog-write --variant v2 --arm treatment --alloc 0.5
//   node scripts/mem.mjs evalset    --type blog-write --label bad --mode placeholder --source synthetic --artifact "..."
import {
  pendingQueue, logDecision, insertChangeset, setQueueStatus,
  recordExperiment, insertEvalExample,
} from "../orchestrator/lib/supabase.mjs";

function args(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i += 2) o[argv[i].replace(/^--/, "")] = argv[i + 1];
  return o;
}

const [cmd, ...rest] = process.argv.slice(2);
const a = args(rest);

if (cmd === "queue") {
  console.log(JSON.stringify(await pendingQueue(Number(a.limit) || 25)));
} else if (cmd === "log") {
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
  console.log("logged");
} else if (cmd === "status") {
  await setQueueStatus(a.url, a.task, a.to);
  console.log("updated");
} else if (cmd === "changeset") {
  // node scripts/mem.mjs changeset --url U --page-id 123 --field title --base "old" --new "new" --type metadata-generate --platform wordpress
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
  console.log("changeset row inserted");
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
