// gsc.mjs — the Google Search Console reader seam. Hides the googleapis auth/scope/
// client-version setup, the search-analytics + URL-inspection call shapes, the trailing-
// window date math, and the response null-safety behind a small interface. The sensing
// scripts and the outcome collector keep only their policy (thresholds, row mapping).
//
// Scope is GSC-only (webmasters.readonly). GA4 lives in a different API surface and
// stays in its caller (collect-outcomes builds its own analytics.readonly client).
import { google } from "googleapis";

// YYYY-MM-DD, n days before `now`. Clock is injectable so callers/tests are deterministic.
export function daysAgo(n, now = Date.now()) {
  return new Date(now - n * 864e5).toISOString().slice(0, 10);
}

// Authed Search Console v1 client. GoogleAuth is lazy — it reads the key file only on the
// first request, so constructing this without valid creds (e.g. in tests) does not throw.
export function searchConsole(keyFile) {
  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });
  return google.searchconsole({ version: "v1", auth });
}

// Run a Search Analytics query over a trailing window; returns the rows (null-safe).
// The caller owns row→item mapping (keys[0], clicks, position, …) — that is policy.
export async function queryAnalytics(client, { siteUrl, startDaysAgo, endDaysAgo, dimensions, rowLimit = 5000, now = Date.now() }) {
  const { data } = await client.searchanalytics.query({
    siteUrl,
    requestBody: { startDate: daysAgo(startDaysAgo, now), endDate: daysAgo(endDaysAgo, now), dimensions, rowLimit },
  });
  return data.rows ?? [];
}

// Inspect one URL's index status; returns the indexStatusResult object (null-safe → {}).
export async function inspectUrl(client, { siteUrl, url }) {
  const { data } = await client.urlInspection.index.inspect({
    requestBody: { siteUrl, inspectionUrl: url },
  });
  return data?.inspectionResult?.indexStatusResult ?? {};
}
