#!/usr/bin/env bash
# check-vitals.sh URL — post-change Core Web Vitals canary via the PageSpeed Insights API
# (strategy=mobile). Used by packs/webflow/publish.mjs and .github/workflows/vitals-pr.yml,
# and referenced by the cwv-audit / seo-audit skills.
#
# Exit codes:
#   0  within thresholds (pass)
#   2  a metric REGRESSED past its threshold (real CWV fail)
#   3  could NOT run (no URL, missing curl/jq, network/API error, unparseable response)
# Callers distinguish 2 (regression) from 3 (tooling) so a transient failure is never
# mistaken for a CWV regression that would trigger a rollback.
#
# Metrics: Lighthouse LAB LCP/CLS/TBT. Field/CrUX p75 (the true ranking signal) lags ~28
# days, so a fresh-change canary uses lab numbers as a floor (see cwv-audit/SKILL.md).
# Thresholds are the lab proxies for the field targets in root CLAUDE.md
# (LCP<2.5s, INP<200ms, CLS<0.1): lab LCP<2500ms, TBT<200ms (INP proxy), CLS<0.1.
# Override via LCP_MAX_MS / TBT_MAX_MS / CLS_MAX. Set PAGESPEED_API_KEY to raise quota.
set -uo pipefail

URL="${1:-}"
if [ -z "$URL" ]; then echo "check-vitals: no URL given" >&2; exit 3; fi
command -v curl >/dev/null 2>&1 || { echo "check-vitals: curl not found" >&2; exit 3; }
command -v jq   >/dev/null 2>&1 || { echo "check-vitals: jq not found" >&2; exit 3; }

LCP_MAX_MS="${LCP_MAX_MS:-2500}"
TBT_MAX_MS="${TBT_MAX_MS:-200}"
CLS_MAX="${CLS_MAX:-0.1}"

# Splice the optional API key as array elements so the value is never word-split (a key with
# whitespace would otherwise break the request); empty array adds nothing when the key is unset.
key_args=()
[ -n "${PAGESPEED_API_KEY:-}" ] && key_args=(--data-urlencode "key=${PAGESPEED_API_KEY}")

resp="$(curl -fsS --max-time 120 -G \
  "https://www.googleapis.com/pagespeedonline/v5/runPagespeed" \
  --data-urlencode "url=${URL}" \
  --data "strategy=mobile" \
  --data "category=performance" \
  "${key_args[@]}")" \
  || { echo "check-vitals: PSI request failed for ${URL}" >&2; exit 3; }

# Pull the three lab metrics; null/missing audits become empty strings.
read -r lcp tbt cls < <(printf '%s' "$resp" | jq -r '
  [ .lighthouseResult.audits["largest-contentful-paint"].numericValue,
    .lighthouseResult.audits["total-blocking-time"].numericValue,
    .lighthouseResult.audits["cumulative-layout-shift"].numericValue ]
  | map(. // "") | @tsv' 2>/dev/null)

if [ -z "${lcp:-}" ] || [ -z "${tbt:-}" ] || [ -z "${cls:-}" ]; then
  echo "check-vitals: could not parse PSI metrics for ${URL}" >&2; exit 3
fi

fail=0
if awk "BEGIN{exit !($lcp > $LCP_MAX_MS)}"; then echo "FAIL LCP ${lcp}ms > ${LCP_MAX_MS}ms"; fail=1; else echo "ok   LCP ${lcp}ms"; fi
if awk "BEGIN{exit !($tbt > $TBT_MAX_MS)}"; then echo "FAIL TBT ${tbt}ms > ${TBT_MAX_MS}ms (INP proxy)"; fail=1; else echo "ok   TBT ${tbt}ms"; fi
if awk "BEGIN{exit !($cls > $CLS_MAX)}";    then echo "FAIL CLS ${cls} > ${CLS_MAX}"; fail=1; else echo "ok   CLS ${cls}"; fi

if [ "$fail" -ne 0 ]; then echo "check-vitals: CWV regression on ${URL} (mobile, lab)"; exit 2; fi
echo "check-vitals: ${URL} within thresholds (mobile, lab)"
exit 0
