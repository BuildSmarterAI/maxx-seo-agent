// test/sensor.test.mjs — the runSensor harness (A13): commit-ordering safety.
// A sensor's onEnqueued hook (if it defines one) must run ONLY after enqueue() succeeds,
// never before and never on a failed enqueue — otherwise sensor-specific "seen" state can
// be committed for items that were never durably queued, permanently dropping them from
// future discovery (the sitemap sensor's markSitemapSeen bug this finding targets).
//
// Run: node --test
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.SUPABASE_URL ||= "https://x.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "dummy_service_role_key_000000";

const { runSensor } = await import("../orchestrator/lib/sensor.mjs");

function fakeSensor(over = {}) {
  return {
    name: "fake",
    thresholds: { "new-url": { task: "seo-audit", priority: 1 } },
    fetch: async () => [{ url: "/a", signalType: "new-url", value: 1 }],
    ...over,
  };
}

test("runSensor calls onEnqueued only after a successful enqueue", async () => {
  const order = [];
  const deps = {
    doNotTouch: async () => new Set(),
    enqueue: async () => { order.push("enqueue"); },
  };
  const sensor = fakeSensor({ onEnqueued: async () => order.push("onEnqueued") });
  const result = await runSensor(sensor, {}, deps);
  assert.deepEqual(order, ["enqueue", "onEnqueued"]);
  assert.equal(result.error, null);
});

test("runSensor does NOT call onEnqueued when enqueue throws (no permanent-drop risk)", async () => {
  let onEnqueuedCalled = false;
  const deps = {
    doNotTouch: async () => new Set(),
    enqueue: async () => { throw new Error("network blip"); },
  };
  const sensor = fakeSensor({ onEnqueued: async () => { onEnqueuedCalled = true; } });
  const result = await runSensor(sensor, {}, deps);
  assert.equal(onEnqueuedCalled, false);
  assert.ok(result.error);
  assert.match(result.error.message, /network blip/);
});

test("runSensor works fine for a sensor with no onEnqueued hook (optional, backward compatible)", async () => {
  const deps = {
    doNotTouch: async () => new Set(),
    enqueue: async () => {},
  };
  const result = await runSensor(fakeSensor(), {}, deps);
  assert.equal(result.error, null);
  assert.equal(result.count, 1);
});

test("runSensor passes the full pre-filter rawItems to onEnqueued, not just the enqueued subset", async () => {
  // A do_not_touch-protected item is excluded from the enqueue payload but must still be
  // visible to onEnqueued (e.g. so the sitemap sensor marks it "seen" even though it's
  // never enqueued -- matching the pre-fix behavior of marking ALL fresh urls seen).
  let seenByHook = null;
  const deps = {
    doNotTouch: async () => new Set(["/protected"]),
    enqueue: async () => {},
  };
  const sensor = fakeSensor({
    fetch: async () => [
      { url: "/a", signalType: "new-url", value: 1 },
      { url: "/protected", signalType: "new-url", value: 1 },
    ],
    onEnqueued: async (rawItems) => { seenByHook = rawItems.map((i) => i.url); },
  });
  const result = await runSensor(sensor, {}, deps);
  assert.deepEqual(seenByHook.sort(), ["/a", "/protected"]);
  assert.equal(result.count, 1); // only /a actually enqueued
});

test("runSensor does NOT misattribute an onEnqueued failure as an enqueue failure once enqueue already succeeded", async () => {
  // The queue write is already durable at this point -- a failure in the sensor-specific
  // onEnqueued hook (e.g. markSitemapSeen) is a distinct, lower-severity problem and must
  // not be reported/logged as "enqueue failed", which would mislead triage and (via the
  // CLI's `if (error) process.exit(1)`) fail the whole run over an already-succeeded write.
  let enqueueSucceeded = false;
  const deps = {
    doNotTouch: async () => new Set(),
    enqueue: async () => { enqueueSucceeded = true; },
  };
  const sensor = fakeSensor({ onEnqueued: async () => { throw new Error("mark-seen blip"); } });
  const result = await runSensor(sensor, {}, deps);
  assert.equal(enqueueSucceeded, true);
  assert.equal(result.error, null, "enqueue truly succeeded; result.error must stay null");
});

test("runSensor still returns the fetch error and skips enqueue/onEnqueued entirely when fetch throws", async () => {
  let enqueueCalled = false, onEnqueuedCalled = false;
  const deps = {
    doNotTouch: async () => new Set(),
    enqueue: async () => { enqueueCalled = true; },
  };
  const sensor = fakeSensor({
    fetch: async () => { throw new Error("fetch boom"); },
    onEnqueued: async () => { onEnqueuedCalled = true; },
  });
  const result = await runSensor(sensor, {}, deps);
  assert.equal(enqueueCalled, false);
  assert.equal(onEnqueuedCalled, false);
  assert.match(result.error.message, /fetch boom/);
});
