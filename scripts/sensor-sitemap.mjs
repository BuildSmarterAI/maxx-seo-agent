#!/usr/bin/env node
// sensor-sitemap.mjs — sitemap sensor config + entry point.
// fetch() handles sitemap_seen state (sensor-specific); doNotTouch filtering is
// owned by the harness. Note: db is used directly here for sitemap_seen because
// supabase.mjs does not yet expose a sitemap-seen helper (Candidate 1 follow-on).
import { db } from "../orchestrator/lib/supabase.mjs";
import { runSensor } from "../orchestrator/lib/sensor.mjs";

function extractUrls(xml) {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
}

export const sitemapSensor = {
  name: "sitemap",
  thresholds: {
    "new-url": { task: "seo-audit", priority: 1 },
  },

  async fetch(env, thresholds) {
    const { SITEMAP_URL } = env;
    if (!SITEMAP_URL) throw new Error("Set SITEMAP_URL");

    const xml = await (await fetch(SITEMAP_URL)).text();
    const urls = extractUrls(xml);

    const { data: seenRows } = await db.from("sitemap_seen").select("url");
    const seen = new Set((seenRows ?? []).map((r) => r.url));
    const fresh = urls.filter((u) => !seen.has(u));

    if (fresh.length) {
      await db.from("sitemap_seen").upsert(
        fresh.map((url) => ({ url })),
        { onConflict: "url", ignoreDuplicates: true }
      );
    }

    console.log(`[sitemap] ${urls.length} total, ${fresh.length} new`);
    return fresh.map((url) => ({ url, signalType: "new-url", value: 1 }));
  },
};

const { error } = await runSensor(sitemapSensor, process.env);
if (error) process.exit(1);
