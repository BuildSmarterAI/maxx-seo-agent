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

const { applyRow, applyRows, rollbackRow } = await import("../orchestrator/lib/cms.mjs");
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
    // applyRow's do_not_touch gate reads this; default is "nothing protected" so the
    // pre-existing tests are unaffected. Boundary tests override it with a populated set.
    doNotTouch: async () => new Set(),
    // rollbackRow reads these two; defaults are overridden per test.
    latestSnapshot: async () => null,
    latestAppliedRow: async () => null,
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
  const row = { id: 1, url: "/x", field: "title", new_value: "new", base_value: "old", risk_class: "safe" };
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
  await applyRow({ id: 1, url: "/a", field: "title", new_value: "n", base_value: "old", risk_class: "safe" }, a, store);
  assert.deepEqual(order, ["snapshot", "write"]);
});

test("drift escalates and does NOT write", async () => {
  const store = fakeStore();
  const a = fakeAdapter({ read: async () => "LIVE-CHANGED" });
  const outcome = await applyRow({ id: 2, url: "/b", field: "title", new_value: "n", base_value: "ORIGINAL", risk_class: "safe" }, a, store);
  assert.equal(outcome, "escalated");
  assert.deepEqual(a.writes, []);
  assert.equal(store.calls.status.at(-1).status, "escalated");
  assert.equal(store.calls.log.at(-1).reason, "drift: live value changed since generation");
});

test("driftCheckable=false skips the drift gate and writes", async () => {
  const store = fakeStore();
  const a = fakeAdapter({ driftCheckable: () => false, read: async () => "LIVE-CHANGED" });
  const outcome = await applyRow({ id: 3, url: "/c", field: "post_content", new_value: "n", base_value: "ORIGINAL", risk_class: "safe" }, a, store);
  assert.equal(outcome, "applied");
  assert.deepEqual(a.writes, ["n"]);
});

test("unsupported escalates before read/snapshot", async () => {
  const store = fakeStore();
  let readCalled = false;
  const a = fakeAdapter({ supports: () => false, read: async () => { readCalled = true; return "x"; } });
  const outcome = await applyRow({ id: 4, url: "/weird", field: "weird", risk_class: "safe" }, a, store);
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
  await applyRow({ id: 5, url: "/e", field: "title", new_value: "n", base_value: "old", risk_class: "safe" }, a, store);
  assert.deepEqual(order, ["write", "verify"]);
});

test("thrown write -> failed status + skip log", async () => {
  const store = fakeStore();
  const a = fakeAdapter({ read: async () => "old", write: async () => { throw new Error("boom"); } });
  const outcome = await applyRow({ id: 6, url: "/f", field: "title", new_value: "n", base_value: "old", risk_class: "safe" }, a, store);
  assert.equal(outcome, "failed");
  assert.equal(store.calls.status.at(-1).status, "failed");
  assert.equal(store.calls.log.at(-1).action, "skip");
  assert.match(store.calls.log.at(-1).reason, /fail: boom/);
});

// ---- do_not_touch apply-boundary gate (REC-5/AH1 sub-item c) ----
test("protected url escalates at the boundary before read/snapshot/write", async () => {
  const store = fakeStore();
  store.doNotTouch = async () => new Set(["/protected"]);
  let readCalled = false;
  const a = fakeAdapter({ read: async () => { readCalled = true; return "x"; } });
  const outcome = await applyRow({ id: 7, url: "/protected", field: "title", new_value: "n", base_value: "old", risk_class: "safe" }, a, store);
  assert.equal(outcome, "escalated");
  assert.equal(readCalled, false);
  assert.equal(a.writes.length, 0);
  assert.equal(store.calls.snapshots.length, 0);
  assert.equal(store.calls.status.at(-1).status, "escalated");
  assert.equal(store.calls.log.at(-1).action, "escalate");
  assert.equal(store.calls.log.at(-1).risk_class, "gated");
  assert.match(store.calls.log.at(-1).reason, /do_not_touch/);
});

test("a url-less row is fail-closed: escalated, never written (can't verify do_not_touch)", async () => {
  const store = fakeStore();
  let readCalled = false;
  const a = fakeAdapter({ read: async () => { readCalled = true; return "x"; } });
  const outcome = await applyRow({ id: 11, field: "title", new_value: "n", base_value: "old", risk_class: "safe" }, a, store);
  assert.equal(outcome, "escalated");
  assert.equal(readCalled, false);
  assert.equal(a.writes.length, 0);
  assert.equal(store.calls.snapshots.length, 0);
  assert.equal(store.calls.status.at(-1).status, "escalated");
  assert.match(store.calls.log.at(-1).reason, /no url — cannot verify/);
});

