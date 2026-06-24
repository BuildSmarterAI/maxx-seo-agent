#!/usr/bin/env node
// prioritize.mjs — re-scores pending work_queue items using learned_patterns, so the
// orchestrator works the change types that have actually moved metrics first.
// priority = base(by source) + round(avg_effect * WEIGHT), clamped 0..10.
import { pendingQueue, learnedPatterns, setPriority } from "../orchestrator/lib/supabase.mjs";

const WEIGHT = Number(process.env.PRIORITY_WEIGHT || 5);
const BASE = { gsc: 2, sitemap: 1, deploy: 2, citation: 3, manual: 4 };

async function main() {
  const patterns = await learnedPatterns();
  const queue = await pendingQueue(500);
  let changed = 0;

  for (const row of queue) {
    const base = BASE[row.source] ?? 1;
    const effect = patterns.get(row.task) ?? 0;
    const next = Math.max(0, Math.min(10, base + Math.round(effect * WEIGHT)));
    if (next !== row.priority) { await setPriority(row.id, next); changed++; }
  }
  console.log(`reprioritized ${changed}/${queue.length} pending items.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
