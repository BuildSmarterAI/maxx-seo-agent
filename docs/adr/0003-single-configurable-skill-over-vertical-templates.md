# ADR-0003: Single configurable skill over vertical-specific template library

**Date:** 2026-06-24
**Status:** Accepted
**Deciders:** Harris Khan (BuildSmarter Holdings)

---

## Context

Buzz Digital Agency serves clients across multiple verticals (construction, roofing, HVAC, home services, and others). The programmatic SEO skills — `blog-write`, `ai-info-page`, `metadata-generate` — are currently tuned for commercial construction (Maxx Builders). Extending to Buzz requires a decision on how to handle vertical-specific content requirements: different entity names, service taxonomies, local modifiers, authoritative stat sources, and tone.

Two options were evaluated:

- **Option A — Vertical-aware template library:** One skill file per vertical (`blog-write-roofing/`, `blog-write-hvac/`, etc.). Per-client `CLAUDE.md` sets `VERTICAL: roofing` to select the skill directory at runtime.
- **Option B — Single configurable skill:** One `blog-write` skill reads vertical config from `CLAUDE.md` (vertical name, service taxonomy, stat sources, local modifiers) and adapts its prompt accordingly.

---

## Decision

**Option B — Single configurable skill.**

`CLAUDE.md` per client defines:

```yaml
VERTICAL: roofing
SERVICE_TAXONOMY: roof replacement, storm damage repair, flat roofing, gutters
LOCAL_MODIFIERS: Houston TX, Harris County, The Woodlands, Sugar Land
STAT_SOURCES: NRCA, Storm Event Database (NOAA), local permit data
PRIMARY_ENTITIES: [business legal name, brand name, sameAs URLs]
```

The skill prompt reads these values and adapts voice, entity references, service mentions, and source citations accordingly.

---

## Rationale

Simplicity wins at low vertical count. A template library pays for itself when you need independent evals, independent tuning, and true isolation between verticals. At the scale Buzz operates today, the cost of maintaining N skill files and routing logic exceeds the quality benefit. One skill, one eval suite, one place to fix a prompt bug.

Known trade-off accepted: as vertical count grows, the configurable skill's prompt gets longer and harder to tune. A roofing nuance added to fix a roofing client's output could degrade HVAC output if the prompt is not carefully structured. This is the primary reason to revisit this decision.

---

## Migration trigger

Switch to a vertical-aware template library when any of the following occurs:

- A vertical-specific prompt fix causes a regression in another vertical's eval suite
- Buzz serves 5+ distinct verticals simultaneously
- A vertical requires fundamentally different content structure (e.g., law firm content requires disclaimer sections and citation formats that are incompatible with a shared prompt)

---

## Consequences

- Per-client `CLAUDE.md` must define all vertical config fields. Missing fields silently produce generic output — add validation to the orchestrator preflight.
- The eval suite for `blog-write` must include test cases from at least two verticals to catch cross-contamination regressions.
- Prompt engineering changes to `blog-write` require running evals against all active verticals before shipping.
