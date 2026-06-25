#!/usr/bin/env node
// packs/wordpress/apply.mjs — applies APPROVED change_set rows to WordPress via REST.
// Snapshots the current value first, escalates on drift, and logs every action.
// The per-row lifecycle lives in cms.applyRow; this file is the WordPress adapter.
//
// WP META WRITES ARE IMMEDIATELY LIVE. Point WP_BASE_URL at a STAGING clone first,
// and require the SEO meta keys to be REST-exposed (see packs/wordpress/seo-rest-bridge.php).
//
// env: WP_BASE_URL, WP_USER, WP_APP_PASSWORD, SEO_PLUGIN=yoast|rankmath
import { fileURLToPath } from "node:url";
import { approvedRows, applyRow, logDecision } from "../../orchestrator/lib/cms.mjs";

const BASE = process.env.WP_BASE_URL?.replace(/\/$/, "");
const AUTH = "Basic " + Buffer.from(`${process.env.WP_USER}:${process.env.WP_APP_PASSWORD}`).toString("base64");
const PLUGIN = (process.env.SEO_PLUGIN || "yoast").toLowerCase();
if (!BASE) throw new Error("Set WP_BASE_URL (use a staging URL)");

const KEYS = {
  yoast:    { title: "_yoast_wpseo_title", description: "_yoast_wpseo_metadesc",
              canonical: "_yoast_wpseo_canonical", focus: "_yoast_wpseo_focuskw" },
  rankmath: { title: "rank_math_title", description: "rank_math_description",
              canonical: "rank_math_canonical_url", focus: "rank_math_focus_keyword" },
}[PLUGIN];

async function wp(path, init = {}) {
  const r = await fetch(`${BASE}/wp-json/wp/v2/${path}`, {
    ...init, headers: { Authorization: AUTH, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (!r.ok) throw new Error(`WP ${r.status}: ${await r.text()}`);
  return r.json();
}

// WP posts and pages live at different REST roots (/posts/{id} vs /pages/{id}).
// Resolve which once per id (memoized) so the pack can write meta/content to both.
// Without this, page ids (services, about, location pages) 404 against /posts/.
const _kind = new Map();
async function resolve(id) {
  if (_kind.has(id)) return _kind.get(id);
  for (const k of ["posts", "pages"]) {
    const r = await fetch(`${BASE}/wp-json/wp/v2/${k}/${id}?context=edit`,
      { headers: { Authorization: AUTH, "Content-Type": "application/json" } });
    if (r.ok) { _kind.set(id, k); return k; }
  }
  throw new Error(`WP: id ${id} is neither a post nor a page`);
}

const readMeta    = async (id, key) => (await wp(`${await resolve(id)}/${id}?context=edit`)).meta?.[key] ?? null;
const writeMeta   = async (id, key, value) => wp(`${await resolve(id)}/${id}`, { method: "POST", body: JSON.stringify({ meta: { [key]: value } }) });
const readContent = async (id) => (await wp(`${await resolve(id)}/${id}?context=edit`)).content?.raw ?? null;
const writeContent = async (id, value) => wp(`${await resolve(id)}/${id}`, { method: "POST", body: JSON.stringify({ content: { raw: value } }) });

// Soft post-write check: confirm the written value appears in Yoast's rendered head.
// Never throws — if yoast_head is absent (plugin inactive, old version) we degrade silently.
async function verifyYoastHead(id, field, expectedValue) {
  try {
    const post = await wp(`${await resolve(id)}/${id}?context=edit`);
    const head = post?.yoast_head;
    if (!head) return;
    if (!head.includes(expectedValue)) {
      await logDecision({
        url: post?.link ?? null, action: "skip", risk_class: "safe", change_type: "metadata",
        reason: `yoast_head verification: ${field} written but not found in rendered head (may need cache flush)`,
      });
    }
  } catch { /* degrade silently */ }
}

const isContent = (row) => row.field === "post_content";

export const wordpressAdapter = {
  platform: "wordpress",
  supports: (row) => isContent(row) || Boolean(KEYS?.[row.field]),
  // post_content drift is unreliable (Gutenberg block wrappers); the approval gate is
  // the safety net for full-body rewrites. Metadata fields are drift-checked.
  driftCheckable: (row) => !isContent(row),
  read: (row) => isContent(row) ? readContent(row.page_id) : readMeta(row.page_id, KEYS[row.field]),
  write: (row) => isContent(row)
    ? writeContent(row.page_id, row.new_value)
    : writeMeta(row.page_id, KEYS[row.field], row.new_value),
  verify: (row) => isContent(row) ? undefined : verifyYoastHead(row.page_id, row.field, row.new_value),
  narrate: {
    unsupported: (row) => ({ reason: `unsupported field ${row.field}` }),
    drift:       (row) => ({ change_type: row.change_type ?? "content" }),
    applied:     (row) => ({ change_type: row.change_type ?? row.field, reason: `wp ${row.field}` }),
    failed:      (row, err) => ({ reason: `wp apply failed: ${err.message}` }),
  },
};

async function main() {
  const rows = await approvedRows("wordpress");
  let applied = 0, escalated = 0, failed = 0;

  for (const row of rows) {
    const outcome = await applyRow(row, wordpressAdapter);
    if (outcome === "applied") applied++;
    else if (outcome === "escalated") escalated++;
    else failed++;
  }
  console.log(`WordPress apply — applied ${applied}, escalated ${escalated}, failed ${failed}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
