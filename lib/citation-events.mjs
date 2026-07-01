// lib/citation-events.mjs — pure cores for the AI Overview capture/diff pipeline.
// No Supabase, no network: the sensor/diff scripts inject the I/O and call these.
// See ADR-007. Mirrors the pure-core + injected-I/O split used by orchestrator/lib/learning.mjs.

// Google AI Overview flickers run-to-run: the block appears/disappears and the cited
// sources shift non-deterministically for an identical query. majorityVote collapses N
// successful captures of ONE query into a single consensus snapshot, so a phantom
// appearance/loss in a single run can't create a spurious citation_event.
//
// A "sample" is one successful capture: { present, cited, position, competitors }.
// Failed fetches are excluded by the caller — they mean "unknown", not "AIO absent".
// Consensus rule throughout: a fact is adopted only when a strict majority supports it
// (votes * 2 > denominator); ties resolve to the conservative (absent/uncited) outcome.
export function majorityVote(samples) {
  const n = samples.length;
  const absent = { present: false, cited: false, position: null, competitors: [] };
  if (!n) return absent;

  const present = samples.filter((s) => s.present);
  if (present.length * 2 <= n) return absent; // AIO not reliably present across runs

  const cited = present.filter((s) => s.cited);
  const isCited = cited.length * 2 > present.length;

  let position = null;
  if (isCited) {
    const ranks = cited.map((s) => s.position).filter((p) => Number.isInteger(p));
    position = ranks.length ? Math.min(...ranks) : null; // best rank we actually observed
  }

  // competitors that show up in a majority of the present runs (persistent, not flicker)
  const counts = new Map();
  for (const s of present) {
    for (const c of new Set(s.competitors ?? [])) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  const competitors = [...counts.entries()]
    .filter(([, c]) => c * 2 > present.length)
    .map(([d]) => d)
    .sort();

  return { present: true, cited: isCited, position, competitors };
}

// Compare the previous consensus snapshot to the current one for the same query and
// return a transition event, or null when nothing worth recording changed. Only three
// transitions are events (ADR-007): we newly earned the citation (gained), we lost it with
// a competitor taking it (displaced), or we lost it outright (lost). Position drift while
// still cited, and uncited->uncited churn (never ours to lose), are deliberately null.
export function diffAioSnapshots(prev, curr) {
  if (!prev) return null; // first observation of this query — no baseline to diff against
  const was = prev.cited;
  const now = curr.cited;

  if (!was && now) return { event: "gained", competitor_won: [] };

  if (was && !now) {
    const won = curr.present ? (curr.competitors ?? []) : [];
    return won.length
      ? { event: "displaced", competitor_won: won }
      : { event: "lost", competitor_won: [] };
  }

  return null; // cited->cited or uncited->uncited: no event
}
