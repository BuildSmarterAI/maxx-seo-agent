// test/import-metadata.test.mjs — the metadata-CSV import gate must (a) reject the
// defect classes that could otherwise reach production via the nightly wp:apply cron
// (over-cap title/description, unchanged no-op rows, duplicate/cannibalizing titles,
// and cross-page/malformed canonicals), and (b) stage every change_set row as `pending`
// so the ADR-005 human approval gate is never bypassed by the importer.
//
// Pure functions only — no DB, no network, no env. Run: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateMetadataRecords, buildChangeSetRow } from "../scripts/lib/metadata.mjs";

// A blank row keyed exactly like parseCsv() output; override only the fields under test.
const row = (o) => ({
  url: "https://www.maxxbuilders.com/x/",
  current_title: "", new_title: "",
  current_description: "", new_description: "",
  canonical: "", ...o,
});

test("clean rows produce no errors", () => {
  const rows = [row({
    new_title: "Fresh Title A",
    new_description: "A genuinely different, useful description of the page.",
    canonical: "https://www.maxxbuilders.com/x/",
  })];
  assert.deepEqual(validateMetadataRecords(rows), []);
});

test("over-cap title and description are rejected", () => {
  const errs = validateMetadataRecords([
    row({ new_title: "x".repeat(61) }),
    row({ new_description: "y".repeat(156) }),
  ]);
  assert.ok(errs.some((e) => /new_title too long/.test(e)), "over-cap title flagged");
  assert.ok(errs.some((e) => /new_description too long/.test(e)), "over-cap description flagged");
});

test("a value unchanged from current is rejected (no-op write)", () => {
  const errs = validateMetadataRecords([row({ current_title: "Same", new_title: "Same" })]);
  assert.ok(errs.some((e) => /new_title unchanged/.test(e)));
});

test("rows where the agent wrote nothing are skipped, not errored", () => {
  // both new_ fields empty → pre-existing row, ignored (matches prior validator semantics)
  assert.deepEqual(
    validateMetadataRecords([row({ current_title: "Old", current_description: "Old desc" })]),
    [],
  );
});

test("duplicate new_title across rows is rejected (cannibalization guard)", () => {
  const errs = validateMetadataRecords([
    row({ url: "https://www.maxxbuilders.com/a/", new_title: "Same Title", canonical: "https://www.maxxbuilders.com/a/" }),
    row({ url: "https://www.maxxbuilders.com/b/", new_title: "Same Title", canonical: "https://www.maxxbuilders.com/b/" }),
  ]);
  assert.ok(errs.some((e) => /duplicate new_title/.test(e)));
});

test("a canonical pointing at a different page is rejected", () => {
  const errs = validateMetadataRecords([row({
    url: "https://www.maxxbuilders.com/a/",
    new_title: "Title A",
    canonical: "https://www.maxxbuilders.com/some-other-page/",
  })]);
  assert.ok(errs.some((e) => /self-reference/.test(e)));
});

test("a malformed (non-absolute) canonical is rejected", () => {
  const errs = validateMetadataRecords([row({
    url: "https://www.maxxbuilders.com/a/",
    new_title: "Title A",
    canonical: "/relative/path/",
  })]);
  assert.ok(errs.some((e) => /absolute http/.test(e)));
});

test("a canonical-only edit (no title/description change) is still validated", () => {
  // The importer stages canonical with always:true, independent of title/description,
  // so a row that only changes canonical must NOT skip canonical validation.
  const errs = validateMetadataRecords([row({
    url: "https://www.maxxbuilders.com/a/",
    current_title: "Old Title", new_title: "",
    current_description: "Old desc", new_description: "",
    canonical: "https://www.maxxbuilders.com/some-other-page/",
  })]);
  assert.ok(errs.some((e) => /self-reference/.test(e)), "cross-page canonical on a canonical-only row is caught");
});

test("a canonical-only edit with a self-referencing canonical passes", () => {
  const errs = validateMetadataRecords([row({
    url: "https://www.maxxbuilders.com/a/",
    current_title: "Old Title", new_title: "",
    current_description: "Old desc", new_description: "",
    canonical: "https://www.maxxbuilders.com/a/",
  })]);
  assert.deepEqual(errs, []);
});

test("a self-referencing canonical passes despite a trailing-slash difference", () => {
  const errs = validateMetadataRecords([row({
    url: "https://www.maxxbuilders.com/a/",
    new_title: "Title A",
    canonical: "https://www.maxxbuilders.com/a",
  })]);
  assert.deepEqual(errs, []);
});

test("buildChangeSetRow stages rows as `pending`, never `approved` (ADR-005 gate)", () => {
  const r = buildChangeSetRow({
    page_id: "10", url: "https://www.maxxbuilders.com/a/",
    field: "title", base_value: "Old", new_value: "New", batch: "b1",
  });
  assert.equal(r.status, "pending", "importer must not self-approve");
  assert.equal(r.platform, "wordpress");
  assert.equal(r.field, "title");
  assert.equal(r.new_value, "New");
});
