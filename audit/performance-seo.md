# Core Web Vitals & Performance Audit — maxxbuilders.com
**Date:** 2026-06-24
**Tool:** Lighthouse 13.0.3 (lab, mobile simulation) + PowerShell header inspection
**URL:** https://www.maxxbuilders.com
**Platform:** WordPress / Elementor / Wilmer theme

---

## Summary Verdict

**Lighthouse Performance Score: 69 / 100**

The site fails its primary CWV metric (LCP) by a factor of 3x. CLS and TBT are clean. The bottleneck is almost entirely a single uncompressed hero JPEG combined with 43+ render-blocking CSS files. Fixes are high-leverage and largely plugin-config-level on WordPress.

---

## Core Web Vitals (Lab — Lighthouse Mobile)

| Metric | Measured | Threshold | Status |
|--------|----------|-----------|--------|
| LCP | **8,296 ms** | ≤ 2,500 ms | **FAIL** |
| CLS | **0** | ≤ 0.1 | PASS |
| TBT (INP proxy) | **17 ms** | ≤ 200 ms INP | PASS |
| FCP | 3,196 ms | ≤ 1,800 ms good | Needs improvement |
| TTFB (Lighthouse) | 22 ms | ≤ 800 ms | PASS |
| Speed Index | 3,200 ms | ≤ 3,400 ms | PASS |
| Time to Interactive | 8,300 ms | ≤ 3,800 ms | FAIL |

> Note: Lab TTFB (22 ms, localhost Chrome to origin) differs from the PowerShell measurement (2,629 ms wall-clock) because Lighthouse simulates a cached warm connection. The PowerShell number is a better indicator of real first-byte latency from a cold network.

---

## Issue Breakdown (Priority Order)

### 1. LCP — 715 KB Uncompressed Hero JPEG [CRITICAL]

**Impact: estimated 4–6 s LCP savings**

The LCP element identified by Lighthouse is the mobile logo PNG (`Maxx-Builders-Horizontal-Logo.png`, 1000x232px rendered at 528x123px). However the dominant network cost is the hero section background image:

- `h1-img-06-maxxbuilders.jpg` — **715,185 bytes (699 KB) served as plain JPEG with no compression header**
- The page's total image payload is 761 KB across only 4 loaded images, so this single file is 94% of all image weight.
- No `Content-Encoding: gzip` or `br` header is present on any response — the server (nginx) is not compressing HTML or CSS either.

The logo flagged by Lighthouse as LCP (`Maxx-Builders-Horizontal-Logo.png`, 25 KB) is oversized: served at 1000x232 but displayed at 528x123. Lighthouse estimates 18 KB wasted.

**Fix:**
- Convert `h1-img-06-maxxbuilders.jpg` to WebP at 80% quality; target ≤ 120 KB. Add an AVIF variant via `<picture>` for supporting browsers.
- Add `fetchpriority="high"` to whichever `<img>` tag resolves as LCP on desktop (currently it is missing — Lighthouse flagged `priorityHinted: false`).
- Resize the logo PNG to 528x123 (2x = 1056x246 for retina) before re-exporting as WebP.
- Enable nginx gzip for `text/html`, `text/css`, `application/javascript`, and `image/svg+xml`. The 84 KB HTML document is served uncompressed.

---

### 2. 43 Render-Blocking CSS Files [HIGH]

**Impact: estimated 1,150 ms FCP savings**

Lighthouse identified 43 stylesheets in the critical path, including:

| File | Size | Blocking Time |
|------|------|---------------|
| `wilmer/assets/css/modules.min.css` | 100 KB | 450 ms |
| `qi-addons-for-elementor/assets/css/main.min.css` | 32 KB | 450 ms |
| `dashicons.min.css` | 36 KB | 450 ms |
| `fontawesome-all.min.css` | 8.8 KB | 150 ms |
| `qi-blocks/assets/dist/main.css` | 5.5 KB | 150 ms |
| `wilmer/assets/css/style_dynamic.css` | 4.6 KB | 150 ms |
| + 37 more icon packs, widget CSS, plugin CSS | — | — |

