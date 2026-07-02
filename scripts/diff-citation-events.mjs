// scripts/diff-citation-events.mjs
// Diffs the two latest google_aio snapshots per monitored query (from ai_citations) and
// materializes citation_events on a transition — gained | lost | displaced (ADR-007). This
// gives the loop MEMORY: a lost AIO citation becomes a first-class, queryable object instead
// of an implicit week-over-week difference. No enqueue here — the PR#2 analyst reasons over
// these events and gates any action.
//
// Idempotent: citation_events has unique(query,engine,captured_at) and captured_at is the
// triggering snapshot's own timestamp, so re-running with no new snapshot is a no-op.
// Run: node --env-file=.env scripts/diff-citation-events.mjs
import { db } from "../lib/db.mjs";
import { diffAioSnapshots } from "../lib/citation-events.mjs";

const WINDOW_DAYS = Number(process.env.CITATION_EVENT_WINDOW_DAYS || 60);

// Rebuild the consensus snapshot shape the diff core expects from a stored ai_citations row.
function snapshot(row) {
  if (!row) return null;
  return {
    present: row.aio_present === true,
    cited: row.cited === true,
    position: row.position ?? null,
    competitors: Array.isArray(row.competitors) ? row.competitors : [],
  };
}

async function run() {
  const since = new Date(Date.now() - WINDOW_DAYS * 864e5).toISOString();
  const { data, error } = await db
    .from("ai_citations")
    .select("query,target_url,cited,position,competitors,aio_present,captured_at")
    .eq("engine", "google_aio")
    .gte("captured_at", since)
    .order("captured_at", { ascending: false });
  if (error) throw new Error(`ai_citations read failed: ${error.message}`);

  if (!data || !data.length) {
    console.log("[diff-events] no google_aio snapshots in window — nothing to diff.");
    process.exit(0);
  }

  // group snapshots by query, newest first (query is the stable key; target_url can move)
  const byQuery = new Map();
  for (const r of data) {
    if (!byQuery.has(r.query)) byQuery.set(r.query, []);
    byQuery.get(r.query).push(r);
  }

  const rows = [];
  for (const [query, snaps] of byQuery) {
    const [curr, prev] = snaps; // newest, second-newest
    const event = diffAioSnapshots(snapshot(prev), snapshot(curr));
    if (!event) continue;
    rows.push({
      query,
      target_url: curr.target_url ?? null,
      engine: "google_aio",
      event: event.event,
      competitor_won: event.competitor_won,
      prev_captured_at: prev.captured_at,
      captured_at: curr.captured_at,
    });
  }

  if (!rows.length) {
    console.log(`[diff-events] ${byQuery.size} queries scanned — no transitions.`);
    process.exit(0);
  }

  // unique(query,engine,captured_at) makes a same-snapshot re-run a no-op
  const { error: upErr } = await db
    .from("citation_events")
    .upsert(rows, { onConflict: "query,engine,captured_at", ignoreDuplicates: true });
  if (upErr) throw new Error(`citation_events upsert failed: ${upErr.message}`);

  console.table(rows.map((r) => ({ query: r.query.slice(0, 40), event: r.event, competitor_won: (r.competitor_won || []).join(",") || "-" })));
  console.log(`[diff-events] wrote ${rows.length} transition event(s) from ${byQuery.size} queries.`);
}

run().catch((e) => { console.error(e); process.exit(1); });
