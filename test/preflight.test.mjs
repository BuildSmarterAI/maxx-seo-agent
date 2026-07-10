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
// Queue rows carry risk_class like real pendingQueue rows (select("*") + a DB default of
// 'safe') — the A8 dispatch gate escalates anything else, so an untagged row here would
// silently vanish from the returned queue and break the pre-A8 assertions.
function fakeDeps({ paused = false, spent = 0, queue = [{ id: 1, risk_class: "safe" }],
                    protectedSet = new Set(), retireThrowsFor = new Set() } = {}) {
  const calls = [];
  const logs = [];
  const deps = {
    isPaused: async () => { calls.push("isPaused"); return paused; },
    resetMonthIfNew: async () => { calls.push("resetMonthIfNew"); },
    getMonthSpend: async () => { calls.push("getMonthSpend"); return spent; },
    pendingQueue: async (limit) => { calls.push(`pendingQueue:${limit}`); return queue; },
    doNotTouch: async () => { calls.push("doNotTouch"); return protectedSet; },
    setQueueStatusById: async (id, to) => {
      calls.push(`setQueueStatusById:${id}:${to}`);
      if (retireThrowsFor.has(id)) throw new Error(`unique(url,task,status) twin for row ${id}`);
    },
    logDecision: async (payload) => { calls.push("logDecision"); logs.push(payload); },
  };
  return { calls, logs, deps };
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
  const { deps } = fakeDeps({ spent: 49.99, queue: [{ id: 1, risk_class: "safe" }] });
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

test("check returns ok with the pending queue, the month spend, and threads queueLimit through", async () => {
  const q = [{ id: 1, risk_class: "safe" }, { id: 2, risk_class: "safe" }];
  const { calls, deps } = fakeDeps({ spent: 10, queue: q });
  const res = await check(50, 7, deps);
  // `spent` rides along so main() can compute the run's budget headroom (maxBudgetUsd)
  // without a second getMonthSpend read racing the one the gate already did.
  assert.deepEqual(res, { ok: true, queue: q, spent: 10 });
  assert.ok(calls.includes("pendingQueue:7"));
});

test("check resets the month before reading spend", async () => {
  const { calls, deps } = fakeDeps({ spent: 0, queue: [{ id: 1, risk_class: "safe" }] });
  await check(50, 25, deps);
  assert.ok(calls.indexOf("resetMonthIfNew") < calls.indexOf("getMonthSpend"));
});

// ---- A8 dispatch risk gate ---------------------------------------------------
// The safe/gated decision must not depend on the model obeying its goal prompt: any row
// whose risk_class !== "safe" is escalated deterministically here, before dispatch, with
// the same status + decision_log shape the goal prompt tells the agent to produce.

test("check escalates non-safe rows at dispatch and returns only safe rows", async () => {
  const q = [
    { id: 1, url: "https://x/a/", task: "metadata-generate", risk_class: "safe" },
    { id: 2, url: "https://x/b/", task: "blog-write", risk_class: "gated" },
  ];
  const { calls, logs, deps } = fakeDeps({ queue: q });
  const res = await check(50, 25, deps);
  assert.equal(res.ok, true);
  assert.deepEqual(res.queue.map((r) => r.id), [1], "gated row must not reach the agent");
  assert.ok(calls.includes("setQueueStatusById:2:escalated"), "gated row parked as escalated");
  assert.equal(logs.length, 1);
  assert.equal(logs[0].action, "escalate");
  assert.equal(logs[0].risk_class, "gated");
  assert.equal(logs[0].url, "https://x/b/");
});

test("check treats a missing risk_class as non-safe (fail closed)", async () => {
  const q = [{ id: 9, url: "https://x/c/", task: "faq-schema" }]; // no risk_class at all
  const { calls, deps } = fakeDeps({ queue: q });
  const res = await check(50, 25, deps);
  assert.equal(res.ok, false, "nothing dispatchable is a stop, not a permissive pass");
  assert.ok(calls.includes("setQueueStatusById:9:escalated"));
});

test("check stops when every row is gated", async () => {
  const q = [
    { id: 1, url: "https://x/a/", risk_class: "gated" },
    { id: 2, url: "https://x/b/", risk_class: "gated" },
  ];
  const { deps } = fakeDeps({ queue: q });
  const res = await check(50, 25, deps);
  assert.equal(res.ok, false);
  assert.match(res.reason, /queue empty/);
});

test("check keeps a failed escalation out of the dispatch queue and writes no phantom log", async () => {
  const q = [
    { id: 1, url: "https://x/a/", risk_class: "safe" },
    { id: 2, url: "https://x/b/", risk_class: "gated" }, // escalation write will throw (twin)
  ];
  const { logs, deps } = fakeDeps({ queue: q, retireThrowsFor: new Set([2]) });
  const res = await check(50, 25, deps);
  assert.equal(res.ok, true, "one bad row must not stop the run");
  assert.deepEqual(res.queue.map((r) => r.id), [1], "row stays excluded even though the write failed");
  assert.equal(logs.length, 0, "no decision_log entry for a status change that never landed");
});

test("check applies do_not_touch parking and the risk gate together", async () => {
  const q = [
    { id: 1, url: "https://x/keep/", risk_class: "safe" },
    { id: 2, url: "https://x/protected/", risk_class: "safe" },
    { id: 3, url: "https://x/brand/", risk_class: "gated" },
  ];
  // The real doNotTouch() returns canonical keys (canonicalizeSet: host+path, scheme
  // stripped), so the fake set must hold the canonical form, not the raw URL.
  const { calls, deps } = fakeDeps({ queue: q, protectedSet: new Set(["x/protected"]) });
  const res = await check(50, 25, deps);
  assert.equal(res.ok, true);
  assert.deepEqual(res.queue.map((r) => r.id), [1]);
  assert.ok(calls.includes("setQueueStatusById:2:skipped-dnt"), "protected row parked");
  assert.ok(calls.includes("setQueueStatusById:3:escalated"), "gated row escalated");
});
