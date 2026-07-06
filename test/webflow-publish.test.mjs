// test/webflow-publish.test.mjs — M7: the Webflow publish gate, mode selection, ≤100
// chunking, and canary exit-code semantics were previously untested. Pure tests against
// packs/webflow/publish-core.mjs with injected deps — no DB, network, or env.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  selectPublishMode,
  groupItemChunks,
  canaryOutcome,
  publishStaged,
} from "../packs/webflow/publish-core.mjs";

function fakeDeps(env = {}) {
  const calls = { wf: [], setStatus: [] };
  return {
    calls,
    deps: {
      wf: async (path, init) => { calls.wf.push({ path, body: init?.body ? JSON.parse(init.body) : null }); return {}; },
      setStatus: async (id, status) => { calls.setStatus.push({ id, status }); },
      env,
      siteId: "site-123",
      log: () => {},
      error: () => {},
    },
  };
}

const item = (id, collection) => ({ id: `row-${id}`, page_id: `item-${id}`, collection_id: collection, url: null });
const page = (id) => ({ id: `row-${id}`, page_id: `page-${id}`, collection_id: null, url: null });

// ── mode selection ───────────────────────────────────────────────────────────

test("mode: empty → none; all CMS items → items; any page row → site", () => {
  assert.equal(selectPublishMode([]), "none");
  assert.equal(selectPublishMode([item(1, "c1"), item(2, "c1")]), "items");
  assert.equal(selectPublishMode([page(1)]), "site");
  assert.equal(selectPublishMode([item(1, "c1"), page(2)]), "site");
});

// ── chunking ─────────────────────────────────────────────────────────────────

test("chunking groups by collection and splits at 100 per Webflow API limit", () => {
  const rows = [];
  for (let i = 0; i < 250; i++) rows.push(item(i, "cA"));
  rows.push(item(900, "cB"));
  const chunks = groupItemChunks(rows);
  const aChunks = chunks.filter((c) => c.collectionId === "cA");
  const bChunks = chunks.filter((c) => c.collectionId === "cB");
  assert.deepEqual(aChunks.map((c) => c.itemIds.length), [100, 100, 50]);
  assert.deepEqual(bChunks.map((c) => c.itemIds.length), [1]);
  const flat = aChunks.flatMap((c) => c.itemIds);
  assert.equal(new Set(flat).size, 250, "no item lost or duplicated across chunks");
});

// ── items mode ───────────────────────────────────────────────────────────────

test("items mode publishes each chunk to its collection and marks every row published", async () => {
  const { calls, deps } = fakeDeps();
  const staged = [item(1, "c1"), item(2, "c1"), item(3, "c2")];
  const result = await publishStaged(staged, deps);
  assert.equal(result.mode, "items");
  assert.equal(result.published, 3);
  assert.deepEqual(calls.wf.map((c) => c.path).sort(), ["/collections/c1/items/publish", "/collections/c2/items/publish"]);
  const c1 = calls.wf.find((c) => c.path.includes("/c1/"));
  assert.deepEqual(c1.body, { itemIds: ["item-1", "item-2"] });
  assert.deepEqual(calls.setStatus, [
    { id: "row-1", status: "published" },
    { id: "row-2", status: "published" },
    { id: "row-3", status: "published" },
  ]);
});

test("items mode never touches the global site publish endpoint", async () => {
  const { calls, deps } = fakeDeps({ WEBFLOW_ALLOW_SITE_PUBLISH: "true" });
  await publishStaged([item(1, "c1")], deps);
  assert.ok(calls.wf.every((c) => !c.path.includes("/sites/")));
});

// ── site-publish gate ────────────────────────────────────────────────────────

test("site mode without WEBFLOW_ALLOW_SITE_PUBLISH refuses: no publish, no status change", async () => {
  const { calls, deps } = fakeDeps({});
  const result = await publishStaged([page(1), item(2, "c1")], deps);
  assert.equal(result.mode, "site");
  assert.equal(result.refused, true);
  assert.equal(result.published, 0);
  assert.equal(calls.wf.length, 0);
  assert.equal(calls.setStatus.length, 0);
});

test('gate is exact-match "true" — "TRUE", "1", "yes" all refuse', async () => {
  for (const v of ["TRUE", "1", "yes", ""]) {
    const { calls, deps } = fakeDeps({ WEBFLOW_ALLOW_SITE_PUBLISH: v });
    const result = await publishStaged([page(1)], deps);
    assert.equal(result.refused, true, `value ${JSON.stringify(v)} must refuse`);
    assert.equal(calls.wf.length, 0);
  }
});

test("site mode with gate open publishes globally and honors subdomain flag", async () => {
  const { calls, deps } = fakeDeps({ WEBFLOW_ALLOW_SITE_PUBLISH: "true", WEBFLOW_PUBLISH_TO_SUBDOMAIN: "true" });
  const result = await publishStaged([page(1), page(2)], deps);
  assert.equal(result.mode, "site");
  assert.equal(result.published, 2);
  assert.deepEqual(calls.wf, [{ path: "/sites/site-123/publish", body: { publishToWebflowSubdomain: true } }]);
  assert.equal(calls.setStatus.length, 2);
});

test("subdomain flag defaults to false when unset", async () => {
  const { calls, deps } = fakeDeps({ WEBFLOW_ALLOW_SITE_PUBLISH: "true" });
  await publishStaged([page(1)], deps);
  assert.deepEqual(calls.wf[0].body, { publishToWebflowSubdomain: false });
});

// ── none mode ────────────────────────────────────────────────────────────────

test("nothing staged → no calls at all", async () => {
  const { calls, deps } = fakeDeps();
  const result = await publishStaged([], deps);
  assert.equal(result.mode, "none");
  assert.equal(calls.wf.length + calls.setStatus.length, 0);
});

test("per-collection summary logs emit as each collection completes (partial-failure diagnostics)", async () => {
  const logs = [];
  const { deps } = fakeDeps();
  deps.log = (msg) => logs.push(msg);
  deps.wf = async (path) => {
    if (path.includes("/cB/")) throw new Error("Webflow 500 on cB");
    return {};
  };
  await assert.rejects(
    () => publishStaged([item(1, "cA"), item(2, "cB")], deps),
    /Webflow 500 on cB/,
  );
  assert.ok(logs.some((l) => /published 1 item\(s\) in collection cA/.test(l)),
    `collection cA's success must already be logged when cB fails; got: ${JSON.stringify(logs)}`);
});

// ── rows are not marked published if the publish call throws ────────────────

test("a failed publish call propagates and leaves row statuses untouched", async () => {
  const { calls, deps } = fakeDeps({ WEBFLOW_ALLOW_SITE_PUBLISH: "true" });
  deps.wf = async () => { throw new Error("Webflow 500"); };
  await assert.rejects(() => publishStaged([page(1)], deps), /Webflow 500/);
  assert.equal(calls.setStatus.length, 0);
});

// ── canary exit-code semantics (check-vitals.sh: 2 = real CWV regression) ────

test("canary: exit 2 is a regression; 3/other/missing is inconclusive (warn, not fail)", () => {
  assert.equal(canaryOutcome(2), "regression");
  assert.equal(canaryOutcome(3), "inconclusive");
  assert.equal(canaryOutcome(1), "inconclusive");
  assert.equal(canaryOutcome(undefined), "inconclusive");
});
