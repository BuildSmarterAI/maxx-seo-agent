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
  status      text default 'pending',       -- pending | in_progress | done | escalated
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
