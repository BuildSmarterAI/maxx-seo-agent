// scripts/analyze-citation-events.mjs
// The citation analyst (ADR-007 PR2). For each unanalyzed citation_event it gathers evidence —
// our changes in the causal window (decision_log), confirmed Google updates (config/algo-updates.json),
// and the GSC clicks delta — asks Sonnet to attribute a CAUSE + CONFIDENCE (it never invents the
// effect; the diff already measured the transition), writes the verdict onto the event row, and
// takes a CONFIDENCE-GATED action: escalate a self-inflicted regression for human review, enqueue a
// targeted fix on competitor displacement, or log-only for algo/seasonal/unexplained/low-confidence.
//
// It does NOT write learned_patterns_geo — attribute-citations.mjs owns that table (avoiding a
// two-writer clobber); the analyst's job is per-event verdicts + gated actions.
// Run: node --env-file=.env scripts/analyze-citation-events.mjs
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { db } from "../lib/db.mjs";
import { enqueue, doNotTouch, clicksAround, logDecision, filterKitTaskDecisions } from "../orchestrator/lib/supabase.mjs";
import {
  candidateWindow, selfInflictedCandidates, algoUpdatesInWindow,
  buildAnalystPrompt, parseVerdict, validateVerdict, groundVerdict, verdictAction, citationActionRow,
} from "../lib/citation-analyst.mjs";

const MODEL = process.env.CITATION_ANALYST_MODEL || "claude-sonnet-4-6";
const LEAD_DAYS = Number(process.env.SELF_INFLICTED_LEAD_DAYS || 14);
const LIMIT = Number(process.env.ANALYST_BATCH_LIMIT || 50);

// The algo calendar is the analyst's one external input. A read failure degrades to "no known
// update" (biases toward self_inflicted/unexplained, confidence-gated) rather than crashing.
function loadAlgoUpdates() {
  try {
    const file = process.env.ALGO_UPDATES_FILE || "config/algo-updates.json";
    const parsed = JSON.parse(readFileSync(resolve(file), "utf8"));
    return Array.isArray(parsed) ? parsed : (parsed.updates ?? []);
  } catch (e) {
    console.error(`[analyst] algo-updates unreadable (${e.message}) — proceeding with none.`);
    return [];
  }
}

async function askAnalyst(prompt) {
  let out = "";
  for await (const m of query({ prompt, options: { model: MODEL, allowedTools: [] } })) {
    if ("result" in m) out = m.result;
  }
  return out;
}

async function run() {
  const { data: events, error } = await db
    .from("citation_events")
    .select("id,query,target_url,event,competitor_won,prev_captured_at,captured_at")
    .is("analyzed_at", null)
    .order("captured_at", { ascending: true })
    .limit(LIMIT);
  if (error) throw new Error(`citation_events read failed: ${error.message}`);
  if (!events?.length) { console.log("[analyst] no unanalyzed events."); process.exit(0); }

  const algoUpdates = loadAlgoUpdates();
  const { data: qrows, error: qErr } = await db.from("ai_queries").select("query,intent,priority");
  if (qErr) console.error(`[analyst] ai_queries read failed (${qErr.message}) — intents/priorities default.`);
  const meta = new Map((qrows ?? []).map((q) => [q.query, { intent: q.intent, priority: q.priority }]));
  const skip = await doNotTouch();

  const summary = [];
  let analyzed = 0, enq = 0, esc = 0, logged = 0, skipped = 0;

  for (const ev of events) {
    const win = candidateWindow(ev, LEAD_DAYS);
    const { data: decisions, error: decErr } = await db
      .from("decision_log")
      .select("change_type,created_at,url")
      .eq("url", ev.target_url)
      .gte("created_at", win.from).lte("created_at", win.to)
      .not("change_type", "is", null);
    // Surface loudly: a failed read here silently empties the candidates and biases the verdict
    // away from self_inflicted for this event — never swallow it.
    if (decErr) console.error(`[analyst] event ${ev.id} decision_log read failed (${decErr.message}) — candidates empty, verdict may skew.`);
    // Orphan-leak backstop (A11): this query has no action filter (unlike appliedDecisions()),
    // so an escalate/skip-path change_type like the content-guard's "content" sentinel could
    // otherwise reach the model as a self-inflicted candidate. Same filter, same reason.
    const candidates = selfInflictedCandidates({ event: ev, decisions: filterKitTaskDecisions(decisions ?? []), leadDays: LEAD_DAYS });
    const inWindowUpdates = algoUpdatesInWindow(win, algoUpdates);
    let gscDelta = null;
    if (ev.target_url) { try { gscDelta = await clicksAround(ev.target_url, ev.captured_at, 7); } catch { /* optional */ } }

    let verdict;
    try {
      const raw = await askAnalyst(buildAnalystPrompt(ev, { candidates, algoUpdates: inWindowUpdates, gscDelta }));
      // Ground the model's claim against the evidence we actually gathered before trusting it.
      verdict = groundVerdict(validateVerdict(parseVerdict(raw)), { event: ev, candidates, algoUpdates: inWindowUpdates });
    } catch (e) {
      // Fail-open per event: leave analyzed_at null so the next run retries; don't abort the batch.
      console.error(`[analyst] event ${ev.id} skipped (bad verdict): ${e.message}`);
      skipped++;
      continue;
    }

    const intent = meta.get(ev.query)?.intent;
    const priority = meta.get(ev.query)?.priority ?? 5;
    const action = verdictAction(verdict, { intent });
    const row = citationActionRow(action, { event: ev, intent, priority });

    // Take the action BEFORE marking analyzed_at. If we crash between, analyzed_at stays null so
    // the event is re-analyzed next run; enqueue dedups on (url,task,status) so no double-queue.
    // Invariant: analyzed_at set ⇒ the action was durably written (no silent action loss).
    let status = action.action;
    if (!row) {
      logged++; status = "log";
    } else if (!ev.target_url || skip.has(ev.target_url)) {
      skipped++; status = "skip(no-url/dnt)"; // actionable but no writable / protected target
    } else {
      await enqueue([row]);
      if (action.action === "escalate") {
        // Audit trail (matches the escalation convention in orchestrator/lib/cms.mjs): the verdict
        // rationale must survive somewhere a human sees it, not just on the citation_events row.
        await logDecision({ url: ev.target_url, action: "escalate", risk_class: "gated",
          reason: `[AIO ${ev.event}] ${verdict.attributed_cause}/${verdict.confidence}: ${verdict.rationale}` });
        esc++; status = "ESCALATE";
      } else { enq++; status = "ENQUEUE"; }
    }

    const { error: upErr } = await db.from("citation_events").update({
      attributed_cause: verdict.attributed_cause,
      confidence: verdict.confidence,
      rationale: verdict.rationale,
      analyzed_at: new Date().toISOString(),
    }).eq("id", ev.id);
    if (upErr) { console.error(`[analyst] event ${ev.id} verdict write failed (action already taken, will re-verdict): ${upErr.message}`); continue; }
    analyzed++;

    summary.push({ id: ev.id, query: ev.query.slice(0, 32), event: ev.event, cause: verdict.attributed_cause, conf: verdict.confidence, action: status });
  }

  console.table(summary);
  console.log(`[analyst] analyzed=${analyzed} enqueued=${enq} escalated=${esc} logged=${logged} skipped=${skipped}`);
}

run().catch((e) => { console.error(e); process.exit(1); });
