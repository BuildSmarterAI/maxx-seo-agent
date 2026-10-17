# 14 — Docs grounding: Python sidecar, WordPress surfaces, paid services

Read-only grounding pass, 2026-10-17. Nothing was installed. Wheels for `advertools` 0.18.0
and `pyseoanalyzer` 2025.4.3 were downloaded to the session scratchpad and unzipped to read
their metadata; they were not installed. No requests went to maxxbuilders.com and no paid
APIs were called.

**Evidence tags:** [S] source read at the named tag or commit · [D] vendor docs page ·
[C7] Context7 · [P] PyPI JSON / index · [E] inference · [U] unverified, with the smallest
test that would settle it.

Context7 note: most libraries resolve in Context7 without version tags. Where a tag exists I
used it. Where none does, the Context7 result tracks `master`/`main`, and the source at the
release tag below is the authority.

---

## 1. uv 0.13 + astral-sh/setup-uv

- **Versions:** uv **0.13.1**, released 2026-10-14 [P, GitHub releases]. Context7
  `/astral-sh/uv/0.13.0` is the closest tag (it also offers 0.12.22 and 0.11.0). I
  cross-checked against the raw docs at the `0.13.1` tag:
  `https://raw.githubusercontent.com/astral-sh/uv/0.13.1/docs/...`.
- **`uv init`** [S `docs/concepts/projects/init.md@0.13.1`; D docs.astral.sh/uv/reference/cli]:
  - `--app` is the default. The CLI describes it as "Create a project for an application".
  - `--package`: "Defines a `[build-system]` for the project."
  - Since 0.12, apps get a build system **by default**. The docs say: "Prior to v0.12, uv did
    not define a build system for applications by default."
  - The generated `pyproject.toml` contains `[build-system] requires = ["uv_build>=0.13.1,<0.14"]`
    and `[project.scripts] example-app = "example_app:main"`.
  - `--no-package` or `--bare` drops the build system. `--lib` makes a library.
  - So **`uv init --app --package` is redundant on 0.13**. Plain `uv init --app` already gives a
    packaged app with `src/` layout. Use `--no-package` for a flat script folder.
- **Dependencies and lockfile:**
  - Add a dependency: `uv add [OPTIONS] <PACKAGES|--requirements <REQUIREMENTS>>` [D]. It
    accepts PEP 508 strings such as `uv add "trafilatura==2.3.1"` [S `dependencies.md`].
  - `uv lock` writes the lockfile. `uv lock --check` "is equivalent to the `--locked` flag for
    other commands" [S `sync.md`; C7].
  - `uv sync --locked`: "Assert that the `uv.lock` will remain unchanged. Requires that the
    lockfile is up-to-date" [D].
  - `--frozen`: "Run without updating the `uv.lock` file. Uses the versions in the lockfile as
    the source of truth." It does **not** check the lockfile against `pyproject.toml`. Use
    `--locked` in CI.
  - `uv run --locked …` / `uv run --frozen …` behave the same way [C7, S `sync.md`].
  - `uv run --project <dir>` discovers the project in `<dir>`. `--directory <dir>` changes into
    it first [D].
  - The official uv GitHub guide installs with `uv sync --locked --all-extras --dev` [S
    `guides/integration/github.md`].
- **Python:**
  - `requires-python = ">=3.12"` goes in `[project]`. `uv init --python 3.12` sets the minimum
    [D].
  - `uv python install 3.12` [S `guides/install-python.md` L51].
  - WinGet install: `winget install --id=astral-sh.uv -e` [S `installation.md@0.13.1`]. This
    settles the [U] in doc 10 §8.
- **`exclude-newer`** [S `concepts/resolution.md@0.13.1`]:
  - Inline: `--exclude-newer 2026-10-01T00:00:00Z`. In pyproject: `[tool.uv] exclude-newer = "2026-10-01T00:00:00Z"`.
  - Persistent config rejects local dates. A **duration** cooldown is allowed (`"1 week"`,
    `"P7D"`). The resolved timestamp is written into `uv.lock`.
  - Per-package: `exclude-newer-package = { pkg = "30 days" }`. Per-index: `[[tool.uv.index]]
    exclude-newer = false`.
  - It needs PEP 700 `upload-time`. Files without it "will be treated as unavailable".
  - The PyTorch CPU index **does** send `data-upload-time` on current wheels [P: HTML of
    `download.pytorch.org/whl/cpu/torch/`, e.g. `torch-2.14.1+cpu-cp312…x86_64.whl
    data-upload-time="2026-09-30T19:47:44Z"`]. Older files may not [U].
