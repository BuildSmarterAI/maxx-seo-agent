// cms.mjs — shared engine for the live-CMS apply layer (WordPress + Webflow).
// Handles the jobs git gives you for free: review state, snapshot/rollback, and drift
// detection. applyRow() owns the per-row apply lifecycle; a platform adapter supplies
// the I/O (read/write/verify) and the small per-platform audit labels (narrate).
import { db } from "./client.mjs";
import { logDecision, doNotTouch } from "./supabase.mjs";
import { isProtected } from "./url.mjs";
import { scanPlaceholders } from "../../scripts/validators/content-guards.mjs";

// supabase-js returns { error } instead of throwing, so every apply/recovery-path call
// checks it: a swallowed select error would report a broken run as "applied 0" (or
// "nothing staged"), a swallowed snapshot error would let a live write proceed with no
// rollback snapshot, and a swallowed status update would leave a written row "approved".
export async function approvedRows(platform, limit = 200, client = db) {
  const { data, error } = await client.from("change_set").select("*")
    .eq("platform", platform).eq("status", "approved").limit(limit);
  if (error) throw new Error(`approvedRows failed: ${error.message}`);
  return data ?? [];
}

export async function stagedRows(platform, limit = 200, client = db) {   // webflow: applied-but-unpublished
  const { data, error } = await client.from("change_set").select("*")
    .eq("platform", platform).eq("status", "applied").limit(limit);
  if (error) throw new Error(`stagedRows failed: ${error.message}`);
  return data ?? [];
}

export async function snapshot(row, current, client = db) {
  const { error } = await client.from("snapshots").insert({
    platform: row.platform, page_id: row.page_id, url: row.url,
    field: row.field, old_value: current ?? null,
  });
  if (error) throw new Error(`snapshot failed: ${error.message}`);
}

// drift = a human edited the live value since the agent generated this change.
export function drifted(row, current) {
  return row.base_value != null && String(current) !== String(row.base_value);
}

export async function setStatus(id, status, extra = {}, client = db) {
  const { error } = await client.from("change_set").update({ status, ...extra }).eq("id", id);
  if (error) throw new Error(`setStatus failed: ${error.message}`);
}

