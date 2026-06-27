// learning.mjs — the learning-loop scoring seam. Pure formulas + injectable cores so
// the directional-attribution math and the priority recompute are testable without
// touching Supabase. The scripts (attribute.mjs, prioritize.mjs) keep only the I/O
// wiring: read from Supabase, call a core, write back.
//
// effectOf blends three signals (clicks, impressions, position) per ADR-006 #1.
// Impressions and position degrade to 0 when their snapshots are missing or unweighted,
// so the clicks-only callers stay byte-identical — clicks remain the scoreable gate.
//
// JOIN KEY: reprioritize looks up patterns by `row.task`, and learned_patterns is keyed
// by `change_type` — these are the SAME vocabulary (the kit-skill name), because the
// orchestrator logs every applied decision with `--type <task>`. See CONTEXT.md →
// learned_patterns. A queue row misses only when its task has no learned pattern yet, or
// when a stray decision_log row carried a non-task change_type; reprioritize counts the
// match rate (`matched`) so a real no-op is visible, not silent.

// Directional effect of one applied change: blended click + impression + position lift.
// Higher clicks = better; higher impressions = better; lower position = better.
// Denominator floors at 1 so a zero baseline can't divide-by-zero (and tiny baselines
// don't explode the lift). Impression and position lift degrade to 0 when either of their
// snapshots is missing; the impression weight defaults to 0 so callers that pass no
// impression weight score exactly as before. Returns null when click history is too thin.
export function effectOf({ clicksBefore, clicksAfter, imprBefore, imprAfter, posBefore, posAfter }, { click, position, impression }) {
  if (clicksBefore == null || clicksAfter == null) return null;
  const clickLift = (clicksAfter - clicksBefore) / Math.max(clicksBefore, 1);
  const imprLift = (imprBefore != null && imprAfter != null)
    ? (imprAfter - imprBefore) / Math.max(imprBefore, 1)
    : 0;
  const posLift = (posBefore != null && posAfter != null)
    ? (posBefore - posAfter) / Math.max(posBefore, 1)
    : 0;
  return clickLift * click + imprLift * (impression ?? 0) + posLift * position;
}

// Queue priority from a source baseline plus the learned effect, clamped to 0..10.
export function priorityScore(base, effect, weight) {
  return Math.max(0, Math.min(10, base + Math.round(effect * weight)));
}

// Injectable core: join applied decisions to outcome snapshots, average the blended
// effect per change_type, and persist types with enough samples. All I/O is injected.
export async function attribute({ fetchDecisions, clicksAround, positionAround, impressionsAround = async () => ({ before: null, after: null }), upsertPattern, log, weights, lagDays, minN }) {
  const decisions = await fetchDecisions();
  const byType = new Map(); // change_type -> { sum, n }

  for (const d of decisions) {
    const [clicks, position, impressions] = await Promise.all([
      clicksAround(d.url, d.created_at, lagDays),
      positionAround(d.url, d.created_at, lagDays),
      impressionsAround(d.url, d.created_at, lagDays),
    ]);
    const effect = effectOf(
      { clicksBefore: clicks.before, clicksAfter: clicks.after, imprBefore: impressions.before, imprAfter: impressions.after, posBefore: position.before, posAfter: position.after },
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
  let matched = 0; // rows whose task joined a learned pattern — the learning signal's reach

  for (const row of queue) {
    const baseScore = base[row.source] ?? 1;
    const learned = patterns.get(row.task);
    if (learned != null) matched++;
    const effect = learned ?? 0;
    const next = priorityScore(baseScore, effect, weight);
    if (next !== row.priority) { await setPriority(row.id, next); changed++; }
  }

  log(`reprioritized ${changed}/${queue.length} pending items (${matched} matched a learned pattern).`);
  return { changed, total: queue.length, matched };
}