- **setup-uv:**
  - Latest release **`v10.3.0`** (2026-10-09). `git/ref/tags/v10.3.0` resolves to commit
    **`1c37ad07a6a961277cf70c0d37d6f313000f5884`** (lightweight tag, object type `commit`) [S gh api].
  - **There is no floating `v10` tag**: `git/ref/tags/v10` returns 404, and the tag list shows
    only full semver tags from v8 on. Pin the SHA and add a `# v10.3.0` comment.
  - Inputs at the tag [S `action.yml@v10.3.0`]:
    - `version` (default `""`, meaning a version from `pyproject.toml`, else latest)
    - `version-file`, `python-version` (sets `UV_PYTHON`), `python-arch`
    - `activate-environment` (default `false`)
    - `working-directory` (default `${{ github.workspace }}`; this is also where it looks for
      `pyproject.toml`)
    - `enable-cache` (default **`auto`**: on for GitHub-hosted runners, except release, tag
      push, `pull_request_target` and `workflow_run` events)
    - `cache-dependency-glob` (defaults include `**/uv.lock` and `**/pyproject.toml`)
    - `cache-python` (default `false`), `checksum`, `prune-cache`, `download-from-astral-mirror`
      (default `true`)
    - The action runs on `node24`.
- **Snippet:**
  ```yaml
  - uses: astral-sh/setup-uv@1c37ad07a6a961277cf70c0d37d6f313000f5884 # v10.3.0
    with:
      version: "0.13.0"           # see discrepancy 2
      python-version: "3.12"
      working-directory: tools/py
      enable-cache: true
  - run: uv sync --locked --no-dev
    working-directory: tools/py
  - run: uv run --locked --no-sync python -m seo_sidecar.extract < page.html > out.json
    working-directory: tools/py
  ```
- **Discrepancies:**
  1. uv's own GitHub guide still pins `setup-uv@c771a70e… # v9.0.0`. Use the v10.3.0 SHA above.
  2. The v10.3.0 release notes say it "includes embedded checksums for `uv` releases through
     0.13.0". uv 0.13.1 shipped five days later. So either pin `version: "0.13.0"`, or pass
     `checksum:` for 0.13.1 [E].
- **[U]** Does setup-uv v10.3.0 fail, warn, or fetch silently when given `version: 0.13.1`
  without `checksum`? **Test:** a one-job workflow on a branch, then read the log.

## 2. PyTorch CPU-only wheels with uv

- Context7 `/astral-sh/uv/0.13.0` matches the raw `docs/guides/integration/pytorch.md@0.13.1`
  [C7, S]. The guide verifies the requested shape exactly:
  ```toml
  [project]
  dependencies = ["torch>=2.11.0", "sentence-transformers==6.1.0"]
  [tool.uv.sources]
  torch = [{ index = "pytorch-cpu" }]
  [[tool.uv.index]]
  name = "pytorch-cpu"
  url = "https://download.pytorch.org/whl/cpu"
  explicit = true
  ```
- The guide says: "We recommend the use of `explicit = true` to ensure that the index is
  *only* used for `torch` …". `indexes.md` adds: "Named indexes referenced via
  `tool.uv.sources` must be defined within the project's `pyproject.toml`."
- PyPI already serves CPU-only torch on Windows and macOS. Only Linux needs the CPU index to
  avoid CUDA wheels [S guide L39–53].
- **Latest torch:** 2.14.1 (2026-09-30). It ships cp312 and cp314 `win_amd64` wheels [P].
- **[U]** Does `tool.uv.sources` apply when torch arrives only transitively, through
  sentence-transformers? The guide always lists `torch` as a **direct** dependency, so do the
  same. **Test:** `uv lock`, then `grep download.pytorch.org uv.lock`. On Linux the locked
  version should carry `+cpu`.

## 3. trafilatura 2.3.1

- Context7 `/adbar/trafilatura` (master; no tags offered). Source read at tag `v2.3.1`
  (`trafilatura/core.py`, `cli.py`, `cli_utils.py`) [S].
- **API** [S `core.py` L482–509]:
  - `extract(filecontent, url=None, …, fast=False, favor_precision=False, favor_recall=False,
    include_comments=True, output_format="txt", …, with_metadata=False, …)`.
  - Output formats: `"csv","html","json","markdown","txt","xml","xmltei"`.
  - The requested call is valid:
    `extract(html, output_format="json", with_metadata=True, favor_precision=True,
    include_comments=False)` returns a JSON `str` or `None`.
  - `include_comments` **defaults to True**, so pass `False` explicitly.
- **`bare_extraction(...)`** returns a `Document`, or `dict` through the deprecated `as_dict=`.
  Use `.as_dict()`. "as_dict will be removed" [S L299–331, L631–633; C7 `usage-python.rst`].
- **No network access on pre-fetched HTML.** `extract`/`bare_extraction` take a string or bytes.
  `url=` is used only for metadata and resolving relative links. Only `fetch_url` downloads
  [S, C7 FAQ].
- **CLI** [S `cli.py`]:
  - Flags: `--json` (shorthand), `--output-format {…}`, `--precision`, `--recall`, `--fast`,
    `--no-comments`, `--with-metadata`.
  - **Input modes are mutually exclusive:** `-i/--input-file`, `--input-dir`, `-u/--URL`.
  - **Correction:** `-i/--input-file` is a **list of URLs to download** (`load_input_urls`
    reads one URL per line, and `url_processing_pipeline` fetches them). It is not an HTML file.
  - **Stdin is used only when none of these is given:** `examine(sys.stdin.buffer.read(), args,
    url=args.URL)`, L242–244.
  - Passing `-u` to label the stdin page is a trap: it switches to download mode.
  - Pre-fetched HTML goes through stdin (`trafilatura --json --precision --no-comments --with-metadata < page.html`)
    or `--input-dir` (local files).
