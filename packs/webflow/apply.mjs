#!/usr/bin/env node
// packs/webflow/apply.mjs — applies APPROVED change_set rows to Webflow via Data API v2.
// Two targets:
//   - Page SEO (collection_id IS NULL):  PATCH /pages/{pageId} — stages until site publish.
//   - CMS item  (collection_id IS SET):  PATCH /collections/{cId}/items/{pageId} — stages
//     until item publish (selective) or site publish.
// Snapshots first, escalates on drift. The per-row lifecycle lives in cms.applyRow;
// this file is the Webflow adapter.
//
// env: WEBFLOW_TOKEN  (Bearer)
import { fileURLToPath } from "node:url";
import { approvedRows, applyRow } from "../../orchestrator/lib/cms.mjs";

const TOKEN = process.env.WEBFLOW_TOKEN;
const API = "https://api.webflow.com/v2";
if (!TOKEN) throw new Error("Set WEBFLOW_TOKEN");

async function wf(path, init = {}) {
  const r = await fetch(`${API}${path}`, {
    ...init, headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", "accept-version": "2.0.0", ...(init.headers || {}) },
  });
  if (!r.ok) throw new Error(`Webflow ${r.status}: ${await r.text()}`);
  return r.json();
}

// ---- Page SEO helpers ----
const readPageSeo  = async (pageId) => {
  const p = await wf(`/pages/${pageId}`);
  return { title: p?.seo?.title ?? null, description: p?.seo?.description ?? null };
};
const writePageSeo = (pageId, field, value) =>
  wf(`/pages/${pageId}`, { method: "PATCH", body: JSON.stringify({ seo: { [field]: value } }) });

// ---- CMS item helpers ----
const readItemField  = async (collectionId, itemId) => {
  const item = await wf(`/collections/${collectionId}/items/${itemId}`);
  return item?.fieldData ?? {};
};
const writeItemField = (collectionId, itemId, field, value) =>
  wf(`/collections/${collectionId}/items/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify({ fieldData: { [field]: value } }),
  });

const isCmsItem = (row) => Boolean(row.collection_id);

export const webflowAdapter = {
  platform: "webflow",
  // CMS items accept any field; pages only the two SEO fields Webflow exposes.
  supports: (row) => isCmsItem(row) || ["title", "description"].includes(row.field),
  driftCheckable: () => true,
  read: async (row) => isCmsItem(row)
    ? (await readItemField(row.collection_id, row.page_id))[row.field] ?? null
    : (await readPageSeo(row.page_id))[row.field],
  write: (row) => isCmsItem(row)
    ? writeItemField(row.collection_id, row.page_id, row.field, row.new_value)
    : writePageSeo(row.page_id, row.field, row.new_value),
  narrate: {
    unsupported: (row) => ({ reason: `unsupported webflow field ${row.field}` }),
    drift:       () => ({ change_type: "metadata" }),
    applied:     (row) => ({
      change_type: row.change_type ?? "metadata",
      reason: isCmsItem(row) ? `webflow cms-item ${row.field} (staged)` : `webflow page ${row.field} (staged)`,
    }),
    failed:      (row, err) => ({ reason: `webflow apply failed: ${err.message}` }),
  },
};

async function main() {
  const rows = await approvedRows("webflow");
  let staged = 0, escalated = 0, failed = 0;

  for (const row of rows) {
    const outcome = await applyRow(row, webflowAdapter);
    if (outcome === "applied") staged++;
    else if (outcome === "escalated") escalated++;
    else failed++;
  }
  console.log(`Webflow apply — staged ${staged}, escalated ${escalated}, failed ${failed}. Run publish.mjs to go live.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
