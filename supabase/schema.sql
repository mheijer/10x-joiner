-- The Next 10x Joiner schema. Paste into Supabase SQL Editor and run once.
-- Also enable: Authentication -> Sign In / Providers -> "Allow anonymous sign-ins".

create extension if not exists "pgcrypto";

-- Companies: seeded (shared) or user-added (private to the creator)
create table if not exists companies (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  domain        text,
  description   text,
  sector        text,
  stage         text,          -- e.g. Seed, Series A, Series B...
  headcount     int,
  founded_year  int,
  hq_city       text,
  lat           double precision,
  lng           double precision,
  total_funding_usd      numeric,
  latest_post_money_usd  numeric,
  post_money_is_estimate boolean default true,
  arr_estimate_usd       numeric,
  headcount_growth_pct   numeric,     -- last 12 months
  work_policy   text,          -- onsite | hybrid | remote | unknown
  customer_type text[],        -- enterprise | mid_market | smb | consumer | government (market curve)
  business_type text,          -- b2b | b2c | b2b2c | marketplace
  gtm_motion    text[],        -- sales_led | plg | fde | channel | paid_acquisition
  pricing_model text[],        -- seat | usage | outcome | subscription | transaction | ads | hardware
  sponsors_visas text default 'unknown', -- yes | likely | unknown | no
  facts         jsonb,         -- full facts object from the latest evaluation
  facts_as_of   text,          -- YYYY-MM of freshest source
  list_snapshot jsonb,         -- original Rocketship List values (kept for provenance; list data can be stale)
  careers_url   text,
  ats_provider  text,          -- greenhouse | lever | ashby | null
  ats_slug      text,          -- board token, e.g. "anthropic"
  is_seed       boolean not null default false,
  created_by    uuid references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (domain, created_by)
);

-- Latest framework evaluation per company (keep history via version)
create table if not exists evaluations (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies(id) on delete cascade,
  version      int not null default 1,
  scores       jsonb not null,   -- { dimension_key: {score, confidence, rationale, sources[]} }
  composite    numeric,          -- Probability of Winning 0-100 (default weights, red flags applied)
  joiner_upside numeric,         -- Joiner Upside 0-100
  red_flags    jsonb,            -- [{type, severity, detail, source}]
  conflicts    jsonb,            -- where sources disagreed
  rubric_version text default 'v2',
  summary      text,
  model        text,
  status       text not null default 'done', -- pending | done | error
  created_at   timestamptz not null default now()
);
create index if not exists evaluations_company_idx on evaluations(company_id, created_at desc);

create table if not exists funding_rounds (
  id                     uuid primary key default gen_random_uuid(),
  company_id             uuid not null references companies(id) on delete cascade,
  round                  text,
  announced_on           date,
  amount_usd             numeric,
  post_money_usd         numeric,
  post_money_is_estimate boolean not null default true,
  source_url             text
);

create table if not exists jobs (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  title       text not null,
  department  text,
  location    text,
  url         text,
  source      text,
  job_function text,           -- product | bizops | gtm | chief_of_staff | fde | marketing | engineering | other
  fetched_at  timestamptz not null default now()
);

-- One profile per user (anonymous users included)
create table if not exists profiles (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  background_text text,    -- resume / cover letter, free form
  looking_for     text,    -- free form
  preferences     jsonb,   -- { stages: [], sectors: [], min_headcount, max_headcount, locations: [] }
  updated_at      timestamptz not null default now()
);

create table if not exists fit_scores (
  user_id     uuid not null references auth.users(id) on delete cascade,
  company_id  uuid not null references companies(id) on delete cascade,
  score       numeric,     -- 0-100
  rationale   text,
  created_at  timestamptz not null default now(),
  primary key (user_id, company_id)
);

-- Row-level security -------------------------------------------------------
alter table companies      enable row level security;
alter table evaluations    enable row level security;
alter table funding_rounds enable row level security;
alter table jobs           enable row level security;
alter table profiles       enable row level security;
alter table fit_scores     enable row level security;

-- Seeded companies are public; user-added companies visible only to creator
create policy "companies_read" on companies for select
  using (is_seed or created_by = auth.uid());
create policy "companies_insert_own" on companies for insert
  with check (created_by = auth.uid() and is_seed = false);

-- Child tables readable when the parent company is readable
create policy "evaluations_read" on evaluations for select
  using (exists (select 1 from companies c where c.id = company_id and (c.is_seed or c.created_by = auth.uid())));
create policy "funding_read" on funding_rounds for select
  using (exists (select 1 from companies c where c.id = company_id and (c.is_seed or c.created_by = auth.uid())));
create policy "jobs_read" on jobs for select
  using (exists (select 1 from companies c where c.id = company_id and (c.is_seed or c.created_by = auth.uid())));

create policy "profiles_own" on profiles for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "fit_own" on fit_scores for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Writes to evaluations/funding/jobs happen server-side with the service role key.

-- Convenience view: each company with its latest evaluation
create or replace view company_latest as
select c.*, e.scores, e.composite, e.joiner_upside, e.red_flags, e.summary, e.status as eval_status, e.created_at as evaluated_at
from companies c
left join lateral (
  select * from evaluations e where e.company_id = c.id order by created_at desc limit 1
) e on true;
