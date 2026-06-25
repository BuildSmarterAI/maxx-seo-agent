// sensor.mjs — runSensor harness for all sensors.
//
// Sensor interface: { name, thresholds, fetch(env, thresholds) → { url, signalType, value }[] }
// fetch() applies threshold filtering internally and returns only qualifying items.
// The harness owns: doNotTouch filtering, queue-item mapping, enqueue, error isolation.
import { doNotTouch, enqueue } from "./supabase.mjs";

export async function runSensor(sensor, env) {
  let rawItems = [];
  let fetchError = null;

  try {
    rawItems = await sensor.fetch(env, sensor.thresholds);
  } catch (err) {
    fetchError = err;
    console.error(`[${sensor.name}] fetch failed:`, err?.message ?? err);
    return { sensor: sensor.name, count: 0, error: fetchError };
  }

  const skip = await doNotTouch();
  const filtered = rawItems.filter((item) => !skip.has(item.url));
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
    await enqueue(queueItems);
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
