#!/usr/bin/env node
// eval-benchmark.mjs — RO-1 metric engine. Runs a judge config over the labelled eval_set
// and measures how well it separates good from bad:
//   false_pass  = a BAD example the judge let through (the dangerous error)
//   false_block = a GOOD example the judge rejected (throughput cost)
//   accuracy    = fraction classified correctly
//   auc         = P(judge scores a good example above a bad one) — rank separation
//
// The scoring functions are pure and exported for tests; runBenchmark takes an injectable
// judge so it is testable without a model call.
import { fileURLToPath } from "node:url";
import { loadConfig, decide, judgeText } from "./eval-judge.mjs";
import { evalSet } from "../orchestrator/lib/supabase.mjs";

const BENCH_LIMIT = Number(process.env.EVAL_BENCH_LIMIT || 60);

// Mean of the four sub-scores; higher = the judge thinks the content is better.
export function aggregateScore(verdict) {
  const s = verdict?.scores || {};
  const vals = ["quality", "brand_safety", "fact_checkability", "information_gain"]
    .map((k) => Number(s[k])).filter(Number.isFinite);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

// Predicted label from a verdict: pass → "good", anything else → "bad" (fail-closed).
export function classify(verdict) {
  return decide(verdict) ? "good" : "bad";
}

// Confusion over [{ actual, predicted }]. "bad" is the class we must not miss.
export function confusion(results) {
  let false_pass = 0, false_block = 0, correct = 0;
  for (const r of results) {
    if (r.actual === r.predicted) correct++;
    else if (r.actual === "bad" && r.predicted === "good") false_pass++;
    else if (r.actual === "good" && r.predicted === "bad") false_block++;
  }
  const n = results.length;
  return { n, false_pass, false_block, accuracy: n ? correct / n : 0 };
}

// AUC via the Mann–Whitney pairwise definition: over every (good, bad) pair, the fraction
// where the good example scored higher (ties count 0.5). 1.0 = perfect separation, 0.5 =
// random. scoredLabels: [{ score, label }].
export function auc(scoredLabels) {
  const good = scoredLabels.filter((x) => x.label === "good").map((x) => x.score);
  const bad  = scoredLabels.filter((x) => x.label === "bad").map((x) => x.score);
  if (!good.length || !bad.length) return null;
  let wins = 0;
  for (const g of good) for (const b of bad) wins += g > b ? 1 : g === b ? 0.5 : 0;
  return wins / (good.length * bad.length);
}

export function variantId(config) {
  return `${config.model}@min${config.minScore}`;
}

// Run a judge config over the eval_set. judge defaults to the real model call; tests inject
// a fake. Returns a judge_calibration-shaped report.
export async function runBenchmark(config = loadConfig(), { judge = judgeText, examples } = {}) {
  const set = (examples ?? (await evalSet())).slice(0, BENCH_LIMIT);
  const results = [];
  const scored = [];
  for (const ex of set) {
    let verdict;
    try { verdict = await judge(ex.artifact, config); }
    catch { verdict = { pass: false, scores: {} }; }   // unjudgeable → treat as a block
    results.push({ actual: ex.label, predicted: classify(verdict) });
    scored.push({ score: aggregateScore(verdict), label: ex.label });
  }
  const c = confusion(results);
  return {
    judge_variant: variantId(config),
    n: c.n, false_pass: c.false_pass, false_block: c.false_block,
    accuracy: Number(c.accuracy.toFixed(4)),
    auc: auc(scored) == null ? null : Number(auc(scored).toFixed(4)),
  };
}

async function main() {
  const report = await runBenchmark();
  console.log(JSON.stringify(report, null, 2));
  if (report.false_pass > 0) {
    console.warn(`eval-benchmark: ${report.false_pass} BAD example(s) passed the judge — calibration needed.`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
