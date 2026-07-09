// test/sensor-cwv.test.mjs — CrUX field-CWV sensor. `breaches`/`readUrls`/`cwvSensor` are
// exported and the auto-run is guarded, so the module imports without a network or DB. The
// sensor imports supabase.mjs (hasRecentTask) which needs SUPABASE_* at import → dummy env.
// fetch() takes injectable deps (fetch/recentTask/urls) so no CrUX call is ever made.
//
// Run: node --test
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.SUPABASE_URL ||= "https://x.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "dummy_service_role_key_000000";

const { cwvSensor, breaches } = await import("../scripts/sensor-cwv.mjs");

const metric = (p75) => ({ percentiles: { p75 } });                       // CrUX p75 is a STRING
const cruxOk = (metrics) => ({ ok: true, status: 200, json: async () => ({ record: { metrics } }) });

test("breaches coerces string p75 (CLS) and flags only over-threshold metrics", () => {
  const record = { metrics: {
    cumulative_layout_shift:  metric("0.15"),   // 0.15 > 0.1  → flagged
    largest_contentful_paint: metric("2000"),   // 2000 < 2500 → ok
  } };
  assert.deepEqual(breaches(record), [{ metric: "CLS", p75: 0.15, limit: 0.1 }]);
});

test("breaches returns [] when within limits or metric absent (no false regression)", () => {
  assert.deepEqual(breaches({ metrics: { interaction_to_next_paint: metric("120") } }), []);
  assert.deepEqual(breaches({}), []);
  assert.deepEqual(breaches(undefined), []);
});

test("cwvSensor.fetch enqueues a cwv-regression item when a field p75 breaches", async () => {
  const items = await cwvSensor.fetch({ CRUX_API_KEY: "k" }, cwvSensor.thresholds, {
    urls: () => ["https://x/a"],
    recentTask: async () => false,
    fetch: async () => cruxOk({
      interaction_to_next_paint: metric("350"),   // 350 > 200 → 1 breach
      largest_contentful_paint:  metric("1800"),
      cumulative_layout_shift:   metric("0.02"),
    }),
  });
  assert.deepEqual(items, [{ url: "https://x/a", signalType: "cwv-regression", value: 1 }]);
});

test("cwvSensor.fetch treats CrUX 404 (no field data) as no signal, not a regression", async () => {
  const items = await cwvSensor.fetch({ CRUX_API_KEY: "k" }, cwvSensor.thresholds, {
    urls: () => ["https://x/thin"],
    recentTask: async () => false,
    fetch: async () => ({ ok: false, status: 404, json: async () => ({}) }),
  });
  assert.deepEqual(items, []);
});

test("cwvSensor.fetch skips (and does not even query CrUX for) a URL within the cooldown window", async () => {
  let fetched = false;
  const items = await cwvSensor.fetch({ CRUX_API_KEY: "k" }, cwvSensor.thresholds, {
    urls: () => ["https://x/a"],
    recentTask: async () => true,   // recent cwv-audit exists → field-lag suppression
    fetch: async () => { fetched = true; return cruxOk({ interaction_to_next_paint: metric("999") }); },
  });
  assert.deepEqual(items, []);
  assert.equal(fetched, false, "cooldown short-circuits before the CrUX call");
});

test("cwvSensor.fetch throws when no API key is configured", async () => {
  await assert.rejects(
    () => cwvSensor.fetch({}, cwvSensor.thresholds, { urls: () => [], recentTask: async () => false, fetch: async () => ({}) }),
    /CRUX_API_KEY/);
});
