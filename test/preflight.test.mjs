// test/preflight.test.mjs — covers the run/skip decision (preflight.mjs check()):
//   1. control.paused = true stops the run and short-circuits (no spend/queue reads)
//   2. spend >= budget stops the run (boundary: == budget also stops)
//   3. spend just under budget proceeds
//   4. an empty queue stops the run
//   5. the happy path returns { ok:true, queue } and threads queueLimit through
//   6. resetMonthIfNew runs before the spend read
//
// check() takes injectable deps (defaulting to the real supabase.mjs fns), so the gate
// logic runs with no network — same optional-injection pattern as spend.test.mjs.
//
// Run: node --test
import { test } from "node:test";
import assert from "node:assert/strict";

// supabase.mjs -> client.mjs throws at import without these; preflight.mjs imports it at
// module load even though we inject deps. Set before importing so the load-time check passes.
process.env.SUPABASE_URL ||= "https://x.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "dummy_service_role_key_000000";

const { check } = await import("../orchestrator/lib/preflight.mjs");

// Records which gate functions ran, in order; configurable paused/spent/queue.
// doNotTouch/setQueueStatusById/logDecision are faked too: before cross-review 56-3 these
// tests silently leaned on the REAL doNotTouch() failing open (network error → empty set)
// — the exact defect that fix removes. No dep here may ever reach the network.
function fakeDeps({ paused = false, spent = 0, queue = [{ id: 1 }] } = {}) {
  const calls = [];
  const deps = {
    isPaused: async () => { calls.push("isPaused"); return paused; },
    resetMonthIfNew: async () => { calls.push("resetMonthIfNew"); },
    getMonthSpend: async () => { calls.push("getMonthSpend"); return spent; },
    pendingQueue: async (limit) => { calls.push(`pendingQueue:${limit}`); return queue; },
    doNotTouch: async () => { calls.push("doNotTouch"); return new Set(); },
    setQueueStatusById: async () => { calls.push("setQueueStatusById"); },
    logDecision: async () => { calls.push("logDecision"); },
  };
  return { calls, deps };
}

test("check stops when paused, without reading spend or the queue", async () => {
  const { calls, deps } = fakeDeps({ paused: true });
  const res = await check(50, 25, deps);
  assert.equal(res.ok, false);
  assert.match(res.reason, /paused/);
  assert.deepEqual(calls, ["isPaused"]); // short-circuited before spend/queue
});

test("check stops when the month spend has hit the budget (>= boundary)", async () => {
  const { deps } = fakeDeps({ spent: 50 });
  const res = await check(50, 25, deps); // spent == budget
  assert.equal(res.ok, false);
  assert.match(res.reason, /budget hit \(\$50\/\$50\)/);
});

test("check proceeds when spend is just under budget", async () => {
  const { deps } = fakeDeps({ spent: 49.99, queue: [{ id: 1 }] });
  const res = await check(50, 25, deps);
  assert.equal(res.ok, true);
});

test("check stops when the queue is empty", async () => {
  const { calls, deps } = fakeDeps({ spent: 0, queue: [] });
  const res = await check(50, 25, deps);
  assert.equal(res.ok, false);
  assert.match(res.reason, /queue empty/);
  assert.ok(calls.includes("getMonthSpend")); // got past the budget gate first
});

test("check returns ok with the pending queue and threads queueLimit through", async () => {
  const q = [{ id: 1 }, { id: 2 }];
  const { calls, deps } = fakeDeps({ spent: 10, queue: q });
  const res = await check(50, 7, deps);
  assert.deepEqual(res, { ok: true, queue: q });
  assert.ok(calls.includes("pendingQueue:7"));
});

test("check resets the month before reading spend", async () => {
  const { calls, deps } = fakeDeps({ spent: 0, queue: [{ id: 1 }] });
  await check(50, 25, deps);
  assert.ok(calls.indexOf("resetMonthIfNew") < calls.indexOf("getMonthSpend"));
});
