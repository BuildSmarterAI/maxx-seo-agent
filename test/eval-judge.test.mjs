// test/eval-judge.test.mjs — covers the pure pieces of the eval-gate judge (Candidate 5):
// config loading, prompt construction, verdict parsing, and the gate decision.
// The model call and git diff (side-effectful) are exercised in CI, not here.
//
// Run: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadConfig, buildPrompt, parseVerdict, decide } from "../scripts/eval-judge.mjs";

test("loadConfig: defaults", () => {
  const c = loadConfig({});
  assert.equal(c.baseRef, "origin/main");
  assert.equal(c.minScore, 3);
  assert.equal(c.model, "claude-haiku-4-5-20251001");
  assert.equal(c.maxDiffChars, 60000);
});

test("loadConfig: env overrides", () => {
  const c = loadConfig({ BASE_REF: "origin/dev", JUDGE_MIN_SCORE: "4", JUDGE_MODEL: "x", JUDGE_MAX_DIFF_CHARS: "100" });
  assert.equal(c.baseRef, "origin/dev");
  assert.equal(c.minScore, 4);
  assert.equal(c.model, "x");
  assert.equal(c.maxDiffChars, 100);
});

test("buildPrompt: embeds minScore and the diff, asks for JSON-only", () => {
  const p = buildPrompt({ minScore: 4 }, "DIFF_BODY_MARKER");
  assert.match(p, /ANY score < 4/);
  assert.match(p, /DIFF_BODY_MARKER/);
  assert.match(p, /Return ONLY JSON/);
  assert.match(p, /information_gain/);
});

test("parseVerdict: plain JSON", () => {
  const v = parseVerdict('{"pass":true,"scores":{"quality":5}}');
  assert.equal(v.pass, true);
  assert.equal(v.scores.quality, 5);
});

test("parseVerdict: tolerates ```json fences", () => {
  const v = parseVerdict('```json\n{"pass":false}\n```');
  assert.equal(v.pass, false);
});

test("parseVerdict: throws on non-JSON", () => {
  assert.throws(() => parseVerdict("totally not json"));
});

// A well-formed passing verdict: model passed, all four rubric dimensions ≥ minScore, no
// fabrication flag. decide() must re-derive the gate from these fields, never trust `pass` alone.
const fullPass = () => ({
  pass: true,
  scores: { quality: 5, brand_safety: 5, fact_checkability: 5, information_gain: 5 },
  fabrication_risk: false,
});

test("decide: passes a well-formed verdict clearing every rubric dimension", () => {
  assert.equal(decide(fullPass(), { minScore: 3 }), true);
});

test("decide: blocks when the model self-reports pass=false or a non-boolean pass", () => {
  assert.equal(decide({ ...fullPass(), pass: false }, { minScore: 3 }), false);
  assert.equal(decide({ ...fullPass(), pass: "true" }, { minScore: 3 }), false);
  assert.equal(decide(null), false);
});

// A4: the gate must NOT trust the model's `pass` bool against its own contradicting data.
test("decide: blocks pass=true when any rubric score is below minScore", () => {
  const v = { ...fullPass(), scores: { quality: 2, brand_safety: 5, fact_checkability: 5, information_gain: 5 } };
  assert.equal(decide(v, { minScore: 3 }), false);
});

// The model self-reporting pass=true while flagging fabrication is exactly the contradiction
// the gate must catch — including a truthy non-boolean flag (Haiku under JSON-only prompting
// can emit "true"/1), which must fail closed like the pass check does.
test("decide: blocks pass=true when fabrication_risk is set (any truthy value)", () => {
  for (const flag of [true, "true", "yes", 1]) {
    assert.equal(decide({ ...fullPass(), fabrication_risk: flag }, { minScore: 3 }), false,
      `fabrication_risk=${JSON.stringify(flag)} must block`);
  }
});

// Fail closed on any malformed / incomplete scores object.
test("decide: fails closed on missing, empty, incomplete, or non-numeric scores", () => {
  assert.equal(decide({ pass: true }, { minScore: 3 }), false);              // no scores object
  assert.equal(decide({ pass: true, scores: {} }, { minScore: 3 }), false);  // empty
  assert.equal(decide({ pass: true, scores: { quality: 5, brand_safety: 5, fact_checkability: 5 } }, { minScore: 3 }), false); // missing information_gain
  assert.equal(decide({ ...fullPass(), scores: { ...fullPass().scores, quality: "5" } }, { minScore: 3 }), false); // non-numeric
  assert.equal(decide({ ...fullPass(), scores: null }, { minScore: 3 }), false);
});

test("decide: enforces the config's minScore threshold", () => {
  const v = { ...fullPass(), scores: { quality: 3, brand_safety: 3, fact_checkability: 3, information_gain: 3 } };
  assert.equal(decide(v, { minScore: 3 }), true);
  assert.equal(decide(v, { minScore: 4 }), false);
});
