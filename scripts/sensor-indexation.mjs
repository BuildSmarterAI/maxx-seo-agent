#!/usr/bin/env node
// sensor-indexation.mjs — indexation sensor config + entry point.
// Inspects tracked URLs via GSC URL Inspection API; enqueues any not indexed.
// Capped at thresholds["not-indexed"].limit per run to stay within the
// 2,000 requests/day/property quota.
import { google } from "googleapis";
import { activeUrls } from "../orchestrator/lib/supabase.mjs";
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
    const auth = new google.auth.GoogleAuth({
      keyFile: GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
    });
    const sc = google.searchconsole({ version: "v1", auth });
    const urls = await activeUrls(limit);
    const items = [];

    for (const url of urls) {
      try {
        const { data } = await sc.urlInspection.index.inspect({
          requestBody: { siteUrl: GSC_SITE_URL, inspectionUrl: url },
        });
        const verdict  = data?.inspectionResult?.indexStatusResult?.verdict;
        if (verdict && verdict !== "PASS") {
          const coverage = data?.inspectionResult?.indexStatusResult?.coverageState ?? verdict;
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
