// sensor.mjs — runSensor harness for all sensors.
//
// Sensor interface: { name, thresholds, fetch(env, thresholds) → { url, signalType, value }[] }
// fetch() applies threshold filtering internally and returns only qualifying items.
// The harness owns: doNotTouch filtering, queue-item mapping, enqueue, error isolation.
import { doNotTouch, enqueue } from "./supabase.mjs";

// Map one raw sensor item to a work_queue row. Returns null for an unknown signalType
// (the harness logs + drops it). Carries the GSC query through as target_query when the
// item has one (R1) so metadata-generate can optimise for the exact striking-distance query.
export function toQueueItem(item, sensor) {
  const mapping = sensor.thresholds[item.signalType];
  if (!mapping) return null;
  const row = {
    url: item.url, task: mapping.task, risk_class: "safe",
    priority: mapping.priority, source: sensor.name, status: "pending",
  };
  if (item.query) row.target_query = item.query;
  return row;
}

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
    const row = toQueueItem(item, sensor);
    if (!row) {
      console.warn(`[${sensor.name}] unknown signalType "${item.signalType}" — skipping`);
      return [];
    }
    return [row];
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
