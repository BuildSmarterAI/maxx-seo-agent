// test/set-priority.test.mjs — covers the work_queue priority write path (supabase.mjs
// setPriority):
//   1. a non-finite priority is rejected before any write — JSON.stringify({priority: NaN})
//      serializes to null, which would silently null work_queue.priority in prod
//   2. a Supabase error is surfaced, not swallowed
//   3. the happy path writes {priority} to work_queue for the given id
//
// setPriority takes an injectable client (defaults to the shared service-role client, same
// pattern as addSpend), so these run with no network and no real Supabase.
//
// Run: node --test
import { test } from "node:test";
import assert from "node:assert/strict";

// supabase.mjs -> client.mjs throws without these; the injected fake means the real db
// is never called. Set before importing so the module-load env check passes.
process.env.SUPABASE_URL ||= "https://x.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "dummy_service_role_key_000000";

const { setPriority } = await import("../orchestrator/lib/supabase.mjs");

// Minimal fake client: records the .from().update().eq() write chain.
function fakeClient({ error = null } = {}) {
  const updates = [];
  const client = {
    from: (table) => ({
      update: (patch) => ({ eq: async (col, val) => { updates.push({ table, patch, col, val }); return { error }; } }),
    }),
  };
  return { client, updates };
}

test("setPriority rejects a non-finite priority before any write", async () => {
  const { client, updates } = fakeClient();
  await assert.rejects(() => setPriority(7, NaN, client), /finite/);
  await assert.rejects(() => setPriority(7, undefined, client), /finite/);
  assert.deepEqual(updates, []); // guard fired before the write chain
});

test("setPriority surfaces a Supabase error instead of swallowing it", async () => {
  const { client } = fakeClient({ error: { message: "permission denied for table work_queue" } });
  await assert.rejects(() => setPriority(7, 3, client), /permission denied/);
});

test("setPriority writes the priority for the given work_queue row", async () => {
  const { client, updates } = fakeClient();
  await setPriority(7, 3, client);
  assert.deepEqual(updates, [{ table: "work_queue", patch: { priority: 3 }, col: "id", val: 7 }]);
});
