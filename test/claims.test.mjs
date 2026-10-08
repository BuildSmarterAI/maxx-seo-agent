// test/claims.test.mjs — covers stale in_progress recovery (orchestrator/lib/claims.mjs):
//   1. planReclaim: a stale row with no live twin goes back to pending
//   2. planReclaim: a stale row whose (url,task) already has a pending twin becomes obsolete
//   3. planReclaim: a fresh claim is left alone; a null claimed_at (legacy row) counts as stale
//   4. planReclaim: two stale rows for one (url,task) → one pending, the rest obsolete
//   5. reclaimStaleRows applies the plan, logs each move, and keeps going past a failed write
//   6. releaseClaims returns still-claimed rows to pending, falling back to obsolete on a collision
//
// planReclaim is pure (rows in, moves out), so no DB is mocked for the decision logic;
// the executors take injected deps like preflight.check(). The real-DB claim race lives in
// test/claims.db.test.mjs.
//
// Run: node --test
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.SUPABASE_URL ||= "https://x.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "dummy_service_role_key_000000";

const { planReclaim, reclaimStaleRows, releaseClaims } = await import("../orchestrator/lib/claims.mjs");

const NOW = Date.parse("2026-10-08T12:00:00Z");
const HOUR = 36e5;
const MAX_AGE = 2 * HOUR;
const ago = (ms) => new Date(NOW - ms).toISOString();
const row = (id, claimedAgo, url = `https://s/p${id}`, task = "faq-schema") =>
  ({ id, url, task, claimed_at: claimedAgo == null ? null : ago(claimedAgo) });

test("stale row with no live twin goes back to pending", () => {
  const moves = planReclaim([row(1, 3 * HOUR)], [], { now: NOW, maxAgeMs: MAX_AGE });
  assert.deepEqual(moves.map(({ id, to }) => ({ id, to })), [{ id: 1, to: "pending" }]);
});

test("stale row with a pending twin becomes obsolete", () => {
  const r = row(1, 3 * HOUR);
  const moves = planReclaim([r], [{ url: r.url, task: r.task }], { now: NOW, maxAgeMs: MAX_AGE });
  assert.deepEqual(moves.map(({ id, to }) => ({ id, to })), [{ id: 1, to: "obsolete" }]);
});

test("fresh claim is untouched; null claimed_at is treated as stale", () => {
  const moves = planReclaim([row(1, 30 * 6e4), row(2, null)], [], { now: NOW, maxAgeMs: MAX_AGE });
  assert.deepEqual(moves.map(({ id, to }) => ({ id, to })), [{ id: 2, to: "pending" }]);
});

test("two stale rows for one (url,task): exactly one is revived", () => {
  const a = row(1, 5 * HOUR, "https://s/x");
  const b = row(2, 4 * HOUR, "https://s/x");
  const moves = planReclaim([a, b], [], { now: NOW, maxAgeMs: MAX_AGE });
  assert.equal(moves.filter((m) => m.to === "pending").length, 1);
  assert.equal(moves.filter((m) => m.to === "obsolete").length, 1);
});

test("reclaimStaleRows applies moves, logs each, and survives a failed write", async () => {
  const writes = [];
  const logs = [];
  const deps = {
    inProgressRows: async () => [row(1, 3 * HOUR), row(2, 3 * HOUR), row(3, 3 * HOUR)],
    livePendingRows: async () => [],
    setQueueStatusById: async (id, to) => {
      if (id === 2) throw new Error("boom");
      writes.push([id, to]);
    },
    logDecision: async (e) => { logs.push(e); },
  };
  const res = await reclaimStaleRows({ now: NOW, maxAgeMs: MAX_AGE }, deps);
  assert.deepEqual(writes.map(([id]) => id), [1, 3]);
  assert.equal(logs.length, 2);
  assert.ok(logs.every((l) => l.agent === "preflight" && l.action === "reclaim"));
  assert.deepEqual(res, { reclaimed: 2, failed: 1 });
});

test("releaseClaims returns claimed rows to pending, obsolete on a collision", async () => {
  const writes = [];
  const deps = {
    setQueueStatusById: async (id, to) => {
      if (id === 2 && to === "pending") throw new Error("duplicate key");
      writes.push([id, to]);
    },
  };
  await releaseClaims([1, 2], deps);
  assert.deepEqual(writes, [[1, "pending"], [2, "obsolete"]]);
});
