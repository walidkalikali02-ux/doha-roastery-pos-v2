-- CFG-001..CFG-006 configuration support

alter table if exists public.system_settings
  add column if not exists default_barcode_format text not null default 'CODE128';

alter table if exists public.system_settings
  add column if not exists session_timeout_minutes integer not null default 30;

alter table if exists public.system_settings
  add constraint system_settings_default_barcode_format_check
  check (default_barcode_format in ('CODE128', 'EAN13'));

alter table if exists public.system_settings
  add constraint system_settings_session_timeout_minutes_check
  check (session_timeout_minutes between 5 and 480);

alter table if exists public.product_definitions
  add column if not exists overdraft_enabled boolean not null default false;

create table if not exists public.dispatch_reason_codes (
  id uuid default gen_random_uuid() primary key,
  code text not null unique,
  display_name text not null,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

insert into public.dispatch_reason_codes (code, display_name)
values
  ('SALE', 'Sale'),
  ('TRANSFER', 'Transfer'),
  ('WASTE', 'Waste'),
  ('DAMAGE', 'Damage'),
  ('CORRECTION', 'Correction')
on conflict (code) do nothing;

alter table public.dispatch_reason_codes enable row level security;
drop policy if exists "dispatch_reason_codes_read" on public.dispatch_reason_codes;
create policy "dispatch_reason_codes_read"
  on public.dispatch_reason_codes
  for select
  using (auth.uid() is not null);

drop policy if exists "dispatch_reason_codes_admin_manage" on public.dispatch_reason_codes;
create policy "dispatch_reason_codes_admin_manage"
  on public.dispatch_reason_codes
  for all
  using (current_user_is_admin())
  with check (current_user_is_admin());
