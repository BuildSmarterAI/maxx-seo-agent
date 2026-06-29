#!/usr/bin/env node
// packs/wordpress/rollback.mjs — restores a field to its snapshotted pre-change value
// through the WordPress adapter, so it inherits post-vs-page + content-vs-meta routing.
//   node packs/wordpress/rollback.mjs --page-id 412 --field title
// env: WP_BASE_URL, WP_USER, WP_APP_PASSWORD, SEO_PLUGIN
import { rollbackRow } from "../../orchestrator/lib/cms.mjs";
import { wordpressAdapter } from "./apply.mjs";

function arg(name) { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : undefined; }

async function main() {
  const pageId = arg("page-id"), field = arg("field");
  if (!pageId || !field) throw new Error("usage: rollback.mjs --page-id <id> --field <title|description|canonical|focus|post_content>");

  const { rowId } = await rollbackRow(wordpressAdapter, { page_id: pageId, field });
  console.log(`rolled back wordpress ${field} on ${pageId} to snapshot${rowId ? ` (change_set ${rowId} → rolledback)` : ""}.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
