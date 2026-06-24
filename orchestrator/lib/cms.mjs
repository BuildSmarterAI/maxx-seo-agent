// cms.mjs — shared engine for the live-CMS apply layer (WordPress + Webflow).
// Handles the three jobs git gives you for free: review state, snapshot/rollback, and
// drift detection. Adapters (wordpress/, webflow/) supply read() and write().
import { db, logDecision } from "./supabase.mjs";

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

export { logDecision };
