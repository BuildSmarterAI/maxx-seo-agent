"""
Visual SEO audit for maxxbuilders.com
Captures desktop (1440x900) and mobile (390x844) screenshots
and extracts on-page SEO signals.
"""

import json
import os
from playwright.sync_api import sync_playwright

PAGES = [
    {"slug": "homepage",                     "path": "/"},
    {"slug": "services",                     "path": "/services/"},
    {"slug": "houston-commercial-contractors","path": "/houston-commercial-contractors/"},
    {"slug": "get-a-quote",                  "path": "/get-a-quote/"},
]

BASE_URL   = "https://www.maxxbuilders.com"
OUT_DIR    = "C:/dev/maxx-seo-agent/audit/screenshots"
RESULTS_FILE = "C:/dev/maxx-seo-agent/audit/visual_seo_data.json"

DESKTOP = {"width": 1440, "height": 900,  "label": "desktop"}
MOBILE  = {"width": 390,  "height": 844,  "label": "mobile",
           "user_agent": (
               "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) "
               "AppleWebKit/605.1.15 (KHTML, like Gecko) "
               "Version/16.0 Mobile/15E148 Safari/604.1"
           )}

JS_EXTRACT = """
() => {
    const getMeta = (name) => {
        const el = document.querySelector(
            `meta[name="${name}"], meta[property="${name}"]`
        );
        return el ? el.getAttribute('content') : null;
    };

    // Viewport meta
    const viewportMeta = document.querySelector('meta[name="viewport"]');

    // H1
    const h1 = document.querySelector('h1');

    // CTAs above fold — buttons and anchor-buttons
    const foldLine = window.innerHeight;
    const allBtns = Array.from(document.querySelectorAll(
        'a[href], button, [role="button"]'
    ));
    const ctasAboveFold = allBtns.filter(el => {
        const r = el.getBoundingClientRect();
        return r.top < foldLine && r.bottom > 0 &&
               el.innerText && el.innerText.trim().length > 0;
    }).slice(0, 6).map(el => ({
        tag:  el.tagName,
        text: el.innerText.trim().slice(0, 80),
        top:  Math.round(el.getBoundingClientRect().top),
        href: el.getAttribute('href') || null,
    }));

    // LCP candidate — largest img or text block above fold
    const imgs = Array.from(document.querySelectorAll('img'));
    let lcpCandidate = null;
    let maxArea = 0;
    imgs.forEach(img => {
        const r = img.getBoundingClientRect();
        if (r.top < foldLine) {
            const area = r.width * r.height;
            if (area > maxArea) {
                maxArea = area;
                lcpCandidate = {
                    type: 'img',
                    src:  img.getAttribute('src') || img.getAttribute('data-src'),
                    alt:  img.getAttribute('alt'),
                    loading: img.getAttribute('loading'),
                    width: Math.round(r.width),
                    height: Math.round(r.height),
                };
            }
        }
    });
    // Fall back to largest text block
    if (!lcpCandidate) {
        const textEls = Array.from(document.querySelectorAll('h1, h2, p, div'));
        textEls.forEach(el => {
            const r = el.getBoundingClientRect();
            if (r.top < foldLine) {
                const area = r.width * r.height;
                if (area > maxArea && el.innerText && el.innerText.trim().length > 10) {
                    maxArea = area;
                    lcpCandidate = {
                        type: el.tagName.toLowerCase(),
                        text: el.innerText.trim().slice(0, 120),
                        width: Math.round(r.width),
                        height: Math.round(r.height),
                    };
                }
            }
        });
    }

    // Font sizes — body and prominent text
    const bodyFontSize = parseFloat(
        window.getComputedStyle(document.body).fontSize
    );

    // Horizontal scroll check
    const hasHorizontalScroll = document.documentElement.scrollWidth > window.innerWidth;

    // Title + meta description
    const title = document.title;
    const metaDesc = getMeta('description');
    const canonical = (() => {
        const el = document.querySelector('link[rel="canonical"]');
        return el ? el.getAttribute('href') : null;
    })();

    return {
        viewport_meta:       viewportMeta ? viewportMeta.getAttribute('content') : null,
        title,
        title_len:           title ? title.length : 0,
        meta_desc:           metaDesc,
        meta_desc_len:       metaDesc ? metaDesc.length : 0,
        canonical,
        h1:                  h1 ? h1.innerText.trim() : null,
        ctas_above_fold:     ctasAboveFold,
        lcp_candidate:       lcpCandidate,
        body_font_size_px:   bodyFontSize,
        has_horizontal_scroll: hasHorizontalScroll,
        status_code:         null,  // filled below
        page_url:            window.location.href,
    };
}
"""

def capture_page(page, url, slug, vp):
    label = vp["label"]
    print(f"  [{label}] {url}")
    try:
        resp = page.goto(url, wait_until="networkidle", timeout=30000)
        status = resp.status if resp else 0
    except Exception as e:
        print(f"    ERROR loading page: {e}")
        return {"error": str(e), "status_code": 0}

    page.wait_for_timeout(1500)  # let lazy resources settle

    shot_path = os.path.join(OUT_DIR, f"{slug}_{label}.png")
    page.screenshot(path=shot_path, full_page=False)
    print(f"    saved {shot_path}")

    data = page.evaluate(JS_EXTRACT)
    data["status_code"] = status
    data["screenshot"] = shot_path
    return data


def run_audit():
    results = {}

    with sync_playwright() as p:
        # --- Desktop ---
        browser = p.chromium.launch(headless=True)
        desktop_ctx = browser.new_context(
            viewport={"width": DESKTOP["width"], "height": DESKTOP["height"]}
        )
        desktop_page = desktop_ctx.new_page()

        for pg in PAGES:
            url = BASE_URL + pg["path"]
            slug = pg["slug"]
            if slug not in results:
                results[slug] = {"url": url}
            print(f"\n[desktop] {slug}")
            results[slug]["desktop"] = capture_page(desktop_page, url, slug, DESKTOP)

        desktop_ctx.close()

        # --- Mobile ---
        mobile_ctx = browser.new_context(
            viewport={"width": MOBILE["width"], "height": MOBILE["height"]},
            user_agent=MOBILE["user_agent"],
            is_mobile=True,
        )
        mobile_page = mobile_ctx.new_page()

        for pg in PAGES:
            url = BASE_URL + pg["path"]
            slug = pg["slug"]
            print(f"\n[mobile] {slug}")
            results[slug]["mobile"] = capture_page(mobile_page, url, slug, MOBILE)

        mobile_ctx.close()
        browser.close()

    with open(RESULTS_FILE, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, default=str)
    print(f"\nData saved to {RESULTS_FILE}")
    return results


if __name__ == "__main__":
    os.makedirs(OUT_DIR, exist_ok=True)
    run_audit()
