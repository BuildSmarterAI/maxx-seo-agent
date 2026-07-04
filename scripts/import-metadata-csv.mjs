#!/usr/bin/env node
// scripts/import-metadata-csv.mjs
// Reads metadata-changes.csv, looks up WP post IDs via REST, and upserts rows into
// the change_set Supabase table as status=pending, so a human still flips them to
// approved (ADR-005 gate) before the nightly wp:apply cron writes them live.
// The CSV is validated up front — nothing is inserted if any row fails.
// env: WP_BASE_URL, WP_USER, WP_APP_PASSWORD, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { db as sb } from "../lib/db.mjs";
import { parseCsv } from "./lib/csv.mjs";
import { validateMetadataRecords, buildChangeSetRow } from "./lib/metadata.mjs";

const ROOT  = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE  = process.env.WP_BASE_URL?.replace(/\/$/, "");
const AUTH  = "Basic " + Buffer.from(`${process.env.WP_USER}:${process.env.WP_APP_PASSWORD}`).toString("base64");
const BATCH = `metadata-csv-${new Date().toISOString().slice(0, 10)}`;

if (!BASE) throw new Error("WP_BASE_URL not set");

// ── WP helpers ───────────────────────────────────────────────────────────────

async function wpGet(path) {
  const r = await fetch(`${BASE}/wp-json/wp/v2/${path}`, { headers: { Authorization: AUTH } });
  if (!r.ok) return [];
  return r.json();
}

async function resolvePageId(url) {
  // Extract slug from URL path
  const slug = url.replace(/^https?:\/\/[^/]+\/?/, "").replace(/\/$/, "") || "__home__";

  if (slug === "__home__") {
    // Homepage — find by page set as front page
    const settings = await fetch(`${BASE}/wp-json/wp/v2/settings`, { headers: { Authorization: AUTH } }).then(r => r.json()).catch(() => ({}));
    if (settings.page_on_front) return String(settings.page_on_front);
    // fallback: look for page with slug '' or id 2
    return "2";
  }

  // Try posts first, then pages
  for (const type of ["posts", "pages"]) {
    const results = await wpGet(`${type}?slug=${encodeURIComponent(slug)}&status=any&per_page=1`);
    if (Array.isArray(results) && results.length > 0) return String(results[0].id);
  }
  return null;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const csv  = await readFile(join(ROOT, "metadata-changes.csv"), "utf8");
  const rows = parseCsv(csv);

  // Validate the whole CSV before touching Supabase. A single bad row (over-cap,
  // no-op, duplicate title, or non-self-referencing canonical) aborts the import —
  // nothing is staged — so unvalidated metadata can't slip into the approval queue.
  const errors = validateMetadataRecords(rows);
  if (errors.length) {
    console.error(`import-metadata-csv: ${errors.length} validation issue(s) — nothing inserted:`);
    errors.forEach((e) => console.error(" •", e));
    process.exit(1);
  }

  let inserted = 0, skipped = 0, failed = 0;

  for (const row of rows) {
    const { url, page_id: csvPageId, current_title, new_title, current_description, new_description, canonical } = row;
    if (!url) continue;

    // Resolve WP page_id
    const page_id = csvPageId || await resolvePageId(url);
    if (!page_id) {
      console.warn(`  ? no page_id found for ${url} — skipping`);
      skipped++;
      continue;
    }

    // canonical's base_value stays empty (Yoast auto-generates if unset) and is queued
    // whenever a non-empty value is supplied; title/description only when they actually change.
    const FIELDS = [
      { field: "title",       current: current_title,       next: new_title },
      { field: "description", current: current_description, next: new_description },
      { field: "canonical",   current: "",                  next: canonical, always: true },
    ];
    const changes = FIELDS
      .filter((f) => f.next && (f.always || f.next !== f.current))
      .map((f) => ({ field: f.field, base_value: f.current || "", new_value: f.next }));

    if (changes.length === 0) {
      console.log(`  = no changes  ${url}`);
      skipped++;
      continue;
    }

    for (const change of changes) {
      const { error } = await sb.from("change_set").insert(buildChangeSetRow({
        page_id,
        url,
        field:      change.field,
        base_value: change.base_value,
        new_value:  change.new_value,
        batch:      BATCH,
      }));
      if (error) {
        console.error(`  ✗ failed  ${url} [${change.field}]: ${error.message}`);
        failed++;
      } else {
        console.log(`  ✓ queued  ${url} [${change.field}]  page_id=${page_id}`);
        inserted++;
      }
    }
  }

  console.log(`\nDone — ${inserted} rows inserted, ${skipped} skipped, ${failed} failed`);
  console.log(`Batch: ${BATCH}`);
  if (inserted > 0) console.log("Run `npm run wp:apply` to push to WordPress.");
}

main().catch(e => { console.error(e); process.exit(1); });
