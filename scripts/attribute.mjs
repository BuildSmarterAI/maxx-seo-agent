#!/usr/bin/env node
// attribute.mjs — joins applied decisions to outcome snapshots and learns which
// change types move clicks. Uses a trailing window (before vs. ≥LAG days after the
// change) so it is not reacting to a single week. Writes to learned_patterns.
//
// This is directional, not causal: core updates and seasonality confound it.
import { appliedDecisions, clicksAround, upsertPattern } from "../orchestrator/lib/supabase.mjs";

const LAG = Number(process.env.ATTR_LAG_DAYS || 28);
const MIN_N = Number(process.env.ATTR_MIN_N || 3);   // need this many samples to trust a type

async function main() {
  const decisions = await appliedDecisions(120);
  const byType = new Map();   // change_type -> { sum, n }

  for (const d of decisions) {
    const { before, after } = await clicksAround(d.url, d.created_at, LAG);
    if (before == null || after == null) continue;            // not enough history yet
    const lift = (after - before) / Math.max(before, 1);      // relative click change
    const e = byType.get(d.change_type) || { sum: 0, n: 0 };
    e.sum += lift; e.n += 1; byType.set(d.change_type, e);
  }

  let written = 0;
  for (const [type, { sum, n }] of byType) {
    if (n < MIN_N) { console.log(`skip ${type}: only ${n} samples (<${MIN_N})`); continue; }
    const avg = sum / n;
    await upsertPattern(type, Number(avg.toFixed(4)), n);
    console.log(`${type}: avg_effect ${(avg * 100).toFixed(1)}% over ${n} changes`);
    written++;
  }
  console.log(`updated ${written} pattern(s).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
