// test/classify.test.mjs — pure cores of the competitor-domain classifier.
// Network call (classifyDomains) is NOT tested here; only prompt-build, response-parse,
// and the scoring-input selection that decides which domains count as rivals.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildClassifyPrompt,
  parseClassification,
  selectCompetitorDomains,
  normalizeDomain,
} from "../lib/classify.mjs";

// ---- normalizeDomain ----

test("normalizeDomain strips scheme, www, path, and lowercases", () => {
  assert.equal(normalizeDomain("https://www.Arrant.com/about"), "arrant.com");
  assert.equal(normalizeDomain("  ACME.COM  "), "acme.com");
  assert.equal(normalizeDomain("sub.example.com"), "sub.example.com");
});

test("normalizeDomain returns empty string for falsy/garbage", () => {
  assert.equal(normalizeDomain(""), "");
  assert.equal(normalizeDomain(null), "");
  assert.equal(normalizeDomain(undefined), "");
});

// ---- buildClassifyPrompt ----

test("buildClassifyPrompt names every domain, the own domain, and the three labels", () => {
  const p = buildClassifyPrompt(
    [
      { domain: "arrant.com", queries: ["warehouse cost texas"] },
      { domain: "rsmeans.com", queries: ["construction cost data"] },
    ],
    "maxxbuilders.com"
  );
  assert.match(p, /arrant\.com/);
  assert.match(p, /rsmeans\.com/);
  assert.match(p, /maxxbuilders\.com/);
  assert.match(p, /competitor/);
  assert.match(p, /reference/);
  assert.match(p, /noise/);
  // must instruct JSON output so parseClassification can read it
  assert.match(p, /JSON/i);
});

test("buildClassifyPrompt handles an empty item list without throwing", () => {
  const p = buildClassifyPrompt([], "maxxbuilders.com");
  assert.equal(typeof p, "string");
  assert.match(p, /maxxbuilders\.com/);
});

// ---- parseClassification ----

test("parseClassification reads a clean JSON array", () => {
  const out = parseClassification(
    JSON.stringify([
      { domain: "arrant.com", classification: "competitor", confidence: 0.9, rationale: "rival GC" },
    ])
  );
  assert.deepEqual(out, [
    { domain: "arrant.com", classification: "competitor", confidence: 0.9, rationale: "rival GC" },
  ]);
});

test("parseClassification extracts the array from code fences / surrounding prose", () => {
  const text = 'Here you go:\n```json\n[{"domain":"x.com","classification":"noise","confidence":0.5}]\n```\nDone.';
  const out = parseClassification(text);
  assert.equal(out.length, 1);
  assert.equal(out[0].domain, "x.com");
  assert.equal(out[0].classification, "noise");
});

test("parseClassification drops entries with an invalid label", () => {
  const out = parseClassification(
    JSON.stringify([
      { domain: "a.com", classification: "rival", confidence: 1 },
      { domain: "b.com", classification: "competitor", confidence: 1 },
    ])
  );
  assert.deepEqual(out.map((r) => r.domain), ["b.com"]);
});

test("parseClassification clamps confidence to 0..1 and defaults missing/NaN to 0", () => {
  const out = parseClassification(
    JSON.stringify([
      { domain: "a.com", classification: "competitor", confidence: 5 },
      { domain: "b.com", classification: "reference", confidence: -2 },
      { domain: "c.com", classification: "noise" },
      { domain: "d.com", classification: "competitor", confidence: "abc" },
    ])
  );
  const byDomain = Object.fromEntries(out.map((r) => [r.domain, r.confidence]));
  assert.equal(byDomain["a.com"], 1);
  assert.equal(byDomain["b.com"], 0);
  assert.equal(byDomain["c.com"], 0);
  assert.equal(byDomain["d.com"], 0);
});

test("parseClassification normalizes label case and domain, defaults rationale to ''", () => {
  const out = parseClassification(
    JSON.stringify([{ domain: "https://WWW.A.com/x", classification: "COMPETITOR", confidence: 0.8 }])
  );
  assert.equal(out[0].domain, "a.com");
  assert.equal(out[0].classification, "competitor");
  assert.equal(out[0].rationale, "");
});

test("parseClassification drops entries with no usable domain", () => {
  const out = parseClassification(
    JSON.stringify([
      { domain: "", classification: "competitor", confidence: 1 },
      { classification: "competitor", confidence: 1 },
    ])
  );
  assert.deepEqual(out, []);
});

test("parseClassification returns [] for non-JSON / garbage", () => {
  assert.deepEqual(parseClassification("the model refused to answer"), []);
  assert.deepEqual(parseClassification(""), []);
  assert.deepEqual(parseClassification(undefined), []);
  assert.deepEqual(parseClassification("{}"), []); // object, not array
});

test("parseClassification ignores a stray bracket in prose before the real array", () => {
  // regression: indexOf('[')/lastIndexOf(']') would slice from '[1]' and fail to parse
  const text = 'Citations [1] and [2] checked:\n[{"domain":"x.com","classification":"noise","confidence":0.5}]';
  const out = parseClassification(text);
  assert.equal(out.length, 1);
  assert.equal(out[0].domain, "x.com");
  assert.equal(out[0].classification, "noise");
});

test("parseClassification parses a bare array with no surrounding prose", () => {
  const out = parseClassification('[{"domain":"y.com","classification":"competitor","confidence":1}]');
  assert.equal(out.length, 1);
  assert.equal(out[0].domain, "y.com");
});

// ---- selectCompetitorDomains ----

test("selectCompetitorDomains takes competitor rows at or above the confidence floor", () => {
  const rows = [
    { domain: "a.com", classification: "competitor", confidence: 0.9, source: "auto" },
    { domain: "b.com", classification: "competitor", confidence: 0.6, source: "auto" },
    { domain: "c.com", classification: "reference", confidence: 0.99, source: "auto" },
    { domain: "d.com", classification: "noise", confidence: 0.99, source: "auto" },
  ];
  const out = selectCompetitorDomains(rows, [], 0.7);
  assert.deepEqual(out.sort(), ["a.com"]);
});

test("selectCompetitorDomains always includes a manual competitor pin below the floor", () => {
  const rows = [
    { domain: "pinned.com", classification: "competitor", confidence: 0, source: "manual" },
    { domain: "weak.com", classification: "competitor", confidence: 0.1, source: "auto" },
  ];
  const out = selectCompetitorDomains(rows, [], 0.7);
  assert.deepEqual(out, ["pinned.com"]);
});

test("selectCompetitorDomains always includes the env override list, normalized + deduped", () => {
  const rows = [{ domain: "a.com", classification: "competitor", confidence: 0.9, source: "auto" }];
  const out = selectCompetitorDomains(rows, ["https://www.A.com", "Manual.com"], 0.7);
  assert.deepEqual(out.sort(), ["a.com", "manual.com"]);
});

test("selectCompetitorDomains returns [] when nothing qualifies", () => {
  assert.deepEqual(selectCompetitorDomains([], [], 0.7), []);
  assert.deepEqual(
    selectCompetitorDomains([{ domain: "r.com", classification: "reference", confidence: 1, source: "auto" }], [], 0.7),
    []
  );
});
