// test/citation-events.test.mjs — the AIO capture/diff seam: pure functions only.
//   1. majorityVote  — collapse N per-run AIO samples into one consensus snapshot
//                      (kills intra-run rendering flicker; ADR-007 §capture)
//   2. diffAioSnapshots — prev vs curr consensus -> gained | lost | displaced | null
//                      (ADR-007 §citation_events)
//
// Both are Supabase-free, so no env shim is needed (cf. learning.test.mjs).
// Run: node --test
import { test } from "node:test";
import assert from "node:assert/strict";

import { majorityVote, diffAioSnapshots } from "../lib/citation-events.mjs";

// ---- majorityVote ----------------------------------------------------------
// A "sample" is one successful AIO capture: { present, cited, position, competitors }.
// The sensor only passes successful fetches; failed fetches are excluded upstream.

test("majorityVote: 2-of-3 cited -> cited, position = best (min) among cited runs", () => {
  const v = majorityVote([
    { present: true, cited: true, position: 5, competitors: [] },
    { present: true, cited: true, position: 3, competitors: [] },
    { present: true, cited: false, position: null, competitors: [] },
  ]);
  assert.deepEqual(v, { present: true, cited: true, position: 3, competitors: [] });
});

test("majorityVote: 1-of-3 cited -> not cited (flicker suppressed), position null", () => {
  const v = majorityVote([
    { present: true, cited: true, position: 2, competitors: [] },
    { present: true, cited: false, position: null, competitors: [] },
    { present: true, cited: false, position: null, competitors: [] },
  ]);
  assert.deepEqual(v, { present: true, cited: false, position: null, competitors: [] });
});

test("majorityVote: AIO present in only 1 of 3 runs -> consensus present=false", () => {
  const v = majorityVote([
    { present: true, cited: true, position: 1, competitors: [] },
    { present: false, cited: false, position: null, competitors: [] },
    { present: false, cited: false, position: null, competitors: [] },
  ]);
  assert.deepEqual(v, { present: false, cited: false, position: null, competitors: [] });
});

test("majorityVote: keeps competitors seen in a majority of present runs, drops flicker", () => {
  const v = majorityVote([
    { present: true, cited: false, position: null, competitors: ["rival.com", "flake.com"] },
    { present: true, cited: false, position: null, competitors: ["rival.com"] },
    { present: true, cited: false, position: null, competitors: ["rival.com"] },
  ]);
  // rival.com in 3/3 kept; flake.com in 1/3 dropped
  assert.deepEqual(v, { present: true, cited: false, position: null, competitors: ["rival.com"] });
});

test("majorityVote: tie on cited among present runs resolves to not-cited (conservative)", () => {
  const v = majorityVote([
    { present: true, cited: true, position: 4, competitors: [] },
    { present: true, cited: false, position: null, competitors: [] },
  ]);
  assert.deepEqual(v, { present: true, cited: false, position: null, competitors: [] });
});

test("majorityVote: empty input -> absent/uncited consensus", () => {
  assert.deepEqual(majorityVote([]), { present: false, cited: false, position: null, competitors: [] });
});

// ---- diffAioSnapshots ------------------------------------------------------

test("diffAioSnapshots: no prior baseline -> null (nothing to diff)", () => {
  assert.equal(diffAioSnapshots(null, { present: true, cited: true, position: 1, competitors: [] }), null);
});

test("diffAioSnapshots: uncited -> cited = gained", () => {
  const e = diffAioSnapshots(
    { present: true, cited: false, position: null, competitors: [] },
    { present: true, cited: true, position: 2, competitors: [] },
  );
  assert.deepEqual(e, { event: "gained", competitor_won: [] });
});

test("diffAioSnapshots: cited -> uncited with a competitor now cited = displaced", () => {
  const e = diffAioSnapshots(
    { present: true, cited: true, position: 1, competitors: [] },
    { present: true, cited: false, position: null, competitors: ["rival.com"] },
  );
  assert.deepEqual(e, { event: "displaced", competitor_won: ["rival.com"] });
});

test("diffAioSnapshots: cited -> uncited, AIO gone entirely = lost", () => {
  const e = diffAioSnapshots(
    { present: true, cited: true, position: 1, competitors: [] },
    { present: false, cited: false, position: null, competitors: [] },
  );
  assert.deepEqual(e, { event: "lost", competitor_won: [] });
});

test("diffAioSnapshots: cited -> uncited, AIO present but no competitor = lost", () => {
  const e = diffAioSnapshots(
    { present: true, cited: true, position: 1, competitors: [] },
    { present: true, cited: false, position: null, competitors: [] },
  );
  assert.deepEqual(e, { event: "lost", competitor_won: [] });
});

test("diffAioSnapshots: cited -> cited = null (position drift is not an event)", () => {
  assert.equal(diffAioSnapshots(
    { present: true, cited: true, position: 1, competitors: [] },
    { present: true, cited: true, position: 5, competitors: ["rival.com"] },
  ), null);
});

test("diffAioSnapshots: uncited -> uncited = null (never ours to lose)", () => {
  assert.equal(diffAioSnapshots(
    { present: true, cited: false, position: null, competitors: [] },
    { present: true, cited: false, position: null, competitors: ["rival.com"] },
  ), null);
});
