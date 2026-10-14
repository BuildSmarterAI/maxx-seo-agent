# Spike: WordPress MCP (MCP Adapter + Abilities API) and WP-CLI

**Date:** 2026-10-14
**Author:** Harris / BuildSmarter
**Question:** What is the official WordPress MCP repo? How do we install and fully configure a
WordPress MCP server and WP-CLI? Should this repo use either against the production-only
Maxx Builders site, and if so, how?

**Method:** Primary sources only: GitHub source, READMEs and releases fetched with `gh api`,
plus developer.wordpress.org / make.wordpress.org, wordpress.org/plugins, and code.claude.com.
The source research made no contact with www.maxxbuilders.com. A follow-up made
**unauthenticated, read-only GETs only**; see [Live probe](#live-probe-2026-10-14-unauthenticated-get-only).
Every other live-site statement is an inference from source code and is labelled as one.

---

## TL;DR

- **`WordPress/mcp-adapter` is the official WordPress MCP server.** It is a WordPress.org
  AI-team plugin, **v0.7.0, released 2026-10-02**. It was the first release published to the
  wordpress.org directory, and it requires WP ≥ 6.9 and PHP ≥ 7.4. It turns **Abilities API**
  abilities into MCP tools. `Automattic/wordpress-mcp` is **archived and deprecated** in its
  favour. `@automattic/mcp-wordpress-remote` (**v0.5.1, 2026-10-06**) is an optional
  stdio-to-HTTP proxy. The Abilities API moved into **core in WP 6.9**, and its standalone repo is archived.
- **Two transports.** (1) HTTP at `/wp-json/mcp/mcp-adapter-default-server`, authenticated
  with a WP user plus Application Password. Claude Code connects to it directly with
  `type: "http"` and an `Authorization: Basic` header. (2) STDIO via
  **`wp mcp-adapter serve --server=<id> --user=<user>`** (WP-CLI). It needs no password, but
  it has to run where the WordPress files are. Core WordPress has no OAuth server, and neither
  does the adapter.
- **What is exposed by default:** three meta-tools (`discover` / `get-ability-info` /
  `execute-ability`) that reach every ability marked `public`. Core 7.1.3 makes 3 read-only
  abilities public. **Yoast SEO 28.6+ (28.7 shipped 2026-10-13) registers
  `yoast-seo/update-post-seo-data` as MCP-public and writable**, gated by
  `wpseo_edit_advanced_metadata`, which Yoast grants to **Editor**. Inference from source:
  with the adapter installed, our existing Editor credential could rewrite production SEO
  titles and meta descriptions straight from an AI client, **bypassing the `change_set`
  approval gate**.
- **WP-CLI** (`wp-cli/wp-cli`) is the official command-line tool for WordPress. The latest
  stable release is **v2.12.0 (2025-05-07)**, and `main` is at 3.0.0-alpha. Windows install:
  PHP on PATH, `wp-cli.phar`, a `wp.bat` shim, then `setx path`. **This machine has no PHP and
  no `wp` yet.** Remote use goes through `--ssh=` or `@alias` in `wp-cli.yml`, and it needs
  WP-CLI on the host too.
- **Live probe: the MCP Adapter's default server is already enabled on production**
  (WP 7.1.3; `/wp-json/mcp/mcp-adapter-default-server` returns 401 without a login). Which
  abilities it exposes is unverified; see [Live probe](#live-probe-2026-10-14-unauthenticated-get-only).
- **Recommendation: do not connect an AI client with write access to production yet.** If the
  team adopts this, do it **read-only first**: a dedicated low-privilege user, a mu-plugin
  that uses the core `wp_register_ability_args` filter to opt write abilities out of MCP, and
  a **local-scope** Claude Code entry (never the committed `.mcp.json`, which the headless
  orchestrator loads without a prompt). Writes keep going through `change_set` →
  `npm run wp:apply`. **Policy conflict:** the global auth policy forbids passing application
  credentials to Claude Code, and any HTTP connection to the live site would do exactly that.
  The user has to decide this.

## What each repo is, and its status

Verified 2026-10-14 using `gh api repos/<r>` and `gh api repos/<r>/releases`.

| Repo / package | What it is | Status | Latest release |
|---|---|---|---|
| [`WordPress/mcp-adapter`](https://github.com/WordPress/mcp-adapter) | The official plugin that "bridges the Abilities API to the Model Context Protocol". It is part of the [AI Building Blocks initiative](https://make.wordpress.org/ai/2025/07/17/ai-building-blocks). | **Active.** Last pushed 2026-10-14. Listed on [wordpress.org/plugins/mcp-adapter](https://wordpress.org/plugins/mcp-adapter/) with 40,000+ installs, "Tested up to 7.1.3". | **v0.7.0, 2026-10-02** ([notes](https://github.com/WordPress/mcp-adapter/releases/tag/v0.7.0)). Pre-1.0. |
| [`Automattic/wordpress-mcp`](https://github.com/Automattic/wordpress-mcp) | The original Automattic MCP plugin. | **Archived and deprecated.** The README says "not the recommended way… Do not use it for new installations" and points to `mcp-adapter`. | v0.2.5, 2025-07-24 |
| [`Automattic/mcp-wordpress-remote`](https://github.com/Automattic/mcp-wordpress-remote) (npm `@automattic/mcp-wordpress-remote`) | A local stdio-to-HTTP pass-through proxy. It supports App Password, JWT, OAuth 2.1 and WooCommerce keys. | **Active.** Last pushed 2026-10-08. | **v0.5.1, 2026-10-06** |
| [`WordPress/abilities-api`](https://github.com/WordPress/abilities-api) | The Abilities API: a registry of what core, plugins and themes "can do", each with input/output schema, permissions and an execute callback. | **Archived.** Merged into core in **WP 6.9** ([dev note, 2025-11-10](https://make.wordpress.org/core/2025/11/10/abilities-api-in-wordpress-6-9/)). The archived `wordpress-mcp` README says it is "moving into WordPress Core as of version 6.9". | v0.4.0, 2025-10-30 (v0.5.0-rc, 2025-11-14) |
| [`wp-cli/wp-cli`](https://github.com/wp-cli/wp-cli) | The WP-CLI framework (see [WP-CLI](#wp-cli)). | **Active.** | **v2.12.0, 2025-05-07**. `main` [`VERSION`](https://github.com/wp-cli/wp-cli/blob/main/VERSION) = `3.0.0-alpha`. |

How they fit together: a plugin, core or a theme calls `wp_register_ability()` (Abilities API,
in core). The **MCP Adapter** turns abilities with `meta.public` / `meta.mcp.public` set into
MCP tools, resources and prompts, served over HTTP (REST) or STDIO (WP-CLI). An MCP client
then either connects over HTTP directly or launches **mcp-wordpress-remote** locally as a
stdio bridge ([adapter README](https://github.com/WordPress/mcp-adapter#readme)).

The adapter also speaks MCP `2026-07-28` and `2025-11-25`. Clients that ask for `2025-06-18`
or `2024-11-05` are served through the `2025-11-25` schema
([v0.7.0 notes](https://github.com/WordPress/mcp-adapter/releases/tag/v0.7.0)). Starting with
v0.7.0, **bundling the adapter as a Composer library is deprecated: install the plugin**
([installation.md](https://github.com/WordPress/mcp-adapter/blob/trunk/docs/getting-started/installation.md)).

## Install and configure the MCP server

### 1. Server side (WordPress)

**Prerequisites**
([site-owners.md](https://github.com/WordPress/mcp-adapter/blob/trunk/docs/getting-started/site-owners.md)):

- WordPress 6.9 or newer.
- HTTPS. WordPress only offers Application Passwords over HTTPS, except on local sites.
- A dedicated WordPress user "with the lowest role that can do the work".
- Node.js, if you use the npx proxy.

**Install** using wp-admin (the plugin is now in the directory) or WP-CLI
([installation.md](https://github.com/WordPress/mcp-adapter/blob/trunk/docs/getting-started/installation.md)):

```bash
wp plugin install https://github.com/WordPress/mcp-adapter/releases/latest/download/mcp-adapter.zip --activate
```

On activation the plugin creates the **default server** (ID `mcp-adapter-default-server`) at
`/wp-json/mcp/mcp-adapter-default-server`. With plain permalinks the URL is
`/?rest_route=/mcp/mcp-adapter-default-server` instead. The plugin adds **no wp-admin
screens**, and abilities come from plugins and core
([site-owners.md](https://github.com/WordPress/mcp-adapter/blob/trunk/docs/getting-started/site-owners.md)).
An open issue asks for production best practice and a wp-admin UI, and it has no maintainer
answer yet ([#324](https://github.com/WordPress/mcp-adapter/issues/324)).

**Tools exposed by default**
([default-server.md](https://github.com/WordPress/mcp-adapter/blob/trunk/docs/guides/default-server.md)).
There are three meta-tools. The MCP names use `-` where the ability names use `/`:

| MCP tool | Annotations | Required capability (filter) |
|---|---|---|
| `mcp-adapter-discover-abilities` | readOnly | `read` (`mcp_adapter_discover_abilities_capability`) |
| `mcp-adapter-get-ability-info` | readOnly | `read` (`mcp_adapter_get_ability_info_capability`) |
| `mcp-adapter-execute-ability` | **not** readOnly, openWorld | `read` (`mcp_adapter_execute_ability_capability`), plus the target ability's own `permission_callback` |

**Abilities reachable through them.** An ability counts as MCP-public if
`meta.mcp.public === true`, or if `meta.mcp.public` is unset and `meta.public === true`.
Malformed `meta.mcp` fails closed
([`McpAbilityExposure.php`](https://github.com/WordPress/mcp-adapter/blob/trunk/includes/Abilities/McpAbilityExposure.php)).
What a site like ours would expose:

- **Core (WP 7.1.3)** makes 3 abilities public, all `readonly`
  ([`abilities.php@7.1.3`](https://github.com/WordPress/wordpress-develop/blob/7.1.3/src/wp-includes/abilities.php)):
  - `core/get-site-info` (needs `manage_options`)
  - `core/get-user-info` (needs any logged-in user)
  - `core/get-environment-info` (needs `manage_options`)

  Trunk adds `core/settings-get` and `core/users-query` marked `@since 7.2.0`. **These are
  unreleased**
  ([trunk `abilities/`](https://github.com/WordPress/wordpress-develop/tree/trunk/src/wp-includes/abilities)).
- **Yoast SEO 28.7** registers abilities under the `yoast-seo/` category
  ([`src/abilities` @28.7](https://github.com/Yoast/wordpress-seo/tree/28.7/src/abilities/user-interface/abilities)).
  The files were absent at tag 28.5 and present at 28.6 (2026-09-29).
  - `yoast-seo/get-post-seo-data`: readonly, `mcp.public`, requires `wpseo_edit_advanced_metadata`.
  - **`yoast-seo/update-post-seo-data`**: `readonly: false`, `show_in_rest: true`,
    `mcp.public: true`, `permission_callback` = `wpseo_edit_advanced_metadata`. It can write
    `seo_title`, `meta_description`, OG/Twitter fields and more, and "a provided empty value
    clears that field"
    ([source @28.7](https://github.com/Yoast/wordpress-seo/blob/28.7/src/abilities/user-interface/abilities/update-post-seo-data-ability.php)).
  - Score abilities (SEO, readability, inclusive-language) need `wpseo_manage_options`.
  - On trunk only (not checked at 28.7): settings toggles such as `set-xml-sitemap-status`,
    `set-llms-txt-status`, `update-site-representation`.
  - Yoast grants `wpseo_edit_advanced_metadata` to **`editor`, `wpseo_editor` and
    `wpseo_manager`**, and grants `wpseo_manage_options` to `administrator` and
    `wpseo_manager`
    ([`class-register-capabilities.php`](https://github.com/Yoast/wordpress-seo/blob/trunk/admin/capabilities/class-register-capabilities.php)).

**Restricting what is exposed** (server-side levers, all from primary source):

1. **Hide one ability from MCP.** Set `meta.mcp.public = false` through the core filter
   `wp_register_ability_args` (present since 6.9.0,
   [registry @6.9.0](https://github.com/WordPress/wordpress-develop/blob/6.9.0/src/wp-includes/abilities-api/class-wp-abilities-registry.php)).
   You can do this from a mu-plugin without touching Yoast. Also setting `show_in_rest = false`
   closes the parallel `wp-abilities/v1/.../run` REST route.
2. **Raise the meta-tool capabilities** with the three `mcp_adapter_*_capability` filters
   (see the table above).
3. **Replace the default server with an allowlist.** Use
   `add_filter( 'mcp_adapter_create_default_server', '__return_false' )` together with
   `$adapter->create_server(...)` on `mcp_adapter_init`, passing an explicit tool list and a
   transport `permission_callback`
   ([default-server.md](https://github.com/WordPress/mcp-adapter/blob/trunk/docs/guides/default-server.md),
   [transport-permissions.md](https://github.com/WordPress/mcp-adapter/blob/trunk/docs/guides/transport-permissions.md)).
   Security is two-layered: the transport gate applies server-wide, and each ability runs its
   own `permission_callback`.
4. **Edit the default server's configuration** through the `mcp_adapter_default_server_config`
   filter, for example to change the `tools` list.
5. **Session hardening** filters: `mcp_adapter_session_max_per_user` (default 32) and
   `mcp_adapter_session_inactivity_timeout` (default 24h).

**Authentication**
([site-owners.md](https://github.com/WordPress/mcp-adapter/blob/trunk/docs/getting-started/site-owners.md),
[mcp-wordpress-remote README](https://github.com/Automattic/mcp-wordpress-remote#authentication-methods)):

- **HTTP:** HTTP Basic with WP username plus Application Password. The default transport
  check is `is_user_logged_in()`. A custom `permission_callback` can enforce something else,
  such as an API-key header.
- **OAuth:** "WordPress does not include an OAuth server and MCP Adapter does not add one", so
  claude.ai web connectors cannot connect without a third-party OAuth plugin. The proxy's
  `OAUTH_ENABLED` / `JWT_TOKEN` modes need a matching server-side plugin. **Which plugin is
  unverified.**
- **STDIO:** the WP-CLI process acts as the user given in `--user`.

### 2. Client side: Claude Code

Claude Code facts from [code.claude.com/docs/en/mcp](https://code.claude.com/docs/en/mcp):

- Scopes: **local** (the default, stored in `~/.claude.json` under the project, private),
  **project** (`.mcp.json`, committed), **user**.
- `${VAR}` and `${VAR:-default}` expand in `command`, `args`, `env`, `url` and `headers`.
- A `headersHelper` command can generate headers each time the client connects.
- **"In `claude -p` runs, Agent SDK sessions, and cloud sessions, Claude Code can't show that
  prompt: it loads project-scoped servers without asking."**

To keep credentials out of config files, reference the env vars below. Don't inline them, and
**don't run `claude mcp add ... --header "Authorization: Basic $X"` in a shell**: the shell
expands `$X` and the literal secret ends up stored in `~/.claude.json`. Use `add-json` with
single quotes so `${...}` reaches Claude Code unexpanded.

**A. HTTP, direct.** This is the adapter's documented path for Claude Code
([site-owners.md](https://github.com/WordPress/mcp-adapter/blob/trunk/docs/getting-started/site-owners.md),
[proxy README "When to use"](https://github.com/Automattic/mcp-wordpress-remote#when-to-use-this-proxy)).
`WP_MCP_BASIC` must hold base64(`user:app-password`) in the environment that launches Claude
Code.

```bash
claude mcp add-json --scope local wordpress-ro '{
  "type": "http",
  "url": "${WP_BASE_URL}/wp-json/mcp/mcp-adapter-default-server",
  "headers": { "Authorization": "Basic ${WP_MCP_BASIC}" }
}'
```

To avoid keeping a precomputed secret in the shell, use a `headersHelper` script that builds
the header from `WP_USER` / `WP_APP_PASSWORD` and prints
`{"Authorization":"Basic …"}`. Claude Code runs it on each connect with a 10 s timeout
([docs](https://code.claude.com/docs/en/mcp#use-dynamic-headers-for-custom-authentication)).

**B. stdio, through the proxy.** Use this when you need a log file, timeouts, or JWT/OAuth
([proxy README](https://github.com/Automattic/mcp-wordpress-remote#environment-variables)).
The proxy reads `WP_API_URL`, `WP_API_USERNAME` and `WP_API_PASSWORD`:

```bash
claude mcp add-json --scope local wordpress-ro '{
  "command": "npx",
  "args": ["-y", "@automattic/mcp-wordpress-remote@0.5.1"],
  "env": {
    "WP_API_URL": "${WP_BASE_URL}/wp-json/mcp/mcp-adapter-default-server",
    "WP_API_USERNAME": "${WP_MCP_USER}",
    "WP_API_PASSWORD": "${WP_MCP_APP_PASSWORD}",
    "OAUTH_ENABLED": "false",
    "LOG_FILE": "C:/Users/harri/.mcp-auth/wp-remote.log"
  }
}'
```

Pin the version. The upstream docs use `@latest`, but a pinned version matches how this repo
pins `@supabase/mcp-server-supabase@0.8.2` in `.mcp.json`. The current Claude Code MCP page has
**no Windows note** about wrapping `npx` in `cmd /c`. If the server fails to start on native
Windows, test `"command": "cmd", "args": ["/c", "npx", ...]`. That workaround is **unverified
for the current version**.

**C. stdio, via WP-CLI.** This is the documented path for local sites only
([cli-usage.md](https://github.com/WordPress/mcp-adapter/blob/trunk/docs/guides/cli-usage.md)):

```bash
claude mcp add-json --scope local wordpress-local '{
  "command": "wp",
  "args": ["--path=C:/path/to/local/site", "mcp-adapter", "serve",
           "--server=mcp-adapter-default-server", "--user=mcp-reader"]
}'
```

It needs no password, but it needs PHP, WP-CLI and the WordPress files on the same machine
(see below). Over `wp --ssh=… mcp-adapter serve`, WP-CLI's SSH runner switches to `ssh -T`
when stdout is not a TTY
([`Runner.php`](https://github.com/wp-cli/wp-cli/blob/main/php/WP_CLI/Runner.php)), so
streaming JSON-RPC over SSH is plausible. **It is not documented by the adapter and was not
tested.**

**Restricting on the client.** Claude Code permission rules match MCP tools as
`mcp__<server>__<tool>`, and deny rules accept globs
([permissions docs](https://code.claude.com/docs/en/permissions)). For example, deny
`mcp__wordpress-ro__mcp-adapter-execute-ability` to allow discovery only. Parameter-level MCP
rules (with parentheses) are **skipped** in settings files. That means Claude Code **cannot
deny "execute only the write ability" while allowing "execute the read ability"**: both go
through the same `execute-ability` tool. Read-versus-write separation therefore has to happen
server-side.

## WP-CLI

**What it is:** the official command-line interface for WordPress. It manages plugins, users,
posts, options, search-replace, export/import and so on without a browser
([wp-cli/wp-cli](https://github.com/wp-cli/wp-cli), [wp-cli.org](https://wp-cli.org/)). The
latest stable release is **v2.12.0 (2025-05-07)**.

**Requirements:** PHP ≥ 7.2.24
([installing guide](https://make.wordpress.org/cli/handbook/guides/installing/)).

**Typical Linux/macOS host:**

```bash
curl -O https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar
php wp-cli.phar --info
chmod +x wp-cli.phar && sudo mv wp-cli.phar /usr/local/bin/wp
# optional integrity check: download wp-cli.phar.asc + wp-cli.pgp, then gpg --verify
```

Composer alternative: `composer global require wp-cli/wp-cli-bundle`
([installing guide](https://make.wordpress.org/cli/handbook/guides/installing/)). Many managed
hosts already ship `wp`. **Whether Maxx's host does is unknown.**

**Windows 11 (this machine).** The handbook's Windows steps are: put PHP on PATH, place
`wp-cli.phar` in `C:\wp-cli`, create `C:\wp-cli\wp.bat` containing

```bat
@ECHO OFF
php "c:/wp-cli/wp-cli.phar" %*
```

and run `setx path "%path%;c:\wp-cli"`
([installing guide](https://make.wordpress.org/cli/handbook/guides/installing/)). This was
checked on 2026-10-14: **`php` and `wp` are not installed. Node v24.13.1 and OpenSSH 10.3p1
are present.** Watch out for one thing: `setx path "%path%;…"` writes the merged machine and
user PATH into the *user* PATH and truncates it at 1024 characters. Editing PATH in System
Properties is safer. That caveat comes from general Windows behaviour, not from the WP-CLI
handbook.

**Remote usage**
([running commands remotely](https://make.wordpress.org/cli/handbook/guides/running-commands-remotely/)):

- `--ssh=[<scheme>:][<user>@]<host>[:<port>][<path>]`. The schemes are `ssh` (the default),
  `docker`, `docker-compose` and `vagrant`.
- Define aliases in `wp-cli.yml` (project) or `~/.wp-cli/config.yml`:

  ```yaml
  @prod:
    ssh: deploy@host.example.com~/public_html
  ```

  Then run `wp @prod plugin list`. Alias groups such as `@both: [@prod, @dev]` fan out to
  several sites.
- WP-CLI must also be installed **on the remote server**, accessible as `wp`. Non-interactive
  SSH does not load `.bashrc`, so PATH may differ.

**How it relates to MCP.** The adapter registers the WP-CLI command **`mcp-adapter`**
(`\WP_CLI::add_command( 'mcp-adapter', McpCommand::class, …)` in
[`McpAdapter.php`](https://github.com/WordPress/mcp-adapter/blob/trunk/includes/Core/McpAdapter.php)).
Its subcommands are:

- `wp mcp-adapter serve [--server=<id>]`, plus WP-CLI's global `--user=<id|login|email>`.
  Without `--user` it runs unauthenticated.
- `wp mcp-adapter list [--format=table|json|csv|yaml] [--protocol=2025-11-25|2026-07-28]`.

([cli-usage.md](https://github.com/WordPress/mcp-adapter/blob/trunk/docs/guides/cli-usage.md)).
**There is a source conflict here.** The docblock examples in
[`McpCommand.php`](https://github.com/WordPress/mcp-adapter/blob/trunk/includes/Cli/McpCommand.php)
say `wp mcp serve`. The registration code and the guide both say `mcp-adapter`, so
**`wp mcp-adapter serve` is correct** and the docblock is stale.

## Security and least privilege

- **Every ability runs with the connected user's capabilities.** "An assistant connected as an
  Editor cannot do what an Editor cannot do"
  ([site-owners.md](https://github.com/WordPress/mcp-adapter/blob/trunk/docs/getting-started/site-owners.md)).
  The converse also holds: it **can** do everything an Editor can, through any public ability.
- **Abilities act on the live site** the same way wp-admin actions do. The adapter's own
  guidance is "Try new abilities on a staging copy first, and keep regular backups". **We have
  no staging.**
- **The ability set is not fixed.** Every plugin update can add MCP-public abilities, as Yoast
  did in 28.6. A credential that was read-only in practice last month can gain write tools
  without any config change on our side. The default server's discover/execute design makes
  this automatic.
- **Application Passwords** are per user and per client. Each one is listed with its
  last-used time and can be revoked instantly. Create one password per client and device.
  WordPress offers them only over HTTPS. Some Apache setups strip `Authorization`
  ([site-owners.md](https://github.com/WordPress/mcp-adapter/blob/trunk/docs/getting-started/site-owners.md)).
- **Observability is off by default.** The default `observability_handler` is
  `NullMcpObservabilityHandler`, and errors go only to `error_log`
  ([default-server.md](https://github.com/WordPress/mcp-adapter/blob/trunk/docs/guides/default-server.md)).
  Without a custom handler there is no MCP audit trail.

**A least-privilege setup, if we adopt this:**

1. Create a **dedicated user** (for example `mcp-reader`). Use a **custom role that has only
   `read`** and not Editor; read-only abilities are enough for a start. Note that core's
   site-info and environment-info abilities need `manage_options`, so a read-only role will not
   see them, and that is acceptable.
2. Add a **mu-plugin** (next to `packs/wordpress/seo-rest-bridge.php`) that does three things:
   - Uses `wp_register_ability_args` to set `meta.mcp.public = false` and
     `show_in_rest = false` on every ability whose `annotations.readonly !== true`. This is an
     **allowlist by read-only annotation**, so it still holds when future plugin updates add
     abilities.
   - Raises `mcp_adapter_execute_ability_capability` as an extra gate.
   - Plugs in an observability handler that writes a log.
3. Use **local-scope** Claude Code config only. Never add it to the committed `.mcp.json`
   (see Fit below). Deny `mcp__wordpress-ro__mcp-adapter-execute-ability` until the mu-plugin
   has been verified.
4. Pin the adapter and proxy versions. Re-run `wp mcp-adapter list` and a `discover` call after
   every plugin update, to re-check what is exposed.

## Live probe (2026-10-14, unauthenticated GET only)

Method: `curl` GETs against public routes, without credentials. No POST requests were sent
and the MCP endpoint was not called.

| Probe | Result |
|---|---|
| `<meta name="generator">` on `/`, plus `/feed/` `<generator>` | **WordPress 7.1.3** |
| `/wp-json/` namespaces | Includes **`mcp`** and **`wp-abilities/v1`** (alongside `yoast/v1`) |
| `/wp-json/` routes | **`/mcp/mcp-adapter-default-server` (POST, GET, DELETE)**; `/wp-abilities/v1/abilities`; `/wp-abilities/v1/abilities/{name}/run` (GET, POST, PUT, PATCH, DELETE) |
| `GET /wp-json/mcp/mcp-adapter-default-server` | 401: it exists and requires authentication |
| `GET /wp-json/wp-abilities/v1/abilities` | 401 `rest_forbidden` |
| Yoast version | Not exposed publicly (no version comment in the HTML; WP Rocket is active) |

**What this changes.** The MCP Adapter's default server is **already live on production**.
Recommendation 1 below ("do not install") is therefore about the current state, not a future
choice. It is unknown who enabled it, whether it is the `mcp-adapter` plugin or a feature
bundled with WP 7.x, and which abilities it exposes. All of that needs an authenticated read.
Anyone holding an Editor-or-higher Application Password may already be able to run any
MCP-public ability, including `yoast-seo/update-post-seo-data` if Yoast ≥ 28.6. That
outcome is an inference and is unverified.

**Read-only verification (an operator runs this; the credential never enters Claude Code):**

```bash
node --env-file=.env -e "const b=process.env.WP_BASE_URL.replace(/[/]$/,''),h={Authorization:'Basic '+Buffer.from(process.env.WP_USER+':'+process.env.WP_APP_PASSWORD).toString('base64')};fetch(b+'/wp-json/wp-abilities/v1/abilities?per_page=100',{headers:h}).then(async r=>{const j=await r.json();console.log(r.status);if(Array.isArray(j))for(const a of j)console.log(a.name,'readonly='+Boolean(a.meta?.annotations?.readonly),'mcp_public='+Boolean(a.meta?.mcp?.public))})"
```

Then a WP Admin (not the Editor credential) checks **Plugins** for "MCP Adapter" and confirms
whether the endpoint was enabled on purpose.

## Fit for this repo

**Current state.** `packs/wordpress/http.mjs` writes over REST with HTTP Basic auth
(`WP_BASE_URL`, `WP_USER`, `WP_APP_PASSWORD`) as an Editor. Writes only happen through
approved `change_set` rows → `npm run wp:apply`, with a backup or export first and small
batches. The site is production-only (root `CLAUDE.md`).

**How MCP would interact with that gate:**

- **It would bypass it.** An MCP client calling `execute-ability` →
  `yoast-seo/update-post-seo-data` writes straight to production. There is no `change_set`
  row, no pre-write export, no batch limit, and no `rollback.mjs` snapshot. This is the same
  class of action that `workflow.md` classifies as "safe but PR-gated". MCP has **no
  human-approval step on the WordPress side**; the only gate is Claude Code's per-tool prompt,
  and auto mode or headless runs can skip it.
- **A related finding that matters now, even without MCP.** Because Yoast 28.6+ marks
  `update-post-seo-data` as `show_in_rest: true`, the core Abilities REST route
  `POST /wp-json/wp-abilities/v1/abilities/yoast-seo/update-post-seo-data/run` should be
  reachable today by **our existing Editor Application Password**. That would be a second,
  documented write surface for Yoast meta beside `seo-rest-bridge.php`. **This is an inference
  from source only.** It depends on the live site's Yoast version and was not probed. A
  read-only `GET /wp-json/wp-abilities/v1/abilities` with the existing credential would
  confirm it. If it holds, it may be a cleaner, Yoast-documented replacement for the custom
  bridge, which fits ADR-008's "documented Yoast surfaces only" rule. That is worth its own
  spike.
- **The headless trap.** The orchestrator runs the Agent SDK with
  `settingSources: ["project"]` (`.claude/CLAUDE.md`). Per the Claude Code docs, project-scoped
  `.mcp.json` servers load **without a prompt** in SDK and `-p` sessions. A WordPress entry in
  the committed `.mcp.json` would hand the nightly orchestrator live production write tools.
  **Keep it out of `.mcp.json`.**
- **Policy conflict that needs a user decision.** The global auth policy says application
  credentials must never be passed to Claude Code or configured in a terminal used to launch
  it. Option A (header) and option B (proxy env) both do that by design. Only option C (WP-CLI
  against a local copy) avoids it. Repo `security.md` lists `WP_APP_PASSWORD` as a managed
  credential but does not resolve this conflict.

**Recommendation:**

1. **Now:** the adapter endpoint is already live (see the Live probe). Run the read-only
   abilities listing. Have a WP Admin confirm whether the adapter was enabled on purpose. If
   not, deactivate it or restrict it to read-only abilities via `wp_register_ability_args`.
   Deactivating is a production change: back up first, per root `CLAUDE.md`. Keep
   `change_set` → `npm run wp:apply` as the only write path.
2. **Optional, low risk:** spike the core Abilities REST route above with a read-only `GET`
   using the existing pack credential. This needs no MCP and no new credential.
3. **If interactive MCP is wanted later:**
   - Run a local WordPress copy (restored from the production backup) with PHP, WP-CLI and the
     adapter installed, and connect through STDIO (option C). That gives full write
     experimentation with zero production blast radius and no credential in Claude Code.
   - Only after that, consider read-only production access, using the least-privilege steps
     above, and only once the user explicitly signs off on the credential-policy exception.
   - Writes stay behind `change_set` in every case.

## Open questions and unverified items

- **Resolved:** WordPress is 7.1.3, and the `mcp` and `wp-abilities/v1` routes are live (see
  Live probe). **Still open:** the Yoast version; which abilities are MCP-public; whether
  `yoast-seo/*` writes are reachable; and who enabled the adapter and why. All of these need
  an authenticated read.
- **Whether Maxx's host provides SSH and WP-CLI.** Unknown.
- **`wp --ssh=… mcp-adapter serve` as a long-lived stdio MCP channel.** Inferred from
  `Runner.php`. Not documented and not tested.
- **Which OAuth or JWT WordPress plugin pairs with the proxy's `OAUTH_ENABLED` / `JWT_TOKEN`
  modes.** The proxy README does not name one.
- **The `cmd /c npx` wrapper for Claude Code on native Windows.** It is not mentioned in the
  current docs. Test it before relying on it.
- **Yoast trunk's settings-toggle abilities** (`set-*-status`, `update-site-representation`).
  Their 28.7 contents were not checked file by file. 28.7 lists only the get/update post-SEO
  and score abilities.
- **[developer.wordpress.com/docs/mcp](https://developer.wordpress.com/docs/mcp/)**, which the
  archived Automattic README points to. It covers WordPress.com-hosted sites and was not
  reviewed.
- **The adapter is pre-1.0** (0.x), and v0.7.0 shipped breaking changes. Expect churn.

## Sources

- WordPress/mcp-adapter: [README](https://github.com/WordPress/mcp-adapter), [v0.7.0 release](https://github.com/WordPress/mcp-adapter/releases/tag/v0.7.0), [installation.md](https://github.com/WordPress/mcp-adapter/blob/trunk/docs/getting-started/installation.md), [site-owners.md](https://github.com/WordPress/mcp-adapter/blob/trunk/docs/getting-started/site-owners.md), [cli-usage.md](https://github.com/WordPress/mcp-adapter/blob/trunk/docs/guides/cli-usage.md), [default-server.md](https://github.com/WordPress/mcp-adapter/blob/trunk/docs/guides/default-server.md), [transport-permissions.md](https://github.com/WordPress/mcp-adapter/blob/trunk/docs/guides/transport-permissions.md), [McpAdapter.php](https://github.com/WordPress/mcp-adapter/blob/trunk/includes/Core/McpAdapter.php), [McpCommand.php](https://github.com/WordPress/mcp-adapter/blob/trunk/includes/Cli/McpCommand.php), [McpAbilityExposure.php](https://github.com/WordPress/mcp-adapter/blob/trunk/includes/Abilities/McpAbilityExposure.php), [mcp-adapter.php header](https://github.com/WordPress/mcp-adapter/blob/trunk/mcp-adapter.php), [issue #324](https://github.com/WordPress/mcp-adapter/issues/324)
- [wordpress.org/plugins/mcp-adapter](https://wordpress.org/plugins/mcp-adapter/)
- [Automattic/wordpress-mcp](https://github.com/Automattic/wordpress-mcp) (archived)
- [Automattic/mcp-wordpress-remote](https://github.com/Automattic/mcp-wordpress-remote) and its [npm package](https://www.npmjs.com/package/@automattic/mcp-wordpress-remote)
- [WordPress/abilities-api](https://github.com/WordPress/abilities-api) (archived); [Abilities API in WordPress 6.9 dev note](https://make.wordpress.org/core/2025/11/10/abilities-api-in-wordpress-6-9/); [AI Building Blocks](https://make.wordpress.org/ai/2025/07/17/ai-building-blocks)
- wordpress-develop: [abilities.php @7.1.3](https://github.com/WordPress/wordpress-develop/blob/7.1.3/src/wp-includes/abilities.php), [trunk abilities/](https://github.com/WordPress/wordpress-develop/tree/trunk/src/wp-includes/abilities), [class-wp-abilities-registry.php @6.9.0](https://github.com/WordPress/wordpress-develop/blob/6.9.0/src/wp-includes/abilities-api/class-wp-abilities-registry.php)
- Yoast/wordpress-seo: [abilities @28.7](https://github.com/Yoast/wordpress-seo/tree/28.7/src/abilities/user-interface/abilities), [update-post-seo-data-ability.php @28.7](https://github.com/Yoast/wordpress-seo/blob/28.7/src/abilities/user-interface/abilities/update-post-seo-data-ability.php), [class-register-capabilities.php](https://github.com/Yoast/wordpress-seo/blob/trunk/admin/capabilities/class-register-capabilities.php), [releases](https://github.com/Yoast/wordpress-seo/releases)
- WP-CLI: [wp-cli/wp-cli](https://github.com/wp-cli/wp-cli) and its [releases](https://github.com/wp-cli/wp-cli/releases), [Runner.php](https://github.com/wp-cli/wp-cli/blob/main/php/WP_CLI/Runner.php), [Installing](https://make.wordpress.org/cli/handbook/guides/installing/), [Running commands remotely](https://make.wordpress.org/cli/handbook/guides/running-commands-remotely/), [wp-cli.org](https://wp-cli.org/)
- Claude Code: [MCP](https://code.claude.com/docs/en/mcp), [Permissions](https://code.claude.com/docs/en/permissions)
- MCP spec: [modelcontextprotocol.io/specification](https://modelcontextprotocol.io/specification/)
