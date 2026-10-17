# Stack-integration candidates 21–30: schema types, Next.js SEO, Yoast, embeddings, evals, marketing-agent kits

**Date examined:** 2026-10-16. **Status:** read-only public research. Nothing was installed or
executed and maxxbuilders.com was not contacted. Shallow clones (for reading only) of
schema-dts, promptfoo (sparse: docs + telemetry source), Yoast `wordpress-seo@27.5` (sparse),
OpenCMO, unifapi-agent/agents and noduslabs/claude-seo-skill sit in the session scratchpad, not
in the repo.

**Builds on** `docs/wayfinder/SEO-1/wp-apply-surfaces.md` (worktree
`wt-maxx-seo-agent-research-wp-apply-surfaces`, 2026-10-15) and `seo-data-providers.md`
(worktree `wt-maxx-seo-agent-research-seo-data-providers`). `wp-apply-surfaces.md` already
documents the Yoast version history (live = free 27.5; native `show_in_rest` from 27.7; the
`update-post-seo-data` ability from 28.6). This doc re-verifies the parts that matter for the
"apparent success" question and doesn't repeat the rest.

Legend: **[V]** verified today on a primary source (GitHub API, npm/PyPI/Hugging Face registry,
cloned source, vendor doc) · **[R]** read in this repo at `research/seo-stack-integration`
`7a3d333` or a prior in-repo research doc · **[E]** estimate or inference · **UNVERIFIED** =
not established.

---

## 0. Answers to the key questions

