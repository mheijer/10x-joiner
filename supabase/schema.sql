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
  ltv_phase     text,          -- cvp_fit | gtm_fit | bm_fit | scaling (LTV master table)
  playbook      text,          -- network | marketplace | sales_led_saas | plg_saas | api_platform | b2c_paid | hardware | services_as_software
  facts         jsonb,         -- full facts object from the latest evaluation
  facts_as_of   text,          -- YYYY-MM of freshest source
  hiring_profile jsonb,        -- lib/hiring.ts: open roles by function, hiring focus, salary bands (refreshed with jobs)
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
  pmf_evidence jsonb,            -- non-funding evidence behind PMF/growth: [{type, signal, value, as_of, source}]
  signals      jsonb,            -- measured signals from public APIs (HN, App Store, GitHub, npm, PyPI, job board)
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
  salary_min  numeric,         -- posted annual pay range, where the company publishes it
  salary_max  numeric,
  salary_currency text,
  salary_text text,            -- as posted, e.g. "$170K – $220K • Offers Equity"
  offers_equity boolean,       -- null = not stated
  fetched_at  timestamptz not null default now()
);

-- One profile per user (anonymous users included). Résumé/cover-letter TEXT only, never the file.
create table if not exists profiles (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  background_text text,    -- résumé / cover letter, extracted text
  looking_for     text,    -- free form
  preferences     jsonb,   -- explicit choices the user made (always win over inferred ones)
  parsed          jsonb,   -- lib/fit.ts parseProfile output: inferred preferences, preset, suggested weights + reasons, summary
  weights         jsonb,   -- the weights in use (suggested, edited, or reset to default)
  weights_source  text default 'default', -- default | suggested | custom
  blend           numeric default 0.5,    -- winning vs fitting me
  red_flag_mode   text default 'show',    -- show | penalize | hide
  profile_version int default 1,          -- bumps when background/goals change; invalidates cached explanations
  updated_at      timestamptz not null default now()
);

-- Fit SCORES are computed with plain math in the app (lib/fitmath.ts), so nothing is stored for them.
-- This table caches the AI-written explanation for companies the user has opened.
create table if not exists fit_explanations (
  user_id         uuid not null references auth.users(id) on delete cascade,
  company_id      uuid not null references companies(id) on delete cascade,
  profile_version int not null,
  reasons         jsonb,
  watch_out       text,
  outreach_angle  text,
  created_at      timestamptz not null default now(),
  primary key (user_id, company_id)
);

-- Row-level security -------------------------------------------------------
alter table companies      enable row level security;
alter table evaluations    enable row level security;
alter table funding_rounds enable row level security;
alter table jobs           enable row level security;
alter table profiles       enable row level security;
alter table fit_explanations enable row level security;

-- Companies users add are shared with everyone (team decision, Nov 2026). The app reads companies on the server with
-- the service role, so this policy only matters for direct browser queries.
create policy "companies_read" on companies for select
  using (true);
create policy "companies_insert_own" on companies for insert
  with check (created_by = auth.uid() and is_seed = false);

-- Child tables readable when the parent company is readable
create policy "evaluations_read" on evaluations for select
  using (true);
create policy "funding_read" on funding_rounds for select
  using (true);
create policy "jobs_read" on jobs for select
  using (true);

create policy "profiles_own" on profiles for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "fit_own" on fit_explanations for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Writes to evaluations/funding/jobs happen server-side with the service role key.

-- Each user may add at most 3 startups (each evaluation costs real API money). Enforced in the database too,
-- so it holds even if someone bypasses the app.
create or replace function enforce_company_cap() returns trigger language plpgsql as $$
begin
  if new.created_by is not null and
     (select count(*) from companies where created_by = new.created_by) >= 3 then
    raise exception 'Limit reached: each user can add up to 3 startups';
  end if;
  return new;
end $$;
drop trigger if exists company_cap on companies;
create trigger company_cap before insert on companies for each row execute function enforce_company_cap();

-- Users can remove their own added startups (frees a slot)
create policy "companies_delete_own" on companies for delete using (created_by = auth.uid() and is_seed = false);

-- Convenience view: each company with its latest evaluation.
-- security_invoker = true makes the view respect row-level security (otherwise a view runs with its owner's
-- rights and would expose every user's private startups).
create or replace view company_latest with (security_invoker = true) as
select c.*, e.scores, e.composite, e.joiner_upside, e.red_flags, e.summary, e.status as eval_status, e.created_at as evaluated_at
from companies c
left join lateral (
  select * from evaluations e where e.company_id = c.id order by created_at desc limit 1
) e on true;
