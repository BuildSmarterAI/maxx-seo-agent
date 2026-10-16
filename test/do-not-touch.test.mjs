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

const { enqueue, doNotTouch } = await import("../orchestrator/lib/supabase.mjs");
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

// Returns injectable deps plus the retire/log spy logs, so tests can assert that dropped
// rows are actually written back (cross-review 56-2) — not just filtered from the window.
// Queue rows carry risk_class: "safe" like real pendingQueue rows (DB default) — the A8
// dispatch risk gate escalates anything else, which is not what this section exercises.
const okDeps = (queueRows, protectedUrls) => {
  const retired = [];
  const logged = [];
  const deps = {
    isPaused: async () => false,
    resetMonthIfNew: async () => false,
    getMonthSpend: async () => 0,
    pendingQueue: async () => queueRows,
    doNotTouch: async () => canonicalizeSet(protectedUrls),
    setQueueStatusById: async (id, to) => { retired.push([id, to]); },
    logDecision: async (row) => { logged.push(row); },
  };
  return { deps, retired, logged };
};

test("preflight drops a now-protected row from the dispatch queue", async () => {
  const { deps } = okDeps(
    [{ id: 1, url: "https://www.x.com/a", task: "seo-audit", risk_class: "safe" },
     { id: 2, url: "https://www.x.com/legal/", task: "seo-audit", risk_class: "safe" }],
    ["https://x.com/legal"]
  );
  const res = await check(100, 25, deps);
  assert.equal(res.ok, true);
  assert.deepEqual(res.queue.map((r) => r.url), ["https://www.x.com/a"]);
});

test("preflight stops when every pending row is do_not_touch", async () => {
  const { deps } = okDeps(
    [{ id: 1, url: "https://x.com/legal/", task: "seo-audit", risk_class: "safe" }],
    ["https://x.com/legal"]
  );
  const res = await check(100, 25, deps);
  assert.equal(res.ok, false);
  assert.match(res.reason, /do_not_touch/);
});

test("preflight passes an unprotected queue through unchanged", async () => {
  const rows = [{ id: 1, url: "https://x.com/a", task: "seo-audit", risk_class: "safe" }];
  const { deps, retired } = okDeps(rows, []);
  const res = await check(100, 25, deps);
  assert.equal(res.ok, true);
  assert.equal(res.queue.length, 1);
  assert.equal(retired.length, 0); // nothing dropped → nothing written back
});

test("preflight parks dropped rows as skipped-dnt + logs the decision (cross-review 56-2)", async () => {
  // skipped-dnt, NOT escalated: an escalated (url,task) twin would collide with the
  // work_queue unique(url,task,status) constraint (escalate → sensor re-enqueue → human adds
  // do_not_touch is the system's canonical sequence), and escalated rows get mirrored to
  // Linear with a "resolve in WordPress" narrative — an instruction to edit the protected page.
  const { deps, retired, logged } = okDeps(
    [{ id: 7, url: "https://x.com/legal/", task: "seo-audit", risk_class: "safe" },
     { id: 8, url: "https://x.com/a", task: "seo-audit", risk_class: "safe" }],
    ["https://x.com/legal"]
  );
  const res = await check(100, 25, deps);
  assert.equal(res.ok, true);
  assert.deepEqual(retired, [[7, "skipped-dnt"]]);
  assert.equal(logged.length, 1);
  assert.equal(logged[0].url, "https://x.com/legal/");
  assert.equal(logged[0].action, "skip");
});

test("preflight retires the whole window when every row is protected (bulk-add starvation case)", async () => {
  // Without the write-back, a bulk do_not_touch add covering the top-priority window made
  // every future run fetch the same rows, filter to zero, and exit — rows below the window
  // were never dispatched. Retiring the dropped rows lets the next run see a fresh window.
  const { deps, retired } = okDeps(
    [{ id: 1, url: "https://x.com/legal/", task: "seo-audit", risk_class: "safe" },
     { id: 2, url: "https://x.com/terms/", task: "seo-audit", risk_class: "safe" }],
    ["https://x.com/legal", "https://x.com/terms"]
  );
  const res = await check(100, 25, deps);
  assert.equal(res.ok, false);
  assert.deepEqual(retired.map(([id]) => id), [1, 2]);
});

