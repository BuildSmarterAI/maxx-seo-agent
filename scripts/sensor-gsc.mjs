#!/usr/bin/env node
// sensor-gsc.mjs — GSC sensor config + entry point.
// Fetch logic lives here; harness (orchestrator/lib/sensor.mjs) owns doNotTouch filtering,
// queue mapping, enqueue, and error isolation.
import { fileURLToPath } from "node:url";
import { google } from "googleapis";
import { runSensor } from "../orchestrator/lib/sensor.mjs";

// The decay signal maps to blog-write, which is meaningless on the site root —
// the homepage is never a blog post. Skip it so it stops escalating as blog-write.
export const isHomepage = (u) => { try { return new URL(u).pathname === "/"; } catch { return false; } };

function range(daysAgoStart, daysAgoEnd) {
  const d = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
  return { startDate: d(daysAgoStart), endDate: d(daysAgoEnd) };
}

async function pageClicks(sc, siteUrl, r) {
  const { data } = await sc.searchanalytics.query({
    siteUrl,
    requestBody: { ...r, dimensions: ["page"], rowLimit: 5000 },
  });
  return new Map((data.rows ?? []).map((row) => [row.keys[0], row.clicks ?? 0]));
}

export const gscSensor = {
  name: "gsc",
  // thresholds — keep numeric limits in sync with CLAUDE.md CWV/content thresholds.
  // task + priority here are policy: which skill runs and how urgently.
  thresholds: {
    decay: {
      minDrop: 0.25, minPrevClicks: 10,
      task: "blog-write", priority: 3,
    },
    "striking-distance": {
      posMin: 5, posMax: 20, minImpressions: 50,
      task: "metadata-generate", priority: 2,
    },
  },

  async fetch(env, thresholds) {
    const { GSC_SITE_URL, GOOGLE_APPLICATION_CREDENTIALS } = env;
    if (!GSC_SITE_URL) throw new Error("Set GSC_SITE_URL (e.g. sc-domain:maxxbuilders.com)");

    const auth = new google.auth.GoogleAuth({
      keyFile: GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
    });
    const sc = google.searchconsole({ version: "v1", auth });
    const items = [];

    // 1) Decay: pages with ≥minDrop% click drop vs prior 28d
    const { minDrop, minPrevClicks } = thresholds.decay;
    const cur  = await pageClicks(sc, GSC_SITE_URL, range(28, 1));
    const prev = await pageClicks(sc, GSC_SITE_URL, range(56, 29));
    for (const [page, clicksPrev] of prev) {
      if (clicksPrev < minPrevClicks) continue;
      const drop = (clicksPrev - (cur.get(page) ?? 0)) / clicksPrev;
      if (drop >= minDrop && !isHomepage(page)) items.push({ url: page, signalType: "decay", value: drop });
    }

    // 2) Striking distance: position in band with sufficient impressions
    const { posMin, posMax, minImpressions } = thresholds["striking-distance"];
    const { data } = await sc.searchanalytics.query({
      siteUrl: GSC_SITE_URL,
      requestBody: { ...range(28, 1), dimensions: ["page", "query"], rowLimit: 5000 },
    });
    for (const row of data.rows ?? []) {
      const [page, query] = row.keys;
      if (row.position >= posMin && row.position <= posMax && (row.impressions ?? 0) >= minImpressions) {
        items.push({ url: page, signalType: "striking-distance", value: row.impressions, query });
      }
    }

    return items;
  },
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { error } = await runSensor(gscSensor, process.env);
  if (error) process.exit(1);
}
