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

// Bayesian-style shrinkage toward zero: a change_type with few GEO observations barely
// contributes, one with many contributes fully. shrink(0)=0, shrink(n→∞)→1.
function shrink(n, k) {
  const nn = Number(n) || 0;
  return nn <= 0 ? 0 : nn / (nn + k);
}

// Mean absolute value of a numeric list (0 for an empty list). Used to put the GSC and
// GEO effect signals — measured in different units — on a common scale before blending.
function meanAbs(values) {
  if (!values.length) return 0;
  return values.reduce((s, v) => s + Math.abs(Number(v) || 0), 0) / values.length;
}

// Injectable core: re-score pending queue items from learned patterns, writing back
// only when the priority actually changes. All I/O is injected.
//
// GSC learned_patterns is the anchor signal. TWO further signals blend in as bounded,
// sample-size-shrunk bonuses on the SAME scale, each auto-rescaled onto GSC's units:
//   effect = gsc + geoWeight·shrink(n)·(S_gsc/S_geo)·geo + convWeight·shrink(n)·(S_gsc/S_conv)·conv
// GEO is learned_patterns_geo (citation-delta per change_type); CONV is learned_patterns_conv
// (organic-conversion delta, PR 1C). The S_gsc/S_x ratio (mean |effect| of each signal)
// rescales each incompatible scale onto GSC's without a hand-tuned constant; when a signal
// has no spread we can't calibrate, so its term is suppressed rather than guessed. Both are
// OFF by default (empty map / weight 0), so callers that pass no GEO/CONV args — and the whole
// loop until each table fills — score exactly as before. effectOf is NOT touched by either.
export async function reprioritize({ fetchPatterns, fetchQueue, setPriority, log, weight, base, fetchGeoPatterns = async () => new Map(), geoWeight = 0, shrinkK = 5, fetchConvPatterns = async () => new Map(), convWeight = 0, convShrinkK = 5 }) {
  const patterns = await fetchPatterns();
  const geoPatterns = await fetchGeoPatterns();
  const convPatterns = await fetchConvPatterns();
  const queue = await fetchQueue();

  const sGsc = meanAbs([...patterns.values()]);
  const sGeo = meanAbs([...geoPatterns.values()].map((g) => g.avg_effect));
  const sConv = meanAbs([...convPatterns.values()].map((c) => c.avg_effect));
  const scale = geoWeight > 0 && sGsc > 0 && sGeo > 0 ? sGsc / sGeo : 0;
  const convScale = convWeight > 0 && sGsc > 0 && sConv > 0 ? sGsc / sConv : 0;

  let changed = 0;
  let matched = 0;     // rows whose task joined a GSC learned pattern — the learning signal's reach
  let geoMatched = 0;  // rows that also drew a non-zero GEO bonus — the GEO signal's reach
  let convMatched = 0; // rows that also drew a non-zero CONV bonus — the conversion signal's reach

  for (const row of queue) {
    const baseScore = base[row.source] ?? 1;
    const learned = patterns.get(row.task);
    if (learned != null) matched++;
    const gsc = learned ?? 0;

    const geo = geoPatterns.get(row.task);
    let geoTerm = 0;
    if (geo && scale > 0) {
      geoTerm = geoWeight * shrink(geo.n, shrinkK) * scale * Number(geo.avg_effect);
      if (geoTerm !== 0) geoMatched++;
    }

    const conv = convPatterns.get(row.task);
    let convTerm = 0;
    if (conv && convScale > 0) {
      convTerm = convWeight * shrink(conv.n, convShrinkK) * convScale * Number(conv.avg_effect);
      if (convTerm !== 0) convMatched++;
    }

    const next = priorityScore(baseScore, gsc + geoTerm + convTerm, weight);
    if (next !== row.priority) { await setPriority(row.id, next); changed++; }
  }

  log(`reprioritized ${changed}/${queue.length} pending items (${matched} GSC, ${geoMatched} GEO, ${convMatched} CONV patterns matched).`);
  return { changed, total: queue.length, matched };
}
