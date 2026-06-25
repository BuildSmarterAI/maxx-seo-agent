# ADR-008 — Documented Yoast surfaces only (fail-soft policy for fragile endpoints)

**Date:** 2026-06-25
**Status:** Accepted
**Deciders:** Harris / BuildSmarter

---

## Context

The WordPress apply pack must read and write Yoast / Rank Math SEO meta and verify what it
wrote. The live install (`www.maxxbuilders.com`, Yoast SEO Premium v27.5) exposes several
Yoast REST surfaces of varying stability (verified 2026-06-25):

- `register_post_meta` + `show_in_rest` (documented WP API) — exposes the raw meta keys.
- `yoast_head` / `yoast_head_json` on `wp/v2` responses (documented Yoast fields).
- `yoast/v1/get_head` — returns the full rendered SEO head HTML for any URL; reachable
  **unauthenticated** but an undocumented contract.
- `yoast/v1/prominent_words/*` — internal NLP indexing routes; auth+nonce gated, **no
  public reader** (`prominent_words/{id}` → 404).
- `yoast/v1/semrush/related_keyphrases` — Yoast→Semrush proxy; Yoast-account auth, built
  for the admin UI.

The temptation is to reach for the richer endpoints (`get_head` as a universal readback,
`prominent_words` for topic words, the Semrush proxy for keyword expansion).

## Decision

**The pack depends only on documented surfaces:** the `register_post_meta` bridge
(`seo-rest-bridge.php`) for read/write, and the `yoast_head` field for the post-write
verify. The fragile endpoints (`get_head`, `prominent_words`, Semrush proxy) are **not
used.**

Any future adoption of a reverse-engineered or undocumented endpoint must:
1. Be documented in `CONTEXT.md` under "Reverse-engineered dependencies" first.
2. Be **fail-soft behind a feature flag** — degrade silently, never hard-break a run.
3. Carry a note on how a plugin update could silently break it.

## Rationale

- These endpoints belong to a third-party plugin on a host we don't control. A Yoast
  update can change a JSON envelope, add a nonce requirement, or remove a route with no
  warning. A hard dependency on any of them makes every nightly run hostage to a plugin
  changelog.
- `prominent_words` has no usable public reader anyway; adopting it means reverse-
  engineering an admin nonce flow — high cost, high fragility, low payoff vs. a
  server-side NLP library.
- The existing `verifyYoastHead` already models the right pattern: read `yoast_head`,
  and if it's absent (plugin inactive/old) degrade silently rather than throw.

## Consequences

- `seo-rest-bridge.php` is a **soft dependency**: it lives on the WP host, not in this
  repo. If it is not installed, REST silently drops meta writes (write succeeds, meta
  no-ops). The pack must treat its absence as a fail-soft condition; operators must verify
  the mu-plugin is installed on each host.
- `get_head` is on the table as a *fail-soft, flagged* enhancement (R2: a page-aware
  verify) — but only under the rules above, never as a hard dependency.
- This ADR is the gate any future "let's just call the Yoast internal endpoint" proposal
  must pass.

## Files affected

- `packs/wordpress/seo-rest-bridge.php` — documented `register_post_meta` bridge
- `packs/wordpress/apply.mjs` — `verifyYoastHead` fail-soft verify
- `CONTEXT.md` — "Reverse-engineered dependencies" section (catalogue + policy)
