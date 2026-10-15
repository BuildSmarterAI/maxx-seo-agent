# WordPress apply surfaces for `change_set` (Yoast + Elementor + WP Rocket stack)

**Date:** 2026-10-15
**Question:** Which WordPress surfaces should the `change_set` → REST apply path (ADR-005) use
per field type on the live Maxx Builders stack, and which safety primitives (revisions,
preview, backup, rollback, cache purge, capability preflight) actually exist?
**Extends:** `docs/spikes/wordpress-mcp-and-wp-cli-2026-10-14.md` (branch
`docs/wordpress-mcp-spike`), called "the spike" below. MCP adapter install, transports,
Abilities exposure rules and the Yoast 28.6+ write ability are covered there and only cited
here.

**Method.** Primary sources only, read at the version tags that match the live site:
WordPress `wordpress-develop@7.1.3`, Yoast `wordpress-seo@27.5` (free), Elementor
`elementor@v4.0.7`, WP Rocket `wp-rocket@v3.23.2.2`, Wordfence SVN `tags/9.0.2` (latest; the
live Wordfence version is not public). Repo code read at `origin/main` 7e50e22. Live evidence:
**five unauthenticated public GETs on 2026-10-15** (`/`, `/wp-json/`, and three cluster post
URLs). No authenticated requests, no writes. Every live-site statement not backed by one of
those GETs is labelled **inference** or **UNVERIFIED**.

---

## New live facts (unauthenticated GETs, 2026-10-15)

