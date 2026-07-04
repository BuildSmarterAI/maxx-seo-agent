-- BuildSmarter agentic SEO — memory layer (run in Supabase SQL editor)
-- Safe to re-run: uses IF NOT EXISTS / ON CONFLICT.

create table if not exists decision_log (
  id          bigint generated always as identity primary key,
  url         text,
  action      text,                         -- applied | escalate | skip
  risk_class  text,                         -- safe | gated
  reason      text,
  agent       text,
  pr_url      text,
  created_at  timestamptz default now()
);

create table if not exists work_queue (
  id          bigint generated always as identity primary key,
  url         text,
  task        text,                         -- which kit skill to run
  risk_class  text default 'safe',          -- safe | gated
  priority    int  default 0,
  status      text default 'pending',       -- pending | in_progress | done | escalated | skipped-dnt
  source      text,                         -- gsc | sitemap | deploy | citation | manual
  created_at  timestamptz default now(),
  unique (url, task, status)
);

create table if not exists do_not_touch (
  url      text primary key,
  note     text,
  added_by text
);

create table if not exists outcomes (
  id          bigint generated always as identity primary key,
  url         text,
  metric      text,                         -- clicks | impressions | position | citations | conversions
  value       numeric,
  captured_at timestamptz default now()
);

create table if not exists learned_patterns (
  id          bigint generated always as identity primary key,
  change_type text,
  avg_effect  numeric,
  n           int,
  updated_at  timestamptz default now()
);
create unique index if not exists learned_patterns_change_type_key on learned_patterns(change_type);

-- decision_log gains change_type so outcomes can be attributed per skill (safe on re-run)
alter table decision_log add column if not exists change_type text;

-- work_queue gains linear_issue_id so escalated items mirror to Linear idempotently (safe on re-run)
alter table work_queue add column if not exists linear_issue_id text;

-- sitemap diff state
create table if not exists sitemap_seen (
  url        text primary key,
  first_seen timestamptz default now()
);

-- single-row control: kill switch + monthly spend guard
create table if not exists control (
  id        int primary key default 1,
  paused    boolean default false,
  month     text,
  spend_usd numeric default 0
);
insert into control (id) values (1) on conflict (id) do nothing;

-- Atomic monthly spend increment. Replaces the read-modify-write in supabase.mjs addSpend
-- so a local `npm run orchestrate` overlapping the nightly CI run cannot lose an update
-- (and overrun MONTHLY_BUDGET_USD). Month-aware: a new month zeroes the counter in the
-- same statement. Safe to re-run (create or replace). addSpend falls back to the prior
-- read-modify-write if this function is not yet deployed.
create or replace function increment_spend(p_amount numeric, p_month text)
returns void language sql as $$
  update control
     set spend_usd = (case when month = p_month then spend_usd else 0 end) + p_amount,
         month = p_month
   where id = 1;
$$;

-- Lock down the new function: anon must never reach it via PostgREST /rpc (it could zero or
-- inflate the monthly budget counter and defeat the spend gate / kill switch). Service-role
-- and authenticated only. Required for every public-schema function per the BSH security rule.
revoke execute on function increment_spend(numeric, text) from anon, public;
grant  execute on function increment_spend(numeric, text) to authenticated, service_role;

-- ---- Live-CMS apply layer (WordPress / Webflow) ----

-- portable change-set: one row per field edit the agent wants to make
create table if not exists change_set (
  id          bigint generated always as identity primary key,
  platform    text,                         -- wordpress | webflow
  page_id     text,                         -- post ID / page ID / CMS item ID
  collection_id text,                       -- webflow CMS collection (if item)
  url         text,
  field       text,                         -- title | description | canonical | ...
  base_value  text,                         -- value the agent saw when deciding (drift baseline)
  new_value   text,
  status      text default 'pending',       -- pending|approved|applied|published|failed|escalated|rolledback
  batch       text,
  created_at  timestamptz default now(),
  applied_at  timestamptz
);

-- pre-overwrite snapshots = the rollback tape (no git revert on a live CMS)
create table if not exists snapshots (
  id          bigint generated always as identity primary key,
  platform    text,
  page_id     text,
  url         text,
  field       text,
  old_value   text,
  captured_at timestamptz default now()
);

-- seed: URLs humans own by hand (the agent never edits these)
-- insert into do_not_touch (url, note, added_by) values
--   ('https://example.com/legal/', 'YMYL — counsel owns', 'harris');

-- ---- AutoResearch Phase A: measurement substrate ----
-- Why: the optimizer loops in AUTORESEARCH-ROADMAP.md need provenance on every decision
-- (which prompt variant + model produced a given lift) and a registry to record
-- experiments / eval examples / judge calibration. All additive + idempotent.

-- decision_log provenance: tie realized lift back to the variant + model that produced it.
alter table decision_log add column if not exists prompt_variant_id text;
alter table decision_log add column if not exists model             text;
alter table decision_log add column if not exists cost_usd          numeric;  -- nullable: run-level cost lives in control.spend_usd until per-item metering (Phase B)

-- A/B + bandit registry every optimizer writes to.
create table if not exists experiments (
  id          bigint generated always as identity primary key,
  surface     text,                          -- skill | judge | router | threshold
  target      text,                          -- e.g. blog-write | metadata-generate | eval-judge
  variant_id  text,                          -- stable id of the prompt/config under test
  arm         text,                          -- control | treatment | bandit arm label
  allocation  numeric default 0,             -- traffic share 0..1
  metric      text,                          -- avg_effect | judge_pass | cost_usd | ctr_delta
  value       numeric,
  n           int     default 0,
  status      text    default 'active',      -- active | promoted | retired | shadow
  started_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create index if not exists experiments_surface_target_idx on experiments(surface, target, status);

-- Golden positives + synthetic negatives for the eval benchmark (RO-6) and judge (RO-1).
create table if not exists eval_set (
  id            bigint generated always as identity primary key,
  change_type   text,                        -- which skill this example exercises
  url           text,
  artifact      text,                        -- the diff / draft / metadata under judgement
  label         text,                        -- good | bad
  failure_mode  text,                        -- doorway | fabricated_stat | cannibalizing | placeholder | null
  realized_lift numeric,                     -- 28d blended lift when mined from outcomes
  source        text,                        -- mined | synthetic | human
  created_at    timestamptz default now()
);
create index if not exists eval_set_change_type_label_idx on eval_set(change_type, label);

-- One row per judge-variant evaluated against the eval_set + outcome history (RO-1).
create table if not exists judge_calibration (
  id            bigint generated always as identity primary key,
  judge_variant text,                        -- rubric/threshold/model bundle id
  auc           numeric,                     -- judge score vs realized lift
  override_rate numeric,                     -- human overrides on its passes
  false_pass    numeric,
  false_block   numeric,
  n             int,
  status        text default 'shadow',       -- shadow | champion | retired
  evaluated_at  timestamptz default now()
);