// null means "no snapshot exists"; a read failure throws, so rollbackRow can't confuse the two.
export async function latestSnapshot(platform, page_id, field, client = db) {
  const { data, error } = await client.from("snapshots").select("old_value")
    .eq("platform", platform).eq("page_id", page_id).eq("field", field)
    .order("captured_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(`latestSnapshot failed: ${error.message}`);
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
const MISSING_BASELINE_REASON = "content-drift: missing baseline (base_value is not a string) — cannot verify live content, blocked at boundary";
const MISSING_LIVE_REASON = "content-drift: missing live value (unavailable or not a string) — cannot verify live content, blocked at boundary";

// Content fields (adapter.isContent(row)) are compared raw-to-raw and fail CLOSED. The
// metadata path above treats a null base_value as "skip" and coerces with String(); neither
// is safe for a full-body rewrite, where "undefined"/"null" text would compare as content and
// a null baseline would silently disable the check. Here a missing value (null, undefined,
// non-string) is distinct from "" (intentionally empty content, a valid value). Normalization
// is CRLF -> LF only, applied identically to both sides: no trim, no whitespace collapsing, no
// HTML/block re-serialization. Returns null (proceed) or the escalation reason.
const lf = (s) => s.replace(/\r\n/g, "\n");
export function contentDriftReason(row, current) {
  if (typeof current !== "string") return MISSING_LIVE_REASON;
  if (typeof row.base_value !== "string") return MISSING_BASELINE_REASON;
  return lf(current) === lf(row.base_value) ? null : DRIFT_REASON;
}
const contentReason = (adapter, row, current) =>
  adapter.isContent?.(row) ? contentDriftReason(row, current) : null;

// An unreadable content value is not a pre-change state: recording a null snapshot would
// become the "latest" snapshot and hide the last real one from rollbackRow.
async function snapshotUnlessUnavailable(adapter, store, row, current) {
  if (adapter.isContent?.(row) && typeof current !== "string") return;
  await store.snapshot(row, current);
}
const PROTECTED_REASON = "do_not_touch: URL is protected — apply blocked at boundary";
const NO_URL_REASON = "do_not_touch: row has no url — cannot verify protection, blocked at boundary";
const RISK_CLASS_REASON = "risk_class: row is not safe-class — apply blocked at boundary";

// Persistence the apply/rollback loops touch. Injectable so they're testable without a DB.
const defaultStore = { snapshot, setStatus, logDecision, latestSnapshot, latestAppliedRow, doNotTouch };

// The apply loop body, run once per approved row. The adapter owns all platform I/O
// (supports/read/write/verify) and the per-platform audit labels (narrate.*); this
// owns the invariant lifecycle — snapshot → drift gate → write → status + decision-log —
// with a single failure path. Returns "applied" | "escalated" | "failed" |
// "applied_unrecorded" (written live, status update failed) so the caller can tally a summary.
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

    // risk_class apply-boundary gate (A8): the safe/gated classification was previously
    // enforced only in prose (prompts + human review). Fail-closed here too — anything
    // other than exactly "safe" (including missing/null, e.g. a pre-A8 row) escalates
    // rather than writes, mirroring the do_not_touch/no-url gates above.
    if (row.risk_class !== "safe") {
      await store.setStatus(row.id, "escalated");
      await store.logDecision({ url: row.url, action: "escalate", risk_class: "gated", change_type: row.change_type ?? null, reason: RISK_CLASS_REASON });
      return "escalated";
    }

    if (!adapter.supports(row)) {
      await store.setStatus(row.id, "escalated");
      await store.logDecision({ url: row.url, action: "escalate", risk_class: "gated", ...adapter.narrate.unsupported(row) });
      return "escalated";
    }

    const current = await adapter.read(row);
    await snapshotUnlessUnavailable(adapter, store, row, current);

    // Content rows: raw-to-raw compare, fail closed on a missing baseline or live value.
    // RACE WINDOW: `current` is what adapter.read returned at the top of this function. A
    // Supabase snapshot insert and the placeholder scan run between this comparison and the
    // POST, and WordPress core REST has no conditional-write precondition (no If-Match /
    // If-Unmodified-Since on POST /wp/v2/posts/{id}). An edit saved in that interval is
    // overwritten. This narrows the window; it is NOT atomic protection. Closing it needs a
    // server-side check (e.g. modified_gmt stored at staging, enforced by a mu-plugin).
    const contentIssue = contentReason(adapter, row, current);
    if (contentIssue) {
      await store.setStatus(row.id, "escalated");
      await store.logDecision({ url: row.url, action: "escalate", risk_class: "gated", reason: contentIssue, ...adapter.narrate.drift(row) });
      return "escalated";
    }

    if (!adapter.isContent?.(row) && adapter.driftCheckable(row) && drifted(row, current)) {
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

    // SEO-14 decision point: the live write has happened, so a failure to record it must
    // not fall through to the catch below and mark the row "failed" — that would tell the
    // operator the page is unchanged when it isn't. Nor may it be swallowed as "applied".
    // It is reported as "applied_unrecorded": decision_log says the change is live (if the
    // log write gets through), stderr names the row, and applyExitCode fails the run.
    // While the row stays "approved", the next seo-apply-cms run re-reads the now-written
    // value, snapshots it (masking the true pre-change value for rollback), then the drift
    // gate escalates the row (current !== base_value) — or, for a non-drift-checkable
    // field, rewrites the same value. Hence the alert tells the operator to set the status
    // by hand before then.
    try {
      await store.setStatus(row.id, "applied", { applied_at: new Date().toISOString() });
    } catch (err) {
      return recordUnrecorded(row, adapter, store, err, opts.error ?? console.error);
    }
    await store.logDecision({ url: row.url, action: "applied", risk_class: "safe", ...adapter.narrate.applied(row) });
    return "applied";
  } catch (err) {
    await store.setStatus(row.id, "failed");
    await store.logDecision({ url: row.url, action: "skip", risk_class: "safe", ...adapter.narrate.failed(row, err) });
    return "failed";
  }
}

// The write is live but change_set still says "approved". Alert on stderr first (the DB
// may be the thing that's down), then best-effort record it in decision_log.
async function recordUnrecorded(row, adapter, store, err, error) {
  error(`APPLIED BUT STATUS UNRECORDED: change_set ${row.id} (${row.url} ${row.field}) was written live, ` +
    `but its status is still 'approved' (${err.message}). Set it to 'applied' by hand before the next ` +
    `seo-apply-cms run, or that run will re-snapshot the new value and escalate it as drift.`);
  const applied = adapter.narrate.applied(row);
  try {
    await store.logDecision({
      url: row.url, action: "applied", risk_class: "safe", ...applied,
      reason: `${applied.reason}; status unrecorded: ${err.message}`,
    });
  } catch (logErr) {
    error(`decision_log write also failed for change_set ${row.id}: ${logErr.message}`);
  }
  return "applied_unrecorded";
}

// Runs applyRow over every approved row for the adapter's platform and tallies the
// outcomes. Each pack's main() prints its own platform-specific summary line.
// rows + store are injectable so the loop is testable without a DB.
export async function applyRows(adapter, { rows, store = defaultStore, error } = {}) {
  const list = rows ?? await approvedRows(adapter.platform);
  // One do_not_touch lookup for the whole batch, threaded into each applyRow.
  const protectedUrls = await (store.doNotTouch ?? doNotTouch)();
  const tally = { applied: 0, escalated: 0, failed: 0, unrecorded: 0 };
  for (const row of list) {
    const outcome = await applyRow(row, adapter, store, { protectedUrls, error });
    if (outcome === "applied") tally.applied++;
    else if (outcome === "escalated") tally.escalated++;
    else if (outcome === "applied_unrecorded") tally.unrecorded++;
    else tally.failed++;
  }
  return tally;
}

// A pack run exits non-zero when any live write went unrecorded: change_set no longer
// matches what is live, and the next scheduled run would act on stale state.
export function applyExitCode(tally) {
  return tally.unrecorded > 0 ? 1 : 0;
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
  await snapshotUnlessUnavailable(adapter, store, row, current);

  const restoreRow = { ...row, new_value: old };
  await adapter.write(restoreRow);
  if (adapter.verify) await adapter.verify(restoreRow);

  const matched = await store.latestAppliedRow(adapter.platform, page_id, field);
  if (matched) await store.setStatus(matched.id, "rolledback");

  // change_type: null, not `field` — a rollback isn't a kit task, and "title"/"description"
  // are CMS field names, not KIT_TASKS members. Logging the field name here would let it
  // join the learning loop's byType aggregation as a fake task (the orphan-leak class
  // already fixed for narrate.applied(); see A11).
  await store.logDecision({
    url: null, action: "rolledback", risk_class: "safe",
    change_type: null, reason: `${adapter.platform} rollback ${field} on ${page_id}`,
  });
  return { restored: old, rowId: matched?.id ?? null };
}

export { logDecision };
