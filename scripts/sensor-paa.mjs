// scripts/sensor-paa.mjs
// Mines People-Also-Ask / related questions for each monitored topic and queues FAQ work.
// Questions are where AI Overviews appear least and citations land most — systematically
// capturing them feeds the faq-schema skill with real query data, not guesses.
//
// Source priority: SERPAPI_KEY (real PAA boxes) -> answer-engine enumeration fallback.
// Run: node --env-file=.env scripts/sensor-paa.mjs
import { db } from "../lib/db.mjs";
import { askClaude, askPerplexity } from "../lib/engines.mjs";
import { enqueue, doNotTouch } from "../orchestrator/lib/supabase.mjs";

const SERPAPI_KEY = process.env.SERPAPI_KEY;

// topics come from ai_queries (reuse the monitored set), grouped by target_url
async function loadTopics() {
  const { data, error } = await db
    .from("ai_queries")
    .select("query,target_url,priority")
    .eq("active", true)
    .order("priority", { ascending: false })
    .limit(40);
  if (error || !data) return [];
  return data;
}

async function paaFromSerpApi(topic) {
  const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(topic)}&api_key=${SERPAPI_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  const rq = data.related_questions || [];
  return rq.map((r) => r.question).filter(Boolean);
}

async function paaFromEngine(topic) {
  const prompt =
    `List the 8 most common follow-up questions real buyers ask about: "${topic}". ` +
    `Return ONLY the questions, one per line, no numbering, no preamble.`;
  let r = await askClaude(prompt);
  if (r.available === false) r = await askPerplexity(prompt); // no Claude key → try Perplexity
  if (!r || r.available === false || !r.answered) return [];
  return (r.text || "")
    .split("\n")
    .map((l) => l.replace(/^[\s\-\d.)]+/, "").trim())
    .filter((l) => l.endsWith("?") && l.length > 10)
    .slice(0, 8);
}

async function run() {
  const topics = await loadTopics();
  if (!topics.length) {
    console.log("[paa] No topics in ai_queries. Seed it first.");
    process.exit(0);
  }

  const source = SERPAPI_KEY ? "serpapi" : "engine";
  const paaRows = [];
  const queueRows = [];
  for (const t of topics) {
    const questions = SERPAPI_KEY ? await paaFromSerpApi(t.query) : await paaFromEngine(t.query);
    for (const question of questions) {
      paaRows.push({ topic: t.query, question, target_url: t.target_url || null, source });
    }
    // enqueue one faq-schema pass per target page that gathered new questions
    if (t.target_url && questions.length) {
      queueRows.push({
        url: t.target_url,
        task: "faq-schema",
        risk_class: "safe",
        priority: (t.priority ?? 0),
        source: "citation",
        status: "pending",
      });
    }
  }

  if (paaRows.length) {
    await db.from("paa_questions").upsert(paaRows, { onConflict: "question", ignoreDuplicates: true });
  }
  if (queueRows.length) {
    // Route through the queue seam: do_not_touch filter + validation + dedup-upsert, instead of
    // a raw insert that could enqueue a protected URL and duplicate rows on re-run.
    const skip = await doNotTouch();
    await enqueue(queueRows.filter((r) => !skip.has(r.url)));
  }

  console.log(`[paa] questions_captured=${paaRows.length} faq_tasks_queued=${queueRows.length} source=${source}`);
}

run().catch((e) => { console.error(e); process.exit(1); });
