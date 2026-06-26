#!/usr/bin/env node
// packs/webflow/rollback.mjs — restores a field to its snapshotted value.
//
// Page SEO:  node packs/webflow/rollback.mjs --page-id 65abc... --field title
// CMS item:  node packs/webflow/rollback.mjs --page-id <itemId> --collection-id <cId> --field slug
//
// Re-stages the change; run publish.mjs to take live.
// env: WEBFLOW_TOKEN
import { latestSnapshot, setStatus, logDecision } from "../../orchestrator/lib/cms.mjs";

const TOKEN = process.env.WEBFLOW_TOKEN;
const API = "https://api.webflow.com/v2";
if (!TOKEN) throw new Error("Set WEBFLOW_TOKEN");
function arg(name) { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : undefined; }

async function wf(path, init = {}) {
  const r = await fetch(`${API}${path}`, {
    ...init, headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", "accept-version": "2.0.0", ...(init.headers || {}) },
  });
  if (!r.ok) throw new Error(`Webflow ${r.status}: ${await r.text()}`);
  return r.json();
}

async function main() {
  const pageId       = arg("page-id");
  const field        = arg("field");
  const collectionId = arg("collection-id");
  if (!pageId || !field) throw new Error("usage: rollback.mjs --page-id <id> --field <name> [--collection-id <cId>]");

  const old = await latestSnapshot("webflow", pageId, field);
  if (old == null) throw new Error("no snapshot found for that page/field");

  if (collectionId) {
    await wf(`/collections/${collectionId}/items/${pageId}`, {
      method: "PATCH",
      body: JSON.stringify({ fieldData: { [field]: old } }),
    });
    await logDecision({ url: null, action: "rolledback", risk_class: "safe", change_type: "metadata", reason: `webflow cms-item rollback ${field} on item ${pageId} (re-staged)` });
    console.log(`rolled back webflow cms-item ${field} on item ${pageId} to snapshot. Publish to take live.`);
  } else {
    await wf(`/pages/${pageId}`, {
      method: "PATCH",
      body: JSON.stringify({ seo: { [field]: old } }),
    });
    await logDecision({ url: null, action: "rolledback", risk_class: "safe", change_type: "metadata", reason: `webflow page rollback ${field} on ${pageId} (re-staged)` });
    console.log(`rolled back webflow page ${field} on page ${pageId} to snapshot. Publish to take live.`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
