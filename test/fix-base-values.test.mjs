// test/fix-base-values.test.mjs — scripts/fix-base-values.mjs's syncBaseValues().
//
// Panel-A A6: the script fetched ALL change_set rows in a batch regardless of status
// and reset every one to status:"approved" in the same UPDATE that refreshed
// base_value. That defeated two gates at once: a pending row a human never reviewed
// got silently approved, and an escalated/failed/rolledback row got silently
// re-approved and its base_value overwritten with whatever's live NOW — which also
// permanently blinds the drift check for that row (base_value can never differ from
// live again). The fix scopes the query to status:"approved" only and never writes
// status at all.
//
// Run: node --test test/fix-base-values.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";

// lib/db.mjs -> process.exit(1) at import time without these; injected client/deps
// mean no real db or network is ever hit.
process.env.SUPABASE_URL ||= "https://x.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "dummy_service_role_key_000000";

const { syncBaseValues } = await import("../scripts/fix-base-values.mjs");

// Fake Supabase change_set table modelling the two chains the script uses:
//   .from().select(...).eq("batch", b)                    → all rows in that batch
//   .from().update(patch).eq("id", id).eq("status", s).select("id")
//                                                         → a CONDITIONAL update: the patch
//     lands only on rows matching EVERY .eq filter against their CURRENT state, and the
//     affected rows are returned. This mirrors PostgREST's documented semantics for
//     supabase-js `update().eq()...select()` (the ANDed .eq filters become a server-side
//     WHERE evaluated atomically at write time, and `return=representation` returns the
//     matched rows) — the shape is new to this script, so this fake is its unit-test surface.
function fakeClient(seedRows) {
  const rows = new Map(seedRows.map((r) => [r.id, { ...r }]));
  const updates = [];
  return {
    rows,
    updates,
    from: () => ({
      select: () => ({
        eq(field, val) {
          const filtered = [...rows.values()].filter((r) => r[field] === val);
          return Promise.resolve({ data: filtered });
        },
      }),
      update: (patch) => {
        const filters = {};
        const builder = {
          eq(field, val) { filters[field] = val; return builder; },
          select() {
            const matched = [...rows.values()].filter((r) =>
              Object.entries(filters).every(([f, v]) => r[f] === v)
            );
            for (const r of matched) Object.assign(r, patch);
            updates.push({ filters: { ...filters }, patch, affected: matched.map((r) => r.id) });
            return Promise.resolve({ data: matched.map((r) => ({ id: r.id })) });
          },
        };
        return builder;
      },
    }),
  };
}

const fakeFetchMeta = (live) => async () => live;

test("only syncs rows already status:approved — pending rows are untouched", async () => {
  const client = fakeClient([
    { id: 1, batch: "b1", page_id: 10, field: "title", status: "approved" },
    { id: 2, batch: "b1", page_id: 11, field: "title", status: "pending" },
  ]);
  const res = await syncBaseValues("b1", { client, fetchMeta: fakeFetchMeta("Live Title") });

  assert.equal(res.updated, 1);
  assert.equal(client.rows.get(1).base_value, "Live Title");
  assert.equal(client.rows.get(2).base_value, undefined); // untouched
  assert.equal(client.rows.get(2).status, "pending");     // never promoted to approved
});

test("does not touch escalated/failed/rolledback rows", async () => {
  const client = fakeClient([
    { id: 1, batch: "b1", page_id: 10, field: "title", status: "escalated" },
    { id: 2, batch: "b1", page_id: 11, field: "title", status: "failed" },
    { id: 3, batch: "b1", page_id: 12, field: "title", status: "rolledback" },
  ]);
  const res = await syncBaseValues("b1", { client, fetchMeta: fakeFetchMeta("x") });

  assert.equal(res.updated, 0);
  assert.equal(client.updates.length, 0);
});

test("update never writes a status field — approved rows stay approved, nothing else changes", async () => {
  const client = fakeClient([
    { id: 1, batch: "b1", page_id: 10, field: "title", status: "approved" },
  ]);
  await syncBaseValues("b1", { client, fetchMeta: fakeFetchMeta("Live Title") });

  assert.equal(client.updates.length, 1);
  assert.deepEqual(client.updates[0].patch, { base_value: "Live Title" }); // no status key in the patch
  assert.equal("status" in client.updates[0].patch, false);
  assert.equal(client.rows.get(1).base_value, "Live Title");
  assert.equal(client.rows.get(1).status, "approved");
});

// Cross-review (a6-bypass/a6-regression, MEDIUM): the SELECT scopes to approved, but the
// per-row write must ALSO be conditional — a human can escalate/roll back a row between the
// batch read and its individual UPDATE (each iteration awaits a live WP fetch). The write is
// filtered on status, so a row that left "approved" mid-run is a no-op, not a silent
// base_value overwrite (which would permanently blind the drift check for it).
test("TOCTOU: a row de-approved between the read and its write is left untouched", async () => {
  const client = fakeClient([
    { id: 1, batch: "b1", page_id: 10, field: "title", status: "approved", base_value: "old" },
  ]);
  // The injected fetchMeta stands in for the awaited WP call — flip the row to escalated
  // during it, exactly as an operator escalating the row mid-loop would.
  const fetchMeta = async () => { client.rows.get(1).status = "escalated"; return "Live Title"; };
  const res = await syncBaseValues("b1", { client, fetchMeta });

  assert.equal(res.updated, 0);
  assert.equal(res.skipped, 1);
  assert.equal(client.rows.get(1).base_value, "old");     // NOT overwritten
  assert.equal(client.rows.get(1).status, "escalated");
});

test("reports rows present in the batch but not approved (operator visibility)", async () => {
  const client = fakeClient([
    { id: 1, batch: "b1", page_id: 10, field: "title", status: "approved" },
    { id: 2, batch: "b1", page_id: 11, field: "title", status: "pending" },
    { id: 3, batch: "b1", page_id: 12, field: "title", status: "escalated" },
  ]);
  const res = await syncBaseValues("b1", { client, fetchMeta: fakeFetchMeta("x") });

  assert.equal(res.updated, 1);
  assert.equal(res.notApproved, 2);
});

test("only rows in the requested batch are considered", async () => {
  const client = fakeClient([
    { id: 1, batch: "b1", page_id: 10, field: "title", status: "approved" },
    { id: 2, batch: "b2", page_id: 11, field: "title", status: "approved" },
  ]);
  const res = await syncBaseValues("b1", { client, fetchMeta: fakeFetchMeta("x") });

  assert.equal(res.updated, 1);
  assert.equal(client.rows.get(2).base_value, undefined);
});

test("returns updated:0 and makes no writes when the batch has no approved rows", async () => {
  const client = fakeClient([]);
  const res = await syncBaseValues("empty-batch", { client, fetchMeta: fakeFetchMeta("x") });
  assert.equal(res.updated, 0);
  assert.equal(client.updates.length, 0);
});
