// test/content-guards.test.mjs — the deterministic content guards must catch the exact
// defect classes ACTION-PLAN.md found shipped live, and must NOT false-positive on normal
// prose or code. Pure functions, no DB needed.
//
// Run: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  scanPlaceholders, slugAsH1, cityMismatch, runGuards,
} from "../scripts/validators/content-guards.mjs";

const has = (violations, rule) => violations.some((v) => v.rule === rule);

test("scanPlaceholders catches the leaked HUMAN EDIT placeholder (ACTION-PLAN C7)", () => {
  const t = "Author: [HUMAN EDIT REQUIRED — insert real, credentialed author name + title]";
  assert.ok(has(scanPlaceholders(t), "human-edit-marker"), "human-edit marker flagged");
  // a standalone [insert …] bracket is its own defect class
  assert.ok(has(scanPlaceholders("Built [insert sq ft] of retail space."), "insert-placeholder"));
});

test("scanPlaceholders catches the WordPress default 'master' byline (ACTION-PLAN M1)", () => {
  assert.ok(has(scanPlaceholders("author: master"), "default-author"));
  assert.ok(has(scanPlaceholders('author = "master"'), "default-author"));
});

test("scanPlaceholders catches Editorial Team byline and Lorem ipsum and TODO", () => {
  assert.ok(has(scanPlaceholders("By Editorial Team"), "editorial-team"));
  assert.ok(has(scanPlaceholders("Lorem ipsum dolor sit amet"), "lorem-ipsum"));
  assert.ok(has(scanPlaceholders("TODO: write the conclusion"), "todo-marker"));
});

test("scanPlaceholders does NOT flag clean prose or a real named byline", () => {
  assert.equal(scanPlaceholders("By Harris Khan, Licensed GC with 18 years in Texas.").length, 0);
  assert.equal(scanPlaceholders("We master complex commercial builds across Houston.").length, 0,
    "'master' as a verb must not trip the default-author rule");
  assert.equal(scanPlaceholders("See our [hotel cost guide](/hotel/) for details.").length, 0,
    "markdown link brackets must not trip the insert-placeholder rule");
});

test("slugAsH1 catches a raw-slug H1 in markdown and HTML (ACTION-PLAN C6)", () => {
  assert.ok(has(slugAsH1("# the-ultimate-2026-hotel-construction-cost-guide-texas-edition"), "slug-as-h1"));
  assert.ok(has(slugAsH1("<h1>commercial-construction-cost-houston-tx</h1>"), "slug-as-h1"));
});

test("slugAsH1 does NOT flag a real title", () => {
  assert.equal(slugAsH1("# Hotel Construction Cost Guide: Texas 2026 Edition").length, 0);
  assert.equal(slugAsH1("<h1>Commercial Construction Cost in Houston, TX</h1>").length, 0);
  assert.equal(slugAsH1("# design-build").length, 0, "two-segment slug-ish title is allowed");
});

test("cityMismatch is opt-in and catches the San Antonio→Houston copy-paste (ACTION-PLAN C2)", () => {
  const body = "## Why Choose Maxx Builders in Houston?";
  assert.ok(has(cityMismatch(body, "San Antonio"), "city-mismatch"));
  assert.equal(cityMismatch(body, "Houston").length, 0, "matching city passes");
  assert.equal(cityMismatch(body).length, 0, "no intendedCity → no-op");
});

test("runGuards aggregates placeholder + slug checks; cityMismatch only with opts", () => {
  const bad = "# hotel-cost-guide-texas-edition\n\nAuthor: [HUMAN EDIT REQUIRED]";
  const v = runGuards(bad);
  assert.ok(has(v, "slug-as-h1") && has(v, "human-edit-marker"));
  assert.equal(runGuards("## Why Choose Maxx Builders in Houston?").length, 0,
    "city check skipped without opts.intendedCity");
  assert.ok(has(runGuards("## Why Choose Maxx Builders in Houston?", { intendedCity: "San Antonio" }), "city-mismatch"));
});

test("runGuards passes clean, complete content", () => {
  const good = "# Hotel Construction Cost Guide: Texas 2026 Edition\n\n" +
    "By Harris Khan, Licensed GC.\n\nTexas hotel construction runs $180–$320 per sq ft.";
  assert.equal(runGuards(good).length, 0);
});
