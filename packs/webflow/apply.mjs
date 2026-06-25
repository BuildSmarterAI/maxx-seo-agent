#!/usr/bin/env node
// packs/webflow/apply.mjs — applies APPROVED change_set rows to Webflow via Data API v2.
// Two targets:
//   - Page SEO (collection_id IS NULL):  PATCH /pages/{pageId} — stages until site publish.
//   - CMS item  (collection_id IS SET):  PATCH /collections/{cId}/items/{pageId} — stages
//     until item publish (selective) or site publish.
// Snapshots first, escalates on drift.
//
// env: WEBFLOW_TOKEN  (Bearer)
import { approvedRows, snapshot, drifted, setStatus, logDecision }
  from "../../orchestrator/lib/cms.mjs";

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

async function applyPageRow(row) {
  if (!["title", "description"].includes(row.field)) return "unsupported-field";
  const current = (await readPageSeo(row.page_id))[row.field];
  await snapshot(row, current);
  if (drifted(row, current)) return "drifted";
  await writePageSeo(row.page_id, row.field, row.new_value);
  return "applied";
}

async function applyItemRow(row) {
  const fields = await readItemField(row.collection_id, row.page_id);
  const current = fields[row.field] ?? null;
  await snapshot(row, current);
  if (drifted(row, current)) return "drifted";
  await writeItemField(row.collection_id, row.page_id, row.field, row.new_value);
  return "applied";
}

async function main() {
  const rows = await approvedRows("webflow");
  let staged = 0, escalated = 0, failed = 0;

  for (const row of rows) {
    const isCmsItem = Boolean(row.collection_id);
    try {
      const outcome = isCmsItem ? await applyItemRow(row) : await applyPageRow(row);

      if (outcome === "unsupported-field") {
        await setStatus(row.id, "escalated");
        await logDecision({ url: row.url, action: "escalate", risk_class: "gated", reason: `unsupported webflow field ${row.field}` });
        escalated++; continue;
      }
      if (outcome === "drifted") {
        await setStatus(row.id, "escalated");
        await logDecision({ url: row.url, action: "escalate", risk_class: "gated", change_type: "metadata", reason: "drift: live value changed since generation" });
        escalated++; continue;
      }

      await setStatus(row.id, "applied", { applied_at: new Date().toISOString() });
      await logDecision({ url: row.url, action: "applied", risk_class: "safe", change_type: row.change_type ?? "metadata", reason: isCmsItem ? `webflow cms-item ${row.field} (staged)` : `webflow page ${row.field} (staged)` });
      staged++;
    } catch (e) {
      await setStatus(row.id, "failed");
      await logDecision({ url: row.url, action: "skip", risk_class: "safe", reason: `webflow apply failed: ${e.message}` });
      failed++;
    }
  }
  console.log(`Webflow apply — staged ${staged}, escalated ${escalated}, failed ${failed}. Run publish.mjs to go live.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
