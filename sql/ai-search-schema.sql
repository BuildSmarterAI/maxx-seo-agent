-- BuildSmarter agentic SEO — AI SEARCH module (run in Supabase SQL editor)
-- Additive + idempotent. Safe to run on top of the existing 9-table schema.
-- Closes the GEO feedback loop: the agent can now SEE whether AI engines cite the site.

-- ---- monitored question set (the GEO equivalent of tracked keywords) ----
create table if not exists ai_queries (
  id          bigint generated always as identity primary key,
  query       text not null,                 -- the question a buyer asks an AI tool
  intent      text,                           -- informational | commercial | local
  target_url  text,                           -- the page that SHOULD earn the citation
  priority    int  default 0,
  active      boolean default true,
  created_at  timestamptz default now(),
  unique (query)
);

-- ---- citation results: one row per (query x engine x run) ----
create table if not exists ai_citations (
  id               bigint generated always as identity primary key,
  query            text not null,
  engine           text not null,             -- claude | perplexity | openai | google_aio
  answered         boolean default false,     -- engine returned a usable answer
  cited            boolean default false,     -- our domain appeared in sources
  brand_mentioned  boolean default false,     -- brand named in the prose (even w/o link)
  position         int,                        -- citation rank among sources (1 = first), null if uncited
  sources          jsonb,                      -- array of source URLs the engine used
  competitors      jsonb,                      -- competitor domains cited for this query
  target_url       text,
  captured_at      timestamptz default now()
);
create index if not exists ai_citations_query_engine_idx on ai_citations(query, engine, captured_at desc);

-- ---- People-Also-Ask / related questions mined per topic ----
create table if not exists paa_questions (
  id          bigint generated always as identity primary key,
  topic       text,                           -- seed keyword/topic
  question    text not null,
  target_url  text,                           -- page to attach the FAQ answer to
  source      text,                           -- serpapi | engine
  status      text default 'new',             -- new | queued | answered | skip
  captured_at timestamptz default now(),
  unique (question)
);

-- ---- AI-referred traffic (GA4 / log attribution) ----
create table if not exists ai_referrals (
  id          bigint generated always as identity primary key,
  source      text,                           -- chatgpt.com | perplexity.ai | gemini | copilot | ...
  url         text,                           -- landing page
  sessions    numeric default 0,
  conversions numeric default 0,
  period      text,                           -- YYYY-MM-DD (day) or range tag
  captured_at timestamptz default now()
);
create index if not exists ai_referrals_source_idx on ai_referrals(source, period);

-- ---- entity coverage snapshot per page (E-E-A-T / topical authority) ----
create table if not exists entity_coverage (
  url            text primary key,
  word_count     int,
  entity_count   int,
  entity_density numeric,                      -- entities per 1000 words
  checked_at     timestamptz default now()
);

-- ---- internal link graph state (orphans + pillar wiring) ----
create table if not exists link_graph (
  url        text primary key,
  inbound    int default 0,
  outbound   int default 0,
  is_orphan  boolean default false,
  is_pillar  boolean default false,
  updated_at timestamptz default now()
);

-- ---- auto-classified competitor / source domains (maintained by classify-competitors.mjs) ----
-- The AI-search loop discovers every domain cited by answer engines (ai_citations.sources),
-- then classifies each ONCE so it is never re-asked. Only high-confidence 'competitor' rows
-- feed the citation-gap scoring in sensor-ai-citations.mjs. source='manual' rows are human
-- pins/overrides the classifier must never overwrite.
create table if not exists competitor_domains (
  domain         text primary key,
  classification text not null check (classification in ('competitor','reference','noise')),
  confidence     numeric default 0 check (confidence >= 0 and confidence <= 1),
  rationale      text,                           -- one line: why this label (audit trail)
  times_cited    int default 0,                  -- citations seen when first classified (live count: ai_citations)
  source         text default 'auto' check (source in ('auto','manual')),  -- classifier vs human pin
  first_seen     timestamptz default now(),
  updated_at     timestamptz default now()
);
-- No secondary index: the sensor loads the whole (small) table and filters in JS.

-- learned_patterns already exists; citation attribution writes change_type rows like
-- 'restructure-for-citation', 'ai-info-page', 'faq-schema' into it via attribute-citations.mjs.

-- seed example (edit, do not rely on these verbatim):
-- insert into ai_queries (query, intent, target_url, priority) values
--   ('How much does commercial construction cost per square foot in Houston?', 'informational',
--    'https://www.maxxbuilders.com/commercial-construction-cost-houston-tx/', 10)
--   on conflict (query) do nothing;
