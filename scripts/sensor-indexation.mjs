#!/usr/bin/env node
// sensor-indexation.mjs — inspects tracked URLs via the GSC URL Inspection API and
// enqueues any that are no longer indexed. Capped at INDEXATION_LIMIT per run to stay
// within the 2,000 requests/day/property quota.
import { google } from "googleapis";
import { db, enqueue, doNotTouch } from "../orchestrator/lib/supabase.mjs";

const SITE  = process.env.GSC_SITE_URL;
const LIMIT = Number(process.env.INDEXATION_LIMIT || 50);
if (!SITE) throw new Error("Set GSC_SITE_URL (e.g. sc-domain:example.com)");

const day = (n) => new Date(Date.now() - n * 864e5).toISOString();

async function activeUrls(limit) {
  const { data } = await db.from("outcomes")
    .select("url")
    .eq("metric", "clicks")
    .gte("captured_at", day(28))
    .order("value", { ascending: false })
    .limit(limit);
  // deduplicate — a URL may appear multiple times across snapshots
  return [...new Set((data ?? []).map((r) => r.url))];
}

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });
  const sc = google.searchconsole({ version: "v1", auth });
  const skip = await doNotTouch();
  const urls = await activeUrls(LIMIT);
  const items = [];

  for (const url of urls) {
    if (skip.has(url)) continue;
    try {
      const { data } = await sc.urlInspection.index.inspect({
        requestBody: { siteUrl: SITE, inspectionUrl: url },
      });
      const verdict = data?.inspectionResult?.indexStatusResult?.verdict;
      if (verdict && verdict !== "PASS") {
        const coverage = data?.inspectionResult?.indexStatusResult?.coverageState ?? verdict;
        console.log(`not indexed: ${url} (${coverage})`);
        items.push({ url, task: "seo-audit", risk_class: "safe", priority: 4,
          source: "indexation", status: "pending" });
      }
    } catch (e) {
      // single-URL failure should not abort the whole run
      console.warn(`indexation check failed for ${url}: ${e.message}`);
    }
  }

  await enqueue(items);
  console.log(`indexation sensor: checked ${urls.length} URLs, enqueued ${items.length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