- **Dependencies (2.3.1):** `lxml>=6.1.3`, `urllib3>=2.8.0,<3`, `courlan`, `htmldate`, `justext`
  [P]. These conflict with pyseoanalyzer (§8).

## 4. advertools 0.18.0

- Context7 `/eliasdabbas/advertools` (no tags). The GitHub repo has no release tags.
- I read the **PyPI 0.18.0 wheel** and diffed it against `master@59dc2be` (2026-06-30).
  `spider.py`, `robotstxt.py` and `crawlytics.py` **differ** from master, so the wheel is the
  authority [S].
- **Signatures (wheel):**
  - `robotstxt_to_df(robotstxt_url, output_file=None)`.
  - `robotstxt_test(robotstxt_url, user_agents, urls)` checks every user-agent × URL
    combination.
  - `sitemap_to_df(sitemap_url, max_workers=8, recursive=True, request_headers=None)`. This also
    accepts a sitemap index or a robots.txt URL.
  - `crawl(url_list, output_file, follow_links=False, allowed_domains=None, exclude_url_params=None,
    include_url_params=None, exclude_url_regex=None, include_url_regex=None, css_selectors=None,
    xpath_selectors=None, custom_settings=None, meta=None, keep_columns=None, discard_columns=None)`.
- **crawl() behaviour:**
  - `output_file` must end `.jl` or `.jsonl`; anything else raises.
  - It shells out to `scrapy runspider` and converts each `custom_settings` item to
    `-s KEY=value` (dict/list values are JSON-encoded).
  - **Spider defaults:** `USER_AGENT = "advertools/<ver>"`, **`ROBOTSTXT_OBEY: True`**,
    `HTTPERROR_ALLOW_ALL: True`.
  ```python
  adv.crawl(urls, "crawl.jsonl", follow_links=False, custom_settings={
      "CONCURRENT_REQUESTS_PER_DOMAIN": 1, "DOWNLOAD_DELAY": 1.0,
      "USER_AGENT": "MaxxSEOAgent/1.0 (+contact)", "ROBOTSTXT_OBEY": True,
      "AUTOTHROTTLE_ENABLED": True, "CLOSESPIDER_PAGECOUNT": 500})
  ```
- **crawlytics (wheel):**
  - Analysis: `redirects(crawldf)`, `links(crawldf, internal_url_regex=None)`,
    `images(crawldf)`, `compare(df1, df2, column, keep_equal=False)`,
    `generate_markdown(crawldf)`.
  - File helpers: `jl_subset(filepath, columns=None, regex=None, chunksize=500)`,
    `jl_to_parquet(jl_filepath, parquet_filepath)`, `parquet_columns(filepath)`.
  - Process helper: `running_crawls()`.
- **logs_to_df:**
  - Signature: `logs_to_df(log_file, output_file, errors_file, log_format, date_format=None,
    fields=None, encoding="utf-8")`. `output_file` **must be `.parquet`** and must not already
    exist.
  - Built-in `LOG_FORMATS` keys: **`common`, `combined`, `common_with_vhost`, `nginx_error`,
    `apache_error`**. A custom regex plus `fields` is also accepted.
  - The default nginx access log (`combined`) maps to `"combined"` [E].
- **New since doc 11:**
  - `__init__` exports `serp_claude`, backed by an optional extra `claude` → `anthropic>=0.51.0`.
  - Runtime dependencies: `pandas>=1.1.0, pyasn1>=0.4, scrapy>=2.5.0, twython>=3.8.0,
    pyarrow>=5.0.0, requests>=2.25.0`.
  - PyPI `requires_python` is null. Master's pyproject says `>=3.9`.
  - Don't install the `[claude]` extra.

## 5. Scrapy 2.19.0

- Context7 `/scrapy/scrapy` (no tags). Source at tag `2.19.0` (`5569de39…`),
  `scrapy/settings/default_settings.py` [S]. All six names exist.

| Setting | Default (2.19.0) | Note |
|---|---|---|
| `CONCURRENT_REQUESTS_PER_DOMAIN` | `8` | `CONCURRENT_REQUESTS=16`. `CONCURRENT_REQUESTS_PER_IP` is **deprecated** in favour of this |
| `DOWNLOAD_DELAY` | `0` | `RANDOMIZE_DOWNLOAD_DELAY=True` (0.5–1.5×) |
| `USER_AGENT` | `"Scrapy/<ver> (+https://scrapy.org)"` | advertools overrides it to `advertools/<ver>` |
| `ROBOTSTXT_OBEY` | **`False`** | The `startproject` template sets `True`. advertools sets `True` |
| `AUTOTHROTTLE_ENABLED` | `False` | `START_DELAY=5.0`, `MAX_DELAY=60.0`, `TARGET_CONCURRENCY=1.0` |
| `CLOSESPIDER_PAGECOUNT` | `0` (off) | Also `CLOSESPIDER_TIMEOUT=0.0`, `…_ITEMCOUNT`, `…_ERRORCOUNT` |

