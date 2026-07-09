#!/usr/bin/env node
// collect-outcomes.mjs — weekly snapshot of per-URL performance into `outcomes`.
// Sources:
//   GSC (always)     — clicks, impressions, position via orchestrator/lib/gsc.mjs
//   GA4 (if GA4_PROPERTY_ID set) — organic_conversions, organic_sessions (organic-search sessions only) via Data API v1beta
//   CITATIONS_CSV    — optional flat file (url,citations)
//   CONVERSIONS_CSV  — optional flat file fallback when GA4 not configured
import { google } from "googleapis";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { recordOutcomes } from "../orchestrator/lib/supabase.mjs";
import { searchConsole, queryAnalytics } from "../orchestrator/lib/gsc.mjs";

const GSC_SITE = process.env.GSC_SITE_URL;

function readCsv(path, metric) {
  if (!path || !existsSync(path)) return [];
  return readFileSync(path, "utf8").trim().split("\n").slice(1)
    .map((l) => l.split(","))
    .filter((c) => c[0] && c[1] !== undefined)
    .map(([url, v]) => ({ url: url.trim(), metric, value: Number(v) }));
}

async function collectGsc() {
  if (!GSC_SITE) throw new Error("Set GSC_SITE_URL");
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

// Pure: map a GA4 runReport response into `outcomes` rows. Exported for unit testing.
// `landingPage` is a path; `siteUrl` (trailing slash stripped) + path = the full URL the
// attribution join keys on. Metrics are namespaced `organic_*` so they never collide with
// the AI-referral collector's `ai_conversions` on the same free-text `outcomes.metric`.
//
// GA4 emits non-trailing-slash paths ("/foo") plus query/fragment variants, but every other
// producer (decision_log.url, GSC-form outcomes.url) uses the trailing-slash canonical
// ("/foo/") and metricAround joins with exact .eq("url", url) — so paths must be
// canonicalized here or interior-page conversions silently never match.
function canonicalGa4Path(path) {
  if (!path || path === "(not set)") return null;
  let p = path.split(/[?#]/)[0];
  if (!p.startsWith("/")) p = "/" + p;
  if (!p.endsWith("/")) p += "/";
  return p;
}

export function mapGa4Rows(data, siteUrl) {
  // Aggregate by canonical URL: query-param variants of one page collapse into a single
  // (url, metric) row — duplicate rows would make metricAround's latest-row read nondeterministic.
  const byUrl = new Map();
  for (const r of data?.rows ?? []) {
    const path = canonicalGa4Path(r.dimensionValues[0].value);
    if (!path) continue;
    const url  = siteUrl + path;
    const conv = Number(r.metricValues[0].value ?? 0);
    const sess = Number(r.metricValues[1].value ?? 0);
    // One NaN would poison the whole URL's accumulator and silently drop valid sibling
    // variants — skip the malformed row loudly instead.
    if (!Number.isFinite(conv) || !Number.isFinite(sess)) {
      console.warn(`GA4: non-numeric metric value for landingPage="${r.dimensionValues[0].value}" — skipping row`);
      continue;
    }
    const agg = byUrl.get(url) ?? { conversions: 0, sessions: 0 };
    byUrl.set(url, { conversions: agg.conversions + conv, sessions: agg.sessions + sess });
  }
  const rows = [];
  for (const [url, { conversions, sessions }] of byUrl) {
    if (conversions > 0) rows.push({ url, metric: "organic_conversions", value: conversions });
    if (sessions    > 0) rows.push({ url, metric: "organic_sessions",    value: sessions    });
  }
  return rows;
}

// GA4 is a separate API surface (analytics.readonly) — it keeps its own auth/client here
// rather than going through the GSC reader.
async function collectGa4() {
  const propertyId = process.env.GA4_PROPERTY_ID;
  const siteUrl    = process.env.SITE_URL?.replace(/\/$/, "");
  if (!propertyId) return [];
  if (!siteUrl) throw new Error("GA4_PROPERTY_ID is set but SITE_URL is missing — needed to construct full URLs from GA4 landingPage paths");

  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
  });
  const analyticsdata = google.analyticsdata({ version: "v1beta", auth });
  const { data } = await analyticsdata.properties.runReport({
    property: `properties/${propertyId}`,
    requestBody: {
      dateRanges: [{ startDate: "28daysAgo", endDate: "yesterday" }],
      dimensions: [{ name: "landingPage" }],
      metrics:    [{ name: "conversions" }, { name: "sessions" }],
      // Organic-search sessions only: this is SEO attribution, not all-channel. Without this
      // filter the counts include paid/direct/social and can't be joined to an SEO change.
      dimensionFilter: {
        filter: {
          fieldName: "sessionDefaultChannelGroup",
          stringFilter: { matchType: "EXACT", value: "Organic Search" },
        },
      },
      limit: 5000,
    },
  });

  const rows = mapGa4Rows(data, siteUrl);
  const pages = data.rows?.length ?? 0;
  console.log(`GA4: ${pages} organic landing pages (${rows.length} non-zero metric rows)`);
  // A silent zero here (wrong filter value, or a property migrated from `conversions` to
  // `keyEvents`) would quietly defeat conversion attribution — surface it, don't swallow it.
  if (pages === 0) console.warn("GA4: 0 organic rows — verify the property serves `conversions` and the 'Organic Search' channel-group filter.");
  return rows;
}

async function main() {
  const [gscRows, ga4Rows] = await Promise.all([collectGsc(), collectGa4()]);

  const rows = [
    ...gscRows,
    ...ga4Rows,
    ...readCsv(process.env.CITATIONS_CSV, "citations"),
    // CONVERSIONS_CSV is the flat-file fallback; skip if GA4 is active
    ...(process.env.GA4_PROPERTY_ID ? [] : readCsv(process.env.CONVERSIONS_CSV, "organic_conversions")),
  ];

  await recordOutcomes(rows);
  console.log(`recorded ${rows.length} total outcome rows`);
}

// Guard the auto-run so tests can import the pure `mapGa4Rows` without executing main().
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
