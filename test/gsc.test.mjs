// test/gsc.test.mjs — the GSC reader seam: date math + Search Console client +
// search-analytics query + URL-inspection, all hiding the googleapis wire shape.
// queryAnalytics/inspectUrl take an injected client so the network is never touched.
//
// gsc.mjs imports only googleapis (no Supabase), so no env shim is needed.
// Run: node --test
import { test } from "node:test";
import assert from "node:assert/strict";

import { daysAgo, searchConsole, queryAnalytics, inspectUrl, withRetry } from "../orchestrator/lib/gsc.mjs";

// helper: build a GaxiosError-shaped object carrying the HTTP status in one of the
// three places googleapis surfaces it (top-level code, response.status, or status).
const httpError = (status, where = "code") =>
  where === "response" ? Object.assign(new Error(`http ${status}`), { response: { status } })
                       : Object.assign(new Error(`http ${status}`), { [where]: status });

test("daysAgo formats YYYY-MM-DD and counts back from an injected clock", () => {
  const now = Date.parse("2026-06-27T12:00:00Z");
  assert.equal(daysAgo(0, now), "2026-06-27");
  assert.equal(daysAgo(1, now), "2026-06-26");
  assert.equal(daysAgo(28, now), "2026-05-30");
});

test("searchConsole builds a Search Console v1 client (lazy auth, no creds needed)", () => {
  const sc = searchConsole("/nonexistent.json");
  assert.equal(typeof sc.searchanalytics.query, "function");
  assert.equal(typeof sc.urlInspection.index.inspect, "function");
});

test("queryAnalytics sends the exact date window + dimensions and returns rows (null-safe)", async () => {
  const seen = [];
  const client = { searchanalytics: { query: async (req) => { seen.push(req); return { data: { rows: [{ keys: ["/a"], clicks: 3 }] } }; } } };
  const now = Date.parse("2026-06-27T12:00:00Z");
  const rows = await queryAnalytics(client, { siteUrl: "sc-domain:x", startDaysAgo: 28, endDaysAgo: 1, dimensions: ["page"], now });
  assert.deepEqual(rows, [{ keys: ["/a"], clicks: 3 }]);
  assert.equal(seen[0].siteUrl, "sc-domain:x");
  assert.deepEqual(seen[0].requestBody.dimensions, ["page"]);
  assert.equal(seen[0].requestBody.rowLimit, 5000);         // default preserved
  assert.equal(seen[0].requestBody.startDate, "2026-05-30"); // 28 days before the injected clock
  assert.equal(seen[0].requestBody.endDate, "2026-06-26");   // 1 day before
});

test("queryAnalytics forwards a custom rowLimit", async () => {
  const seen = [];
  const client = { searchanalytics: { query: async (req) => { seen.push(req); return { data: { rows: [] } }; } } };
  await queryAnalytics(client, { siteUrl: "x", startDaysAgo: 1, endDaysAgo: 1, dimensions: ["page"], rowLimit: 100 });
  assert.equal(seen[0].requestBody.rowLimit, 100);
});

test("queryAnalytics returns [] when the response carries no rows", async () => {
  const client = { searchanalytics: { query: async () => ({ data: {} }) } };
  assert.deepEqual(await queryAnalytics(client, { siteUrl: "x", startDaysAgo: 1, endDaysAgo: 1, dimensions: ["page"] }), []);
});

test("queryAnalytics pages with startRow until a short page and concatenates all rows", async () => {
  const seen = [];
  // page size 2: first page is full (2 rows) → keep going; second page is short (1 row) → stop.
  const pages = [[{ keys: ["/a"] }, { keys: ["/b"] }], [{ keys: ["/c"] }]];
  const client = { searchanalytics: { query: async (req) => { seen.push(req); return { data: { rows: pages[req.requestBody.startRow / 2] } }; } } };
  const rows = await queryAnalytics(client, { siteUrl: "x", startDaysAgo: 1, endDaysAgo: 1, dimensions: ["page"], rowLimit: 2 });
  assert.deepEqual(rows, [{ keys: ["/a"] }, { keys: ["/b"] }, { keys: ["/c"] }]);
  assert.equal(seen.length, 2);
  assert.equal(seen[0].requestBody.startRow, 0);
  assert.equal(seen[1].requestBody.startRow, 2);
});

test("queryAnalytics stops after one page when the first page is already short", async () => {
  const seen = [];
  const client = { searchanalytics: { query: async (req) => { seen.push(req); return { data: { rows: [{ keys: ["/a"] }] } }; } } };
  const rows = await queryAnalytics(client, { siteUrl: "x", startDaysAgo: 1, endDaysAgo: 1, dimensions: ["page"], rowLimit: 5000 });
  assert.deepEqual(rows, [{ keys: ["/a"] }]);
  assert.equal(seen.length, 1);
});

test("queryAnalytics stops when an exactly-full page is followed by an empty page", async () => {
  const seen = [];
  // boundary: a page exactly fills rowLimit, so we must request once more; the next page is empty → stop.
  const pages = [[{ keys: ["/a"] }, { keys: ["/b"] }], []];
  const client = { searchanalytics: { query: async (req) => { seen.push(req); return { data: { rows: pages[req.requestBody.startRow / 2] ?? [] } }; } } };
  const rows = await queryAnalytics(client, { siteUrl: "x", startDaysAgo: 1, endDaysAgo: 1, dimensions: ["page"], rowLimit: 2 });
  assert.deepEqual(rows, [{ keys: ["/a"] }, { keys: ["/b"] }]);
  assert.equal(seen.length, 2);
});

