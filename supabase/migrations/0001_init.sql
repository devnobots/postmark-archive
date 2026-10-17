-- Standard Gauge back office: tables (phase 1). Run once in the Supabase SQL editor, or with `supabase db push`.
-- Everything a visitor sees comes from these tables. Nothing here is readable without signing in as an admin:
-- the site build reads with the server-only secret key, and visitors only ever get the built files.

-- who may use the back office (add your own user id after you first sign in; see the spec, step C4)
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- a drop: 第12便, released on a date (Japan time)
create table public.drops (
  id bigint generated always as identity primary key,
  no integer not null unique check (no > 0),
  release_date date,
  status text not null default 'draft' check (status in ('draft', 'live', 'past')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- only one drop is on the homepage at a time
create unique index drops_one_live on public.drops ((status)) where status = 'live';

-- a category picks which measurements the form asks for, and which two go on the stamp's size line
create table public.categories (
  code text primary key,
  label_ja text not null,
  measurements text[] not null,
  size_line text[] not null default '{}',
  sort integer not null default 0
);

create table public.pieces (
  id uuid primary key default gen_random_uuid(),
  drop_id bigint references public.drops (id) on delete set null,
  position integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'ready', 'sold')),
  category text references public.categories (code),
  name_ja text not null default '',
  name_en text not null default '',
  cap_ja text not null default '',            -- stamp label; empty = use name_ja
  size_line text not null default '',          -- e.g. 着丈 70 · 身幅 54 (filled from the measurements, editable)
  measurements jsonb not null default '[]',    -- [["着丈","70 cm"], ...] in display order
  price_jpy integer check (price_jpy is null or price_jpy > 0),
  grade text check (grade is null or grade in ('A', 'B', 'C')),
  grade_note text not null default '',
  found_city text not null default '',         -- TUCSON
  found_state text not null default '' check (found_state = '' or found_state ~ '^[A-Z]{2}$'),
  found_on date,
  bg text not null default '#EFE3C8' check (bg ~ '^#[0-9A-Fa-f]{6}$'),
  ink text check (ink is null or ink ~ '^#[0-9A-Fa-f]{6}$'),   -- price color on dark stamps
  views jsonb not null default '[]',           -- [{img, full, ar, bleed?, label?}] (phase 2 fills these from uploads)
  owner_handle text not null default '',       -- buyer's Instagram handle, no @ (phase 3)
  owner_demo boolean not null default false,
  sold_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);
create index pieces_drop on public.pieces (drop_id, position);

create or replace function public.touch() returns trigger language plpgsql as $$
begin new.updated_at = now(); new.updated_by = auth.uid(); return new; end $$;
create or replace function public.touch_drop() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger pieces_touch before update on public.pieces for each row execute function public.touch();
create trigger drops_touch before update on public.drops for each row execute function public.touch_drop();

-- security: only signed-in admins can read or change anything
alter table public.admins enable row level security;
alter table public.drops enable row level security;
alter table public.categories enable row level security;
alter table public.pieces enable row level security;

create policy "admins see themselves" on public.admins for select to authenticated using (user_id = auth.uid());
create policy "admins edit drops" on public.drops for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins edit categories" on public.categories for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins edit pieces" on public.pieces for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.drops, public.categories, public.pieces to authenticated;
grant select on public.admins to authenticated;

-- measurement templates (from the pieces on the site today)
insert into public.categories (code, label_ja, measurements, size_line, sort) values
  ('top',     'トップス・Tシャツ', '{着丈,身幅,肩幅,袖丈}',          '{着丈,身幅}',   10),
  ('jacket',  'ジャケット',         '{着丈,身幅,肩幅,袖丈}',          '{着丈,身幅}',   20),
  ('knit',    'ニット',             '{着丈,身幅,肩幅,袖丈}',          '{着丈,身幅}',   30),
  ('pants',   'パンツ',             '{ウエスト,股下,総丈,わたり,裾幅}', '{ウエスト,股下}', 40),
  ('bag',     'バッグ',             '{幅,高さ,マチ,ショルダー}',      '{幅,高さ}',     50),
  ('hat',     '帽子',               '{頭囲,つば}',                    '{頭囲,つば}',   60),
  ('socks',   'ソックス',           '{対応サイズ}',                   '{}',            70),
  ('scarf',   'マフラー・ネックウェア', '{全長,幅}',                  '{全長,幅}',     80),
  ('other',   'その他',             '{幅,高さ}',                      '{幅,高さ}',     90);
