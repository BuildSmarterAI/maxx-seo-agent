// test/do-not-touch.test.mjs — the two do_not_touch enforcement seams beyond the
// per-caller ingest filters:
//   1. enqueue() chokepoint — the single waist every new queue item flows through, so a
//      future caller that forgets to filter still can't queue a protected URL (A1 backstop).
//   2. preflight.check() dispatch re-check — a URL added to do_not_touch AFTER it was
//      enqueued is still `pending` in work_queue; drop it before the orchestrator dispatches (A3).
//
// Run: node --test test/do-not-touch.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";

// supabase.mjs -> client.mjs throws without these; injected client/deps mean no db is hit.
process.env.SUPABASE_URL ||= "https://x.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "dummy_service_role_key_000000";

const { enqueue } = await import("../orchestrator/lib/supabase.mjs");
const { check } = await import("../orchestrator/lib/preflight.mjs");
const { canonicalizeSet } = await import("../orchestrator/lib/url.mjs");

// Fake service-role client capturing work_queue upserts without touching a db.
function fakeClient() {
  const calls = [];
  return { calls, from: () => ({ upsert: async (rows) => { calls.push(rows); } }) };
}

const item = (url) => ({ url, task: "seo-audit", status: "pending" });

// ---- 1. enqueue chokepoint ----

test("enqueue drops a do_not_touch item across scheme/www/slash variance", async () => {
  const client = fakeClient();
  await enqueue(
    [item("https://www.x.com/a"), item("https://www.x.com/legal/")],
    { protectedSet: canonicalizeSet(["https://x.com/legal"]), client }
  );
  assert.equal(client.calls.length, 1);
  assert.deepEqual(client.calls[0].map((r) => r.url), ["https://www.x.com/a"]);
});

test("enqueue issues no write when every item is protected", async () => {
  const client = fakeClient();
  await enqueue(
    [item("https://x.com/legal/")],
    { protectedSet: canonicalizeSet(["https://x.com/legal"]), client }
  );
  assert.equal(client.calls.length, 0);
});

test("enqueue passes clean items straight through", async () => {
  const client = fakeClient();
  await enqueue([item("https://x.com/a")], { protectedSet: new Set(), client });
  assert.deepEqual(client.calls[0].map((r) => r.url), ["https://x.com/a"]);
});

test("enqueue fetches do_not_touch itself when no protectedSet is passed", async () => {
  // Pins the chokepoint's real runtime wiring: a caller that omits protectedSet still
  // gets protection because enqueue consults do_not_touch on its own.
  const client = fakeClient();
  await enqueue(
    [item("https://x.com/a"), item("https://x.com/legal/")],
    { client, dnt: async () => canonicalizeSet(["https://x.com/legal"]) }
  );
  assert.deepEqual(client.calls[0].map((r) => r.url), ["https://x.com/a"]);
});

// ---- 2. preflight dispatch re-check ----

const okDeps = (queueRows, protectedUrls) => ({
  isPaused: async () => false,
  resetMonthIfNew: async () => false,
  getMonthSpend: async () => 0,
  pendingQueue: async () => queueRows,
  doNotTouch: async () => canonicalizeSet(protectedUrls),
});

test("preflight drops a now-protected row from the dispatch queue", async () => {
  const res = await check(100, 25, okDeps(
    [{ id: 1, url: "https://www.x.com/a", task: "seo-audit" },
     { id: 2, url: "https://www.x.com/legal/", task: "seo-audit" }],
    ["https://x.com/legal"]
  ));
  assert.equal(res.ok, true);
  assert.deepEqual(res.queue.map((r) => r.url), ["https://www.x.com/a"]);
});

test("preflight stops when every pending row is do_not_touch", async () => {
  const res = await check(100, 25, okDeps(
    [{ id: 1, url: "https://x.com/legal/", task: "seo-audit" }],
    ["https://x.com/legal"]
  ));
  assert.equal(res.ok, false);
  assert.match(res.reason, /do_not_touch/);
});

test("preflight passes an unprotected queue through unchanged", async () => {
  const rows = [{ id: 1, url: "https://x.com/a", task: "seo-audit" }];
  const res = await check(100, 25, okDeps(rows, []));
  assert.equal(res.ok, true);
  assert.equal(res.queue.length, 1);
});
