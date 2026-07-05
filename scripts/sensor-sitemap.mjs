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

// SSRF guard (A10): a child <loc> entry is content living INSIDE the fetched XML —
// effectively attacker-influenced if the sitemap is ever compromised or proxied. Only
// follow it if it's http(s) and on the exact same host as the root sitemap; anything else
// (a cloud metadata IP, a file:// URL, a different host) is refused, never fetched.
function isSafeChildSitemapUrl(childUrl, rootUrl) {
  let child, root;
  try {
    child = new URL(childUrl);
    root = new URL(rootUrl);
  } catch {
    return false;
  }
  if (child.protocol !== "http:" && child.protocol !== "https:") return false;
  return child.hostname.toLowerCase() === root.hostname.toLowerCase();
}

// The hostname allowlist above only inspects the pre-fetch URL string — fetch() follows
// redirects by default, so a same-host URL that redirects to an off-host/internal target
// would defeat the guard entirely. Child fetches refuse to follow any redirect at all
// (redirect: "error" throws, caught by the existing per-child try/catch below) rather than
// silently trusting wherever the response points. The root fetch (a trusted, operator-set
// SITEMAP_URL) keeps default redirect behavior — a legitimate http->https or canonical-path
// redirect on the root sitemap must not break the sensor.
async function defaultFetchText(url, isChild = false) {
  const res = await fetch(url, isChild ? { redirect: "error" } : undefined);
  return res.text();
}

// Expand a sitemap or sitemap-index into actual PAGE urls. A sitemap index's
// <loc> entries are child sitemaps (*.xml), not pages — without recursing we'd
// enqueue the .xml files themselves (the cause of the sitemap-audit noise).
// Recurse one level into child sitemaps and keep only non-sitemap urls.
// fetchText is injectable so the recursion is testable without the network.
export async function collectPageUrls(rootUrl, fetchText = defaultFetchText) {
  const locs = extractUrls(await fetchText(rootUrl));
  const pages = locs.filter((u) => !isSitemap(u));
  for (const child of locs.filter(isSitemap)) {
    if (!isSafeChildSitemapUrl(child, rootUrl)) {
      console.error(`[sitemap] refusing to fetch child sitemap off-host/off-scheme: ${child}`);
      continue;
    }
    try {
      pages.push(...extractUrls(await fetchText(child, true)).filter((u) => !isSitemap(u)));
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
