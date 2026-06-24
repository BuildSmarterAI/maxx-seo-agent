---
name: cwv-audit
description: Diagnose and fix Core Web Vitals (LCP, INP, CLS) at the template level. Use for page speed, Core Web Vitals, slow LCP, high INP, or layout shift issues.
---

# Core Web Vitals Remediation

Load CLAUDE.md. Edits files; test with the PageSpeed Insights API (mobile) after changes.

## Steps (work at the TEMPLATE level, order: TTFB → LCP → INP → CLS)

1. For the top 20 templates by traffic, identify the LCP element, main-thread long tasks (INP), and layout-shift sources (CLS).
2. **LCP:** preload hero/font; `fetchpriority="high"` on the LCP image (never lazy-load it); convert to AVIF/WebP; size per breakpoint; remove render-blocking CSS/JS; reduce TTFB via caching/CDN/static rendering.
3. **INP:** break long tasks (> 50ms blocks the main thread); defer non-critical JS; move client-only critical content to server components; reduce DOM complexity; yield to the main thread during interactions.
4. **CLS:** explicit `width`/`height` on every image/video/iframe/ad slot; `font-display: swap`; reserve space for dynamic content.
5. After each template fix, run the PSI API (`strategy=mobile`, see `scripts/check-vitals.sh`) and report LCP/CLS/TBT before vs. after.

## Guardrails

- Lab numbers (PSI/Lighthouse) catch regressions; the ranking signal is CrUX field data at p75 over 28 days. Treat passing lab as a floor, not proof.
- Test mobile — mobile-first indexing means mobile scores set rankings.
