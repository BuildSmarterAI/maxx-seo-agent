// scripts/link-graph.mjs
// Builds the whole-site internal link graph: inbound/outbound counts, orphan detection,
// pillar identification. Topic clusters + pillar wiring are how topical authority compounds.
// Operates on the graph, not page-by-page.
//
// Run: node --env-file=.env scripts/link-graph.mjs
import { db, targetDomain, sameDomain } from "../lib/db.mjs";
import { enqueue, doNotTouch } from "../orchestrator/lib/supabase.mjs";

const SITEMAP = process.env.SITEMAP_URL;
const domain = targetDomain();
const MAX_PAGES = Number(process.env.LINK_GRAPH_MAX_PAGES || 150);
const PILLAR_MIN_INBOUND = Number(process.env.PILLAR_MIN_INBOUND || 8);

if (!SITEMAP || !domain) {
  console.error("[link-graph] Need SITEMAP_URL and a resolvable domain.");
  process.exit(1);
}

function extractLocs(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
}
function normalize(u) {
  try {
    const url = new URL(u);
    return (url.origin + url.pathname).replace(/\/$/, "");
  } catch { return null; }
}

async function getUrls() {
  const res = await fetch(SITEMAP);
  let xml = await res.text();
  let locs = extractLocs(xml);
  if (/<sitemapindex/i.test(xml)) {
    const children = locs; locs = [];
    for (const c of children.slice(0, 20)) {
      try { const r = await fetch(c); if (r.ok) locs.push(...extractLocs(await r.text())); } catch {}
    }
  }
  return [...new Set(locs)]
    .filter((u) => !/\.(png|jpe?g|gif|webp|svg|pdf|xml)$/i.test(u))
    .map(normalize).filter(Boolean).slice(0, MAX_PAGES);
}

async function run() {
  const urls = await getUrls();
  const set = new Set(urls);
  const inbound = new Map(urls.map((u) => [u, 0]));
  const outbound = new Map(urls.map((u) => [u, 0]));

  for (const u of urls) {
    let html = "";
    try { const r = await fetch(u); if (r.ok) html = await r.text(); } catch { continue; }
    const hrefs = [...html.matchAll(/href=["']([^"']+)["']/g)].map((m) => m[1]);
    let out = 0;
    const seen = new Set();
    for (const h of hrefs) {
      let abs;
      try { abs = normalize(new URL(h, u).href); } catch { continue; }
      if (!abs || abs === u || seen.has(abs)) continue;
      if (!sameDomain(abs, domain)) continue;
      seen.add(abs);
      out++;
      if (set.has(abs)) inbound.set(abs, inbound.get(abs) + 1);
    }
    outbound.set(u, out);
  }

  let orphans = 0, pillars = 0;
  const now = new Date().toISOString();
  const graphRows = [];
  const orphanQueue = [];
  for (const u of urls) {
    const inb = inbound.get(u);
    const oub = outbound.get(u);
    const isOrphan = inb === 0;
    const isPillar = inb >= PILLAR_MIN_INBOUND;
    if (isOrphan) orphans++;
    if (isPillar) pillars++;

    graphRows.push({ url: u, inbound: inb, outbound: oub, is_orphan: isOrphan, is_pillar: isPillar, updated_at: now });
    // orphans need inbound links → queue a graph fix
    if (isOrphan) {
      orphanQueue.push({ url: u, task: "internal-link-graph", risk_class: "safe", priority: 4, source: "sitemap", status: "pending" });
    }
  }

  if (graphRows.length) await db.from("link_graph").upsert(graphRows, { onConflict: "url" });
  if (orphanQueue.length) {
    // Route orphan fixes through the queue seam — do_not_touch filter + validation + dedup
    // upsert (the same guards every other sensor uses) — instead of a raw insert that bypassed
    // them (a protected URL could be enqueued, and a re-run hit the unique constraint).
    const skip = await doNotTouch();
    await enqueue(orphanQueue.filter((it) => !skip.has(it.url)));
  }

  console.log(`[link-graph] pages=${urls.length} orphans=${orphans} pillars=${pillars}`);
}

run().catch((e) => { console.error(e); process.exit(1); });
