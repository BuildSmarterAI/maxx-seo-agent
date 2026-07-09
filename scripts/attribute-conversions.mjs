// scripts/attribute-conversions.mjs
// Closes the conversion learning loop. Looks at organic-conversion outcomes before vs after
// each change_type the agent applied (from decision_log) and writes the average effect to
// learned_patterns_conv — a SEPARATE table (NOT the shared learned_patterns the GSC loop owns,
// NOR learned_patterns_geo the citation loop owns). Folding conversions into learned_patterns
// would rescale the GSC anchor on an incompatible scale and corrupt the GEO calibration + eval
// mining; prioritize.mjs blends this table in deliberately as a bounded, rescaled term.
//
// Depends on collect-outcomes.mjs writing `organic_conversions` rows (PR 1B). Runs weekly in
// seo-learn.yml between collect-outcomes and prioritize so the table is fresh when it's read.
//
// Run: node --env-file=.env scripts/attribute-conversions.mjs
import { db } from "../lib/db.mjs";
import { KIT_TASKS } from "../orchestrator/lib/tasks.mjs";

const WINDOW_DAYS = Number(process.env.ATTRIBUTION_WINDOW_DAYS || 21);

async function run() {
  // pull recent organic-conversion outcomes
  const since = new Date(Date.now() - WINDOW_DAYS * 864e5).toISOString();
  const { data: outs } = await db
    .from("outcomes")
    .select("url,metric,value,captured_at")
    .eq("metric", "organic_conversions")
    .gte("captured_at", since)
    .order("captured_at", { ascending: true });

  if (!outs || !outs.length) {
    console.log("[attribute-conversions] no organic_conversions outcomes in window — nothing to attribute.");
    process.exit(0);
  }

  // pull decisions (what change_type was applied to which url)
  const { data: decisions } = await db
    .from("decision_log")
    .select("url,change_type,created_at")
    .not("change_type", "is", null)
    .gte("created_at", since);

  // group conversion values by url, ordered in time
  const byUrl = new Map();
  for (const o of outs) {
    if (!byUrl.has(o.url)) byUrl.set(o.url, []);
    byUrl.get(o.url).push(o);
  }

  // effect per change_type = mean(after) - mean(before) around the decision timestamp
  const effects = new Map(); // change_type -> {sum, n}
  for (const d of decisions || []) {
    // Only attribute joinable tasks. A change_type outside the kit vocabulary (a legacy orphan
    // like "metadata") can never join a queue task, so writing a pattern for it is dead weight.
    if (!d.change_type || !KIT_TASKS.has(d.change_type)) continue;
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
    console.log("[attribute-conversions] not enough before/after pairs yet — need more runs.");
    process.exit(0);
  }

  const rows = [];
  for (const [change_type, { sum, n }] of effects) {
    const avg = sum / n;
    await db.from("learned_patterns_conv").upsert(
      { change_type, avg_effect: avg, n, updated_at: new Date().toISOString() },
      { onConflict: "change_type" }
    );
    rows.push({ change_type, avg_effect: Number(avg.toFixed(3)), n });
  }

  console.table(rows);
  console.log(`[attribute-conversions] updated ${rows.length} patterns from ${outs.length} outcomes`);
}

run().catch((e) => { console.error(e); process.exit(1); });
