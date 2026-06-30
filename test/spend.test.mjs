// test/spend.test.mjs — covers the spend-counter write path (supabase.mjs addSpend):
//   1. the atomic increment_spend RPC is used on the happy path
//   2. the pre-migration fallback (read-modify-write) runs when the RPC errors
//   3. a stale stored month reads as a zero base in the fallback
//   4. a missing/NaN cost coerces to 0
//
// addSpend takes an injectable client (defaults to the shared service-role client),
// so these run with no network and no real Supabase.
//
// Run: node --test
import { test } from "node:test";
import assert from "node:assert/strict";

// supabase.mjs -> client.mjs throws without these; the injected fake means the real db
// is never called. Set before importing so the module-load env check passes.
process.env.SUPABASE_URL ||= "https://x.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "dummy_service_role_key_000000";

const { addSpend } = await import("../orchestrator/lib/supabase.mjs");

// Minimal fake client: records rpc calls and the fallback's update patches, and supports
// the .from().select().eq().single() read + .from().update().eq() write chains.
function fakeClient({ rpcError = null, controlRow = null } = {}) {
  const calls = { rpc: [], updates: [] };
  const client = {
    rpc: async (name, params) => { calls.rpc.push({ name, params }); return { error: rpcError }; },
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: controlRow }) }) }),
      update: (patch) => ({ eq: async () => { calls.updates.push(patch); return { error: null }; } }),
    }),
  };
  return { client, calls };
}

const thisMonth = () => new Date().toISOString().slice(0, 7);

test("addSpend uses the atomic increment_spend RPC and skips the fallback on success", async () => {
  const { client, calls } = fakeClient({ rpcError: null });
  await addSpend(1.25, client);
  assert.equal(calls.rpc.length, 1);
  assert.equal(calls.rpc[0].name, "increment_spend");
  assert.equal(calls.rpc[0].params.p_amount, 1.25);
  assert.equal(calls.rpc[0].params.p_month, thisMonth());
  assert.equal(calls.updates.length, 0); // fallback NOT taken
});

test("addSpend falls back to read-modify-write when the RPC is unavailable, preserving the running total", async () => {
  const month = thisMonth();
  const { client, calls } = fakeClient({
    rpcError: { message: "function increment_spend does not exist" },
    controlRow: { month, spend_usd: 5 },
  });
  await addSpend(2, client);
  assert.equal(calls.rpc.length, 1);            // attempted the RPC first
  assert.equal(calls.updates.length, 1);        // then fell back
  assert.equal(calls.updates[0].spend_usd, 7);  // 5 + 2
  assert.equal(calls.updates[0].month, month);
});

test("addSpend fallback treats a stale stored month as a zero base", async () => {
  const { client, calls } = fakeClient({
    rpcError: { message: "no function" },
    controlRow: { month: "2000-01", spend_usd: 99 },
  });
  await addSpend(3, client);
  assert.equal(calls.updates[0].spend_usd, 3);  // stale month → base 0, not 99 + 3
  assert.equal(calls.updates[0].month, thisMonth());
});

test("addSpend coerces a missing/NaN cost to 0", async () => {
  const { client, calls } = fakeClient({ rpcError: null });
  await addSpend(undefined, client);
  assert.equal(calls.rpc[0].params.p_amount, 0);
});
