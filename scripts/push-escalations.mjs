#!/usr/bin/env node
// push-escalations.mjs — one-directional mirror of escalated work to Linear.
// Reads work_queue rows with status='escalated' and no linear_issue_id yet, and
// creates one Linear issue per row in the "Maxx Builders SEO Audit" project. The
// linear_issue_id pointer is written back so re-runs never duplicate.
//
// CI cannot use the claude.ai Linear MCP (interactive auth), so this talks to the
// Linear GraphQL API directly with LINEAR_API_KEY. v1 is one-directional: closing
// an escalated item (Linear done → work_queue done) stays a human/SQL action.
import { fileURLToPath } from "node:url";
import { escalatedQueue, setLinearIssueId } from "../orchestrator/lib/supabase.mjs";

const LINEAR_API = "https://api.linear.app/graphql";
const TEAM_ID = "c8b2fc25-0b42-4a28-a60d-047c6bb69ebb";    // BSM-AI
const PROJECT_ID = "4732c6e5-1eec-464c-80b6-5c48d5ab3d43"; // Maxx Builders SEO Audit

// work_queue.priority (higher int = more urgent) → Linear priority (1 urgent … 4 low, 0 none).
export function linearPriority(p) {
  if (p >= 3) return 1;
  if (p === 2) return 2;
  if (p === 1) return 3;
  return 0;
}

// Pure: build the Linear issueCreate input from a queue row.
export function buildIssueInput(row) {
  const title = `[escalated] ${row.task}: ${row.url}`;
  const description = [
    `Auto-mirrored from \`work_queue\` (id ${row.id}) — risk \`${row.risk_class}\`, source \`${row.source ?? "?"}\`.`,
    ``,
    `**URL:** ${row.url}`,
    `**Task (kit skill):** ${row.task}`,
    ``,
    `The orchestrator escalated this: it needs human action the CMS packs can't apply `,
    `(redirects, Yoast/host/Elementor config, etc.). Resolve in WordPress, then mark the `,
    `work_queue row done. Do not edit this issue's link to the queue.`,
  ].join("\n");
  return { teamId: TEAM_ID, projectId: PROJECT_ID, title, description, priority: linearPriority(row.priority) };
}

async function createLinearIssue(input, apiKey) {
  const res = await fetch(LINEAR_API, {
    method: "POST",
    headers: { Authorization: apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: "mutation($input: IssueCreateInput!){ issueCreate(input:$input){ success issue { id identifier url } } }",
      variables: { input },
    }),
  });
  if (!res.ok) throw new Error(`Linear ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors) throw new Error(`Linear GraphQL: ${JSON.stringify(json.errors)}`);
  if (!json.data?.issueCreate?.success) throw new Error("Linear issueCreate returned success=false");
  return json.data.issueCreate.issue; // { id, identifier, url }
}

// Injectable core so tests exercise it without touching the network or the db.
// A per-row failure is logged loudly and the row is left unmirrored (linear_issue_id
// stays null) so the next run retries it — a transient Linear error must not fail
// the whole learn job or drop the item silently.
export async function pushEscalations({ fetchEscalated, createIssue, markPushed, log }) {
  const rows = await fetchEscalated();
  let pushed = 0, failed = 0;
  for (const row of rows) {
    try {
      const issue = await createIssue(buildIssueInput(row));
      await markPushed(row.id, issue.id);
      log(`mirrored work_queue ${row.id} → Linear ${issue.identifier} (${row.url})`);
      pushed++;
    } catch (err) {
      failed++;
      log(`FAILED to mirror work_queue ${row.id} (${row.url}): ${err.message} — will retry next run`);
    }
  }
  log(`push-escalations: ${pushed} mirrored, ${failed} failed, ${rows.length} total`);
  return { total: rows.length, pushed, failed };
}

async function main() {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) throw new Error("Set LINEAR_API_KEY");
  await pushEscalations({
    fetchEscalated: () => escalatedQueue(),
    createIssue: (input) => createLinearIssue(input, apiKey),
    markPushed: (id, linearId) => setLinearIssueId(id, linearId),
    log: (m) => console.log(m),
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
