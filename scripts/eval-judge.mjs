#!/usr/bin/env node
// eval-judge.mjs — LLM-as-judge over the PR diff. Fails closed: any error, unparseable
// output, low score, or fabrication/brand/YMYL risk → exit 1 (blocks auto-merge).
// Runs on cheap Haiku. Part of the eval-gate required check.
import { query } from "@anthropic-ai/claude-agent-sdk";
import { execSync } from "node:child_process";

const base = process.env.BASE_REF || "origin/main";
const MIN = Number(process.env.JUDGE_MIN_SCORE || 3);
const MODEL = process.env.JUDGE_MODEL || "claude-haiku-4-5-20251001";

const diff = execSync(
  `git diff ${base}...HEAD -- '*.md' '*.mdx' '*.html' '*.jsonld' '*.json'`,
  { maxBuffer: 20 * 1024 * 1024 }
).toString().slice(0, 60000);   // cap context

if (!diff.trim()) { console.log("eval-judge: no content diff to score → pass."); process.exit(0); }

const PROMPT = `You are a strict SEO content QA judge. Score ONLY the diff below.
Return ONLY JSON, no prose, no code fences:
{"pass":true|false,
 "scores":{"quality":1-5,"brand_safety":1-5,"fact_checkability":1-5,"information_gain":1-5},
 "fabrication_risk":true|false,
 "reasons":["..."]}
Set pass=false if ANY score < ${MIN}, OR fabrication_risk is true, OR the diff adds
unverifiable statistics, OR it edits pricing, brand/positioning claims, or YMYL
(legal/financial/health/safety) content. Be conservative.

DIFF:
${diff}`;

let out = "";
try {
  for await (const m of query({ prompt: PROMPT, options: { model: MODEL, allowedTools: [] } })) {
    if ("result" in m) out = m.result;
  }
} catch (e) {
  console.error("eval-judge: model call failed, failing closed:", e?.message || e);
  process.exit(1);
}

let verdict;
try { verdict = JSON.parse(out.replace(/```json|```/g, "").trim()); }
catch { console.error("eval-judge: unparseable output, failing closed:\n", out); process.exit(1); }

console.log(JSON.stringify(verdict, null, 2));
if (verdict.pass !== true) { console.error("eval-gate: judge did not pass → human review."); process.exit(1); }
console.log("eval-judge: pass.");
