#!/usr/bin/env node
// packs/webflow/publish.mjs — takes staged changes live.
//
// Two publish modes (auto-selected):
//   CMS items only  → selective item publish per collection (≤100 itemIds each).
//                     No global site publish. Safer; only agent items go live.
//   Pages or mixed  → GLOBAL site publish. Flushes ALL pending changes on the site.
//                     Gated on WEBFLOW_ALLOW_SITE_PUBLISH=true.
//
// After publishing, runs a PSI canary on a sample URL.
//
// env: WEBFLOW_TOKEN, WEBFLOW_SITE_ID, WEBFLOW_ALLOW_SITE_PUBLISH=true (for global publish),
//      WEBFLOW_PUBLISH_TO_SUBDOMAIN=true|false, PAGESPEED_API_KEY (optional)
import { execFileSync } from "node:child_process";
import { stagedRows, setStatus } from "../../orchestrator/lib/cms.mjs";
import { wf } from "./http.mjs";

const SITE = process.env.WEBFLOW_SITE_ID;
if (!SITE) throw new Error("Set WEBFLOW_SITE_ID");

// Selective publish for CMS items: group by collection, publish ≤100 at a time.
async function publishItems(rows) {
  const byCollection = new Map();
  for (const row of rows) {
    const items = byCollection.get(row.collection_id) ?? [];
    items.push(row.page_id);
    byCollection.set(row.collection_id, items);
  }
  for (const [cId, itemIds] of byCollection) {
    const chunks = [];
    for (let i = 0; i < itemIds.length; i += 100) chunks.push(itemIds.slice(i, i + 100));
    for (const chunk of chunks) {
      await wf(`/collections/${cId}/items/publish`, { method: "POST", body: JSON.stringify({ itemIds: chunk }) });
    }
    console.log(`published ${itemIds.length} item(s) in collection ${cId}`);
  }
}

async function main() {
  const staged = await stagedRows("webflow");
  if (!staged.length) { console.log("nothing staged to publish."); return; }

  const allItems = staged.every((r) => r.collection_id);

  if (allItems) {
    // Selective item publish — no global site flush needed.
    await publishItems(staged);
    console.log(`selective item publish complete (${staged.length} item(s)).`);
  } else {
    // Mixed or page-only — requires global site publish.
    if (process.env.WEBFLOW_ALLOW_SITE_PUBLISH !== "true") {
      console.error("Refusing to publish: staged rows include page-level changes requiring a GLOBAL site publish.");
      console.error("Review staged changes in the Designer, then set WEBFLOW_ALLOW_SITE_PUBLISH=true to proceed.");
      process.exit(1);
    }
    const toSubdomain = process.env.WEBFLOW_PUBLISH_TO_SUBDOMAIN === "true";
    await wf(`/sites/${SITE}/publish`, { method: "POST", body: JSON.stringify({ publishToWebflowSubdomain: toSubdomain }) });
    console.log(`global site publish complete — ${staged.length} staged change(s) went live.`);
  }

  for (const row of staged) await setStatus(row.id, "published");

  // PSI canary on the first published URL. The URL is passed as an argv element (no shell
  // interpolation of DB-derived data). check-vitals.sh exits 2 on a real CWV regression and
  // 3 (or other) when it could not run (missing tool, network, parse) — so a transient
  // tooling failure is surfaced as a warning, not mistaken for a regression that would
  // wrongly trigger a rollback.
  const sample = staged.find((r) => r.url)?.url;
  if (sample) {
    try {
      execFileSync("bash", ["scripts/check-vitals.sh", sample], { stdio: "inherit" });
    } catch (err) {
      if (err?.status === 2) {
        console.error(`CANARY FAIL: ${sample} regressed CWV after publish. Consider rollback.mjs + re-publish.`);
        process.exit(1);
      }
      console.warn(`CANARY SKIPPED: could not run CWV check for ${sample} (exit ${err?.status ?? "?"}). Publish stands — verify CWV manually.`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
