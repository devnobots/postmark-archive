-- Postmark Archive back office, phases 2 and 3: change history (undo) and photo storage.
-- Run once in the Supabase SQL editor after 0001_init.sql.

-- every change to a piece keeps the version before it, so it can be put back (undo), and deleted pieces can be restored
create table public.piece_history (
  id bigint generated always as identity primary key,
  piece_id uuid not null,
  action text not null check (action in ('update', 'delete')),
  snapshot jsonb not null,                     -- the whole piece as it was before the change
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index piece_history_piece on public.piece_history (piece_id, created_at desc);
alter table public.piece_history enable row level security;
create policy "admins keep history" on public.piece_history for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, delete on public.piece_history to authenticated;

-- photos: anyone can view a published photo by its address; only admins can add, change or remove them.
-- The site build copies the photos it uses into the site itself, so visitors never load them from here.
insert into storage.buckets (id, name, public) values ('photos', 'photos', true) on conflict (id) do nothing;
create policy "admins add photos" on storage.objects for insert to authenticated with check (bucket_id = 'photos' and public.is_admin());
create policy "admins change photos" on storage.objects for update to authenticated using (bucket_id = 'photos' and public.is_admin());
create policy "admins remove photos" on storage.objects for delete to authenticated using (bucket_id = 'photos' and public.is_admin());
