// test/gsc.test.mjs — the GSC reader seam: date math + Search Console client +
// search-analytics query + URL-inspection, all hiding the googleapis wire shape.
// queryAnalytics/inspectUrl take an injected client so the network is never touched.
//
// gsc.mjs imports only googleapis (no Supabase), so no env shim is needed.
// Run: node --test
import { test } from "node:test";
import assert from "node:assert/strict";

import { daysAgo, searchConsole, queryAnalytics, inspectUrl } from "../orchestrator/lib/gsc.mjs";

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

test("inspectUrl unwraps indexStatusResult and passes the inspection target", async () => {
  const seen = [];
  const client = { urlInspection: { index: { inspect: async (req) => { seen.push(req); return { data: { inspectionResult: { indexStatusResult: { verdict: "PASS", coverageState: "Indexed" } } } }; } } } };
  const r = await inspectUrl(client, { siteUrl: "sc-domain:x", url: "https://x/a" });
  assert.deepEqual(r, { verdict: "PASS", coverageState: "Indexed" });
  assert.equal(seen[0].requestBody.siteUrl, "sc-domain:x");
  assert.equal(seen[0].requestBody.inspectionUrl, "https://x/a");
});

test("inspectUrl returns {} when the result nesting is absent", async () => {
  const client = { urlInspection: { index: { inspect: async () => ({ data: {} }) } } };
  assert.deepEqual(await inspectUrl(client, { siteUrl: "x", url: "y" }), {});
});
