// test/apply.test.mjs — covers the extracted CMS apply seam (Candidate 4):
//   1. applyRow lifecycle mechanics, with a fake adapter + injected store (no net/db)
//   2. real adapter I/O wiring (wordpress + webflow) via a mocked global fetch
//
// Run: node --test
import { test } from "node:test";
import assert from "node:assert/strict";

// cms.mjs -> client.mjs throws without these; the injected store means the db is
// never actually called. Set before importing so module-load env checks pass.
process.env.SUPABASE_URL ||= "https://x.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "dummy_service_role_key_000000";
process.env.WP_BASE_URL ||= "https://stage.example.com";
process.env.WP_USER ||= "u";
process.env.WP_APP_PASSWORD ||= "p";
process.env.SEO_PLUGIN ||= "yoast";
process.env.WEBFLOW_TOKEN ||= "tok";

const { applyRow } = await import("../orchestrator/lib/cms.mjs");
const { wordpressAdapter } = await import("../packs/wordpress/apply.mjs");
const { webflowAdapter } = await import("../packs/webflow/apply.mjs");

// ---- fakes ----
function fakeStore() {
  const calls = { status: [], log: [], snapshots: [] };
  return {
    calls,
    snapshot: async (row, current) => { calls.snapshots.push({ id: row.id, current }); },
    setStatus: async (id, status, extra = {}) => { calls.status.push({ id, status, ...extra }); },
    logDecision: async (entry) => { calls.log.push(entry); },
  };
}

function fakeAdapter(over = {}) {
  const writes = [];
  return {
    writes,
    platform: "fake",
    supports: () => true,
    driftCheckable: () => true,
    read: async () => "LIVE",
    write: async (row) => { writes.push(row.new_value); },
    narrate: {
      unsupported: (row) => ({ reason: `unsupported ${row.field}` }),
      drift: () => ({ change_type: "metadata" }),
      applied: (row) => ({ change_type: row.field, reason: `ok ${row.field}` }),
      failed: (row, err) => ({ reason: `fail: ${err.message}` }),
    },
    ...over,
  };
}

// ---- applyRow mechanics ----
test("applied path: snapshot, write, status=applied, log applied", async () => {
  const store = fakeStore();
  const a = fakeAdapter({ read: async () => "old" });
  const row = { id: 1, url: "/x", field: "title", new_value: "new", base_value: "old" };
  const outcome = await applyRow(row, a, store);
  assert.equal(outcome, "applied");
  assert.deepEqual(a.writes, ["new"]);
  assert.equal(store.calls.snapshots[0].current, "old");
  assert.equal(store.calls.status.at(-1).status, "applied");
  assert.ok(store.calls.status.at(-1).applied_at);
  assert.equal(store.calls.log.at(-1).action, "applied");
});

test("snapshot happens before write", async () => {
  const order = [];
  const store = fakeStore();
  store.snapshot = async () => order.push("snapshot");
  const a = fakeAdapter({ read: async () => "old", write: async () => order.push("write") });
  await applyRow({ id: 1, field: "title", new_value: "n", base_value: "old" }, a, store);
  assert.deepEqual(order, ["snapshot", "write"]);
});

test("drift escalates and does NOT write", async () => {
  const store = fakeStore();
  const a = fakeAdapter({ read: async () => "LIVE-CHANGED" });
  const outcome = await applyRow({ id: 2, field: "title", new_value: "n", base_value: "ORIGINAL" }, a, store);
  assert.equal(outcome, "escalated");
  assert.deepEqual(a.writes, []);
  assert.equal(store.calls.status.at(-1).status, "escalated");
  assert.equal(store.calls.log.at(-1).reason, "drift: live value changed since generation");
});

test("driftCheckable=false skips the drift gate and writes", async () => {
  const store = fakeStore();
  const a = fakeAdapter({ driftCheckable: () => false, read: async () => "LIVE-CHANGED" });
  const outcome = await applyRow({ id: 3, field: "post_content", new_value: "n", base_value: "ORIGINAL" }, a, store);
  assert.equal(outcome, "applied");
  assert.deepEqual(a.writes, ["n"]);
});

test("unsupported escalates before read/snapshot", async () => {
  const store = fakeStore();
  let readCalled = false;
  const a = fakeAdapter({ supports: () => false, read: async () => { readCalled = true; return "x"; } });
  const outcome = await applyRow({ id: 4, field: "weird" }, a, store);
  assert.equal(outcome, "escalated");
  assert.equal(readCalled, false);
  assert.equal(store.calls.snapshots.length, 0);
  assert.equal(store.calls.log.at(-1).action, "escalate");
});