The 36 KB `dashicons.min.css` is an admin-only icon font. It has no business loading on the public frontend.

Icon pack proliferation is extreme: 7 separate icon font stylesheets are loaded (Font Awesome, Elegant Icons, Ion Icons, Simple Line Icons, Linear Icons, Linea Icons, Dripicons). Each is render-blocking. Most icons on the page likely come from one or two of these.

**Fix:**
- Use W3 Total Cache / WP Rocket "combine + defer" CSS option to reduce ~43 CSS requests to 2–3 combined files, loaded asynchronously where possible.
- Remove `dashicons` from the frontend: `add_action('wp_enqueue_scripts', function(){ wp_deregister_style('dashicons'); });` in child theme.
- Audit which icon pack is actually in use; dequeue the other 5–6 via `wp_dequeue_style()`.
- Extract critical above-the-fold CSS (~8–15 KB) and inline it in `<head>`; defer the rest.

---

### 3. No CDN / Missing Compression [HIGH]

**Impact: 40–60% reduction in TTFB and payload size**

Response headers show:
- `Server: nginx` (bare origin server, Texas region assumed)
- `X-Cache: HIT` — an intermediate cache layer exists (likely a Kinsta/WP Engine host cache), but it is serving uncompressed content
- No `CF-Ray`, `X-Cloudflare`, or similar CDN headers — Cloudflare is not in front of this site
- No `Content-Encoding` header — gzip/Brotli is disabled
- `Cache-Control: max-age=0` with `Expires` in the past — HTML is not browser-cached
- No `ETag` header

The wall-clock TTFB from PowerShell (not a simulated network) was **2,629 ms** for the full HTML response. Even accounting for the uncompressed 84 KB HTML, a 2.6 s wait strongly suggests the server is doing dynamic PHP processing on every request rather than serving a static HTML cache.

