// scripts/sensor-ai-citations.mjs
// Runs each monitored question through available answer engines, detects whether our
// domain is cited, logs results, and enqueues content fixes when we miss a citation we
// should own. This is what gives the agent EYES on AI search.
//
// Run: node --env-file=.env scripts/sensor-ai-citations.mjs
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { db, targetDomain } from "../lib/db.mjs";
import { ALL_ENGINES, scoreResult, askGoogleAIO } from "../lib/engines.mjs";
import { majorityVote } from "../lib/citation-events.mjs";
import { selectCompetitorDomains } from "../lib/classify.mjs";
import { enqueue, doNotTouch } from "../orchestrator/lib/supabase.mjs";
import { isProtected } from "../orchestrator/lib/url.mjs";

const domain = targetDomain();
if (!domain) {
  console.error("[citations] Could not resolve target domain (set TARGET_DOMAIN or WP_BASE_URL).");
  process.exit(1);
}

// Manual override/seed; the auto-classified competitor_domains table is the main source.
const ENV_COMPETITORS = (process.env.COMPETITOR_DOMAINS || "")
  .split(",").map((s) => s.trim()).filter(Boolean);
const MIN_CONF = Number(process.env.COMPETITOR_MIN_CONFIDENCE || 0.7);
const AIO_SAMPLES = Number(process.env.AIO_SAMPLES || 3); // multi-sample majority to defeat AIO flicker

// Load the monitored question set. Prefer the DB (ai_queries); fall back to a JSON file.
async function loadQueries() {
  const { data, error } = await db
    .from("ai_queries")
    .select("query,intent,target_url,priority")
    .eq("active", true)
    .order("priority", { ascending: false });
  if (!error && data && data.length) return data;

  const file = process.env.AI_QUERIES_FILE || "config/monitored-queries.json";
  try {
    const rows = JSON.parse(readFileSync(resolve(file), "utf8"));
    console.log(`[citations] DB empty — loaded ${rows.length} queries from ${file}`);
    return rows;
  } catch {
    console.error("[citations] No queries in ai_queries and no readable config file. Nothing to do.");
    return [];
  }
}

async function run() {
  const queries = await loadQueries();
  if (!queries.length) process.exit(0);

  // competitor set = auto-classified high-confidence rivals ∪ manual env override.
  // Degrades to the env list alone if the table is missing (schema not yet applied).
  const { data: compRows, error: compErr } = await db
    .from("competitor_domains")
    .select("domain,classification,confidence,source");
  if (compErr) console.error(`[citations] competitor_domains unavailable (${compErr.message}); env list only`);
  const COMPETITORS = selectCompetitorDomains(compErr ? [] : compRows || [], ENV_COMPETITORS, MIN_CONF);

  let cto = 0, miss = 0;
  const summary = [];
  const citationRows = [];
  const outcomeRows = [];
  const queueRows = [];

  for (const q of queries) {
    for (const ask of ALL_ENGINES) {
      const result = await ask(q.query);
      if (result.available === false) continue; // key absent → engine skipped
      if (!result.answered) {
        summary.push({ query: q.query.slice(0, 40), engine: result.engine, status: `err ${result.error || ""}` });
        continue;
      }

      const s = scoreResult(result, domain, COMPETITORS);

      citationRows.push({
        query: q.query,
        engine: result.engine,
        answered: true,
        cited: s.cited,
        brand_mentioned: s.brandMentioned,
        position: s.position,
        sources: s.sources,
        competitors: s.competitorsCited,
        target_url: q.target_url || null,
      });

      // log a comparable outcome row (1 cited / 0 not) for the learning loop
      if (q.target_url) {
        outcomeRows.push({ url: q.target_url, metric: "citations", value: s.cited ? 1 : 0 });
      }

      if (s.cited) cto++;
      else {
        miss++;
        // we SHOULD own this and don't → enqueue a citation-improvement task
        if (q.target_url && (q.priority ?? 0) >= 5) {
          const task = q.intent === "informational" ? "restructure-for-citation" : "ai-info-page";
          queueRows.push({
            url: q.target_url,
            task,
            risk_class: "safe",
            priority: (q.priority ?? 0) + 2, // bump: a confirmed AI miss is high-signal
            source: "citation",
            status: "pending",
          });
        }
      }

      summary.push({
        query: q.query.slice(0, 40),
        engine: result.engine,
        status: s.cited ? `CITED #${s.position}` : (s.brandMentioned ? "mention" : "miss"),
        competitors: s.competitorsCited.join(",") || "-",
      });
    }

    // Google AI Overview — the citation surface that matters most, and the most volatile.
    // Capture AIO_SAMPLES times and majority-vote to strip intra-run rendering flicker before
    // logging ONE consensus google_aio row (ADR-007). No enqueue here — the PR#2 analyst gates
    // action off the citation_events diff, not off a raw miss.
    const aioSamples = [];
    for (let i = 0; i < AIO_SAMPLES; i++) {
      const r = await askGoogleAIO(q.query);
      if (r.available === false) break;   // no SERPAPI_KEY → AIO capture disabled
      if (!r.answered) continue;          // failed fetch → exclude (unknown, not "absent")
      const sc = scoreResult(r, domain, COMPETITORS);
      aioSamples.push({ present: r.present, cited: sc.cited, position: sc.position, competitors: sc.competitorsCited, sources: sc.sources, brand: sc.brandMentioned });
    }
    if (aioSamples.length) {
      const v = majorityVote(aioSamples);
      const presentVotes = aioSamples.filter((x) => x.present).length;
      const brandVotes = aioSamples.filter((x) => x.present && x.brand).length;
      citationRows.push({
        query: q.query,
        engine: "google_aio",
        answered: true,
        aio_present: v.present,
        cited: v.cited,
        brand_mentioned: brandVotes * 2 > presentVotes,
        position: v.position,
        sources: [...new Set(aioSamples.flatMap((x) => x.sources || []).filter(Boolean))],
        competitors: v.competitors,
        target_url: q.target_url || null,
      });
      if (v.cited) cto++; else miss++;
      summary.push({
        query: q.query.slice(0, 40),
        engine: "google_aio",
        status: v.present ? (v.cited ? `CITED #${v.position}` : "miss") : "no-aio",
        competitors: v.competitors.join(",") || "-",
      });
    }
  }

  if (citationRows.length) await db.from("ai_citations").insert(citationRows);

  let outcomesLogged = 0;
  if (outcomeRows.length) {
    const { error } = await db.from("outcomes").insert(outcomeRows);
    if (error) console.error(`[citations] outcomes insert FAILED — 0 of ${outcomeRows.length} outcomes logged: ${error.message}`);
    else outcomesLogged = outcomeRows.length;
  }

  let enqueued = 0;
  if (queueRows.length) {
    // Route through the queue seam: do_not_touch filter + validation + dedup-upsert.
    const skip = await doNotTouch();
    const fresh = queueRows.filter((r) => !isProtected(skip, r.url));
    await enqueue(fresh, { protectedSet: skip });
    enqueued = fresh.length;
  }

  console.table(summary);
  console.log(`[citations] cited=${cto} miss=${miss} fixes_enqueued=${enqueued} outcomes_logged=${outcomesLogged} competitors=${COMPETITORS.length} domain=${domain}`);
}

run().catch((e) => { console.error(e); process.exit(1); });