test("protected gate is fail-closed: it precedes the supports() check", async () => {
  const store = fakeStore();
  store.doNotTouch = async () => new Set(["/protected"]);
  const a = fakeAdapter({ supports: () => false });
  const outcome = await applyRow({ id: 8, url: "/protected", field: "weird", risk_class: "safe" }, a, store);
  assert.equal(outcome, "escalated");
  assert.match(store.calls.log.at(-1).reason, /do_not_touch/);   // do_not_touch reason, not "unsupported"
});

test("an unprotected url applies normally", async () => {
  const store = fakeStore();
  store.doNotTouch = async () => new Set(["/other"]);
  const a = fakeAdapter({ read: async () => "old" });
  const outcome = await applyRow({ id: 9, url: "/x", field: "title", new_value: "new", base_value: "old", risk_class: "safe" }, a, store);
  assert.equal(outcome, "applied");
});

test("opts.protectedUrls is honored without re-querying store.doNotTouch", async () => {
  const store = fakeStore();
  let dntCalls = 0;
  store.doNotTouch = async () => { dntCalls++; return new Set(); };
  const a = fakeAdapter({ read: async () => "old" });
  const outcome = await applyRow(
    { id: 10, url: "/protected", field: "title", new_value: "n", base_value: "old", risk_class: "safe" },
    a, store, { protectedUrls: new Set(["/protected"]) },
  );
  assert.equal(outcome, "escalated");
  assert.equal(dntCalls, 0);   // used the passed set, issued no extra query
});

// ---- risk_class apply-boundary gate (A8) ----
test("gated risk_class escalates at the boundary before read/snapshot/write", async () => {
  const store = fakeStore();
  let readCalled = false;
  const a = fakeAdapter({ read: async () => { readCalled = true; return "x"; } });
  const outcome = await applyRow(
    { id: 12, url: "/g", field: "title", new_value: "n", base_value: "old", risk_class: "gated" },
    a, store,
  );
  assert.equal(outcome, "escalated");
  assert.equal(readCalled, false);
  assert.equal(a.writes.length, 0);
  assert.equal(store.calls.snapshots.length, 0);
  assert.equal(store.calls.status.at(-1).status, "escalated");
  assert.equal(store.calls.log.at(-1).action, "escalate");
  assert.equal(store.calls.log.at(-1).risk_class, "gated");
  assert.match(store.calls.log.at(-1).reason, /risk_class/);
});

test("a safe risk_class row applies normally", async () => {
  const store = fakeStore();
  const a = fakeAdapter({ read: async () => "old" });
  const outcome = await applyRow(
    { id: 13, url: "/s", field: "title", new_value: "new", base_value: "old", risk_class: "safe" },
    a, store,
  );
  assert.equal(outcome, "applied");
  assert.deepEqual(a.writes, ["new"]);
});

