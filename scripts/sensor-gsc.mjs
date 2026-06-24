#!/usr/bin/env node
// sensor-gsc.mjs — pulls Search Console data, flags decay + striking-distance pages,
// and enqueues them. Run on a schedule (see .github/workflows/seo-sensors.yml).
import { google } from "googleapis";
import { enqueue, doNotTouch } from "../orchestrator/lib/supabase.mjs";

const SITE = process.env.GSC_SITE_URL;
if (!SITE) throw new Error("Set GSC_SITE_URL (e.g. sc-domain:example.com)");

// thresholds — keep in sync with core/CLAUDE.md
const DECAY_DROP = 0.25;            // ≥25% click drop vs prior period → refresh
const SD_MIN = 5, SD_MAX = 20;      // striking distance position band
const SD_MIN_IMPRESSIONS = 50;

function range(daysAgoStart, daysAgoEnd) {
  const d = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
  return { startDate: d(daysAgoStart), endDate: d(daysAgoEnd) };
}

async function pageClicks(sc, r) {
  const { data } = await sc.searchanalytics.query({
    siteUrl: SITE,
    requestBody: { ...r, dimensions: ["page"], rowLimit: 5000 },
  });
  return new Map((data.rows ?? []).map((row) => [row.keys[0], row.clicks ?? 0]));
}

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });
  const sc = google.searchconsole({ version: "v1", auth });
  const skip = await doNotTouch();
  const items = [];

  // 1) Decay: current 28d vs prior 28d
  const cur = await pageClicks(sc, range(28, 1));
  const prev = await pageClicks(sc, range(56, 29));
  for (const [page, clicksPrev] of prev) {
    if (skip.has(page) || clicksPrev < 10) continue;
    const clicksNow = cur.get(page) ?? 0;
    if ((clicksPrev - clicksNow) / clicksPrev >= DECAY_DROP) {
      items.push({ url: page, task: "blog-write", risk_class: "safe", priority: 3,
        source: "gsc", status: "pending" });   // refresh the decaying post
    }
  }

  // 2) Striking distance: page+query in the SD band with impressions but little reward
  const { data } = await sc.searchanalytics.query({
    siteUrl: SITE,
    requestBody: { ...range(28, 1), dimensions: ["page", "query"], rowLimit: 5000 },
  });
  for (const row of data.rows ?? []) {
    const [page] = row.keys;
    if (skip.has(page)) continue;
    if (row.position >= SD_MIN && row.position <= SD_MAX && (row.impressions ?? 0) >= SD_MIN_IMPRESSIONS) {
      items.push({ url: page, task: "metadata-generate", risk_class: "safe", priority: 2,
        source: "gsc", status: "pending" });
    }
  }

  await enqueue(items);
  console.log(`enqueued ${items.length} GSC items`);
}

main().catch((e) => { console.error(e); process.exit(1); });
