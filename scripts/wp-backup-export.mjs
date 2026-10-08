#!/usr/bin/env node
// scripts/wp-backup-export.mjs — READ-ONLY pre-apply backup of WordPress posts/pages.
// GET requests only; never writes to WordPress or Supabase. Writes one full payload per id
// plus a manifest (SEO fields + content hash) under change_set/backup-<date>-<label>/.
//
// usage: node --env-file=.env scripts/wp-backup-export.mjs --label batch-1 300 7429 2639 5913
// env:   WP_BASE_URL, WP_USER, WP_APP_PASSWORD, SEO_PLUGIN=yoast|rankmath
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { wp } from "../packs/wordpress/http.mjs";
import { keysFor } from "../packs/wordpress/seo-keys.mjs";

const sha256 = (s) => createHash("sha256").update(s ?? "").digest("hex");

function parseArgs(argv) {
  const li = argv.indexOf("--label");
  const label = li > -1 ? argv[li + 1] : "export";
  const ids = argv.filter((a, i) => /^\d+$/.test(a) && i !== li + 1);
  if (!ids.length) throw new Error("usage: wp-backup-export.mjs [--label name] <id> [<id>...]");
  return { label, ids };
}

async function fetchPostOrPage(id) {
  for (const kind of ["posts", "pages"]) {
    try {
      return { kind, data: await wp(`${kind}/${id}?context=edit`) };
    } catch (e) {
      if (!String(e.message).startsWith("WP 404")) throw e;
    }
  }
  throw new Error(`WP: id ${id} is neither a post nor a page`);
}

function summarize(id, kind, data, keys) {
  const meta = data.meta ?? {};
  const head = data.yoast_head_json ?? {};
  const exposed = Object.fromEntries(Object.entries(keys).map(([f, k]) => [f, k in meta]));
  const content = data.content?.raw ?? "";
  return {
    id, kind, link: data.link, slug: data.slug, status: data.status, modified_gmt: data.modified_gmt,
    title_raw: data.title?.raw ?? null,
    seo_meta: Object.fromEntries(Object.entries(keys).map(([f, k]) => [f, meta[k] ?? null])),
    seo_meta_exposed: exposed,
    rendered: { title: head.title ?? null, description: head.description ?? null, canonical: head.canonical ?? null },
    content_bytes: Buffer.byteLength(content), content_sha256: sha256(content),
  };
}

async function main() {
  const { label, ids } = parseArgs(process.argv.slice(2));
  const keys = keysFor();
  if (!keys) throw new Error(`Unknown SEO_PLUGIN "${process.env.SEO_PLUGIN}"`);
  const dir = join("change_set", `backup-${new Date().toISOString().slice(0, 10)}-${label}`);
  await mkdir(dir, { recursive: true });

  const entries = [];
  for (const id of ids) {
    const { kind, data } = await fetchPostOrPage(id);
    await writeFile(join(dir, `${kind}-${id}.json`), JSON.stringify(data, null, 2));
    const entry = summarize(id, kind, data, keys);
    entries.push(entry);
    console.log(`exported ${kind}/${id} ${entry.slug} (${entry.content_bytes} bytes content)`);
  }
  const manifest = { exported_at: new Date().toISOString(), seo_plugin: process.env.SEO_PLUGIN || "yoast", entries };
  await writeFile(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`manifest: ${join(dir, "manifest.json")}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
