-- Postmark Archive: a drop's story line, shown under the homepage headline as 今回の便：<story>.
-- Where the seven pieces were found, or whose collection they are. Empty hides the line.
-- Run once in the Supabase SQL editor (or with `supabase db push`). Safe to run again.
alter table public.drops add column if not exists story text not null default '';
