-- =========================================================
-- Digi Saarthi — Supabase one-time setup
-- Run this once in your Supabase project's SQL Editor
-- (Dashboard → SQL Editor → New query → paste → Run)
-- =========================================================

-- 1. The table that holds every service record
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  service_number text unique not null,
  customer_name text not null,
  service_type text not null,
  application_date date,
  payment_status text default 'Unpaid',
  service_status text default 'Pending',
  completion_date date,
  rejection_reason text,
  receipt_url text,
  certificate_url text,
  created_at timestamptz default now()
);

-- 2. Turn on Row Level Security (RLS) — this is what actually
--    protects the data. Nothing is allowed unless a policy below says so.
alter table public.services enable row level security;

-- 3. Only a logged-in admin (via Supabase Auth) can add/edit/delete/list.
--    This is what admin.js uses after you log in.
create policy "Admins can manage services"
on public.services
for all
to authenticated
using (true)
with check (true);

-- 4. Public search: a function that returns AT MOST the one record whose
--    service_number matches — never the full table. This is what
--    track.js / track.html call, using the public anon key.
create or replace function public.get_service(p_service_number text)
returns setof public.services
language sql
security definer
set search_path = public
as $$
  select * from public.services
  where upper(service_number) = upper(p_service_number)
  limit 1;
$$;

grant execute on function public.get_service(text) to anon, authenticated;

-- 5. (Optional) Seed your existing test/demo records so tracking
--    keeps working immediately after switching over.
insert into public.services
  (service_number, customer_name, service_type, application_date, payment_status, service_status, completion_date, rejection_reason, receipt_url, certificate_url)
values
  ('DS-2026-00125', 'Gobind Sahu', 'Caste Certificate', '2026-09-05', 'Paid', 'Completed', '2026-09-05', null,
    'https://drive.google.com/file/d/REPLACE_WITH_RECEIPT_FILE_ID/view?usp=sharing',
    'https://drive.google.com/file/d/REPLACE_WITH_CERTIFICATE_FILE_ID/view?usp=sharing'),
  ('DS-2026-00126', 'Sujata Naik', 'Ration Card', '2026-09-04', 'Paid', 'Processing', null, null, null, null),
  ('DS-2026-00127', 'Ramesh Majhi', 'PAN Card', '2026-09-03', 'Unpaid', 'Pending', null, null, null, null),
  ('DS-2026-00128', 'Anita Pradhan', 'Income Certificate', '2026-08-28', 'Paid', 'Rejected', null,
    'Submitted documents did not match Aadhaar address. Please visit the centre with updated proof of address.',
    null, null)
on conflict (service_number) do nothing;
