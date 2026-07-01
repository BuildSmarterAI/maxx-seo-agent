// preflight.mjs — the "should we run?" decision, lifted out of run.mjs so it
// returns a verdict instead of calling process.exit. The caller (run.mjs main)
// owns control flow, which makes this logic exercisable without killing the process.
import { isPaused, resetMonthIfNew, getMonthSpend, pendingQueue } from "./supabase.mjs";

// Returns { ok:false, reason } to stop, or { ok:true, queue } to proceed.
// `deps` defaults to the real supabase.mjs functions; tests inject fakes so the gate
// logic runs with no network (same optional-injection pattern as addSpend/applyRow).
export async function check(budgetUsd, queueLimit = 25, deps = {}) {
  const {
    isPaused: paused = isPaused,
    resetMonthIfNew: resetMonth = resetMonthIfNew,
    getMonthSpend: monthSpend = getMonthSpend,
    pendingQueue: queuePending = pendingQueue,
  } = deps;

  if (await paused()) return { ok: false, reason: "control.paused = true → exiting." };

  await resetMonth();
  const spent = await monthSpend();
  if (spent >= budgetUsd) {
    return { ok: false, reason: `budget hit ($${spent}/$${budgetUsd}) → exiting.` };
  }

  const queue = await queuePending(queueLimit);
  if (!queue.length) return { ok: false, reason: "queue empty → nothing to do." };

  return { ok: true, queue };
}
