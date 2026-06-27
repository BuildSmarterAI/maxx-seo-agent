// learning.mjs — the learning-loop scoring seam. Pure formulas + injectable cores so
// the directional-attribution math and the priority recompute are testable without
// touching Supabase. The scripts (attribute.mjs, prioritize.mjs) keep only the I/O
// wiring: read from Supabase, call a core, write back.
//
// Behaviour is frozen to match the previous inline implementations exactly — the
// impression/position reweighting (ADR-006 #1) is a deliberate, separate change.
//
// NOTE (preserved latent quirk): reprioritize looks up patterns by `row.task`, but
// learned_patterns is keyed by `change_type`. If those vocabularies diverge the effect
// is silently 0. Kept as-is here to preserve behaviour; flagged for a follow-up.

// Directional effect of one applied change: blended click + position lift.
// Higher clicks = better; lower position = better. Denominator floors at 1 so a zero
// baseline can't divide-by-zero (and tiny baselines don't explode the lift).
// Returns the blended number, or null when click history is too thin to score the row.
export function effectOf({ clicksBefore, clicksAfter, posBefore, posAfter }, { click, position }) {
  if (clicksBefore == null || clicksAfter == null) return null;
  const clickLift = (clicksAfter - clicksBefore) / Math.max(clicksBefore, 1);
  const posLift = (posBefore != null && posAfter != null)
    ? (posBefore - posAfter) / Math.max(posBefore, 1)
    : 0;
  return clickLift * click + posLift * position;
}

// Queue priority from a source baseline plus the learned effect, clamped to 0..10.
export function priorityScore(base, effect, weight) {
  return Math.max(0, Math.min(10, base + Math.round(effect * weight)));
}

// Injectable core: join applied decisions to outcome snapshots, average the blended
// effect per change_type, and persist types with enough samples. All I/O is injected.
export async function attribute({ fetchDecisions, clicksAround, positionAround, upsertPattern, log, weights, lagDays, minN }) {
  const decisions = await fetchDecisions();
  const byType = new Map(); // change_type -> { sum, n }

  for (const d of decisions) {
    const [clicks, position] = await Promise.all([
      clicksAround(d.url, d.created_at, lagDays),
      positionAround(d.url, d.created_at, lagDays),
    ]);
    const effect = effectOf(
      { clicksBefore: clicks.before, clicksAfter: clicks.after, posBefore: position.before, posAfter: position.after },
      weights,
    );
    if (effect == null) continue; // not enough history yet
    const e = byType.get(d.change_type) ?? { sum: 0, n: 0 };
    byType.set(d.change_type, { sum: e.sum + effect, n: e.n + 1 });
  }

  let written = 0;
  for (const [type, { sum, n }] of byType) {
    if (n < minN) { log(`skip ${type}: only ${n} samples (<${minN})`); continue; }
    const avg = sum / n;
    await upsertPattern(type, Number(avg.toFixed(4)), n);
    log(`${type}: avg_effect ${(avg * 100).toFixed(1)}% over ${n} changes`);
    written++;
  }
  log(`updated ${written} pattern(s).`);
  return { written };
}

// Injectable core: re-score pending queue items from learned patterns, writing back
// only when the priority actually changes. All I/O is injected.
export async function reprioritize({ fetchPatterns, fetchQueue, setPriority, log, weight, base }) {
  const patterns = await fetchPatterns();
  const queue = await fetchQueue();
  let changed = 0;

  for (const row of queue) {
    const baseScore = base[row.source] ?? 1;
    const effect = patterns.get(row.task) ?? 0;
    const next = priorityScore(baseScore, effect, weight);
    if (next !== row.priority) { await setPriority(row.id, next); changed++; }
  }

  log(`reprioritized ${changed}/${queue.length} pending items.`);
  return { changed, total: queue.length };
}