1. **Is `schema-dts` useful in a `.mjs` repo with no TypeScript?** No. Without TypeScript it does
   nothing.
   - The package's runtime file `dist/schema.js` is an empty CommonJS module. All the value is in
     a ~1 MB `dist/schema.d.ts` [V: unpkg `schema-dts@2.1.0`]. JSDoc `@type` annotations are only
     checked when `tsc --checkJs` (or `// @ts-check` plus an editor's TS server) runs. The repo
     has no `typescript` dependency, no `tsconfig.json`/`jsconfig.json`, and no type-check step
     [R: `package.json`, repo root].
   - **Even with TS added, it doesn't fit the artifact flow.** `schema/*.jsonld` files come from
     the `schema-generate` skill (LLM output written to disk), not from object literals in `.mjs`
     source. JSDoc can't annotate a `.jsonld` file, and `tsc` won't resolve a `.jsonld` import.
   - **The types are permissive.** Every property is optional (`"headline"?:`, `"mainEntity"?:`
     [V: `schema.d.ts` lines 2337, 2369]), so the types can't express the "Article needs
     headline" rules that `scripts/lib/schema-lint.mjs` `REQUIRED_PROPS` already enforces at
     runtime [R]. The only extra thing it would catch is a misspelled property or type name in a
     hand-written object literal, and this repo has none.
   - **Verdict: Reject** (already covered by schema-lint). If unknown-property detection is ever
     wanted, adapt it at runtime from the schema.org vocabulary file, not from `.d.ts` types [E].
2. **next-seo / next-sitemap:** **Reject.** Both are Next.js-only. next-seo has peer deps
   `next >=13.4.0`, `react >=18.2.0`; next-sitemap has peer `next: *` and depends on `@next/env`
   [V: npm]. The site is WordPress + Yoast + Elementor [R: root `CLAUDE.md`]. The only Next.js
   mentions in the repo are the generic "repo path" concept (`CONTEXT.md:37`,
   `ADR-002`) with no configured Next.js target [R]. Yoast already generates the sitemap and the
   head tags. Also, next-sitemap's last release was v4.2.3 on 2023-09-06 [V].
3. **Which Yoast fields are writable over REST, and where does "apparent success" come from?**
   Short answer: `yoast_head` / `yoast_head_json` are **read-only**. `_yoast_wpseo_*` keys are
   writable **only where some code registers them with `show_in_rest`** for that post type. A
   write to anything else returns **HTTP 200 and is silently dropped.** Source chain, all [V]:
   - **Yoast `src/routes/yoast-head-rest-field.php@27.5`, L194–198:**
     `register_rest_field( $object_type, 'yoast_head', [ 'get_callback' => … ] )`, and the same
     for `yoast_head_json`. Yoast passes no `update_callback` and no `schema`.
   - **WordPress `class-wp-rest-controller.php@7.1.3`, L455–461:**
     `update_additional_fields_for_object()` does `if ( ! $field_options['update_callback'] ) continue;`.
     So a POST that includes `yoast_head_json` is ignored without an error.
   - **Yoast `inc/class-wpseo-meta.php@27.5`, ~L267 (live version):** every `_yoast_wpseo_*` key
     is registered with `sanitize_callback` only, with **no `show_in_rest`**. That means no key is
     REST-visible natively. On live, the four keys are REST-listed for posts and pages only
     because a separate bridge registers them [R: `wp-apply-surfaces.md` live schema read
     2026-10-15; committed `packs/wordpress/seo-rest-bridge.php`].
   - **Yoast `inc/class-wpseo-meta.php@28.7`, L99–118 and L290–310:** only `focuskw`, `title` and
     `metadesc` carry `show_in_rest => true`. They are re-registered with
     `object_subtype => 'post'` (the **post** type only, not pages), `type => string`, and
     `auth_callback => current_user_can('edit_post', $id)`. L332–336 strips them from REST
     responses for users without `edit_post`. Canonical, robots and schema-type keys are not
     REST-exposed natively even at 28.7.
   - **WordPress `class-wp-rest-meta-fields.php@7.1.3`:** `update_value()` (L142) loops over
     **registered** fields only. `get_field_schema()` (L522–534) validates the `meta` object with
     `check_meta_is_array` and nothing else. An unregistered key in `{"meta":{…}}` therefore
     passes validation, is never iterated, and the request returns 200.
   - **What this means for `packs/wordpress/apply.mjs`** [R]:
     - `wordpressAdapter.supports(row)` only checks that `KEYS[row.field]` exists in
       `seo-keys.mjs`, not that the key is REST-registered for the target type.
     - `verifyYoastHead` is a *soft* check that "degrades silently" and compares against the
       HTML-escaped `yoast_head`.
     - The hard guard (re-GET `meta` with `context=edit`, require the key to exist before the
       write and to equal `new_value` after it) is not implemented. `wp-apply-surfaces.md` §
       Failure modes already proposes it. This doc adds no new design; it confirms the source
       basis.
   - **Classification for Yoast:** *Architecture reference* (it's already installed; its source
     is the authority for writable fields). It is **not** a dependency.
4. **sentence-transformers / KeyBERT for cannibalization and internal-link detection?** For a few
   hundred pages a Python + PyTorch environment isn't justified.
   - **Python cost** [V]: sentence-transformers 6.1.0 needs Python ≥3.10, `torch>=2.2`,
     `transformers>=5,<6`, scikit-learn and scipy. KeyBERT 0.9.0 adds another layer on top of
     sentence-transformers. That means a second runtime, a large wheel set in CI, and a model
     download. None of it fits a Node ≥22 ESM repo whose CI only runs `setup-node` [R:
     `.github/workflows/*`].
   - **What the corpus needs** [E]: about 300 pages is roughly 45k pairs, trivial for in-process
     TF-IDF cosine over title + H1 + body.
   - **The strongest cannibalization signal isn't text similarity.** It's **GSC query overlap**:
     several URLs earning impressions for the same query. The repo already pulls this through
     `scripts/sensor-gsc.mjs`. The `gsc-opportunity-mining` skill describes it, but only as LLM
     instructions with no code [R].
   - **Recommended order** [E]:
     1. GSC query-overlap in Node.
     2. TF-IDF/cosine in Node (no dependency, a `node --test`-able pure function).
     3. Only if (2) misclassifies on a labelled sample: embeddings from an API (Anthropic has no
        embedding model and points to Voyage AI [V: platform.claude.com embeddings doc]), or a
        local ONNX model through `@huggingface/transformers` 4.3.1 (ESM, Apache-2.0). That
        package pulls `onnxruntime-node` (postinstall downloads binaries) and `sharp` [V: npm].
   - **Verdict:** sentence-transformers is **Defer**. KeyBERT is **Reject**. Its keyphrase
     extraction overlaps the existing `keyword-research.mjs` (Yoast Semrush proxy) [R], and the
     last release is v0.9.0 from 2025-02-07 [V].
5. **promptfoo vs the existing eval-judge:**
   - **Release** [V: npm, GitHub]: current version 0.124.1 (npm, 2026-10-08), MIT license.
     Engine `node >=22.22.0`. ESM. 76 runtime deps and 31.7 MB unpacked.
   - **Ownership** [V: README L23; promptfoo.dev blog 2026-03-09]: Promptfoo was acquired by
     OpenAI and announced on 2026-03-09. The README says "Promptfoo is now part of OpenAI.
     Promptfoo remains open source and MIT licensed." The license file is still MIT
     ("Copyright (c) Promptfoo 2025").
   - **Telemetry is on by default** [V: `src/telemetry.ts`]: PostHog plus a second POST to an
     `R_ENDPOINT`. It records command and assertion-type events, the package version, a CI flag,
     and the email address if a promptfoo account is logged in. Opt out with
     `PROMPTFOO_DISABLE_TELEMETRY=1`, and with `PROMPTFOO_DISABLE_UPDATE=1` for the npm update
     check [V: `telemetry.md`, `telemetry.ts` L23/L112].
   - **Overlap with what the repo already has.** The repo already has the gate
     (`eval-judge.mjs`, fail-closed, Haiku) *and* a calibration harness (`eval-benchmark.mjs`:
     false_pass/false_block/AUC over a labelled `eval_set`; `judge-calibrate.mjs`) [R]. promptfoo
     would duplicate both.
   - **The one gap it fills:** a **declarative regression suite for skill outputs** (for example,
     "metadata-generate output for URL X stays ≤60/≤155 chars and invents no stats"). Nothing
     tests skill outputs today; `test/` has unit tests for scripts only [R].
   - **Verdict: Defer**, then *Run as CLI* (pinned `npx`, not a dependency) when skill-output
     regression becomes a priority. Details and a cost estimate are in §2.27.
6. **OpenCMO / unifapi agents / noduslabs skill:** all three exist [V]. None is a dependency
   candidate.
   - **OpenCMO:** Python/FastAPI/React app on the OpenAI Agents SDK. The repo has **no LICENSE
     file** (the GitHub API reports `license: null`); only `pyproject.toml` declares
     `Apache-2.0`. It isn't on PyPI. Classification: **Reject** as software; **Architecture
     reference** for two small ideas.
   - **unifapi-agent/agents:** MIT. SKILL.md files over a paid, OAuth-gated hosted MCP
     (`https://mcp.unifapi.com`). The SEO skills are adapted from coreyhaines31/marketingskills.
     Classification: **Reject**/Defer.
   - **noduslabs/claude-seo-skill:** a single SKILL.md that front-ends the commercial KeywordGraph
     MCP. **No license.** Classification: **Reject**.

---

## 1. Repo baseline relevant to this batch [R]

| Area | What exists (`research/seo-stack-integration` @ `7a3d333`) |
|---|---|
| Runtime | `package.json`: `type: module`, `engines.node >=22`; deps `@anthropic-ai/claude-agent-sdk 0.1.77`, supabase-js, googleapis, google-auth-library, marked, zod. No TypeScript, no tsconfig/jsconfig. CI uses `actions/setup-node` `node-version: 22` in all six workflows. Local node is v24.13.1. |
| Schema validation | `scripts/lib/schema-lint.mjs` (160 lines): placeholder regexes (OPERATOR_INSERT, `-REPLACE`, `__X__`), `@context`/`@type` structure, `REQUIRED_PROPS` for Article/FAQPage/BreadcrumbList/GeneralContractor. CLI `scripts/validate-json.mjs`; also used by `packs/wordpress/publish-drafts.mjs`; tests in `test/schema-lint.test.mjs`. |
| LLM judge | `scripts/eval-judge.mjs`: Agent SDK `query()` with `allowedTools: []`, model `JUDGE_MODEL` (default `claude-haiku-4-5-20251001`), fail-closed `decide()` re-derives the verdict from four rubric dimensions plus `fabrication_risk`. Required check in `.github/workflows/seo-eval-gate.yml:106`. |
| Judge calibration | `scripts/eval-benchmark.mjs` (false_pass, false_block, accuracy, AUC over Supabase `eval_set`), `scripts/judge-calibrate.mjs` (champion vs. variants, records to `judge_calibration`, recommends only). |
| Content gates | `scripts/validators/citation-density.mjs`, `content-guards.mjs`, `check-entity-density.mjs`. |
| WP apply | `packs/wordpress/apply.mjs`: POST `{meta:{key:value}}` to `wp/v2/{posts\|pages}/{id}`; `supports` = key exists in `seo-keys.mjs`; soft `verifyYoastHead` on `yoast_head`. |
| Cannibalization | No code. Described in the `gsc-opportunity-mining` and `blog-audit` SKILL.md files. `scripts/lib/metadata.mjs:91` blocks duplicate new titles across CSV rows. |
| Keyword extraction | `scripts/keyword-research.mjs` (Yoast Semrush proxy, `YOAST_API_KEY`). |

---

## 2. Per-candidate findings

### 21. google/schema-dts

- **Canonical:** https://github.com/google/schema-dts (not archived, not renamed) [V].
- **Version/date:** v2.1.0, released 2026-10-02. Last commit 2026-10-02 (`62a5658`). 14 open
  issues, 1,250 stars [V].
- **What it actually is:** TypeScript declaration files generated from the schema.org vocabulary
  by `schema-dts-gen`. `WithContext<T>`, `Graph`, `IdReference`, and `MergeLeafTypes` (multi-type
  `@type`, from `schema-dts-lib@1.1.0`). Runtime `dist/schema.js` is empty [V].
- **Runtime requirements:** TypeScript compiler to get any checking. Node version irrelevant.
- **Node 22 ESM:** imports as types only (`import type` or JSDoc `@import`). No runtime effect.
- **Credentials:** none. **Pricing:** free.
- **License:** Apache-2.0 for the code [V: GitHub, npm]. The schema.org vocabulary it derives
  from is published by schema.org under CC BY-SA 3.0 [E: not re-read today].
- **Maintenance:** active. One maintainer (Eyas Sharaiha) [V: package.json].
- **Unattended use:** n/a.
- **Overlap:** schema-lint covers required properties and placeholders at runtime, which
  schema-dts can't do [R/V].
- **Classification: Reject (already covered).** No verified gap. See §0.1.

### 22. garmeeh/next-seo

- **Canonical:** https://github.com/garmeeh/next-seo [V].
- **Version/date:** `next-seo@7.3.0`, 2026-07-29. MIT. 8 open issues [V].
- **Runtime requirements:** peer deps `next >=13.4.0`, `react >=18.2.0` [V: npm].
- **Fit:** none. It renders head tags and JSON-LD React components inside a Next.js app. Yoast
  owns head output on WordPress.
- **Classification: Reject.** No Next.js target exists [R]. Revisit only if a Next.js property is
  onboarded through the "repo path" (`CONTEXT.md:37`).

### 23. iamvishnusankar/next-sitemap

- **Canonical:** https://github.com/iamvishnusankar/next-sitemap [V].
- **Version/date:** v4.2.3, 2023-09-06, the latest release. The last commit, 2026-03-10, is a
  `.gitignore` chore. MIT. 8 open issues [V].
- **Runtime requirements:** peer `next: *`. Depends on `@next/env ^13.4.3`, fast-glob, minimist
  [V: npm]. Engine `node >=14.18`.
- **Fit:** none. The Yoast XML sitemap is the source for `scripts/sensor-sitemap.mjs` [R].
- **Classification: Reject.** It's Next.js-only, and maintenance has been low since 2023.

### 24. Yoast/wordpress-seo

- **Canonical:** https://github.com/Yoast/wordpress-seo, default branch `trunk` [V].
- **Version/date:** latest release 28.7 (2026-10-13). `release/28.8` was merged to trunk
  2026-10-16. The `readme.txt` at 28.7 gives "Requires PHP: 7.4, Tested up to: 7.1". 1,156 open
  issues [V]. **Live site = free 27.5** [R: `wp-apply-surfaces.md`].
- **License:** the GitHub API reports `NOASSERTION`. `license.txt` is GPL v3 and the `wp-seo.php`
  header says "GPL v3". `composer.json` says `GPL-2.0-or-later`. This doesn't matter to us: we
  call its REST surface and don't redistribute its code [V].
- **Capabilities relevant to apply:** see §0.3. Read-only `yoast_head`/`yoast_head_json` on every
  REST-enabled post type, taxonomy, user and post-type archive (`register_rest_fields` for
  `for_post`, `for_term`, `for_author`, `for_post_type_archive`, L99–112 @27.5).
  Natively writable meta from 27.7 covers `focuskw/title/metadesc` on `post` only.
- **Credentials:** WP Application Password (`WP_USER`, `WP_APP_PASSWORD`), already in use [R].
- **Unattended use:** yes, through the existing pack. Production-only; no staging [R: root
  `CLAUDE.md`].
- **Classification: Architecture reference.**
- **Verified gap:** `apply.mjs` can report "applied" for a write that REST dropped (an
  unregistered key returns 200; `supports` checks the local key map only). The fix belongs in the
  apply hardening lane that `wp-apply-surfaces.md` defined, as these steps:
  1. **Preflight:** key ∈ `meta` of a `context=edit` GET for that object.
  2. **Post-write:** re-GET `meta[key] === new_value` (hard).
  3. **Soft check:** `yoast_head_json.title` / `.description` rather than substring-matching the
     escaped `yoast_head`.

  Not implemented here (read-only research).
- **Minimal REST read (for a smoke test, read-only)** [E: shape from core + Yoast source; not
  executed today]:
  ```powershell
  # PowerShell 5.1. Uses existing .env values; do not echo the password.
  $pair = "$($env:WP_USER):$($env:WP_APP_PASSWORD)"
  $auth = 'Basic ' + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($pair))
  $r = Invoke-RestMethod -Headers @{ Authorization = $auth } `
       -Uri "$env:WP_BASE_URL/wp-json/wp/v2/pages/<PAGE_ID>?context=edit&_fields=id,meta,yoast_head_json"
  $r.meta.PSObject.Properties.Name | Where-Object { $_ -like '_yoast_wpseo_*' }   # registered keys
  $r.yoast_head_json.title                                                       # rendered title
  ```

### 25. huggingface/sentence-transformers

- **Canonical:** https://github.com/huggingface/sentence-transformers (moved from UKPLab; the API
  returns the huggingface org) [V].
- **Version/date:** v6.1.0, 2026-09-18 (PyPI upload 2026-09-18T10:44). Last commit 2026-10-16.
  1,310 open issues [V].
- **Runtime requirements:** Python ≥3.10. `torch>=2.2`, `transformers>=5,<6`, `tokenizers`,
  `huggingface-hub>=1.3,<2`, numpy, scikit-learn, scipy. Optional `onnx`/`openvino` extras [V:
  PyPI `requires_dist`].
- **Node 22 ESM:** not compatible. It would need a sidecar Python process. A Node-native
  equivalent is `@huggingface/transformers` 4.3.1 (ESM, Apache-2.0), but that package has native
  install steps (`onnxruntime-node` postinstall, `sharp`) [V: npm].
- **Licenses:**
  - **Code:** Apache-2.0 [V].
  - **Model weights:** `sentence-transformers/all-MiniLM-L6-v2` card says `license: apache-2.0`.
    It ships `model.safetensors` plus ONNX/OpenVINO variants. Last modified 2026-06-01 [V: HF
    API]. The Xenova ONNX port is also apache-2.0 [V].
  - **Training data:** the card lists datasets including `ms_marco`, `s2orc`, `gooaq`,
    `yahoo_answers_topics` and StackExchange. Those carry their own terms (MS MARCO's are
    research-oriented). The weights licence is what governs use; flag it to counsel only if the
    output is redistributed [E].
- **Credentials:** none for local inference. HF token only for gated models.
- **Pricing:** free (local compute).
- **Unattended use:** yes in principle (CI job with a cached model). Heavy in practice.
- **Classification: Defer.**
- **Gap:** "detect near-duplicate/cannibalizing pages and internal-link candidates" is real but
  unbuilt. Close it first with GSC query overlap plus TF-IDF in Node (§0.4). Revisit embeddings
  only after a labelled sample shows TF-IDF misses.

### 26. MaartenGr/KeyBERT

- **Canonical:** https://github.com/MaartenGr/KeyBERT [V].
- **Version/date:** v0.9.0, 2025-02-07, the latest release. The last commit, 2026-08-25, adds
  Python 3.14 support. 77 open issues [V].
- **Runtime requirements:** Python ≥3.8. `sentence-transformers>=0.3.8`, scikit-learn, numpy,
  rich. Optional flair/gensim/spacy/USE backends [V: PyPI].
- **License:** MIT [V]. Model weights depend on the backend chosen (default MiniLM, see #25).
- **Capability:** cosine similarity between a document embedding and candidate n-gram embeddings
  ranks keyphrases; MMR or Max-Sum adds diversity.
- **Overlap:**
  - `keyword-research.mjs` already chooses focus keyphrases from Semrush data through Yoast [R].
    That data reflects demand, which KeyBERT can't see.
  - A page's own keyphrases are extractable well enough by the LLM skills already in the loop.
- **Classification: Reject.** No gap that isn't already covered better.

### 27. promptfoo/promptfoo

- **Canonical:** https://github.com/promptfoo/promptfoo (not archived). Owner: Promptfoo, now part
  of OpenAI (announced 2026-03-09) [V].
- **Version/date:**
  - npm `promptfoo@0.124.1` published 2026-10-08T14:48Z; 0.124.0 was 2026-10-06 [V].
  - GitHub "latest release" points at `code-scan-action-0.2.2` (2026-10-08), a sibling action
    tag, not the CLI. Use npm as the version source.
  - Last commit 2026-10-16 (bumps `@anthropic-ai/claude-agent-sdk` to 0.3.292). 762 open issues.
    26k stars [V].
- **License:** MIT (`LICENSE`: "Copyright (c) Promptfoo 2025"). The README confirms it stays MIT
  after the acquisition [V]. The hosted Promptfoo Cloud / sharing service is a separate service
  with its own terms; it isn't needed.
- **Runtime requirements:** **Node `>=22.22.0`** [V: npm `engines`]. The repo's `>=22` is looser.
  `setup-node` `22` resolves to the newest 22.x, which should satisfy it [E: the 22.x patch level
  in CI was not read today]. ESM package. 76 runtime deps.
  - Optional deps include `sharp` (native install), AWS/Azure SDKs and `@modelcontextprotocol/sdk`.
  - Peer deps include `@anthropic-ai/claude-agent-sdk` and `playwright`.
  - Published scripts have only `prepare: husky || exit 0`, which doesn't run on registry
    installs. No postinstall [V].
- **Telemetry and network** [V]:
  - **Telemetry:** PostHog plus a direct POST of `{event, environment, email, meta}`. The email is
    included only when a promptfoo account is logged in locally. Disable with
    `PROMPTFOO_DISABLE_TELEMETRY=1`. `PROMPTFOO_SELF_HOSTED=true` also disables telemetry and
    blocks OS env vars from templates.
  - **Update check:** `PROMPTFOO_DISABLE_UPDATE=1`.
  - **Sharing:** pass `--no-share`. Results auto-share only "when cloud is configured".
  - **Remote generation:** `PROMPTFOO_DISABLE_REMOTE_GENERATION=true` turns off hosted generation
    fallbacks. Per the docs it is "not a network egress firewall".
- **Anthropic provider** [V: `site/docs/providers/anthropic.md`]:
  - Model IDs: `anthropic:messages:claude-haiku-4-5-20251001`,
    `anthropic:messages:claude-sonnet-4-6`, and others. Auth via `ANTHROPIC_API_KEY`.
  - A separate `claude-agent-sdk` provider exists for agentic evals.
  - **Unsafe option, flagged:** with `apiKeyRequired: false`, promptfoo reads
    `%USERPROFILE%\.claude\.credentials.json` (the Claude Code OAuth credential). It prepends the
    "You are Claude Code…" identity block and bills the Claude subscription. **Do not use it.**
    It conflicts with the global auth policy (never read or forward Claude Code credential
    material; app calls use the app's own key) and with repo `security.md` (headless calls draw
    on the metered `ANTHROPIC_API_KEY`).
- **Grader:** model-graded assertions (`llm-rubric`, `factuality`, `g-eval`, …) choose a default
  grader from whichever credentials are in the env. Pin it explicitly with
  `defaultTest.options.provider`; otherwise `defaultTest.provider` is used as a fallback grader
  [V: `model-graded/index.md`, `llm-rubric.md`].
- **Exit codes:** `100` on any failed test or a pass rate below `PROMPTFOO_PASS_RATE_THRESHOLD`;
  `1` on other errors [V: `command-line.md` L172]. This works as a CI gate.
- **Credentials:** `ANTHROPIC_API_KEY` (already a repo CI secret for eval-judge [R]). No promptfoo
  account needed.
- **Pricing:** the CLI is free. Model cost per run, an estimate on these assumptions [E]:
  - Prices [V: platform.claude.com pricing, 2026-10-16]: Haiku 4.5 is $1 in / $5 out per MTok;
    Sonnet 4.6 is $3 / $15 per MTok; the Batch API is 50% off.
  - **Grading only** (echo provider over existing artifacts), 30 cases × one `llm-rubric`
    (~3k in / 300 out on Haiku 4.5): 30 × ($0.003 + $0.0015) ≈ **$0.14 per run**.
  - **Generate + grade** (Sonnet 4.6 generating ~5k in / 1.5k out, plus the Haiku grade):
    ≈ 30 × $0.0375 + $0.14 ≈ **$1.27 per run**.
  - On-disk caching (`PROMPTFOO_CACHE_*`, default TTL 14 days) makes unchanged reruns about $0.
    Use `--no-cache` in CI for honest numbers.
- **Unattended use:** yes. `promptfoo eval` is non-interactive with `--no-table --no-share`, and
  `-o results.json` / `junit.xml` produce artifacts.
- **Overlap:** the gate and calibration are already built (`eval-judge`, `eval-benchmark`,
  `judge-calibrate`), with the fail-closed semantics tested in `test/eval-judge.test.mjs` [R].
  promptfoo must **not** replace `eval-judge`. Its `llm-rubric` pass logic isn't the repo's
  `decide()` (re-derived verdict, required dimensions, `fabrication_risk === false`).
- **Classification: Defer → Run as CLI (pinned npx), not a dependency.**
- **Gap it would fill:** regression tests for **skill outputs** (fixed inputs, assertions on
  `metadata-generate` / `schema-generate` / `blog-write` outputs) so a SKILL.md or model change
  can't silently degrade them. Nothing covers this today [R].
- **Commands (documented, NOT executed this session):**
  ```powershell
  # Windows PowerShell 5.1, repo root. Pinned; nothing added to package.json.
  $env:PROMPTFOO_DISABLE_TELEMETRY = '1'
  $env:PROMPTFOO_DISABLE_UPDATE    = '1'
  $env:PROMPTFOO_CONFIG_DIR        = "$PWD\.promptfoo"     # keep state out of %USERPROFILE%
  npx --yes promptfoo@0.124.1 --version                   # smoke test 1: CLI resolves on Node 22.22+
  # smoke test 2 (zero model calls): echo provider + deterministic asserts
  npx --yes promptfoo@0.124.1 eval -c evals/smoke.promptfooconfig.yaml --no-cache --no-share --no-table -o evals/out/smoke.json
  if ($LASTEXITCODE -eq 100) { 'assertion failures' } elseif ($LASTEXITCODE -ne 0) { 'error' }
  ```
  `ANTHROPIC_API_KEY` must come from the repo's existing `.env`/CI secret path
  (`node --env-file` doesn't apply to npx; in CI set it from `secrets.ANTHROPIC_API_KEY`). Never
  set it globally (global auth policy).
- **Minimal config: skill-output regression (placeholders)** [shape V from the docs; file-loaded
  `vars` and the ESM default-export assertion are E]:
  ```yaml
  # evals/metadata-generate.promptfooconfig.yaml
  description: metadata-generate output regression
  prompts:
    - file://prompts/metadata-generate.txt      # rendered from .claude/skills/metadata-generate/SKILL.md
  providers:
    - id: anthropic:messages:claude-sonnet-4-6
      config: { temperature: 0, max_tokens: 1024 }
  defaultTest:
    options:
      provider: anthropic:messages:claude-haiku-4-5-20251001   # pin the grader explicitly
  tests:
    - vars:
        url: <PAGE_URL>
        primary_entity: <PRIMARY_ENTITY>
        page_text: file://fixtures/<SLUG>.txt
      assert:
        - type: is-json
        - type: javascript
          value: file://assertions/metadata-limits.mjs   # title <=60, description <=155; reuse scripts/lib/metadata.mjs
        - type: llm-rubric
          value: Title leads with the primary entity. No invented statistics, prices, awards, or project claims.
  ```
  ```js
  // evals/assertions/metadata-limits.mjs. ESM needs the .mjs extension [V javascript.md L452]
  export default (output) => {
    const { title = "", description = "" } = JSON.parse(output);
    const ok = title.length <= 60 && description.length > 0 && description.length <= 155;
    return { pass: ok, score: ok ? 1 : 0, reason: `title ${title.length}, description ${description.length}` };
  };
  ```
  For a zero-cost smoke test, swap the provider for `echo` and pass an existing artifact as the
  prompt (`prompts: ["{{artifact}}"]`). The echo provider returns the prompt as output at cost 0
  [V: `providers/echo.md`].
- **Rollback:** delete `evals/` and `.promptfoo/`. Nothing goes into `package.json` or the
  lockfile. The npx cache lives in `%LOCALAPPDATA%\npm-cache\_npx` and can be cleared with
  `npm cache clean --force` (user's call).

### 28. Lling0000/OpenCMO

- **Canonical:** https://github.com/Lling0000/OpenCMO. Created 2026-03-18. 124 stars, 5 open
  issues. Last commit 2026-10-13 (`a81a9a6`). No releases [V].
- **What it is:** a self-hosted "AI CMO" [V: README, CLAUDE.md, pyproject].
  - **Stack:** Python ≥3.10 FastAPI backend on `openai-agents>=0.12.4` + `crawl4ai`; React 19
    frontend; SQLite; Docker Compose.
  - **Tools:** `seo_audit`, `ai_crawler_check` (robots.txt vs. 14 AI crawlers, plus llms.txt),
    `citability` (weighted passage scorer, "inspired by geo-seo-claude"), `geo`, `serp_tracker`,
    `gsc`, `llmstxt`, community scraping, and publishers.
  - **Publishing:** auto-publishes to Reddit/X only when `OPENCMO_AUTO_PUBLISH=1`.
- **Models / credentials:** BYOK, OpenAI or an OpenAI-compatible endpoint (default `gpt-4o`).
  Optional `anthropic`, Tavily and platform keys. `config.apply_runtime_settings()` loads API keys
  **from the DB settings table into `os.environ`** [V: its CLAUDE.md]. That's an anti-pattern
  under our secret policy.
- **License:** **unclear**. There's no LICENSE file (GitHub API `license: null`); only
  `pyproject.toml` says `license = "Apache-2.0"`. Treat the code as not cleared for copying until
  a LICENSE file exists [V/E]. The vendored marketing-skill registry credits
  coreyhaines31/marketingskills (MIT) [V].
- **Telemetry:** none found (no posthog/sentry imports in `src/`) [V: grep].
- **Packaging:** not on PyPI (404) [V]. There's a stray `=0.27` file at the repo root (a shell
  redirection artifact), a small hygiene signal.
- **Fit:** none as software. It's a different language and agent SDK, and a full app instead of a
  library.
- **Classification: Reject.** *Architecture reference* only, and the ideas are cheap to rebuild
  [E]:
  - An AI-crawler robots.txt allow/deny check. The repo has crawler names only in audit docs
    (`audit/technical-seo.md`, `FULL-AUDIT-REPORT.md`) and no sensor [R].
  - A deterministic passage "citability" scorer. It partly overlaps `citation-density.mjs`.

  Re-derive either from primary sources (each bot vendor's documentation), not from its code.

### 29. unifapi-agent/agents

- **Canonical:** https://github.com/unifapi-agent/agents. MIT ("Copyright (c) 2026 UnifAPI").
  593 stars, 0 open issues. Last commit 2026-09-05. No releases [V].
  - **Odd metadata:** `created_at` is 2012-12-18, which suggests an old repository repurposed or
    renamed. Treat the star count with caution [E].
- **What it is:** about 175 files, mostly SKILL.md/README.md bundles (SEO, AI-visibility/GEO,
  local SEO, social, vertical marketing) plus a Claude plugin manifest. `.mcp.json` points to the
  hosted **`https://mcp.unifapi.com`** (HTTP MCP, OAuth). One script,
  `llm-mention-tracking/scripts/monitor.mjs`, calls `https://api.unifapi.com` with
  `UNIFAPI_API_KEY` [V].
  - The SEO `schema` and `seo-audit` skills are "adapted_from coreyhaines31/marketingskills"
    [V: frontmatter]. That upstream is covered in another batch.
  - The skills say they are read-only ("eyes, not hands"). No unsafe instructions were found:
    no `curl | sh`, no `rm -rf`, no prompt-override strings [V: grep].
  - Skills tell the agent to "keep each response's `billing` block" [V].
- **Pricing:** credits at $0.001 each [V: unifapi.com/pricing via WebFetch, 2026-10-16].
  - The first top-up earns a 2,000-credit bonus.
  - SEO backlinks have a 50-credit minimum; GEO mentions 500; GEO search/delta 1,000 ($1 per
    operation).
  - Data-use terms weren't found on that page (UNVERIFIED).
- **Overlap:**
  - SERP, backlinks and GEO data are already evaluated in `seo-data-providers.md` (DataForSEO
    etc.) [R].
  - AIO capture already exists (`sensor-ai-citations.mjs` via SerpApi) [R].
  - The skills duplicate this repo's 16 `.claude/skills/`.
- **Classification: Reject** (skills duplicate ours). **Defer** the hosted MCP: it's another
  metered data vendor, and only worth comparing if `seo-data-providers.md`'s choice falls through.

### 30. noduslabs/claude-seo-skill

- **Canonical:** https://github.com/noduslabs/claude-seo-skill. Created 2026-06-02. 2 stars.
  Last commit 2026-08-22. **No license** (GitHub `license: null`, no LICENSE file). Release zips
  are referenced in the README (v1.0.8) [V].
- **What it is:** a single `skill-seo-analysis/SKILL.md` (10 KB) plus a marketplace manifest and
  a release workflow. Every workflow step calls tools on the commercial **KeywordGraph MCP**
  (`analyze_google_search_results`, `generate_seo_report`, `difference_between_texts`, …). When
  those tools are unavailable it falls back to web search. Free tier "for the first few
  iterations", then an API key [V: README].
- **Unsafe instructions:** none found. One upsell pattern: Step 5 asks the agent to offer writing
  an article with KeywordGraph's writing tool [V].
- **Overlap:** keyword research, gap analysis and competitor comparison overlap
  `keyword-research.mjs`, `blog-ideas` and `gsc-opportunity-mining` [R]. With no license, the
  text can't be adapted.
- **Classification: Reject.**

---

## 3. Recommended composition from this batch [E]

1. **Nothing in this batch becomes a dependency.**
2. **Yoast source is the reference** for the apply hardening already scoped in
   `wp-apply-surfaces.md`: a preflight that the key is registered, a hard `meta` re-GET, and a
   `yoast_head_json` soft check. This closes the "200 but dropped" failure with source citations
   (§0.3).
3. **Cannibalization:** build a pure Node module.
   - Inputs: GSC query-overlap + TF-IDF cosine.
   - Tests: `node --test`.
   - Output: `blog-audit` / `gsc-opportunity-mining` artifacts.

   Keep embeddings (Voyage API or transformers.js ONNX) as a measured upgrade, never a Python
   sidecar.
4. **promptfoo:** park it until skill-output regression is on the roadmap. Then run it as a
   pinned `npx` CLI with telemetry, update checks and sharing off, an explicitly pinned Haiku
   grader, and `ANTHROPIC_API_KEY` from the existing secret path. Never use the Claude Code OAuth
   option.

## 4. Summary table

| # | repo | canonical | version / date | license | classification | gap | confidence |
|---|---|---|---|---|---|---|---|
| 21 | google/schema-dts | github.com/google/schema-dts | v2.1.0 / 2026-10-02 | Apache-2.0 | Reject (already covered) | None. Types need TS and all props are optional; schema-lint covers required props at runtime | High |
| 22 | garmeeh/next-seo | github.com/garmeeh/next-seo | 7.3.0 / 2026-07-29 | MIT | Reject | None. No Next.js target; Yoast owns head | High |
| 23 | iamvishnusankar/next-sitemap | github.com/iamvishnusankar/next-sitemap | v4.2.3 / 2023-09-06 | MIT | Reject | None. Yoast sitemap; stale releases | High |
| 24 | Yoast/wordpress-seo | github.com/Yoast/wordpress-seo | 28.7 / 2026-10-13 (live 27.5) | GPL-3.0 (license.txt; composer says GPL-2.0+) | Architecture reference | Apply can log success for REST-dropped writes; `yoast_head(_json)` read-only | High |
| 25 | huggingface/sentence-transformers | github.com/huggingface/sentence-transformers | v6.1.0 / 2026-09-18 | Apache-2.0 (MiniLM weights apache-2.0) | Defer | Cannibalization/link detection: do GSC overlap + TF-IDF in Node first | Medium-high |
| 26 | MaartenGr/KeyBERT | github.com/MaartenGr/KeyBERT | v0.9.0 / 2025-02-07 | MIT | Reject | None. Covered by keyword-research.mjs + LLM skills | High |
| 27 | promptfoo/promptfoo | github.com/promptfoo/promptfoo (OpenAI-owned since 2026-03-09) | npm 0.124.1 / 2026-10-08 | MIT | Defer → Run as CLI (pinned npx) | Skill-output regression suite (none today); not a judge replacement | High (facts), Medium (cost estimate) |
| 28 | Lling0000/OpenCMO | github.com/Lling0000/OpenCMO | no release; HEAD 2026-10-13 | No LICENSE file (pyproject claims Apache-2.0) | Reject; architecture reference | AI-crawler robots check idea (no sensor today) | Medium |
| 29 | unifapi-agent/agents | github.com/unifapi-agent/agents | no release; HEAD 2026-09-05 | MIT (skills); hosted MCP paid | Reject (skills); Defer (MCP) | None beyond seo-data-providers.md | Medium |
| 30 | noduslabs/claude-seo-skill | github.com/noduslabs/claude-seo-skill | v1.0.8 zip; HEAD 2026-08-22 | None | Reject | None. Front-end for paid KeywordGraph MCP | High |

## 5. Open items carried forward

- Exact Node 22.x patch level that `setup-node@… node-version: 22` resolves to in CI (promptfoo
  needs ≥22.22.0). UNVERIFIED.
- What code registers the four `_yoast_wpseo_*` REST keys on live, and with which
  `auth_callback`. Carried from `wp-apply-surfaces.md`. UNVERIFIED.
- Voyage AI per-token pricing (Anthropic's doc defers to MongoDB billing docs). UNVERIFIED.
- promptfoo `file://` loading for `vars` and the ESM *default-export* assertion signature were
  inferred from the docs and not re-read line by line. Confirm on first use.

## 6. Sources (retrieved 2026-10-16 unless noted)

- GitHub REST API `repos/<owner>/<repo>`, `/releases/latest`, `/commits?per_page=1` for all ten
  repos.
- npm registry: `schema-dts`, `next-seo`, `next-sitemap`, `promptfoo` (incl. `@0.124.1` time,
  engines, scripts), `@huggingface/transformers@4.3.1`, `onnxruntime-node@1.30.0`.
- PyPI JSON: `sentence-transformers` 6.1.0, `keybert` 0.9.0; `opencmo` (404).
- Hugging Face API: `sentence-transformers/all-MiniLM-L6-v2`, `Xenova/all-MiniLM-L6-v2`.
- schema-dts: https://github.com/google/schema-dts/blob/main/packages/schema-dts/package.json,
  README; https://unpkg.com/schema-dts@2.1.0/dist/schema.d.ts, `dist/schema.js`;
  https://unpkg.com/schema-dts-lib@1.1.0/dist/index.d.ts.
- Yoast: https://github.com/Yoast/wordpress-seo/blob/27.5/src/routes/yoast-head-rest-field.php,
  https://github.com/Yoast/wordpress-seo/blob/27.5/inc/class-wpseo-meta.php,
  https://github.com/Yoast/wordpress-seo/blob/28.7/inc/class-wpseo-meta.php, `license.txt`,
  `wp-seo.php`, `composer.json`, `readme.txt` @28.7.
- WordPress core:
  https://github.com/WordPress/wordpress-develop/blob/7.1.3/src/wp-includes/rest-api/endpoints/class-wp-rest-controller.php
  (L455–461),
  https://github.com/WordPress/wordpress-develop/blob/7.1.3/src/wp-includes/rest-api/fields/class-wp-rest-meta-fields.php
  (L142, L522–534).
- promptfoo: `LICENSE`, `README.md` L23, `src/telemetry.ts`,
  `site/docs/configuration/telemetry.md`, `site/docs/providers/anthropic.md`,
  `site/docs/providers/echo.md`, `site/docs/usage/command-line.md`,
  `site/docs/configuration/expected-outputs/{javascript.md, model-graded/index.md, model-graded/llm-rubric.md}`;
  https://www.promptfoo.dev/blog/promptfoo-joining-openai/ (2026-03-09).
- Anthropic: https://platform.claude.com/docs/en/about-claude/pricing,
  https://platform.claude.com/docs/en/build-with-claude/embeddings.
- UnifAPI: `.mcp.json`, `AGENTS.md`, `skills/seo-agent/*/SKILL.md`,
  `skills/ai-visibility-agent/llm-mention-tracking/scripts/monitor.mjs`;
  https://unifapi.com/pricing.
- OpenCMO: `README.md`, `CLAUDE.md`, `pyproject.toml`, `src/opencmo/tools/ai_crawler_check.py`,
  `src/opencmo/tools/citability.py`, `src/opencmo/marketing_skills/registry.py`.
- noduslabs: `README.md`, `skill-seo-analysis/SKILL.md`, `.claude-plugin/marketplace.json`.
