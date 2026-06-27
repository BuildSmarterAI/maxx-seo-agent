#!/usr/bin/env node
// collect-outcomes.mjs — weekly snapshot of per-URL performance into `outcomes`.
// Sources:
//   GSC (always)     — clicks, impressions, position via orchestrator/lib/gsc.mjs
//   GA4 (if GA4_PROPERTY_ID set) — conversions, sessions via Data API v1beta
//   CITATIONS_CSV    — optional flat file (url,citations)
//   CONVERSIONS_CSV  — optional flat file fallback when GA4 not configured
import { google } from "googleapis";
import { readFileSync, existsSync } from "node:fs";
import { recordOutcomes } from "../orchestrator/lib/supabase.mjs";
import { searchConsole, queryAnalytics } from "../orchestrator/lib/gsc.mjs";

const GSC_SITE = process.env.GSC_SITE_URL;
if (!GSC_SITE) throw new Error("Set GSC_SITE_URL");

function readCsv(path, metric) {
  if (!path || !existsSync(path)) return [];
  return readFileSync(path, "utf8").trim().split("\n").slice(1)
    .map((l) => l.split(","))
    .filter((c) => c[0] && c[1] !== undefined)
    .map(([url, v]) => ({ url: url.trim(), metric, value: Number(v) }));
}

async function collectGsc() {
  const sc = searchConsole(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  const gscRows = await queryAnalytics(sc, { siteUrl: GSC_SITE, startDaysAgo: 28, endDaysAgo: 1, dimensions: ["page"] });
  const rows = [];
  for (const r of gscRows) {
    const url = r.keys[0];
    rows.push({ url, metric: "clicks",      value: r.clicks      ?? 0    });
    rows.push({ url, metric: "impressions", value: r.impressions  ?? 0    });
    rows.push({ url, metric: "position",    value: r.position     ?? null });
  }
  console.log(`GSC: ${gscRows.length} URLs`);
  return rows;
}

// GA4 is a separate API surface (analytics.readonly) — it keeps its own auth/client here
// rather than going through the GSC reader.
async function collectGa4() {
  const propertyId = process.env.GA4_PROPERTY_ID;
  const siteUrl    = process.env.SITE_URL?.replace(/\/$/, "");
  if (!propertyId) return [];
  if (!siteUrl) throw new Error("GA4_PROPERTY_ID is set but SITE_URL is missing — needed to construct full URLs from GA4 pagePaths");

  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
  });
  const analyticsdata = google.analyticsdata({ version: "v1beta", auth });
  const { data } = await analyticsdata.properties.runReport({
    property: `properties/${propertyId}`,
    requestBody: {
      dateRanges: [{ startDate: "28daysAgo", endDate: "yesterday" }],
      dimensions: [{ name: "pagePath" }],
      metrics:    [{ name: "conversions" }, { name: "sessions" }],
      limit: 5000,
    },
  });

  const rows = [];
  for (const r of data.rows ?? []) {
    const url         = siteUrl + r.dimensionValues[0].value;
    const conversions = Number(r.metricValues[0].value ?? 0);
    const sessions    = Number(r.metricValues[1].value ?? 0);
    if (conversions > 0) rows.push({ url, metric: "conversions", value: conversions });
    if (sessions    > 0) rows.push({ url, metric: "sessions",    value: sessions    });
  }
  console.log(`GA4: ${data.rows?.length ?? 0} URLs (${rows.length} non-zero metric rows)`);
  return rows;
}

async function main() {
  const [gscRows, ga4Rows] = await Promise.all([collectGsc(), collectGa4()]);

  const rows = [
    ...gscRows,
    ...ga4Rows,
    ...readCsv(process.env.CITATIONS_CSV, "citations"),
    // CONVERSIONS_CSV is the flat-file fallback; skip if GA4 is active
    ...(process.env.GA4_PROPERTY_ID ? [] : readCsv(process.env.CONVERSIONS_CSV, "conversions")),
  ];

  await recordOutcomes(rows);
  console.log(`recorded ${rows.length} total outcome rows`);
}

main().catch((e) => { console.error(e); process.exit(1); });
