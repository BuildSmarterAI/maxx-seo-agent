// test/csv.test.mjs — RFC 4180 reader. These cases pin the behaviours the old
// split("\n").split(",") parsers got wrong: quoted commas, embedded newlines
// (the post-481 "blueprints" truncation), escaped quotes, and \r\n endings.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv, parseCsvRecords } from "../scripts/lib/csv.mjs";

test("keeps an embedded comma inside a quoted field on one column", () => {
  const csv = 'a,b,c\n1,"x, y, z",3';
  const rows = parseCsv(csv);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], { a: "1", b: "x, y, z", c: "3" });
});

test("preserves an embedded newline in a quoted field (the truncation root cause)", () => {
  const csv = 'url,description\n/p,"line one\nline two"\n/q,plain';
  const rows = parseCsv(csv);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].description, "line one\nline two");
  assert.equal(rows[1].description, "plain");
});

test("unescapes doubled quotes to a single literal quote", () => {
  const csv = 'a\n"she said ""hi"""';
  const rows = parseCsv(csv);
  assert.equal(rows[0].a, 'she said "hi"');
});

test("handles \\r\\n (Windows) line endings", () => {
  const csv = 'a,b\r\n1,2\r\n3,4\r\n';
  const rows = parseCsv(csv);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[1], { a: "3", b: "4" });
});

test("a trailing newline does not produce a phantom empty row", () => {
  assert.equal(parseCsv("a,b\n1,2\n").length, 1);
});

test("a blank line in the middle is skipped", () => {
  assert.equal(parseCsv("a,b\n1,2\n\n3,4\n").length, 2);
});

test("header-only input yields no rows", () => {
  assert.deepEqual(parseCsv("a,b,c"), []);
});

test("empty / non-string input yields no records", () => {
  assert.deepEqual(parseCsvRecords(""), []);
  assert.deepEqual(parseCsvRecords(undefined), []);
  assert.deepEqual(parseCsv(""), []);
});

test("a quoted field containing only a comma is one cell, not two", () => {
  // Regression guard for the validator: current_description with a comma must not
  // bleed into the new_description column.
  const csv = 'current_description,new_description\n"a, b",ok';
  const rows = parseCsv(csv);
  assert.equal(rows[0].current_description, "a, b");
  assert.equal(rows[0].new_description, "ok");
});

test("strips a leading UTF-8 BOM from the first header", () => {
  const rows = parseCsv("﻿a,b\n1,2");
  assert.deepEqual(rows[0], { a: "1", b: "2" });
});

test("parseCsvRecords returns untrimmed raw cells; parseCsv trims", () => {
  assert.deepEqual(parseCsvRecords("a,b\n 1 , 2 ")[1], [" 1 ", " 2 "]);
  assert.deepEqual(parseCsv("a,b\n 1 , 2 ")[0], { a: "1", b: "2" });
});
