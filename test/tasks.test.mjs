// test/tasks.test.mjs — the canonical kit-task vocabulary and the write-boundary guard.
// change_type / work_queue.task / learned_patterns.change_type share ONE vocabulary (the
// kit-skill name) — the join key the learning loop reprioritizes on. A non-task change_type
// (a CMS field name like "post_content", or a generic label like "metadata") can never join
// back to a task and silently drops out of attribution. assertTaskType is the write-boundary
// gate that keeps that vocabulary clean.
import { test } from "node:test";
import assert from "node:assert/strict";
import { KIT_TASKS, assertTaskType } from "../orchestrator/lib/tasks.mjs";

test("KIT_TASKS contains every live work_queue.task (no under-population regression)", () => {
  // The five tasks observed in the live queue must all be valid — including the two
  // (ai-info-page, restructure-for-citation) that have no local .claude/skills dir.
  for (const t of ["ai-info-page", "blog-write", "metadata-generate", "restructure-for-citation", "seo-audit"]) {
    assert.equal(KIT_TASKS.has(t), true, `${t} should be a known kit task`);
  }
});

test("assertTaskType returns a valid kit-task change_type unchanged", () => {
  assert.equal(assertTaskType("metadata-generate"), "metadata-generate");
  assert.equal(assertTaskType("blog-write"), "blog-write");
});

test("assertTaskType allows null/undefined (an unattributed change, not an orphan)", () => {
  assert.equal(assertTaskType(null), null);
  assert.equal(assertTaskType(undefined), undefined);
});

test("assertTaskType throws on a generic label that isn't a task ('metadata')", () => {
  // This is the exact 82-row leak: a change_set logged change_type "metadata"
  // instead of the task name "metadata-generate".
  assert.throws(() => assertTaskType("metadata"), /invalid change_type "metadata"/);
});

test("assertTaskType throws on a CMS field name that isn't a task ('post_content')", () => {
  assert.throws(() => assertTaskType("post_content"), /invalid change_type "post_content"/);
});

test("assertTaskType error names the offending value and that null is allowed", () => {
  assert.throws(() => assertTaskType("title"), (err) => {
    assert.match(err.message, /title/);
    assert.match(err.message, /null/);
    return true;
  });
});
