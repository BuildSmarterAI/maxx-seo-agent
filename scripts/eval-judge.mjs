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
export function loadConfig(env = process.env) {
  return {
    baseRef:      env.BASE_REF || "origin/main",
    minScore:     Number(env.JUDGE_MIN_SCORE || 3),
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

// The gate decision, pure: pass only on an explicit pass === true.
export function decide(verdict) {
  return verdict?.pass === true;
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

  let out = "";
  try {
    for await (const m of query({ prompt: buildPrompt(config, diff), options: { model: config.model, allowedTools: [] } })) {
      if ("result" in m) out = m.result;
    }
  } catch (e) {
    annotateError("model-call", e?.message || String(e));
    console.error("eval-judge: model call failed, failing closed.");
    return 1;
  }

  let verdict;
  try { verdict = parseVerdict(out); }
  catch {
    annotateError("unparseable", "model returned non-JSON output");
    console.error("eval-judge: unparseable output, failing closed:\n", out);
    return 1;
  }

  console.log(JSON.stringify(verdict, null, 2));

  if (!decide(verdict)) {
    annotateError("low-score", "verdict pass !== true (score below threshold or risk flag set).");
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
      annotateError("uncaught", e?.message || String(e));
      process.exit(1);
    });
}