| Probe | Result | Why it matters |
|---|---|---|
| Yoast debug marker in `/` HTML | `Yoast SEO Premium plugin v27.5 (Yoast SEO v27.5)` | **Free Yoast is 27.5** (released 2026-04-28). Resolves the open question in the spike and the baseline. The marker format is `'v' . WPSEO_PREMIUM_VERSION . ' (Yoast SEO v' . WPSEO_VERSION . ')'` ([marker-open-presenter.php@27.5](https://github.com/Yoast/wordpress-seo/blob/27.5/src/presenters/debug/marker-open-presenter.php)). |
| `/wp-json/` → `authentication` | `application-passwords` present | Core adds this key only when `wp_is_application_passwords_available()` is true ([rest-api.php@7.1.3 `rest_add_application_passwords_to_index`](https://github.com/WordPress/wordpress-develop/blob/7.1.3/src/wp-includes/rest-api.php)). So Wordfence's app-password kill switch is **off** today (see Wordfence). Response had no `X-Cache`, so it was live, not cached. |
| `/wp-json/` route args for `wp/v2/posts` and `wp/v2/pages` → `meta` properties | `_yoast_wpseo_focuskw`, `_yoast_wpseo_title`, `_yoast_wpseo_metadesc`, `_yoast_wpseo_canonical`, plus Elementor's `_elementor_edit_mode`, `_elementor_template_type`, `_elementor_data`, `_elementor_page_settings`, `_elementor_conditions` | The four Yoast keys are REST-writable on posts and pages. **No `rank_math_*` keys**, so the installed registration is **not** byte-identical to the committed `packs/wordpress/seo-rest-bridge.php` (which registers eight keys). Which code registers them, and with which `auth_callback`, is UNVERIFIED. |
| Same, for `wp/v2/locations` and `wp/v2/project` | `meta` has **no properties** | Yoast meta is **not** REST-writable on the location and project CPTs. Core silently ignores unregistered keys (see Failure modes). `apply.mjs` only resolves `posts`/`pages` anyway. |
| `/wp-json/` namespaces | adds `wp-rocket/v1`, `elementor/v1`, `elementor-pro/v1`, `objectcache/v1`, `wordfence/v1`, `wordfence-login-security/v1`, `redirection/v1` to the spike's list | `wp-rocket/v1` has **no purge route** (only RocketCDN, CPCSS, options export, insights). `elementor/v1/cache` is `DELETE` only. |
| `/` response headers | `Server: nginx`, `X-Cache: HIT`, `Age: 32010`, `Expires` already in the past | There is **an HTTP cache in front of WordPress** that served a ~9 h old copy. WP Rocket's own marker says `cached@1792010443` (2026-10-14T20:40:43Z), which equals `Last-Modified`. Whether WP Rocket purges reach this front cache is UNVERIFIED (host unknown). |
| Body classes / Elementor markers on cluster URLs | `/` (page 2641): `elementor-page-2641`, `data-elementor-type="wp-page"`. `/the-ultimate-2026-hotel-construction-cost-guide-texas-edition/` (post 5975): `elementor-page-5975`, `data-elementor-type="wp-post"`. `/design-build-construction-houston-2/` (post 7429) and `/commercial-construction-cost-houston-tx/` (post 5843): **no** Elementor page markers. | **The site is mixed.** Some cluster posts are Elementor-built, some are not. The content surface must be chosen **per post**, not per post type. |

---

## Per-field-type table

"Pack today" means what `packs/wordpress/apply.mjs` / `publish-drafts.mjs` do at 7e50e22.

| Field | Recommended surface | Evidence (version) | Failure modes | Apply path must check |
|---|---|---|---|---|
| **SEO title** | `POST /wp/v2/{posts\|pages}/{id}` with `{"meta":{"_yoast_wpseo_title":…}}` (pack today). Keep it. | Live REST schema lists the key (2026-10-15). Yoast 27.5 rebuilds the indexable from `updated_post_meta` at PHP shutdown ([indexable-post-meta-watcher.php@27.5](https://github.com/Yoast/wordpress-seo/blob/27.5/src/integrations/watchers/indexable-post-meta-watcher.php)). REST writes meta **after** `wp_update_post` ([posts controller@7.1.3 `update_item`](https://github.com/WordPress/wordpress-develop/blob/7.1.3/src/wp-includes/rest-api/endpoints/class-wp-rest-posts-controller.php)), so the watcher sees it. | (1) Key not registered for the post type → REST returns 200 and **drops the write** ([class-wp-rest-meta-fields.php@7.1.3 `update_value`](https://github.com/WordPress/wordpress-develop/blob/7.1.3/src/wp-includes/rest-api/fields/class-wp-rest-meta-fields.php) iterates only registered keys). (2) No revision is created (see Revisions). (3) `yoast_head` may lag: the indexable is rebuilt in a shutdown function (inference: the verify GET could in principle race it). (4) Front HTTP cache can keep serving the old `<title>`. | Before: key is in `meta` of a `context=edit` GET (proves registration and auth for this type). After: re-GET `meta` equals `new_value` (hard check); `yoast_head_json.title` (soft, retry once); public HTML after purge window (soft). |
| **Meta description** | Same as title, `_yoast_wpseo_metadesc`. | Same. | Same. | Same; also ≤155 chars (root `CLAUDE.md`). |
| **Canonical** | Same, `_yoast_wpseo_canonical`, **but only for self-referencing values**. A cross-URL canonical is consolidation and should be `gated`. | Live REST lists the key. Yoast 27.5 sanitises canonical as a URL (`class-wpseo-meta.php@27.5`, `sanitize_post_meta`). | The bridge's auth is `edit_posts` (committed file), while Yoast's own UI gates canonical behind `wpseo_edit_advanced_metadata`. The REST path therefore **bypasses Yoast's advanced-metadata capability** (inference from the committed bridge; the live `auth_callback` is UNVERIFIED). | Before: `new_value` host equals site host and path equals the post's own permalink, otherwise escalate. After: same as title. |
| **Robots (noindex / nofollow / adv)** | **No safe surface today. Escalate (`gated`).** | Keys are `_yoast_wpseo_meta-robots-noindex` (`'0'` default, `'1'` noindex, `'2'` index) etc. ([class-wpseo-meta.php@27.5](https://github.com/Yoast/wordpress-seo/blob/27.5/inc/class-wpseo-meta.php)). They are **not** in the live REST schema. Yoast's `update-post-seo-data` ability writes `noindex`/`nofollow` only from **28.6** ([spike](../../spikes/wordpress-mcp-and-wp-cli-2026-10-14.md); field list checked in [update-post-seo-data-ability.php@28.7](https://github.com/Yoast/wordpress-seo/blob/28.7/src/abilities/user-interface/abilities/update-post-seo-data-ability.php)). | Adding these keys to the bridge would make a de-indexing write a one-row change with no revision. | Do not add without an explicit decision. If added later: allowlist values, never batch, verify via `yoast_head_json.robots`. |
| **Schema / JSON-LD** | Default: let Yoast's graph stand and change type through Yoast's schema fields (`_yoast_wpseo_schema_page_type`, `_yoast_wpseo_schema_article_type`), which are **not** REST-registered today, so escalate. For custom pieces, the documented surface is PHP filters (`wpseo_schema_graph_pieces`, `wpseo_schema_graph`, `wpseo_schema_<class>`; [Yoast Schema API docs](https://developer.yoast.com/features/schema/api/), read 2026-10-15) in a reviewed mu-plugin, not per-post writes. | `publish-drafts.mjs` embeds `<script type="application/ld+json">` in a `wp:html` block in `post_content`. Core grants `unfiltered_html` to Editor on single-site ([schema.php@7.1.3](https://github.com/WordPress/wordpress-develop/blob/7.1.3/src/wp-admin/includes/schema.php)), which is what keeps the `<script>` from being stripped. | (1) On **Elementor** posts a JSON-LD block in `post_content` **never renders** (builder output replaces the content; see Elementor). (2) If `DISALLOW_UNFILTERED_HTML` is set or the user lacks the cap, kses strips the script silently (live setting UNVERIFIED). (3) A second graph next to Yoast's duplicates entities. The hotel guide already ships 2 `ld+json` blocks. | Before: `capabilities.unfiltered_html === true` (preflight), and the target is not Elementor-built. After: fetch rendered HTML and parse every `ld+json` block; fail if the count did not change as expected. |
| **Focus keyphrase** | `_yoast_wpseo_focuskw` via REST meta (pack today). Low risk: it does not render. | Live REST lists the key. Not found in the 28.7 ability's input schema (grep), so the ability is not an alternative for this field. | None user-visible. Changes Yoast's analysis only. | After: re-GET `meta`. |
| **`post_content` on Elementor pages** | **None via `post_content`. Escalate.** Programmatic editing means `_elementor_data`, see the Elementor section. | [frontend.php@v4.0.7 `apply_builder_in_content`](https://github.com/elementor/elementor/blob/v4.0.7/includes/frontend.php), [db.php@v4.0.7 `save_plain_text`](https://github.com/elementor/elementor/blob/v4.0.7/includes/db.php). | The write **succeeds but changes nothing on the page**, and the next editor save **overwrites it**. Attribution then measures a change that never shipped. | Before: GET `?context=edit` and read `meta._elementor_edit_mode`. If it is `"builder"`, escalate with reason `elementor-built`. |
| **`post_content` on classic/Gutenberg posts** | `POST /wp/v2/{posts\|pages}/{id}` with `content.raw` (pack today). | Core REST. A revision **is** created for content changes ([revision.php@7.1.3](https://github.com/WordPress/wordpress-develop/blob/7.1.3/src/wp-includes/revision.php), `wp_save_post_revision_on_insert` on `wp_after_insert_post`). | (1) No drift check today (`apply.mjs:58-60`). (2) Block-markup damage if the body is regenerated from rendered HTML. (3) kses applies when the user lacks `unfiltered_html`. | Before: `_elementor_edit_mode` is not `builder`; `modified_gmt` unchanged since generation (a cheap drift proxy that block wrappers cannot break); body-size delta within bounds. After: re-GET `content.raw` equals what was sent; a new revision id exists. |
| **New draft posts** | `POST /wp/v2/posts` with `status:"draft"` (`publish-drafts.mjs`). Keep create-only. | Core REST; WP Rocket skips drafts in `rocket_clean_post` ([purge.php@v3.23.2.2](https://github.com/wp-media/wp-rocket/blob/v3.23.2.2/inc/common/purge.php)). | (1) It bypasses `change_set` (baseline §3). (2) `slugExists` only checks `posts`, and an unauthenticated or 401 response reads as "doesn't exist" (`publish-drafts.mjs:36-42`). (3) Preview needs a logged-in browser cookie, so an Application Password cannot preview. | Before: users/me preflight; `status` forced to `draft`. After: GET by id returns `status: draft`; a human previews in wp-admin. |
| **Image alt text** | `POST /wp/v2/media/{id}` with `alt_text` for **Elementor** images. Edit the block markup in `post_content` for **Gutenberg** images. | Elementor renders alt from attachment meta at render time ([media.php@v4.0.7 `get_image_alt`](https://github.com/elementor/elementor/blob/v4.0.7/includes/controls/media.php), [image-size.php@v4.0.7](https://github.com/elementor/elementor/blob/v4.0.7/includes/controls/groups/image-size.php) via `wp_get_attachment_image`). The core image block stores `alt` **in the post markup** (`"source":"attribute","selector":"img"`, [image/block.json@7.1.3](https://github.com/WordPress/wordpress-develop/blob/7.1.3/src/wp-includes/blocks/image/block.json)). | (1) Updating the attachment does **not** change existing Gutenberg images. (2) One attachment is shared across many pages, so the blast radius is wider than one URL. (3) The Elementor element cache delays the visible change (≤ TTL). | Before: the media id is resolved from the rendered `<img class="wp-image-{id}">`. Treat as multi-URL: run `do_not_touch` against every page using it (UNVERIFIED how to enumerate cheaply). |
| **Internal links** | Gutenberg/classic posts: inside `post_content` (the content row path). Elementor posts: inside widget settings in `_elementor_data`. **Escalate** for Elementor until a supported edit path exists. | As above. | Same as the two `post_content` rows. | Same as the matching `post_content` row. |

---

## Elementor: `_elementor_data` vs `post_content` (Elementor 4.0.7)

**How a page renders.** When `_elementor_edit_mode` is truthy, Elementor's `the_content`
filter replaces the post content with the builder output whenever that output is non-empty
(`Frontend::apply_builder_in_content`, [frontend.php@v4.0.7](https://github.com/elementor/elementor/blob/v4.0.7/includes/frontend.php);
`Document::is_built_with_elementor()` reads `_elementor_edit_mode`,
[document.php@v4.0.7](https://github.com/elementor/elementor/blob/v4.0.7/core/base/document.php)).

**Does a REST `post_content` write render?** No. The builder output wins, so the visible page
is unchanged.

**Does it get overwritten?** Yes. Every editor save goes through `Document::save()` →
`save_elements()` → `DB::save_plain_text()`, which calls
`wp_update_post([... 'post_content' => $plain_text])`
([db.php@v4.0.7](https://github.com/elementor/elementor/blob/v4.0.7/includes/db.php)).
`post_content` on an Elementor page is a **derived plain-text mirror**. It is what
`apply.mjs` `readContent()` returns today, so the agent may be generating rewrites of a mirror.

**Does it break the layout?** Not while `_elementor_edit_mode` stays `builder`. If that meta is
ever cleared (it is REST-writable, enum `['', 'builder']`), the page falls back to rendering
the plain-text mirror and the layout is gone. **The apply path must never write
`_elementor_edit_mode`.**

**Supported ways to edit Elementor content programmatically:**

1. **`Document::save()` in PHP** (WP-CLI `eval` or a reviewed mu-plugin). It applies
   `wp_kses_post` when the user lacks `unfiltered_html`, writes `_elementor_data`, regenerates
   the plain-text mirror, deletes the post CSS and `_elementor_element_cache`, and fires
   `elementor/document/after_save`
   ([document.php@v4.0.7](https://github.com/elementor/elementor/blob/v4.0.7/core/base/document.php) lines ~795–890).
   This is the only path that keeps every derived artifact consistent. It needs PHP on the
   host, and the spike found no WP-CLI access confirmed.
2. **REST meta `_elementor_data`.** Elementor itself registers it for every post type that
   supports `elementor`, `context: edit`, auth = `Document::is_editable_by_current_user()`
   ([elementor-post-meta.php@v4.0.7](https://github.com/elementor/elementor/blob/v4.0.7/modules/wp-rest/classes/elementor-post-meta.php)),
   and the live schema confirms it. It is a **raw meta write** that skips everything in (1):
   - **The element cache hides the change.** Elementor caches a document's rendered elements
     in `_elementor_element_cache` with a TTL from `elementor_element_cache_ttl` (UI default
     `24` hours; only `'disable'` turns it off). The cache is cleared on `Document::save()`, a
     site-wide `clear_cache()`, plugin (de)activation, theme switch and upgrades, **not** on a
     meta write ([document.php `print_elements`/`set_document_cache`](https://github.com/elementor/elementor/blob/v4.0.7/core/base/document.php),
     [element-cache/module.php@v4.0.7](https://github.com/elementor/elementor/blob/v4.0.7/modules/element-cache/module.php),
     [files/manager.php@v4.0.7](https://github.com/elementor/elementor/blob/v4.0.7/core/files/manager.php)).
     The only REST cache clear is `DELETE /elementor/v1/cache`, which is **site-wide** and
     needs `manage_options`, so an Editor cannot call it. The live TTL value is UNVERIFIED.
   - No plain-text mirror refresh, no post CSS regeneration, no kses.
   - **No revision**: `_elementor_data` is not registered with `revisions_enabled`, and
     Elementor's "meta changed" revision filter is only attached inside `Document::save()`.
   - JSON shape risk: Elementor 4 ships atomic (V4) elements with a different prop schema
     (`/elementor/v1/operations/opt-in-v4` exists live). Whether this site uses them is
     UNVERIFIED.
   - No first-party Elementor developer documentation for external `_elementor_data` editing
     was found (search 2026-10-15). The registration exists in source but is undocumented as a
     write contract, so under **ADR-008 it is a fragile surface**: flagged and fail-soft at most.
3. Elementor MCP / abilities: an `elementor/modules/mcp` tree exists on Elementor's default
   branch but **not at v4.0.7** (tree listing). Whether 4.0.7 registers any abilities is
   UNVERIFIED; the SEO-8 abilities listing will show it.

**Recommendation.** For Elementor-built posts, `change_set` should carry **metadata only**
(title, description, canonical, focus keyphrase) and alt text via media. Every body or link
change escalates with reason `elementor-built` until a decision is taken on (1).

## Yoast write surfaces by version

| Yoast (free) | Write surface for title / description | Notes |
|---|---|---|
| **≤ 27.6, including live 27.5** | **No native REST exposure.** Yoast registers its meta with `sanitize_callback` only ([class-wpseo-meta.php@27.5](https://github.com/Yoast/wordpress-seo/blob/27.5/inc/class-wpseo-meta.php) ~L264). A `register_post_meta(... show_in_rest)` bridge is required, and live has one (non-repo variant). | 27.5 registers abilities, but only three **read-only score** abilities (`yoast-seo/get-seo-scores`, `get-readability-scores`, `get-inclusive-language-scores`), gated by `wpseo_manage_options`, which Editor lacks ([abilities-integration.php@27.5](https://github.com/Yoast/wordpress-seo/blob/27.5/src/abilities/user-interface/abilities-integration.php)). **No write ability exists on live today.** |
| **≥ 27.7** (2026-05-27) | Yoast **natively** registers `_yoast_wpseo_focuskw`, `_yoast_wpseo_title`, `_yoast_wpseo_metadesc` with `show_in_rest`, **object_subtype `post` only**, auth `edit_post`, and strips them from REST responses for users without `edit_post` ([class-wpseo-meta.php@27.7](https://github.com/Yoast/wordpress-seo/blob/27.7/inc/class-wpseo-meta.php); `show_in_rest` absent at 27.6, present 27.7–28.7). | Pages and canonical still need the bridge. A double registration for `post` (Yoast + bridge) re-registers the same key; likely benign, UNVERIFIED. |
| **≥ 28.6** (2026-09-29) | Adds the `yoast-seo/update-post-seo-data` ability (writes title, description, canonical, robots, schema types, social fields; empty value clears) via `POST /wp-abilities/v1/abilities/yoast-seo/update-post-seo-data/run` or MCP ([spike](../../spikes/wordpress-mcp-and-wp-cli-2026-10-14.md)). | Documented by Yoast, but see Abilities risks. |

How `packs/wordpress` writes today: `apply.mjs` maps `title/description/canonical/focus` →
`_yoast_wpseo_*` (`seo-keys.mjs`) and POSTs `{meta:{key:value}}` to `wp/v2/{posts|pages}/{id}`.
It verifies with a soft `yoast_head.includes(value)` check. That check is fragile because
`yoast_head` is HTML-escaped, so a title with `&` or quotes will not match. This is an
inference from the escaping in Yoast presenters; `yoast_head_json` would compare cleanly.

## Revisions, preview, rollback

- **Meta-only writes create no revision.** Core creates a revision on `wp_after_insert_post`
  only when a post field or a meta key registered with `revisions_enabled` changed
  (`wp_save_post_revision`, `wp_check_revisioned_meta_fields_have_changed`,
  [revision.php@7.1.3](https://github.com/WordPress/wordpress-develop/blob/7.1.3/src/wp-includes/revision.php);
  hooks in [default-filters.php@7.1.3](https://github.com/WordPress/wordpress-develop/blob/7.1.3/src/wp-includes/default-filters.php) L445–446, L800).
  Neither Yoast 27.5 nor the committed bridge sets `revisions_enabled`. Yoast Premium is
  closed source and UNVERIFIED. **For metadata, the `snapshots` table is the only rollback
  record.** Baseline §2 already shows `snapshot()` fails open, which makes this a single point
  of failure.
- **Content writes do create a revision** (if `WP_POST_REVISIONS` allows; live value
  UNVERIFIED). On Elementor posts, `_wp_put_post_revision` also copies the Elementor meta into
  that revision ([revisions-manager.php@v4.0.7](https://github.com/elementor/elementor/blob/v4.0.7/modules/history/revisions-manager.php)).
- **REST cannot restore a revision.** The live index shows `/revisions` as `GET` and
  `/revisions/{id}` as `GET, DELETE` only. Rollback therefore means re-POSTing the snapshot
  value, which is what `rollback.mjs` does. Restoring through wp-admin also replays the
  Elementor meta (`restore_revision`).
- **`rollbackRow` cannot restore "was empty."** `latestSnapshot` returns `null` both for
  "no snapshot" and for a snapshot whose `old_value` was `null`, and then throws
  (`orchestrator/lib/cms.mjs:38-43,168-169`). REST returns the registered default `""` for
  unset Yoast keys, so this mostly reads as `""`. Edge case, not verified against live rows.
- **Preview.** Draft preview (`?p={id}&preview=true`) needs a logged-in browser session. Core
  `POST /wp/v2/{type}/{id}/autosaves` can stage a content change on a **published** post
  without publishing it, but viewing it needs a cookie and a preview nonce, so it is a human
  step. Elementor-built posts have no REST preview path.
- **Backup.** Field-level snapshots are not a restorable production backup (root `CLAUDE.md`
  requires one). The host backup mechanism is UNVERIFIED.

## WP Rocket purge (3.23.2.2) and the front cache

- WP Rocket purges a post's cached files on `clean_post_cache`, `wp_trash_post`,
  `delete_post` and `wp_update_comment_count` (`rocket_clean_post`,
  [purge.php@v3.23.2.2](https://github.com/wp-media/wp-rocket/blob/v3.23.2.2/inc/common/purge.php) L276–279).
  It skips drafts. `wp_insert_post` calls `clean_post_cache()`
  ([post.php@7.1.3](https://github.com/WordPress/wordpress-develop/blob/7.1.3/src/wp-includes/post.php) ~L5156),
  and REST `update_item` always calls `wp_update_post` even for meta-only requests.
  **So every REST apply already triggers a per-post WP Rocket purge.** No extra call is needed
  and none is available: `wp-rocket/v1` has no purge route, and the admin purge
  (`admin_post_purge_cache`) needs the `rocket_purge_cache` capability plus a nonce.
- Ordering caveat (inference): the purge fires inside `wp_update_post`, **before** REST writes
  the meta and before Yoast rebuilds the indexable at shutdown. A request landing in that
  window can re-cache the old head. The window is small but it exists. The post-apply verify
  should therefore check public HTML after a delay, and the fix for a stale result is a
  second no-op save rather than a purge call (UNVERIFIED that a no-op save is acceptable).
- **The front `X-Cache` layer is the bigger risk.** It served a copy 32,010 s old with
  `Expires` in the past. Whether WP Rocket purges propagate to it, which host or proxy it is,
  and its TTL are all UNVERIFIED. Until known, "applied" must not be read as "live".
- REST responses are never page-cached by WP Rocket (`rocket_exclude_wp_rest_api`,
  [wp-rest-api.php@v3.23.2.2](https://github.com/wp-media/wp-rocket/blob/v3.23.2.2/inc/3rd-party/plugins/wp-rest-api.php)),
  so `context=edit` reads are authoritative.

## Wordfence vs REST Basic auth (source: Wordfence 9.0.2; live version UNVERIFIED)

- **The default disables Application Passwords.** `loginSec_disableApplicationPasswords`
  defaults to `true` ([wfConfig.php@9.0.2](https://plugins.svn.wordpress.org/wordfence/tags/9.0.2/lib/wfConfig.php) L93),
  and when it is on Wordfence adds `wp_is_application_passwords_available → false`
  ([wordfenceClass.php@9.0.2](https://plugins.svn.wordpress.org/wordfence/tags/9.0.2/lib/wordfenceClass.php) ~L1329).
  Live `/wp-json/` advertises application passwords, so **someone turned it off**. A Wordfence
  settings reset or import would silently restore the default, and every apply would then
  401, which `apply.mjs` today misreports as "neither a post nor a page" (baseline §2.3).
  The capability preflight below catches this.
- **2FA does not block app passwords.** Wordfence Login Security returns early for a request
  that core already authenticated as an application password (`_authenticate` →
  `_is_application_password_authentication`,
  [wordfencels.php@9.0.2](https://plugins.svn.wordpress.org/wordfence/tags/9.0.2/modules/login-security/classes/controller/wordfencels.php) ~L1295–1305).
- **User enumeration filter** (`loginSec_disableAuthorScan`, default `true`) blocks
  `/wp/v2/users` and `/wp/v2/users/{id}` for users without `edit_others_posts`. It does
  **not** match `/wp/v2/users/me` (regexes in `jsonAPIAuthorFilter`), so the preflight works.
- Failed app-password attempts are recorded (`wp_authenticate_application_password_errors`
  hook). Whether they count toward the brute-force lockout (`loginSec_maxFailures`, default
  20) is UNVERIFIED. If they do, a nightly cron with a bad credential could lock out the CI
  egress IP.

## Capability preflight: minimal read-only call list (for SEO-8)

All are `GET` with the pack's Basic-auth credential and are run by the operator. None
mutates. Record the HTTP status and the listed fields only, and never log headers.

1. `GET /wp-json/` (no auth). Checks: `authentication["application-passwords"]` present; the
   `namespaces` list; the `meta` property list on the `wp/v2/posts`, `wp/v2/pages`,
   `wp/v2/locations` and `wp/v2/project` POST routes (proves which keys are writable per type).
2. `GET /wp-json/wp/v2/users/me?context=edit&_fields=id,slug,roles,capabilities`. Expect 200,
   `roles == ["editor"]`. Read `capabilities` (= `allcaps`,
   [users controller@7.1.3](https://github.com/WordPress/wordpress-develop/blob/7.1.3/src/wp-includes/rest-api/endpoints/class-wp-rest-users-controller.php)
   ~L1105). Assert `edit_posts`, `edit_others_posts`, `edit_pages`, `edit_others_pages`,
   `edit_published_posts`, `edit_published_pages`, `upload_files`, `unfiltered_html`; record
   `wpseo_edit_advanced_metadata`, `wpseo_manage_options`, `rocket_purge_cache`; assert
   **absent**: `manage_options`, `activate_plugins`, `edit_users`, `promote_users`. A 401
   means bad credential or app passwords disabled, so hard-stop.
3. `GET /wp-json/wp/v2/plugins` as a negative control. Expect **403** for Editor. A 200 means
   the credential is over-privileged, so hard-stop.
4. `GET /wp-json/wp/v2/pages/2641?context=edit&_fields=id,status,modified_gmt,template,meta,content,yoast_head_json`
   (Elementor page), then the same for `/wp/v2/posts/5975` (Elementor post) and
   `/wp/v2/posts/5843` (non-Elementor post). Checks: `meta._elementor_edit_mode`
   (`builder` vs `""`); the four `_yoast_wpseo_*` keys present; `content.raw` on 2641 and
   5975 is Elementor's plain-text mirror; `yoast_head_json.title` matches the public `<title>`.
5. `GET /wp-json/wp/v2/posts/5843/revisions?per_page=3&_fields=id,date_gmt`. Shows whether
   revisions are enabled and kept.
6. `GET /wp-json/wp-abilities/v1/abilities?per_page=100`. Lists abilities, `readonly` and
   `mcp.public` (spike one-liner). At Yoast 27.5, expect **no** `yoast-seo/update-*`. Any
   `elementor/*` write ability is new information.
7. `GET /wp-json/wp/v2/media?per_page=1&context=edit&_fields=id,alt_text`. Proves the alt-text
   read and auth surface.
8. `GET /wp-json/wp/v2/types/locations?context=edit` and `.../types/project?context=edit`.
   Shows whether the credential can edit those CPTs at all.

Not in scope (needs admin or is a write): plugin and settings listing, the WP Rocket and
Elementor cache options, Wordfence config. A WP Admin reads those in wp-admin:
`elementor_element_cache_ttl`, the Wordfence "Disable application passwords" toggle, and
`DISALLOW_UNFILTERED_HTML` / `WP_POST_REVISIONS` in `wp-config.php`.

## Abilities API `run` as an alternative to the custom bridge: risks

Core 7.1.3's run controller picks the method from annotations: `readonly` → `GET`,
`destructive && idempotent` → `DELETE`, otherwise `POST`; input goes in `input`
([class-wp-rest-abilities-v1-run-controller.php@7.1.3](https://github.com/WordPress/wordpress-develop/blob/7.1.3/src/wp-includes/rest-api/endpoints/class-wp-rest-abilities-v1-run-controller.php)).
Yoast's update ability is `readonly:false, destructive:null`, so it runs over `POST`.

1. **Not available on live.** Yoast 27.5 has no write ability. Adopting `run` means first
   upgrading Yoast to ≥ 28.6 on a production-only site.
2. **The upgrade widens the credential's reach automatically.** The same Editor password
   gains a public MCP write tool (spike). Hardening (the `wp_register_ability_args` mu-plugin)
   must ship **before** the upgrade, not after.
3. **Empty clears.** "A provided empty value clears that field" (28.7 description). A
   `change_set` row with `new_value: ""` would delete live meta, so the apply path must reject
   empty values.
4. **Wider field set than we need.** The ability also writes robots, schema types and social
   fields. The apply adapter must send only allowlisted keys, since nothing server-side limits
   an Editor to title and description.
5. **Same revision and snapshot properties as REST meta** (inference: it writes post meta).
   It is not a rollback improvement.
6. **Contract churn.** It is three releases old (28.6 → 28.7), and the abilities and MCP
   adapter are pre-1.0 (spike). It is still the better long-term bet than the bridge under
   ADR-008, because it is a Yoast-documented, capability-checked
   (`wpseo_edit_advanced_metadata`) surface and covers pages and canonical without custom code.
7. **Audit trail.** `run` calls are not logged by default (the spike notes the null
   observability handler for MCP; core REST has no audit either). `decision_log` stays the
   record.

---

## Decision-relevant conclusions

1. **Free Yoast on live is 27.5** (public debug marker, 2026-10-15). No Yoast write ability
   exists on production today. The only metadata write surface is REST meta through a bridge
   registration that is live for posts and pages but **differs from the committed
   `seo-rest-bridge.php`** (no Rank Math keys). Confidence: high.
2. **Metadata (title, description, focus keyphrase, self-canonical) via `wp/v2` REST meta is
   the right surface now** for posts and pages, Elementor or not. Yoast's meta watcher picks up
   REST writes, and every write triggers a per-post WP Rocket purge through
   `clean_post_cache`. Confidence: high (source), not yet observed live.
3. **`post_content` writes on Elementor-built posts are no-ops that get overwritten.** The
   site is mixed (posts 5975 and 2641 are Elementor; 5843 and 7429 are not). The apply path
   must read `_elementor_edit_mode` per row and escalate body and link changes on `builder`
   posts. Confidence: high.
4. **Raw `_elementor_data` REST writes are not a safe substitute.** They are hidden behind the
   ≤24 h element cache (default TTL), skip CSS, mirror and kses, create no revision, and the
   only cache clear needs `manage_options`. Confidence: high (source); live TTL unverified.
5. **Metadata writes create no WordPress revision.** The `snapshots` table is the sole
   rollback record, so the fail-open `snapshot()` (baseline §2) must be fixed before any
   unattended apply. Confidence: high.
6. **Robots, schema-type and CPT (`locations`, `project`) writes have no REST surface on
   live.** A write to an unregistered key returns 200 and silently does nothing. These must
   escalate, and the apply path must check the key is in the route schema before writing.
   Confidence: high.
7. **A front HTTP cache (`X-Cache: HIT`, `Age` ≈ 9 h) sits in front of WP Rocket.** Until its
   purge path is known, "applied" is not "live", and verification must use `context=edit`
   reads plus a delayed public check. Confidence: medium (headers seen; host unknown).
8. **Wordfence's shipped default disables Application Passwords.** It is off on live today,
   but a settings reset would break every apply with a misleading error. A `users/me` preflight
   (roles, caps, plus a `plugins` 403 negative control) should gate every run. Confidence:
   high (source + live index).

## Open questions requiring authenticated probe

- What registers the four `_yoast_wpseo_*` REST keys on live, and with which `auth_callback`?
  (A WP Admin reads `wp-content/mu-plugins/` / Plugins.)
- `users/me` roles and capabilities for the pack credential, including `unfiltered_html`,
  `wpseo_edit_advanced_metadata` and `rocket_purge_cache`.
- `elementor_element_cache_ttl` value, and whether the site uses Elementor V4 atomic elements.
- `WP_POST_REVISIONS` and `DISALLOW_UNFILTERED_HTML` in `wp-config.php`.
- The front cache in front of nginx: product, TTL, and whether WP Rocket purges reach it.
- The live Wordfence version, and whether failed app-password attempts count toward lockout.
- The live abilities list, including any Elementor abilities at 4.0.7 (spike one-liner, item 6).
- Host backup and restore mechanism, and the restore-test cadence (root `CLAUDE.md`
  prerequisite).
- Which other cluster URLs are Elementor-built (cheap: public body-class scan of
  `config/urls.txt`, unauthenticated).

## Sources

- WordPress core 7.1.3: [class-wp-rest-posts-controller.php](https://github.com/WordPress/wordpress-develop/blob/7.1.3/src/wp-includes/rest-api/endpoints/class-wp-rest-posts-controller.php), [class-wp-rest-meta-fields.php](https://github.com/WordPress/wordpress-develop/blob/7.1.3/src/wp-includes/rest-api/fields/class-wp-rest-meta-fields.php), [class-wp-rest-users-controller.php](https://github.com/WordPress/wordpress-develop/blob/7.1.3/src/wp-includes/rest-api/endpoints/class-wp-rest-users-controller.php), [class-wp-rest-abilities-v1-run-controller.php](https://github.com/WordPress/wordpress-develop/blob/7.1.3/src/wp-includes/rest-api/endpoints/class-wp-rest-abilities-v1-run-controller.php), [revision.php](https://github.com/WordPress/wordpress-develop/blob/7.1.3/src/wp-includes/revision.php), [default-filters.php](https://github.com/WordPress/wordpress-develop/blob/7.1.3/src/wp-includes/default-filters.php), [post.php](https://github.com/WordPress/wordpress-develop/blob/7.1.3/src/wp-includes/post.php), [rest-api.php](https://github.com/WordPress/wordpress-develop/blob/7.1.3/src/wp-includes/rest-api.php), [user.php](https://github.com/WordPress/wordpress-develop/blob/7.1.3/src/wp-includes/user.php), [wp-admin/includes/schema.php](https://github.com/WordPress/wordpress-develop/blob/7.1.3/src/wp-admin/includes/schema.php), [blocks/image/block.json](https://github.com/WordPress/wordpress-develop/blob/7.1.3/src/wp-includes/blocks/image/block.json)
- Yoast SEO: [27.5 class-wpseo-meta.php](https://github.com/Yoast/wordpress-seo/blob/27.5/inc/class-wpseo-meta.php), [27.5 indexable-post-meta-watcher.php](https://github.com/Yoast/wordpress-seo/blob/27.5/src/integrations/watchers/indexable-post-meta-watcher.php), [27.5 abilities-integration.php](https://github.com/Yoast/wordpress-seo/blob/27.5/src/abilities/user-interface/abilities-integration.php), [27.5 marker-open-presenter.php](https://github.com/Yoast/wordpress-seo/blob/27.5/src/presenters/debug/marker-open-presenter.php), [27.7 class-wpseo-meta.php](https://github.com/Yoast/wordpress-seo/blob/27.7/inc/class-wpseo-meta.php), [28.7 update-post-seo-data-ability.php](https://github.com/Yoast/wordpress-seo/blob/28.7/src/abilities/user-interface/abilities/update-post-seo-data-ability.php), [Schema API docs](https://developer.yoast.com/features/schema/api/). Tag dates from git: 27.5 = 2026-04-28, 27.7 = 2026-05-27, 28.6 = 2026-09-29, 28.7 = 2026-10-13.
- Elementor v4.0.7 (tag 2026-05-06): [frontend.php](https://github.com/elementor/elementor/blob/v4.0.7/includes/frontend.php), [core/base/document.php](https://github.com/elementor/elementor/blob/v4.0.7/core/base/document.php), [includes/db.php](https://github.com/elementor/elementor/blob/v4.0.7/includes/db.php), [wp-rest/classes/elementor-post-meta.php](https://github.com/elementor/elementor/blob/v4.0.7/modules/wp-rest/classes/elementor-post-meta.php), [element-cache/module.php](https://github.com/elementor/elementor/blob/v4.0.7/modules/element-cache/module.php), [core/files/manager.php](https://github.com/elementor/elementor/blob/v4.0.7/core/files/manager.php), [history/revisions-manager.php](https://github.com/elementor/elementor/blob/v4.0.7/modules/history/revisions-manager.php), [controls/media.php](https://github.com/elementor/elementor/blob/v4.0.7/includes/controls/media.php), [controls/groups/image-size.php](https://github.com/elementor/elementor/blob/v4.0.7/includes/controls/groups/image-size.php)
- WP Rocket v3.23.2.2 (tag 2026-08-20): [inc/common/purge.php](https://github.com/wp-media/wp-rocket/blob/v3.23.2.2/inc/common/purge.php), [inc/3rd-party/plugins/wp-rest-api.php](https://github.com/wp-media/wp-rocket/blob/v3.23.2.2/inc/3rd-party/plugins/wp-rest-api.php)
- Wordfence 9.0.2 (SVN tag; latest stable per wordpress.org API 2026-10-15): [lib/wfConfig.php](https://plugins.svn.wordpress.org/wordfence/tags/9.0.2/lib/wfConfig.php), [lib/wordfenceClass.php](https://plugins.svn.wordpress.org/wordfence/tags/9.0.2/lib/wordfenceClass.php), [login-security wordfencels.php](https://plugins.svn.wordpress.org/wordfence/tags/9.0.2/modules/login-security/classes/controller/wordfencels.php)
- Repo at 7e50e22: `packs/wordpress/{apply,http,publish-drafts,rollback,seo-keys}.mjs`, `packs/wordpress/seo-rest-bridge.php`, `orchestrator/lib/cms.mjs`, `docs/adr/ADR-005*`, `docs/adr/ADR-008*`
- Spike: `docs/spikes/wordpress-mcp-and-wp-cli-2026-10-14.md` (branch `docs/wordpress-mcp-spike`)
