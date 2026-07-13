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
//
// KNOWN LIMITATION (upstream queue lifecycle — not fixable in this script): the close-path
// relies on an escalated row transitioning IN PLACE to done/cancelled while keeping its
// linear_issue_id. Because work_queue rows are never purged and carry unique(url,task,status), a
// SECOND escalate->resolve cycle for the SAME (url,task) collides on the surviving terminal row —
// setQueueStatusById throws, the row stays 'escalated', and its new ticket is never auto-closed.
// This recurs only on repeat escalations of the same URL+task (e.g. GSC-decay re-enqueue),
// surfaces loudly (the status UPDATE errors), and belongs to the queue-uniqueness design (relax
// the constraint / purge terminal rows) — tracked as a follow-up, not worked around here.
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

// Canonical primary state name per Linear category — the tiebreaker when a team has MORE THAN
// ONE state of the target type. A default Linear team ships BOTH "Canceled" and "Duplicate" as
// type `canceled` (and teams often add "Merged"/"Deployed" alongside "Done" as `completed`), so
// naive first-match could move a withdrawn escalation to "Duplicate". Preferring the canonical
// name — then the lowest `position` (Linear's in-category order) — lands on the intended state.
const CANONICAL_STATE_NAME = { canceled: "Canceled", completed: "Done" };

// Pure: resolve the concrete Linear workflow-state id to move an issue to, from a team's state
// list. Among states of the target `type`: a lone match wins; otherwise prefer the one whose name
// is the canonical category name, else the lowest-`position` state (falling back to input order
// when position is absent). Returns null when the team has no state of that type.
export function resolveStateId(states, type) {
  const ofType = (states ?? []).filter((s) => s.type === type);
  if (ofType.length <= 1) return ofType[0]?.id ?? null;
  const canonical = CANONICAL_STATE_NAME[type];
  const named = canonical && ofType.find((s) => (s.name ?? "").toLowerCase() === canonical.toLowerCase());
  if (named) return named.id;
  const byPosition = [...ofType].sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity));
  return byPosition[0].id;
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
    "query($teamId: String!){ team(id:$teamId){ states { nodes { id type name position } } } }",
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
  // Isolate the one-time team-states pre-fetch: a transient Linear error here must NOT fail the
  // weekly learn job (close-escalations shares a non-continue-on-error CI step with attribution).
  // Per-row closeIssue failures are already isolated inside closeEscalations; this covers the
  // pre-fetch that sits outside it.
  let states;
  try {
    states = await fetchTeamStates(apiKey);
  } catch (err) {
    console.error(`close-escalations: could not fetch Linear team states — skipping this run, retries next run: ${err.message}`);
    return;
  }
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
