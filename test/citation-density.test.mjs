// test/citation-density.test.mjs — the deterministic citation-worthiness core: statistic
// density, sourced quotations, and outbound source citations (KDD '24 GEO markers). The CLI
// wrapper's own control flow is covered separately in test/check-citation-density.test.mjs.
//
// Run: node --test
import { test } from "node:test";
import assert from "node:assert/strict";

import { scoreCitationDensity, citationDensityViolations } from "../scripts/validators/citation-density.mjs";

const richBody = `
# Medical office construction cost in Texas

Costs run **$285 to $520 per square foot** in 2026, roughly 18% higher than 2023.
A typical 12,000 sq ft imaging center in the Houston Energy Corridor priced out at
$4,200,000, and infusion suites came in 3.2x the cost of standard tenant finish.

> "Steel lead times drove roughly 1 in 3 of our schedule overruns," said the project lead.

Per the [Associated General Contractors index](https://www.agc.org/data), input costs
rose 9% year over year.
`;

test("scoreCitationDensity counts statistics, quotations, and outbound citations", () => {
  const s = scoreCitationDensity(richBody);
  assert.ok(s.statistics >= 5, `expected >=5 statistics, got ${s.statistics}`);
  assert.ok(s.quotations >= 1, `expected >=1 quotation, got ${s.quotations}`);
  assert.equal(s.citations, 1);
  assert.ok(s.words > 0);
});

test("a $-money span is counted once, not double-counted as a grouped-thousands number", () => {
  const s = scoreCitationDensity("The build cost $1,200,000 in total. ".repeat(1));
  assert.equal(s.statistics, 1);
});

test("selfDomain excludes internal links from the citation count", () => {
  const text = `See [our guide](https://www.maxxbuilders.com/guide) and the
    [BLS data](https://www.bls.gov/ppi).`;
  assert.equal(scoreCitationDensity(text).citations, 2);
  assert.equal(scoreCitationDensity(text, { selfDomain: "maxxbuilders.com" }).citations, 1);
});

test("inline quoted term under 6 words is NOT counted as a sourced quotation", () => {
  const s = scoreCitationDensity('We call this a "design-build" delivery model.');
  assert.equal(s.quotations, 0);
});

test("citationDensityViolations passes a rich, long-enough document", () => {
  // Pad to clear the minWords floor while keeping the evidence markers.
  const doc = richBody + " lorem word".repeat(120);
  const v = citationDensityViolations(doc, { selfDomain: "maxxbuilders.com" });
  assert.equal(v.length, 0, JSON.stringify(v));
});

test("citationDensityViolations flags a long, evidence-poor document", () => {
  const thin = "Our team builds great commercial spaces across the state. ".repeat(40);
  const v = citationDensityViolations(thin);
  const rules = v.map((x) => x.rule).sort();
  assert.deepEqual(rules, ["citation-count", "quotation-count", "statistic-density"]);
});

test("documents below minWords are not gated", () => {
  const stub = "Short blurb with no data.";
  assert.deepEqual(citationDensityViolations(stub), []);
});

test("empty input scores zero and produces no violations", () => {
  assert.deepEqual(scoreCitationDensity(""), {
    words: 0, statistics: 0, quotations: 0, citations: 0, statsPer1k: 0, quotesPer1k: 0, citationsPer1k: 0,
  });
  assert.deepEqual(citationDensityViolations(""), []);
});
