# Spike — Yoast→Semrush proxy auth (headless reachability)

**Date:** 2026-06-25
**Author:** Harris / BuildSmarter
**Question:** Before counting on keyword expansion, does a headless/service auth path
exist for the Yoast→Semrush proxy, or is it strictly admin-UI / nonce-bound?

---

## TL;DR

**It already works headlessly with the existing `WP_APP_PASSWORD`.** A live probe of
`www.maxxbuilders.com` returned real Semrush keyword data over Basic auth. Keyword
expansion is reachable *now* — no new credential — but it rests on a human-established
Semrush OAuth token and Semrush account quota, so it must be adopted **fail-soft behind a
flag** per [ADR-008](../adr/ADR-008-documented-yoast-surfaces-only.md), never as a hard
dependency.

## What was probed (live, read-only)

| Route | Method / args | Unauth | With `WP_APP_PASSWORD` (Basic) |
|---|---|---|---|
| `yoast/v1/semrush/related_keyphrases` | GET `keyphrase, country_code` | 401 `rest_forbidden` | **HTTP 200 + data** |
| `yoast/v1/semrush/authenticate` | POST `code` | 404 (POST-only) | OAuth callback (admin-UI) |
| `yoast/v1/semrush/country_code` | POST `country_code` | 404 (POST-only) | stores locale |

`related_keyphrases?keyphrase=warehouse+construction+cost&country_code=us` returned an
envelope of `columnNames` + `rows`:

- **Columns:** Keyword, Search Volume, Trends, Intent, Keyword Difficulty Index.
- **Sample:** `warehouse construction cost` → vol 390, KDI 21, intent 1; plus related
  long-tail phrases with their own volume/KDI.

## Why it works

1. **WP permission check** is satisfied by the Basic-auth WP user (the Editor-scoped
   Application Password the apply pack already uses). No browser nonce required for the
   GET proxy.
2. **A Semrush OAuth token is already connected** server-side — a human completed the
   "Connect to Semrush" OAuth flow in the Yoast admin at some point. `related_keyphrases`
   proxies to Semrush using that stored token.

## Fragility (the reason it stays flagged, not a hard dep)

1. **Token is human-established and can vanish.** It came from the admin-UI OAuth flow
   (`authenticate` POST exchanges a Semrush browser-redirect `code`). It **cannot** be
   re-established headlessly. If it expires / is revoked / disconnected, the proxy breaks
   and only a human can reconnect it in WP admin.
2. **Semrush account quota.** Every call spends Yoast-account Semrush units; a heavy
   nightly loop can exhaust them.
3. **Undocumented envelope.** The `columnNames`/`rows` shape is a Yoast-internal contract
   that a plugin update can change without notice.

## Verdict / adoption gate

Viable as a **fail-soft, flagged enrichment** — e.g. expand a queue row's `target_query`
into related phrases during `metadata-generate`, degrading silently to "no expansion" when
the token, quota, or response shape fails. It does **not** clear the ADR-008 gate as-is;
adopting it requires, in order:

1. A `CONTEXT.md` "Reverse-engineered dependencies" entry (catalogue + breakage note).
2. A feature flag; default off.
3. A degrade-silently path on any non-200 / shape mismatch — never throw, never fail a run.

## Reproduction (no secrets in output)

```
node --env-file=.env -e '
const base = process.env.WP_BASE_URL.replace(/\/$/,"");
const auth = "Basic " + Buffer.from(`${process.env.WP_USER}:${process.env.WP_APP_PASSWORD}`).toString("base64");
const url = base + "/wp-json/yoast/v1/semrush/related_keyphrases?keyphrase=warehouse+construction+cost&country_code=us";
const r = await fetch(url, { headers: { Authorization: auth } });
console.log("HTTP", r.status, (await r.text()).slice(0,300));
'
```
