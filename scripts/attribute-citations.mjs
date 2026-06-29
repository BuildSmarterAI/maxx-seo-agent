// scripts/attribute-citations.mjs
// Closes the GEO learning loop. Looks at citation outcomes before vs after each change_type
// the agent applied (from decision_log) and updates learned_patterns with the average effect.
// The prioritizer then favors change types that actually earn AI citations.
//
// Run: node --env-file=.env scripts/attribute-citations.mjs
import { db } from "../lib/db.mjs";

const WINDOW_DAYS = Number(process.env.ATTRIBUTION_WINDOW_DAYS || 21);

async function run() {
  // pull recent citation outcomes
  const since = new Date(Date.now() - WINDOW_DAYS * 864e5).toISOString();
  const { data: outs } = await db
    .from("outcomes")
    .select("url,metric,value,captured_at")
    .eq("metric", "citations")
    .gte("captured_at", since)
    .order("captured_at", { ascending: true });

  if (!outs || !outs.length) {
    console.log("[attribute-citations] no citation outcomes in window — nothing to attribute.");
    process.exit(0);
  }

  // pull decisions (what change_type was applied to which url)
  const { data: decisions } = await db
    .from("decision_log")
    .select("url,change_type,created_at")
    .not("change_type", "is", null)
    .gte("created_at", since);

  // group citation values by url, ordered in time
  const byUrl = new Map();
  for (const o of outs) {
    if (!byUrl.has(o.url)) byUrl.set(o.url, []);
    byUrl.get(o.url).push(o);
  }

  // effect per change_type = mean(after) - mean(before) around the decision timestamp
  const effects = new Map(); // change_type -> {sum, n}
  for (const d of decisions || []) {
    const series = byUrl.get(d.url);
    if (!series || series.length < 2) continue;
    const t = new Date(d.created_at).getTime();
    const before = series.filter((s) => new Date(s.captured_at).getTime() < t).map((s) => s.value);
    const after = series.filter((s) => new Date(s.captured_at).getTime() >= t).map((s) => s.value);
    if (!before.length || !after.length) continue;
    const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    const eff = mean(after) - mean(before);
    const cur = effects.get(d.change_type) || { sum: 0, n: 0 };
    cur.sum += eff; cur.n += 1;
    effects.set(d.change_type, cur);
  }

  if (!effects.size) {
    console.log("[attribute-citations] not enough before/after pairs yet — need more runs.");
    process.exit(0);
  }

  const rows = [];
  for (const [change_type, { sum, n }] of effects) {
    const avg = sum / n;
    await db.from("learned_patterns").upsert(
      { change_type, avg_effect: avg, n, updated_at: new Date().toISOString() },
      { onConflict: "change_type" }
    );
    rows.push({ change_type, avg_effect: Number(avg.toFixed(3)), n });
  }

  console.table(rows);
  console.log(`[attribute-citations] updated ${rows.length} patterns from ${outs.length} outcomes`);
}

run().catch((e) => { console.error(e); process.exit(1); });
