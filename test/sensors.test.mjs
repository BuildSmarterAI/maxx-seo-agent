// test/sensors.test.mjs — sensor URL hygiene:
//   - sitemap recursion drops .xml entries (the sitemap-audit noise fix)
//   - GSC decay skips the homepage (the homepage-as-blog-write fix)
// Both sensors guard their auto-run, so importing them here does not execute.
//
// Run: node --test
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.SUPABASE_URL ||= "https://x.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "dummy_service_role_key_000000";

const { collectPageUrls } = await import("../scripts/sensor-sitemap.mjs");
const { isHomepage } = await import("../scripts/sensor-gsc.mjs");

test("collectPageUrls recurses a sitemap index and drops .xml entries", async () => {
  const index = "<sitemapindex><sitemap><loc>https://x.com/post-sitemap.xml</loc></sitemap>" +
                "<sitemap><loc>https://x.com/page-sitemap.xml</loc></sitemap></sitemapindex>";
  const post = "<urlset><url><loc>https://x.com/a/</loc></url><url><loc>https://x.com/b/</loc></url></urlset>";
  const page = "<urlset><url><loc>https://x.com/c/</loc></url></urlset>";
  const fake = (u) => Promise.resolve(u.includes("post-sitemap") ? post : u.includes("page-sitemap") ? page : index);

  const pages = await collectPageUrls("https://x.com/sitemap.xml", fake);
  assert.deepEqual(pages.sort(), ["https://x.com/a/", "https://x.com/b/", "https://x.com/c/"]);
  assert.ok(!pages.some((u) => /\.xml/.test(u)), "no .xml urls survive");
});

test("collectPageUrls handles a flat sitemap (no index)", async () => {
  const flat = "<urlset><url><loc>https://x.com/a/</loc></url></urlset>";
  const pages = await collectPageUrls("https://x.com/sitemap.xml", () => Promise.resolve(flat));
  assert.deepEqual(pages, ["https://x.com/a/"]);
});

test("collectPageUrls dedupes urls seen across child sitemaps", async () => {
  const index = "<sitemapindex><sitemap><loc>https://x.com/s1.xml</loc></sitemap>" +
                "<sitemap><loc>https://x.com/s2.xml</loc></sitemap></sitemapindex>";
  const dup = "<urlset><url><loc>https://x.com/a/</loc></url></urlset>";
  const pages = await collectPageUrls("https://x.com/sitemap.xml", (u) => Promise.resolve(u.endsWith(".xml") && !u.includes("sitemap.xml") ? dup : index));
  assert.deepEqual(pages, ["https://x.com/a/"]);
});

// A13: onEnqueued now owns committing sitemap_seen state, called by the harness only after
// a successful enqueue (see test/sensor.test.mjs for the ordering guarantee itself, tested
// against a fake sensor). markSitemapSeen([]) short-circuits before touching the network, so
// this one is directly testable without a DB mock.
test("sitemapSensor.onEnqueued is a network-free no-op for an empty rawItems list", async () => {
  const { sitemapSensor } = await import("../scripts/sensor-sitemap.mjs");
  assert.equal(typeof sitemapSensor.onEnqueued, "function");
  await assert.doesNotReject(() => sitemapSensor.onEnqueued([]));
});

// ---- SSRF hardening (A10): a child <loc> entry is attacker-influenced content living
// inside the fetched XML — it must never be followed off-host or off-scheme. ----
test("collectPageUrls refuses a child sitemap on a different host (cross-host SSRF)", async () => {
  const index = "<sitemapindex><sitemap><loc>http://169.254.169.254/latest/meta-data/.xml</loc></sitemap>" +
                "<sitemap><loc>https://x.com/page-sitemap.xml</loc></sitemap></sitemapindex>";
  const page = "<urlset><url><loc>https://x.com/c/</loc></url></urlset>";
  let metadataFetched = false;
  const fake = (u) => {
    if (u.includes("169.254.169.254")) { metadataFetched = true; return Promise.resolve("<urlset></urlset>"); }
    return Promise.resolve(u.includes("page-sitemap") ? page : index);
  };
  const pages = await collectPageUrls("https://x.com/sitemap.xml", fake);
  assert.equal(metadataFetched, false, "the off-host child must never be fetched");
  assert.deepEqual(pages, ["https://x.com/c/"]);
});

