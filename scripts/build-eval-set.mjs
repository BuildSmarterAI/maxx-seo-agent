#!/usr/bin/env node
// build-eval-set.mjs — RO-6: populate/refresh the eval_set benchmark that RO-1 (judge
// calibration) and later RO-2 (prompt optimization) score against.
//
// Two sources, idempotent:
//   (a) a deterministic SYNTHETIC SEED — balanced good/bad skill outputs, one bad per known
//       failure mode — so the benchmark is runnable on day one with no historical data.
//   (b) MINED real examples (when outcomes + artifacts exist) — top/bottom realized-lift
//       blog drafts, joined to their drafts/{slug}.md files. Bounded by EVAL_MINE_LIMIT.
//
// Pure helpers (syntheticSeed/dedupeKey/quartileSplit) are exported for tests.
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  evalSet, insertEvalExample, appliedDecisions, clicksAround, positionAround,
} from "../orchestrator/lib/supabase.mjs";

const MINE_LIMIT = Number(process.env.EVAL_MINE_LIMIT || 40);
const LAG = Number(process.env.ATTR_LAG_DAYS || 28);

// ---- (a) synthetic seed ---------------------------------------------------------------
// Balanced good/bad. The bad rows cover the classes the LLM judge (not the deterministic
// content-guards regex) must catch: fabricated_stat, doorway, cannibalizing, brand_pricing,
// plus placeholder (which both layers should catch). source='synthetic', no realized_lift.
const GOOD = [
  { change_type: "metadata-generate", failure_mode: null,
    artifact: "Hotel Construction Cost in Texas (2026 Guide) | Maxx Builders — Texas hotel builds run $180–$320/sq ft; see cost drivers, timelines, and a worked Home2 Suites example." },
  { change_type: "blog-write", failure_mode: null,
    artifact: "# Medical Office Construction Costs in Texas (2026)\n\n**Quick answer:** Texas medical office construction runs $250–$450 per square foot in 2026, driven by MEP density and TDLR compliance.\n\nBy Harris Khan, Licensed GC — based on Maxx Builders' completed Pasadena and Pflugerville projects." },
  { change_type: "schema-generate", failure_mode: null,
    artifact: '{"@context":"https://schema.org","@type":"GeneralContractor","name":"Maxx Builders","telephone":"+1-832-871-4166","priceRange":"$$$","areaServed":{"@type":"State","name":"Texas"}}' },
  { change_type: "metadata-generate", failure_mode: null,
    artifact: "Warehouse Construction Cost Per Square Foot in Texas | Maxx Builders — Tilt-wall vs structural-steel costs, clear-height tradeoffs, and a Texas distribution-center example." },
  { change_type: "blog-write", failure_mode: null,
    artifact: "# Design-Build vs General Contracting in Texas\n\n**Quick answer:** Design-build consolidates design and construction under one contract, typically cutting commercial project timelines 15–30% versus design-bid-build.\n\nBy Harris Khan, Licensed GC." },
];

const BAD = [
  { change_type: "blog-write", failure_mode: "fabricated_stat",
    artifact: "# Hotel Construction in Texas\n\nStudies show 87.3% of Texas hotels finish under budget, and experts agree costs dropped 42% last quarter. Industry data confirms this is the best time in history to build." },
  { change_type: "local-page-plan", failure_mode: "doorway",
    artifact: "# Commercial Construction in San Antonio\n\n## Why Choose Maxx Builders in Houston?\n\nMaxx Builders is the premier commercial contractor in [City]. We serve [City] and surrounding areas with quality construction." },
  { change_type: "blog-write", failure_mode: "cannibalizing",
    artifact: "# 8 Key Considerations for Building a Restaurant\n\nWhen building a restaurant you must consider cost, layout, kitchen, and permits. Cost-efficient strategies for restaurant construction start with planning your restaurant build cost carefully." },
  { change_type: "blog-write", failure_mode: "placeholder",
    artifact: "# Warehouse Construction Guide\n\nAuthor: [HUMAN EDIT REQUIRED — insert real, credentialed author name + title]\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit." },
  { change_type: "metadata-generate", failure_mode: "brand_pricing",
    artifact: "Cheapest Contractor in Texas — Guaranteed Lowest Prices, 50% Off All Commercial Builds This Month Only! Call now for rock-bottom pricing." },
];

export function syntheticSeed() {
  const tag = (rows, label) => rows.map((r) => ({
    change_type: r.change_type, url: null, artifact: r.artifact,
    label, failure_mode: r.failure_mode, realized_lift: null, source: "synthetic",
  }));
  return [...tag(GOOD, "good"), ...tag(BAD, "bad")];
}

// ---- idempotency ----------------------------------------------------------------------
export function dedupeKey(row) {
  return createHash("sha1")
    .update(`${row.change_type}|${row.label}|${row.artifact ?? ""}`)
    .digest("hex");
}

// ---- (b) mined lift split -------------------------------------------------------------
// Split scored {url, lift, ...} items into good (top quartile) / bad (bottom quartile).
// Middle 50% is intentionally dropped — only confident extremes make good labels.
export function quartileSplit(scored) {
  const sorted = [...scored].filter((s) => Number.isFinite(s.lift)).sort((a, b) => a.lift - b.lift);
  if (sorted.length < 4) return { good: [], bad: [] };
  const q = Math.floor(sorted.length / 4);
  return { bad: sorted.slice(0, q), good: sorted.slice(sorted.length - q) };
}

// Best-effort artifact lookup: only blog-write drafts we can resolve on disk today.
function draftArtifact(url) {
  const slug = (url || "").replace(/\/+$/, "").split("/").pop();
  if (!slug) return null;
  const path = `drafts/${slug}.md`;
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

async function mineReal() {
  const decisions = await appliedDecisions(120);
  const scored = [];
  for (const d of decisions.slice(0, MINE_LIMIT)) {
    if (d.change_type !== "blog-write") continue;        // only artifacts we can resolve today
    const artifact = draftArtifact(d.url);
    if (!artifact) continue;
    const [clicks, position] = await Promise.all([
      clicksAround(d.url, d.created_at, LAG),
      positionAround(d.url, d.created_at, LAG),
    ]);
    if (clicks.before == null || clicks.after == null) continue;
    const clickLift = (clicks.after - clicks.before) / Math.max(clicks.before, 1);
    const posLift = (position.before != null && position.after != null)
      ? (position.before - position.after) / Math.max(position.before, 1) : 0;
    scored.push({ url: d.url, change_type: d.change_type, artifact, lift: clickLift * 0.7 + posLift * 0.3 });
  }
  const { good, bad } = quartileSplit(scored);
  const row = (s, label) => ({
    change_type: s.change_type, url: s.url, artifact: s.artifact,
    label, failure_mode: null, realized_lift: Number(s.lift.toFixed(4)), source: "mined",
  });
  return [...good.map((s) => row(s, "good")), ...bad.map((s) => row(s, "bad"))];
}

async function main() {
  const existing = new Set((await evalSet()).map(dedupeKey));
  const candidates = [...syntheticSeed(), ...(await mineReal())];

  let inserted = 0;
  for (const row of candidates) {
    if (existing.has(dedupeKey(row))) continue;
    await insertEvalExample(row);
    existing.add(dedupeKey(row));
    inserted++;
  }
  console.log(`build-eval-set: inserted ${inserted} new example(s) (${candidates.length} candidates, ${existing.size} total).`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
