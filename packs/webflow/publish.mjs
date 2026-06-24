#!/usr/bin/env node
// packs/webflow/publish.mjs — takes staged changes live. IMPORTANT: a Webflow SITE
// publish is GLOBAL — it flushes EVERY pending change on the site, not just the agent's.
// So this is gated behind WEBFLOW_ALLOW_SITE_PUBLISH=true and meant for a controlled
// cadence. After publishing it runs a PSI canary on a sample URL.
//
// env: WEBFLOW_TOKEN, WEBFLOW_SITE_ID, WEBFLOW_ALLOW_SITE_PUBLISH=true,
//      WEBFLOW_PUBLISH_TO_SUBDOMAIN=true|false, PAGESPEED_API_KEY (optional)
import { execSync } from "node:child_process";
import { stagedRows, setStatus } from "../../orchestrator/lib/cms.mjs";

const TOKEN = process.env.WEBFLOW_TOKEN;
const SITE = process.env.WEBFLOW_SITE_ID;
const API = "https://api.webflow.com/v2";
if (!TOKEN || !SITE) throw new Error("Set WEBFLOW_TOKEN and WEBFLOW_SITE_ID");

if (process.env.WEBFLOW_ALLOW_SITE_PUBLISH !== "true") {
  console.error("Refusing to publish: a Webflow site publish is GLOBAL (flushes ALL pending site changes).");
  console.error("Review staged changes in the Designer, then set WEBFLOW_ALLOW_SITE_PUBLISH=true to proceed.");
  process.exit(1);
}

async function wf(path, init = {}) {
  const r = await fetch(`${API}${path}`, {
    ...init, headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", "accept-version": "2.0.0", ...(init.headers || {}) },
  });
  if (!r.ok) throw new Error(`Webflow ${r.status}: ${await r.text()}`);
  return r.json();
}

async function main() {
  const staged = await stagedRows("webflow");
  if (!staged.length) { console.log("nothing staged to publish."); return; }

  // Site publish (global). For CMS items you can instead publish ≤100 itemIds via
  // POST /collections/{cid}/items/publish — preferred when only CMS content changed.
  const toSubdomain = process.env.WEBFLOW_PUBLISH_TO_SUBDOMAIN === "true";
  await wf(`/sites/${SITE}/publish`, { method: "POST", body: JSON.stringify({ publishToWebflowSubdomain: toSubdomain }) });
  console.log(`published site ${SITE} (${staged.length} staged changes went live).`);

  for (const row of staged) await setStatus(row.id, "published");

  // PSI canary on the first published URL — catch a CWV regression early.
  const sample = staged.find((r) => r.url)?.url;
  if (sample) {
    try {
      execSync(`./scripts/check-vitals.sh "${sample}"`, { stdio: "inherit" });
    } catch {
      console.error(`CANARY FAIL: ${sample} regressed CWV after publish. Consider rollback.mjs + re-publish.`);
      process.exit(1);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
