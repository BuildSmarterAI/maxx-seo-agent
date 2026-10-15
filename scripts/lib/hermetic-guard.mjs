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
//    this guard, so their mocks are unaffected.
//
// Lives outside test/ because node:test treats every file under test/ as a test file.
const DUMMY = {
  SUPABASE_URL: "https://hermetic.invalid",
  SUPABASE_SERVICE_ROLE_KEY: "hermetic_dummy_service_role_key",
  WP_BASE_URL: "https://hermetic.invalid",
  WP_USER: "hermetic_dummy",
  WP_APP_PASSWORD: "hermetic_dummy",
  WEBFLOW_TOKEN: "hermetic_dummy",
  WEBFLOW_API_TOKEN: "hermetic_dummy",
};
Object.assign(process.env, DUMMY);

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);
const realFetch = globalThis.fetch;

globalThis.fetch = async function hermeticFetch(input, init) {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  if (LOOPBACK.has(url.hostname)) return realFetch(input, init);
  throw new Error(`hermetic test guard: blocked network request to ${url.origin} (mock fetch in this test)`);
};
