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

// Transient GSC failures worth retrying: 429 rate-limit and 5xx. googleapis surfaces
// the HTTP status on .code, .response.status, or .status depending on the failure path.
function isRetryable(e) {
  const status = Number(e?.code ?? e?.response?.status ?? e?.status);
  return status === 429 || (status >= 500 && status < 600);
}

// Exponential backoff: 0.5s, 1s, 2s, … Replaced by an instant stub in tests via `sleep`.
const backoff = (attempt) => new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 500));

// Run `fn`, retrying transient failures up to `retries` times. Non-retryable errors
// (auth, bad request) propagate on the first throw. `sleep(attempt)` is injectable so
// callers/tests stay deterministic and never wait on a real timer.
export async function withRetry(fn, { retries = 3, sleep = backoff } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= retries || !isRetryable(e)) throw e;
      await sleep(attempt);
    }
  }
}

// Run a Search Analytics query over a trailing window; returns ALL rows (null-safe).
// `rowLimit` is the page size (GSC caps a single response at this many rows); we page
// through with startRow until a short/empty page, so callers above the cap aren't
// silently truncated. Each page is retried on transient failure. The caller owns
// row→item mapping (keys[0], clicks, position, …) — that is policy.
export async function queryAnalytics(client, { siteUrl, startDaysAgo, endDaysAgo, dimensions, rowLimit = 5000, now = Date.now(), retries, sleep }) {
  const startDate = daysAgo(startDaysAgo, now);
  const endDate = daysAgo(endDaysAgo, now);
  const all = [];
  for (let startRow = 0; ; startRow += rowLimit) {
    const { data } = await withRetry(
      () => client.searchanalytics.query({ siteUrl, requestBody: { startDate, endDate, dimensions, rowLimit, startRow } }),
      { retries, sleep },
    );
    const page = data.rows ?? [];
    all.push(...page);
    if (page.length < rowLimit) break;   // last page is short (or empty) → done
  }
  return all;
}

// Inspect one URL: spreads indexStatusResult so verdict/coverageState/googleCanonical/
// userCanonical stay top-level (the indexation sensor reads verdict/coverageState off the
// flat object), and adds `richResults` (richResultsResult) as a sibling for rich-result
// detection + canonical-divergence checks. Null-safe. Retries transient failures so a single
// quota blip doesn't drop a URL.
export async function inspectUrl(client, { siteUrl, url, retries, sleep }) {
  const { data } = await withRetry(
    () => client.urlInspection.index.inspect({ requestBody: { siteUrl, inspectionUrl: url } }),
    { retries, sleep },
  );
  const r = data?.inspectionResult ?? {};
  return { ...(r.indexStatusResult ?? {}), richResults: r.richResultsResult ?? {} };
}
