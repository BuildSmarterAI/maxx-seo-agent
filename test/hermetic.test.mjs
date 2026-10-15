// test/hermetic.test.mjs — the suite must never reach a real Supabase/WordPress/Webflow
// service, even when it is run from a shell that has the real credentials loaded
// (e.g. `node --env-file=.env --test`). The per-file `process.env.X ||= "dummy"` lines
// keep any real value already present, so the guarantee comes from the preload
// (scripts/lib/hermetic-guard.mjs, wired in via `npm test`): it overwrites the service
// credentials with dummies and makes any non-loopback fetch reject.
//
// Run: npm test   (a bare `node --test` skips the preload, and this file fails loudly)
import { test } from "node:test";
import assert from "node:assert/strict";

test("service credentials are forced to dummy values, whatever the parent shell holds", () => {
  assert.equal(process.env.SUPABASE_URL, "https://hermetic.invalid");
  assert.equal(process.env.SUPABASE_SERVICE_ROLE_KEY, "hermetic_dummy_service_role_key");
  assert.equal(process.env.WP_BASE_URL, "https://hermetic.invalid");
  assert.equal(process.env.WP_APP_PASSWORD, "hermetic_dummy");
});

test("an un-mocked fetch to a remote host rejects before any network I/O", async () => {
  await assert.rejects(() => fetch("https://example.supabase.co/rest/v1/change_set"), /hermetic/);
  await assert.rejects(() => fetch(new URL("https://www.maxxbuilders.com/wp-json/")), /hermetic/);
});

test("node:http/https requests to a remote host are blocked too (gaxios/googleapis use node-fetch, not global fetch)", async () => {
  const https = await import("node:https");
  const http = await import("node:http");
  assert.throws(() => https.get("https://searchconsole.googleapis.com/"), /hermetic/);
  assert.throws(() => https.request({ hostname: "oauth2.googleapis.com", path: "/token" }), /hermetic/);
  assert.throws(() => http.get("http://169.254.169.254/computeMetadata/v1/"), /hermetic/);
});

test("node:http/https guard checks the EFFECTIVE host: options.hostname overrides the URL", async () => {
  const https = await import("node:https");
  const http = await import("node:http");
  // A loopback URL must not launder a remote options.hostname past the guard.
  for (const [mod, url] of [[https, "https://localhost/"], [http, "http://localhost/"]]) {
    for (const fn of ["request", "get"]) {
      assert.throws(() => mod[fn](url, { hostname: "example.com" }),
        (e) => /hermetic test guard: blocked/.test(e.message) && /example\.com/.test(e.message),
        `${fn}(${url}, {hostname: example.com}) must be blocked`);
    }
  }
  // ...and the reverse: a remote URL overridden to loopback is not blocked by the guard.
  for (const [mod, url] of [[https, "https://example.com/"], [http, "http://example.com/"]]) {
    for (const fn of ["request", "get"]) {
      let req;
      assert.doesNotThrow(() => { req = mod[fn](url, { hostname: "localhost", port: 1 }); },
        `${fn}(${url}, {hostname: localhost}) must not be blocked`);
      req.on("error", () => {});   // ECONNREFUSED/abort from the loopback attempt is expected
      req.destroy();
    }
  }
});

test("Google credentials point at a non-existent file, so google-auth fails locally", () => {
  assert.equal(process.env.GOOGLE_APPLICATION_CREDENTIALS, "hermetic-no-such-gcp.json");
});

test("spawned node subprocesses inherit the guard via NODE_OPTIONS", async () => {
  const { spawnSync } = await import("node:child_process");
  const r = spawnSync(process.execPath, ["-e",
    "fetch('https://example.supabase.co/').then(()=>console.log('REACHED'),e=>console.log(String(e.message)))"],
    { encoding: "utf8", timeout: 30000 });
  assert.match(r.stdout, /hermetic/);
});

test("the Supabase client goes through the guarded fetch", async () => {
  const { db } = await import("../orchestrator/lib/client.mjs");
  const { error } = await db.from("change_set").select("id").limit(1);
  assert.match(String(error?.message ?? ""), /hermetic/);
});
