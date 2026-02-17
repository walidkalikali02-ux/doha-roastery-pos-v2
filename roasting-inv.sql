begin;
create table if not exists green_bean_movements (
  id uuid default gen_random_uuid() primary key,
  bean_id uuid references green_beans(id) on delete set null,
  batch_reference text,
  movement_type text check (movement_type in ('ROASTING_CONSUMPTION')) not null,
  quantity numeric not null,
  unit text default 'kg',
  movement_at timestamptz default now(),
  created_at timestamptz default now(),
  created_by uuid,
  created_by_name text,
  notes text
);

alter table green_bean_movements enable row level security;
drop policy if exists "Auth all green bean movements" on green_bean_movements;
create policy "Auth all green bean movements" on green_bean_movements for all using (auth.role() = 'authenticated');
commit;
