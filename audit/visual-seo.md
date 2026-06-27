# Visual & Mobile SEO Audit — maxxbuilders.com
**Captured:** 2026-06-24  
**Tool:** Playwright 1.58 / Chromium (headless)  
**Viewports:** Desktop 1440x900, Mobile 390x844 (iPhone UA)

---

## Page Status Summary

| Page | URL | HTTP Status |
|------|-----|-------------|
| Homepage | / | 200 |
| Services | /services/ | 200 |
| Houston Commercial Contractors | /houston-commercial-contractors/ | 200 |
| Get A Quote | /get-a-quote/ | **404** |

---

## Page-by-Page Analysis

### 1. Homepage (`/`)

**Desktop — above the fold**
- H1 "Texas Commercial General Contractors" is visible, bold, white on dark hero.
- "Get A Quote" red CTA button is visible and prominent below the H1.
- Value proposition tagline ("Setting the Standard for Commercial Construction Excellence") renders below the H1, also above fold.
- The sticky top bar carries phone, email, and hours — useful trust signals but add visual weight.
- **Critical layout issue:** the hero background image is not loading in headless capture — the hero area renders as a flat dark/charcoal block instead of a photo. This is likely a CSS background-image using a lazy mechanism or a JS-driven slider that did not fire within the networkidle window. If real users see the same degraded fallback, the LCP element drops from a rich photo to the logo (262x70px), which is very small and pushes the LCP score up significantly.
- The nav is sticky but not yet visible in the hero — the logo renders only at the top of the page in the top utility bar area; the primary nav appears off the top of the rendered screenshot, suggesting the nav may scroll out or a sticky re-render did not complete.

**Mobile — above the fold**
- Logo, hamburger menu (red button, tap target clearly large), H1, tagline, and "Get A Quote" CTA are all above the fold. Excellent hierarchy.
- No horizontal scroll detected.
- Base font: 18px — above the 16px minimum.
- Viewport meta: `width=device-width,initial-scale=1,user-scalable=yes` — correctly set, zooming not blocked.
- LCP candidate is the mobile logo (302x70px). Same concern as desktop: background hero photo is not loading — LCP element is a logo image, not the intended hero photo.

**Issues:**
| Severity | Issue |
|----------|-------|
| HIGH | Hero background image not rendering (likely JS/lazy-load dependent). LCP element falls back to the logo (small). Real LCP for photo-based heros should be measured in CrUX field data, not just synthetically. |
| MEDIUM | Desktop nav is hidden in the screenshot — the primary navigation links ("About", "Industries", "Services") appear in the extracted DOM at y=111 but the nav block itself is not visible in the above-fold screenshot, suggesting the sticky nav did not paint before screenshot was taken or the top bar is consuming the nav's space. |
| LOW | Title is 61 chars — one character over the 60-char threshold. Consider tightening. |

---

### 2. Services (`/services/`)

**Desktop — above the fold**
- Hero shows a dark background with large outline text "BUILD SMARTER" and a supporting tagline. No H1 visible — the H1 ("Our Services") is not painted above the fold on desktop.
- No CTA button is visible above the fold on desktop. The first CTA ("Read More" on a service card) only appears below the fold.
- The actual service content ("Construction Management") appears at the very bottom edge of the 900px viewport, partially cut off.
- LCP candidate detected as the white logo image (250x58px) — same hero background paint problem as homepage.

**Mobile — above the fold**
- Hero renders with an actual construction photo (390x260px) — the mobile background image IS loading, unlike desktop.
- The page title/H1 is NOT above the fold on mobile — the user sees the hero photo, a tagline, and then must scroll to reach the service headings.
- The "Read More" CTA for Construction Management is just barely visible at the very bottom edge (y=824 in an 844px viewport) — a marginal pass.
- No primary CTA (quote request or contact) is visible above the fold on mobile.

**Issues:**
| Severity | Issue |
|----------|-------|
| HIGH | No CTA above the fold on desktop. The entire above-fold area is decorative (outline text + tagline). A visitor has to scroll before seeing any actionable button. |
| HIGH | H1 "Our Services" is not above the fold on desktop. The visible headline "BUILD SMARTER" is decorative outline text, not an H1. This is a missed opportunity for keyword relevance above the fold. |
| MEDIUM | No quote/contact CTA above the fold on mobile either. The only CTA is a service-specific "Read More" at the bottom edge. |
| LOW | Meta description at 126 chars — fine, but could include a stronger action phrase. |

---

### 3. Houston Commercial Contractors (`/houston-commercial-contractors/`)

