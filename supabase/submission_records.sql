create extension if not exists pgcrypto;

create table if not exists public.submission_records (
  id uuid primary key default gen_random_uuid(),
  submitted_at timestamptz not null default timezone('utc', now()),
  date_iso text not null,
  company text not null,
  line_count integer not null default 0,
  total_hours numeric(10,2) not null default 0,
  email_to text not null
);

create index if not exists submission_records_submitted_at_idx
  on public.submission_records (submitted_at desc);

create index if not exists submission_records_date_iso_idx
  on public.submission_records (date_iso desc);
