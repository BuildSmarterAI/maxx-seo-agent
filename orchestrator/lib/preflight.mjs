// preflight.mjs — the "should we run?" decision, lifted out of run.mjs so it
// returns a verdict instead of calling process.exit. The caller (run.mjs main)
// owns control flow, which makes this logic exercisable without killing the process.
// NOT read-only since cross-review 56-2: dropped do_not_touch rows are written back
// (status 'skipped-dnt' + a decision_log entry), including on the ok:false path.
import { isPaused, resetMonthIfNew, getMonthSpend, pendingQueue, doNotTouch, setQueueStatusById, logDecision } from "./supabase.mjs";
import { isProtected } from "./url.mjs";

// Returns { ok:false, reason } to stop, or { ok:true, queue } to proceed.
// `deps` defaults to the real supabase.mjs functions; tests inject fakes so the gate
// logic runs with no network (same optional-injection pattern as addSpend/applyRow).
export async function check(budgetUsd, queueLimit = 25, deps = {}) {
  const {
    isPaused: paused = isPaused,
    resetMonthIfNew: resetMonth = resetMonthIfNew,
    getMonthSpend: monthSpend = getMonthSpend,
    pendingQueue: queuePending = pendingQueue,
    doNotTouch: dnt = doNotTouch,
    setQueueStatusById: retireRow = setQueueStatusById,
    logDecision: logDecide = logDecision,
  } = deps;

  if (await paused()) return { ok: false, reason: "control.paused = true → exiting." };

  await resetMonth();
  const spent = await monthSpend();
  if (spent >= budgetUsd) {
    return { ok: false, reason: `budget hit ($${spent}/$${budgetUsd}) → exiting.` };
  }

  const queue = await queuePending(queueLimit);
  if (!queue.length) return { ok: false, reason: "queue empty → nothing to do." };

  // Dispatch-time do_not_touch re-check (Panel-A A3): a URL added to do_not_touch AFTER it
  // was enqueued is still `pending` in work_queue — the ingest filter can't retroactively
  // catch it. Drop protected rows here so the orchestrator never dispatches a now-protected URL.
  const protectedSet = await dnt();
  const safe = queue.filter((row) => !isProtected(protectedSet, row.url));

  // Park dropped rows instead of leaving them pending (cross-review 56-2): a protected row
  // left pending re-occupies the priority-ordered fetch window every run, and a bulk
  // do_not_touch add covering the whole window would starve dispatch of the legitimate rows
  // below it indefinitely. Status is 'skipped-dnt', NOT 'escalated': an escalated (url,task)
  // twin would collide with the work_queue unique(url,task,status) constraint, and escalated
  // rows are mirrored to Linear with a "resolve in WordPress" narrative — an instruction to
  // edit the very page the entry protects. Parking is one-way by design: removing a
  // do_not_touch entry does not revive parked rows. Recurring signals (GSC decay/striking-
  // distance, PAA, AI citations) will re-detect and re-enqueue through the chokepoint on
  // their own rolling window once the entry is gone; one-shot signals (the sitemap sensor's
  // new-URL detection, which marks a URL seen forever) do NOT — a parked sitemap-sourced row
  // needs a manual re-enqueue after the do_not_touch entry is removed.
  const dropped = queue.filter((row) => isProtected(protectedSet, row.url));
  let parked = 0;
  for (const row of dropped) {
    try {
      await retireRow(row.id, "skipped-dnt");
      parked += 1;
      await logDecide({ url: row.url, action: "skip", risk_class: "gated",
                        reason: "do_not_touch at dispatch (preflight re-check)", agent: "preflight" });
    } catch (err) {
      // A skipped-dnt twin or transient write failure: the row stays pending and keeps being
      // filtered here (pre-fix behavior for this row alone). Loud, and no phantom log entry.
      console.error(`preflight: failed to park row ${row.id} (${row.url}): ${err?.message ?? err}`);
    }
  }
  if (parked) console.warn(`preflight: parked ${parked} do_not_touch row(s) as skipped-dnt`);

  if (!safe.length) return { ok: false, reason: "queue empty after do_not_touch filter → nothing to do." };

  // Dispatch risk gate (A8): the safe/gated decision must not depend on the model obeying
  // its goal prompt — before this gate, run.mjs never read risk_class and the only code
  // enforcement lived on the CMS apply path (cms.mjs applyRow). Mirror that path's rule
  // exactly: anything !== "safe" — including a missing or unknown risk_class — escalates,
  // fail closed. Same status + decision_log shape the goal prompt tells the agent to
  // produce, so the operator-facing escalation queue is unchanged. The goal prompt's own
  // escalate step stays as defense-in-depth for rows enqueued after this gate.
  const dispatchable = safe.filter((row) => row.risk_class === "safe");
  const gated = safe.filter((row) => row.risk_class !== "safe");
  let escalated = 0;
  for (const row of gated) {
    try {
      await retireRow(row.id, "escalated");
      escalated += 1;
      // decision_log.risk_class is CHECK-constrained to safe|gated: always log "gated" and
      // carry the row's raw value (possibly absent) in the free-text reason instead.
      await logDecide({ url: row.url, action: "escalate", risk_class: "gated",
                        reason: `non-safe risk_class (${row.risk_class ?? "missing"}) at dispatch (preflight gate)`,
                        agent: "preflight" });
    } catch (err) {
      // An escalated (url,task) twin or transient write failure: the row stays pending and
      // keeps being dropped here every run (same containment as a failed dnt park above).
      // Loud, and no phantom log entry for a status change that never landed.
      console.error(`preflight: failed to escalate row ${row.id} (${row.url}): ${err?.message ?? err}`);
    }
  }
  if (escalated) console.warn(`preflight: escalated ${escalated} non-safe row(s) at the dispatch gate`);

  if (!dispatchable.length) {
    return { ok: false, reason: "queue empty after do_not_touch + risk gates → nothing to do." };
  }

  // `spent` rides along so the caller can compute the run's remaining budget headroom
  // (SDK maxBudgetUsd) without a second getMonthSpend read racing this one.
  return { ok: true, queue: dispatchable, spent };
}