**Desktop — above the fold**
- H1 "Houston Commercial General Contractors" is large, white, prominent in the hero — excellent.
- Supporting tagline "Maxx Builders – Your Premier Commercial Construction Company in Texas" renders below the H1.
- However, there is zero CTA above the fold on desktop. The hero is purely informational with no button.
- The large decorative "MAXX BUILDERS" outline watermark text overlaps the H1 slightly — visually busy but not a readability blocker.
- Desktop LCP candidate: Houston skyline photo (650x433px) — this IS a real image loading. Good. This is the strongest LCP candidate of all pages reviewed.

**Mobile — above the fold**
- H1 "Houston Commercial General Contractors" is visible immediately, above the fold — excellent.
- Tagline visible below H1.
- Body copy ("At Maxx Builders, we are thrilled to be part of Houston's vibrant...") begins rendering above the fold as well.
- Zero CTAs detected above the fold. No "Get A Quote" or contact button visible without scrolling.
- The LCP element is a generic blog banner image (390x260px, alt: "Architect reviewing floor plan blueprints with pencil and laptop at desk") — this is not the Houston skyline photo; a different, less relevant image is being served as the mobile hero. That alt text describes an interior office scene, not Houston commercial construction.

**Issues:**
| Severity | Issue |
|----------|-------|
| HIGH | No CTA above the fold on either desktop or mobile. This is a high-intent local landing page — no conversion mechanism is visible until the visitor scrolls. |
| MEDIUM | Mobile hero image mismatch: desktop shows the Houston skyline (relevant, geo-specific). Mobile shows a generic blueprints/laptop image. Weak visual alignment with local intent on mobile. |
| MEDIUM | Meta description is 157 chars — 2 chars over the 155-char threshold. Will likely be truncated in SERPs. |
| LOW | The H1 uses "Houston Commercial General Contractors" — strong keyword alignment. |

---

### 4. Get A Quote (`/get-a-quote/`) — 404 CONFIRMED

**Both desktop and mobile return HTTP 404.**

**Desktop:**
- Styled 404 page: "ERROR 404 / Page not found"
- Cookie consent banner overlays the bottom of the screen.
- Nav header shows a "Get A Quote" button pointing to `/get-a-quote/` — a recursive dead link.
- No canonical tag on the 404 page.
- No meta description on the 404 page.

**Mobile:**
- Same 404 styling — "Page not found" with "Back to home" CTA.
- Clean, readable at mobile viewport.
- Logo loading has `loading="lazy"` on the 404 page (but not on other pages) — anomaly, possibly a different template.

**Issues:**
| Severity | Issue |
|----------|-------|
| CRITICAL | `/get-a-quote/` returns 404. The primary CTA on the homepage links to a broken page. Every visitor who clicks "Get A Quote" on the homepage hits a dead end. This is the highest-priority fix on the site. |
| CRITICAL | The nav "Get A Quote" button in the header (visible on the 404 page itself) also links to `/get-a-quote/` — the header CTA is site-wide, meaning every page on the site has a broken primary CTA in the nav. |
| HIGH | The correct quote page URL appears to be `/commercial-construction-project-inquiry/` (referenced in the top utility bar hours link). A 301 redirect from `/get-a-quote/` → `/commercial-construction-project-inquiry/` should be added immediately, AND the nav button href should be corrected. |
| LOW | 404 page has no canonical and no meta description — standard, acceptable. |

---

## Meta Viewport Tag — All Pages

| Page | Viewport Meta | Zoom Blocked? |
|------|--------------|---------------|
| Homepage | `width=device-width,initial-scale=1,user-scalable=yes` | No |
| Services | `width=device-width,initial-scale=1,user-scalable=yes` | No |
| Houston Contractors | `width=device-width,initial-scale=1,user-scalable=yes` | No |
| Get A Quote (404) | `width=device-width,initial-scale=1,user-scalable=yes` | No |

All pages correctly set the viewport meta tag. User scaling is explicitly allowed (`user-scalable=yes`), which is the correct and accessible setting.

---

## Font Size — Mobile

| Page | Body Font Size | Pass (≥16px)? |
|------|---------------|---------------|
| Homepage | 18px | Yes |
| Services | 18px | Yes |
| Houston Contractors | 18px | Yes |
| Get A Quote (404) | 18px | Yes |

All pages pass the 16px minimum base font threshold. 18px is a strong default.

---

## Metadata Summary

