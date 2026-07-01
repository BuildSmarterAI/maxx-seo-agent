#!/usr/bin/env node
// sensor-indexation.mjs — indexation sensor config + entry point.
// Inspects tracked URLs via GSC URL Inspection (hidden behind orchestrator/lib/gsc.mjs);
// enqueues any not indexed. Capped at thresholds["not-indexed"].limit per run to stay
// within the 2,000 requests/day/property quota.
import { activeUrls } from "../orchestrator/lib/supabase.mjs";
import { searchConsole, inspectUrl } from "../orchestrator/lib/gsc.mjs";
import { runSensor } from "../orchestrator/lib/sensor.mjs";

export const indexationSensor = {
  name: "indexation",
  thresholds: {
    "not-indexed": { limit: 50, task: "seo-audit", priority: 4 },
  },

  async fetch(env, thresholds) {
    const { GSC_SITE_URL, GOOGLE_APPLICATION_CREDENTIALS, INDEXATION_LIMIT } = env;
    if (!GSC_SITE_URL) throw new Error("Set GSC_SITE_URL (e.g. sc-domain:maxxbuilders.com)");

    const limit = Number(INDEXATION_LIMIT || thresholds["not-indexed"].limit);
    const sc = searchConsole(GOOGLE_APPLICATION_CREDENTIALS);
    const urls = await activeUrls(limit);
    const items = [];

    for (const url of urls) {
      try {
        const result = await inspectUrl(sc, { siteUrl: GSC_SITE_URL, url });
        const verdict = result.verdict;
        if (verdict && verdict !== "PASS") {
          const coverage = result.coverageState ?? verdict;
          console.log(`not indexed: ${url} (${coverage})`);
          items.push({ url, signalType: "not-indexed", value: 1 });
        }
      } catch (e) {
        console.warn(`indexation check failed for ${url}: ${e.message}`);
      }
    }

    return items;
  },
};

const { error } = await runSensor(indexationSensor, process.env);
if (error) process.exit(1);
