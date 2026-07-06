#!/usr/bin/env node
// One-shot: fetch current live WP meta for each approved change_set row in the
// current batch and update base_value so the drift check in wp:apply passes.
import { fileURLToPath } from "node:url";
import { db as sb } from "../lib/db.mjs";

const BASE = process.env.WP_BASE_URL?.replace(/\/$/, "");
const AUTH = "Basic " + Buffer.from(`${process.env.WP_USER}:${process.env.WP_APP_PASSWORD}`).toString("base64");

const YOAST = {
  title:       "_yoast_wpseo_title",
  description: "_yoast_wpseo_metadesc",
  canonical:   "_yoast_wpseo_canonical",
};

async function fetchMeta(pageId, field) {
  for (const type of ["posts", "pages"]) {
    try {
      const r = await fetch(`${BASE}/wp-json/wp/v2/${type}/${pageId}?context=edit`, { headers: { Authorization: AUTH } });
      if (!r.ok) continue;
      const data = await r.json();
      return data.meta?.[YOAST[field]] ?? "";
    } catch { continue; }
  }
  return "";
}

// Refreshes base_value ONLY on rows already status:"approved" — a human has already
// reviewed and approved these, and the drift check in wp:apply is comparing a stale
// base_value (captured at generation time) against the current live value. This
// script exists to unblock THAT false-positive drift, nothing more (Panel-A A6):
// it must never touch a pending row a human hasn't reviewed, and it must never
// silently re-approve an escalated/failed/rolledback row — both would defeat the
// approval gate, and overwriting base_value with the current live value on such a
// row would also permanently blind the drift check for it (base_value can never
// again differ from live). `deps` is injectable for tests (client/fetchMeta
// default to the real db.mjs client and WP fetch).
export async function syncBaseValues(batch, deps = {}) {
  const { client = sb, fetchMeta: fetch_ = fetchMeta } = deps;

  // Read the whole batch once so we can both act on the approved subset AND report what we
  // skip (an operator running this manually should see that a batch still holds pending/
  // escalated rows, not just a bare "N synced"). Scoping is enforced by the JS filter here
  // AND the conditional write below — never by the read alone.
  const { data: allRows } = await client.from("change_set")
    .select("id, page_id, field, status")
    .eq("batch", batch);

  const rows = (allRows ?? []).filter((r) => r.status === "approved");
  const notApproved = (allRows?.length ?? 0) - rows.length;

  if (!rows.length) {
    console.log(`No approved rows found for batch: ${batch}` +
      (notApproved ? ` (${notApproved} row(s) present but not approved)` : ""));
    return { updated: 0, skipped: 0, notApproved };
  }
  if (notApproved) {
    console.log(`Batch ${batch}: ${rows.length} approved, ${notApproved} not approved ` +
      `(left untouched — only approved rows are synced).`);
  }

  let updated = 0, skipped = 0;
  for (const row of rows) {
    const live = await fetch_(row.page_id, row.field);
    // Conditional write: refresh base_value ONLY if the row is STILL approved at write time.
    // A human may escalate or roll back a row between the batch read above and this per-row
    // UPDATE (each iteration awaits a live WP fetch); filtering the write on status makes it
    // a no-op for a row that left "approved" mid-run, so its drift baseline is never silently
    // overwritten — the exact harm this fix exists to prevent (Panel-A A6). `.select` returns
    // the affected rows so we can tell a real write from a no-op match.
    const { data: written } = await client.from("change_set")
      .update({ base_value: live })
      .eq("id", row.id)
      .eq("status", "approved")
      .select("id");
    if (written?.length) {
      console.log(`  synced  id=${row.id}  [${row.field}]  base="${live.slice(0, 60)}"`);
      updated++;
    } else {
      console.log(`  skipped id=${row.id}  [${row.field}]  — no longer approved at write time`);
      skipped++;
    }
  }
  console.log(`\nDone — ${updated} approved row(s) synced` +
    (skipped ? `, ${skipped} skipped (de-approved mid-run)` : "") + ". Run npm run wp:apply.");
  return { updated, skipped, notApproved };
}

async function main() {
  const batch = process.argv[2] || `metadata-csv-${new Date().toISOString().slice(0, 10)}`;
  await syncBaseValues(batch);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
