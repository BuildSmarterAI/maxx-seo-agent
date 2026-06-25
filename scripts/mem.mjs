#!/usr/bin/env node
// mem.mjs — thin CLI the orchestrator's agent calls via Bash so memory writes are
// deterministic in headless/CI (no MCP tool-approval friction).
//
//   node scripts/mem.mjs queue                         # print pending items as JSON
//   node scripts/mem.mjs log    --url U --action applied --risk safe --reason "..." --pr URL
//   node scripts/mem.mjs status --url U --task T --to done|escalated|in_progress
import { pendingQueue, logDecision, insertChangeset, setQueueStatus } from "../orchestrator/lib/supabase.mjs";

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
  await logDecision({
    url: a.url, action: a.action, risk_class: a.risk || "safe",
    change_type: a.type, reason: a.reason, agent: a.agent || "orchestrator", pr_url: a.pr,
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
} else {
  console.error("unknown command:", cmd);
  process.exit(1);
}
