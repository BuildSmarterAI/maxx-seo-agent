#!/usr/bin/env node
// packs/webflow/apply.mjs — applies APPROVED change_set rows to Webflow via Data API v2.
// Page SEO writes STAGE the change (they only go live on a site publish), which is
// Webflow's natural draft gate. Snapshots first, escalates on drift.
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

// page-level SEO (title/description). CMS-item fields can be added via collection_id rows.
const readPageSeo = async (pageId) => {
  const p = await wf(`/pages/${pageId}`);
  return { title: p?.seo?.title ?? null, description: p?.seo?.description ?? null };
};
const writePageSeo = (pageId, field, value) =>
  wf(`/pages/${pageId}`, { method: "PATCH", body: JSON.stringify({ seo: { [field]: value } }) });

async function main() {
  const rows = await approvedRows("webflow");
  let staged = 0, escalated = 0, failed = 0;

  for (const row of rows) {
    try {
      if (!["title", "description"].includes(row.field)) {
        await setStatus(row.id, "escalated");
        await logDecision({ url: row.url, action: "escalate", risk_class: "gated", reason: `unsupported webflow field ${row.field}` });
        escalated++; continue;
      }

      const current = (await readPageSeo(row.page_id))[row.field];
      await snapshot(row, current);

      if (drifted(row, current)) {
        await setStatus(row.id, "escalated");
        await logDecision({ url: row.url, action: "escalate", risk_class: "gated", change_type: "metadata", reason: "drift: live value changed since generation" });
        escalated++; continue;
      }

      await writePageSeo(row.page_id, row.field, row.new_value);
      await setStatus(row.id, "applied", { applied_at: new Date().toISOString() });  // staged until publish
      await logDecision({ url: row.url, action: "applied", risk_class: "safe", change_type: "metadata", reason: `webflow ${row.field} (staged)` });
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
