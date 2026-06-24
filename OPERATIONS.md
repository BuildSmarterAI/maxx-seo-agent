# SEO Agent — Operator Runbook

**Entity:** BuildSmarter Holdings · **Version:** 1.0 · **Last Updated:** 2026-06-24
**Owner:** [assign] · **Audience:** whoever runs the weekly check (no code knowledge required)

## Purpose
Keep the autonomous SEO loop safe and on-track without reading its code. This is the Monday-morning routine plus what to do when something goes red.

## When to use
Every Monday, and any time GitHub or email flags a failed check or an open `seo-auto` PR.

## Prerequisites (access only — not code)
- GitHub repo: **Actions** tab + **Pull requests** tab.
- Supabase project: **SQL editor**.
- The kit's `CLAUDE.md` (thresholds) for reference.

---

## 1. Monday-morning check (≈10 min, in order)

| # | Look at | Where | Action |
|---|---|---|---|
| 1 | Open `seo-auto` PRs | GitHub → Pull requests → label `seo-auto` | Merge the good ones; close the bad ones |
| 2 | Escalation queue | Supabase (SQL in §2) | Items the agent refused — decide each |
| 3 | Red checks on PRs | GitHub → the PR → Checks | Decode with §3 |
| 4 | Spend vs cap | Supabase (SQL in §6) | If near cap, decide raise vs wait |
| 5 | Weekend auto-merges | Supabase `decision_log` (SQL in §2) | Skim what shipped unattended |
| 6 | What it's learning | Supabase `learned_patterns` | Sanity-check it looks reasonable |

If everything is green and the queue is empty, you're done.

## 2. Reading the escalation queue

These are changes the agent **refused** to make and left for a human.

```sql
-- what it escalated and why
select created_at, url, reason from decision_log
where action = 'escalate' order by created_at desc limit 50;

-- the queue items still waiting on a human
select url, task, risk_class, source from work_queue
where status = 'escalated' order by created_at desc;
```

For each: either **do it yourself**, **reclassify** it (if it's actually safe, set the row back to `pending`), or **add it to `do_not_touch`** (§7) so it never comes back.

## 3. Red-check decoder

| Red check | What it means | What to do |
|---|---|---|
| `eval-gate` — diff-size step | Change is larger than `MAX_DIFF_LINES` | Review the PR by hand; merge if good, else close |
| `eval-gate` — LLM-as-judge | Low quality, fabrication risk, or it touched pricing/brand/YMYL | Open the run log, read the judge JSON, fix or close. **Never override blindly** |
| `vitals` | The change degraded Core Web Vitals on the preview | Don't merge — send back for a fix |
| `orchestrate` job failed | Run errored mid-flight (it auto-rolled back the branch) | Re-run once; if it repeats, **pause** (§4) and escalate (§9) |
| `seo-sensors` / `seo-learn` job failed | GSC/sitemap fetch or credential/quota issue | Usually transient; check the secret/quota, re-run |

## 4. Pause (kill switch)

Stops every run at preflight — nothing plans, acts, or spends.

```sql
update control set paused = true where id = 1;   -- pause
update control set paused = false where id = 1;  -- resume
```

Belt-and-suspenders: in **GitHub → Actions**, you can also disable the `seo-sensors`, `seo-auto-merge`, and `seo-learn` workflows.

## 5. Roll back

- **Bad PR, not merged:** just close it. It's only a branch; nothing shipped.
- **Bad change already merged:** on the merged PR click **Revert** (or `git revert <sha>` → PR → merge).
- **Stop a recurring bad pattern:** add the URL/section to `do_not_touch` (§7); and/or raise `JUDGE_MIN_SCORE` and lower `PRIORITY_WEIGHT` in the GitHub Actions variables.

## 6. Budget

```sql
select month, spend_usd from control where id = 1;
```
Compare to `MONTHLY_BUDGET_USD`. It resets monthly and does **not** roll over (separate metered pool). When spend hits the cap, runs skip automatically. To raise it, change the `MONTHLY_BUDGET_USD` Actions variable.

## 7. `do_not_touch` (URLs the agent must never edit)

```sql
insert into do_not_touch (url, note, added_by)
values ('https://example.com/legal/', 'YMYL — counsel owns', 'your-name');
```

## 8. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `orchestrate` exits "queue empty" | No pending work | Normal — sensors had nothing to flag |
| Auth error in a job | Expired/missing secret | Re-add `ANTHROPIC_API_KEY` / `SUPABASE_*` / `GCP_SA_JSON` |
| PR won't auto-merge though checks pass | Branch protection or auto-merge not enabled | Re-run `setup-branch-protection.sh`; check repo "Allow auto-merge" |
| Judge fails everything | `JUDGE_MIN_SCORE` too high, or content genuinely weak | Lower the var a notch; spot-check a few diffs |
| `learned_patterns` empty | Not enough outcome history yet (needs ≥`ATTR_MIN_N` samples over weeks) | Expected early on; let `seo-learn` accumulate |
| Sensor enqueues nonsense | Threshold too loose | Tighten in `CLAUDE.md` / sensor envs |

## 9. When to stop and call the builder

**Pause first (§4), then escalate** if you see any of:
- `orchestrate` fails repeatedly across re-runs.
- The judge is passing changes that are clearly wrong on review.
- Spend spikes well above the normal weekly pattern.
- Organic rankings/clicks drop in the week *after* a batch of auto-merges (check `decision_log` against the dip).

Escalation contact: **[assign]**.

## Health signals (what "good" looks like)
A normal week: a handful of safe-class PRs auto-merged green, a short escalation queue you clear in minutes, spend well under cap, and `learned_patterns` that roughly matches your intuition about what helps. Anything outside that is worth a closer look before the next run.

## Revision history
| Date | Version | Change | Author |
|---|---|---|---|
| 2026-06-24 | 1.0 | Initial runbook | — |
