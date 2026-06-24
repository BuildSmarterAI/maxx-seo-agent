#!/usr/bin/env node
// packs/wordpress/rollback.mjs — restores a field to its snapshotted pre-change value.
//   node packs/wordpress/rollback.mjs --page-id 412 --field title
// env: WP_BASE_URL, WP_USER, WP_APP_PASSWORD, SEO_PLUGIN
import { latestSnapshot, setStatus, logDecision } from "../../orchestrator/lib/cms.mjs";

const BASE = process.env.WP_BASE_URL?.replace(/\/$/, "");
const AUTH = "Basic " + Buffer.from(`${process.env.WP_USER}:${process.env.WP_APP_PASSWORD}`).toString("base64");
const PLUGIN = (process.env.SEO_PLUGIN || "yoast").toLowerCase();
const KEYS = {
  yoast:    { title: "_yoast_wpseo_title", description: "_yoast_wpseo_metadesc", canonical: "_yoast_wpseo_canonical", focus: "_yoast_wpseo_focuskw" },
  rankmath: { title: "rank_math_title", description: "rank_math_description", canonical: "rank_math_canonical_url", focus: "rank_math_focus_keyword" },
}[PLUGIN];

function arg(name) { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : undefined; }

async function main() {
  const pageId = arg("page-id"), field = arg("field");
  if (!pageId || !field) throw new Error("usage: rollback.mjs --page-id <id> --field <title|description|canonical|focus>");
  const key = KEYS[field]; if (!key) throw new Error(`unsupported field ${field}`);

  const old = await latestSnapshot("wordpress", pageId, field);
  if (old == null) throw new Error("no snapshot found for that page/field");

  const r = await fetch(`${BASE}/wp-json/wp/v2/posts/${pageId}`, {
    method: "POST", headers: { Authorization: AUTH, "Content-Type": "application/json" },
    body: JSON.stringify({ meta: { [key]: old } }),
  });
  if (!r.ok) throw new Error(`WP ${r.status}: ${await r.text()}`);

  await logDecision({ url: null, action: "rolledback", risk_class: "safe", change_type: "metadata", reason: `wp rollback ${field} on ${pageId}` });
  console.log(`rolled back wordpress ${field} on post ${pageId} to snapshot.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
