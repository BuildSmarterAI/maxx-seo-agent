// test/close-escalations.test.mjs — covers the escalation CLOSE seam (the reverse of
// push-escalations):
//   1. stateTypeForStatus mapping (pure)
//   2. resolveStateId picks a Linear state by type (pure)
//   3. closeEscalations core with injected fakes (no network, no db)
//
// Run: node --test
import { test } from "node:test";
import assert from "node:assert/strict";

// supabase.mjs -> client.mjs throws without these; the injected fakes mean the db is never
// actually called. Set before importing so module-load env checks pass.
process.env.SUPABASE_URL ||= "https://x.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "dummy_service_role_key_000000";

const { stateTypeForStatus, resolveStateId, closeEscalations, parseArgs, isMissingColumnError, runCli, MIGRATION_SQL } = await import("../scripts/close-escalations.mjs");

const row = (over = {}) => ({
  id: 1, url: "https://www.maxxbuilders.com/post-sitemap.xml", task: "seo-audit",
  risk_class: "safe", priority: 0, status: "cancelled", linear_issue_id: "lin_1", ...over,
});

test("stateTypeForStatus maps terminal queue statuses to Linear state types", () => {
  assert.equal(stateTypeForStatus("done"), "completed");
  assert.equal(stateTypeForStatus("cancelled"), "canceled");
  assert.equal(stateTypeForStatus("escalated"), null); // not terminal — never auto-close
  assert.equal(stateTypeForStatus("pending"), null);
});

test("resolveStateId picks the state of a given type (single match per type)", () => {
  const states = [
    { id: "s_todo", type: "unstarted", name: "Todo", position: 1 },
    { id: "s_done", type: "completed", name: "Done", position: 2 },
    { id: "s_cancel", type: "canceled", name: "Canceled", position: 3 },
  ];
  assert.equal(resolveStateId(states, "completed"), "s_done");
  assert.equal(resolveStateId(states, "canceled"), "s_cancel");
  assert.equal(resolveStateId(states, "started"), null); // absent
  assert.equal(resolveStateId([], "completed"), null);   // empty
  assert.equal(resolveStateId(undefined, "completed"), null); // null-safe
});

test("resolveStateId prefers the canonical name when a type has multiple states", () => {
  // Default Linear team: BOTH Canceled and Duplicate are type 'canceled'. Must pick Canceled,
  // even when Duplicate is returned first, so a withdrawn escalation is not mislabeled Duplicate.
  const states = [
    { id: "s_dup", type: "canceled", name: "Duplicate", position: 5 },
    { id: "s_cancel", type: "canceled", name: "Canceled", position: 4 },
    { id: "s_done", type: "completed", name: "Done", position: 2 },
    { id: "s_merged", type: "completed", name: "Merged", position: 3 },
  ];
  assert.equal(resolveStateId(states, "canceled"), "s_cancel", "prefers 'Canceled' over 'Duplicate'");
  assert.equal(resolveStateId(states, "completed"), "s_done", "prefers 'Done' over 'Merged'");
});

test("resolveStateId falls back to the lowest position when no canonical name matches", () => {
  const states = [
    { id: "s_hi", type: "canceled", name: "Abandoned", position: 9 },
    { id: "s_lo", type: "canceled", name: "Scrapped", position: 2 },
  ];
  assert.equal(resolveStateId(states, "canceled"), "s_lo", "lowest position wins the tiebreak");
});

test("closeEscalations closes one issue per row and stamps each closed", async () => {
  const closed = [], stamped = [];
  const result = await closeEscalations({ apply: true, fetchClosable: async () => [
      row({ id: 1, status: "cancelled", linear_issue_id: "lin_1" }),
      row({ id: 2, status: "done", linear_issue_id: "lin_2" }),
    ],
    closeIssue: async (issueId, stateType) => { closed.push({ issueId, stateType }); return { identifier: `BUI-${closed.length}` }; },
    markClosed: async (id) => { stamped.push(id); },
    log: () => {}, });
  assert.equal(result.total, 2);
  assert.equal(result.closed, 2);
  assert.equal(result.skipped, 0);
  assert.equal(result.failed, 0);
  assert.deepEqual(closed, [
    { issueId: "lin_1", stateType: "canceled" },   // cancelled → canceled
    { issueId: "lin_2", stateType: "completed" },  // done → completed
  ]);
  assert.deepEqual(stamped, [1, 2]);
});

test("a failed closeIssue is isolated: not stamped, others still close", async () => {
  const stamped = [];
  const result = await closeEscalations({ apply: true, fetchClosable: async () => [row({ id: 1, linear_issue_id: "lin_bad" }), row({ id: 2, linear_issue_id: "lin_ok" })],
    closeIssue: async (issueId) => {
      if (issueId === "lin_bad") throw new Error("Linear 500");
      return { identifier: "BUI-2" };
    },
    markClosed: async (id) => { stamped.push(id); },
    log: () => {}, });
  assert.equal(result.closed, 1);
  assert.equal(result.failed, 1);
  assert.deepEqual(stamped, [2]); // row 1 left unstamped for retry
});

test("a row whose status has no Linear close-state is skipped, not failed", async () => {
  const closed = [], stamped = [];
  const result = await closeEscalations({ apply: true, fetchClosable: async () => [row({ id: 9, status: "in_progress" })],
    closeIssue: async (...a) => { closed.push(a); return { identifier: "X" }; },
    markClosed: async (id) => { stamped.push(id); },
    log: () => {}, });
  assert.equal(result.skipped, 1);
  assert.equal(result.closed, 0);
  assert.equal(result.failed, 0);
  assert.deepEqual(closed, []);   // closeIssue never called for an unmapped status
  assert.deepEqual(stamped, []);  // and nothing stamped
});

