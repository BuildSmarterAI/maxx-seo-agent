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
  const rows = mapGa4Rows({ rows: [ga4("/a", 0, 50), ga4("/b", 2, 0)] }, "https://x.com");
  assert.deepEqual(rows, [
    { url: "https://x.com/a", metric: "organic_sessions",    value: 50 },
    { url: "https://x.com/b", metric: "organic_conversions", value: 2 },
  ]);
});

test("mapGa4Rows is null-safe on an empty, rowless, or undefined response", () => {
  assert.deepEqual(mapGa4Rows({ rows: [] }, "https://x.com"), []);
  assert.deepEqual(mapGa4Rows({}, "https://x.com"), []);
  assert.deepEqual(mapGa4Rows(undefined, "https://x.com"), []);
});
