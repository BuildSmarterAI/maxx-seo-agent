// scripts/classify-competitors.mjs
// Discovers every domain AI engines cited (ai_citations.sources), classifies each NEW one
// as competitor / reference / noise via Haiku, and upserts into competitor_domains. Already-
// classified domains are skipped (never re-asked → bounded cost) and manual pins are never
// overwritten. sensor-ai-citations.mjs then scores citation gaps against the high-confidence
// 'competitor' rows. Runs BEFORE the citation sensor each week so scoring uses a fresh list.
//
// Run: node --env-file=.env scripts/classify-competitors.mjs
import { db, targetDomain } from "../lib/db.mjs";
import { classifyDomains, normalizeDomain } from "../lib/classify.mjs";

const CHUNK = Number(process.env.CLASSIFY_BATCH || 25);
const own = targetDomain();

async function run() {
  if (!own) {
    console.error("[classify] no target domain (set TARGET_DOMAIN or WP_BASE_URL).");
    process.exit(1);
  }

  // 1. discover cited domains + the queries each appeared on
  const { data: cites, error } = await db.from("ai_citations").select("query,sources");
  if (error) {
    console.error(`[classify] read ai_citations failed: ${error.message}`);
    process.exit(1);
  }

  const discovered = new Map(); // domain -> { count, queries:Set }
  for (const row of cites || []) {
    const srcs = Array.isArray(row.sources) ? row.sources : [];
    for (const u of srcs) {
      const h = normalizeDomain(u);
      if (!h || h === own || h.endsWith(`.${own}`)) continue;
      const d = discovered.get(h) ?? { count: 0, queries: new Set() };
      d.count++;
      if (row.query) d.queries.add(row.query);
      discovered.set(h, d);
    }
  }
  if (!discovered.size) {
    console.log("[classify] no cited domains yet — nothing to classify.");
    process.exit(0);
  }

  // 2. skip already-classified domains (never re-ask; never touch their classification or pins).
  // Fail fast if the table is missing — otherwise we'd burn an LLM call before the insert fails.
  const { data: known, error: knownErr } = await db.from("competitor_domains").select("domain");
  if (knownErr) {
    console.error(`[classify] competitor_domains unavailable (${knownErr.message}); run sql/ai-search-schema.sql first.`);
    process.exit(1);
  }
  const knownSet = new Set((known || []).map((r) => r.domain));

  const newItems = [...discovered.entries()]
    .filter(([d]) => !knownSet.has(d))
    .map(([domain, v]) => ({ domain, queries: [...v.queries], count: v.count }));

  // 3. classify new domains in chunks (one Haiku call per chunk).
  // A chunk failure (429/5xx/network) must not abort the run — log and keep the earlier chunks,
  // else cost-bounding would re-discover the skipped domains forever without ever writing them.
  const classified = [];
  for (let i = 0; i < newItems.length; i += CHUNK) {
    const chunk = newItems.slice(i, i + CHUNK);
    let rows;
    try {
      rows = await classifyDomains(chunk, { ownDomain: own });
    } catch (e) {
      console.error(`[classify] chunk ${i}-${i + chunk.length - 1} failed: ${e.message}`);
      continue;
    }
    const countByDomain = new Map(chunk.map((c) => [c.domain, c.count]));
    for (const r of rows) {
      classified.push({
        domain: r.domain,
        classification: r.classification,
        confidence: r.confidence,
        rationale: r.rationale,
        times_cited: countByDomain.get(r.domain) ?? 0,
        source: "auto",
        updated_at: new Date().toISOString(),
      });
    }
  }

  // 4. insert new rows; ignoreDuplicates so an existing (incl. manual) row is never overwritten.
  // times_cited is a snapshot at first classification — the live count lives in ai_citations.
  let savedCount = 0;
  if (classified.length) {
    const { error: insErr } = await db
      .from("competitor_domains")
      .upsert(classified, { onConflict: "domain", ignoreDuplicates: true });
    if (insErr) console.error(`[classify] insert failed — 0 of ${classified.length}: ${insErr.message}`);
    else savedCount = classified.length;
  }

  const byClass = classified.reduce((m, r) => ((m[r.classification] = (m[r.classification] || 0) + 1), m), {});
  console.log(
    `[classify] discovered=${discovered.size} new=${newItems.length} classified=${savedCount} ` +
      `(competitor=${byClass.competitor || 0} reference=${byClass.reference || 0} noise=${byClass.noise || 0}) own=${own}`
  );
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