test("empty queue is a no-op", async () => {
  const result = await closeEscalations({ apply: true, fetchClosable: async () => [],
    closeIssue: async () => { throw new Error("should not be called"); },
    markClosed: async () => { throw new Error("should not be called"); },
    log: () => {}, });
  assert.deepEqual(result, { total: 0, closed: 0, skipped: 0, failed: 0 });
});

// ---- Human gate (ADR-009 R3 / ADR-010: closing is a deliberate human act) ----

test("dry-run (the default) lists rows but never calls closeIssue or markClosed", async () => {
  const logs = [];
  const result = await closeEscalations({
    fetchClosable: async () => [row({ id: 1 }), row({ id: 2, status: "done" })],
    closeIssue: async () => { throw new Error("closeIssue must not be called in dry-run"); },
    markClosed: async () => { throw new Error("markClosed must not be called in dry-run"); },
    log: (m) => logs.push(m),
  });
  assert.equal(result.closed, 0);
  assert.equal(result.total, 2);
  const text = logs.join("\n");
  assert.match(text, /DRY RUN/);
  assert.match(text, /lin_1/);
  assert.match(text, /cancelled.*canceled/);
  assert.match(text, /done.*completed/);
});

test("apply with ids only touches the named work_queue rows", async () => {
  const closed = [], stamped = [];
  const result = await closeEscalations({
    fetchClosable: async () => [row({ id: 4, linear_issue_id: "lin_4" }), row({ id: 5, linear_issue_id: "lin_5" })],
    closeIssue: async (issueId) => { closed.push(issueId); return { identifier: "BUI-5" }; },
    markClosed: async (id) => { stamped.push(id); },
    log: () => {},
    apply: true,
    ids: [5],
  });
  assert.deepEqual(closed, ["lin_5"]);
  assert.deepEqual(stamped, [5]);
  assert.equal(result.closed, 1);
});

test("parseArgs: no flags is dry-run", () => {
  assert.deepEqual(parseArgs([]), { apply: false, all: false, ids: null });
});

test("parseArgs: --apply with neither --ids nor --all is rejected", () => {
  assert.throws(() => parseArgs(["--apply"]), /--ids .*--all/);
});

test("parseArgs: --apply --ids parses a comma list; --apply --all is accepted", () => {
  assert.deepEqual(parseArgs(["--apply", "--ids", "5,7"]), { apply: true, all: false, ids: [5, 7] });
  assert.deepEqual(parseArgs(["--apply", "--all"]), { apply: true, all: true, ids: null });
});

test("parseArgs: rejects --ids with --all, bad ids, and unknown flags", () => {
  assert.throws(() => parseArgs(["--apply", "--ids", "5", "--all"]));
  assert.throws(() => parseArgs(["--apply", "--ids", "x"]));
  assert.throws(() => parseArgs(["--apply", "--ids"]));
  assert.throws(() => parseArgs(["--bogus"]));
});

test("parseArgs: --ids / --all without --apply stay dry-run (scoped preview)", () => {
  assert.deepEqual(parseArgs(["--ids", "5"]), { apply: false, all: false, ids: [5] });
  assert.deepEqual(parseArgs(["--all"]), { apply: false, all: true, ids: null });
});

test("isMissingColumnError detects an undefined linear_closed_at column only", () => {
  assert.equal(isMissingColumnError(new Error("closableQueue failed: column work_queue.linear_closed_at does not exist")), true);
  assert.equal(isMissingColumnError({ code: "42703", message: "undefined_column linear_closed_at" }), true);
  assert.equal(isMissingColumnError(new Error("closableQueue failed: connection refused")), false);
  assert.equal(isMissingColumnError(new Error("column work_queue.other does not exist")), false);
});

test("runCli dry-run soft-fails on missing column: prints the migration SQL, exit 0", async () => {
  const logs = [];
  const code = await runCli({
    argv: [],
    fetchClosable: async () => { throw new Error("closableQueue failed: column work_queue.linear_closed_at does not exist"); },
    log: (m) => logs.push(m), errLog: (m) => logs.push(m),
  });
  assert.equal(code, 0);
  assert.ok(logs.join("\n").includes(MIGRATION_SQL));
  assert.equal(MIGRATION_SQL, "alter table work_queue add column if not exists linear_closed_at timestamptz;");
});

test("runCli rethrows any other DB error (nonzero path)", async () => {
  await assert.rejects(
    runCli({ argv: [], fetchClosable: async () => { throw new Error("closableQueue failed: connection refused"); }, log: () => {}, errLog: () => {} }),
    /connection refused/,
  );
});

test("runCli --apply with a missing column does not soft-succeed", async () => {
  await assert.rejects(
    runCli({ argv: ["--apply", "--all"], fetchClosable: async () => { throw new Error("column work_queue.linear_closed_at does not exist"); }, closeIssue: async () => ({}), markClosed: async () => {}, log: () => {}, errLog: () => {} }),
  );
});

test("runCli rejects --apply without scope before touching the db", async () => {
  let fetched = false;
  const code = await runCli({ argv: ["--apply"], fetchClosable: async () => { fetched = true; return []; }, log: () => {}, errLog: () => {} });
  assert.equal(code, 2);
  assert.equal(fetched, false);
});

test("runCli default never mutates", async () => {
  const code = await runCli({
    argv: [],
    fetchClosable: async () => [row()],
    closeIssue: async () => { throw new Error("no"); },
    markClosed: async () => { throw new Error("no"); },
    log: () => {}, errLog: () => {},
  });
  assert.equal(code, 0);
});

