-- Enable Cash Management Features
-- Run this SQL in your Supabase SQL Editor

-- 1. Create table for tracking cash movements (Petty Cash, etc.)
create table if not exists cash_movements (
  id uuid default gen_random_uuid() primary key,
  shift_id uuid references shifts(id),
  type text check (type in ('IN', 'OUT')),
  amount numeric not null,
  reason text,
  created_at timestamptz default now(),
  created_by_id uuid,
  created_by_name text
);

-- 2. Add new columns to shifts table for better reporting
-- These might fail if they already exist, which is fine
alter table shifts add column if not exists total_cash_sales numeric default 0;
alter table shifts add column if not exists total_cash_returns numeric default 0;
alter table shifts add column if not exists actual_cash numeric;
alter table shifts add column if not exists notes text;

-- 3. Add policy to allow authenticated users to insert/read (adjust as needed)
alter table cash_movements enable row level security;

create policy "Enable read access for all users" on cash_movements for select using (true);
create policy "Enable insert access for authenticated users" on cash_movements for insert with check (auth.role() = 'authenticated');
