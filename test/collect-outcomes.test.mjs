// test/collect-outcomes.test.mjs — the GA4 → `outcomes` row mapper. Pure + exported, so the
// network and Supabase are never touched. collect-outcomes.mjs imports supabase.mjs (which
// needs SUPABASE_* at import) and guards its auto-run behind import.meta, so a dummy env plus
// a dynamic import loads the module without running main() or hitting the DB.
//
// Run: node --test
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.SUPABASE_URL ||= "https://x.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "dummy_service_role_key_000000";

const { mapGa4Rows } = await import("../scripts/collect-outcomes.mjs");

// GA4 runReport row shape: one landingPage dimension, [conversions, sessions] metrics (strings).
const ga4 = (path, conversions, sessions) => ({
  dimensionValues: [{ value: path }],
  metricValues: [{ value: String(conversions) }, { value: String(sessions) }],
});

test("mapGa4Rows builds full URLs (siteUrl + landingPage) and namespaces the organic metrics", () => {
  const rows = mapGa4Rows({ rows: [ga4("/cost-guide/", 3, 120)] }, "https://www.maxxbuilders.com");
  assert.deepEqual(rows, [
    { url: "https://www.maxxbuilders.com/cost-guide/", metric: "organic_conversions", value: 3 },
    { url: "https://www.maxxbuilders.com/cost-guide/", metric: "organic_sessions",    value: 120 },
  ]);
});

test("mapGa4Rows omits a metric whose value is zero (no empty-signal rows)", () => {
  const rows = mapGa4Rows({ rows: [ga4("/a/", 0, 50), ga4("/b/", 2, 0)] }, "https://x.com");
  assert.deepEqual(rows, [
    { url: "https://x.com/a/", metric: "organic_sessions",    value: 50 },
    { url: "https://x.com/b/", metric: "organic_conversions", value: 2 },
  ]);
});

// R3: GA4 landingPage is non-trailing-slash ("/foo") while decision_log.url and GSC-form
// outcomes.url are trailing-slash canonical ("/foo/"). metricAround joins with exact
// .eq("url", url), so un-normalized GA4 rows silently miss every interior page.
test("mapGa4Rows canonicalizes a non-trailing-slash landingPage to the trailing-slash URL", () => {
  const rows = mapGa4Rows({ rows: [ga4("/foo", 1, 10)] }, "https://x.com");
  assert.deepEqual(rows, [
    { url: "https://x.com/foo/", metric: "organic_conversions", value: 1 },
    { url: "https://x.com/foo/", metric: "organic_sessions",    value: 10 },
  ]);
});

test("mapGa4Rows strips query strings and fragments before canonicalizing", () => {
  const rows = mapGa4Rows({ rows: [ga4("/foo?utm_source=x", 1, 0), ga4("/bar#section", 2, 0)] }, "https://x.com");
  assert.deepEqual(rows, [
    { url: "https://x.com/foo/", metric: "organic_conversions", value: 1 },
    { url: "https://x.com/bar/", metric: "organic_conversions", value: 2 },
  ]);
});

test("mapGa4Rows skips the GA4 '(not set)' landing page entirely", () => {
  assert.deepEqual(mapGa4Rows({ rows: [ga4("(not set)", 5, 100)] }, "https://x.com"), []);
});

test("mapGa4Rows aggregates path variants of the same canonical URL into one row per metric", () => {
  const rows = mapGa4Rows(
    { rows: [ga4("/foo", 1, 10), ga4("/foo?utm=x", 2, 20), ga4("/foo/", 3, 30)] },
    "https://x.com",
  );
  assert.deepEqual(rows, [
    { url: "https://x.com/foo/", metric: "organic_conversions", value: 6 },
    { url: "https://x.com/foo/", metric: "organic_sessions",    value: 60 },
  ]);
});

test("mapGa4Rows skips a row with a non-numeric metric value without poisoning its URL's aggregate", () => {
  const rows = mapGa4Rows(
    { rows: [ga4("/foo", "abc", 10), ga4("/foo?utm=x", 2, 20)] },
    "https://x.com",
  );
  assert.deepEqual(rows, [
    { url: "https://x.com/foo/", metric: "organic_conversions", value: 2 },
    { url: "https://x.com/foo/", metric: "organic_sessions",    value: 20 },
  ]);
});

test("mapGa4Rows keeps the homepage landing page '/' as the bare site root", () => {
  const rows = mapGa4Rows({ rows: [ga4("/", 4, 40)] }, "https://x.com");
  assert.deepEqual(rows, [
    { url: "https://x.com/", metric: "organic_conversions", value: 4 },
    { url: "https://x.com/", metric: "organic_sessions",    value: 40 },
  ]);
});

test("mapGa4Rows is null-safe on an empty, rowless, or undefined response", () => {
  assert.deepEqual(mapGa4Rows({ rows: [] }, "https://x.com"), []);
  assert.deepEqual(mapGa4Rows({}, "https://x.com"), []);
  assert.deepEqual(mapGa4Rows(undefined, "https://x.com"), []);
});
