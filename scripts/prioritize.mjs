#!/usr/bin/env node
// prioritize.mjs — I/O shell over the learning-loop reprioritize core. Reads
// learned_patterns (GSC) + learned_patterns_geo (citation-delta, #40) + pending
// work_queue from Supabase, delegates the priority recompute to
// orchestrator/lib/learning.mjs, and writes back the changed priorities, so the
// orchestrator works the change types that have actually moved metrics first.
// priority = base(by source) + round((gsc_effect + GEO bonus + CONV bonus) * WEIGHT), clamped 0..10.
// GEO and CONV bonuses are sample-size-shrunk and auto-rescaled onto the GSC scale (see learning.mjs);
// GEO_PRIORITY_WEIGHT=0 / CONV_PRIORITY_WEIGHT=0 disable them, and each contributes nothing until
// its table (learned_patterns_geo / learned_patterns_conv) fills.
import { pendingQueue, learnedPatterns, learnedPatternsGeo, learnedPatternsConv, setPriority } from "../orchestrator/lib/supabase.mjs";
import { reprioritize } from "../orchestrator/lib/learning.mjs";

const WEIGHT = Number(process.env.PRIORITY_WEIGHT || 5);
const GEO_WEIGHT = Number(process.env.GEO_PRIORITY_WEIGHT ?? 0.3);
const GEO_SHRINK_K = Number(process.env.GEO_SHRINK_K ?? 5);
const CONV_WEIGHT = Number(process.env.CONV_PRIORITY_WEIGHT ?? 0.3);
const CONV_SHRINK_K = Number(process.env.CONV_SHRINK_K ?? 5);
const BASE = { gsc: 2, sitemap: 1, deploy: 2, citation: 3, manual: 4 };

async function main() {
  await reprioritize({
    fetchPatterns: () => learnedPatterns(),
    fetchGeoPatterns: () => learnedPatternsGeo(),
    fetchConvPatterns: () => learnedPatternsConv(),
    fetchQueue: () => pendingQueue(500),
    setPriority,
    log: (m) => console.log(m),
    weight: WEIGHT,
    geoWeight: GEO_WEIGHT,
    shrinkK: GEO_SHRINK_K,
    convWeight: CONV_WEIGHT,
    convShrinkK: CONV_SHRINK_K,
    base: BASE,
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