- The project template ships `CONCURRENT_REQUESTS_PER_DOMAIN = 1` and `DOWNLOAD_DELAY = 1`.
  `runspider`, which is what advertools uses, does **not** apply the template. Set both
  explicitly.
- `DOWNLOAD_TIMEOUT=180`, `RETRY_TIMES=2`.

## 6. sentence-transformers 6.1.0

- Context7 `/huggingface/sentence-transformers` (no tags). Source at tag `v6.1.0` [S].
- **Encoding:**
  - `SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2", revision=…,
    local_files_only=…, cache_folder=…, backend="torch"|"onnx"|"openvino")`.
  - The model is Apache-2.0. Hub sha is `1110a243fdf4706b3f48f1d95db1a4f5529b4d41` [P HF API].
    Pin that as `revision=`.
  - `encode(sentences, prompt_name=None, batch_size=32, convert_to_numpy=True,
    normalize_embeddings=False, …)` [S `sentence_transformer/model.py` L754+].
  - Normalization is **off by default**.
  - The docstring recommends `encode_query`/`encode_document` for IR and `encode` for
    everything else.
- **`util`** (re-exported from `util/__init__.py`):
  - `cos_sim(a, b) -> Tensor`.
  - `paraphrase_mining(model, sentences, show_progress_bar=False, batch_size=32,
    query_chunk_size=5000, corpus_chunk_size=100000, max_pairs=500000, top_k=100,
    score_function=cos_sim, …)` returns `[score, id1, id2]` triplets.
  - `community_detection(embeddings, threshold=0.75, min_community_size=10, batch_size=1024,
    show_progress_bar=False) -> list[list[int]]`. The first index of each list is the central
    point.
- **Dependencies:** `torch>=2.2, transformers>=5,<6, huggingface-hub>=1.3,<2, tokenizers,
  numpy, scikit-learn, scipy` [P].
- **Hugging Face environment variables** [D huggingface_hub `environment_variables.md`]:
  - `HF_HOME` defaults to `~/.cache/huggingface`. `HF_HUB_CACHE` sets the model cache location.
  - With `HF_HUB_OFFLINE=1`, "no HTTP calls will be made to the Hugging Face Hub … If no cache
    file is detected, an error is raised".
  - `SENTENCE_TRANSFORMERS_HOME` also sets `cache_folder` [S].
  - CI pattern [E]: cache `HF_HOME` with `actions/cache`, then set `HF_HUB_OFFLINE=1` after the
    first warm run.

## 7. KeyBERT 0.9.0

- Context7 `/maartengr/keybert` (no tags). Source at tag `v0.9.0` [S].
- **Constructor:** `KeyBERT(model="all-MiniLM-L6-v2", llm=None)`.
  - Passing a `SentenceTransformer` instance works. `select_backend` matches on
    `"sentence_transformers" in str(type(model))`, which still holds for 6.x's
    `sentence_transformers.sentence_transformer.model.SentenceTransformer` [S, E].
- **`extract_keywords`:**
  - `extract_keywords(docs, candidates=None, keyphrase_ngram_range=(1, 1), stop_words="english",
    top_n=5, min_df=1, use_maxsum=False, use_mmr=False, diversity=0.5, nr_candidates=20,
    vectorizer=None, highlight=False, seed_keywords=None, doc_embeddings=None,
    word_embeddings=None, threshold=None)`.
  - The requested call `extract_keywords(doc, keyphrase_ngram_range=(1,3), stop_words="english",
    use_mmr=True, diversity=0.5, top_n=10)` is valid.
- **Dependencies:** `sentence-transformers>=0.3.8` (no upper bound), `numpy`, `rich`,
  `scikit-learn` [P]. The release is from 2025-02-07.
- **[U]** Does KeyBERT 0.9.0 work at runtime with ST 6.1 + transformers 5? **Test:** `uv run
  python -c "from keybert import KeyBERT; print(KeyBERT().extract_keywords('commercial
  construction cost Houston', top_n=3))"`.

## 8. pyseoanalyzer 2025.4.3

- Not in Context7. I read the PyPI wheel; the GitHub `main` branch has diverged from it [S].
- **Console script:** `python-seo-analyzer = pyseoanalyzer.__main__:main`.
- **Flags:**
  - `site` (positional), `-s/--sitemap URL`, `-f/--output-format {json,html}` (default
    **json**), `--analyze-headings`, `--analyze-extra-tags`.
  - `--no-follow-links` is `store_false` into `follow_links`, so following is **on by default**.
  - `--run-llm-analysis` defaults to `False`.
  ```
  uvx --from pyseoanalyzer==2025.4.3 python-seo-analyzer https://example.com/page/ \
      -f json --analyze-headings --analyze-extra-tags --no-follow-links
  ```
- **LLM is opt-in by flag.** It runs without API keys:
  - `Page` builds `LLMSEOEnhancer` only `if self.run_llm_analysis`.
  - The model is `claude-3-sonnet-20240229` through `ANTHROPIC_API_KEY`.
  - The release has **no** OrcaRouter path; that is on `main`.
