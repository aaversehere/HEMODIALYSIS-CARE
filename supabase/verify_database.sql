select
  table_schema,
  table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'profiles',
    'schedules',
    'daily_summaries',
    'complaints',
    'complaint_tags'
  )
order by table_name;

select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'profiles',
    'schedules',
    'daily_summaries',
    'complaints',
    'complaint_tags'
  )
order by tablename;

select
  schemaname,
  tablename,
  policyname,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'profiles',
    'schedules',
    'daily_summaries',
    'complaints',
    'complaint_tags'
  )
order by tablename, policyname;
