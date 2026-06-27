// test/learning.test.mjs — the learning-loop seam: pure scoring + injectable cores.
//   1. effectOf  — directional attribution blend (number | null)
//   2. priorityScore — base + round(effect*weight) clamped 0..10
//   3. attribute core — byType reducer, MIN_N gate, null-skip, with injected fakes
//   4. reprioritize core — priority recompute, change-only writes, with injected fakes
//
// learning.mjs imports no Supabase, so no env shim is needed (cf. push-escalations).
// Run: node --test
import { test } from "node:test";
import assert from "node:assert/strict";

import { effectOf, priorityScore, attribute, reprioritize } from "../orchestrator/lib/learning.mjs";

const W = { click: 0.7, position: 0.3 };

test("effectOf blends click + position lift with weights", () => {
  // clickLift (15-10)/max(10,1)=0.5 ; posLift (20-10)/max(20,1)=0.5 ; 0.5*0.7+0.5*0.3=0.5
  assert.equal(effectOf({ clicksBefore: 10, clicksAfter: 15, posBefore: 20, posAfter: 10 }, W), 0.5);
});

test("effectOf returns null when click history is insufficient (signals skip)", () => {
  assert.equal(effectOf({ clicksBefore: null, clicksAfter: 15, posBefore: 20, posAfter: 10 }, W), null);
  assert.equal(effectOf({ clicksBefore: 10, clicksAfter: null, posBefore: 20, posAfter: 10 }, W), null);
});

test("effectOf degrades position lift to 0 when either position snapshot is missing", () => {
  // posLift -> 0, so effect = clickLift*0.7 = 0.5*0.7 = 0.35
  assert.equal(effectOf({ clicksBefore: 10, clicksAfter: 15, posBefore: null, posAfter: 10 }, W), 0.35);
  assert.equal(effectOf({ clicksBefore: 10, clicksAfter: 15, posBefore: 20, posAfter: null }, W), 0.35);
});

test("effectOf denominator floors at 1 (no divide-by-zero on a zero baseline)", () => {
  // clickLift (5-0)/max(0,1)=5 ; posLift 0 ; effect = 5*0.7 = 3.5
  assert.equal(effectOf({ clicksBefore: 0, clicksAfter: 5, posBefore: null, posAfter: null }, W), 3.5);
});

test("priorityScore = base + round(effect*weight), clamped 0..10", () => {
  assert.equal(priorityScore(2, 0.5, 5), 5);   // 2 + round(2.5)=3 -> 5
  assert.equal(priorityScore(4, 2, 5), 10);    // 4 + round(10)=14 -> clamp 10
  assert.equal(priorityScore(1, -3, 5), 0);    // 1 + round(-15)=-14 -> clamp 0
});

test("attribute: averages by change_type, applies MIN_N gate and null-skip, persists toFixed(4)", async () => {
  const upserts = [];
  const decisions = [
    { url: "/a", change_type: "metadata", created_at: "2026-01-01" },
    { url: "/a2", change_type: "metadata", created_at: "2026-01-01" },
    { url: "/a3", change_type: "metadata", created_at: "2026-01-01" },
    { url: "/b", change_type: "schema", created_at: "2026-01-01" },   // n=1 < minN -> skipped
    { url: "/n", change_type: "metadata", created_at: "2026-01-01" }, // clicks null -> row skipped
  ];
  const summary = await attribute({
    fetchDecisions: async () => decisions,
    clicksAround: async (url) => (url === "/n" ? { before: null, after: null } : { before: 10, after: 15 }),
    positionAround: async () => ({ before: 20, after: 10 }),
    upsertPattern: async (change_type, avg_effect, n) => { upserts.push([change_type, avg_effect, n]); },
    log: () => {},
    weights: W, lagDays: 28, minN: 3,
  });
  assert.deepEqual(upserts, [["metadata", 0.5, 3]]); // 3 valid rows @0.5, schema dropped, /n dropped
  assert.equal(summary.written, 1);
});

test("attribute: writes nothing when every change_type is under MIN_N", async () => {
  const upserts = [];
  const summary = await attribute({
    fetchDecisions: async () => [{ url: "/a", change_type: "metadata", created_at: "2026-01-01" }],
    clicksAround: async () => ({ before: 10, after: 15 }),
    positionAround: async () => ({ before: 20, after: 10 }),
    upsertPattern: async (...args) => { upserts.push(args); },
    log: () => {},
    weights: W, lagDays: 28, minN: 3,
  });
  assert.deepEqual(upserts, []);
  assert.equal(summary.written, 0);
});

test("reprioritize: empty queue is a no-op", async () => {
  const summary = await reprioritize({
    fetchPatterns: async () => new Map(),
    fetchQueue: async () => [],
    setPriority: async () => { throw new Error("should not be called"); },
    log: () => {},
    weight: 5,
    base: { gsc: 2 },
  });
  assert.deepEqual(summary, { changed: 0, total: 0, matched: 0 });
});

test("reprioritize: a learned pattern keyed by the task name produces a real, priority-changing hit", async () => {
  const writes = [];
  // change_type == task vocabulary (kit-skill name) — the actual join key in production.
  const patterns = new Map([["metadata-generate", 0.5]]);
  const queue = [
    { id: 1, source: "gsc", task: "metadata-generate", priority: 0 },    // 2+round(2.5)=5 -> change 0->5, matched
    { id: 2, source: "mystery", task: "blog-write", priority: 1 },       // base??1 + 0 (no pattern) = 1 -> no change
    { id: 3, source: "manual", task: "metadata-generate", priority: 7 }, // 4+3=7 -> no change, matched
  ];
  const summary = await reprioritize({
    fetchPatterns: async () => patterns,
    fetchQueue: async () => queue,
    setPriority: async (id, priority) => { writes.push([id, priority]); },
    log: () => {},
    weight: 5,
    base: { gsc: 2, sitemap: 1, deploy: 2, citation: 3, manual: 4 },
  });
  assert.deepEqual(writes, [[1, 5]]);                              // non-zero learned effect moved a real row
  assert.deepEqual(summary, { changed: 1, total: 3, matched: 2 }); // two rows joined a learned pattern
});

test("reprioritize: surfaces a silent no-op — patterns present but no task matches yields matched:0", async () => {
  const writes = [];
  const patterns = new Map([["schema-generate", 0.9]]); // a real pattern, but for a task not in the queue
  const queue = [{ id: 1, source: "gsc", task: "metadata-generate", priority: 4 }]; // 2+0=2 -> base-only change 4->2
  const summary = await reprioritize({
    fetchPatterns: async () => patterns,
    fetchQueue: async () => queue,
    setPriority: async (id, priority) => { writes.push([id, priority]); },
    log: () => {},
    weight: 5,
    base: { gsc: 2 },
  });
  assert.deepEqual(writes, [[1, 2]]);
  assert.deepEqual(summary, { changed: 1, total: 1, matched: 0 }); // priority moved, but NO learned signal contributed
});