| Page | Title | Title Len | Meta Desc Len | Canonical |
|------|-------|-----------|---------------|-----------|
| Homepage | Maxx Builders \| Texas' Premier Commercial General Contractors | 61 | 136 | Self |
| Services | Commercial Construction Services \| Maxx Builders | 48 | 126 | Self |
| Houston Contractors | Houston, TX Commercial General Contractors \| Maxx Builders | 58 | 157 | Self |
| Get A Quote (404) | Page not found \| Maxx Builders | 30 | — | None |

**Flags:**
- Homepage title: 61 chars — 1 over the 60-char guideline. Minor trim needed.
- Houston Contractors meta desc: 157 chars — 2 over the 155-char limit. Will truncate in SERPs.
- Services and Houston pages both have self-referencing canonicals — correct.
- 404 page has no canonical — acceptable.

---

## Horizontal Scroll

No horizontal scroll detected on any page at either viewport. Pass.

---

## LCP Element Analysis

| Page | Viewport | LCP Candidate | Size | Loading Attr | Assessment |
|------|----------|--------------|------|--------------|------------|
| Homepage | Desktop | Logo (white JPG) | 262x70 | None | POOR — hero photo not loading; tiny logo becomes LCP |
| Homepage | Mobile | Logo (PNG) | 302x70 | None | POOR — same issue |
| Services | Desktop | Logo (white JPG) | 250x58 | None | POOR — decorative hero not rendering |
| Services | Mobile | Hero photo (JPG) | 390x260 | None | OK — actual content image |
| Houston | Desktop | Houston skyline (JPG) | 650x433 | None | GOOD — relevant, large, no lazy |
| Houston | Mobile | Generic blueprints (JPG) | 390x260 | None | FAIR — loads but mismatched content |
| 404 | Desktop | Logo (white JPG) | 262x70 | None | N/A |
| 404 | Mobile | Logo (PNG) | 302x70 | lazy | FLAG — logo lazy-loaded on 404 only |

**Key finding:** On desktop, the homepage and services page hero background images are not rendering via Playwright (networkidle). This strongly suggests they are driven by a JavaScript slider/parallax or CSS `background-image` on a dynamically injected element. Google's crawl renderer (WRS) and Lighthouse will have similar difficulty measuring these as LCP elements. The effective LCP in synthetic tests will report the logo — a very poor LCP candidate.

---

## Prioritized Fix List

### P0 — Fix immediately (revenue impact)
1. **`/get-a-quote/` is a site-wide 404.** Add a 301 redirect to `/commercial-construction-project-inquiry/` AND update the nav button href. Every page on the site has a broken primary CTA.

### P1 — High impact (conversion + Core Web Vitals)
2. **Homepage & Services: hero background image not loading in synthetic crawl.** Investigate whether the hero is JS-slider-driven. Replace with an `<img>` tag (or `<picture>`) as the primary hero element, marked with `fetchpriority="high"`, no `loading="lazy"`. This is required for an accurate LCP measurement and for Google to render the content.
3. **Services page: no CTA above the fold on desktop.** Add a "Get A Quote" or "Talk to an Expert" button in the hero section at a position visible within 900px height.
4. **Houston page: no CTA above the fold on either viewport.** Same fix — add a primary CTA button in the hero.

### P2 — Medium impact (SEO correctness)
5. **Houston Contractors meta desc:** trim from 157 to ≤155 chars.
6. **Homepage title:** trim from 61 to ≤60 chars (one word adjustment).
7. **Houston mobile hero image:** replace generic blueprints image with the Houston skyline (or another Houston-specific photo) to match the desktop experience and reinforce local relevance.

### P3 — Low impact / polish
8. **Services H1 above fold on desktop:** the H1 "Our Services" is currently hidden below the fold. Consider pulling it into the hero section visually so crawlers and users both see keyword-relevant text immediately.
9. **404 page:** the logo has `loading="lazy"` only on this template — inconsistency worth fixing to avoid late-loading branding on error pages.

---

## Screenshots

All screenshots saved to `audit/screenshots/`:

| File | Description |
|------|-------------|
| `homepage_desktop.png` | Homepage at 1440x900 |
| `homepage_mobile.png` | Homepage at 390x844 |
| `services_desktop.png` | /services/ at 1440x900 |
| `services_mobile.png` | /services/ at 390x844 |
| `houston-commercial-contractors_desktop.png` | /houston-commercial-contractors/ at 1440x900 |
| `houston-commercial-contractors_mobile.png` | /houston-commercial-contractors/ at 390x844 |
| `get-a-quote_desktop.png` | /get-a-quote/ 404 at 1440x900 |
| `get-a-quote_mobile.png` | /get-a-quote/ 404 at 390x844 |
