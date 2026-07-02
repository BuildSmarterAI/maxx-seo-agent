// test/citation-analyst.test.mjs — the citation-analyst seam: pure functions only.
// The analyst SCRIPT (scripts/analyze-citation-events.mjs) injects Supabase + the model call;
// everything decidable without I/O lives here and is unit-tested (ADR-007).
//   candidateWindow / selfInflictedCandidates / algoUpdatesInWindow  — deterministic context
//   parseVerdict / validateVerdict                                    — model-output handling
//   verdictAction                                                     — verdict -> gated action
// Run: node --test
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  candidateWindow,
  selfInflictedCandidates,
  algoUpdatesInWindow,
  parseVerdict,
  validateVerdict,
  groundVerdict,
  verdictAction,
  citationActionRow,
} from "../lib/citation-analyst.mjs";

const EVENT = {
  query: "How much does hotel construction cost in Texas?",
  target_url: "https://x.com/hotel/",
  event: "lost",
  competitor_won: [],
  prev_captured_at: "2026-06-01T00:00:00Z",
  captured_at: "2026-06-08T00:00:00Z",
};

// ---- candidateWindow ----
test("candidateWindow: [prev_captured_at - leadDays, captured_at]", () => {
  const w = candidateWindow(EVENT, 14);
  assert.equal(w.to, "2026-06-08T00:00:00.000Z");
  assert.equal(w.from, "2026-05-18T00:00:00.000Z"); // 2026-06-01 minus 14 days
});

test("candidateWindow: falls back to captured_at - leadDays when no prev snapshot", () => {
  const w = candidateWindow({ ...EVENT, prev_captured_at: null }, 14);
  assert.equal(w.from, "2026-05-25T00:00:00.000Z"); // 2026-06-08 minus 14 days
  assert.equal(w.to, "2026-06-08T00:00:00.000Z");
});

// ---- selfInflictedCandidates ----
test("selfInflictedCandidates: keeps only decisions inside the window", () => {
  const decisions = [
    { change_type: "restructure-for-citation", created_at: "2026-05-20T12:00:00Z" }, // in
    { change_type: "schema-generate", created_at: "2026-05-01T12:00:00Z" },           // before from
    { change_type: "metadata-generate", created_at: "2026-06-10T12:00:00Z" },         // after to
    { change_type: "internal-linking", created_at: "2026-06-08T00:00:00Z" },          // == to (inclusive)
  ];
  const got = selfInflictedCandidates({ event: EVENT, decisions, leadDays: 14 });
  assert.deepEqual(got.map((d) => d.change_type), ["restructure-for-citation", "internal-linking"]);
});

test("selfInflictedCandidates: empty when no decisions land in the window", () => {
  const got = selfInflictedCandidates({
    event: EVENT,
    decisions: [{ change_type: "schema-generate", created_at: "2026-01-01T00:00:00Z" }],
    leadDays: 14,
  });
  assert.deepEqual(got, []);
});

// ---- algoUpdatesInWindow ----
test("algoUpdatesInWindow: returns updates dated inside the window", () => {
  const updates = [
    { date: "2026-05-19", name: "May 2026 core update" }, // in
    { date: "2026-04-01", name: "old" },                   // out
    { date: "2026-06-08", name: "edge, inclusive" },       // == to
  ];
  const got = algoUpdatesInWindow(candidateWindow(EVENT, 14), updates);
  assert.deepEqual(got.map((u) => u.name), ["May 2026 core update", "edge, inclusive"]);
});

// ---- parseVerdict ----
test("parseVerdict: parses bare JSON and fenced JSON alike", () => {
  const obj = { attributed_cause: "algo_update", confidence: "high", rationale: "core update in-window" };
  assert.deepEqual(parseVerdict(JSON.stringify(obj)), obj);
  assert.deepEqual(parseVerdict("```json\n" + JSON.stringify(obj) + "\n```"), obj);
});

// ---- validateVerdict ----
test("validateVerdict: passes a well-formed verdict through", () => {
  const v = { attributed_cause: "self_inflicted", confidence: "med", rationale: "we edited it" };
  assert.deepEqual(validateVerdict(v), v);
});

test("validateVerdict: throws on an out-of-enum cause or confidence", () => {
  assert.throws(() => validateVerdict({ attributed_cause: "gremlins", confidence: "high", rationale: "x" }), /attributed_cause/);
  assert.throws(() => validateVerdict({ attributed_cause: "seasonal", confidence: "certain", rationale: "x" }), /confidence/);
});

test("validateVerdict: throws when rationale is missing (audit trail is mandatory)", () => {
  assert.throws(() => validateVerdict({ attributed_cause: "seasonal", confidence: "low" }), /rationale/);
});

