#!/usr/bin/env node
// check-content-guards.mjs — runs the deterministic content guards over one or more files.
// Used by the post-validate hook (single file, always the one just Edited/Written — verified
// to always exist) and the eval-gate CI step (changed files, computed via
// `git diff --diff-filter=ACM`, i.e. Added/Copied/Modified only — Deleted is excluded, and
// the workflow itself skips calling this script at all when that list is empty). Neither real
// caller can legitimately produce a non-empty path list where every path is unreadable — that
// combination can only mean a bug fed this script the wrong paths, so it fails closed
// (see the `paths.length && !checked` branch below) rather than passing silently.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runGuards } from "./validators/content-guards.mjs";

// Pure(ish) core: reads each path (readFile is injectable so this is testable without a real
// filesystem) and runs the deterministic guards. Missing/unreadable files are skipped, not
// failed — CI passes a changed-file list that may include deletions. Returns enough detail
// for the CLI to report accurately, including when zero files were actually validated —
// previously indistinguishable from "all files passed" (P2 backlog fail-open gap): a batch
// where every path failed to read printed the same "N file(s) clean." message whether N
// files were genuinely validated clean or 0 files were ever read at all.
export function checkFiles(paths, readFile = (p) => readFileSync(resolve(p), "utf8")) {
  let total = 0;
  let checked = 0;
  const issues = [];
  for (const p of paths) {
    let text;
    try {
      text = readFile(p);
    } catch {
      continue;
    }
    checked++;
    const violations = runGuards(text);
    if (violations.length) {
      total += violations.length;
      issues.push({ path: p, violations });
    }
  }
  return { total, checked, issues };
}

function main() {
  const paths = process.argv.slice(2);
  if (!paths.length) {
    console.error("usage: node scripts/check-content-guards.mjs <file> [<file> ...]");
    process.exit(1);
  }

  const { total, checked, issues } = checkFiles(paths);

  for (const { path: p, violations } of issues) {
    console.error(`content-guards: ${violations.length} issue(s) in ${p}:`);
    for (const v of violations) console.error(`  • [${v.rule}] ${v.message} — "${v.snippet}"`);
  }

  if (total) {
    console.error(`content-guards: ${total} issue(s) across ${checked} file(s) → fail.`);
    process.exit(1);
  }
  if (paths.length && !checked) {
    // Every path was unreadable. Neither real caller can hit this legitimately (see the
    // header comment) — it can only mean a bug fed this script the wrong paths. The
    // original fail-open gap (the P2 finding this fixes) let that case silently print a
    // "clean" pass; fail closed instead of guessing it's benign.
    console.error(`content-guards: 0 of ${paths.length} file(s) were readable — nothing was validated. Failing closed (this should never happen for a real caller — check the path list).`);
    process.exit(1);
  }
  console.log(`content-guards: ${checked} file(s) clean.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
