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

test("driftCheckable=false skips the drift gate for a non-content field and writes", async () => {
  const store = fakeStore();
  const a = fakeAdapter({ driftCheckable: () => false, read: async () => "LIVE-CHANGED" });
  const outcome = await applyRow({ id: 3, url: "/c", field: "canonical", new_value: "n", base_value: "ORIGINAL", risk_class: "safe" }, a, store);
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

test("snapshot rejection -> failed outcome, zero writes, failed status (no write without a rollback snapshot)", async () => {
  const store = fakeStore();
  store.snapshot = async () => { throw new Error("snapshot failed: permission denied for table snapshots"); };
  const a = fakeAdapter({ read: async () => "old" });
  const outcome = await applyRow({ id: 15, url: "/snap", field: "title", new_value: "n", base_value: "old", risk_class: "safe" }, a, store);
  assert.equal(outcome, "failed");
  assert.deepEqual(a.writes, []);
  assert.equal(store.calls.status.at(-1).status, "failed");
  assert.equal(store.calls.status.some((s) => s.status === "applied"), false);
  assert.match(store.calls.log.at(-1).reason, /snapshot failed/);
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

// ---- post_content drift (raw-to-raw, fail closed on missing values) ----
// Race window, stated plainly: the comparison uses the value adapter.read returned at the
// start of applyRow; the Supabase snapshot insert, the placeholder scan and the POST come
// after it. These tests prove the comparison logic only. They do not (and cannot) prove
// that the write is atomic: WordPress core REST has no conditional-write precondition.
const contentRow = (over = {}) => ({
  id: 100, url: "/c", field: "post_content", page_id: 7, risk_class: "safe",
  new_value: "NEW BODY", base_value: "BODY", ...over,
});
const contentAdapter = (live, over = {}) => fakeAdapter({
  isContent: (row) => row.field === "post_content",
  read: typeof live === "function" ? live : async () => live,
  ...over,
});

test("content drift (i): unchanged post_content (live == base) applies with exactly 1 write", async () => {
  const store = fakeStore();
  const a = contentAdapter("<!-- wp:paragraph --><p>x</p><!-- /wp:paragraph -->");
  const outcome = await applyRow(contentRow({ base_value: "<!-- wp:paragraph --><p>x</p><!-- /wp:paragraph -->" }), a, store);
  assert.equal(outcome, "applied");
  assert.deepEqual(a.writes, ["NEW BODY"]);
});

test("content drift (ii): edited post_content (live != base) escalates with 0 writes", async () => {
  const store = fakeStore();
  const a = contentAdapter("BODY edited by a human");
  const outcome = await applyRow(contentRow(), a, store);
  assert.equal(outcome, "escalated");
  assert.deepEqual(a.writes, []);
  assert.equal(store.calls.status.at(-1).status, "escalated");
  assert.equal(store.calls.log.at(-1).reason, "drift: live value changed since generation");
});

test("content drift (iii): missing baseline (null/undefined) escalates fail-closed with 0 writes and a distinct reason", async () => {
  for (const base_value of [null, undefined]) {
    const store = fakeStore();
    const a = contentAdapter("BODY");
    const row = contentRow({ base_value });
    if (base_value === undefined) delete row.base_value;
    const outcome = await applyRow(row, a, store);
    assert.equal(outcome, "escalated");
    assert.deepEqual(a.writes, []);
    assert.equal(store.calls.status.at(-1).status, "escalated");
    assert.match(store.calls.log.at(-1).reason, /missing baseline/);
    assert.notEqual(store.calls.log.at(-1).reason, "drift: live value changed since generation");
  }
});

test("content drift (iv): missing/unavailable live value escalates, 0 writes, never treated as empty string", async () => {
  for (const live of [undefined, null, 42, { raw: "x" }]) {
    for (const base_value of ["BODY", ""]) {
      const store = fakeStore();
      const a = contentAdapter(live);
      const outcome = await applyRow(contentRow({ base_value }), a, store);
      assert.equal(outcome, "escalated", `live=${JSON.stringify(live)} base=${JSON.stringify(base_value)}`);
      assert.deepEqual(a.writes, []);
      assert.match(store.calls.log.at(-1).reason, /missing live value/);
      // An unreadable value must not poison rollback history with a null snapshot.
      assert.equal(store.calls.snapshots.length, 0);
    }
  }
});

test("content drift (iv): a throwing read ends failed with 0 writes", async () => {
  const store = fakeStore();
  const a = contentAdapter(async () => { throw new Error("WP 503"); });
  const outcome = await applyRow(contentRow(), a, store);
  assert.equal(outcome, "failed");
  assert.deepEqual(a.writes, []);
  assert.equal(store.calls.status.at(-1).status, "failed");
});

// Precedence is pinned, not incidental: contentDriftReason checks the LIVE value before the
// baseline, so when BOTH are missing the reason is 'missing live value' (not 'missing baseline').
test("content drift (vi): BOTH base_value and live value missing -> escalated, 0 writes, 0 snapshots, reason is 'missing live value' (live is checked first)", async () => {
  const MISSING_LIVE = "content-drift: missing live value (unavailable or not a string) — cannot verify live content, blocked at boundary";
  for (const live of [undefined, null]) {
    for (const base_value of [null, undefined]) {
      const store = fakeStore();
      const a = contentAdapter(live);
      const row = contentRow({ base_value });
      if (base_value === undefined) delete row.base_value;
      const outcome = await applyRow(row, a, store);
      const tag = `live=${String(live)} base=${String(base_value)}`;
      assert.equal(outcome, "escalated", tag);
      assert.deepEqual(a.writes, [], tag);
      assert.equal(store.calls.snapshots.length, 0, tag);
      assert.equal(store.calls.status.at(-1).status, "escalated", tag);
      assert.equal(store.calls.log.at(-1).reason, MISSING_LIVE, tag);
    }
  }
});

test("content drift (v): intentionally empty content is a value, not a missing value", async () => {
  // base "" and live "" -> applies
  let store = fakeStore();
  let a = contentAdapter("");
  assert.equal(await applyRow(contentRow({ base_value: "" }), a, store), "applied");
  assert.deepEqual(a.writes, ["NEW BODY"]);
  // base "" vs live non-empty -> drift
  store = fakeStore();
  a = contentAdapter("someone added text");
  assert.equal(await applyRow(contentRow({ base_value: "" }), a, store), "escalated");
  assert.deepEqual(a.writes, []);
  assert.equal(store.calls.log.at(-1).reason, "drift: live value changed since generation");
  // base non-empty vs live "" -> drift
  store = fakeStore();
  a = contentAdapter("");
  assert.equal(await applyRow(contentRow({ base_value: "BODY" }), a, store), "escalated");
  assert.deepEqual(a.writes, []);
  assert.equal(store.calls.log.at(-1).reason, "drift: live value changed since generation");
});

test("content drift (vi): CRLF-only difference applies (CRLF->LF on both sides, nothing else)", async () => {
  let store = fakeStore();
  let a = contentAdapter("line1\r\nline2\r\n");
  assert.equal(await applyRow(contentRow({ base_value: "line1\nline2\n" }), a, store), "applied");
  assert.equal(a.writes.length, 1);
  // symmetric: base has CRLF, live has LF
  store = fakeStore();
  a = contentAdapter("line1\nline2\n");
  assert.equal(await applyRow(contentRow({ base_value: "line1\r\nline2\r\n" }), a, store), "applied");
  // no trim: a trailing newline is a real difference
  store = fakeStore();
  a = contentAdapter("line1\nline2");
  assert.equal(await applyRow(contentRow({ base_value: "line1\nline2\n" }), a, store), "escalated");
  assert.deepEqual(a.writes, []);
});

test("content drift (vii): a one-space or one-character real change escalates", async () => {
  for (const live of ["BODY ", "BODy", "BOD", "BODY ", "B ODY"]) {
    const store = fakeStore();
    const a = contentAdapter(live);
    assert.equal(await applyRow(contentRow(), a, store), "escalated", JSON.stringify(live));
    assert.deepEqual(a.writes, []);
  }
});

test("content drift: the check runs even if driftCheckable is false (content flag is authoritative)", async () => {
  const store = fakeStore();
  const a = contentAdapter("LIVE-CHANGED", { driftCheckable: () => false });
  assert.equal(await applyRow(contentRow(), a, store), "escalated");
  assert.deepEqual(a.writes, []);
});

test("non-content regression: canonical with null base_value still skips drift; title drift still escalates; null live metadata is unchanged", async () => {
  // canonical rows are staged with a null base_value on purpose -> no drift check
  let store = fakeStore();
  let a = fakeAdapter({ isContent: (row) => row.field === "post_content", read: async () => "https://live/" });
  const canon = { id: 200, url: "/k", field: "canonical", new_value: "https://new/", base_value: null, risk_class: "safe" };
  assert.equal(await applyRow(canon, a, store), "applied");
  assert.deepEqual(a.writes, ["https://new/"]);
  // title with a real base still drifts, with the original reason
  store = fakeStore();
  a = fakeAdapter({ isContent: (row) => row.field === "post_content", read: async () => "CHANGED" });
  assert.equal(await applyRow({ id: 201, url: "/t", field: "title", new_value: "n", base_value: "ORIG", risk_class: "safe" }, a, store), "escalated");
  assert.equal(store.calls.log.at(-1).reason, "drift: live value changed since generation");
  // non-content semantics unchanged: a null live metadata value is snapshotted and compared, not rejected
  store = fakeStore();
  a = fakeAdapter({ isContent: (row) => row.field === "post_content", read: async () => null });
  assert.equal(await applyRow({ id: 202, url: "/m", field: "description", new_value: "n", base_value: "ORIG", risk_class: "safe" }, a, store), "escalated");
  assert.equal(store.calls.log.at(-1).reason, "drift: live value changed since generation");
  assert.equal(store.calls.snapshots.length, 1);
});

// ---- raw-content verification (gate before the comparison is trusted) ----
function wpFetchFake(routes, seen = []) {
  return async (url, init = {}) => {
    seen.push({ url: String(url), method: init.method ?? "GET", body: init.body });
    const hit = routes.find((r) => r.match.test(String(url)) && (r.method ?? "GET") === (init.method ?? "GET"));
    if (!hit) return { ok: false, status: 404, json: async () => ({}), text: async () => "not found" };
    return { ok: true, status: 200, json: async () => hit.body, text: async () => "" };
  };
}

test("raw verification (a): wordpressAdapter content read requests context=edit and returns content.raw, never rendered", async () => {
  const seen = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = wpFetchFake([
    { match: /\/posts\/9\?context=edit/, body: { content: { raw: "<!-- wp:html -->RAW<!-- /wp:html -->", rendered: "<p>RENDERED</p>" } } },
  ], seen);
  try {
    const v = await wordpressAdapter.read({ page_id: 9, field: "post_content" });
    assert.equal(v, "<!-- wp:html -->RAW<!-- /wp:html -->");
    assert.notEqual(v, "<p>RENDERED</p>");
    assert.ok(seen.every((s) => /context=edit/.test(s.url)), "every read must use context=edit");
  } finally { globalThis.fetch = realFetch; }
});

test("raw verification (a): scripts/cms-read.mjs readWordpress requests context=edit and returns content.raw, never rendered", async () => {
  const { readWordpress } = await import("../scripts/cms-read.mjs");
  const seen = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = wpFetchFake([
    { match: /\/posts\?slug=my-post/, body: [{ id: 9 }] },
    { match: /\/posts\/9\?context=edit/, body: { content: { raw: "RAW BODY", rendered: "<p>RENDERED BODY</p>" } } },
  ], seen);
  try {
    const r = await readWordpress("https://www.example.com/my-post/", "post_content");
    assert.equal(r.base_value, "RAW BODY");
    assert.equal(r.page_id, "9");
    assert.match(seen.at(-1).url, /posts\/9\?context=edit/);
  } finally { globalThis.fetch = realFetch; }
});

test("raw verification (b): response without content.raw is UNAVAILABLE (null), not empty; empty raw stays ''", async () => {
  const { readWordpress } = await import("../scripts/cms-read.mjs");
  const bodies = [
    { content: { rendered: "<p>only rendered</p>" } },   // raw absent
    { content: {} },
    {},                                                   // content missing
    { content: { raw: "", rendered: "" } },               // intentionally empty
  ];
  const expected = [null, null, null, ""];
  const realFetch = globalThis.fetch;
  try {
    for (const [i, body] of bodies.entries()) {
      globalThis.fetch = wpFetchFake([
        { match: /\/posts\/11\?context=edit/, body },
        { match: /\/posts\?slug=p/, body: [{ id: 11 }] },
      ]);
      assert.strictEqual(await wordpressAdapter.read({ page_id: 11, field: "post_content" }), expected[i], `adapter case ${i}`);
      assert.strictEqual((await readWordpress("https://x.example/p/", "post_content")).base_value, expected[i], `cms-read case ${i}`);
    }
  } finally { globalThis.fetch = realFetch; }
});

test("end to end (mocked fetch): real wordpressAdapter applies unchanged raw content, escalates an edit and an unavailable raw, one POST at most", async () => {
  const realFetch = globalThis.fetch;
  const run = async (body, base_value) => {
    const seen = [];
    globalThis.fetch = wpFetchFake([{ match: /\/posts\/13/, body }, { match: /\/posts\/13/, method: "POST", body: {} }], seen);
    const store = fakeStore();
    const outcome = await applyRow(contentRow({ page_id: 13, base_value }), wordpressAdapter, store);
    return { outcome, posts: seen.filter((s) => s.method === "POST"), store };
  };
  try {
    let r = await run({ content: { raw: "RAW", rendered: "<p>RAW</p>" } }, "RAW");
    assert.equal(r.outcome, "applied");
    assert.equal(r.posts.length, 1);
    assert.deepEqual(JSON.parse(r.posts[0].body), { content: { raw: "NEW BODY" } });
    r = await run({ content: { raw: "RAW edited", rendered: "<p>RAW</p>" } }, "RAW");
    assert.equal(r.outcome, "escalated");
    assert.equal(r.posts.length, 0);
    r = await run({ content: { rendered: "<p>RAW</p>" } }, "<p>RAW</p>");   // staged from rendered by mistake
    assert.equal(r.outcome, "escalated");
    assert.equal(r.posts.length, 0);
    assert.match(r.store.calls.log.at(-1).reason, /missing live value/);
  } finally { globalThis.fetch = realFetch; }
})
;

// ---- real adapter wiring (mock fetch) ----
test("wordpressAdapter: supports + driftCheckable field rules", () => {
  assert.equal(wordpressAdapter.supports({ field: "post_content" }), true);
  assert.equal(wordpressAdapter.supports({ field: "title" }), true);
  assert.equal(wordpressAdapter.supports({ field: "bogus" }), false);
  assert.equal(wordpressAdapter.driftCheckable({ field: "post_content" }), true);
  assert.equal(wordpressAdapter.isContent({ field: "post_content" }), true);
  assert.equal(wordpressAdapter.isContent({ field: "title" }), false);
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

// ---- learning-loop orphan-leak backstop (A11) ----
// logDecision (unlike insertChangeset) has no assertTaskType gate at write time, so a
// stray non-task change_type (a CMS field name, a legacy literal like "metadata") can land
// in decision_log. filterKitTaskDecisions is the read-side backstop every consumer of
// appliedDecisions() gets for free, mirroring the precedent already established in
// scripts/attribute-citations.mjs's own KIT_TASKS filter for the GEO learning path.
test("filterKitTaskDecisions keeps only rows whose change_type is a real kit task", async () => {
  const { filterKitTaskDecisions } = await import("../orchestrator/lib/supabase.mjs");
  const rows = [
    { url: "/a", change_type: "blog-write" },
    { url: "/b", change_type: "title" },      // a CMS field name — the rollback leak
    { url: "/c", change_type: "metadata" },   // a legacy generic label — the pack leak
    { url: "/d", change_type: "schema-generate" },
  ];
  assert.deepEqual(filterKitTaskDecisions(rows), [
    { url: "/a", change_type: "blog-write" },
    { url: "/d", change_type: "schema-generate" },
  ]);
});

test("filterKitTaskDecisions drops a null/undefined change_type too (appliedDecisions already excludes null, but the filter must not crash on it)", async () => {
  const { filterKitTaskDecisions } = await import("../orchestrator/lib/supabase.mjs");
  assert.deepEqual(filterKitTaskDecisions([{ url: "/a", change_type: null }]), []);
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
  assert.deepEqual(tally, { applied: 1, escalated: 1, failed: 1, unrecorded: 0 });
});

test("applyRows returns zero counts for an empty row set", async () => {
  const store = fakeStore();
  const tally = await applyRows(fakeAdapter(), { rows: [], store });
  assert.deepEqual(tally, { applied: 0, escalated: 0, failed: 0, unrecorded: 0 });
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
  assert.deepEqual(tally, { applied: 1, escalated: 1, failed: 0, unrecorded: 0 });
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

test("rollbackRow logs change_type null, not the field name (orphan-leak fix, A11)", async () => {
  // A rollback isn't a kit task — logging change_type: field (e.g. "title") would let a
  // CMS field name join the learning loop's byType aggregation as if it were a real task,
  // the same class of leak already fixed for narrate.applied().
  const store = fakeStore();
  store.latestSnapshot = async () => "OLD";
  const a = fakeAdapter({ read: async () => "old" });
  await rollbackRow(a, { page_id: "p1", field: "title" }, store);
  assert.equal(store.calls.log.at(-1).change_type, null);
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

// ---- rollbackRow fail-closed: refuse before ANY write when pre-rollback state is not captured ----
// Every refusal below must leave the adapter untouched (0 writes, 0 verifies) and the store
// untouched (no status change, no 'rolledback' log).
function rollbackFixture({ live, snapshotValue = "OLD", content = false, adapterOver = {}, storeOver = {} } = {}) {
  const store = fakeStore();
  store.latestSnapshot = async () => snapshotValue;
  store.latestAppliedRow = async () => ({ id: 99 });
  Object.assign(store, storeOver);
  const verifies = [];
  const a = fakeAdapter({
    isContent: (row) => content && row.field === "post_content",
    read: typeof live === "function" ? live : async () => live,
    verify: async (row) => { verifies.push(row.new_value); },
    ...adapterOver,
  });
  return { store, a, verifies, field: content ? "post_content" : "title" };
}
function assertRollbackUntouched({ store, a, verifies }) {
  assert.equal(a.writes.length, 0, "adapter.write must not be called");
  assert.equal(verifies.length, 0, "adapter.verify must not be called");
  assert.equal(store.calls.status.length, 0, "no status change");
  assert.equal(store.calls.log.some((l) => l.action === "rolledback"), false, "no rolledback log");
}

test("rollbackRow REFUSES a content field whose live value is not a string: no snapshot, no write, no verify, no status, no log", async () => {
  for (const live of [undefined, null, 42, { raw: "x" }]) {
    const fx = rollbackFixture({ live, content: true });
    await assert.rejects(
      () => rollbackRow(fx.a, { page_id: "7", field: fx.field }, fx.store),
      /rollback: refusing .*post_content.*live value is not a string/,
      `live=${JSON.stringify(live)}`,
    );
    assert.equal(fx.store.calls.snapshots.length, 0, "refusal happens before any snapshot insert");
    assertRollbackUntouched(fx);
  }
});

test("rollbackRow: a throwing adapter.read propagates; 0 snapshots, 0 writes, 0 verifies, no status, no log", async () => {
  for (const content of [true, false]) {
    const fx = rollbackFixture({ content, live: async () => { throw new Error("WP 503"); } });
    await assert.rejects(() => rollbackRow(fx.a, { page_id: "7", field: fx.field }, fx.store), /WP 503/);
    assert.equal(fx.store.calls.snapshots.length, 0);
    assertRollbackUntouched(fx);
  }
});

test("rollbackRow REFUSES when the pre-rollback snapshot cannot be saved: error propagates, 0 writes, 0 verifies, no status, no log", async () => {
  for (const content of [true, false]) {
    const fx = rollbackFixture({
      content, live: "CURRENT",
      storeOver: { snapshot: async () => { throw new Error("snapshot failed: permission denied"); } },
    });
    await assert.rejects(
      () => rollbackRow(fx.a, { page_id: "7", field: fx.field }, fx.store),
      /snapshot failed: permission denied/,
    );
    assertRollbackUntouched(fx);
  }
});

test("rollbackRow: intentionally empty live content (\"\") is a valid value: snapshotted, then rollback proceeds", async () => {
  const fx = rollbackFixture({ live: "", content: true, snapshotValue: "OLD BODY" });
  await rollbackRow(fx.a, { page_id: "7", field: fx.field }, fx.store);
  assert.deepEqual(fx.store.calls.snapshots.map((s) => s.current), [""]);
  assert.deepEqual(fx.a.writes, ["OLD BODY"]);
  assert.deepEqual(fx.verifies, ["OLD BODY"]);
  assert.deepEqual(fx.store.calls.status.at(-1), { id: 99, status: "rolledback" });
  assert.equal(fx.store.calls.log.at(-1).action, "rolledback");
});

test("rollbackRow: a stored snapshot old_value of \"\" is a valid restore target (only null/undefined means no snapshot)", async () => {
  const fx = rollbackFixture({ live: "CURRENT BODY", content: true, snapshotValue: "" });
  const res = await rollbackRow(fx.a, { page_id: "7", field: fx.field }, fx.store);
  assert.deepEqual(fx.a.writes, [""]);
  assert.equal(res.restored, "");
  assert.deepEqual(fx.store.calls.status.at(-1), { id: 99, status: "rolledback" });
  // undefined is also "no snapshot"
  const none = rollbackFixture({ live: "x", storeOver: { latestSnapshot: async () => undefined } });
  await assert.rejects(() => rollbackRow(none.a, { page_id: "7", field: none.field }, none.store), /no snapshot/i);
  assertRollbackUntouched(none);
});

test("latestSnapshot returns \"\" (not null) for a stored empty old_value", async () => {
  assert.equal(await latestSnapshot("wordpress", "7", "post_content", fakeDb({ data: { old_value: "" }, error: null })), "");
  assert.equal(await latestSnapshot("wordpress", "7", "post_content", fakeDb({ data: null, error: null })), null);
});

test("rollbackRow METADATA: a null live meta value means 'unset' - snapshotted as null, rollback proceeds", async () => {
  const fx = rollbackFixture({ live: null, content: false, snapshotValue: "OLD TITLE" });
  await rollbackRow(fx.a, { page_id: "7", field: fx.field }, fx.store);
  assert.deepEqual(fx.store.calls.snapshots.map((s) => s.current), [null]);
  assert.deepEqual(fx.a.writes, ["OLD TITLE"]);
  assert.deepEqual(fx.store.calls.status.at(-1), { id: 99, status: "rolledback" });
});

// ---- persistence failures must fail loudly (2026-10-14 WordPress integration audit) ----
// supabase-js does not throw on a failed insert/select; it returns { error }. A swallowed
// snapshot error means a live write with no rollback snapshot, and a swallowed select
// error makes a broken run report "applied 0" as success.
const { snapshot, approvedRows, setStatus, latestSnapshot, stagedRows, applyExitCode } =
  await import("../orchestrator/lib/cms.mjs");

// A thenable query builder: every chain method returns the builder, and awaiting it at
// any point resolves to `result` — the same shape supabase-js builders have.
function fakeDb(result) {
  const q = { then: (res, rej) => Promise.resolve(result).then(res, rej) };
  for (const m of ["select", "eq", "in", "order", "limit", "maybeSingle", "insert", "update"]) q[m] = () => q;
  return { from: () => q };
}

test("snapshot throws when the snapshots insert returns an error", async () => {
  await assert.rejects(
    () => snapshot({ platform: "wordpress", page_id: "1", url: "/a", field: "title" }, "old",
      fakeDb({ error: { message: "permission denied for table snapshots" } })),
    /snapshot.*permission denied/i,
  );
});

test("snapshot resolves when the insert succeeds", async () => {
  await snapshot({ platform: "wordpress", page_id: "1", url: "/a", field: "title" }, "old",
    fakeDb({ error: null }));
});

test("approvedRows throws on a query error instead of returning [] (no vacuous 'applied 0')", async () => {
  await assert.rejects(
    () => approvedRows("wordpress", 200, fakeDb({ data: null, error: { message: "JWT expired" } })),
    /approvedRows.*JWT expired/i,
  );
});

test("approvedRows returns rows on success", async () => {
  const rows = await approvedRows("wordpress", 200, fakeDb({ data: [{ id: 1 }], error: null }));
  assert.deepEqual(rows, [{ id: 1 }]);
});

// ---- SEO-14: setStatus / latestSnapshot / stagedRows fail closed ----
test("setStatus throws on an update error (a live write must not leave the row 'approved' silently)", async () => {
  await assert.rejects(
    () => setStatus(1, "applied", {}, fakeDb({ error: { message: "connection reset" } })),
    /^Error: setStatus failed: connection reset$/,
  );
});

test("setStatus resolves when the update succeeds", async () => {
  await setStatus(1, "applied", {}, fakeDb({ error: null }));
});

test("latestSnapshot throws on a read error instead of returning null ('no snapshot' would be a lie)", async () => {
  await assert.rejects(
    () => latestSnapshot("wordpress", "1", "title", fakeDb({ data: null, error: { message: "JWT expired" } })),
    /^Error: latestSnapshot failed: JWT expired$/,
  );
});

test("latestSnapshot returns old_value, or null when there is genuinely no snapshot", async () => {
  assert.equal(await latestSnapshot("wordpress", "1", "title", fakeDb({ data: { old_value: "OLD" }, error: null })), "OLD");
  assert.equal(await latestSnapshot("wordpress", "1", "title", fakeDb({ data: null, error: null })), null);
});

test("stagedRows throws on a read error instead of returning [] (no vacuous 'nothing staged')", async () => {
  await assert.rejects(
    () => stagedRows("webflow", 200, fakeDb({ data: null, error: { message: "JWT expired" } })),
    /^Error: stagedRows failed: JWT expired$/,
  );
});

test("stagedRows returns rows on success", async () => {
  assert.deepEqual(await stagedRows("webflow", 200, fakeDb({ data: [{ id: 7 }], error: null })), [{ id: 7 }]);
});

test("rollbackRow: a snapshot READ failure is reported as such, not as 'no snapshot found', and writes nothing", async () => {
  const store = fakeStore();
  store.latestSnapshot = (p, id, f) => latestSnapshot(p, id, f, fakeDb({ data: null, error: { message: "JWT expired" } }));
  const a = fakeAdapter();
  await assert.rejects(
    () => rollbackRow(a, { page_id: "p1", field: "title" }, store),
    (err) => /latestSnapshot failed: JWT expired/.test(err.message) && !/no snapshot/i.test(err.message),
  );
  assert.deepEqual(a.writes, []);
});

test("applyRow: setStatus failing AFTER the live write -> 'applied_unrecorded', never 'failed' and never silent 'applied'", async () => {
  const store = fakeStore();
  const real = store.setStatus;
  store.setStatus = async (id, status, extra) => {
    if (status === "applied") return setStatus(id, status, extra, fakeDb({ error: { message: "connection reset" } }));
    return real(id, status, extra);
  };
  const errs = [];
  const a = fakeAdapter({ read: async () => "old" });
  const row = { id: 21, url: "/u", field: "title", new_value: "new", base_value: "old", risk_class: "safe" };
  const outcome = await applyRow(row, a, store, { error: (m) => errs.push(m) });
  assert.equal(outcome, "applied_unrecorded");
  assert.deepEqual(a.writes, ["new"]);                                    // the write DID happen
  assert.equal(store.calls.status.some((s) => s.status === "failed"), false); // not mislabelled failed
  const log = store.calls.log.at(-1);
  assert.equal(log.action, "applied");                                    // audit trail says it is live
  assert.match(log.reason, /status unrecorded.*setStatus failed: connection reset/);
  assert.match(errs.join("\n"), /change_set 21.*still 'approved'/);       // operator alert on stderr
});

test("applyRows tallies applied_unrecorded and applyExitCode makes the run exit non-zero", async () => {
  const store = fakeStore();
  store.setStatus = async (id, status) => { if (status === "applied" && id === 2) throw new Error("setStatus failed: x"); };
  const a = fakeAdapter({ read: async (row) => row.base_value });
  const rows = [
    { id: 1, url: "/a", field: "title", new_value: "a", base_value: "x", risk_class: "safe" },
    { id: 2, url: "/b", field: "title", new_value: "b", base_value: "x", risk_class: "safe" },
  ];
  const tally = await applyRows(a, { rows, store, error: () => {} });
  assert.deepEqual(tally, { applied: 1, escalated: 0, failed: 0, unrecorded: 1 });
  assert.equal(applyExitCode(tally), 1);
  assert.equal(applyExitCode({ applied: 3, escalated: 1, failed: 1, unrecorded: 0 }), 0);
});
