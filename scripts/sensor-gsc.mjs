#!/usr/bin/env node
// sensor-gsc.mjs — GSC sensor config + entry point.
// Fetch logic lives here; the GSC wire shape (auth, query, dates) is hidden behind
// orchestrator/lib/gsc.mjs. The harness (orchestrator/lib/sensor.mjs) owns doNotTouch
// filtering, queue mapping, enqueue, and error isolation.
import { fileURLToPath } from "node:url";
import { searchConsole, queryAnalytics } from "../orchestrator/lib/gsc.mjs";
import { runSensor } from "../orchestrator/lib/sensor.mjs";

// The decay signal maps to blog-write, which is meaningless on the site root —
// the homepage is never a blog post. Skip it so it stops escalating as blog-write.
export const isHomepage = (u) => { try { return new URL(u).pathname === "/"; } catch { return false; } };

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

    const sc = searchConsole(GOOGLE_APPLICATION_CREDENTIALS);
    const items = [];

    // 1) Decay: pages with ≥minDrop% click drop vs prior 28d
    const { minDrop, minPrevClicks } = thresholds.decay;
    const curRows  = await queryAnalytics(sc, { siteUrl: GSC_SITE_URL, startDaysAgo: 28, endDaysAgo: 1,  dimensions: ["page"] });
    const prevRows = await queryAnalytics(sc, { siteUrl: GSC_SITE_URL, startDaysAgo: 56, endDaysAgo: 29, dimensions: ["page"] });
    const cur  = new Map(curRows.map((r) => [r.keys[0], r.clicks ?? 0]));
    const prev = new Map(prevRows.map((r) => [r.keys[0], r.clicks ?? 0]));
    for (const [page, clicksPrev] of prev) {
      if (clicksPrev < minPrevClicks) continue;
      const drop = (clicksPrev - (cur.get(page) ?? 0)) / clicksPrev;
      if (drop >= minDrop && !isHomepage(page)) items.push({ url: page, signalType: "decay", value: drop });
    }

    // 2) Striking distance: position in band with sufficient impressions
    const { posMin, posMax, minImpressions } = thresholds["striking-distance"];
    const rows = await queryAnalytics(sc, { siteUrl: GSC_SITE_URL, startDaysAgo: 28, endDaysAgo: 1, dimensions: ["page", "query"] });
    for (const row of rows) {
      const [page] = row.keys;
      if (row.position >= posMin && row.position <= posMax && (row.impressions ?? 0) >= minImpressions) {
        items.push({ url: page, signalType: "striking-distance", value: row.impressions });
      }
    }

    return items;
  },
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { error } = await runSensor(gscSensor, process.env);
  if (error) process.exit(1);
}
