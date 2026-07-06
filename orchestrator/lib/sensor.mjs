// sensor.mjs — runSensor harness for all sensors.
//
// Sensor interface: { name, thresholds, fetch(env, thresholds) → { url, signalType, value }[],
// onEnqueued?(rawItems) }. fetch() applies threshold filtering internally and returns only
// qualifying items. The harness owns: doNotTouch filtering, queue-item mapping, enqueue,
// error isolation, and — via the optional onEnqueued hook — sensor-specific "seen"/dedup
// state commits. onEnqueued runs ONLY after enqueue() succeeds (A13): committing dedup state
// before a successful enqueue let a transient enqueue failure permanently drop a URL from
// future discovery (it would never be "fresh" again, and never made it into work_queue
// either). It receives the full pre-do_not_touch-filter rawItems, not just the enqueued
// subset, so a protected URL is still marked seen (matching prior behavior — it's just never
// queued) instead of being rediscovered every run.
// deps are injectable so this harness is testable without a network (same pattern as
// orchestrator/lib/preflight.mjs's check()).
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

  // Separate from the enqueue try/catch above: onEnqueued's own failure is a distinct,
  // lower-severity problem (the queue write already succeeded) and must not be
  // misattributed as an enqueue failure — that would mislead triage and, via the CLI's
  // `if (error) process.exit(1)`, fail the whole run over an already-durable write. A
  // retry next run is safe (enqueue's upsert is idempotent), so log and move on.
  if (!enqueueError) {
    try {
      await sensor.onEnqueued?.(rawItems);
    } catch (err) {
      console.error(`[${sensor.name}] onEnqueued failed:`, err?.message ?? err);
    }
  }

  return { sensor: sensor.name, count: queueItems.length, error: enqueueError };
}