- **Import-time behaviour:**
  - `page.py` imports `llm_analyst` unconditionally.
  - `llm_analyst` imports `langchain_anthropic` and calls **`load_dotenv()` at import**.
  - python-dotenv 1.1.0's `find_dotenv()` walks up from the **calling module's directory**
    [S `dotenv/main.py@v1.1.0`].
  - If the venv lives under `tools/py/.venv/` inside the repo, the walk reaches the repo-root
    `.env` and loads its secrets into the process environment (`override=False`) [E from
    source].
  - **Mitigation:** run it through `uvx`/`uv tool`, whose environment sits outside the repo,
    or with a cwd and venv outside the repo.
- **Pins:** `langchain==0.3.22`, `langchain-anthropic==0.3.10`, `trafilatura==2.0.0`,
  `lxml==5.3.1`, `urllib3==2.3.0`, `beautifulsoup4==4.13.3`.
  - These are **incompatible** with trafilatura 2.3.1 (`lxml>=6.1.3`, `urllib3>=2.8.0`). They
    cannot share one uv project.
  - lxml 5.3.1 has no cp314 Windows wheel, so it needs Python ≤3.13 [P].
- `http.py` sends `User-Agent: Mozilla/5.0`.
- **[U]** Does `uvx` really keep `load_dotenv` away from the repo `.env`? **Test:** a scratch
  directory containing a dummy `.env` with `FOO=1`, then run the tool and print
  `os.environ.get('FOO')` through `python -c` inside the same environment.

## 9. crawl4ai 0.9.5

- Context7 `/unclecode/crawl4ai` (no tags). Source at tag `v0.9.5` (`62002d6d…`, released
  2026-10-14) [S].
