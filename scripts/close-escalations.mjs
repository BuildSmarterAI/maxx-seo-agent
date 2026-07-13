#!/usr/bin/env node
// close-escalations.mjs — the reverse of push-escalations. Closes the Linear ticket for an
// escalated work_queue row once that row reaches a terminal status: `done` (resolved) → Linear
// "completed", `cancelled` (withdrawn) → Linear "canceled". Reads rows that were mirrored
// (linear_issue_id set) but not yet closed (linear_closed_at null), moves the Linear issue's
// workflow state, and stamps linear_closed_at so re-runs skip it.
//
// Why this exists: push-escalations.mjs was one-directional — closing an escalated item stayed a
// manual Linear/SQL action, so cancelled/finished queue rows left orphaned OPEN tickets (e.g. the
// 7 cancelled *-sitemap.xml escalations). This makes the mirror bidirectional. CI can't use the
// claude.ai Linear MCP (interactive auth), so it talks to the Linear GraphQL API directly with
// LINEAR_API_KEY, reusing push-escalations' auth pattern and idempotency precedent.
import { fileURLToPath } from "node:url";
import { closableQueue, markClosed as markRowClosed } from "../orchestrator/lib/supabase.mjs";

const LINEAR_API = "https://api.linear.app/graphql";
const TEAM_ID = "c8b2fc25-0b42-4a28-a60d-047c6bb69ebb";    // BSM-AI

// Pure: map a terminal work_queue status to the Linear WorkflowState *type* to move the issue
// to. Returns null for any status we must NOT auto-close (the core skips the row rather than
// guessing). Linear state types: backlog | unstarted | started | completed | canceled | triage.
export function stateTypeForStatus(status) {
  if (status === "done") return "completed";
  if (status === "cancelled") return "canceled";
  return null;
}

// Pure: pick the id of the first workflow state matching `type` from a team's state list.
// Linear teams normally have exactly one canceled and one completed state; first-match keeps it
// deterministic if a team has several. Returns null when the team has no state of that type.
export function resolveStateId(states, type) {
  const match = (states ?? []).find((s) => s.type === type);
  return match?.id ?? null;
}

async function linearGraphQL(apiKey, query, variables) {
  const res = await fetch(LINEAR_API, {
    method: "POST",
    headers: { Authorization: apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Linear ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors) throw new Error(`Linear GraphQL: ${JSON.stringify(json.errors)}`);
  return json.data;
}

// Fetch the team's workflow states ONCE so each row's status→type resolves to a concrete
// stateId without a per-row round-trip.
async function fetchTeamStates(apiKey) {
  const data = await linearGraphQL(
    apiKey,
    "query($teamId: String!){ team(id:$teamId){ states { nodes { id type name } } } }",
    { teamId: TEAM_ID },
  );
  return data?.team?.states?.nodes ?? [];
}

async function setLinearIssueState(issueId, stateId, apiKey) {
  const data = await linearGraphQL(
    apiKey,
    "mutation($id: String!, $input: IssueUpdateInput!){ issueUpdate(id:$id, input:$input){ success issue { id identifier state { type name } } } }",
    { id: issueId, input: { stateId } },
  );
  if (!data?.issueUpdate?.success) throw new Error("Linear issueUpdate returned success=false");
  return data.issueUpdate.issue; // { id, identifier, state }
}

// Injectable core so tests exercise it without touching the network or the db. A per-row
// failure is logged loudly and the row is left UNSTAMPED (linear_closed_at stays null) so the
// next run retries it — a transient Linear error must not fail the learn job or drop the item.
// A row whose status has no mapped Linear state is skipped, not failed (nothing to retry).
export async function closeEscalations({ fetchClosable, closeIssue, markClosed, log }) {
  const rows = await fetchClosable();
  let closed = 0, skipped = 0, failed = 0;
  for (const row of rows) {
    const stateType = stateTypeForStatus(row.status);
    if (!stateType) {
      skipped++;
      log(`skipped work_queue ${row.id}: status '${row.status}' has no Linear close-state`);
      continue;
    }
    try {
      const issue = await closeIssue(row.linear_issue_id, stateType);
      await markClosed(row.id);
      log(`closed work_queue ${row.id} → Linear ${issue.identifier} [${row.status}→${stateType}] (${row.url})`);
      closed++;
    } catch (err) {
      failed++;
      log(`FAILED to close work_queue ${row.id} (${row.url}): ${err.message} — will retry next run`);
    }
  }
  log(`close-escalations: ${closed} closed, ${skipped} skipped, ${failed} failed, ${rows.length} total`);
  return { total: rows.length, closed, skipped, failed };
}

async function main() {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) throw new Error("Set LINEAR_API_KEY");
  const states = await fetchTeamStates(apiKey);
  await closeEscalations({
    fetchClosable: () => closableQueue(),
    closeIssue: (issueId, stateType) => {
      const stateId = resolveStateId(states, stateType);
      if (!stateId) throw new Error(`no Linear '${stateType}' workflow state on team ${TEAM_ID}`);
      return setLinearIssueState(issueId, stateId, apiKey);
    },
    markClosed: (id) => markRowClosed(id),
    log: (m) => console.log(m),
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
