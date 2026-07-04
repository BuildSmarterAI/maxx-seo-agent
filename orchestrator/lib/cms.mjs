// cms.mjs — shared engine for the live-CMS apply layer (WordPress + Webflow).
// Handles the jobs git gives you for free: review state, snapshot/rollback, and drift
// detection. applyRow() owns the per-row apply lifecycle; a platform adapter supplies
// the I/O (read/write/verify) and the small per-platform audit labels (narrate).
import { db } from "./client.mjs";
import { logDecision, doNotTouch } from "./supabase.mjs";
import { isProtected } from "./url.mjs";
import { scanPlaceholders } from "../../scripts/validators/content-guards.mjs";

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

// The most recent live change for this field — the row a rollback reverses.
export async function latestAppliedRow(platform, page_id, field) {
  const { data } = await db.from("change_set").select("id")
    .eq("platform", platform).eq("page_id", page_id).eq("field", field)
    .in("status", ["applied", "published"])
    .order("applied_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false })   // deterministic tie-break when applied_at is null
    .limit(1).maybeSingle();
  return data ?? null;
}

const DRIFT_REASON = "drift: live value changed since generation";
const PROTECTED_REASON = "do_not_touch: URL is protected — apply blocked at boundary";
const NO_URL_REASON = "do_not_touch: row has no url — cannot verify protection, blocked at boundary";

// Persistence the apply/rollback loops touch. Injectable so they're testable without a DB.
const defaultStore = { snapshot, setStatus, logDecision, latestSnapshot, latestAppliedRow, doNotTouch };

// The apply loop body, run once per approved row. The adapter owns all platform I/O
// (supports/read/write/verify) and the per-platform audit labels (narrate.*); this
// owns the invariant lifecycle — snapshot → drift gate → write → status + decision-log —
// with a single failure path. Returns "applied" | "escalated" | "failed" so the caller
// can tally a summary.
export async function applyRow(row, adapter, store = defaultStore, opts = {}) {
  try {
    // Apply-boundary do_not_touch gate (REC-5/AH1): even if a protected URL slips past the
    // sensor/enqueue filter, the apply layer refuses to write it. Fail-closed — checked before
    // supports/read/snapshot so nothing touches the live page. A row with no url can't be
    // checked at all, so it is escalated rather than written on trust (every live change_set
    // writer populates url today; this guards a future writer or bug that doesn't).
    if (!row.url) {
      await store.setStatus(row.id, "escalated");
      await store.logDecision({ url: null, action: "escalate", risk_class: "gated", change_type: row.change_type ?? null, reason: NO_URL_REASON });
      return "escalated";
    }
    // protectedUrls is fetched once by applyRows and threaded in; a direct caller falls back
    // to a per-row store lookup.
    const protectedUrls = opts.protectedUrls ?? await store.doNotTouch();
    if (isProtected(protectedUrls, row.url)) {
      await store.setStatus(row.id, "escalated");
      await store.logDecision({ url: row.url, action: "escalate", risk_class: "gated", change_type: row.change_type ?? null, reason: PROTECTED_REASON });
      return "escalated";
    }

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

    // Deterministic content guard before a live write: a leaked placeholder / default
    // byline in new_value must never reach the CMS (the repo/CI guards can't see this
    // path). Escalate instead of overwriting — reuses the gated escalation path.
    const guard = scanPlaceholders(row.new_value);
    if (guard.length) {
      await store.setStatus(row.id, "escalated");
      await store.logDecision({
        url: row.url, action: "escalate", risk_class: "gated",
        change_type: row.change_type ?? "content",
        reason: `content-guard: ${guard.map((g) => g.rule).join(", ")}`,
      });
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

// Runs applyRow over every approved row for the adapter's platform and tallies the
// outcomes. Each pack's main() prints its own platform-specific summary line.
// rows + store are injectable so the loop is testable without a DB.
export async function applyRows(adapter, { rows, store = defaultStore } = {}) {
  const list = rows ?? await approvedRows(adapter.platform);
  // One do_not_touch lookup for the whole batch, threaded into each applyRow.
  const protectedUrls = await (store.doNotTouch ?? doNotTouch)();
  const tally = { applied: 0, escalated: 0, failed: 0 };
  for (const row of list) {
    const outcome = await applyRow(row, adapter, store, { protectedUrls });
    if (outcome === "applied") tally.applied++;
    else if (outcome === "escalated") tally.escalated++;
    else tally.failed++;
  }
  return tally;
}

// Restores a field to its snapshotted pre-change value through the adapter — so it
// inherits the adapter's I/O routing (e.g. WP post-vs-page + content-vs-meta). Mirrors
// applyRow (snapshot current → write → verify) but targets the snapshot value and skips
// the drift gate: a rollback is an intentional human override. Flips the most recent live
// change_set row for this field to "rolledback".
export async function rollbackRow(adapter, { page_id, field, collection_id }, store = defaultStore) {
  const row = { platform: adapter.platform, page_id, field, collection_id };
  if (!adapter.supports(row)) throw new Error(`rollback: unsupported field ${field} for ${adapter.platform}`);

  const old = await store.latestSnapshot(adapter.platform, page_id, field);
  if (old == null) throw new Error(`rollback: no snapshot found for ${adapter.platform} ${page_id}/${field}`);

  const current = await adapter.read(row);
  await store.snapshot(row, current);

  const restoreRow = { ...row, new_value: old };
  await adapter.write(restoreRow);
  if (adapter.verify) await adapter.verify(restoreRow);

  const matched = await store.latestAppliedRow(adapter.platform, page_id, field);
  if (matched) await store.setStatus(matched.id, "rolledback");

  await store.logDecision({
    url: null, action: "rolledback", risk_class: "safe",
    change_type: field, reason: `${adapter.platform} rollback ${field} on ${page_id}`,
  });
  return { restored: old, rowId: matched?.id ?? null };
}

export { logDecision };
