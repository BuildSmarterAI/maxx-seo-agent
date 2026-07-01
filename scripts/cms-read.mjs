#!/usr/bin/env node
// scripts/cms-read.mjs — resolves page_id and reads the current field value (base_value)
// from the live CMS using the existing authenticated clients (packs/wordpress/http.mjs wp(),
// packs/webflow/http.mjs wf()). It REPLACES the open-ended `curl ... ${URL}` the CMS agent
// used to improvise, so the queue URL is never concatenated into a shell command. Output is
// written to a JSON file (default change_set/_pending/<slug>.read.json) AND echoed to stdout;
// the agent reads the FILE with the Read tool (never $()-captures stdout).
//
//   node scripts/cms-read.mjs --url <U> --platform <wordpress|webflow> --field <F> [--collection-id <cId>] [--out <path>]
//
// Exit 0 on success, 1 on usage/lookup error. The platform clients are imported lazily so
// only the relevant platform's credentials are required.
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

function args(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i += 2) o[argv[i].replace(/^--/, "")] = argv[i + 1];
  return o;
}

// Last non-empty path segment of the URL (the CMS slug). Pure; used for lookup + filename.
export function slugFromUrl(url) {
  const segs = new URL(url).pathname.split("/").filter(Boolean);
  return segs[segs.length - 1] || "home";
}

// WordPress: find the post (then page) by slug, then read content or the SEO meta key.
export async function readWordpress(url, field) {
  const { wp } = await import("../packs/wordpress/http.mjs");
  const { keysFor } = await import("../packs/wordpress/seo-keys.mjs");
  const slug = encodeURIComponent(slugFromUrl(url));
  let kind = "posts";
  let hits = await wp(`posts?slug=${slug}&status=any`);
  if (!Array.isArray(hits) || !hits.length) { kind = "pages"; hits = await wp(`pages?slug=${slug}&status=any`); }
  if (!Array.isArray(hits) || !hits.length) throw new Error(`WP: no post/page for slug ${slug}`);
  const id = hits[0].id;
  const full = await wp(`${kind}/${id}?context=edit`);
  const base_value = field === "post_content"
    ? (full.content?.raw ?? null)
    : (full.meta?.[keysFor()[field]] ?? null);
  return { page_id: String(id), base_value };
}

// Webflow: CMS item by slug (with --collection-id) or page SEO by slug.
export async function readWebflow(url, field, collectionId) {
  const { wf } = await import("../packs/webflow/http.mjs");
  const slug = slugFromUrl(url);
  if (collectionId) {
    const { items } = await wf(`/collections/${collectionId}/items`);
    const item = (items || []).find((it) => it.fieldData?.slug === slug);
    if (!item) throw new Error(`Webflow: no CMS item with slug ${slug} in ${collectionId}`);
    return { page_id: item.id, base_value: item.fieldData?.[field] ?? null };
  }
  const site = process.env.WEBFLOW_SITE_ID;
  if (!site) throw new Error("Set WEBFLOW_SITE_ID");
  const { pages } = await wf(`/sites/${site}/pages`);
  const page = (pages || []).find((p) => p.slug === slug);
  if (!page) throw new Error(`Webflow: no page with slug ${slug}`);
  return { page_id: page.id, base_value: page.seo?.[field] ?? null };
}

async function main() {
  const a = args(process.argv.slice(2));
  if (!a.url || !a.platform || !a.field) {
    console.error("usage: cms-read.mjs --url <U> --platform <wordpress|webflow> --field <F> [--collection-id <cId>] [--out <path>]");
    process.exit(1);
  }
  const platform = a.platform.toLowerCase();
  const slug = slugFromUrl(a.url);
  const read = platform === "webflow"
    ? await readWebflow(a.url, a.field, a["collection-id"])
    : await readWordpress(a.url, a.field);
  const result = {
    platform, url: a.url, slug, page_id: read.page_id,
    collection_id: a["collection-id"] ?? null, field: a.field, base_value: read.base_value,
  };
  // Sanitize the slug for the filename so a malformed URL can't traverse out of the dir.
  const fileSlug = slug.replace(/[^A-Za-z0-9._-]/g, "_");
  const out = a.out || `change_set/_pending/${fileSlug}.read.json`;
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(result, null, 2), "utf8");
  console.log(JSON.stringify(result));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(`cms-read: ${e.message}`); process.exit(1); });
}
