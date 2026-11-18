-- LinkedIn alumni search (Nov 18): each company's LinkedIn page slug, read from its own website.
-- Run once in Supabase → SQL Editor, BEFORE merging the PR (the app reads this column). Safe to re-run.
alter table companies add column if not exists linkedin_slug text;

-- The view lists c.* as it was when it was created, so rebuild it to include the new column.
drop view if exists company_latest;
create view company_latest with (security_invoker = true) as
select c.*, e.scores, e.composite, e.joiner_upside, e.red_flags, e.summary, e.status as eval_status, e.created_at as evaluated_at
from companies c
left join lateral (
  select * from evaluations e where e.company_id = c.id order by created_at desc limit 1
) e on true;
