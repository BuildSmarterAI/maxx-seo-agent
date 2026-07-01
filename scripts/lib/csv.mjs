// scripts/lib/csv.mjs — dependency-free RFC 4180 CSV reader.
//
// Why this exists: the previous hand-rolled parsers split on "\n" first and only
// then on ",", so a quoted field containing an embedded newline (or, in the
// validator's case, an embedded comma) was silently truncated/mis-columned. That
// was the root cause of the post-481 "blueprints" metadata truncation. This reader
// walks the text as a single character stream and respects quoting, so quoted
// commas, embedded newlines (\n, \r\n, bare \r), and escaped quotes ("") survive.
//
//   parseCsvRecords(text) → string[][]                      raw records (row 0 = header)
//   parseCsv(text)        → Array<Record<string,string>>    rows keyed by trimmed header

// Walk the stream into raw records. Cell values are returned verbatim (untrimmed);
// callers that want trimmed convenience values use parseCsv.
export function parseCsvRecords(text) {
  if (typeof text !== "string" || text.length === 0) return [];
  // Strip a leading UTF-8 BOM so the first header isn't prefixed with ﻿.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const records = [];
  let record = [];
  let field = "";
  let inQuotes = false;
  let dirty = false; // did this record receive any field/char yet?

  const endField = () => { record.push(field); field = ""; };
  const endRecord = () => { endField(); records.push(record); record = []; dirty = false; };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } // escaped quote ("")
        else inQuotes = false;                           // closing quote
      } else {
        field += ch;                                     // literal (incl. , and newlines)
      }
      dirty = true;
      continue;
    }

    if (ch === '"') { inQuotes = true; dirty = true; continue; }
    if (ch === ",") { endField(); dirty = true; continue; }
    if (ch === "\n") { endRecord(); continue; }
    if (ch === "\r") {                                    // \r or \r\n
      if (text[i + 1] === "\n") i++;
      endRecord();
      continue;
    }
    field += ch;
    dirty = true;
  }

  // Flush a trailing record only if the file didn't already end on a newline.
  if (dirty || field !== "" || record.length > 0) endRecord();

  return records;
}

// Convenience layer: map each data record onto an object keyed by the trimmed
// header, with trimmed values (matches the prior consumers' expectations). Fully
// blank lines are dropped so a trailing newline never yields a phantom row.
export function parseCsv(text) {
  const records = parseCsvRecords(text);
  if (records.length === 0) return [];

  const headers = records[0].map((h) => h.trim());
  const rows = [];
  for (let r = 1; r < records.length; r++) {
    const rec = records[r];
    if (rec.length === 1 && rec[0].trim() === "") continue; // blank line
    const row = {};
    headers.forEach((h, idx) => { row[h] = (rec[idx] ?? "").trim(); });
    rows.push(row);
  }
  return rows;
}
