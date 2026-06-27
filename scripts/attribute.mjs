#!/usr/bin/env node
// attribute.mjs — I/O shell over the learning-loop attribution core. Reads applied
// decisions + outcome snapshots from Supabase, delegates the blended-effect math to
// orchestrator/lib/learning.mjs, and writes learned_patterns. Uses a trailing window
// (before vs. >=LAG days after the change) so it is not reacting to a single week.
//
// This is directional, not causal: core updates and seasonality confound it.
import { appliedDecisions, clicksAround, positionAround, upsertPattern } from "../orchestrator/lib/supabase.mjs";
import { attribute } from "../orchestrator/lib/learning.mjs";

const LAG = Number(process.env.ATTR_LAG_DAYS || 28);
const MIN_N = Number(process.env.ATTR_MIN_N || 3);   // need this many samples to trust a type
const CLICK_W = Number(process.env.ATTR_CLICK_WEIGHT || 0.7);
const POS_W   = Number(process.env.ATTR_POSITION_WEIGHT || 0.3);

async function main() {
  await attribute({
    fetchDecisions: () => appliedDecisions(120),
    clicksAround,
    positionAround,
    upsertPattern,
    log: (m) => console.log(m),
    weights: { click: CLICK_W, position: POS_W },
    lagDays: LAG,
    minN: MIN_N,
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