test("inspectUrl spreads indexStatusResult (+ richResults) and passes the inspection target", async () => {
  const seen = [];
  const client = { urlInspection: { index: { inspect: async (req) => { seen.push(req); return { data: { inspectionResult: { indexStatusResult: { verdict: "PASS", coverageState: "Indexed" } } } }; } } } };
  const r = await inspectUrl(client, { siteUrl: "sc-domain:x", url: "https://x/a" });
  assert.deepEqual(r, { verdict: "PASS", coverageState: "Indexed", richResults: {} });
  assert.equal(seen[0].requestBody.siteUrl, "sc-domain:x");
  assert.equal(seen[0].requestBody.inspectionUrl, "https://x/a");
});

test("inspectUrl surfaces richResults and keeps index fields (incl. canonicals) top-level", async () => {
  const client = { urlInspection: { index: { inspect: async () => ({ data: { inspectionResult: {
    indexStatusResult: { verdict: "PASS", coverageState: "Indexed", googleCanonical: "https://x/a", userCanonical: "https://x/a" },
    richResultsResult: { verdict: "PASS", detectedItems: [{ richResultType: "FAQ" }] },
  } } }) } } };
  const r = await inspectUrl(client, { siteUrl: "sc-domain:x", url: "https://x/a" });
  assert.equal(r.verdict, "PASS");
  assert.equal(r.coverageState, "Indexed");
  assert.equal(r.googleCanonical, "https://x/a");   // canonical-divergence signal stays top-level
  assert.equal(r.userCanonical, "https://x/a");
  assert.deepEqual(r.richResults, { verdict: "PASS", detectedItems: [{ richResultType: "FAQ" }] });
});

test("inspectUrl returns only { richResults: {} } when the result nesting is absent", async () => {
  const client = { urlInspection: { index: { inspect: async () => ({ data: {} }) } } };
  assert.deepEqual(await inspectUrl(client, { siteUrl: "x", url: "y" }), { richResults: {} });
});

test("withRetry returns the result on first success without sleeping", async () => {
  let sleeps = 0;
  const r = await withRetry(async () => "ok", { sleep: async () => { sleeps++; } });
  assert.equal(r, "ok");
  assert.equal(sleeps, 0);
});

test("withRetry retries a 429 then succeeds, sleeping between attempts", async () => {
  let attempts = 0;
  const sleptOn = [];
  const r = await withRetry(async () => { attempts++; if (attempts < 3) throw httpError(429); return "ok"; },
    { retries: 3, sleep: async (n) => { sleptOn.push(n); } });
  assert.equal(r, "ok");
  assert.equal(attempts, 3);
  assert.deepEqual(sleptOn, [0, 1]); // slept before retry #1 and #2, not after the success
});

test("withRetry retries a 5xx (response.status) then succeeds", async () => {
  let attempts = 0;
  const r = await withRetry(async () => { attempts++; if (attempts < 2) throw httpError(503, "response"); return "ok"; },
    { retries: 3, sleep: async () => {} });
  assert.equal(r, "ok");
  assert.equal(attempts, 2);
});

test("withRetry rethrows a non-retryable status immediately without sleeping", async () => {
  let attempts = 0, sleeps = 0;
  await assert.rejects(
    () => withRetry(async () => { attempts++; throw httpError(403); }, { retries: 3, sleep: async () => { sleeps++; } }),
    /http 403/);
  assert.equal(attempts, 1);
  assert.equal(sleeps, 0);
});

test("withRetry gives up after exhausting retries and rethrows the last error", async () => {
  let attempts = 0;
  await assert.rejects(
    () => withRetry(async () => { attempts++; throw httpError(429); }, { retries: 2, sleep: async () => {} }),
    /http 429/);
  assert.equal(attempts, 3); // initial try + 2 retries
});

test("queryAnalytics retries a transient page failure then returns the rows", async () => {
  let calls = 0;
  const client = { searchanalytics: { query: async () => { calls++; if (calls === 1) throw httpError(429); return { data: { rows: [{ keys: ["/a"] }] } }; } } };
  const rows = await queryAnalytics(client, { siteUrl: "x", startDaysAgo: 1, endDaysAgo: 1, dimensions: ["page"], retries: 3, sleep: async () => {} });
  assert.deepEqual(rows, [{ keys: ["/a"] }]);
  assert.equal(calls, 2);
});

test("inspectUrl retries a transient failure then returns the index status", async () => {
  let calls = 0;
  const client = { urlInspection: { index: { inspect: async () => { calls++; if (calls === 1) throw httpError(503, "response"); return { data: { inspectionResult: { indexStatusResult: { verdict: "PASS" } } } }; } } } };
  const r = await inspectUrl(client, { siteUrl: "x", url: "y", retries: 3, sleep: async () => {} });
  assert.deepEqual(r, { verdict: "PASS", richResults: {} });
  assert.equal(calls, 2);
});
