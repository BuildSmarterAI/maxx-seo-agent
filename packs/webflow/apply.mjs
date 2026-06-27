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
import { applyRows } from "../../orchestrator/lib/cms.mjs";
import { wf } from "./http.mjs";

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
  const { applied: staged, escalated, failed } = await applyRows(webflowAdapter);
  console.log(`Webflow apply — staged ${staged}, escalated ${escalated}, failed ${failed}. Run publish.mjs to go live.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
