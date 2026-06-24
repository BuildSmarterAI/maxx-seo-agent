#!/usr/bin/env bash
# setup-branch-protection.sh — one-time. Makes auto-merge SAFE by requiring the
# eval-gate check (and any others you list) before any merge to the protected branch,
# and forbidding direct pushes. Needs gh auth with admin on the repo.
#
#   ./scripts/setup-branch-protection.sh owner/repo [branch] [extra-check ...]
#   e.g. ./scripts/setup-branch-protection.sh buildsmarter/site main vitals
set -euo pipefail

REPO="${1:?usage: setup-branch-protection.sh owner/repo [branch] [extra-check ...]}"
BRANCH="${2:-main}"
shift || true; shift || true
EXTRA=("$@")     # additional required check job names (e.g. vitals)

# Build the contexts JSON array: always require eval-gate, plus any extras.
contexts='["eval-gate"'
for c in "${EXTRA[@]:-}"; do [ -n "$c" ] && contexts+=",\"$c\""; done
contexts+=']'

echo "Enabling repo auto-merge..."
gh api -X PATCH "repos/$REPO" -F allow_auto_merge=true >/dev/null

echo "Protecting $BRANCH (required checks: $contexts)..."
gh api -X PUT "repos/$REPO/branches/$BRANCH/protection" --input - <<JSON >/dev/null
{
  "required_status_checks": { "strict": true, "contexts": ${contexts} },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_linear_history": true
}
JSON

echo "Done. Safe-class PRs auto-merge once required checks pass; everything else waits for a human."
echo "Note: required_pull_request_reviews is null so checks alone gate the merge."
echo "      To require a human approval too, set it to {\"required_approving_review_count\":1}."