- **LICENSE attribution text (exact):**
  > "This product includes software developed by UncleCode (https://x.com/unclecode) as part of
  > the Crawl4AI project (https://github.com/unclecode/crawl4ai)."

  The licence requires this "in a prominent and easily accessible location" (NOTICE/README,
  About/Credits page, or CLI help output).
- **Docker image:** `unclecode/crawl4ai`. Docker Hub tags include `0.9.5`, `0.9`, `0` and
  `latest` (all 2026-10-14) [P Hub API].
  - Compose service: `image: ${IMAGE:-unclecode/crawl4ai:${TAG:-latest}}`, port **`11235:11235`**.
  - Environment: `CRAWL4AI_API_TOKEN` (default **empty**), `CRAWL4AI_ALLOW_DEEP_CRAWL=false`,
    optional `.llm.env`.
  - Hardening: `read_only`, `cap_drop: ALL`, `no-new-privileges`, 4 GB memory limit.
- **REST:** `POST /crawl` exists, with `{urls: [1..100], browser_config, crawler_config,
  crawler_configs, hooks}`. Also `/crawl/stream`, `/md`, `/html`, `/screenshot`, `/pdf`,
  `/execute_js`, `/token` and `/health`.
  - `/crawl` is also exposed as an MCP tool (`@mcp_tool("crawl")`).
- **Stealth packages are still in Docker mode.**
  - The Dockerfile `pip install`s the crawl4ai package itself, then runs `crawl4ai-setup` and
    `playwright install --with-deps`.
  - The package's base dependencies include `patchright>=1.49.0`, `playwright-stealth>=2.0.0`,
    `fake-useragent>=2.0.3` and `unclecode-litellm==1.81.13` [S `pyproject.toml`, P].
  - Base image: `python:3.12-slim-bookworm`.

## 10. SEOnaut (HEAD `a67387f`, 2026-10-08)

- Not in Context7.
- **`docker-compose.yml` at HEAD** [S]:
  - `db: mysql:8.4` with `MYSQL_ROOT_PASSWORD=root`, `MYSQL_DATABASE=seonaut`,
    `MYSQL_USER=seonaut`, `MYSQL_PASSWORD=seonaut`.
  - `app`: built from `.`, ports `${SEONAUT_PORT:-9000}:9000`. Its environment holds
    `WAIT_HOSTS=db:3306`, `WAIT_TIMEOUT=300` and the other wait settings. The `SEONAUT_*`
    overrides are all commented out.
  - One bridge network. **No volumes**, so MySQL data does not survive removing the container.
- **No API, no cookieless export.**
  - Every route except `/signup`, `/signin` and static files is wrapped in
    `CookieSession.Auth`. That includes `/export/csv`, `/export/sitemap`, `/export/resources`,
    `/export/wazc` and `/crawl/start` [S `internal/routes/app.go`].
  - Doc 10's verdict stands.

## 11. Yoast SEO

- Context7 `/yoast/developer` (main) and `/yoast/wordpress-seo`.
- I cross-checked source on GitHub tags **and** on the shipped WordPress.org SVN tags
  (`plugins.svn.wordpress.org/wordpress-seo/tags/<ver>/`). They agree. Latest release is
  **28.7** (2026-10-13); 28.8 is at RC2.

**(a) `yoast_head_json`** [D developer.yoast.com/customization/apis/rest-api/]:
- Yoast appends `yoast_head` (HTML string) and `yoast_head_json` to `wp/v2` post, CPT and
  archive responses.
- Keys in the docs example: `title, description, robots, canonical, og_locale, og_type,
  og_title, og_description, og_url, og_site_name, og_image, article_publisher, article_author,
  article_published_time, article_modified_time, author, twitter_card, twitter_creator,
  twitter_site, twitter_misc, schema`.
- `schema` holds the `@graph` object.
- `GET /wp-json/yoast/v1/get_head?url=` returns `{html, json, status}`.
- The docs say: "The Yoast REST API is currently read-only". The feature can be disabled under
  *Site features*. (Doc 12 confirmed there is no `update_callback`.)

**(b) Native `show_in_rest`:**
- First appears in **27.7**. 27.5 and 27.6 have zero `show_in_rest`; 27.7, 28.6 and 28.7 each
  have 8 [S GitHub + SVN].
- It covers only `_yoast_wpseo_focuskw`, `_yoast_wpseo_title` and `_yoast_wpseo_metadesc`.
- They are re-registered with `object_subtype => 'post'` (the **post** post type only, not
  pages or CPTs), `type => string`, and `auth_callback => current_user_can('edit_post', $id)`.
- A `rest_prepare_post` filter strips them for readers without `edit_post`.
- This matches doc 12.

**(c) Abilities API:**
- **Core route:** `wp-abilities/v1` + `/abilities/(?P<name>[a-zA-Z0-9\-\/]+?)/run`, registered
  with `ALLMETHODS` [S `class-wp-rest-abilities-v1-run-controller.php@7.1.3`, `@since 6.9.0`].
- **Method rule:**
  - `readonly` → GET (`input` as a query param).
  - `destructive && idempotent` → DELETE.
  - Otherwise → **POST**, with `input` in the JSON body.
  - A wrong method returns `405 rest_ability_invalid_method`.
- **Yoast `yoast-seo/update-post-seo-data`** (file `src/abilities/user-interface/abilities/update-post-seo-data-ability.php`):
  - It is absent in 28.5 and present from **28.6**.
  - Annotations: `readonly:false, destructive:null, idempotent:true`, which means POST.
    `show_in_rest:true`, `mcp.public:true`.
  - Permission: `wpseo_edit_advanced_metadata`, registered for `editor`, `wpseo_editor` and
    `wpseo_manager` [S `class-register-capabilities.php`], plus a per-post `edit_post` check.
  - It is available only when indexables are enabled.
  - The post is resolved by `post_id` or `permalink` through indexables of object type `post`,
    which also covers pages as an object subtype [E].
- **Input schema** (`additionalProperties:false`):
  - **28.6:** `post_id` (int ≥1), `permalink`, `canonical` (string|null), `is_cornerstone`,
    `noindex` (bool|null), `nofollow`, `noimageindex`, `noarchive`, `nosnippet`,
    `schema_page_type`/`schema_article_type` (enum|''|null).
  - **28.7 adds** `seo_title`, `meta_description`, `open_graph_title`,
    `open_graph_description`, `twitter_title`, `twitter_description` (all string|null) [S
    GitHub + SVN: `'seo_title'` count is 0 at 28.6 and 2 at 28.7].
  - On free (non-Premium) installs, 28.7 adds an `ai_generate_hint` upsell string to the output.
  ```http
  POST /wp-json/wp-abilities/v1/abilities/yoast-seo/update-post-seo-data/run
  {"input": {"post_id": 123, "seo_title": "…", "meta_description": "…"}}   # ≥28.7 only
  ```
- **Discrepancy:** developer.yoast.com, and Context7 `/yoast/developer`, still document the
  **28.6** input list, which has no title/description. On 28.6, sending `seo_title` fails schema
  validation because of `additionalProperties:false` [E]. The live site is on 27.5, so it has
  neither `show_in_rest` nor abilities.

**(d) Schema API and de-duplication** [D developer.yoast.com/features/schema/api/,
…/integration-guidelines/]:
- `add_filter('wpseo_json_ld_output', '__return_false')` turns off all Yoast schema output. The
  docs note that `yoast_head_json` still contains schema afterwards.
- `wpseo_schema_graph_pieces` adds or removes pieces. The docs example is
  `add_filter('wpseo_schema_graph_pieces', 'remove_breadcrumbs_from_schema', 11, 2)`.
- `wpseo_schema_<class>` modifies one piece's data, e.g. `wpseo_schema_webpage`,
  `wpseo_schema_organization`, `wpseo_schema_article`.
- `wpseo_schema_graph` modifies the whole graph.
- Custom pieces extend `Abstract_Schema_Piece` and receive `Meta_Tags_Context`.
- **Guidance:** "If you output Schema that Yoast SEO outputs too, you may need to de-dupe it."
  The three options:
  1. Reference Yoast's node instead of emitting your own.
  2. Filter Yoast's piece to include your data.
  3. Reuse the same `@id` so consumers merge the nodes.

## 12. Elementor 4.0.7 / Elementor Pro

- Context7 `/elementor/elementor-developers-docs` (no `Document::save` example found).
- **Version check:** the GitHub tag `v4.0.7` has `Version: 4.0.0` in its header and a `Stable
  tag: 3.34.2` readme, so it is not the shipped build. I verified against **WordPress.org SVN
  `tags/4.0.7`** (header `Version: 4.0.7`).
- **Schema and meta tags Elementor (free) emits:**
  - **FAQPage JSON-LD** as a separate `<script type="application/ld+json">` when a widget's
    **"FAQ Schema"** switcher (`faq_schema`) is on. This applies to Accordion, Toggle and
    Nested Accordion (`includes/widgets/{accordion,toggle}.php`,
    `modules/nested-accordion/widgets/nested-accordion.php`). FAQPage is not stitched into
    Yoast's `@graph`, so this is a **duplicate risk** next to Yoast or our `faq-schema` skill.
  - **Microdata** (`itemprop="reviewRating"`, `schema.org/Rating`) in the Star Rating widget.
  - **`<meta name="generator" content="Elementor …">`** on `wp_head`, controlled by option
    `elementor_meta_generator_tag`. The code returns early when the option is `'1'` [S
    `modules/generator-tag/module.php`], so the exact on/off mapping is [U].
- Free Elementor emits no title, description, canonical or OG tags (search: no `og:title` in the
  repo) [S].
- **Elementor Pro** is closed source. **[U]** Do Pro widgets emit JSON-LD or meta?
  **Test:** on one Pro-widget page, count `application/ld+json` blocks and `itemtype=` /
  `og:` occurrences in a saved HTML copy, then diff against a Yoast-only page.
- **`Document::save()` for programmatic edits** [S SVN 4.0.7 `core/base/document.php` L795–880,
  `includes/plugin.php` L100]:
  ```php
  $doc = \Elementor\Plugin::$instance->documents->get( $post_id );   // Documents_Manager::get($id, $from_cache = true)
  $elements = $doc->get_elements_data();                              // decoded _elementor_data
  // …mutate $elements…
  $ok = $doc->save( [ 'elements' => $elements, 'settings' => [ /* optional page settings */ ] ] );
  ```
  - `save()` returns `false` unless `is_editable_by_current_user()`. Under WP-CLI that means
    `--user=<editor>`.
  - It applies the `elementor/document/save/data` filter.
  - If the user lacks `unfiltered_html`, every non-bool value goes through `wp_kses_post`.
  - It saves settings and then elements, deletes the post CSS, calls `delete_cache()`, and
    fires `elementor/document/after_save`.
  - It does **not** purge WP Rocket or nginx [E]. Purge them separately after each batch.

## 13. unifapi.com and KeywordGraph/InfraNodus MCP (fetched 2026-10-17)

- **UnifAPI** [D unifapi.com/pricing, unifapi.com/llms.txt, /legal/terms-of-service]:
  - Pricing: Free (10 free ops). Pay-as-you-go **$0.001/credit**, with a **2,000-credit bonus on
    first top-up** and per-operation minimums of 1–1,000 credits. Enterprise is custom. Failed
    requests aren't charged.
  - Auth: HTTP API `https://api.unifapi.com` with `Authorization: Bearer <key>`. MCP
    `https://mcp.unifapi.com`, "OAuth recommended; API-key bearer headers supported as
    fallback".
  - Terms: ToS effective 2026-05-21 (UnifAPI, Inc.); it says nothing about logging, retention
    or training.
  - Legal URLs: `https://unifapi.com/legal/{terms-of-service,privacy-policy,data-processing-agreement,acceptable-use-policy,security-policy}`.
- **InfraNodus** [D infranodus.com, infranodus.com/mcp]:
  - Prices: Basic €12/mo (€144/yr; no API, MCP included, personal use). Advanced €32/mo
    (€384/yr; API, commercial use). Premium €66/mo (€792/yr). 14-day trial. Prices exclude VAT.
  - MCP `https://mcp.infranodus.com`. Auth is an InfraNodus API key via OAuth, or the
    `INFRANODUS_API_KEY` environment variable. A `doNotSave` parameter avoids storing graphs.
  - Terms: `https://infranodus.com/about/terms-conditions` (InfraNodus SAS, Paris, plus Ways
    Ltd/Nodus Labs, UK). The customer keeps their data. The service may use "Aggregated
    Anonymous Data".
  - Privacy: `https://infranodus.com/about/privacy-policy`.
- **KeywordGraph** [D keywordgraph.com]:
  - Owner: Nodus Labs / Ways Ltd.
  - Prices (annual): Basic €12/mo, Advanced €32/mo, Premium €66/mo. Self-hosted Enterprise from
    €9,900/yr + €2,900 setup.
  - MCP `https://mcp.keywordgraph.com`. **API/MCP needs Advanced or Premium.**
  - Legal pages: `keywordgraph.com/about/{terms-conditions,privacy-policy}/`.
- **[U]** For both InfraNodus and KeywordGraph, the monthly-billing prices and "monthly vs
  annual" labels are ambiguous on the pages (the 35% savings claim doesn't reconcile).
  **Test:** open the checkout page.

## 14. DataForSEO spend controls

- [D dataforseo.com/help-center/limit-my-payments, updated 2024-07-17]:
  - A **daily expenses limit** is set in Dashboard → Settings. It can apply "for all APIs" or as
    "a daily budget allocated to a certain API or endpoint".
  - The window is 24 h UTC. Tasks over the limit return **error `40203`** ("The cost limit has
    been exceeded").
- [D …/dfs-dashboard-how-to-find-everything, updated 2026-07-08]:
  - **Account Access lets you invite colleagues "as collaborators"**.
  - Auto-recharge exists.
  - No sub-accounts with separate balances or separate API credentials are documented.
- An IP allowlist article exists at `dataforseo.com/help-center/whitelist-ips` (HTTP 200; not
  read in detail).
- Result: account-level and per-endpoint daily caps exist, but there is no per-credential
  sub-account. This partly settles doc 10's [U].
- **[U]** Does the cap apply to the Live endpoints the MCP uses? **Test:** set a $0.01 daily cap,
  make one $0 docs call, then make one cheap Live call and expect `40203`.

## 15. google-adk / analytics-mcp on Python 3.14 (Windows)

- Not a Context7 question. Data from PyPI JSON on 2026-10-17 [P].
- **Versions:**
  - `google-adk` latest is **2.12.0** (2026-10-13), `requires_python >=3.11`, 24 non-extra
    direct dependencies.
  - `analytics-mcp 0.7.0` requires `google-analytics-data==0.23.0`,
    `google-analytics-admin==0.30.1`, `google-auth~=2.40`, `mcp>=1.24.0,<2`,
    **`google-adk>=1.29.0`** (resolves to 2.12.0, a major version above 1.29) and
    `httpx>=0.28.1`.
- **Native wheels for cp314 / win_amd64 (latest versions):**
  - google-adk's direct dependencies with native code: `cryptography` 50.0.2 (cp311-abi3 +
    cp314t), `pyyaml` 6.0.3 (cp314), `watchdog` 6.0.0 (`py3-none-win_amd64`). The other 21 are
    pure Python.
  - Transitive: `pydantic-core` 2.50.1 (cp314), `grpcio` 1.84.0 (cp314; `google-analytics-data`
    needs `grpcio>=1.75.1` on 3.14), `protobuf` 7.36.2 (cp310-abi3), `cffi` 2.1.1, `websockets`
    16.1.1 (cp314; `google-genai` caps it `<17`), `rpds-py`, `jiter`, `httptools`, `pywin32` 312
    (cp314; `mcp` needs `>=311` on 3.14).
  - **No torch, onnx or numpy** in google-adk's non-extra dependencies. (numpy 2.5.4,
    onnxruntime 1.31.0 and torch 2.14.1 all have cp314 Windows wheels anyway.)
  - So the reported failure is unlikely to be a wheel gap [E].
