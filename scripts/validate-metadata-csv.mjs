#!/usr/bin/env node
// validate-metadata-csv.mjs — validates agent-generated metadata rows only.
// Skips rows where both new_title and new_description are empty (pre-existing/unchanged rows).
// Rules (caps, no-op, cross-row uniqueness, canonical self-reference) live in
// ./lib/metadata.mjs so the importer enforces the exact same checks before staging.
// Fails (exit 1) if any agent-generated row is invalid.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsv, parseCsvRecords } from "./lib/csv.mjs";
import { validateMetadataRecords, normalizeRowKeys, REQUIRED_COLUMNS } from "./lib/metadata.mjs";

const csvPath = resolve(process.argv[2] || "metadata-changes.csv");

let raw;
try {
  raw = readFileSync(csvPath, "utf8");
} catch {
  console.error(`validate-metadata-csv: cannot read ${csvPath}`);
  process.exit(1);
}

const records = parseCsvRecords(raw).filter((rec) => rec.some((c) => c.trim() !== ""));
if (records.length < 2) {
  console.log("validate-metadata-csv: empty or header-only CSV → pass.");
  process.exit(0);
}

const header = records[0].map((h) => h.trim().toLowerCase());
const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
if (missing.length) {
  console.error("validate-metadata-csv: missing expected columns in header:", missing.join(", "));
  process.exit(1);
}

// normalizeRowKeys: parseCsv preserves header casing; the rules read lowercase keys.
// Without it, mixed-case headers ("New_Title") made every check silently vacuous.
const rows = normalizeRowKeys(parseCsv(raw));
const errors = validateMetadataRecords(rows);

if (errors.length) {
  console.error(`validate-metadata-csv: ${errors.length} issue(s) found:`);
  errors.forEach((e) => console.error(" •", e));
  process.exit(1);
}

console.log(`validate-metadata-csv: all agent-generated rows valid (${rows.length} rows checked, pre-existing unchanged rows skipped).`);
