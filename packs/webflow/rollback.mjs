#!/usr/bin/env node
// packs/webflow/rollback.mjs — restores a field to its snapshotted value through the
// Webflow adapter. Re-stages the change; run publish.mjs to take live.
//
// Page SEO:  node packs/webflow/rollback.mjs --page-id 65abc... --field title
// CMS item:  node packs/webflow/rollback.mjs --page-id <itemId> --collection-id <cId> --field slug
// env: WEBFLOW_TOKEN
import { rollbackRow } from "../../orchestrator/lib/cms.mjs";
import { webflowAdapter } from "./apply.mjs";

function arg(name) { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : undefined; }

async function main() {
  const pageId = arg("page-id"), field = arg("field"), collectionId = arg("collection-id");
  if (!pageId || !field) throw new Error("usage: rollback.mjs --page-id <id> --field <name> [--collection-id <cId>]");

  const { rowId } = await rollbackRow(webflowAdapter, { page_id: pageId, field, collection_id: collectionId });
  console.log(`rolled back webflow ${field} on ${pageId} to snapshot (re-staged${rowId ? `, change_set ${rowId} → rolledback` : ""}). Publish to take live.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