test("risk_class gate precedes the supports() check (fail-closed ordering)", async () => {
  const store = fakeStore();
  const a = fakeAdapter({ supports: () => false });
  const outcome = await applyRow(
    { id: 14, url: "/g2", field: "weird", risk_class: "gated" },
    a, store,
  );
  assert.equal(outcome, "escalated");
  assert.match(store.calls.log.at(-1).reason, /risk_class/);   // risk_class reason, not "unsupported"
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

// ---- narrate.applied must not invent a non-task change_type (orphan-leak fix) ----
test("wordpressAdapter.narrate.applied: absent change_type -> null, not the field name", () => {
  // A content row with no change_type must NOT log change_type "post_content" (a CMS field
  // name): that orphan can never join back to a work_queue task and silently drops out of
  // attribution. The fix keeps it null so the not-null filter excludes it cleanly.
  assert.equal(wordpressAdapter.narrate.applied({ field: "post_content" }).change_type, null);
  assert.equal(wordpressAdapter.narrate.applied({ field: "title" }).change_type, null);
});

test("wordpressAdapter.narrate.applied: a real task change_type passes through", () => {
  assert.equal(
    wordpressAdapter.narrate.applied({ field: "title", change_type: "metadata-generate" }).change_type,
    "metadata-generate",
  );
});

test("webflowAdapter.narrate.applied: absent change_type -> null, not literal 'metadata'", () => {
  assert.equal(webflowAdapter.narrate.applied({ field: "title" }).change_type, null);
});

test("webflowAdapter.narrate.applied: a real task change_type passes through", () => {
  assert.equal(
    webflowAdapter.narrate.applied({ collection_id: "c1", field: "name", change_type: "blog-write" }).change_type,
    "blog-write",
  );
});

test("insertChangeset rejects a non-task change_type before any db write", async () => {
  // The write-boundary guard: a change_set row carrying change_type "metadata" (the 82-row
  // leak) must be refused at creation, not faithfully logged later by the apply pack.
  const { insertChangeset } = await import("../orchestrator/lib/supabase.mjs");
  await assert.rejects(
    () => insertChangeset({ platform: "wordpress", page_id: 1, field: "title", new_value: "x", change_type: "metadata" }),
    /invalid change_type "metadata"/,
  );
});

// ---- applyRows (the per-pack loop, hoisted into cms.mjs) ----
test("applyRows tallies applied / escalated / failed across injected rows", async () => {
  const store = fakeStore();
  // read returns the live value (default = base_value, so no drift); _live forces drift;
  // _throw makes write fail.
  const a = fakeAdapter({
    read: async (row) => row._live ?? row.base_value,
    write: async (row) => { if (row._throw) throw new Error("boom"); },
  });
  const rows = [
    { id: 1, url: "/a", field: "title", new_value: "a", base_value: "x", risk_class: "safe" },                 // applied
    { id: 2, url: "/b", field: "title", new_value: "b", base_value: "x", _live: "DRIFT", risk_class: "safe" }, // escalated
    { id: 3, url: "/c", field: "title", new_value: "c", base_value: "x", _throw: true, risk_class: "safe" },   // failed
  ];
  const tally = await applyRows(a, { rows, store });
  assert.deepEqual(tally, { applied: 1, escalated: 1, failed: 1 });
});

test("applyRows returns zero counts for an empty row set", async () => {
  const store = fakeStore();
  const tally = await applyRows(fakeAdapter(), { rows: [], store });
  assert.deepEqual(tally, { applied: 0, escalated: 0, failed: 0 });
});

test("applyRows fetches do_not_touch once for the batch and escalates protected rows", async () => {
  const store = fakeStore();
  let dntCalls = 0;
  store.doNotTouch = async () => { dntCalls++; return new Set(["/b"]); };
  const a = fakeAdapter({ read: async (row) => row.base_value });
  const rows = [
    { id: 1, url: "/a", field: "title", new_value: "a", base_value: "x", risk_class: "safe" },   // applied
    { id: 2, url: "/b", field: "title", new_value: "b", base_value: "x", risk_class: "safe" },   // protected -> escalated
  ];
  const tally = await applyRows(a, { rows, store });
  assert.deepEqual(tally, { applied: 1, escalated: 1, failed: 0 });
  assert.equal(dntCalls, 1);   // one lookup for the whole batch, not per row
});

// ---- rollbackRow (rollback routed through the adapter) ----
test("rollbackRow restores the snapshot value via the adapter and marks the row rolledback", async () => {
  const store = fakeStore();
  store.latestSnapshot = async () => "OLD";
  store.latestAppliedRow = async () => ({ id: 99 });
  const a = fakeAdapter({ read: async () => "CURRENT-LIVE" });

  await rollbackRow(a, { page_id: "p1", field: "title" }, store);

  assert.deepEqual(a.writes, ["OLD"]);                                  // wrote the snapshot, not new_value
  assert.equal(store.calls.snapshots.at(-1).current, "CURRENT-LIVE");   // snapshotted current first
  assert.deepEqual(store.calls.status.at(-1), { id: 99, status: "rolledback" });
  assert.equal(store.calls.log.at(-1).action, "rolledback");
});

test("rollbackRow does NOT drift-gate: restores even when live differs from the snapshot", async () => {
  const store = fakeStore();
  store.latestSnapshot = async () => "OLD";
  const a = fakeAdapter({ driftCheckable: () => true, read: async () => "LIVE-CHANGED" });
  await rollbackRow(a, { page_id: "p1", field: "title" }, store);
  assert.deepEqual(a.writes, ["OLD"]);
});

test("rollbackRow snapshots current before writing the restored value", async () => {
  const order = [];
  const store = fakeStore();
  store.latestSnapshot = async () => "OLD";
  store.snapshot = async () => order.push("snapshot");
  const a = fakeAdapter({ read: async () => "live", write: async () => order.push("write") });
  await rollbackRow(a, { page_id: "p1", field: "title" }, store);
  assert.deepEqual(order, ["snapshot", "write"]);
});

test("rollbackRow throws when no snapshot exists", async () => {
  const store = fakeStore();
  store.latestSnapshot = async () => null;
  await assert.rejects(
    () => rollbackRow(fakeAdapter(), { page_id: "p1", field: "title" }, store),
    /no snapshot/i,
  );
});

test("rollbackRow throws on an unsupported field", async () => {
  const store = fakeStore();
  store.latestSnapshot = async () => "OLD";
  const a = fakeAdapter({ supports: () => false });
  await assert.rejects(
    () => rollbackRow(a, { page_id: "p1", field: "weird" }, store),
    /support/i,
  );
});
