-- Saved lists (Nov 17): users flag companies into named lists, stored with their profile.
-- Run once in Supabase → SQL Editor. Safe to re-run.
alter table profiles add column if not exists lists jsonb not null default '[]'::jsonb;
