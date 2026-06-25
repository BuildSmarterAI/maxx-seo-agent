// test/push-escalations.test.mjs — covers the escalation-mirror seam:
//   1. linearPriority mapping
//   2. buildIssueInput shape (pure)
//   3. pushEscalations core with injected fakes (no network, no db)
//
// Run: node --test
import { test } from "node:test";
import assert from "node:assert/strict";

// supabase.mjs -> client.mjs throws without these; the injected fakes mean the db
// is never actually called. Set before importing so module-load env checks pass.
process.env.SUPABASE_URL ||= "https://x.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "dummy_service_role_key_000000";

const { linearPriority, buildIssueInput, pushEscalations } =
  await import("../scripts/push-escalations.mjs");

const row = (over = {}) => ({
  id: 1, url: "https://www.maxxbuilders.com/get-a-quote/", task: "redirect",
  risk_class: "gated", priority: 1, source: "manual", ...over,
});

test("linearPriority maps queue priority to Linear scale", () => {
  assert.equal(linearPriority(3), 1); // urgent
  assert.equal(linearPriority(5), 1); // clamps high
  assert.equal(linearPriority(2), 2); // high
  assert.equal(linearPriority(1), 3); // medium
  assert.equal(linearPriority(0), 0); // none
});

test("buildIssueInput carries team, project, title, queue id, priority", () => {
  const input = buildIssueInput(row({ id: 42, priority: 2 }));
  assert.equal(input.teamId, "c8b2fc25-0b42-4a28-a60d-047c6bb69ebb");
  assert.equal(input.projectId, "4732c6e5-1eec-464c-80b6-5c48d5ab3d43");
  assert.match(input.title, /\[escalated\] redirect:/);
  assert.match(input.description, /work_queue` \(id 42\)/);
  assert.match(input.description, /get-a-quote/);
  assert.equal(input.priority, 2);
});

test("pushEscalations creates one issue per row and writes the pointer back", async () => {
  const created = [], marked = [];
  const result = await pushEscalations({
    fetchEscalated: async () => [row({ id: 1 }), row({ id: 2 })],
    createIssue: async (input) => { created.push(input); return { id: `lin_${created.length}`, identifier: `BUI-${created.length}` }; },
    markPushed: async (id, linearId) => { marked.push({ id, linearId }); },
    log: () => {},
  });
  assert.equal(result.total, 2);
  assert.equal(result.pushed, 2);
  assert.equal(result.failed, 0);
  assert.equal(created.length, 2);
  assert.deepEqual(marked, [{ id: 1, linearId: "lin_1" }, { id: 2, linearId: "lin_2" }]);
});

test("a failed createIssue is isolated: no pointer written, others still mirror", async () => {
  const marked = [];
  const result = await pushEscalations({
    fetchEscalated: async () => [row({ id: 1 }), row({ id: 2 })],
    createIssue: async (input) => {
      if (input.description.includes("(id 1)")) throw new Error("Linear 500");
      return { id: "lin_ok", identifier: "BUI-2" };
    },
    markPushed: async (id, linearId) => { marked.push({ id, linearId }); },
    log: () => {},
  });
  assert.equal(result.pushed, 1);
  assert.equal(result.failed, 1);
  assert.deepEqual(marked, [{ id: 2, linearId: "lin_ok" }]); // row 1 left unmirrored for retry
});

test("empty queue is a no-op", async () => {
  const result = await pushEscalations({
    fetchEscalated: async () => [],
    createIssue: async () => { throw new Error("should not be called"); },
    markPushed: async () => { throw new Error("should not be called"); },
    log: () => {},
  });
  assert.deepEqual(result, { total: 0, pushed: 0, failed: 0 });
});