test("a failing retire write is loud but never fatal and never logs a phantom decision (verify round 2)", async () => {
  // A (url,task,'skipped-dnt') twin or a transient write failure must not kill the run —
  // the row simply stays pending and keeps being filtered (pre-fix behavior for that row
  // alone) — and decision_log must not record a retirement that didn't happen.
  const { deps, logged } = okDeps(
    [{ id: 7, url: "https://x.com/legal/", task: "seo-audit", risk_class: "safe" }],
    ["https://x.com/legal"]
  );
  deps.setQueueStatusById = async () => { throw new Error("duplicate key value violates unique constraint"); };
  const res = await check(100, 25, deps);
  assert.equal(res.ok, false); // protected row still never dispatches
  assert.equal(logged.length, 0);
});

// ---- 3. doNotTouch reader fails closed (cross-review 56-3) ----

test("doNotTouch throws on a db read error instead of failing open to an empty set", async () => {
  // An empty set on a transient read error silently disables EVERY enforcement layer that
  // consumes it (sensor ingest, enqueue chokepoint, dispatch re-check, cms apply gate).
  const client = { from: () => ({ select: async () => ({ data: null, error: { message: "boom" } }) }) };
  await assert.rejects(() => doNotTouch(client), /doNotTouch failed: boom/);
});

test("doNotTouch canonicalizes stored urls on the happy path", async () => {
  const client = { from: () => ({ select: async () => ({ data: [{ url: "https://www.x.com/Legal/" }], error: null }) }) };
  const set = await doNotTouch(client);
  assert.equal(set.has("x.com/legal"), true);
});

test("setQueueStatusById surfaces db errors instead of silently no-opping (verify round 2)", async () => {
  // The pre-fix silent swallow is what let the retire write no-op on the
  // work_queue unique(url,task,status) constraint while preflight logged success.
  const { setQueueStatusById } = await import("../orchestrator/lib/supabase.mjs");
  const client = { from: () => ({ update: () => ({ eq: async () => ({ error: { message: "duplicate key" } }) }) }) };
  await assert.rejects(() => setQueueStatusById(1, "skipped-dnt", client), /setQueueStatusById failed: duplicate key/);
});

// ---- 4. sensor harness ordering (56-3 regression guard, verify round 2) ----

test("runSensor resolves do_not_touch BEFORE sensor.fetch so a dnt error can't strand fetch side effects", async () => {
  // sensor-sitemap's fetch() commits markSitemapSeen. If the do_not_touch read ran after
  // fetch and threw (56-3 fail-closed), that night's fresh URLs would be marked seen but
  // never enqueued — permanently lost. The dnt read must abort while aborting is still free.
  const { runSensor } = await import("../orchestrator/lib/sensor.mjs");
  let fetched = false;
  const sensor = { name: "t", thresholds: {}, fetch: async () => { fetched = true; return []; } };
  await assert.rejects(
    () => runSensor(sensor, {}, { doNotTouch: async () => { throw new Error("dnt down"); } }),
    /dnt down/
  );
  assert.equal(fetched, false);
});

test("runSensor filters and enqueues with the injected protected set", async () => {
  const { runSensor } = await import("../orchestrator/lib/sensor.mjs");
  const enqueued = [];
  const sensor = {
    name: "t",
    thresholds: { sig: { task: "seo-audit", priority: 5 } },
    fetch: async () => [{ url: "https://x.com/a", signalType: "sig" },
                        { url: "https://x.com/legal/", signalType: "sig" }],
  };
  const res = await runSensor(sensor, {}, {
    doNotTouch: async () => canonicalizeSet(["https://x.com/legal"]),
    enqueue: async (items) => { enqueued.push(...items); },
  });
  assert.equal(res.count, 1);
  assert.deepEqual(enqueued.map((i) => i.url), ["https://x.com/a"]);
});
