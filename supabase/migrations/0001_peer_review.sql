-- Hệ thống đánh giá đồng đẳng và chẩn đoán lỗi – đoạn văn NLXH 200 chữ.
-- Máy chủ Next.js truy cập bằng service role và tự kiểm tra quyền ở API;
-- RLS dưới đây là lớp bảo vệ thứ hai nếu có truy cập trực tiếp bằng khóa anon.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role text not null default 'student' check (role in ('teacher', 'student')),
  class_name text,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists public.rubric_confirmations (
  id uuid primary key default gen_random_uuid(),
  rubric_version text not null,
  confirmed_by uuid not null references public.profiles (id),
  confirmed_at timestamptz not null default now(),
  notes text not null default ''
);

create table if not exists public.prompts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  issue_statement text not null,
  solution_groups jsonb not null default '[]'::jsonb,
  grading_guide text not null default '',
  rubric_version text not null,
  confirmed boolean not null default false,
  confirmed_by uuid references public.profiles (id),
  confirmed_at timestamptz,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  prompt_id uuid not null references public.prompts (id),
  rubric_version text not null,
  deadline timestamptz,
  rubric_published boolean not null default false,
  ai_visible boolean not null default false,
  status text not null default 'open' check (status in ('draft', 'open', 'closed')),
  pairing_mode text check (pairing_mode in ('pairs', 'rotation', 'groups', 'manual')),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table if not exists public.essays (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds (id) on delete cascade,
  prompt_id uuid not null references public.prompts (id),
  author_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (round_id, author_id)
);

-- Bài gốc và bản chỉnh sửa là các phiên bản độc lập.
create table if not exists public.essay_versions (
  id uuid primary key default gen_random_uuid(),
  essay_id uuid not null references public.essays (id) on delete cascade,
  version_no int not null,
  kind text not null check (kind in ('original', 'revision')),
  status text not null check (status in ('draft', 'final')),
  content text not null,
  word_count int not null default 0,
  parent_version_id uuid references public.essay_versions (id),
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  unique (essay_id, version_no)
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds (id) on delete cascade,
  writer_id uuid not null references public.profiles (id),
  reviewer_id uuid not null references public.profiles (id),
  group_label text,
  essay_version_id uuid references public.essay_versions (id),
  status text not null default 'assigned' check (status in ('assigned', 'in_progress', 'submitted')),
  created_at timestamptz not null default now(),
  check (writer_id <> reviewer_id),
  unique (round_id, writer_id, reviewer_id)
);

create table if not exists public.peer_reviews (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null unique references public.assignments (id) on delete cascade,
  essay_version_id uuid not null references public.essay_versions (id),
  rubric_version text not null,
  criteria jsonb not null,
  total numeric(4, 2),
  primary_error_code text,
  highlight text not null default '',
  main_issue_evidence text not null default '',
  main_issue_explanation text not null default '',
  suggestion text not null default '',
  feedback_check jsonb,
  status text not null check (status in ('draft', 'submitted')),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz
);

create table if not exists public.writer_responses (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null unique references public.assignments (id) on delete cascade,
  acceptance text check (acceptance in ('full', 'partial', 'discuss')),
  planned_actions text[] not null default '{}',
  explanation text not null default '',
  revised_version_id uuid references public.essay_versions (id),
  status text not null check (status in ('draft', 'submitted')),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_gradings (
  id uuid primary key default gen_random_uuid(),
  essay_version_id uuid not null references public.essay_versions (id) on delete cascade,
  prompt_id uuid not null references public.prompts (id),
  rubric_version text not null,
  result jsonb not null,
  total numeric(4, 2) not null,
  model text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.teacher_gradings (
  id uuid primary key default gen_random_uuid(),
  essay_version_id uuid not null unique references public.essay_versions (id) on delete cascade,
  rubric_version text not null,
  criteria jsonb not null,
  total numeric(4, 2) not null,
  graded_by uuid not null references public.profiles (id),
  updated_at timestamptz not null default now()
);

create index if not exists assignments_round_idx on public.assignments (round_id);
create index if not exists assignments_reviewer_idx on public.assignments (reviewer_id);
create index if not exists assignments_writer_idx on public.assignments (writer_id);
create index if not exists versions_essay_idx on public.essay_versions (essay_id);
create index if not exists ai_gradings_version_idx on public.ai_gradings (essay_version_id);

-- ------------------------------------------------------------------ RLS

create or replace function public.is_teacher() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'teacher');
$$;

alter table public.profiles enable row level security;
alter table public.rubric_confirmations enable row level security;
alter table public.prompts enable row level security;
alter table public.rounds enable row level security;
alter table public.essays enable row level security;
alter table public.essay_versions enable row level security;
alter table public.assignments enable row level security;
alter table public.peer_reviews enable row level security;
alter table public.writer_responses enable row level security;
alter table public.ai_gradings enable row level security;
alter table public.teacher_gradings enable row level security;

create policy profiles_self on public.profiles for select using (id = auth.uid() or public.is_teacher());
create policy teacher_all_profiles on public.profiles for all using (public.is_teacher());
create policy teacher_all_rubric on public.rubric_confirmations for all using (public.is_teacher());
create policy read_rubric on public.rubric_confirmations for select using (auth.uid() is not null);
create policy teacher_all_prompts on public.prompts for all using (public.is_teacher());
create policy teacher_all_rounds on public.rounds for all using (public.is_teacher());
create policy student_read_rounds on public.rounds for select using (auth.uid() is not null and status <> 'draft');
create policy teacher_all_essays on public.essays for all using (public.is_teacher());
create policy own_essays on public.essays for select using (author_id = auth.uid());
create policy teacher_all_versions on public.essay_versions for all using (public.is_teacher());
create policy own_versions on public.essay_versions for select using (
  exists (select 1 from public.essays e where e.id = essay_id and e.author_id = auth.uid())
);
create policy reviewer_versions on public.essay_versions for select using (
  exists (select 1 from public.assignments a where a.essay_version_id = essay_versions.id and a.reviewer_id = auth.uid())
);
create policy teacher_all_assignments on public.assignments for all using (public.is_teacher());
create policy own_assignments on public.assignments for select using (writer_id = auth.uid() or reviewer_id = auth.uid());
create policy teacher_all_reviews on public.peer_reviews for all using (public.is_teacher());
create policy reviewer_reviews on public.peer_reviews for select using (
  exists (select 1 from public.assignments a where a.id = assignment_id and a.reviewer_id = auth.uid())
);
create policy writer_reviews on public.peer_reviews for select using (
  status = 'submitted' and exists (select 1 from public.assignments a where a.id = assignment_id and a.writer_id = auth.uid())
);
create policy teacher_all_responses on public.writer_responses for all using (public.is_teacher());
create policy writer_responses_own on public.writer_responses for select using (
  exists (select 1 from public.assignments a where a.id = assignment_id and a.writer_id = auth.uid())
);
create policy teacher_all_ai on public.ai_gradings for all using (public.is_teacher());
create policy teacher_all_tg on public.teacher_gradings for all using (public.is_teacher());
