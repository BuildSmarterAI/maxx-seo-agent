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
// Publish logic (mode selection, gate, chunking, canary semantics) lives in
// ./publish-core.mjs so it is unit-testable without env/DB/network (audit M7).
//
// env: WEBFLOW_TOKEN, WEBFLOW_SITE_ID, WEBFLOW_ALLOW_SITE_PUBLISH=true (for global publish),
//      WEBFLOW_PUBLISH_TO_SUBDOMAIN=true|false, PAGESPEED_API_KEY (optional)
import { execFileSync } from "node:child_process";
import { stagedRows, setStatus } from "../../orchestrator/lib/cms.mjs";
import { wf } from "./http.mjs";
import { publishStaged, canaryOutcome } from "./publish-core.mjs";

const SITE = process.env.WEBFLOW_SITE_ID;
if (!SITE) throw new Error("Set WEBFLOW_SITE_ID");

async function main() {
  const staged = await stagedRows("webflow");
  const result = await publishStaged(staged, { wf, setStatus, env: process.env, siteId: SITE });
  if (result.refused) process.exit(1);
  if (!result.published) return;

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
      if (canaryOutcome(err?.status) === "regression") {
        console.error(`CANARY FAIL: ${sample} regressed CWV after publish. Consider rollback.mjs + re-publish.`);
        process.exit(1);
      }
      console.warn(`CANARY SKIPPED: could not run CWV check for ${sample} (exit ${err?.status ?? "?"}). Publish stands — verify CWV manually.`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
