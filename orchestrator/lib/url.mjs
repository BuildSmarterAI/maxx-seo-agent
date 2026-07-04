// url.mjs — URL canonicalization for the do_not_touch protection boundary.
//
// Pure: no imports, no side effects, no env — so it is unit-testable without Supabase.
// Every place that decides "is this URL protected?" must compare canonical forms on BOTH
// sides. Comparing raw strings (the pre-fix bug, Panel-A A1/A2) let a stored
// `https://www.host.com/legal/` slip past a candidate `https://host.com/legal`.
//
// Canonical form is scheme-, www-, query-, hash- and trailing-slash-agnostic: protection
// is a property of the page, not of how a given link happens to spell its URL. We err
// toward MORE matching (over-protect) — a wrongly-skipped page costs one run; a wrongly
// edited counsel-owned page is the failure this boundary exists to prevent.

// Strip trailing slash(es) but keep a lone root "/".
function stripTrailingSlash(s) {
  return s.length > 1 ? s.replace(/\/+$/, "") : s;
}

// Key from a parsed URL: host (lowercased, leading `www.` dropped) + path (lowercased,
// trailing slash stripped). Path is lowercased too — WordPress (this project's platform)
// serves lowercase canonical slugs, and the boundary errs toward matching (over-protect).
function keyFromUrl(u) {
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  return host + stripTrailingSlash(u.pathname.toLowerCase());
}

// Reduce a URL to a stable key. Scheme, port, query and hash are dropped. do_not_touch.url
// is hand-maintained free text, so a scheme-less but host-bearing entry ("www.host.com/legal")
// MUST canonicalize to the same key as its absolute form — otherwise protection silently
// misses (the very bypass this boundary exists to prevent). A true path-only value ("/legal/")
// falls back to a case- and trailing-slash-normalized copy so raw path-only sets still match.
export function canonicalizeUrl(raw) {
  if (typeof raw !== "string") return "";
  const s = raw.trim();
  if (!s) return "";
  try {
    return keyFromUrl(new URL(s));
  } catch {
    // Scheme-less host+path (no leading slash, a dot before the first slash) → retry absolute.
    if (!s.startsWith("/") && /^[^/\s]+\.[^/\s]+/.test(s)) {
      try { return keyFromUrl(new URL("https://" + s)); } catch { /* fall through */ }
    }
    return stripTrailingSlash(s.toLowerCase());
  }
}

// Build a Set of canonical forms from stored do_not_touch urls. Empties are dropped so a
// malformed row can't collapse to "" and accidentally protect everything.
export function canonicalizeSet(urls) {
  const out = new Set();
  for (const u of urls ?? []) {
    const c = canonicalizeUrl(u);
    if (c) out.add(c);
  }
  return out;
}

// Membership test that canonicalizes the lookup key. `protectedSet` is expected to already
// hold canonical forms (via canonicalizeSet / doNotTouch); a raw path-only set also works
// because canonicalizeUrl is idempotent on already-canonical values.
export function isProtected(protectedSet, url) {
  if (!protectedSet || protectedSet.size === 0) return false;
  const key = canonicalizeUrl(url);
  return key !== "" && protectedSet.has(key);
}
