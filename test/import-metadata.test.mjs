// test/import-metadata.test.mjs — the metadata-CSV import gate must (a) reject the
// defect classes that could otherwise reach production via the nightly wp:apply cron
// (over-cap title/description, unchanged no-op rows, duplicate/cannibalizing titles,
// and cross-page/malformed canonicals), and (b) stage every change_set row as `pending`
// so the ADR-005 human approval gate is never bypassed by the importer.
//
// Pure functions only — no DB, no network, no env (the CLI regression test spawns the
// validator script, which is also env-free). Run: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { writeFileSync, rmSync, mkdtempSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { validateMetadataRecords, buildChangeSetRow, computeChanges, normalizeRowKeys } from "../scripts/lib/metadata.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

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

// ── computeChanges (M4) ────────────────────────────────────────────────────────
// The row→change_set-field mapping. canonical must carry a NULL base_value (the importer
// has no reliable live canonical baseline), so cms.drifted() skips the check instead of
// escalating against a guessed "" every time the live canonical differs. title/description
// keep their prior semantics: staged only when they actually change, base = CSV current_*.

test("computeChanges stages canonical with a null base_value, not '' (no spurious drift)", () => {
  const canon = computeChanges(row({ canonical: "https://www.maxxbuilders.com/x/" }))
    .find((c) => c.field === "canonical");
  assert.ok(canon, "canonical change is staged");
  assert.equal(canon.base_value, null, "null baseline → cms.drifted() short-circuits, no spurious escalation");
  assert.equal(canon.new_value, "https://www.maxxbuilders.com/x/");
});

test("computeChanges stages title only when it changes, with CSV current as base_value", () => {
  const changed = computeChanges(row({ current_title: "Old", new_title: "New" }))
    .find((c) => c.field === "title");
  assert.ok(changed);
  assert.equal(changed.base_value, "Old");
  assert.equal(changed.new_value, "New");
  const unchanged = computeChanges(row({ current_title: "Same", new_title: "Same" }))
    .find((c) => c.field === "title");
  assert.equal(unchanged, undefined, "an unchanged title is not staged");
});

test("computeChanges stages description with the same rules as title", () => {
  const d = computeChanges(row({ current_description: "Old d", new_description: "New d" }))
    .find((c) => c.field === "description");
  assert.ok(d);
  assert.equal(d.base_value, "Old d");
  assert.equal(d.new_value, "New d");
});

test("computeChanges stages canonical even when title/description are unchanged", () => {
  const fields = computeChanges(row({
    current_title: "T", new_title: "T",             // unchanged
    current_description: "D", new_description: "D",  // unchanged
    canonical: "https://www.maxxbuilders.com/x/",
  })).map((c) => c.field);
  assert.deepEqual(fields, ["canonical"]);
});

test("computeChanges returns [] for a row with no changes and no canonical", () => {
  assert.deepEqual(computeChanges(row({ current_title: "T", new_title: "T" })), []);
});

// ── cross-review fixes ─────────────────────────────────────────────────────────
// Findings confirmed by the 2026-07-04 adversarial cross-review of PR #57.

// HIGH: the self-reference check must FAIL CLOSED when the row's url can't be parsed
// as an absolute http(s) URL. Previously the check silently skipped, so a schemeless
// url + cross-domain canonical validated green and could reach the live site.
test("a canonical with a schemeless row url is rejected, not silently skipped (fail closed)", () => {
  const errs = validateMetadataRecords([row({
    url: "www.maxxbuilders.com/a/",                       // no scheme → unparseable
    new_title: "Title A",
    canonical: "https://competitor.com/steal/",           // cross-domain!
  })]);
  assert.ok(errs.length > 0, "must error, not pass green");
  assert.ok(errs.some((e) => /cannot verify canonical self-reference/.test(e)), errs.join("; "));
});

