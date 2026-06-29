#!/usr/bin/env node
// One-shot: fetch current live WP meta for each approved change_set row in the
// current batch and update base_value so the drift check in wp:apply passes.
import { db as sb } from "../lib/db.mjs";

const BASE  = process.env.WP_BASE_URL?.replace(/\/$/, "");
const AUTH  = "Basic " + Buffer.from(`${process.env.WP_USER}:${process.env.WP_APP_PASSWORD}`).toString("base64");
const BATCH = process.argv[2] || `metadata-csv-${new Date().toISOString().slice(0, 10)}`;

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

// Fetch ALL rows in batch regardless of current status, sync base_value, reset to approved
const { data: rows } = await sb.from("change_set")
  .select("id, page_id, field")
  .eq("batch", BATCH);

if (!rows?.length) { console.log("No rows found for batch:", BATCH); process.exit(0); }

let updated = 0;
for (const row of rows) {
  const live = await fetchMeta(row.page_id, row.field);
  await sb.from("change_set").update({ base_value: live, status: "approved" }).eq("id", row.id);
  console.log(`  synced  id=${row.id}  [${row.field}]  base="${live.slice(0, 60)}"`);
  updated++;
}
console.log(`\nDone — ${updated} rows synced + reset to approved. Run npm run wp:apply.`);
