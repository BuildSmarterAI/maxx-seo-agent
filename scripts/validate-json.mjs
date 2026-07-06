#!/usr/bin/env node
// validate-json.mjs PATH [PATH…] — validates JSON/JSON-LD artifacts (schema/*.jsonld and
// *schema*.json). Beyond syntax, .jsonld files are checked for leaked operator
// placeholders (OPERATOR_INSERT_*, TODO markers, "[insert …]") and JSON-LD structure
// (@context + @type per top-level entity) — see scripts/lib/schema-lint.mjs (audit H2).
// Paths arrive as real arguments (never interpolated into evaluated source, so a crafted
// path can't break out into code or a shell — the REC-1 fix). Exit 0 = all valid,
// 1 = missing arg / unreadable / invalid.
import { readFileSync } from "node:fs";
import { lintSchemaArtifact } from "./lib/schema-lint.mjs";

const paths = process.argv.slice(2);
if (!paths.length) { console.error("validate-json: no path given"); process.exit(1); }

let failed = false;
for (const path of paths) {
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch (e) {
    console.error(`validate-json: cannot read ${path}: ${e.message}`);
    failed = true;
    continue;
  }
  const errors = lintSchemaArtifact(raw, { jsonLd: path.endsWith(".jsonld") });
  if (errors.length) {
    console.error(`validate-json: ${path} is invalid:`);
    errors.forEach((e) => console.error(` • ${e}`));
    failed = true;
  } else {
    console.log(`validate-json: ${path} is valid`);
  }
}

process.exit(failed ? 1 : 0);
