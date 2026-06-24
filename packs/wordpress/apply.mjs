#!/usr/bin/env node
// packs/wordpress/apply.mjs — applies APPROVED change_set rows to WordPress via REST.
// Snapshots the current value first, escalates on drift, and logs every action.
//
// WP META WRITES ARE IMMEDIATELY LIVE. Point WP_BASE_URL at a STAGING clone first,
// and require the SEO meta keys to be REST-exposed (see packs/wordpress/seo-rest-bridge.php).
//
// env: WP_BASE_URL, WP_USER, WP_APP_PASSWORD, SEO_PLUGIN=yoast|rankmath
import { approvedRows, snapshot, drifted, setStatus, latestSnapshot, logDecision }
  from "../../orchestrator/lib/cms.mjs";

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

const readMeta = async (id, key) => (await wp(`posts/${id}?context=edit`)).meta?.[key] ?? null;
const writeMeta = (id, key, value) => wp(`posts/${id}`, { method: "POST", body: JSON.stringify({ meta: { [key]: value } }) });

async function main() {
  const rows = await approvedRows("wordpress");
  let applied = 0, escalated = 0, failed = 0;

  for (const row of rows) {
    const key = KEYS[row.field];
    try {
      if (!key) { await setStatus(row.id, "escalated"); await logDecision({ url: row.url, action: "escalate", risk_class: "gated", reason: `unsupported field ${row.field}` }); escalated++; continue; }

      const current = await readMeta(row.page_id, key);
      await snapshot(row, current);                      // rollback tape, always

      if (drifted(row, current)) {                       // human edited since → don't clobber
        await setStatus(row.id, "escalated");
        await logDecision({ url: row.url, action: "escalate", risk_class: "gated", change_type: "metadata", reason: "drift: live value changed since generation" });
        escalated++; continue;
      }

      await writeMeta(row.page_id, key, row.new_value);
      await setStatus(row.id, "applied", { applied_at: new Date().toISOString() });
      await logDecision({ url: row.url, action: "applied", risk_class: "safe", change_type: "metadata", reason: `wp ${row.field}` });
      applied++;
    } catch (e) {
      await setStatus(row.id, "failed");
      await logDecision({ url: row.url, action: "skip", risk_class: "safe", reason: `wp apply failed: ${e.message}` });
      failed++;
    }
  }
  console.log(`WordPress apply — applied ${applied}, escalated ${escalated}, failed ${failed}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
