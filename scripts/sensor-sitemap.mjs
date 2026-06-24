#!/usr/bin/env node
// sensor-sitemap.mjs — fetches the sitemap, diffs against sitemap_seen,
// and enqueues newly-discovered URLs for an audit.
import { db, enqueue, doNotTouch } from "../orchestrator/lib/supabase.mjs";

const SITEMAP = process.env.SITEMAP_URL;     // e.g. https://example.com/sitemap.xml
if (!SITEMAP) throw new Error("Set SITEMAP_URL");

function extractUrls(xml) {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
}

async function main() {
  const xml = await (await fetch(SITEMAP)).text();
  const urls = extractUrls(xml);

  const { data: seenRows } = await db.from("sitemap_seen").select("url");
  const seen = new Set((seenRows ?? []).map((r) => r.url));
  const skip = await doNotTouch();

  const fresh = urls.filter((u) => !seen.has(u) && !skip.has(u));
  if (fresh.length) {
    await db.from("sitemap_seen").upsert(fresh.map((url) => ({ url })), { onConflict: "url", ignoreDuplicates: true });
    await enqueue(fresh.map((url) => ({
      url, task: "seo-audit", risk_class: "safe", priority: 1, source: "sitemap", status: "pending",
    })));
  }
  console.log(`sitemap: ${urls.length} total, ${fresh.length} new enqueued`);
}

main().catch((e) => { console.error(e); process.exit(1); });
