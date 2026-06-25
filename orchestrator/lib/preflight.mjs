// preflight.mjs — the "should we run?" decision, lifted out of run.mjs so it
// returns a verdict instead of calling process.exit. The caller (run.mjs main)
// owns control flow, which makes this logic exercisable without killing the process.
import { isPaused, resetMonthIfNew, getMonthSpend, pendingQueue } from "./supabase.mjs";

// Returns { ok:false, reason } to stop, or { ok:true, queue } to proceed.
export async function check(budgetUsd, queueLimit = 25) {
  if (await isPaused()) return { ok: false, reason: "control.paused = true → exiting." };

  await resetMonthIfNew();
  const spent = await getMonthSpend();
  if (spent >= budgetUsd) {
    return { ok: false, reason: `budget hit ($${spent}/$${budgetUsd}) → exiting.` };
  }

  const queue = await pendingQueue(queueLimit);
  if (!queue.length) return { ok: false, reason: "queue empty → nothing to do." };

  return { ok: true, queue };
}
