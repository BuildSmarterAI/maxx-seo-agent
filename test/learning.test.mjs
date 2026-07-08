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

// ADR-006 #1 — impression is the third weighted signal. Dyadic weights keep the
// assertions on exact binary fractions (no float fuzz).
const W3 = { click: 0.5, impression: 0.25, position: 0.25 };

test("effectOf blends click + impression + position lift with weights", () => {
  // clickLift 0.5 ; imprLift (200-100)/max(100,1)=1.0 ; posLift 0.5
  // 0.5*0.5 + 1.0*0.25 + 0.5*0.25 = 0.25 + 0.25 + 0.125 = 0.625
  assert.equal(
    effectOf({ clicksBefore: 10, clicksAfter: 15, imprBefore: 100, imprAfter: 200, posBefore: 20, posAfter: 10 }, W3),
    0.625,
  );
});

test("effectOf degrades impression lift to 0 when either impression snapshot is missing", () => {
  // imprLift -> 0, so effect = 0.5*0.5 + 0 + 0.5*0.25 = 0.375
  assert.equal(effectOf({ clicksBefore: 10, clicksAfter: 15, imprBefore: null, imprAfter: 200, posBefore: 20, posAfter: 10 }, W3), 0.375);
  assert.equal(effectOf({ clicksBefore: 10, clicksAfter: 15, imprBefore: 100, imprAfter: null, posBefore: 20, posAfter: 10 }, W3), 0.375);
});