- **[U]** Is analytics-mcp 0.7.0 compatible with google-adk **2.x** (its floor is 1.29)?
  **Test:** `uvx --python 3.14 analytics-mcp==0.7.0 --help`. Then
  `uvx --with "google-adk<2" …` as a fallback.

---

## Corrections to docs 10/11/12

| Doc | Earlier claim | Verified |
|---|---|---|
| 10 §8 | analytics-mcp pins `google-analytics-data==0.23.2` | 0.7.0 metadata pins **`==0.23.0`**, plus `google-auth~=2.40`, `mcp<2`. `google-adk>=1.29` resolves to **2.12.0** |
| 10 §8 | winget command [U] | Verified: `winget install --id=astral-sh.uv -e` |
| 10 §3 | DataForSEO cap [U] | Daily caps (global or per API/endpoint, `40203`) plus collaborators. No sub-accounts |
| 11 §16 | `pip install trafilatura==2.3.1` CLI | Use uv. **`--input-file` is a URL list that downloads.** Pre-fetched HTML goes through stdin or `--input-dir` |
| 11 §17 | advertools deps `pandas, pyarrow, scrapy, twython` | The wheel also needs `pyasn1`, `requests`, and adds `serp_claude` with an `[claude]` → `anthropic` extra. The wheel differs from master |
| 11 §20 | pyseoanalyzer pins `langchain==0.3.30`, OrcaRouter proxy | The **released wheel** pins `langchain==0.3.22`, `langchain-anthropic==0.3.10`, with no OrcaRouter (that is `main`). LLM is opt-in by `--run-llm-analysis`, but `load_dotenv()` at import can read the repo `.env`. Pins conflict with trafilatura 2.3.1 |
| 11 §14 | crawl4ai stealth deps | Confirmed also in the Docker image. REST `POST /crawl` (≤100 URLs) on 11235. API token empty by default |
| 12 §0.3/§24 | `update-post-seo-data` from 28.6 | True, but **`seo_title`/`meta_description` (and OG/X) are accepted only from 28.7**. Yoast's dev docs still show the 28.6 schema. The capability is `wpseo_edit_advanced_metadata` |
| 12 §6 | unifapi MCP is "OAuth-gated" | OAuth recommended, **API-key bearer fallback**. $0.001/credit |
| — | (new) | setup-uv **v10.3.0 = `1c37ad0…`**. No `v10` floating tag. Embedded checksums only through uv 0.13.0. `uv init` apps get a build system by default since 0.12. Elementor Accordion/Toggle "FAQ Schema" emits standalone FAQPage JSON-LD |