test("a canonical with an empty row url is rejected (fail closed)", () => {
  const errs = validateMetadataRecords([row({
    url: "",
    canonical: "https://www.maxxbuilders.com/a/",
  })]);
  assert.ok(errs.some((e) => /cannot verify canonical self-reference/.test(e)), errs.join("; "));
});

// MEDIUM: canonicals carrying a query string or fragment must be rejected — normalizeUrl
// ignores search/hash, so "?replytocom=99" previously passed the self-reference check and
// would consolidate signal onto a parameterized URL.
test("a canonical carrying a query string is rejected", () => {
  const errs = validateMetadataRecords([row({
    url: "https://www.maxxbuilders.com/a/",
    new_title: "Title A",
    canonical: "https://www.maxxbuilders.com/a/?replytocom=99",
  })]);
  assert.ok(errs.some((e) => /query string or fragment/.test(e)), errs.join("; "));
});

test("a canonical carrying a fragment is rejected", () => {
  const errs = validateMetadataRecords([row({
    url: "https://www.maxxbuilders.com/a/",
    canonical: "https://www.maxxbuilders.com/a/#section",
  })]);
  assert.ok(errs.some((e) => /query string or fragment/.test(e)), errs.join("; "));
});

// MEDIUM: a non-default port is a different origin — must not count as self-referencing.
test("a canonical on a non-default port does not self-reference", () => {
  const errs = validateMetadataRecords([row({
    url: "https://www.maxxbuilders.com/a/",
    canonical: "https://www.maxxbuilders.com:8080/a/",
  })]);
  assert.ok(errs.some((e) => /self-reference/.test(e)), errs.join("; "));
});

// LOW: page_id, when supplied, must be numeric — it is trusted verbatim downstream.
test("a non-numeric page_id on a touched row is rejected", () => {
  const errs = validateMetadataRecords([row({ new_title: "Title A", page_id: "2020; drop" })]);
  assert.ok(errs.some((e) => /page_id must be numeric/.test(e)), errs.join("; "));
});

test("a numeric or empty page_id passes", () => {
  assert.deepEqual(validateMetadataRecords([row({ new_title: "Title A", page_id: "2020" })]), []);
  assert.deepEqual(validateMetadataRecords([row({ new_title: "Title B", page_id: "" })]), []);
});

// MEDIUM (header-case regression): parseCsv preserves header casing but every rule reads
// lowercase keys — mixed-case headers made validation silently vacuous. normalizeRowKeys
// is the shared repair both the CLI validator and the importer apply after parseCsv.
test("normalizeRowKeys lowercases keys so mixed-case CSV headers still validate", () => {
  const raw = [{ URL: "https://www.maxxbuilders.com/a/", New_Title: "x".repeat(61), "current_title": "Old" }];
  const norm = normalizeRowKeys(raw);
  assert.equal(norm[0].url, "https://www.maxxbuilders.com/a/");
  assert.equal(norm[0].new_title, "x".repeat(61));
  const errs = validateMetadataRecords(norm);
  assert.ok(errs.some((e) => /new_title too long/.test(e)), "over-cap caught after normalization");
});

test("CLI validator catches an over-cap title under mixed-case headers (regression pin)", () => {
  const dir = mkdtempSync(join(tmpdir(), "meta-csv-"));
  const csvPath = join(dir, "mixed-case.csv");
  writeFileSync(csvPath, [
    "url,page_id,Current_Title,New_Title,current_description,New_Description,canonical",
    `https://www.maxxbuilders.com/a/,,Old Title,${"x".repeat(80)},,,`,
  ].join("\n"), "utf8");
  try {
    const res = spawnSync(process.execPath, [join(REPO_ROOT, "scripts", "validate-metadata-csv.mjs"), csvPath], { encoding: "utf8" });
    assert.equal(res.status, 1, `validator must exit 1 on an over-cap title regardless of header casing\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);
    assert.ok(/new_title too long/.test(res.stderr), res.stderr);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