test("effectOf ignores impressions when no impression weight is supplied (back-compat)", () => {
  // impr snapshots present, but W has no impression key -> contributes 0; legacy 2-term result
  assert.equal(
    effectOf({ clicksBefore: 10, clicksAfter: 15, imprBefore: 100, imprAfter: 200, posBefore: 20, posAfter: 10 }, W),
    0.5,
  );
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

test("attribute: threads impressionsAround and blends it into the effect", async () => {
  const upserts = [];
  const decisions = [
    { url: "/a", change_type: "metadata", created_at: "2026-01-01" },
    { url: "/a2", change_type: "metadata", created_at: "2026-01-01" },
    { url: "/a3", change_type: "metadata", created_at: "2026-01-01" },
  ];
  const summary = await attribute({
    fetchDecisions: async () => decisions,
    clicksAround: async () => ({ before: 10, after: 15 }),       // lift 0.5
    positionAround: async () => ({ before: 20, after: 10 }),     // lift 0.5
    impressionsAround: async () => ({ before: 100, after: 200 }), // lift 1.0
    upsertPattern: async (change_type, avg_effect, n) => { upserts.push([change_type, avg_effect, n]); },
    log: () => {},
    weights: W3, lagDays: 28, minN: 3,
  });
  // each row: 0.5*0.5 + 1.0*0.25 + 0.5*0.25 = 0.625
  assert.deepEqual(upserts, [["metadata", 0.625, 3]]);
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

// ---- GEO blend (learned_patterns_geo → prioritize) ----
// GSC learned_patterns is the anchor; GEO citation-delta blends in as a bounded,
// sample-size-shrunk bonus rescaled onto the GSC scale by S_gsc/S_geo. GEO is OFF
// unless geoWeight is passed, so existing callers score exactly as before.

test("reprioritize: GEO data is ignored unless geoWeight is set (defaults off)", async () => {
  const writes = [];
  await reprioritize({
    fetchPatterns: async () => new Map([["m", 0.4]]),
    fetchGeoPatterns: async () => new Map([["m", { avg_effect: 5.0, n: 100 }]]), // huge, but no geoWeight
    fetchQueue: async () => [{ id: 1, source: "gsc", task: "m", priority: 0 }],
    setPriority: async (id, p) => writes.push([id, p]),
    log: () => {}, weight: 5, base: { gsc: 2 },
  });
  assert.deepEqual(writes, [[1, 4]]); // GSC-only: 2 + round(0.4*5=2.0) = 4, GEO ignored
});

test("reprioritize: a calibrated GEO blend adds a bounded bonus over the GSC-only score", async () => {
  // S_gsc = |0.4| = 0.4 ; S_geo = |0.4| = 0.4 -> ratio 1 ; shrink(5, K=5) = 0.5
  const cfg = (geoWeight) => {
    const writes = [];
    return { writes, run: reprioritize({
      fetchPatterns: async () => new Map([["m", 0.4]]),
      fetchGeoPatterns: async () => new Map([["m", { avg_effect: 0.4, n: 5 }]]),
      fetchQueue: async () => [{ id: 1, source: "gsc", task: "m", priority: 0 }],
      setPriority: async (id, p) => writes.push([id, p]),
      log: () => {}, weight: 5, base: { gsc: 2 }, geoWeight, shrinkK: 5,
    }) };
  };
  const off = cfg(0); await off.run;
  assert.deepEqual(off.writes, [[1, 4]]);   // GSC-only: 2 + round(2.0) = 4
  const on = cfg(0.6); await on.run;
  // geoTerm = 0.6 * 0.5 * 1 * 0.4 = 0.12 ; effect 0.52 ; 2 + round(2.6) = 5
  assert.deepEqual(on.writes, [[1, 5]]);
});

test("reprioritize: the GEO blend is scale-invariant — 10x the citation units yields identical priorities", async () => {
  const patterns = new Map([["m", 0.5], ["s", 0.3]]);
  const run = async (geo) => {
    const writes = [];
    await reprioritize({
      fetchPatterns: async () => patterns,
      fetchGeoPatterns: async () => geo,
      fetchQueue: async () => [
        { id: 1, source: "gsc", task: "m", priority: 0 },
        { id: 2, source: "gsc", task: "s", priority: 0 },
      ],
      setPriority: async (id, p) => writes.push([id, p]),
      log: () => {}, weight: 5, base: { gsc: 2 }, geoWeight: 0.5, shrinkK: 5,
    });
    return writes;
  };
  const small = await run(new Map([["m", { avg_effect: 0.4, n: 10 }], ["s", { avg_effect: 0.2, n: 10 }]]));
  const big = await run(new Map([["m", { avg_effect: 4.0, n: 10 }], ["s", { avg_effect: 2.0, n: 10 }]]));
  assert.equal(small.length, 2);      // not a vacuous pass — both rows wrote
  assert.deepEqual(small, big);       // S_gsc/S_geo cancels the 10x → same result
});

test("reprioritize: a thin GEO sample (low n) contributes less than a well-sampled one", async () => {
  // S_gsc=0.4, S_geo=0.8 -> ratio 0.5 ; geoWeight 0.5
  const run = async (n) => {
    let captured;
    await reprioritize({
      fetchPatterns: async () => new Map([["m", 0.4]]),
      fetchGeoPatterns: async () => new Map([["m", { avg_effect: 0.8, n }]]),
      fetchQueue: async () => [{ id: 1, source: "gsc", task: "m", priority: 0 }],
      setPriority: async (id, p) => { captured = p; },
      log: () => {}, weight: 5, base: { gsc: 2 }, geoWeight: 0.5, shrinkK: 5,
    });
    return captured;
  };
  const thin = await run(1);   // shrink 1/6 -> geoTerm 0.033 -> effect 0.433 -> 2+round(2.17)=4
  const thick = await run(95); // shrink 0.95 -> geoTerm 0.19  -> effect 0.59  -> 2+round(2.95)=5
  assert.equal(thin, 4);
  assert.equal(thick, 5);
});

test("reprioritize: zero GEO spread contributes nothing (guards divide-by-zero)", async () => {
  const writes = [];
  await reprioritize({
    fetchPatterns: async () => new Map([["m", 0.4]]),
    fetchGeoPatterns: async () => new Map([["m", { avg_effect: 0, n: 50 }]]), // S_geo = 0 -> ratio forced to 0
    fetchQueue: async () => [{ id: 1, source: "gsc", task: "m", priority: 0 }],
    setPriority: async (id, p) => writes.push([id, p]),
    log: () => {}, weight: 5, base: { gsc: 2 }, geoWeight: 0.9, shrinkK: 5,
  });
  assert.deepEqual(writes, [[1, 4]]); // == GSC-only; no NaN, no divide-by-zero
});

// ---- CONV blend (learned_patterns_conv → prioritize, PR 1C) ----
// A third bounded term mirroring the GEO blend: organic-conversion delta per change_type,
// sample-size-shrunk and rescaled onto the GSC scale by S_gsc/S_conv. OFF unless convWeight
// is passed, so existing callers score exactly as before; effectOf is untouched.

test("reprioritize: CONV data is ignored unless convWeight is set (defaults off)", async () => {
  const writes = [];
  await reprioritize({
    fetchPatterns: async () => new Map([["m", 0.4]]),
    fetchConvPatterns: async () => new Map([["m", { avg_effect: 5.0, n: 100 }]]), // huge, but no convWeight
    fetchQueue: async () => [{ id: 1, source: "gsc", task: "m", priority: 0 }],
    setPriority: async (id, p) => writes.push([id, p]),
    log: () => {}, weight: 5, base: { gsc: 2 },
  });
  assert.deepEqual(writes, [[1, 4]]); // GSC-only: 2 + round(0.4*5=2.0) = 4, CONV ignored
});

test("reprioritize: a calibrated CONV blend adds a bounded bonus over the GSC-only score", async () => {
  // S_gsc = |0.4| = 0.4 ; S_conv = |0.4| = 0.4 -> ratio 1 ; shrink(5, K=5) = 0.5
  const cfg = (convWeight) => {
    const writes = [];
    return { writes, run: reprioritize({
      fetchPatterns: async () => new Map([["m", 0.4]]),
      fetchConvPatterns: async () => new Map([["m", { avg_effect: 0.4, n: 5 }]]),
      fetchQueue: async () => [{ id: 1, source: "gsc", task: "m", priority: 0 }],
      setPriority: async (id, p) => writes.push([id, p]),
      log: () => {}, weight: 5, base: { gsc: 2 }, convWeight, convShrinkK: 5,
    }) };
  };
  const off = cfg(0); await off.run;
  assert.deepEqual(off.writes, [[1, 4]]);   // GSC-only: 2 + round(2.0) = 4
  const on = cfg(0.6); await on.run;
  // convTerm = 0.6 * 0.5 * 1 * 0.4 = 0.12 ; effect 0.52 ; 2 + round(2.6) = 5
  assert.deepEqual(on.writes, [[1, 5]]);
});

test("reprioritize: GEO and CONV blends are independent and additive", async () => {
  // GSC 0.4 ; GEO term 0.6*0.5*1*0.4=0.12 ; CONV term 0.6*0.5*1*0.4=0.12
  // effect = 0.4 + 0.12 + 0.12 = 0.64 ; 2 + round(3.2) = 5
  const writes = [];
  await reprioritize({
    fetchPatterns: async () => new Map([["m", 0.4]]),
    fetchGeoPatterns: async () => new Map([["m", { avg_effect: 0.4, n: 5 }]]),
    fetchConvPatterns: async () => new Map([["m", { avg_effect: 0.4, n: 5 }]]),
    fetchQueue: async () => [{ id: 1, source: "gsc", task: "m", priority: 0 }],
    setPriority: async (id, p) => writes.push([id, p]),
    log: () => {}, weight: 5, base: { gsc: 2 }, geoWeight: 0.6, shrinkK: 5, convWeight: 0.6, convShrinkK: 5,
  });
  assert.deepEqual(writes, [[1, 5]]);
});

test("reprioritize: a thin CONV sample contributes less than a well-sampled one", async () => {
  // S_gsc=0.4, S_conv=0.8 -> ratio 0.5 ; convWeight 0.5
  const run = async (n) => {
    let captured;
    await reprioritize({
      fetchPatterns: async () => new Map([["m", 0.4]]),
      fetchConvPatterns: async () => new Map([["m", { avg_effect: 0.8, n }]]),
      fetchQueue: async () => [{ id: 1, source: "gsc", task: "m", priority: 0 }],
      setPriority: async (id, p) => { captured = p; },
      log: () => {}, weight: 5, base: { gsc: 2 }, convWeight: 0.5, convShrinkK: 5,
    });
    return captured;
  };
  const thin = await run(1);   // shrink 1/6 -> convTerm 0.033 -> effect 0.433 -> 2+round(2.17)=4
  const thick = await run(95); // shrink 0.95 -> convTerm 0.19  -> effect 0.59  -> 2+round(2.95)=5
  assert.equal(thin, 4);
  assert.equal(thick, 5);
});

test("reprioritize: zero CONV spread contributes nothing (guards divide-by-zero)", async () => {
  const writes = [];
  await reprioritize({
    fetchPatterns: async () => new Map([["m", 0.4]]),
    fetchConvPatterns: async () => new Map([["m", { avg_effect: 0, n: 50 }]]), // S_conv = 0 -> ratio forced to 0
    fetchQueue: async () => [{ id: 1, source: "gsc", task: "m", priority: 0 }],
    setPriority: async (id, p) => writes.push([id, p]),
    log: () => {}, weight: 5, base: { gsc: 2 }, convWeight: 0.9, convShrinkK: 5,
  });
  assert.deepEqual(writes, [[1, 4]]); // == GSC-only; no NaN, no divide-by-zero
});
