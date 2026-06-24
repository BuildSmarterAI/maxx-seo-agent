#!/usr/bin/env node
// packs/webflow/rollback.mjs — restores a page SEO field to its snapshotted value,
// then re-stages it. Run publish.mjs (or publish in the Designer) to take live.
//   node packs/webflow/rollback.mjs --page-id 65abc... --field title
// env: WEBFLOW_TOKEN
import { latestSnapshot, setStatus, logDecision } from "../../orchestrator/lib/cms.mjs";

const TOKEN = process.env.WEBFLOW_TOKEN;
const API = "https://api.webflow.com/v2";
if (!TOKEN) throw new Error("Set WEBFLOW_TOKEN");
function arg(name) { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : undefined; }

async function main() {
  const pageId = arg("page-id"), field = arg("field");
  if (!pageId || !field) throw new Error("usage: rollback.mjs --page-id <id> --field <title|description>");

  const old = await latestSnapshot("webflow", pageId, field);
  if (old == null) throw new Error("no snapshot found for that page/field");

  const r = await fetch(`${API}/pages/${pageId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", "accept-version": "2.0.0" },
    body: JSON.stringify({ seo: { [field]: old } }),
  });
  if (!r.ok) throw new Error(`Webflow ${r.status}: ${await r.text()}`);

  await logDecision({ url: null, action: "rolledback", risk_class: "safe", change_type: "metadata", reason: `webflow rollback ${field} on ${pageId} (re-staged)` });
  console.log(`rolled back webflow ${field} on page ${pageId} to snapshot. Publish to take live.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