test("collectPageUrls refuses a child sitemap on a non-http(s) scheme", async () => {
  const index = "<sitemapindex><sitemap><loc>file:///etc/passwd.xml</loc></sitemap>" +
                "<sitemap><loc>https://x.com/page-sitemap.xml</loc></sitemap></sitemapindex>";
  const page = "<urlset><url><loc>https://x.com/c/</loc></url></urlset>";
  let fileFetched = false;
  const fake = (u) => {
    if (u.startsWith("file://")) { fileFetched = true; return Promise.resolve("<urlset></urlset>"); }
    return Promise.resolve(u.includes("page-sitemap") ? page : index);
  };
  const pages = await collectPageUrls("https://x.com/sitemap.xml", fake);
  assert.equal(fileFetched, false, "a non-http(s) child scheme must never be fetched");
  assert.deepEqual(pages, ["https://x.com/c/"]);
});

test("collectPageUrls allows a same-host child sitemap regardless of scheme casing/port", async () => {
  const index = "<sitemapindex><sitemap><loc>https://x.com:443/page-sitemap.xml</loc></sitemap></sitemapindex>";
  const page = "<urlset><url><loc>https://x.com/c/</loc></url></urlset>";
  const fake = (u) => Promise.resolve(u.includes("page-sitemap") ? page : index);
  const pages = await collectPageUrls("https://x.com/sitemap.xml", fake);
  assert.deepEqual(pages, ["https://x.com/c/"]);
});

// The isSafeChildSitemapUrl allowlist only inspects the pre-fetch URL string — fetch()
// follows redirects by default, so a same-host URL that 302s to an off-host/internal
// target would defeat the guard entirely unless the real fetcher refuses to follow
// redirects on child fetches. This can't be exercised through the injectable fetchText
// (that's precisely what makes the recursion network-free/testable) — it's a property of
// collectPageUrls' DEFAULT fetcher, so verify it the same way test/apply.test.mjs verifies
// real adapter I/O: mock the global fetch and inspect what options are actually passed.
test("default fetcher refuses to follow redirects on child sitemap fetches (redirect-bypass hardening)", async () => {
  const realFetch = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (url, init = {}) => {
    seen.push({ url, redirect: init.redirect });
    if (url.includes("child-sitemap")) {
      return { text: async () => "<urlset><url><loc>https://x.com/c/</loc></url></urlset>" };
    }
    return { text: async () => "<sitemapindex><sitemap><loc>https://x.com/child-sitemap.xml</loc></sitemap></sitemapindex>" };
  };
  try {
    const pages = await collectPageUrls("https://x.com/sitemap.xml");
    assert.deepEqual(pages, ["https://x.com/c/"]);
    const rootCall = seen.find((s) => s.url === "https://x.com/sitemap.xml");
    const childCall = seen.find((s) => s.url.includes("child-sitemap"));
    assert.equal(rootCall.redirect, undefined, "root fetch (trusted operator SITEMAP_URL) still allows redirects");
    assert.equal(childCall.redirect, "error", "child fetch must refuse to follow a redirect, not silently trust it");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("isHomepage is true only for the site root path", () => {
  assert.equal(isHomepage("https://www.maxxbuilders.com/"), true);
  assert.equal(isHomepage("http://www.maxxbuilders.com/"), true);
  assert.equal(isHomepage("https://www.maxxbuilders.com/services/"), false);
  assert.equal(isHomepage("https://www.maxxbuilders.com/about/our-history/"), false);
});