test("verify is invoked when present, after write", async () => {
  const order = [];
  const store = fakeStore();
  const a = fakeAdapter({
    read: async () => "old",
    write: async () => order.push("write"),
    verify: async () => order.push("verify"),
  });
  await applyRow({ id: 5, field: "title", new_value: "n", base_value: "old" }, a, store);
  assert.deepEqual(order, ["write", "verify"]);
});

test("thrown write -> failed status + skip log", async () => {
  const store = fakeStore();
  const a = fakeAdapter({ read: async () => "old", write: async () => { throw new Error("boom"); } });
  const outcome = await applyRow({ id: 6, field: "title", new_value: "n", base_value: "old" }, a, store);
  assert.equal(outcome, "failed");
  assert.equal(store.calls.status.at(-1).status, "failed");
  assert.equal(store.calls.log.at(-1).action, "skip");
  assert.match(store.calls.log.at(-1).reason, /fail: boom/);
});

// ---- real adapter wiring (mock fetch) ----
test("wordpressAdapter: supports + driftCheckable field rules", () => {
  assert.equal(wordpressAdapter.supports({ field: "post_content" }), true);
  assert.equal(wordpressAdapter.supports({ field: "title" }), true);
  assert.equal(wordpressAdapter.supports({ field: "bogus" }), false);
  assert.equal(wordpressAdapter.driftCheckable({ field: "post_content" }), false);
  assert.equal(wordpressAdapter.driftCheckable({ field: "title" }), true);
});

test("wordpressAdapter: read/write hit the right REST shapes", async () => {
  const seen = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    seen.push({ url, method: init.method ?? "GET", body: init.body });
    return { ok: true, status: 200, json: async () => ({ meta: { _yoast_wpseo_title: "LIVE" }, content: { raw: "BODY" } }), text: async () => "" };
  };
  try {
    assert.equal(await wordpressAdapter.read({ page_id: 42, field: "title" }), "LIVE");
    assert.match(seen.at(-1).url, /posts\/42\?context=edit/);

    await wordpressAdapter.write({ page_id: 42, field: "title", new_value: "NEW" });
    const w = seen.at(-1);
    assert.equal(w.method, "POST");
    assert.match(w.url, /posts\/42/);
    assert.match(w.body, /_yoast_wpseo_title/);
    assert.match(w.body, /NEW/);
  } finally { globalThis.fetch = realFetch; }
});

test("wordpressAdapter: falls back to pages/{id} when id is not a post", async () => {
  const seen = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    seen.push({ url, method: init.method ?? "GET" });
    const postProbe = /\/posts\/6567/.test(url);   // 6567 is a Page, not a post
    return {
      ok: !postProbe, status: postProbe ? 404 : 200,
      json: async () => ({ meta: { _yoast_wpseo_metadesc: "PAGEDESC" } }), text: async () => "not found",
    };
  };
  try {
    assert.equal(await wordpressAdapter.read({ page_id: 6567, field: "description" }), "PAGEDESC");
    assert.ok(seen.some((s) => /\/posts\/6567\?context=edit/.test(s.url)), "probes posts first");
    assert.match(seen.at(-1).url, /\/pages\/6567\?context=edit/);     // resolved to pages
  } finally { globalThis.fetch = realFetch; }
});

test("webflowAdapter: page vs CMS-item routing", async () => {
  const seen = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    seen.push({ url, method: init.method ?? "GET", body: init.body });
    return { ok: true, status: 200, json: async () => ({ seo: { title: "PT" }, fieldData: { name: "IT" } }), text: async () => "" };
  };
  try {
    assert.equal(webflowAdapter.supports({ collection_id: null, field: "title" }), true);
    assert.equal(webflowAdapter.supports({ collection_id: null, field: "slug" }), false);
    assert.equal(webflowAdapter.supports({ collection_id: "c1", field: "slug" }), true);

    assert.equal(await webflowAdapter.read({ collection_id: null, page_id: "p1", field: "title" }), "PT");
    assert.match(seen.at(-1).url, /\/pages\/p1$/);

    await webflowAdapter.write({ collection_id: "c1", page_id: "i1", field: "name", new_value: "X" });
    const w = seen.at(-1);
    assert.equal(w.method, "PATCH");
    assert.match(w.url, /\/collections\/c1\/items\/i1/);
    assert.match(w.body, /fieldData/);
  } finally { globalThis.fetch = realFetch; }
});
