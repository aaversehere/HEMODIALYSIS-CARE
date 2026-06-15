create extension if not exists "pgcrypto";

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  patient_code text,
  gender text check (gender in ('male', 'female')),
  birth_date date,
  phone text,
  address text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Hemodialisis',
  schedule_date date not null,
  start_time time not null,
  end_time time not null,
  place text not null,
  status text not null default 'upcoming'
    check (status in ('upcoming', 'done', 'cancelled')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.daily_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  summary_date date not null default current_date,
  weight numeric(5,2),
  systolic integer,
  diastolic integer,
  fluid_ml integer,
  medicine_count integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, summary_date)
);

create table public.complaints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  color text default 'green'
    check (color in ('green', 'blue', 'purple', 'red', 'amber')),
  complaint_date date not null default current_date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.complaint_tags (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  tag text not null
);

alter table public.profiles enable row level security;
alter table public.schedules enable row level security;
alter table public.daily_summaries enable row level security;
alter table public.complaints enable row level security;
alter table public.complaint_tags enable row level security;

create policy "Users can manage own profile"
on public.profiles
for all
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Users can manage own schedules"
on public.schedules
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage own daily summaries"
on public.daily_summaries
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage own complaints"
on public.complaints
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can read own complaint tags"
on public.complaint_tags
for select
using (
  exists (
    select 1
    from public.complaints
    where complaints.id = complaint_tags.complaint_id
      and complaints.user_id = auth.uid()
  )
);

create policy "Users can insert own complaint tags"
on public.complaint_tags
for insert
with check (
  exists (
    select 1
    from public.complaints
    where complaints.id = complaint_tags.complaint_id
      and complaints.user_id = auth.uid()
  )
);

create policy "Users can delete own complaint tags"
on public.complaint_tags
for delete
using (
  exists (
    select 1
    from public.complaints
    where complaints.id = complaint_tags.complaint_id
      and complaints.user_id = auth.uid()
  )
);
