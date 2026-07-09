// test/check-citation-density.test.mjs — the CLI wrapper's control-flow core: checkFiles()
// is the extracted, injectable-read pure core so the "every path unreadable" fail-open gap
// is directly testable (the deterministic gate itself is covered in
// test/citation-density.test.mjs). Mirrors test/check-content-guards.test.mjs.
//
// Run: node --test
import { test } from "node:test";
import assert from "node:assert/strict";

import { checkFiles } from "../scripts/check-citation-density.mjs";

const thin = "Our team builds great commercial spaces across the state. ".repeat(40);
const rich =
  "In 2026 Texas medical office builds ran $285 to $520 per square foot, up 18%. A 12,000 sq ft " +
  '[imaging center](https://www.agc.org/data) priced out at $4,200,000. "Steel lead times drove ' +
  '1 in 3 of our overruns," the lead said. '.repeat(1) + "filler word ".repeat(120);

test("checkFiles reports violations from an evidence-poor file and passes a rich one", () => {
  const reads = { "thin.md": thin, "rich.md": rich };
  const result = checkFiles(["thin.md", "rich.md"], (p) => reads[p]);
  assert.equal(result.checked, 2);
  assert.ok(result.total >= 1);
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0].path, "thin.md");
});

test("checkFiles skips one unreadable file in an otherwise-readable batch without failing it", () => {
  const reads = { "rich.md": rich };
  const readFile = (p) => { if (!(p in reads)) throw new Error("ENOENT"); return reads[p]; };
  const result = checkFiles(["missing.md", "rich.md"], readFile);
  assert.equal(result.checked, 1);
  assert.equal(result.total, 0);
});

test("checkFiles distinguishes 'zero files readable' from 'zero violations' — checked stays 0", () => {
  const readFile = () => { throw new Error("ENOENT"); };
  const result = checkFiles(["a.md", "b.md"], readFile);
  assert.equal(result.checked, 0);
  assert.equal(result.total, 0);
  // The CLI layer uses (paths.length && !checked) to fail closed on this exact case.
});
