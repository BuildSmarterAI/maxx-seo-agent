#!/usr/bin/env node
// judge-calibrate.mjs — RO-1 loop. Benchmarks the current champion judge config plus a few
// candidate variants against the eval_set, records each to judge_calibration, and RECOMMENDS
// (never auto-applies) the best. A human ratifies by updating the JUDGE_MIN_SCORE / JUDGE_MODEL
// GitHub vars — this script does not swap any env or config (governance invariant).
//
// override_rate is null in v1: it needs persisted per-PR judge verdicts + merge/revert events,
// which don't exist yet. We calibrate against the labelled eval_set only.
import { fileURLToPath } from "node:url";
import { loadConfig } from "./eval-judge.mjs";
import { runBenchmark } from "./eval-benchmark.mjs";
import { recordJudgeCalibration } from "../orchestrator/lib/supabase.mjs";

// Champion = the live config; candidates vary the threshold and the model tier. Each is a
// distinct judge_variant. Keep the set small — every variant is N model calls.
export function candidateConfigs(champion = loadConfig()) {
  const variants = [
    { ...champion },                                   // champion as-is
    { ...champion, minScore: champion.minScore + 1 },  // stricter threshold
    { ...champion, model: "claude-sonnet-4-6" },       // stronger judge tier
  ];
  // de-dup by (model,minScore) so an env that already equals a candidate isn't double-run
  const seen = new Set();
  return variants.filter((v) => {
    const k = `${v.model}@${v.minScore}`;
    if (seen.has(k)) return false; seen.add(k); return true;
  });
}

// Pick the best report: fewest false_pass first (never miss bad content), then highest AUC.
export function pickChampion(reports) {
  return [...reports].sort((a, b) =>
    a.false_pass - b.false_pass || (b.auc ?? 0) - (a.auc ?? 0)
  )[0];
}

async function main() {
  const champion = loadConfig();
  const reports = [];
  for (const cfg of candidateConfigs(champion)) {
    const r = await runBenchmark(cfg);
    reports.push(r);
    const isChampion = false; // status decided after all run; placeholder for clarity
    await recordJudgeCalibration({
      judge_variant: r.judge_variant, auc: r.auc, override_rate: null,
      false_pass: r.false_pass, false_block: r.false_block, n: r.n,
      status: isChampion ? "champion" : "shadow",
    });
    console.log(`  ${r.judge_variant}: false_pass=${r.false_pass} false_block=${r.false_block} auc=${r.auc} n=${r.n}`);
  }

  if (!reports.length) { console.log("judge-calibrate: eval_set empty → nothing to calibrate."); return; }

  const best = pickChampion(reports);
  const live = `${champion.model}@min${champion.minScore}`;
  console.log(`\njudge-calibrate: recommended champion → ${best.judge_variant} ` +
    `(false_pass=${best.false_pass}, auc=${best.auc}). Live config is ${live}.`);
  if (best.judge_variant !== live) {
    console.log("Action (human): set JUDGE_MODEL / JUDGE_MIN_SCORE GitHub vars to match the " +
      "recommendation, then re-run. This script does not change config automatically.");
  } else {
    console.log("Live config is already the best of the tested variants — no change recommended.");
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
