#!/usr/bin/env node
// prioritize.mjs — I/O shell over the learning-loop reprioritize core. Reads
// learned_patterns + pending work_queue from Supabase, delegates the priority recompute
// to orchestrator/lib/learning.mjs, and writes back the changed priorities, so the
// orchestrator works the change types that have actually moved metrics first.
// priority = base(by source) + round(avg_effect * WEIGHT), clamped 0..10.
import { pendingQueue, learnedPatterns, setPriority } from "../orchestrator/lib/supabase.mjs";
import { reprioritize } from "../orchestrator/lib/learning.mjs";

const WEIGHT = Number(process.env.PRIORITY_WEIGHT || 5);
const BASE = { gsc: 2, sitemap: 1, deploy: 2, citation: 3, manual: 4 };

async function main() {
  await reprioritize({
    fetchPatterns: () => learnedPatterns(),
    fetchQueue: () => pendingQueue(500),
    setPriority,
    log: (m) => console.log(m),
    weight: WEIGHT,
    base: BASE,
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
