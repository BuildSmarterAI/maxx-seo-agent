// packs/webflow/publish-core.mjs — pure publish logic for packs/webflow/publish.mjs,
// split out so the site-publish gate, mode selection, ≤100 chunking, and canary
// exit-code semantics are unit-testable without env/DB/network (audit M7). All I/O
// arrives via deps; this module imports nothing with import-time side effects.

// CMS-items-only rows can go live via selective item publish; any page-level row
// forces a GLOBAL site publish (flushes ALL pending site changes — hence the gate).
export function selectPublishMode(staged) {
  if (!staged.length) return "none";
  return staged.every((r) => r.collection_id) ? "items" : "site";
}

// Group rows by collection and split into ≤100-item chunks (Webflow API limit).
export function groupItemChunks(rows) {
  const byCollection = new Map();
  for (const row of rows) {
    const items = byCollection.get(row.collection_id) ?? [];
    byCollection.set(row.collection_id, [...items, row.page_id]);
  }
  const chunks = [];
  for (const [collectionId, itemIds] of byCollection) {
    for (let i = 0; i < itemIds.length; i += 100) {
      chunks.push({ collectionId, itemIds: itemIds.slice(i, i + 100) });
    }
  }
  return chunks;
}

// check-vitals.sh exit codes: 2 = real CWV regression (fail the publish run);
// anything else = the check itself could not run (warn, publish stands).
export function canaryOutcome(status) {
  return status === 2 ? "regression" : "inconclusive";
}

// Publishes staged rows via injected deps: { wf, setStatus, env, siteId, log, error }.
// Returns { mode, published, refused? }. Row statuses flip to "published" only after
// the publish API call(s) succeed; a refused global publish touches nothing.
export async function publishStaged(staged, deps) {
  const { wf, setStatus, env, siteId, log = console.log, error = console.error } = deps;
  const mode = selectPublishMode(staged);

  if (mode === "none") {
    log("nothing staged to publish.");
    return { mode, published: 0 };
  }

  if (mode === "items") {
    // Chunks are contiguous per collection; log each collection's summary as soon as its
    // chunks finish, so a mid-run failure still shows which collections already published.
    const byCollection = new Map();
    for (const chunk of groupItemChunks(staged)) {
      const chunks = byCollection.get(chunk.collectionId) ?? [];
      byCollection.set(chunk.collectionId, [...chunks, chunk.itemIds]);
    }
    for (const [cId, chunkList] of byCollection) {
      for (const itemIds of chunkList) {
        await wf(`/collections/${cId}/items/publish`, { method: "POST", body: JSON.stringify({ itemIds }) });
      }
      log(`published ${chunkList.flat().length} item(s) in collection ${cId}`);
    }
    log(`selective item publish complete (${staged.length} item(s)).`);
  } else {
    if (env.WEBFLOW_ALLOW_SITE_PUBLISH !== "true") {
      error("Refusing to publish: staged rows include page-level changes requiring a GLOBAL site publish.");
      error("Review staged changes in the Designer, then set WEBFLOW_ALLOW_SITE_PUBLISH=true to proceed.");
      return { mode, published: 0, refused: true };
    }
    const toSubdomain = env.WEBFLOW_PUBLISH_TO_SUBDOMAIN === "true";
    await wf(`/sites/${siteId}/publish`, { method: "POST", body: JSON.stringify({ publishToWebflowSubdomain: toSubdomain }) });
    log(`global site publish complete — ${staged.length} staged change(s) went live.`);
  }

  for (const row of staged) await setStatus(row.id, "published");
  return { mode, published: staged.length };
}
