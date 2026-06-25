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

test("decide: pass only on explicit pass === true", () => {
  assert.equal(decide({ pass: true }), true);
  assert.equal(decide({ pass: false }), false);
  assert.equal(decide({}), false);            // missing pass → fail closed
  assert.equal(decide({ pass: "true" }), false); // non-boolean → fail closed
  assert.equal(decide(null), false);
});
