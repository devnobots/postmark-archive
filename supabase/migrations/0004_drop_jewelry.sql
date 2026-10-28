-- Postmark Archive: a jewelry drop. Ticked in the back office, the drop's stamps use light neutral colours.
-- Run once in the Supabase SQL editor (or with `supabase db push`). Safe to run again.
alter table public.drops add column if not exists jewelry boolean not null default false;