// ---- verdictAction (asymmetric gates: enqueue floor = med) ----
test("verdictAction: competitor_displacement + high -> enqueue, task by intent", () => {
  assert.deepEqual(
    verdictAction({ attributed_cause: "competitor_displacement", confidence: "high" }, { intent: "informational" }),
    { action: "enqueue", task: "restructure-for-citation", risk_class: "safe", reason: "competitor displaced our AIO citation" },
  );
  assert.equal(
    verdictAction({ attributed_cause: "competitor_displacement", confidence: "med" }, { intent: "commercial" }).task,
    "ai-info-page",
  );
});

test("verdictAction: self_inflicted (med|high) -> escalate for human review, never a blind re-fix", () => {
  assert.equal(verdictAction({ attributed_cause: "self_inflicted", confidence: "high" }, {}).action, "escalate");
  assert.equal(verdictAction({ attributed_cause: "self_inflicted", confidence: "med" }, {}).action, "escalate");
});

test("verdictAction: algo_update / seasonal / unexplained -> log only", () => {
  for (const cause of ["algo_update", "seasonal", "unexplained"]) {
    assert.equal(verdictAction({ attributed_cause: cause, confidence: "high" }, {}).action, "log");
  }
});

test("verdictAction: low confidence never acts, regardless of cause (re-test next cycle)", () => {
  assert.equal(verdictAction({ attributed_cause: "competitor_displacement", confidence: "low" }, { intent: "informational" }).action, "log");
  assert.equal(verdictAction({ attributed_cause: "self_inflicted", confidence: "low" }, {}).action, "log");
});

// ---- groundVerdict (deterministic anti-hallucination guard) ----
const grounded = { attributed_cause: "algo_update", confidence: "high", rationale: "core update in-window" };

test("groundVerdict: self_inflicted with zero candidate changes -> downgraded to unexplained/low", () => {
  const v = groundVerdict({ attributed_cause: "self_inflicted", confidence: "high", rationale: "we edited it" },
    { event: EVENT, candidates: [], algoUpdates: [] });
  assert.equal(v.attributed_cause, "unexplained");
  assert.equal(v.confidence, "low");
  assert.match(v.rationale, /grounding override/);
});

test("groundVerdict: competitor_displacement with no competitor_won -> downgraded", () => {
  const v = groundVerdict({ attributed_cause: "competitor_displacement", confidence: "high", rationale: "rival won" },
    { event: { ...EVENT, competitor_won: [] }, candidates: [], algoUpdates: [] });
  assert.equal(v.attributed_cause, "unexplained");
});

test("groundVerdict: algo_update with no in-window updates -> downgraded", () => {
  const v = groundVerdict({ attributed_cause: "algo_update", confidence: "high", rationale: "an update" },
    { event: EVENT, candidates: [], algoUpdates: [] });
  assert.equal(v.attributed_cause, "unexplained");
});

test("groundVerdict: a well-grounded verdict passes through unchanged (new object, not mutated)", () => {
  const input = { attributed_cause: "competitor_displacement", confidence: "high", rationale: "rival won" };
  const v = groundVerdict(input, { event: { ...EVENT, competitor_won: ["rival.com"] }, candidates: [], algoUpdates: [] });
  assert.deepEqual(v, input);
  const a = groundVerdict(grounded, { event: EVENT, candidates: [], algoUpdates: [{ date: "2026-06-02", name: "x" }] });
  assert.deepEqual(a, grounded);
});

// ---- citationActionRow (verdict action -> work_queue row | null) ----
test("citationActionRow: log action -> null (nothing queued)", () => {
  assert.equal(citationActionRow({ action: "log" }, { event: EVENT, intent: "informational", priority: 7 }), null);
});

test("citationActionRow: enqueue -> safe pending row, priority bumped +2, task from action", () => {
  const row = citationActionRow(
    { action: "enqueue", task: "restructure-for-citation", risk_class: "safe" },
    { event: EVENT, intent: "informational", priority: 7 },
  );
  assert.deepEqual(row, {
    url: EVENT.target_url, task: "restructure-for-citation", risk_class: "safe",
    priority: 9, source: "citation", status: "pending",
  });
});

test("citationActionRow: escalate -> gated, status escalated, task defaulted by intent", () => {
  const row = citationActionRow({ action: "escalate" }, { event: EVENT, intent: "commercial", priority: 5 });
  assert.equal(row.risk_class, "gated");
  assert.equal(row.status, "escalated");
  assert.equal(row.task, "ai-info-page"); // no action.task -> intent default (commercial)
});
