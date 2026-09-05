// test/goal.test.mjs — covers queueAllowlist(), the block appended to the repo goal prompt
// so the agent's own `mem.mjs queue` re-fetch is a cross-check against the preflight-vetted
// rows rather than the source of truth (A8: closes the TOCTOU window between preflight and
// the agent's fetch — a row enqueued in between is not in the list and must be skipped).
//
// Run: node --test
import { test } from "node:test";
import assert from "node:assert/strict";

const { queueAllowlist } = await import("../orchestrator/goal.mjs");

test("queueAllowlist embeds only the vetted fields of each row", () => {
  const block = queueAllowlist([
    { id: 7, url: "https://x/a/", task: "metadata-generate", risk_class: "safe",
      priority: 9, reason: "free-text a human typed" },
  ]);
  assert.match(block, /"id":7/);
  assert.match(block, /"url":"https:\/\/x\/a\/"/);
  assert.match(block, /"task":"metadata-generate"/);
  assert.match(block, /"risk_class":"safe"/);
  assert.ok(!block.includes("free-text"), "unvetted columns must never reach the prompt");
  assert.ok(!block.includes("priority"), "only id/url/task/risk_class are embedded");
});

test("queueAllowlist tells the agent to skip rows that are not in the list", () => {
  const block = queueAllowlist([{ id: 1, url: "https://x/", task: "faq-schema", risk_class: "safe" }]);
  assert.match(block, /skip/i);
  assert.match(block, /allowlist/i);
});

test("queueAllowlist handles an empty queue without breaking the prompt", () => {
  const block = queueAllowlist([]);
  assert.match(block, /\[\]/);
  assert.equal(typeof block, "string");
});
