---
name: cwv-audit
description: Diagnose and fix Core Web Vitals (LCP, INP, CLS) at the template level. Use for page speed, Core Web Vitals, slow LCP, high INP, or layout shift issues.
---

# Core Web Vitals Remediation

Load CLAUDE.md. **Execution model depends on the target site.** These steps assume direct template/theme file access. That is NOT available for the current Maxx Builders configuration — the WordPress apply pack (`packs/wordpress/`, REST-only) writes post meta and content only; it has no plugin/theme file access (see `.claude/rules/security.md`), and `.claude/CLAUDE.md` confirms this repo has no local copy of the site's template files. **For the current site, escalate CWV template fixes** for manual theme access (FTP/host panel/child theme) rather than attempting file edits through this repo. Run the steps below only when the target site has a local, editable template repo.

## Steps (work at the TEMPLATE level, order: TTFB → LCP → INP → CLS)

1. For the top 20 templates by traffic, identify the LCP element, main-thread long tasks (INP), and layout-shift sources (CLS).
2. **LCP:** preload hero/font; `fetchpriority="high"` on the LCP image (never lazy-load it); convert to AVIF/WebP; size per breakpoint; remove render-blocking CSS/JS; reduce TTFB via caching/CDN/static rendering.
3. **INP:** break long tasks (> 50ms blocks the main thread); defer non-critical JS; move client-only critical content to server components; reduce DOM complexity; yield to the main thread during interactions.
4. **CLS:** explicit `width`/`height` on every image/video/iframe/ad slot; `font-display: swap`; reserve space for dynamic content.
5. After each template fix, run the PSI API (`strategy=mobile`, see `scripts/check-vitals.sh`) and report LCP/CLS/TBT before vs. after.

## Guardrails

- Lab numbers (PSI/Lighthouse) catch regressions; the ranking signal is CrUX field data at p75 over 28 days. Treat passing lab as a floor, not proof.
- Test mobile — mobile-first indexing means mobile scores set rankings.
