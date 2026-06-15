create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  patient_code text unique,
  gender text check (gender in ('male', 'female')),
  birth_date date,
  phone text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Hemodialisis',
  schedule_date date not null,
  start_time time not null,
  end_time time not null,
  place text not null,
  status text not null default 'upcoming'
    check (status in ('upcoming', 'done', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_time < end_time)
);

create table if not exists public.daily_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  summary_date date not null default current_date,
  weight numeric(5,2) check (weight is null or weight > 0),
  systolic integer check (systolic is null or systolic > 0),
  diastolic integer check (diastolic is null or diastolic > 0),
  fluid_ml integer check (fluid_ml is null or fluid_ml >= 0),
  medicine_count integer check (medicine_count is null or medicine_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, summary_date)
);

create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  color text not null default 'green'
    check (color in ('green', 'blue', 'purple', 'red', 'amber')),
  complaint_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.complaint_tags (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  tag text not null,
  created_at timestamptz not null default now(),
  unique (complaint_id, tag)
);

create index if not exists profiles_email_idx on public.profiles (email);
create index if not exists schedules_user_date_idx on public.schedules (user_id, schedule_date);
create index if not exists daily_summaries_user_date_idx on public.daily_summaries (user_id, summary_date);
create index if not exists complaints_user_date_idx on public.complaints (user_id, complaint_date desc);
create index if not exists complaint_tags_complaint_id_idx on public.complaint_tags (complaint_id);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_schedules_updated_at on public.schedules;
create trigger set_schedules_updated_at
before update on public.schedules
for each row execute function public.set_updated_at();

drop trigger if exists set_daily_summaries_updated_at on public.daily_summaries;
create trigger set_daily_summaries_updated_at
before update on public.daily_summaries
for each row execute function public.set_updated_at();

drop trigger if exists set_complaints_updated_at on public.complaints;
create trigger set_complaints_updated_at
before update on public.complaints
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.schedules enable row level security;
alter table public.daily_summaries enable row level security;
alter table public.complaints enable row level security;
alter table public.complaint_tags enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.schedules to authenticated;
grant select, insert, update, delete on public.daily_summaries to authenticated;
grant select, insert, update, delete on public.complaints to authenticated;
grant select, insert, update, delete on public.complaint_tags to authenticated;

drop policy if exists "Users can select own profile" on public.profiles;
create policy "Users can select own profile"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "Users can delete own profile" on public.profiles;
create policy "Users can delete own profile"
on public.profiles
for delete
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "Users can select own schedules" on public.schedules;
create policy "Users can select own schedules"
on public.schedules
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own schedules" on public.schedules;
create policy "Users can insert own schedules"
on public.schedules
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own schedules" on public.schedules;
create policy "Users can update own schedules"
on public.schedules
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own schedules" on public.schedules;
create policy "Users can delete own schedules"
on public.schedules
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can select own daily summaries" on public.daily_summaries;
create policy "Users can select own daily summaries"
on public.daily_summaries
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own daily summaries" on public.daily_summaries;
create policy "Users can insert own daily summaries"
on public.daily_summaries
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own daily summaries" on public.daily_summaries;
create policy "Users can update own daily summaries"
on public.daily_summaries
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own daily summaries" on public.daily_summaries;
create policy "Users can delete own daily summaries"
on public.daily_summaries
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can select own complaints" on public.complaints;
create policy "Users can select own complaints"
on public.complaints
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own complaints" on public.complaints;
create policy "Users can insert own complaints"
on public.complaints
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own complaints" on public.complaints;
create policy "Users can update own complaints"
on public.complaints
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own complaints" on public.complaints;
create policy "Users can delete own complaints"
on public.complaints
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can select own complaint tags" on public.complaint_tags;
create policy "Users can select own complaint tags"
on public.complaint_tags
for select
to authenticated
using (
  exists (
    select 1
    from public.complaints
    where complaints.id = complaint_tags.complaint_id
      and complaints.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can insert own complaint tags" on public.complaint_tags;
create policy "Users can insert own complaint tags"
on public.complaint_tags
for insert
to authenticated
with check (
  exists (
    select 1
    from public.complaints
    where complaints.id = complaint_tags.complaint_id
      and complaints.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can update own complaint tags" on public.complaint_tags;
create policy "Users can update own complaint tags"
on public.complaint_tags
for update
to authenticated
using (
  exists (
    select 1
    from public.complaints
    where complaints.id = complaint_tags.complaint_id
      and complaints.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.complaints
    where complaints.id = complaint_tags.complaint_id
      and complaints.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can delete own complaint tags" on public.complaint_tags;
create policy "Users can delete own complaint tags"
on public.complaint_tags
for delete
to authenticated
using (
  exists (
    select 1
    from public.complaints
    where complaints.id = complaint_tags.complaint_id
      and complaints.user_id = (select auth.uid())
  )
);
