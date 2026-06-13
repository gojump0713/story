-- ============================================================
-- 게시판 + 로그인 스키마 (Supabase)
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요.
-- 로그인은 Supabase Auth(이메일/비밀번호)를 사용하므로 별도 users 테이블이 필요 없습니다.
-- ============================================================

-- 1) 게시글 -------------------------------------------------
create table if not exists public.posts (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  content     text not null,
  author_id   uuid not null references auth.users (id) on delete cascade,
  author_name text not null default '',
  created_at  timestamptz not null default now()
);

create index if not exists posts_created_at_idx on public.posts (created_at desc);

-- 2) 댓글 ---------------------------------------------------
create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts (id) on delete cascade,
  content     text not null,
  author_id   uuid not null references auth.users (id) on delete cascade,
  author_name text not null default '',
  created_at  timestamptz not null default now()
);

create index if not exists comments_post_id_idx on public.comments (post_id, created_at);

-- 3) RLS (Row Level Security) -------------------------------
-- 읽기는 누구나, 쓰기/삭제는 로그인한 본인만.
alter table public.posts    enable row level security;
alter table public.comments enable row level security;

-- posts 정책
drop policy if exists "posts read"   on public.posts;
drop policy if exists "posts insert" on public.posts;
drop policy if exists "posts delete" on public.posts;

create policy "posts read"   on public.posts for select using (true);
create policy "posts insert" on public.posts for insert with check (auth.uid() = author_id);
create policy "posts delete" on public.posts for delete using (auth.uid() = author_id);

-- comments 정책
drop policy if exists "comments read"   on public.comments;
drop policy if exists "comments insert" on public.comments;
drop policy if exists "comments delete" on public.comments;

create policy "comments read"   on public.comments for select using (true);
create policy "comments insert" on public.comments for insert with check (auth.uid() = author_id);
create policy "comments delete" on public.comments for delete using (auth.uid() = author_id);
