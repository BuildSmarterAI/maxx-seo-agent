#!/usr/bin/env node
// check-diff-size.mjs — fails (exit 1) if the PR diff exceeds the auto-merge size
// threshold, forcing human review for large changes. Part of the eval-gate.
import { execSync } from "node:child_process";

const base = process.env.BASE_REF || "HEAD~1";
const max = Number(process.env.MAX_DIFF_LINES || 400);

const rows = execSync(`git diff --numstat ${base} HEAD`, { maxBuffer: 20 * 1024 * 1024 })
  .toString().trim().split("\n").filter(Boolean);

let total = 0;
for (const r of rows) {
  const [added, deleted] = r.split("\t");
  total += (Number(added) || 0) + (Number(deleted) || 0);   // "-" (binary) counts as 0
}

console.log(`diff size: ${total} changed lines (threshold ${max})`);
if (total > max) {
  console.error("eval-gate: diff exceeds auto-merge size threshold → human review required.");
  process.exit(1);
}
