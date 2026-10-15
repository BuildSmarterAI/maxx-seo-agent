// hermetic-guard.mjs — test-only preload (`node --import ./scripts/lib/hermetic-guard.mjs
// --test`, wired into `npm test`). Keeps the suite from ever reaching a live service:
//
// 1. Overwrites the service credentials with dummies. Test files seed them with `||=`,
//    which keeps a REAL value already in the environment, e.g. when the suite is run with
//    `node --env-file=.env --test` or from a shell that exported production credentials.
// 2. Replaces global fetch with a guard that rejects any non-loopback request. Supabase
//    (supabase-js resolves the global fetch per call) and the WordPress/Webflow packs all
//    go through global fetch, so an un-mocked call fails fast instead of going out.
//    Tests that mock fetch assign globalThis.fetch and restore the saved value, which is
//    this guard, so their mocks are unaffected. Loopback requests are passed through with
//    redirect: "error", so a loopback redirect cannot carry the request to a remote host.
// 3. Blocks non-loopback node:http/https requests. googleapis (gaxios → node-fetch) and
//    other non-fetch clients go through these modules, not global fetch. Google
//    credentials point at a file that does not exist, so google-auth fails locally
//    before it reaches for the metadata server.
// 4. Exports itself through NODE_OPTIONS so node subprocesses spawned by tests (CLI
//    tests via spawnSync) get the same guard, not just the dummy env.
//
// Lives outside test/ because node:test treats every file under test/ as a test file.
import http from "node:http";
import https from "node:https";
import { syncBuiltinESMExports } from "node:module";

const DUMMY = {
  SUPABASE_URL: "https://hermetic.invalid",
  SUPABASE_SERVICE_ROLE_KEY: "hermetic_dummy_service_role_key",
  WP_BASE_URL: "https://hermetic.invalid",
  WP_USER: "hermetic_dummy",
  WP_APP_PASSWORD: "hermetic_dummy",
  WEBFLOW_TOKEN: "hermetic_dummy",
  WEBFLOW_API_TOKEN: "hermetic_dummy",
  GOOGLE_APPLICATION_CREDENTIALS: "hermetic-no-such-gcp.json",
};
Object.assign(process.env, DUMMY);

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
const blocked = (where) =>
  new Error(`hermetic test guard: blocked network request to ${where} (mock it in this test)`);

const realFetch = globalThis.fetch;
globalThis.fetch = async function hermeticFetch(input, init) {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  // redirect: "error" — a loopback server must not be able to bounce the request to a
  // remote host (Undici follows redirects internally, past this guard).
  if (LOOPBACK.has(url.hostname)) return realFetch(input, { ...init, redirect: "error" });
  throw blocked(url.origin);
};

// request/get accept (url[, options][, cb]) or (options[, cb]). Resolve the EFFECTIVE
// destination the way node does: a url is turned into options and then overlaid by an
// options object (so `("https://localhost/", { hostname: "example.com" })` goes to
// example.com), and hostname wins over host. Defaults to node's own "localhost".
function hostOf([a0, a1]) {
  let opts = {};
  if (typeof a0 === "string" || a0 instanceof URL) {
    const u = new URL(a0);
    opts = { hostname: u.hostname.replace(/^\[(.*)\]$/, "$1"), host: u.host };
    if (a1 && typeof a1 === "object") opts = { ...opts, ...a1 };
  } else if (a0 && typeof a0 === "object") {
    opts = a0;
  }
  if (opts.hostname) return String(opts.hostname);
  if (opts.host) return String(opts.host).replace(/:\d+$/, "");
  return "localhost";
}
for (const mod of [http, https]) {
  for (const fn of ["request", "get"]) {
    const real = mod[fn];
    mod[fn] = function hermeticRequest(...args) {
      const host = hostOf(args);
      if (!LOOPBACK.has(host)) throw blocked(host);
      return real.apply(this, args);
    };
  }
}
// Push the patched functions into the `import { get } from "node:https"` bindings too.
syncBuiltinESMExports();

const self = `--import=${new URL(import.meta.url).href}`;
if (!(process.env.NODE_OPTIONS ?? "").includes(self)) {
  process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS ?? ""} ${self}`.trim();
}