**Fix:**
- Enable a WordPress page cache (WP Rocket, W3 Total Cache, or Kinsta's built-in). This alone typically drops TTFB from 2,000+ ms to < 200 ms.
- Enable nginx gzip at the server level, or configure it via the host panel.
- Place Cloudflare (free tier sufficient) in front of the origin for global CDN and automatic Brotli compression.
- Set `Cache-Control: public, max-age=86400` on static assets (images, fonts, CSS, JS).

---

### 4. Total Page Weight: 1,363 KB [MEDIUM]

**Breakdown by resource type:**

| Type | Requests | Transfer Size |
|------|----------|---------------|
| Images | 4 | 761 KB |
| Stylesheets | 45 | 282 KB |
| Fonts | 11 | 250 KB |
| Document (HTML) | 1 | 82 KB |
| Scripts | 1 | 3 KB |
| Third-party | 5 | 67 KB |

Font loading is excessive at 250 KB across 11 font files. Four Yantramanav weight variants are loaded from Google Fonts CDN (external, adding latency), plus Roboto, Poppins, ElegantIcons (.woff), Font Awesome Solid (.woff2), plus local Elementor copies. The site has self-hosted the Google Fonts CSS but is still fetching the `.woff2` binary files from `fonts.gstatic.com`.

**Fix:**
- Self-host all font binaries (use `google-webfonts-helper`). This removes the 5 external DNS lookups to Google Fonts.
- Subset fonts to Latin only; reduce weight variants. Most contractor pages use 2–3 weights maximum.
- Combine Roboto and Poppins into one font stack if visual difference is negligible.

---

### 5. Main Thread Work: 5.5 s [MEDIUM]

**Breakdown:**

| Category | Time |
|----------|------|
| Other | 2,003 ms |
| Style & Layout | 1,998 ms |
| Rendering | 741 ms |
| Parse HTML & CSS | 356 ms |
| Script Evaluation | 340 ms |
| Script Parsing & Compilation | 36 ms |

The nearly 2 s in Style & Layout is consistent with the 43 CSS files being parsed and the 1,670-element DOM being reflowed. The page source has **94 `<script>` tags and 46 `<link rel="stylesheet">` tags** — this is an Elementor/plugin bloat pattern.

Long tasks identified by Lighthouse: 13 tasks over 50 ms, with the three largest at 305 ms, 273 ms, and 211 ms — all attributed to the document itself (inline scripts + CSS recalculations), not external scripts.

TBT is 17 ms (excellent) because Lighthouse's throttled timeline happens to avoid the worst tasks during the measurement window. Real-device INP could be higher if users interact during page load when these layout tasks are running.

**Fix:**
- Enable Elementor's "Improved Asset Loading" experiment (loads only widget CSS/JS used on each page instead of all globally).
- Move non-critical JS to `defer` or `type="module"`.
- Consider replacing RevSlider (loaded but confirmed present in script list) with a lightweight CSS-only hero if the slider is the sole use case.

---

### 6. LCP Element Missing fetchpriority [MEDIUM]

The LCP element (mobile logo PNG, as identified by Lighthouse in mobile simulation) does not have `fetchpriority="high"`. A separate image in the HTML does carry `fetchpriority="high"` (the white logo), but that is not the element Lighthouse resolves as LCP on mobile.

The actual hero background at `h1-img-06-maxxbuilders.jpg` appears to be a CSS background-image rather than an `<img>` tag — this makes it completely invisible to the browser's preload scanner, meaning it is discovered late in the render pipeline.

**Fix:**
- If the hero is a CSS `background-image`, convert it to an `<img>` tag with `fetchpriority="high"` and `loading="eager"` inside the hero section, sized responsively with `srcset`. This alone is often worth 1–2 s on LCP.
- Alternatively, add a `<link rel="preload" as="image" href="..." fetchpriority="high">` in `<head>` for the hero image.

---

### 7. LeadConnector / HighLevel Widget [LOW]

The page loads `https://widgets.leadconnectorhq.com/loader.js` (a CRM chat/form widget). This is a third-party script with no `defer` or `async` attribute in the source. If it falls inside `<head>`, it is render-blocking.

**Fix:**
- Add `defer` to the LeadConnector script tag, or load it on user interaction (click/scroll trigger) using a facade pattern.

---

## Infrastructure Observations

| Check | Result |
|-------|--------|
| CDN detected | No (bare nginx, possible host cache layer) |
| Gzip/Brotli compression | Not enabled |
| Cache-Control on HTML | `max-age=0` (no browser cache) |
| Cache-Control on assets | `max-age=0` (no browser cache) |
| ETag | Not present |
| HTTP/2 | Likely yes (nginx + `Age` header present) |
| WordPress page cache | Not active (2.6 s TTFB) |
| Image CDN / WebP serving | Partial (some WebP in srcsets, hero is JPEG) |
| AVIF | Not in use |

---

## Prioritized Fix Order

Fix in this sequence — each unblocks the next:

1. **Enable WordPress page cache** (WP Rocket or host-native). Fixes TTFB, which improves every metric.
2. **Enable gzip on nginx** (or activate at host level). Immediate 60–70% reduction in HTML + CSS transfer size.
3. **Convert hero image to WebP, add preload + fetchpriority="high"**. Directly attacks the 8.3 s LCP.
4. **Dequeue unused icon packs and dashicons from frontend**. Reduces render-blocking CSS count from 43 to ~35 immediately.
5. **Enable Elementor improved asset loading**. Reduces remaining CSS/JS to only what each page needs.
6. **Self-host Google Fonts binaries, subset to Latin**. Eliminates 5 external DNS lookups and reduces font payload.
7. **Defer LeadConnector and RevSlider scripts**. Cleans up the remaining render-blocking JS.

Completing steps 1–3 alone should move LCP from 8.3 s to approximately 2.5–3.5 s (lab). Adding steps 4–5 should reach the ≤ 2.5 s threshold.

---

## Files

- Raw Lighthouse JSON: `audit/lighthouse-home.json`
