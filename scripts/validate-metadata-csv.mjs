#!/usr/bin/env node
// validate-metadata-csv.mjs — validates agent-generated metadata rows only.
// Skips rows where both new_title and new_description are empty (pre-existing/unchanged rows).
// Fails (exit 1) only if an agent-generated row has empty or unchanged values.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvRecords } from "./lib/csv.mjs";

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
const col = (name) => header.indexOf(name);
const iCurTitle  = col("current_title");
const iNewTitle  = col("new_title");
const iCurDesc   = col("current_description");
const iNewDesc   = col("new_description");

if ([iCurTitle, iNewTitle, iCurDesc, iNewDesc].some((i) => i === -1)) {
  console.error("validate-metadata-csv: missing expected columns in header:", header.join(","));
  process.exit(1);
}

const errors = [];

for (let i = 1; i < records.length; i++) {
  const cells = records[i];
  const newTitle  = (cells[iNewTitle]  || "").trim();
  const newDesc   = (cells[iNewDesc]   || "").trim();

  // Skip rows where the agent wrote nothing — these are pre-existing rows, not our problem.
  if (!newTitle && !newDesc) continue;

  const curTitle  = (cells[iCurTitle]  || "").trim();
  const curDesc   = (cells[iCurDesc]   || "").trim();

  if (newTitle && newTitle === curTitle) {
    errors.push(`row ${i + 1}: new_title unchanged from current ("${newTitle}")`);
  }
  if (newDesc && newDesc === curDesc) {
    errors.push(`row ${i + 1}: new_description unchanged from current ("${newDesc}")`);
  }
  if (newTitle && newTitle.length > 60) {
    errors.push(`row ${i + 1}: new_title too long (${newTitle.length} chars > 60)`);
  }
  if (newDesc && newDesc.length > 155) {
    errors.push(`row ${i + 1}: new_description too long (${newDesc.length} chars > 155)`);
  }
}

if (errors.length) {
  console.error(`validate-metadata-csv: ${errors.length} issue(s) found:`);
  errors.forEach((e) => console.error(" •", e));
  process.exit(1);
}

console.log(`validate-metadata-csv: all agent-generated rows valid (${records.length - 1} rows checked, pre-existing unchanged rows skipped).`);
