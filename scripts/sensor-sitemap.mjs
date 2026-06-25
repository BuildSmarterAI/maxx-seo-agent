#!/usr/bin/env node
// sensor-sitemap.mjs — sitemap sensor config + entry point.
// fetch() handles sitemap_seen state (sensor-specific) via the memory module;
// doNotTouch filtering is owned by the harness.
import { sitemapSeen, markSitemapSeen } from "../orchestrator/lib/supabase.mjs";
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

    const seen = await sitemapSeen();
    const fresh = urls.filter((u) => !seen.has(u));

    if (fresh.length) await markSitemapSeen(fresh);

    console.log(`[sitemap] ${urls.length} total, ${fresh.length} new`);
    return fresh.map((url) => ({ url, signalType: "new-url", value: 1 }));
  },
};

const { error } = await runSensor(sitemapSensor, process.env);
if (error) process.exit(1);
