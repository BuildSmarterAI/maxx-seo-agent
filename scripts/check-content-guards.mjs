#!/usr/bin/env node
// check-content-guards.mjs — runs the deterministic content guards over one or more files.
// Used by the post-validate hook (single file) and the eval-gate CI step (changed files).
// Exit 1 if any file trips a guard; exit 0 (silent-ish) otherwise. Missing files are a
// pass, not an error — CI passes a changed-file list that may include deletions.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runGuards } from "./validators/content-guards.mjs";

const paths = process.argv.slice(2);
if (!paths.length) {
  console.error("usage: node scripts/check-content-guards.mjs <file> [<file> ...]");
  process.exit(1);
}

let total = 0;
let checked = 0;
for (const p of paths) {
  let text;
  try {
    text = readFileSync(resolve(p), "utf8");
  } catch {
    continue; // unreadable/deleted file → skip, don't fail the whole run
  }
  checked++;
  const violations = runGuards(text);
  if (violations.length) {
    total += violations.length;
    console.error(`content-guards: ${violations.length} issue(s) in ${p}:`);
    for (const v of violations) console.error(`  • [${v.rule}] ${v.message} — "${v.snippet}"`);
  }
}

if (total) {
  console.error(`content-guards: ${total} issue(s) across ${checked} file(s) → fail.`);
  process.exit(1);
}
console.log(`content-guards: ${checked} file(s) clean.`);
