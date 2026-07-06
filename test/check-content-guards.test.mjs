// test/check-content-guards.test.mjs — the CLI wrapper's own control-flow logic (P2 backlog
// item, flagged by the Panel A audit): checkFiles() is the extracted, injectable-read pure
// core so the "every path unreadable" fail-open gap is directly testable, not just the
// deterministic guards it delegates to (those are already covered in
// test/content-guards.test.mjs).
//
// Run: node --test
import { test } from "node:test";
import assert from "node:assert/strict";

import { checkFiles } from "../scripts/check-content-guards.mjs";

test("checkFiles reports violations from a bad file and skips a clean one", () => {
  const reads = {
    "bad.md": "By Editorial Team",
    "good.md": "By Harris Khan, Licensed GC.",
  };
  const result = checkFiles(["bad.md", "good.md"], (p) => reads[p]);
  assert.equal(result.checked, 2);
  assert.equal(result.total, 1);
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0].path, "bad.md");
});

test("checkFiles skips one unreadable file in an otherwise-readable batch without failing it", () => {
  const reads = { "good.md": "By Harris Khan, Licensed GC." };
  const readFile = (p) => { if (!(p in reads)) throw new Error("ENOENT"); return reads[p]; };
  const result = checkFiles(["missing.md", "good.md"], readFile);
  assert.equal(result.checked, 1);
  assert.equal(result.total, 0);
});

// ---- the fail-open gap (P2 backlog) ----
test("checkFiles distinguishes 'zero files were readable' from 'zero violations found' — checked stays 0, not conflated with a real clean pass", () => {
  const readFile = () => { throw new Error("ENOENT"); };
  const result = checkFiles(["a.md", "b.md"], readFile);
  assert.equal(result.checked, 0);
  assert.equal(result.total, 0);
  // The CLI layer uses (paths.length && !checked) to detect this exact case. Neither real
  // caller (the eval-gate workflow's --diff-filter=ACM file list, or the post-validate
  // hook's single just-written file) can legitimately produce this combination, so the
  // CLI fails closed (exit 1) here rather than printing a misleading "N file(s) clean."
});
