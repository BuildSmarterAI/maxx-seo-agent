// cms.mjs — shared engine for the live-CMS apply layer (WordPress + Webflow).
// Handles the jobs git gives you for free: review state, snapshot/rollback, and drift
// detection. applyRow() owns the per-row apply lifecycle; a platform adapter supplies
// the I/O (read/write/verify) and the small per-platform audit labels (narrate).
import { db } from "./client.mjs";
import { logDecision } from "./supabase.mjs";

export async function approvedRows(platform, limit = 200) {
  const { data } = await db.from("change_set").select("*")
    .eq("platform", platform).eq("status", "approved").limit(limit);
  return data ?? [];
}

export async function stagedRows(platform, limit = 200) {   // webflow: applied-but-unpublished
  const { data } = await db.from("change_set").select("*")
    .eq("platform", platform).eq("status", "applied").limit(limit);
  return data ?? [];
}

export async function snapshot(row, current) {
  await db.from("snapshots").insert({
    platform: row.platform, page_id: row.page_id, url: row.url,
    field: row.field, old_value: current ?? null,
  });
}

// drift = a human edited the live value since the agent generated this change.
export function drifted(row, current) {
  return row.base_value != null && String(current) !== String(row.base_value);
}

export async function setStatus(id, status, extra = {}) {
  await db.from("change_set").update({ status, ...extra }).eq("id", id);
}

export async function latestSnapshot(platform, page_id, field) {
  const { data } = await db.from("snapshots").select("old_value")
    .eq("platform", platform).eq("page_id", page_id).eq("field", field)
    .order("captured_at", { ascending: false }).limit(1).maybeSingle();
  return data?.old_value ?? null;
}

const DRIFT_REASON = "drift: live value changed since generation";

// Persistence the apply loop touches. Injectable so the loop is testable without a DB.
const defaultStore = { snapshot, setStatus, logDecision };

// The apply loop body, run once per approved row. The adapter owns all platform I/O
// (supports/read/write/verify) and the per-platform audit labels (narrate.*); this
// owns the invariant lifecycle — snapshot → drift gate → write → status + decision-log —
// with a single failure path. Returns "applied" | "escalated" | "failed" so the caller
// can tally a summary.
export async function applyRow(row, adapter, store = defaultStore) {
  try {
    if (!adapter.supports(row)) {
      await store.setStatus(row.id, "escalated");
      await store.logDecision({ url: row.url, action: "escalate", risk_class: "gated", ...adapter.narrate.unsupported(row) });
      return "escalated";
    }

    const current = await adapter.read(row);
    await store.snapshot(row, current);

    if (adapter.driftCheckable(row) && drifted(row, current)) {
      await store.setStatus(row.id, "escalated");
      await store.logDecision({ url: row.url, action: "escalate", risk_class: "gated", reason: DRIFT_REASON, ...adapter.narrate.drift(row) });
      return "escalated";
    }

    await adapter.write(row);
    if (adapter.verify) await adapter.verify(row);

    await store.setStatus(row.id, "applied", { applied_at: new Date().toISOString() });
    await store.logDecision({ url: row.url, action: "applied", risk_class: "safe", ...adapter.narrate.applied(row) });
    return "applied";
  } catch (err) {
    await store.setStatus(row.id, "failed");
    await store.logDecision({ url: row.url, action: "skip", risk_class: "safe", ...adapter.narrate.failed(row, err) });
    return "failed";
  }
}

export { logDecision };
