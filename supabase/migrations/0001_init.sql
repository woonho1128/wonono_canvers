-- KidPaint 초기 스키마 (설계서 7.2, 7.3, 7.4)
-- 적용 방법:
--   옵션 A: Supabase Dashboard → SQL Editor에 통째로 붙여넣기 → Run
--   옵션 B: supabase db push (Supabase CLI)

-- ============================================================
-- 1. 카테고리
-- ============================================================
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon_emoji text,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- 시스템 카테고리 시드 (idempotent)
insert into public.categories (name, icon_emoji, sort_order) values
  ('동물', '🐶', 1),
  ('탈것', '🚗', 2),
  ('공룡', '🦕', 3),
  ('음식', '🍎', 4),
  ('내 도안', '✨', 99)
on conflict do nothing;

-- ============================================================
-- 2. 도안
-- ============================================================
create table if not exists public.coloring_pages (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  title text,
  outline_path text not null,
  thumbnail_path text,
  source text not null check (source in ('default', 'user_upload')),
  is_hidden boolean default false,
  created_at timestamptz default now()
);

create index if not exists idx_pages_category on public.coloring_pages(category_id);
create index if not exists idx_pages_source on public.coloring_pages(source);

-- ============================================================
-- 3. 작품
-- ============================================================
create table if not exists public.artworks (
  id uuid primary key default gen_random_uuid(),
  page_id uuid references public.coloring_pages(id) on delete set null,
  image_path text not null,
  thumbnail_path text,
  created_at timestamptz default now()
);

create index if not exists idx_artworks_created on public.artworks(created_at desc);

-- ============================================================
-- 4. RLS — 단일 가족 모델 (사이트 비공개 + CORS 제한 전제)
-- ============================================================
alter table public.categories enable row level security;
alter table public.coloring_pages enable row level security;
alter table public.artworks enable row level security;

-- categories: anon read-only
drop policy if exists "anyone can read categories" on public.categories;
create policy "anyone can read categories" on public.categories
  for select using (true);

-- coloring_pages
drop policy if exists "read non-hidden pages" on public.coloring_pages;
create policy "read non-hidden pages" on public.coloring_pages
  for select using (is_hidden = false);

drop policy if exists "anyone can insert pages" on public.coloring_pages;
create policy "anyone can insert pages" on public.coloring_pages
  for insert with check (true);

drop policy if exists "anyone can update pages" on public.coloring_pages;
create policy "anyone can update pages" on public.coloring_pages
  for update using (true);

drop policy if exists "anyone can delete pages" on public.coloring_pages;
create policy "anyone can delete pages" on public.coloring_pages
  for delete using (true);

-- artworks (전부 anon 허용)
drop policy if exists "anyone can read artworks" on public.artworks;
create policy "anyone can read artworks" on public.artworks
  for select using (true);

drop policy if exists "anyone can insert artworks" on public.artworks;
create policy "anyone can insert artworks" on public.artworks
  for insert with check (true);

drop policy if exists "anyone can update artworks" on public.artworks;
create policy "anyone can update artworks" on public.artworks
  for update using (true);

drop policy if exists "anyone can delete artworks" on public.artworks;
create policy "anyone can delete artworks" on public.artworks
  for delete using (true);

-- ============================================================
-- 5. Storage 버킷 (설계서 7.4)
-- ============================================================
insert into storage.buckets (id, name, public)
  values ('outlines', 'outlines', true)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
  values ('artworks', 'artworks', true)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
  values ('thumbnails', 'thumbnails', true)
  on conflict (id) do nothing;

-- ============================================================
-- 6. Storage 정책
-- ============================================================
drop policy if exists "anyone can read outlines" on storage.objects;
create policy "anyone can read outlines"
  on storage.objects for select
  using (bucket_id = 'outlines');

drop policy if exists "anyone can write outlines" on storage.objects;
create policy "anyone can write outlines"
  on storage.objects for insert
  with check (bucket_id = 'outlines');

drop policy if exists "anyone can update outlines" on storage.objects;
create policy "anyone can update outlines"
  on storage.objects for update
  using (bucket_id = 'outlines');

drop policy if exists "anyone can delete outlines" on storage.objects;
create policy "anyone can delete outlines"
  on storage.objects for delete
  using (bucket_id = 'outlines');

drop policy if exists "anyone can read artworks storage" on storage.objects;
create policy "anyone can read artworks storage"
  on storage.objects for select
  using (bucket_id = 'artworks');

drop policy if exists "anyone can write artworks storage" on storage.objects;
create policy "anyone can write artworks storage"
  on storage.objects for insert
  with check (bucket_id = 'artworks');

drop policy if exists "anyone can update artworks storage" on storage.objects;
create policy "anyone can update artworks storage"
  on storage.objects for update
  using (bucket_id = 'artworks');

drop policy if exists "anyone can delete artworks storage" on storage.objects;
create policy "anyone can delete artworks storage"
  on storage.objects for delete
  using (bucket_id = 'artworks');

drop policy if exists "anyone can read thumbnails" on storage.objects;
create policy "anyone can read thumbnails"
  on storage.objects for select
  using (bucket_id = 'thumbnails');

drop policy if exists "anyone can write thumbnails" on storage.objects;
create policy "anyone can write thumbnails"
  on storage.objects for insert
  with check (bucket_id = 'thumbnails');

drop policy if exists "anyone can update thumbnails" on storage.objects;
create policy "anyone can update thumbnails"
  on storage.objects for update
  using (bucket_id = 'thumbnails');

drop policy if exists "anyone can delete thumbnails" on storage.objects;
create policy "anyone can delete thumbnails"
  on storage.objects for delete
  using (bucket_id = 'thumbnails');
