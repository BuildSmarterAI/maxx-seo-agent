#!/usr/bin/env node
// sensor-sitemap.mjs — sitemap sensor config + entry point.
// fetch() handles sitemap_seen state (sensor-specific) via the memory module;
// doNotTouch filtering is owned by the harness.
import { fileURLToPath } from "node:url";
import { sitemapSeen, markSitemapSeen } from "../orchestrator/lib/supabase.mjs";
import { runSensor } from "../orchestrator/lib/sensor.mjs";

export function extractUrls(xml) {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
}

const isSitemap = (u) => /\.xml(\?|#|$)/i.test(u);

// Expand a sitemap or sitemap-index into actual PAGE urls. A sitemap index's
// <loc> entries are child sitemaps (*.xml), not pages — without recursing we'd
// enqueue the .xml files themselves (the cause of the sitemap-audit noise).
// Recurse one level into child sitemaps and keep only non-sitemap urls.
// fetchText is injectable so the recursion is testable without the network.
export async function collectPageUrls(rootUrl, fetchText = (u) => fetch(u).then((r) => r.text())) {
  const locs = extractUrls(await fetchText(rootUrl));
  const pages = locs.filter((u) => !isSitemap(u));
  for (const child of locs.filter(isSitemap)) {
    try {
      pages.push(...extractUrls(await fetchText(child)).filter((u) => !isSitemap(u)));
    } catch (e) {
      console.error(`[sitemap] failed to fetch child sitemap ${child}: ${e.message}`);
    }
  }
  return [...new Set(pages)];
}

export const sitemapSensor = {
  name: "sitemap",
  thresholds: {
    "new-url": { task: "seo-audit", priority: 1 },
  },

  async fetch(env) {
    const { SITEMAP_URL } = env;
    if (!SITEMAP_URL) throw new Error("Set SITEMAP_URL");

    const urls = await collectPageUrls(SITEMAP_URL);
    const seen = await sitemapSeen();
    const fresh = urls.filter((u) => !seen.has(u));

    if (fresh.length) await markSitemapSeen(fresh);

    console.log(`[sitemap] ${urls.length} page urls, ${fresh.length} new`);
    return fresh.map((url) => ({ url, signalType: "new-url", value: 1 }));
  },
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { error } = await runSensor(sitemapSensor, process.env);
  if (error) process.exit(1);
}
