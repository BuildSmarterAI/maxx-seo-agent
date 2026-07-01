#!/usr/bin/env node
// validate-json.mjs PATH — validates that PATH is parseable JSON (used for schema/*.jsonld
// and *schema*.json). Replaces the old `node -e "JSON.parse(require('fs').readFileSync('$file'..."`
// validator: the path arrives as process.argv[2] (a real argument), never interpolated into
// evaluated source, so a crafted path can't break out into code or a shell. Exit 0 = valid,
// 1 = missing arg / unreadable / invalid JSON.
import { readFileSync } from "node:fs";

const path = process.argv[2];
if (!path) { console.error("validate-json: no path given"); process.exit(1); }

try {
  JSON.parse(readFileSync(path, "utf8"));
  console.log(`validate-json: ${path} is valid JSON`);
} catch (e) {
  console.error(`validate-json: ${path} is invalid: ${e.message}`);
  process.exit(1);
}
