// sensor.mjs — runSensor harness for all sensors.
//
// Sensor interface: { name, thresholds, fetch(env, thresholds) → { url, signalType, value }[] }
// fetch() applies threshold filtering internally and returns only qualifying items.
// The harness owns: doNotTouch filtering, queue-item mapping, enqueue, error isolation.
import { doNotTouch, enqueue } from "./supabase.mjs";
import { isProtected } from "./url.mjs";

// `deps` is injectable for tests (same optional-injection pattern as preflight.mjs).
export async function runSensor(sensor, env, deps = {}) {
  const { doNotTouch: dnt = doNotTouch, enqueue: enq = enqueue } = deps;

  // Resolve the protected set BEFORE fetch (verify round 2): sensor.fetch can commit state
  // (the sitemap sensor marks fresh URLs seen), so a do_not_touch read error — which now
  // throws fail-closed — must abort while aborting is still free. After fetch, it would
  // strand committed side effects and permanently drop that night's signals.
  const skip = await dnt();

  let rawItems = [];
  let fetchError = null;

  try {
    rawItems = await sensor.fetch(env, sensor.thresholds);
  } catch (err) {
    fetchError = err;
    console.error(`[${sensor.name}] fetch failed:`, err?.message ?? err);
    return { sensor: sensor.name, count: 0, error: fetchError };
  }

  const filtered = rawItems.filter((item) => !isProtected(skip, item.url));
  const skippedCount = rawItems.length - filtered.length;

  const queueItems = filtered.flatMap((item) => {
    const mapping = sensor.thresholds[item.signalType];
    if (!mapping) {
      console.warn(`[${sensor.name}] unknown signalType "${item.signalType}" — skipping`);
      return [];
    }
    return [{ url: item.url, task: mapping.task, risk_class: "safe",
              priority: mapping.priority, source: sensor.name, status: "pending" }];
  });

  let enqueueError = null;
  try {
    await enq(queueItems, { protectedSet: skip });
    console.log(
      `[${sensor.name}] enqueued ${queueItems.length} items` +
      (skippedCount ? ` (${skippedCount} skipped by do_not_touch)` : "")
    );
  } catch (err) {
    enqueueError = err;
    console.error(`[${sensor.name}] enqueue failed:`, err?.message ?? err);
  }

  return { sensor: sensor.name, count: queueItems.length, error: enqueueError };
}
