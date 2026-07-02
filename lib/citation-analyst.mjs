// lib/citation-analyst.mjs — pure cores for the AI Overview citation analyst (ADR-007 PR2).
// No Supabase, no model call: scripts/analyze-citation-events.mjs injects the I/O and calls
// these. The analyst NEVER fabricates the effect (the diff already measured the transition);
// it only adjudicates CAUSE + CONFIDENCE over evidence, and confidence gates the action.

export const CAUSES = ["self_inflicted", "competitor_displacement", "algo_update", "seasonal", "unexplained"];
export const CONFIDENCE = ["low", "med", "high"];
// Bias toward acting, bias against nothing: only these confidences may trigger an action;
// everything below the floor is logged and left for the next cycle to re-observe.
const ENQUEUE_CONFIDENCE = new Set(["med", "high"]);

const dayMs = 864e5;

// The window in which a prior change could plausibly have caused this transition. Anchored at
// the last-cited snapshot (prev_captured_at) with a lead-in for AIO propagation lag, through
// the snapshot that triggered the event. Surfaces CANDIDATES; the model judges causation.
export function candidateWindow(event, leadDays) {
  const to = new Date(event.captured_at);
  const anchor = event.prev_captured_at ? new Date(event.prev_captured_at) : to;
  const from = new Date(anchor.getTime() - leadDays * dayMs);
  return { from: from.toISOString(), to: to.toISOString() };
}

// decision_log rows for this event's target_url that fall inside the candidate window.
export function selfInflictedCandidates({ event, decisions, leadDays }) {
  const { from, to } = candidateWindow(event, leadDays);
  const lo = new Date(from).getTime();
  const hi = new Date(to).getTime();
  return (decisions ?? []).filter((d) => {
    const t = new Date(d.created_at).getTime();
    return t >= lo && t <= hi;
  });
}

// Confirmed Google updates dated inside the window — the confounder the model must weigh.
export function algoUpdatesInWindow(window, algoUpdates) {
  const lo = new Date(window.from).getTime();
  const hi = new Date(window.to).getTime();
  return (algoUpdates ?? []).filter((u) => {
    const t = new Date(u.date).getTime();
    return t >= lo && t <= hi;
  });
}

// Build the analyst prompt. All facts are handed in as structured context — the model recalls
// nothing (no algo dates from memory), it only reasons over what it's given, and returns JSON.
export function buildAnalystPrompt(event, ctx) {
  const { candidates = [], algoUpdates = [], gscDelta = null } = ctx ?? {};
  return `You are an SEO attribution analyst. A monitored query's Google AI Overview citation state changed.
Decide the CAUSE and your CONFIDENCE. Do NOT invent facts — reason only over the evidence below.

EVENT: "${event.event}" for query "${event.query}" (page: ${event.target_url || "n/a"})
${event.competitor_won?.length ? `COMPETITOR(S) NOW CITED: ${event.competitor_won.join(", ")}` : "No competitor captured the citation."}
OUR CHANGES in the causal window (${candidates.length}): ${candidates.map((c) => `${c.change_type}@${c.created_at}`).join("; ") || "none"}
CONFIRMED GOOGLE UPDATES in-window (${algoUpdates.length}): ${algoUpdates.map((u) => `${u.name}@${u.date}`).join("; ") || "none"}
GSC clicks around the event: ${gscDelta ? `before=${gscDelta.before} after=${gscDelta.after}` : "unavailable"}

Return ONLY JSON, no prose, no code fences:
{"attributed_cause": one of ${JSON.stringify(CAUSES)},
 "confidence": one of ${JSON.stringify(CONFIDENCE)},
 "rationale": "one sentence citing the specific evidence"}
Guidance: a change <2-3 days before the event is implausibly recent (AIO won't have re-rendered);
an in-window Google update strongly favors algo_update; a competitor captured -> competitor_displacement;
no evidence either way -> unexplained at low confidence. Be conservative: prefer lower confidence when evidence is thin.`;
}

// Tolerate ```json fences; throw on unparseable output (caller fails closed / skips the event).
export function parseVerdict(out) {
  return JSON.parse(String(out).replace(/```json|```/g, "").trim());
}

// Reject anything outside the enums or missing its audit rationale — a malformed verdict must
// never be written to citation_events or drive an action.
export function validateVerdict(v) {
  if (!v || !CAUSES.includes(v.attributed_cause)) throw new Error(`invalid attributed_cause: ${v?.attributed_cause}`);
  if (!CONFIDENCE.includes(v.confidence)) throw new Error(`invalid confidence: ${v?.confidence}`);
  if (typeof v.rationale !== "string" || !v.rationale.trim()) throw new Error("verdict missing rationale");
  return v;
}

// Deterministic anti-hallucination guard: the model may only claim a cause the gathered
// evidence supports. self_inflicted needs a candidate change in-window; competitor_displacement
// needs a captured competitor; algo_update needs an in-window Google update. An ungrounded claim
// is downgraded to unexplained/low (which logs, never acts) with the override noted in the
// rationale. Returns a NEW verdict (never mutates). This is what keeps the LLM from inventing
// causality the diff-measured effect can't back.
export function groundVerdict(verdict, { event, candidates, algoUpdates }) {
  const ungrounded =
    (verdict.attributed_cause === "self_inflicted" && (candidates?.length ?? 0) === 0) ||
    (verdict.attributed_cause === "competitor_displacement" && (event?.competitor_won?.length ?? 0) === 0) ||
    (verdict.attributed_cause === "algo_update" && (algoUpdates?.length ?? 0) === 0);
  if (!ungrounded) return verdict;
  return {
    ...verdict,
    attributed_cause: "unexplained",
    confidence: "low",
    rationale: `[grounding override: ${verdict.attributed_cause} claimed without supporting evidence] ${verdict.rationale}`,
  };
}

// Map a validated verdict to a gated action. Asymmetric by design (ADR-007): enqueuing a fix is
// cheap and human-gated downstream, so act at med+; self-inflicted regressions are a judgment
// call (the change may have been intentional) so they ESCALATE, not blind-re-fix; algo/seasonal/
// unexplained and anything below the confidence floor only log.
export function verdictAction(verdict, { intent } = {}) {
  const { attributed_cause: cause, confidence } = verdict;
  if (!ENQUEUE_CONFIDENCE.has(confidence)) {
    return { action: "log", reason: `confidence=${confidence} below enqueue floor` };
  }
  if (cause === "competitor_displacement") {
    const task = intent === "informational" ? "restructure-for-citation" : "ai-info-page";
    return { action: "enqueue", task, risk_class: "safe", reason: "competitor displaced our AIO citation" };
  }
  if (cause === "self_inflicted") {
    return { action: "escalate", reason: "a prior change appears to have cost the AIO citation — human review" };
  }
  return { action: "log", reason: `cause=${cause} not actionable` };
}

// Turn an action decision into a work_queue row (or null for log-only). Escalations are gated
// (human review of a self-inflicted regression); enqueues are safe content fixes. Priority is
// bumped +2 — a confirmed AIO transition is high-signal. Pure, so the row shape is unit-tested.
export function citationActionRow(action, { event, intent, priority = 5 }) {
  if (action.action === "log") return null;
  return {
    url: event.target_url,
    task: action.task ?? (intent === "informational" ? "restructure-for-citation" : "ai-info-page"),
    risk_class: action.action === "escalate" ? "gated" : "safe",
    priority: (priority ?? 5) + 2,
    source: "citation",
    status: action.action === "escalate" ? "escalated" : "pending",
  };
}
