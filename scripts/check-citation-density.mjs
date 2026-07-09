#!/usr/bin/env node
// check-citation-density.mjs — runs the deterministic citation-density gate over one or more
// content files (drafts). It is the citation-worthiness sibling of check-entity-density.mjs:
// it fails (exit 1) when a page lacks the statistics / quotations / outbound source citations
// that the KDD '24 GEO study found lift AI-citation rates the most.
//
// Callers: the eval-gate CI step (changed files, `git diff --diff-filter=ACM`, i.e.
// Added/Copied/Modified only; the workflow skips this script when that list is empty). Like
// check-content-guards.mjs, a non-empty path list where every path is unreadable can only
// mean a bug fed the wrong paths, so it fails closed rather than passing silently.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { citationDensityViolations } from "./validators/citation-density.mjs";

// Pure(ish) core: reads each path (readFile injectable → testable without a real filesystem)
// and runs the deterministic gate. Missing/unreadable files are skipped, not failed — CI
// passes a changed-file list that may include deletions. Returns enough detail for the CLI
// to report accurately, including when zero files were actually validated (fail-closed).
export function checkFiles(paths, readFile = (p) => readFileSync(resolve(p), "utf8")) {
  const thresholds = { selfDomain: process.env.TARGET_DOMAIN || process.env.WP_BASE_URL };
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
    const violations = citationDensityViolations(text, thresholds);
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
    console.error("usage: node scripts/check-citation-density.mjs <file> [<file> ...]");
    process.exit(1);
  }

  const { total, checked, issues } = checkFiles(paths);

  for (const { path: p, violations } of issues) {
    console.error(`citation-density: ${violations.length} issue(s) in ${p}:`);
    for (const v of violations) console.error(`  • [${v.rule}] ${v.message}`);
  }

  if (total) {
    console.error(`citation-density: ${total} issue(s) across ${checked} file(s) → fail. Enrich with statistics, a sourced quote, and an outbound citation.`);
    process.exit(1);
  }
  if (paths.length && !checked) {
    console.error(`citation-density: 0 of ${paths.length} file(s) were readable — nothing was validated. Failing closed (this should never happen for a real caller — check the path list).`);
    process.exit(1);
  }
  console.log(`citation-density: ${checked} file(s) meet the citation-worthiness bar.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
