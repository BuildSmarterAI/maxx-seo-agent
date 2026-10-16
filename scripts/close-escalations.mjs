#!/usr/bin/env node
// close-escalations.mjs — OPERATOR-RUN, HUMAN-GATED close of Linear escalation tickets. Dry run by default:
// it lists work_queue rows in a terminal status (`done` → Linear "completed", `cancelled` → "canceled")
// that were mirrored (linear_issue_id set) but not yet closed (linear_closed_at null), and mutates nothing.
// Closing needs an explicit operator flag AND scope: `--apply --ids 5,7` or `--apply --all`; each close
// then stamps linear_closed_at so re-runs skip it.
//
// Position (ADR-009 R3 / ADR-010): the escalation mirror stays ONE-DIRECTIONAL — Supabase is the
// authority, Linear a mirror; R3 "stays human-gated even when built" and closing is "a deliberate
// human act". So CI never runs this (it is not in seo-learn.yml) and nothing here closes on its own.
// Needs LINEAR_API_KEY only under --apply (Linear GraphQL API). Prerequisite migration: see MIGRATION_SQL.
//
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

// Human gate (ADR-009 R3 / ADR-010): closing is a deliberate operator act, never automatic.
// Dry run is the default; mutation needs --apply plus --ids or --all.
// Everything below is injectable so tests exercise it without the network or the db.
// Prerequisite: work_queue.linear_closed_at must exist (see MIGRATION_SQL).
// The exact prerequisite migration (also in sql/schema.sql). NOT applied by this script.
export const MIGRATION_SQL = "alter table work_queue add column if not exists linear_closed_at timestamptz;";

// Pure: true only when a DB error says work_queue.linear_closed_at does not exist (Postgres
// undefined_column, SQLSTATE 42703) -- i.e. the prerequisite migration has not been applied.
// closableQueue wraps the PostgREST error as a plain Error, so the message is what survives.
export function isMissingColumnError(err) {
  const msg = String(err?.message ?? "");
  if (!msg.includes("linear_closed_at")) return false;
  return err?.code === "42703" || /does not exist|undefined_column|42703/i.test(msg);
}

// Pure: parse CLI flags. Default is a dry run. Mutation needs --apply AND an explicit scope
// (--ids <comma-list> or --all), so a stray --apply can never close everything.
export function parseArgs(argv) {
  let apply = false, all = false, ids = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--apply") apply = true;
    else if (a === "--all") all = true;
    else if (a === "--ids") {
      const v = argv[++i];
      if (!v || v.startsWith("--")) throw new Error("--ids requires a comma-separated list of work_queue ids");
      const parts = v.split(",").map((s) => s.trim());
      if (parts.some((s) => s === "" || !Number.isInteger(Number(s)))) throw new Error(`--ids must be integers, got '${v}'`);
      ids = parts.map(Number);
    } else throw new Error(`unknown argument '${a}'`);
  }
  if (all && ids) throw new Error("use either --ids or --all, not both");
  if (apply && !all && !ids) throw new Error("--apply requires an explicit scope: --ids <id,id,...> or --all");
  return { apply, all, ids };
}

// Injectable core so tests exercise it without touching the network or the db. DRY RUN is the
// default: it lists what WOULD close and calls neither closeIssue nor markClosed. With
// apply:true it prints the plan first, then closes. A per-row failure is logged loudly and the
// row is left UNSTAMPED (linear_closed_at stays null) so a later operator run retries it.
// Prerequisite: work_queue.linear_closed_at must exist (see MIGRATION_SQL).
export async function closeEscalations({ fetchClosable, closeIssue, markClosed, log, apply = false, ids = null }) {
  let rows = await fetchClosable();
  if (ids) {
    const wanted = new Set(ids.map(String));
    rows = rows.filter((r) => wanted.has(String(r.id)));
  }
  let closed = 0, skipped = 0, failed = 0;
  log(apply
    ? `APPLY: closing ${rows.length} Linear ticket(s) -- operator-approved`
    : `DRY RUN (no Linear mutation, no work_queue update): ${rows.length} closable row(s)`);
  for (const row of rows) {
    const stateType = stateTypeForStatus(row.status);
    log(`  work_queue ${row.id} | ${row.url} | linear_issue_id=${row.linear_issue_id} | ${row.status} -> ${stateType ?? "(no close-state, will skip)"}`);
  }
  for (const row of rows) {
    const stateType = stateTypeForStatus(row.status);
    if (!stateType) {
      skipped++;
      if (apply) log(`skipped work_queue ${row.id}: status '${row.status}' has no Linear close-state`);
      continue;
    }
    if (!apply) continue;
    try {
      const issue = await closeIssue(row.linear_issue_id, stateType);
      await markClosed(row.id);
      log(`closed work_queue ${row.id} -> Linear ${issue.identifier} [${row.status}->${stateType}] (${row.url})`);
      closed++;
    } catch (err) {
      failed++;
      log(`FAILED to close work_queue ${row.id} (${row.url}): ${err.message} -- left unstamped, re-run to retry`);
    }
  }
  log(`close-escalations${apply ? "" : " (dry run)"}: ${closed} closed, ${skipped} skipped, ${failed} failed, ${rows.length} total`);
  return { total: rows.length, closed, skipped, failed };
}


// Injectable CLI driver; returns the process exit code. Exit 2 = bad arguments. A missing
// linear_closed_at column soft-fails (prints the migration SQL, exit 0) ONLY in dry-run; under
// --apply, and for every other error, it throws so the failure is loud (nonzero).
export async function runCli({ argv, fetchClosable, closeIssue, markClosed, log, errLog }) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (err) {
    errLog(`close-escalations: ${err.message}`);
    errLog("usage: node scripts/close-escalations.mjs [--ids 5,7 | --all] [--apply]   (default: dry run)");
    return 2;
  }
  let rows;
  try {
    rows = await fetchClosable();
  } catch (err) {
    if (!args.apply && isMissingColumnError(err)) {
      log("close-escalations: work_queue.linear_closed_at does not exist -- the prerequisite migration has NOT been applied.");
      log("Run this in the Supabase SQL editor (operator action; this script never applies it):");
      log(`  ${MIGRATION_SQL}`);
      return 0;
    }
    throw err;
  }
  const result = await closeEscalations({ fetchClosable: async () => rows, closeIssue, markClosed, log, apply: args.apply, ids: args.ids });
  return result.failed > 0 ? 1 : 0;
}

async function main() {
  // Linear is only touched under --apply: the key and team states are resolved lazily on the
  // first close, so a dry run needs no LINEAR_API_KEY and makes no Linear call at all.
  let statesPromise;
  const closeIssue = async (issueId, stateType) => {
    const apiKey = process.env.LINEAR_API_KEY;
    if (!apiKey) throw new Error("Set LINEAR_API_KEY");
    statesPromise ??= fetchTeamStates(apiKey);
    const stateId = resolveStateId(await statesPromise, stateType);
    if (!stateId) throw new Error(`no Linear '${stateType}' workflow state on team ${TEAM_ID}`);
    return setLinearIssueState(issueId, stateId, apiKey);
  };
  process.exitCode = await runCli({
    argv: process.argv.slice(2),
    fetchClosable: () => closableQueue(),
    closeIssue,
    markClosed: (id) => markRowClosed(id),
    log: (m) => console.log(m),
    errLog: (m) => console.error(m),
  });
}


if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
