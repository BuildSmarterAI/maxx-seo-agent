// scripts/sensor-ai-citations.mjs
// Runs each monitored question through available answer engines, detects whether our
// domain is cited, logs results, and enqueues content fixes when we miss a citation we
// should own. This is what gives the agent EYES on AI search.
//
// Run: node --env-file=.env scripts/sensor-ai-citations.mjs
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { db, targetDomain } from "../lib/db.mjs";
import { ALL_ENGINES, scoreResult } from "../lib/engines.mjs";

const domain = targetDomain();
if (!domain) {
  console.error("[citations] Could not resolve target domain (set TARGET_DOMAIN or WP_BASE_URL).");
  process.exit(1);
}

const COMPETITORS = (process.env.COMPETITOR_DOMAINS || "")
  .split(",").map((s) => s.trim()).filter(Boolean);

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
    const { error } = await db.from("work_queue").insert(queueRows);
    if (error) console.error(`[citations] work_queue insert FAILED — 0 of ${queueRows.length} fixes enqueued: ${error.message}`);
    else enqueued = queueRows.length;
  }

  console.table(summary);
  console.log(`[citations] cited=${cto} miss=${miss} fixes_enqueued=${enqueued} outcomes_logged=${outcomesLogged} domain=${domain}`);
}

run().catch((e) => { console.error(e); process.exit(1); });
