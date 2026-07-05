#!/usr/bin/env node
// eval-judge.mjs — LLM-as-judge over the PR diff. Fails closed: any error, an oversized
// diff, unparseable output, low score, or fabrication/brand/YMYL risk → exit 1 (blocks
// auto-merge). Each failure type emits a distinct ::error:: GitHub annotation so the PR
// checks UI / Actions summary can tell them apart. Runs on cheap Haiku; part of the
// eval-gate required check.
//
// Config + prompt/parse/decide are pure and exported for tests; see test/eval-judge.test.mjs.
import { query } from "@anthropic-ai/claude-agent-sdk";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Scalar knobs, read once. JUDGE_MAX_DIFF_CHARS defaults to the prior hard-coded cap.
// A non-numeric JUDGE_MIN_SCORE (typo, e.g. "min4") must fail loudly here — left unchecked,
// Number(...) silently produces NaN, `v >= NaN` is false for every rubric dimension, and
// every PR blocks with the misleading "low-score" annotation instead of naming the real cause.
export function loadConfig(env = process.env) {
  const minScore = Number(env.JUDGE_MIN_SCORE || 3);
  if (!Number.isFinite(minScore)) {
    const err = new Error(`JUDGE_MIN_SCORE must be a finite number, got "${env.JUDGE_MIN_SCORE}"`);
    err.kind = "config-error";
    throw err;
  }
  return {
    baseRef:      env.BASE_REF || "origin/main",
    minScore,
    model:        env.JUDGE_MODEL || "claude-haiku-4-5-20251001",
    maxDiffChars: Number(env.JUDGE_MAX_DIFF_CHARS || 60000),
  };
}

export function buildPrompt(config, diff) {
  return `You are a strict SEO content QA judge. Score ONLY the diff below.
Return ONLY JSON, no prose, no code fences:
{"pass":true|false,
 "scores":{"quality":1-5,"brand_safety":1-5,"fact_checkability":1-5,"information_gain":1-5},
 "fabrication_risk":true|false,
 "reasons":["..."]}
Set pass=false if ANY score < ${config.minScore}, OR fabrication_risk is true, OR the diff adds
unverifiable statistics, OR it edits pricing, brand/positioning claims, or YMYL
(legal/financial/health/safety) content. Be conservative.

DIFF:
${diff}`;
}

// Parse the model's JSON, tolerating ```json fences. Throws on unparseable output.
export function parseVerdict(out) {
  return JSON.parse(out.replace(/```json|```/g, "").trim());
}

// The four rubric dimensions buildPrompt asks the judge to score. decide() requires every
// one to be present and ≥ minScore; a verdict missing a dimension is malformed → fails closed.
// Keep in sync with the JSON template in buildPrompt.
export const SCORE_DIMENSIONS = ["quality", "brand_safety", "fact_checkability", "information_gain"];

// The gate decision, pure and fail-closed. The model self-reports `pass`, but we never trust
// it alone (a self-report can contradict the model's own scores): re-derive the verdict from
// the structured fields it also returned. Block unless the model passed AND every rubric
// dimension is a finite number ≥ minScore AND fabrication_risk is present and explicitly
// `false`. Any missing, malformed, or non-numeric score → block; a missing fabrication_risk
// key → block (the same fail-closed treatment as a missing score, not a silent pass).
export function decide(verdict, config = loadConfig()) {
  if (verdict?.pass !== true) return false;
  // Require the key present and explicitly `false` — a missing key (the most common
  // small-model JSON-drift mode) must fail closed the same as a missing score dimension,
  // not silently pass because `undefined` happens to be falsy.
  if (verdict.fabrication_risk !== false) return false;
  const scores = verdict.scores;
  if (!scores || typeof scores !== "object") return false;
  return SCORE_DIMENSIONS.every((k) => {
    const v = scores[k];
    return typeof v === "number" && Number.isFinite(v) && v >= config.minScore;
  });
}

// Judge a single piece of text: build the prompt, call the model, parse the verdict.
// Throws on model-call failure or unparseable output (callers fail closed). Shared by
// main() (the PR-diff gate) and scripts/eval-benchmark.mjs (per-example calibration), so
// both exercise the identical judging path.
export async function judgeText(text, config = loadConfig()) {
  let out = "";
  try {
    for await (const m of query({ prompt: buildPrompt(config, text), options: { model: config.model, allowedTools: [] } })) {
      if ("result" in m) out = m.result;
    }
  } catch (e) {
    const err = new Error(e?.message || String(e)); err.kind = "model-call"; throw err;
  }
  try { return parseVerdict(out); }
  catch { const err = new Error("model returned non-JSON output"); err.kind = "unparseable"; err.raw = out; throw err; }
}

// Distinct GitHub Actions annotation per failure type → breaks down in the checks UI.
function annotateError(type, detail) {
  console.error(`::error title=eval-judge (${type})::${detail}`);
}

async function main(config = loadConfig()) {
  const diff = execSync(
    `git diff ${config.baseRef}...HEAD -- '*.md' '*.mdx' '*.html' '*.jsonld' '*.json'`,
    { maxBuffer: 20 * 1024 * 1024 }
  ).toString();

  if (!diff.trim()) { console.log("eval-judge: no content diff to score → pass."); return 0; }

  // Fail closed rather than score a partial diff — problems can hide in the truncated tail.
  if (diff.length > config.maxDiffChars) {
    annotateError("diff-too-large",
      `diff is ${diff.length} chars (cap ${config.maxDiffChars}); escalating to human review.`);
    console.error("eval-gate: diff too large to fully judge → human review.");
    return 1;
  }

  let verdict;
  try {
    verdict = await judgeText(diff, config);
  } catch (e) {
    if (e?.kind === "unparseable") {
      annotateError("unparseable", "model returned non-JSON output");
      console.error("eval-judge: unparseable output, failing closed:\n", e.raw ?? "");
    } else {
      annotateError("model-call", e?.message || String(e));
      console.error("eval-judge: model call failed, failing closed.");
    }
    return 1;
  }

  console.log(JSON.stringify(verdict, null, 2));

  if (!decide(verdict, config)) {
    annotateError("low-score", "verdict blocked: pass !== true, a score below threshold, or a risk flag set.");
    console.error("eval-gate: judge did not pass → human review.");
    return 1;
  }

  console.log("eval-judge: pass.");
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
    .then((code) => process.exit(code))
    .catch((e) => {
      annotateError(e?.kind || "uncaught", e?.message || String(e));
      process.exit(1);
    });
}
