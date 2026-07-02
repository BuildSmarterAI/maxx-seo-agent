// test/build-eval-set.test.mjs — pure pieces of the RO-6 eval-set builder: the synthetic
// seed shape, the idempotency key, and the lift quartile split. No DB (the helpers under
// test don't touch Supabase, but importing the module loads the client, so set dummy env).
//
// Run: node --test
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.SUPABASE_URL ||= "https://x.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "dummy_service_role_key_000000";

const { syntheticSeed, dedupeKey, quartileSplit } = await import("../scripts/build-eval-set.mjs");

test("syntheticSeed is balanced and well-formed", () => {
  const seed = syntheticSeed();
  const good = seed.filter((r) => r.label === "good");
  const bad = seed.filter((r) => r.label === "bad");
  assert.ok(good.length >= 4 && bad.length >= 4, "has good and bad examples");
  assert.ok(bad.every((r) => r.failure_mode), "every bad row names a failure_mode");
  assert.ok(good.every((r) => r.failure_mode === null), "good rows have no failure_mode");
  assert.ok(seed.every((r) => r.source === "synthetic" && r.realized_lift === null && r.artifact));
  // the failure modes the LLM judge (not the regex) must catch are represented
  const modes = new Set(bad.map((r) => r.failure_mode));
  for (const m of ["fabricated_stat", "doorway", "cannibalizing", "placeholder", "brand_pricing"])
    assert.ok(modes.has(m), `failure mode ${m} present`);
});

test("dedupeKey is stable and discriminating", () => {
  const a = { change_type: "blog-write", label: "good", artifact: "X" };
  assert.equal(dedupeKey(a), dedupeKey({ ...a }), "same content → same key");
  assert.notEqual(dedupeKey(a), dedupeKey({ ...a, label: "bad" }), "label changes the key");
  assert.notEqual(dedupeKey(a), dedupeKey({ ...a, artifact: "Y" }), "artifact changes the key");
});

test("quartileSplit takes top/bottom quartiles and drops the middle", () => {
  const scored = [1, 2, 3, 4, 5, 6, 7, 8].map((lift) => ({ url: `u${lift}`, lift }));
  const { good, bad } = quartileSplit(scored);
  assert.deepEqual(bad.map((s) => s.lift), [1, 2], "bottom quartile = lowest lift");
  assert.deepEqual(good.map((s) => s.lift), [7, 8], "top quartile = highest lift");
});

test("quartileSplit needs at least 4 items", () => {
  assert.deepEqual(quartileSplit([{ lift: 1 }, { lift: 2 }, { lift: 3 }]), { good: [], bad: [] });
});
