-- Enable Inventory & Warehouse Management Features
-- Run this SQL in your Supabase SQL Editor to set up the necessary tables and columns

-- 1. Locations Management
create table if not exists locations (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  type text check (type in ('WAREHOUSE', 'BRANCH', 'ROASTERY')),
  address text,
  contact_person_name text,
  contact_person_phone text,
  contact_person_email text,
  is_active boolean default true,
  is_roastery boolean default false,
  created_at timestamptz default now()
);

alter table locations add column if not exists code text;
alter table locations add column if not exists area text;
alter table locations add column if not exists city text;
alter table locations add column if not exists gps_lat numeric;
alter table locations add column if not exists gps_lng numeric;
alter table locations add column if not exists phone text;
alter table locations add column if not exists email text;
alter table locations add column if not exists fax text;
alter table locations add column if not exists operating_hours jsonb default '{}'::jsonb;
alter table locations add column if not exists branch_type text check (branch_type in ('MAIN', 'SUB_BRANCH', 'KIOSK', 'ONLINE')) default 'SUB_BRANCH';
alter table locations add column if not exists status text check (status in ('active', 'under_construction', 'temp_closed', 'permanently_closed')) default 'active';
alter table locations add column if not exists opening_date date;
alter table locations add column if not exists closing_date date;
alter table locations add column if not exists area_sqm numeric;
alter table locations add column if not exists seating_capacity integer;
alter table locations add column if not exists is_hq boolean default false;
alter table locations add column if not exists parent_location_id uuid references locations(id) on delete set null;
alter table locations add column if not exists commercial_license_number text;
alter table locations add column if not exists commercial_license_expiry date;
alter table locations add column if not exists logo_url text;
alter table locations add column if not exists exterior_photo_url text;
alter table locations add column if not exists interior_photo_url text;

create unique index if not exists locations_code_unique on locations(code) where code is not null;
create unique index if not exists locations_hq_unique on locations(is_hq) where is_hq = true;

create sequence if not exists location_code_seq start 1;

create or replace function generate_location_code()
returns trigger as $$
begin
  if new.code is null or btrim(new.code) = '' then
    new.code := 'DRB-' || lpad(nextval('location_code_seq')::text, 3, '0');
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_generate_location_code on locations;
create trigger trigger_generate_location_code
before insert on locations
for each row execute function generate_location_code();

create or replace function prevent_location_delete_if_dependent()
returns trigger as $$
begin
  if exists (select 1 from inventory_items where location_id = old.id and coalesce(stock, 0) > 0) then
    raise exception 'LOCATION_HAS_INVENTORY';
  end if;

  if exists (select 1 from inventory_movements where location_id = old.id limit 1) then
    raise exception 'LOCATION_HAS_TRANSACTIONS';
  end if;

  if exists (select 1 from purchase_orders where location_id = old.id limit 1) then
    raise exception 'LOCATION_HAS_PURCHASE_ORDERS';
  end if;

  if exists (select 1 from stock_transfers where source_location_id = old.id or destination_location_id = old.id limit 1) then
    raise exception 'LOCATION_HAS_TRANSFERS';
  end if;

  if exists (select 1 from production_orders where destination_location_id = old.id limit 1) then
    raise exception 'LOCATION_HAS_PRODUCTION_ORDERS';
  end if;

  if to_regclass('public.employees') is not null then
    if exists (select 1 from employees where location_id = old.id limit 1) then
      raise exception 'LOCATION_HAS_EMPLOYEES';
    end if;
  end if;

  if to_regclass('public.green_bean_stocks') is not null then
    if exists (select 1 from green_bean_stocks where location_id = old.id limit 1) then
      raise exception 'LOCATION_HAS_GREEN_BEAN_STOCK';
    end if;
  end if;

  return old;
end;
$$ language plpgsql;

drop trigger if exists trigger_prevent_location_delete on locations;
create trigger trigger_prevent_location_delete
before delete on locations
for each row execute function prevent_location_delete_if_dependent();

create or replace function current_user_is_warehouse_staff() returns boolean as $$
begin
  return exists (
    select 1 from profiles
    where id = auth.uid()
      and role = 'WAREHOUSE_STAFF'
  );
end;
$$ language plpgsql;

create or replace function current_user_is_admin() returns boolean as $$
begin
  return exists (
    select 1 from profiles
    where id = auth.uid()
      and role in ('ADMIN', 'OWNER')
  );
end;
$$ language plpgsql;

create or replace function current_user_is_manager() returns boolean as $$
begin
  return exists (
    select 1 from profiles
    where id = auth.uid()
      and role = 'MANAGER'
  );
end;
$$ language plpgsql;

create or replace function current_user_is_roaster() returns boolean as $$
begin
  return exists (
    select 1 from profiles
    where id = auth.uid()
      and role = 'ROASTER'
  );
end;
$$ language plpgsql;

create or replace function current_user_location_id() returns uuid as $$
declare
  v_location_id uuid;
begin
  select location_id into v_location_id
  from profiles
  where id = auth.uid();
  return v_location_id;
end;
$$ language plpgsql stable;

create or replace function current_user_can_access_location(p_location_id uuid) returns boolean as $$
begin
  return current_user_is_admin() or current_user_is_manager() or p_location_id = current_user_location_id();
end;
$$ language plpgsql stable;

-- 2. Stock Transfers
create table if not exists stock_transfers (
  id uuid default gen_random_uuid() primary key,
  source_location_id uuid references locations(id),
  destination_location_id uuid references locations(id),
  status text check (status in ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'IN_TRANSIT', 'RECEIVED', 'COMPLETED', 'CANCELLED')),
  created_at timestamptz default now(),
  received_at timestamptz,
  notes text,
  total_value numeric default 0,
  created_by uuid,
  manifest jsonb -- Storing items as JSON for simplicity: [{itemId, quantity, name, ...}]
);
alter table stock_transfers add column if not exists manifest jsonb;
alter table stock_transfers add column if not exists production_order_id uuid;

create table if not exists production_orders (
  id uuid default gen_random_uuid() primary key,
  destination_location_id uuid references locations(id),
  status text check (status in ('PENDING', 'IN_PRODUCTION', 'READY_FOR_TRANSFER', 'COMPLETED', 'CANCELLED')) default 'PENDING',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid,
  created_by_name text,
  batch_id text,
  transfer_id uuid references stock_transfers(id)
);

create table if not exists production_order_items (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references production_orders(id) on delete cascade,
  product_id uuid references product_definitions(id),
  size text,
  quantity numeric not null
);
alter table production_order_items add column if not exists size text;

create index if not exists production_orders_destination_status_created_idx
on production_orders(destination_location_id, status, created_at desc);

create index if not exists production_order_items_order_idx
on production_order_items(order_id);

create or replace function create_production_order(p_destination_location_id uuid, p_items jsonb, p_notes text, p_created_by uuid, p_created_by_name text)
returns uuid as $$
declare
  v_order_id uuid;
  item jsonb;
begin
  insert into production_orders (destination_location_id, notes, created_by, created_by_name)
  values (p_destination_location_id, p_notes, p_created_by, p_created_by_name)
  returning id into v_order_id;

  for item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    insert into production_order_items (order_id, product_id, size, quantity)
    values (
      v_order_id,
      nullif(item->>'product_id', '')::uuid,
      nullif(item->>'size', ''),
      coalesce((item->>'quantity')::numeric, 0)
    );
  end loop;

  return v_order_id;
end;
$$ language plpgsql security definer;

create or replace function create_transfer_for_production_order(p_order_id uuid, p_source_location_id uuid, p_manifest jsonb, p_user_id uuid, p_user_name text)
returns uuid as $$
declare
  v_order record;
  v_transfer_id uuid;
begin
  select * into v_order
  from production_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  insert into stock_transfers (
    source_location_id,
    destination_location_id,
    status,
    notes,
    created_by,
    manifest,
    production_order_id
  )
  values (
    p_source_location_id,
    v_order.destination_location_id,
    'APPROVED',
    format('Auto transfer for production order %s', p_order_id),
    p_user_id,
    coalesce(p_manifest, '[]'::jsonb),
    p_order_id
  )
  returning id into v_transfer_id;

  update production_orders
  set status = 'READY_FOR_TRANSFER',
      updated_at = now(),
      transfer_id = v_transfer_id
  where id = p_order_id;

  return v_transfer_id;
end;
$$ language plpgsql security definer;

-- 3. Purchase Orders
create table if not exists purchase_orders (
  id uuid default gen_random_uuid() primary key,
  supplier_name text not null,
  location_id uuid references locations(id),
  status text check (status in ('DRAFT', 'ORDERED', 'RECEIVED', 'PARTIALLY_RECEIVED', 'REJECTED', 'CANCELLED')) default 'DRAFT',
  created_at timestamptz default now(),
  received_at timestamptz,
  notes text,
  total_value numeric default 0,
  items_count int default 0,
  created_by uuid,
  manifest jsonb,
  received_manifest jsonb
);

create table if not exists inventory_lots (
  id uuid default gen_random_uuid() primary key,
  inventory_item_id uuid references inventory_items(id),
  purchase_order_id uuid references purchase_orders(id) on delete set null,
  location_id uuid references locations(id),
  received_at timestamptz default now(),
  expiry_date date,
  quantity_received numeric not null,
  quantity_remaining numeric,
  quality_status text check (quality_status in ('PASSED', 'FAILED')) default 'PASSED',
  created_by uuid,
  metadata jsonb
);
alter table inventory_lots add column if not exists quantity_remaining numeric;
update inventory_lots set quantity_remaining = coalesce(quantity_remaining, quantity_received) where quantity_remaining is null;

create table if not exists inventory_movements (
  id uuid default gen_random_uuid() primary key,
  inventory_item_id uuid references inventory_items(id),
  location_id uuid references locations(id),
  movement_type text check (movement_type in ('SALE', 'RETURN', 'PURCHASE_RECEIPT', 'TRANSFER_OUT', 'TRANSFER_IN', 'ADJUSTMENT', 'COUNT_APPROVAL', 'MANUAL_UPDATE', 'RETURN_TO_SUPPLIER')) not null,
  quantity numeric not null,
  before_stock numeric,
  after_stock numeric,
  reference_id text,
  actor_id uuid,
  actor_name text,
  created_at timestamptz default now(),
  metadata jsonb
);
alter table inventory_movements drop constraint if exists inventory_movements_movement_type_check;
alter table inventory_movements add constraint inventory_movements_movement_type_check check (movement_type in ('SALE', 'RETURN', 'PURCHASE_RECEIPT', 'TRANSFER_OUT', 'TRANSFER_IN', 'ADJUSTMENT', 'COUNT_APPROVAL', 'MANUAL_UPDATE', 'RETURN_TO_SUPPLIER'));

alter table inventory_movements enable row level security;
drop policy if exists "Auth read movements" on inventory_movements;
create policy "Auth read movements" on inventory_movements for select using (current_user_can_access_location(location_id));
drop policy if exists "Auth insert movements" on inventory_movements;
create policy "Auth insert movements" on inventory_movements for insert with check (current_user_can_access_location(location_id));

create or replace function get_profile_name(p_user_id uuid) returns text as $$
declare
  v_name text;
begin
  select coalesce(full_name, username)
  into v_name
  from profiles
  where id = p_user_id;
  return v_name;
end;
$$ language plpgsql;

create or replace function log_inventory_movement() returns trigger as $$
declare
  v_delta numeric;
  v_actor_id uuid;
  v_actor_name text;
  v_type text;
  v_reference text;
begin
  if new.stock is distinct from old.stock then
    v_delta := coalesce(new.stock, 0) - coalesce(old.stock, 0);
    if v_delta <> 0 then
      v_type := coalesce(nullif(current_setting('inventory.movement_type', true), ''), 'MANUAL_UPDATE');
      v_reference := nullif(current_setting('inventory.reference_id', true), '');
      v_actor_id := nullif(current_setting('inventory.actor_id', true), '')::uuid;
      if v_actor_id is null then
        v_actor_id := auth.uid();
      end if;
      v_actor_name := nullif(current_setting('inventory.actor_name', true), '');
      if v_actor_name is null and v_actor_id is not null then
        v_actor_name := get_profile_name(v_actor_id);
      end if;
      insert into inventory_movements (
        inventory_item_id, location_id, movement_type, quantity,
        before_stock, after_stock, reference_id, actor_id, actor_name, metadata
      ) values (
        new.id, new.location_id, v_type, v_delta,
        old.stock, new.stock, v_reference, v_actor_id, v_actor_name,
        jsonb_build_object('source', 'inventory_items')
      );
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

create table if not exists accounting_entries (
  id uuid default gen_random_uuid() primary key,
  purchase_order_id uuid references purchase_orders(id) on delete set null,
  stock_adjustment_id uuid references stock_adjustments(id) on delete set null,
  entry_type text check (entry_type in ('PURCHASE', 'ADJUSTMENT', 'LOSS', 'COGS', 'WIP', 'FINISHED_GOODS', 'WASTE', 'SALE_REVENUE')) not null,
  amount numeric not null,
  created_at timestamptz default now(),
  created_by uuid,
  metadata jsonb,
  transaction_id text,
  debit_account text,
  credit_account text,
  batch_id text
);
alter table accounting_entries add column if not exists stock_adjustment_id uuid;
alter table accounting_entries add column if not exists transaction_id text;
alter table accounting_entries add column if not exists debit_account text;
alter table accounting_entries add column if not exists credit_account text;
alter table accounting_entries add column if not exists batch_id text;
alter table accounting_entries drop constraint if exists accounting_entries_entry_type_check;
alter table accounting_entries add constraint accounting_entries_entry_type_check check (entry_type in ('PURCHASE', 'ADJUSTMENT', 'LOSS', 'COGS', 'WIP', 'FINISHED_GOODS', 'WASTE', 'SALE_REVENUE'));

do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'stock_adjustments') then
    alter table accounting_entries
      add constraint accounting_entries_stock_adjustment_fk
      foreign key (stock_adjustment_id) references stock_adjustments(id) on delete set null;
  end if;
exception
  when duplicate_object then null;
end;
$$ language plpgsql;

create unique index if not exists accounting_entries_purchase_order_unique
on accounting_entries(purchase_order_id)
where purchase_order_id is not null;

create unique index if not exists accounting_entries_stock_adjustment_unique
on accounting_entries(stock_adjustment_id)
where stock_adjustment_id is not null;

create unique index if not exists accounting_entries_transaction_cogs_unique
on accounting_entries(transaction_id)
where transaction_id is not null and entry_type = 'COGS';

create or replace function handle_purchase_order_accounting_entry() returns trigger as $$
declare
  item jsonb;
  total_amount numeric := 0;
  has_unit_cost boolean := false;
begin
  if (tg_op in ('INSERT', 'UPDATE')) then
    if (new.status in ('RECEIVED', 'PARTIALLY_RECEIVED')
        and (old.status is distinct from new.status)) then
      for item in
        select * from jsonb_array_elements(coalesce(new.received_manifest, new.manifest, '[]'::jsonb))
      loop
        if (item ? 'unitCost') or (item ? 'unit_cost') then
          has_unit_cost := true;
        end if;
        total_amount := total_amount + (coalesce((item->>'receivedQty')::numeric, (item->>'quantity')::numeric, 0) *
          coalesce((item->>'unitCost')::numeric, (item->>'unit_cost')::numeric, 0));
      end loop;

      if not has_unit_cost then
        total_amount := coalesce(new.total_value, 0);
      end if;

      insert into accounting_entries (purchase_order_id, entry_type, amount, created_by, metadata, debit_account, credit_account)
      select new.id, 'PURCHASE', coalesce(total_amount, 0), new.created_by,
             jsonb_build_object('supplier_name', new.supplier_name, 'location_id', new.location_id, 'status', new.status),
             'INVENTORY',
             'SUPPLIERS_OR_BANK'
      where not exists (
        select 1 from accounting_entries
        where purchase_order_id = new.id
      );
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists purchase_order_accounting_entry on purchase_orders;
create trigger purchase_order_accounting_entry
after insert or update on purchase_orders
for each row execute function handle_purchase_order_accounting_entry();

create or replace function handle_stock_adjustment_accounting_entry() returns trigger as $$
begin
  if (tg_op = 'INSERT') then
    insert into accounting_entries (stock_adjustment_id, entry_type, amount, created_by, metadata, debit_account, credit_account)
    values (
      new.id,
      case
        when new.reason = 'ROASTING_WASTE' then 'WASTE'
        when new.quantity < 0 then 'LOSS'
        else 'ADJUSTMENT'
      end,
      coalesce(abs(new.value), abs(new.quantity)),
      new.user_id,
      jsonb_build_object(
        'reason', new.reason,
        'location_id', new.location_id,
        'status', new.status,
        'item_name', new.item_name,
        'location_name', new.location_name
      ),
      case
        when new.reason = 'ROASTING_WASTE' then 'WASTE_LOSS'
        when new.quantity < 0 then 'INVENTORY_LOSS'
        else 'INVENTORY'
      end,
      case
        when new.reason = 'ROASTING_WASTE' then 'WIP'
        when new.quantity < 0 then 'INVENTORY'
        else 'INVENTORY_ADJUSTMENT'
      end
    );
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists stock_adjustment_accounting_entry on stock_adjustments;
create trigger stock_adjustment_accounting_entry
after insert on stock_adjustments
for each row execute function handle_stock_adjustment_accounting_entry();

-- 4. Stock Adjustments
create table if not exists stock_adjustments (
  id uuid default gen_random_uuid() primary key,
  item_id uuid references inventory_items(id),
  location_id uuid references locations(id),
  quantity numeric not null,
  reason text check (reason in ('DAMAGE', 'THEFT', 'COUNTING_ERROR', 'GIFT', 'SAMPLE', 'EXPIRY', 'OTHER')),
  notes text,
  status text check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  created_at timestamptz default now(),
  user_name text,
  user_id uuid,
  value numeric,
  item_name text,
  location_name text
);

alter table stock_adjustments add column if not exists item_id uuid references inventory_items(id);
alter table stock_adjustments add column if not exists item_name text;
alter table stock_adjustments add column if not exists location_name text;
alter table stock_adjustments drop constraint if exists stock_adjustments_reason_check;
alter table stock_adjustments add constraint stock_adjustments_reason_check check (reason in ('DAMAGE', 'THEFT', 'COUNTING_ERROR', 'GIFT', 'SAMPLE', 'EXPIRY', 'ROASTING_WASTE', 'QC_REJECTED', 'RETURN_TO_SUPPLIER', 'OTHER'));

create table if not exists inventory_count_tasks (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  location_id uuid references locations(id),
  frequency text check (frequency in ('DAILY', 'WEEKLY', 'MONTHLY', 'ANNUAL')) not null,
  start_date date not null default current_date,
  next_run_date date not null default current_date,
  last_run_date date,
  status text check (status in ('ACTIVE', 'PAUSED')) default 'ACTIVE',
  notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table inventory_count_tasks add column if not exists updated_by uuid;

create table if not exists inventory_count_entries (
  id uuid default gen_random_uuid() primary key,
  count_task_id uuid references inventory_count_tasks(id) on delete set null,
  inventory_item_id uuid references inventory_items(id),
  location_id uuid references locations(id),
  counted_qty numeric not null,
  system_qty numeric,
  variance numeric,
  variance_percent numeric,
  variance_value numeric,
  counted_at timestamptz default now(),
  counted_by uuid,
  counted_by_name text,
  status text check (status in ('PENDING', 'APPROVED', 'REJECTED')) default 'PENDING',
  approved_by uuid,
  approved_by_name text,
  approved_at timestamptz,
  notes text
);

alter table inventory_count_entries add column if not exists variance_percent numeric;
alter table inventory_count_entries add column if not exists variance_value numeric;
alter table inventory_count_entries add column if not exists counted_by_name text;
alter table inventory_count_entries add column if not exists status text check (status in ('PENDING', 'APPROVED', 'REJECTED')) default 'PENDING';
alter table inventory_count_entries add column if not exists approved_by uuid;
alter table inventory_count_entries add column if not exists approved_by_name text;
alter table inventory_count_entries add column if not exists approved_at timestamptz;

create or replace function handle_count_entry_variance() returns trigger as $$
declare
  current_stock numeric;
  item_cost numeric;
begin
  if new.system_qty is null then
    select stock, cost_per_unit into current_stock, item_cost from inventory_items where id = new.inventory_item_id;
    new.system_qty := coalesce(current_stock, 0);
  else
    select cost_per_unit into item_cost from inventory_items where id = new.inventory_item_id;
  end if;

  new.variance := coalesce(new.counted_qty, 0) - coalesce(new.system_qty, 0);
  if coalesce(new.system_qty, 0) = 0 then
    new.variance_percent := null;
  else
    new.variance_percent := (abs(new.variance) / nullif(new.system_qty, 0)) * 100;
  end if;
  new.variance_value := coalesce(new.variance, 0) * coalesce(item_cost, 0);
  return new;
end;
$$ language plpgsql;

drop trigger if exists count_entry_variance_update on inventory_count_entries;
create trigger count_entry_variance_update
before insert or update on inventory_count_entries
for each row execute function handle_count_entry_variance();

create or replace function handle_count_entry_approval() returns trigger as $$
begin
  if (tg_op = 'UPDATE' and new.status = 'APPROVED' and old.status is distinct from 'APPROVED') then
    perform set_config('inventory.movement_type', 'COUNT_APPROVAL', true);
    perform set_config('inventory.reference_id', new.id::text, true);
    perform set_config('inventory.actor_id', coalesce(new.approved_by::text, ''), true);
    update inventory_items
    set stock = new.counted_qty,
        last_movement_at = now()
    where id = new.inventory_item_id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists count_entry_approval_update on inventory_count_entries;
create trigger count_entry_approval_update
after update on inventory_count_entries
for each row execute function handle_count_entry_approval();

create or replace view warehouse_kpi_metrics as
with count_metrics as (
  select
    location_id,
    date_trunc('month', counted_at) as period_month,
    round(avg(100 - variance_percent)::numeric, 2) as count_accuracy_percent,
    count(*) as count_entries
  from inventory_count_entries
  where status = 'APPROVED' and variance_percent is not null
  group by location_id, date_trunc('month', counted_at)
),
adjust_metrics as (
  select
    location_id,
    date_trunc('month', created_at) as period_month,
    count(*) as adjustments_count
  from stock_adjustments
  where status = 'APPROVED'
  group by location_id, date_trunc('month', created_at)
)
select
  coalesce(c.location_id, a.location_id) as location_id,
  coalesce(c.period_month, a.period_month) as period_month,
  c.count_accuracy_percent,
  c.count_entries,
  coalesce(a.adjustments_count, 0) as adjustments_count
from count_metrics c
full join adjust_metrics a
  on c.location_id = a.location_id
  and c.period_month = a.period_month;

create or replace view stock_count_results_report as
select
  e.id as count_entry_id,
  e.count_task_id,
  e.inventory_item_id,
  i.product_id,
  i.name as product_name,
  e.location_id,
  l.name as location_name,
  e.counted_qty,
  e.system_qty,
  e.variance,
  e.variance_percent,
  e.variance_value,
  case
    when e.variance_percent is null then null
    else round((100 - e.variance_percent)::numeric, 2)
  end as accuracy_rate,
  e.status,
  e.counted_at,
  e.counted_by,
  e.counted_by_name,
  e.approved_by,
  e.approved_by_name,
  e.approved_at,
  e.notes
from inventory_count_entries e
left join inventory_items i on i.id = e.inventory_item_id
left join locations l on l.id = e.location_id;

create or replace view warehouse_staff_performance_report as
with count_metrics as (
  select
    counted_by as staff_id,
    counted_by_name as staff_name,
    location_id,
    date_trunc('month', counted_at) as period_month,
    count(*) as count_entries,
    round(avg(100 - variance_percent)::numeric, 2) as accuracy_rate,
    round(avg(abs(variance_percent))::numeric, 2) as avg_variance_percent,
    round(avg(extract(epoch from (approved_at - counted_at)) / 3600)::numeric, 2) as approval_speed_hours
  from inventory_count_entries
  where status = 'APPROVED' and variance_percent is not null
  group by counted_by, counted_by_name, location_id, date_trunc('month', counted_at)
),
adjust_metrics as (
  select
    user_id as staff_id,
    user_name as staff_name,
    location_id,
    date_trunc('month', created_at) as period_month,
    count(*) as adjustments_count
  from stock_adjustments
  where status = 'APPROVED'
  group by user_id, user_name, location_id, date_trunc('month', created_at)
)
select
  coalesce(c.staff_id, a.staff_id) as staff_id,
  coalesce(c.staff_name, a.staff_name) as staff_name,
  coalesce(c.location_id, a.location_id) as location_id,
  l.name as location_name,
  coalesce(c.period_month, a.period_month) as period_month,
  c.count_entries,
  c.accuracy_rate,
  c.avg_variance_percent,
  c.approval_speed_hours,
  coalesce(a.adjustments_count, 0) as adjustments_count
from count_metrics c
full join adjust_metrics a
  on c.staff_id = a.staff_id
  and c.location_id = a.location_id
  and c.period_month = a.period_month
left join locations l on l.id = coalesce(c.location_id, a.location_id);

create or replace function handle_stock_adjustment_apply() returns trigger as $$
begin
  if (new.status = 'APPROVED' and (tg_op = 'INSERT' or old.status is distinct from 'APPROVED')) then
    perform set_config('inventory.movement_type', 'ADJUSTMENT', true);
    perform set_config('inventory.reference_id', new.id::text, true);
    perform set_config('inventory.actor_id', coalesce(new.user_id::text, ''), true);
    update inventory_items
    set stock = coalesce(stock, 0) + new.quantity,
        last_movement_at = now()
    where id = new.item_id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists stock_adjustment_apply on stock_adjustments;
create trigger stock_adjustment_apply
after insert or update on stock_adjustments
for each row execute function handle_stock_adjustment_apply();

-- 4. Enable RLS
alter table locations enable row level security;
drop policy if exists "Public read locations" on locations;
create policy "Public read locations" on locations for select using (true);
drop policy if exists "Auth all locations" on locations;
create policy "Auth all locations" on locations for all using (auth.role() = 'authenticated');

alter table stock_transfers enable row level security;
drop policy if exists "Auth all transfers" on stock_transfers;
drop policy if exists "Auth read transfers" on stock_transfers;
drop policy if exists "Warehouse write transfers" on stock_transfers;
drop policy if exists "Warehouse insert transfers" on stock_transfers;
drop policy if exists "Warehouse update transfers" on stock_transfers;
drop policy if exists "Warehouse delete transfers" on stock_transfers;
create policy "Auth read transfers" on stock_transfers for select using (current_user_is_admin() or current_user_can_access_location(source_location_id) or current_user_can_access_location(destination_location_id));
create policy "Warehouse insert transfers" on stock_transfers for insert with check (current_user_is_warehouse_staff() and (current_user_can_access_location(source_location_id) or current_user_can_access_location(destination_location_id)));
create policy "Warehouse update transfers" on stock_transfers for update using (current_user_is_warehouse_staff() and (current_user_can_access_location(source_location_id) or current_user_can_access_location(destination_location_id)));
create policy "Warehouse delete transfers" on stock_transfers for delete using (current_user_is_warehouse_staff() and (current_user_can_access_location(source_location_id) or current_user_can_access_location(destination_location_id)));

alter table production_orders enable row level security;
drop policy if exists "Auth read production orders" on production_orders;
drop policy if exists "Auth insert production orders" on production_orders;
drop policy if exists "Auth update production orders" on production_orders;
create policy "Auth read production orders"
  on production_orders
  for select
  using (current_user_is_admin() or current_user_is_roaster() or current_user_is_warehouse_staff() or current_user_can_access_location(destination_location_id));
create policy "Auth insert production orders"
  on production_orders
  for insert
  with check (auth.role() = 'authenticated' and current_user_can_access_location(destination_location_id));
create policy "Auth update production orders"
  on production_orders
  for update
  using (current_user_is_admin() or current_user_is_roaster() or current_user_is_warehouse_staff());

alter table production_order_items enable row level security;
drop policy if exists "Auth read production order items" on production_order_items;
drop policy if exists "Auth insert production order items" on production_order_items;
drop policy if exists "Auth update production order items" on production_order_items;
create policy "Auth read production order items"
  on production_order_items
  for select
  using (
    exists (
      select 1
      from production_orders o
      where o.id = production_order_items.order_id
        and (current_user_is_admin() or current_user_is_roaster() or current_user_is_warehouse_staff() or current_user_can_access_location(o.destination_location_id))
    )
  );
create policy "Auth insert production order items"
  on production_order_items
  for insert
  with check (
    exists (
      select 1
      from production_orders o
      where o.id = production_order_items.order_id
        and current_user_can_access_location(o.destination_location_id)
    )
  );
create policy "Auth update production order items"
  on production_order_items
  for update
  using (current_user_is_admin() or current_user_is_roaster() or current_user_is_warehouse_staff());

alter table purchase_orders enable row level security;
drop policy if exists "Auth all purchase orders" on purchase_orders;
drop policy if exists "Auth read purchase orders" on purchase_orders;
drop policy if exists "Warehouse write purchase orders" on purchase_orders;
drop policy if exists "Warehouse insert purchase orders" on purchase_orders;
drop policy if exists "Warehouse update purchase orders" on purchase_orders;
drop policy if exists "Warehouse delete purchase orders" on purchase_orders;
create policy "Auth read purchase orders" on purchase_orders for select using (current_user_can_access_location(location_id));
create policy "Warehouse insert purchase orders" on purchase_orders for insert with check (current_user_is_warehouse_staff() and current_user_can_access_location(location_id));
create policy "Warehouse update purchase orders" on purchase_orders for update using (current_user_is_warehouse_staff() and current_user_can_access_location(location_id));
create policy "Warehouse delete purchase orders" on purchase_orders for delete using (current_user_is_warehouse_staff() and current_user_can_access_location(location_id));

alter table inventory_lots enable row level security;
drop policy if exists "Auth all inventory lots" on inventory_lots;
drop policy if exists "Auth read inventory lots" on inventory_lots;
drop policy if exists "Warehouse write inventory lots" on inventory_lots;
drop policy if exists "Warehouse insert inventory lots" on inventory_lots;
drop policy if exists "Warehouse update inventory lots" on inventory_lots;
drop policy if exists "Warehouse delete inventory lots" on inventory_lots;
create policy "Auth read inventory lots" on inventory_lots for select using (current_user_can_access_location(location_id));
create policy "Warehouse insert inventory lots" on inventory_lots for insert with check (current_user_is_warehouse_staff() and current_user_can_access_location(location_id));
create policy "Warehouse update inventory lots" on inventory_lots for update using (current_user_is_warehouse_staff() and current_user_can_access_location(location_id));
create policy "Warehouse delete inventory lots" on inventory_lots for delete using (current_user_is_warehouse_staff() and current_user_can_access_location(location_id));

alter table accounting_entries enable row level security;
drop policy if exists "Auth all accounting entries" on accounting_entries;
drop policy if exists "Auth read accounting entries" on accounting_entries;
drop policy if exists "Auth insert accounting entries" on accounting_entries;
create policy "Auth read accounting entries" on accounting_entries for select using (current_user_is_admin() or current_user_is_manager());
create policy "Auth insert accounting entries" on accounting_entries for insert with check (auth.role() = 'authenticated');

create or replace function log_accounting_entries_roasting_changes()
returns trigger as $$
declare
  v_batch_id text;
begin
  v_batch_id := coalesce(new.batch_id, old.batch_id);
  if v_batch_id is null then
    return coalesce(new, old);
  end if;

  if to_regclass('public.roasting_audit_logs') is null then
    return coalesce(new, old);
  end if;

  if (tg_op = 'INSERT') then
    insert into public.roasting_audit_logs (table_name, record_id, batch_id, changed_by, change_type, new_data)
    values ('accounting_entries', new.id::text, v_batch_id, auth.uid(), 'INSERT', row_to_json(new));
    return new;
  elsif (tg_op = 'UPDATE') then
    insert into public.roasting_audit_logs (table_name, record_id, batch_id, changed_by, change_type, old_data, new_data)
    values ('accounting_entries', new.id::text, v_batch_id, auth.uid(), 'UPDATE', row_to_json(old), row_to_json(new));
    return new;
  elsif (tg_op = 'DELETE') then
    insert into public.roasting_audit_logs (table_name, record_id, batch_id, changed_by, change_type, old_data)
    values ('accounting_entries', old.id::text, v_batch_id, auth.uid(), 'DELETE', row_to_json(old));
    return old;
  end if;

  return coalesce(new, old);
end;
$$ language plpgsql security definer;

drop trigger if exists trigger_log_accounting_entries_roasting_changes on accounting_entries;
create trigger trigger_log_accounting_entries_roasting_changes
after insert on accounting_entries
for each row execute function log_accounting_entries_roasting_changes();

alter table stock_adjustments enable row level security;
drop policy if exists "Auth all adjustments" on stock_adjustments;
drop policy if exists "Auth read adjustments" on stock_adjustments;
drop policy if exists "Warehouse write adjustments" on stock_adjustments;
drop policy if exists "Warehouse insert adjustments" on stock_adjustments;
drop policy if exists "Warehouse update adjustments" on stock_adjustments;
create policy "Auth read adjustments" on stock_adjustments for select using (current_user_can_access_location(location_id));
create policy "Warehouse insert adjustments" on stock_adjustments for insert with check (current_user_is_warehouse_staff() and current_user_can_access_location(location_id));
create policy "Warehouse update adjustments" on stock_adjustments for update using (current_user_is_warehouse_staff() and current_user_can_access_location(location_id));

alter table inventory_count_tasks enable row level security;
drop policy if exists "Auth all count tasks" on inventory_count_tasks;
drop policy if exists "Auth read count tasks" on inventory_count_tasks;
drop policy if exists "Warehouse write count tasks" on inventory_count_tasks;
drop policy if exists "Warehouse insert count tasks" on inventory_count_tasks;
drop policy if exists "Warehouse update count tasks" on inventory_count_tasks;
drop policy if exists "Warehouse delete count tasks" on inventory_count_tasks;
create policy "Auth read count tasks" on inventory_count_tasks for select using (current_user_can_access_location(location_id));
create policy "Warehouse insert count tasks" on inventory_count_tasks for insert with check (current_user_is_warehouse_staff() and current_user_can_access_location(location_id));
create policy "Warehouse update count tasks" on inventory_count_tasks for update using (current_user_is_warehouse_staff() and current_user_can_access_location(location_id));
create policy "Warehouse delete count tasks" on inventory_count_tasks for delete using (current_user_is_warehouse_staff() and current_user_can_access_location(location_id));

alter table inventory_count_entries enable row level security;
drop policy if exists "Auth all count entries" on inventory_count_entries;
drop policy if exists "Auth read count entries" on inventory_count_entries;
drop policy if exists "Warehouse write count entries" on inventory_count_entries;
drop policy if exists "Warehouse insert count entries" on inventory_count_entries;
drop policy if exists "Warehouse update count entries" on inventory_count_entries;
create policy "Auth read count entries" on inventory_count_entries for select using (current_user_can_access_location(location_id));
create policy "Warehouse insert count entries" on inventory_count_entries for insert with check (current_user_is_warehouse_staff() and current_user_can_access_location(location_id));
create policy "Warehouse update count entries" on inventory_count_entries for update using (current_user_is_warehouse_staff() and current_user_can_access_location(location_id));

-- 5. Seed Initial Locations if empty
insert into locations (name, type, is_roastery, address)
select 'Central Roastery', 'ROASTERY', true, 'Industrial Area, Doha'
where not exists (select 1 from locations where type = 'ROASTERY');

insert into locations (name, type, is_roastery, address)
select 'Katara Branch', 'BRANCH', false, 'Katara Cultural Village'
where not exists (select 1 from locations where type = 'BRANCH');

alter table inventory_items add column if not exists location_id uuid references locations(id);
create index if not exists inventory_items_location_id_idx on inventory_items(location_id);
alter table inventory_items add column if not exists batch_id text;
alter table inventory_items add column if not exists bean_origin text;
alter table inventory_items add column if not exists bean_variety text;
alter table inventory_items add column if not exists roast_level text;
alter table inventory_items add column if not exists reserved_stock numeric default 0;
alter table inventory_items add column if not exists damaged_stock numeric default 0;
alter table inventory_items add column if not exists min_stock numeric;
alter table inventory_items add column if not exists max_stock numeric;
alter table inventory_items add column if not exists expiry_date date;
alter table inventory_items add column if not exists roast_date date;
alter table inventory_items add column if not exists last_movement_at timestamptz default now();
alter table inventory_items add column if not exists product_id uuid references product_definitions(id);
create index if not exists inventory_items_product_id_idx on inventory_items(product_id);
create index if not exists inventory_items_location_product_idx on inventory_items(location_id, product_id);
create index if not exists inventory_items_location_stock_idx on inventory_items(location_id, stock);
create index if not exists inventory_items_name_lower_idx on inventory_items(lower(name));
create index if not exists inventory_items_sku_prefix_idx on inventory_items(sku_prefix);
create index if not exists inventory_items_expiry_date_idx on inventory_items(expiry_date);
create index if not exists inventory_items_last_movement_idx on inventory_items(last_movement_at);
create index if not exists inventory_movements_location_created_idx on inventory_movements(location_id, created_at);
create index if not exists inventory_movements_type_created_idx on inventory_movements(movement_type, created_at);
create index if not exists stock_adjustments_location_created_idx on stock_adjustments(location_id, created_at);
create index if not exists stock_adjustments_status_created_idx on stock_adjustments(status, created_at);
create index if not exists inventory_count_entries_location_counted_idx on inventory_count_entries(location_id, counted_at);
create index if not exists inventory_count_entries_status_counted_idx on inventory_count_entries(status, counted_at);
create index if not exists purchase_orders_location_created_idx on purchase_orders(location_id, created_at);
create index if not exists stock_transfers_source_created_idx on stock_transfers(source_location_id, created_at);
create index if not exists stock_transfers_dest_created_idx on stock_transfers(destination_location_id, created_at);
create index if not exists inventory_lots_location_received_idx on inventory_lots(location_id, received_at);

alter table inventory_items enable row level security;
drop policy if exists "Auth read inventory items" on inventory_items;
drop policy if exists "Warehouse update inventory items" on inventory_items;
drop policy if exists "Warehouse insert inventory items" on inventory_items;
drop policy if exists "Warehouse delete inventory items" on inventory_items;
create policy "Auth read inventory items" on inventory_items for select using (current_user_can_access_location(location_id));
create policy "Warehouse update inventory items" on inventory_items for update using (current_user_can_access_location(location_id) and (current_user_is_warehouse_staff() or current_setting('inventory.movement_type', true) in ('SALE', 'RETURN', 'TRANSFER_OUT', 'TRANSFER_IN', 'COUNT_APPROVAL', 'ADJUSTMENT')));
create policy "Warehouse insert inventory items" on inventory_items for insert with check (current_user_is_warehouse_staff() and current_user_can_access_location(location_id));
create policy "Warehouse delete inventory items" on inventory_items for delete using (current_user_is_warehouse_staff() and current_user_can_access_location(location_id));

drop trigger if exists inventory_movement_log on inventory_items;
create trigger inventory_movement_log
after update of stock on inventory_items
for each row execute function log_inventory_movement();

create or replace view product_location_stock as
select
  i.id as inventory_item_id,
  i.product_id,
  i.name as product_name,
  i.sku_prefix,
  i.location_id,
  i.stock,
  greatest(0, coalesce(i.stock, 0) - coalesce(i.reserved_stock, 0) - coalesce(i.damaged_stock, 0)) as available_stock,
  i.min_stock,
  i.max_stock,
  i.expiry_date,
  i.last_movement_at
from inventory_items i;

create or replace view low_stock_report as
select
  pls.*,
  l.name as location_name
from product_location_stock pls
join locations l on l.id = pls.location_id
where pls.min_stock is not null
  and pls.stock < pls.min_stock;

create or replace view overstock_report as
select
  pls.*,
  l.name as location_name
from product_location_stock pls
join locations l on l.id = pls.location_id
where pls.max_stock is not null
  and pls.stock > pls.max_stock;

create or replace view expiring_products_report as
select
  pls.*,
  l.name as location_name,
  (pls.expiry_date - current_date) as days_to_expiry,
  case
    when pls.expiry_date between current_date and current_date + 7 then 7
    when pls.expiry_date between current_date + 8 and current_date + 14 then 14
    when pls.expiry_date between current_date + 15 and current_date + 30 then 30
    else null
  end as expiry_bucket_days
from product_location_stock pls
join locations l on l.id = pls.location_id
where pls.expiry_date is not null
  and pls.expiry_date >= current_date
  and pls.expiry_date <= current_date + 30;

create or replace view expired_products_report as
select
  pls.*,
  l.name as location_name,
  (current_date - pls.expiry_date) as days_expired
from product_location_stock pls
join locations l on l.id = pls.location_id
where pls.expiry_date is not null
  and pls.expiry_date < current_date;

create or replace view stagnant_products_report as
select
  pls.*,
  l.name as location_name,
  (current_date - coalesce(pls.last_movement_at::date, current_date)) as days_since_movement
from product_location_stock pls
join locations l on l.id = pls.location_id;

create or replace view stock_movement_report as
select
  m.id as movement_id,
  m.inventory_item_id,
  i.product_id,
  i.name as product_name,
  i.sku_prefix,
  m.location_id,
  l.name as location_name,
  m.movement_type,
  m.quantity,
  m.before_stock,
  m.after_stock,
  m.reference_id,
  m.actor_id,
  m.actor_name,
  m.created_at
from inventory_movements m
left join inventory_items i on i.id = m.inventory_item_id
left join locations l on l.id = m.location_id;

create or replace view purchases_report as
select
  po.id as purchase_order_id,
  po.supplier_name,
  po.location_id,
  l.name as location_name,
  po.status,
  po.created_at,
  date_trunc('month', po.created_at) as period_month,
  (line->>'itemId')::uuid as inventory_item_id,
  i.product_id,
  coalesce(i.name, line->>'name') as product_name,
  coalesce((line->>'receivedQty')::numeric, (line->>'quantity')::numeric, 0) as quantity,
  coalesce((line->>'unitCost')::numeric, (line->>'unit_cost')::numeric, 0) as unit_cost,
  coalesce((line->>'receivedQty')::numeric, (line->>'quantity')::numeric, 0) * coalesce((line->>'unitCost')::numeric, (line->>'unit_cost')::numeric, 0) as line_total
from purchase_orders po
left join locations l on l.id = po.location_id
left join lateral jsonb_array_elements(coalesce(po.received_manifest, po.manifest, '[]'::jsonb)) as line on true
left join inventory_items i on i.id = (line->>'itemId')::uuid;

create or replace view inter_branch_transfer_report as
select
  st.id as transfer_id,
  st.status,
  st.created_at,
  st.received_at,
  st.source_location_id,
  src.name as source_location_name,
  st.destination_location_id,
  dest.name as destination_location_name,
  (line->>'itemId')::uuid as inventory_item_id,
  i.product_id,
  coalesce(i.name, line->>'name') as product_name,
  coalesce((line->>'quantity')::numeric, 0) as quantity
from stock_transfers st
left join locations src on src.id = st.source_location_id
left join locations dest on dest.id = st.destination_location_id
left join lateral jsonb_array_elements(coalesce(st.manifest, '[]'::jsonb)) as line on true
left join inventory_items i on i.id = (line->>'itemId')::uuid;

create or replace view returns_report as
select
  'CUSTOMER' as return_source,
  m.reference_id as return_reference_id,
  m.inventory_item_id,
  i.product_id,
  i.name as product_name,
  m.location_id,
  l.name as location_name,
  abs(m.quantity) as quantity,
  m.created_at
from inventory_movements m
left join inventory_items i on i.id = m.inventory_item_id
left join locations l on l.id = m.location_id
where m.movement_type = 'RETURN'
union all
select
  'SUPPLIER' as return_source,
  sa.id::text as return_reference_id,
  sa.item_id as inventory_item_id,
  i.product_id,
  coalesce(sa.item_name, i.name) as product_name,
  sa.location_id,
  l.name as location_name,
  abs(sa.quantity) as quantity,
  sa.created_at
from stock_adjustments sa
left join inventory_items i on i.id = sa.item_id
left join locations l on l.id = sa.location_id
where sa.reason = 'RETURN_TO_SUPPLIER';

create or replace view consumption_report as
select
  m.location_id,
  l.name as location_name,
  i.product_id,
  i.name as product_name,
  date_trunc('month', m.created_at) as period_month,
  sum(abs(m.quantity)) as consumed_quantity
from inventory_movements m
left join inventory_items i on i.id = m.inventory_item_id
left join locations l on l.id = m.location_id
where m.quantity < 0
  and m.movement_type in ('SALE', 'TRANSFER_OUT', 'ADJUSTMENT')
group by m.location_id, l.name, i.product_id, i.name, date_trunc('month', m.created_at);

create or replace view stock_valuation_report as
select
  i.location_id,
  l.name as location_name,
  i.product_id,
  i.id as inventory_item_id,
  i.name as product_name,
  i.stock,
  i.cost_per_unit,
  (coalesce(i.stock, 0) * coalesce(i.cost_per_unit, 0)) as stock_value
from inventory_items i
left join locations l on l.id = i.location_id;

create or replace view cogs_report as
select
  date_trunc('month', ae.created_at) as period_month,
  (ae.metadata->>'location_id')::uuid as location_id,
  l.name as location_name,
  ae.transaction_id,
  case when current_user_is_admin() or current_user_is_manager() then ae.amount else null end as cogs_amount
from accounting_entries ae
left join locations l on l.id = (ae.metadata->>'location_id')::uuid
where ae.entry_type = 'COGS';

create or replace view losses_writeoffs_report as
select
  sa.id as adjustment_id,
  sa.location_id,
  l.name as location_name,
  sa.item_id as inventory_item_id,
  i.product_id,
  coalesce(sa.item_name, i.name) as product_name,
  sa.reason,
  sa.quantity,
  case when current_user_is_admin() or current_user_is_manager() then i.cost_per_unit else null end as cost_per_unit,
  case when current_user_is_admin() or current_user_is_manager() then abs(sa.quantity) * coalesce(i.cost_per_unit, 0) else null end as loss_value,
  sa.created_at
from stock_adjustments sa
left join inventory_items i on i.id = sa.item_id
left join locations l on l.id = sa.location_id
where sa.reason in ('DAMAGE', 'EXPIRY', 'THEFT', 'QC_REJECTED', 'ROASTING_WASTE');

create or replace view product_profitability_report as
select
  m.location_id,
  l.name as location_name,
  i.product_id,
  i.name as product_name,
  date_trunc('month', m.created_at) as period_month,
  sum(abs(m.quantity)) as quantity_sold,
  coalesce(pd.selling_price, 0) as selling_price,
  case when current_user_is_admin() or current_user_is_manager() then coalesce(i.cost_per_unit, pd.cost_price, 0) else null end as unit_cost,
  sum(abs(m.quantity)) * coalesce(pd.selling_price, 0) as total_revenue,
  case when current_user_is_admin() or current_user_is_manager() then sum(abs(m.quantity)) * coalesce(i.cost_per_unit, pd.cost_price, 0) else null end as total_cost,
  case when current_user_is_admin() or current_user_is_manager()
    then (sum(abs(m.quantity)) * coalesce(pd.selling_price, 0)) - (sum(abs(m.quantity)) * coalesce(i.cost_per_unit, pd.cost_price, 0))
    else null
  end as gross_profit
from inventory_movements m
left join inventory_items i on i.id = m.inventory_item_id
left join product_definitions pd on pd.id = i.product_id
left join locations l on l.id = m.location_id
where m.movement_type = 'SALE'
group by m.location_id, l.name, i.product_id, i.name, date_trunc('month', m.created_at), pd.selling_price, i.cost_per_unit, pd.cost_price;

create or replace view packaged_sales_last_30_days as
select
  m.location_id,
  l.name as location_name,
  i.product_id,
  i.name as product_name,
  i.bean_origin,
  i.roast_level,
  max(i.roast_date) as last_roast_date,
  sum(abs(m.quantity)) as quantity_sold
from inventory_movements m
join inventory_items i on i.id = m.inventory_item_id
left join locations l on l.id = m.location_id
where m.movement_type = 'SALE'
  and m.created_at >= now() - interval '30 days'
  and i.type = 'PACKAGED_COFFEE'
group by m.location_id, l.name, i.product_id, i.name, i.bean_origin, i.roast_level;

create or replace view inventory_turnover_report as
select
  p.period_month,
  p.location_id,
  p.location_name,
  p.product_id,
  p.product_name,
  case when current_user_is_admin() or current_user_is_manager() then p.total_cost else null end as cogs_amount,
  case when current_user_is_admin() or current_user_is_manager() then (coalesce(sv.stock, 0) * coalesce(sv.cost_per_unit, 0)) else null end as current_stock_value,
  case
    when not (current_user_is_admin() or current_user_is_manager()) then null
    when (coalesce(sv.stock, 0) * coalesce(sv.cost_per_unit, 0)) = 0 then null
    else p.total_cost / (coalesce(sv.stock, 0) * coalesce(sv.cost_per_unit, 0))
  end as turnover_ratio
from product_profitability_report p
left join inventory_items sv on sv.product_id = p.product_id and sv.location_id = p.location_id;

alter table product_definitions add column if not exists sku text;
create unique index if not exists product_definitions_sku_unique on product_definitions(sku) where sku is not null;
alter table product_definitions add column if not exists main_category text;
alter table product_definitions add column if not exists sub_category text;
alter table product_definitions add column if not exists variant_of uuid references product_definitions(id);
alter table product_definitions add column if not exists variant_label text;
alter table product_definitions add column if not exists variant_size text;
alter table product_definitions add column if not exists variant_flavor text;
alter table product_definitions add column if not exists unit text;
alter table product_definitions add column if not exists selling_price numeric default 0;
alter table product_definitions add column if not exists cost_price numeric default 0;
alter table product_definitions add column if not exists profit_margin numeric default 0;
alter table product_definitions add column if not exists is_perishable boolean default false;
alter table product_definitions add column if not exists expiry_date date;
alter table product_definitions add column if not exists product_status text default 'ACTIVE';
alter table product_definitions add column if not exists supplier text;
alter table product_definitions add column if not exists bom jsonb default '[]';

create table if not exists order_reservations (
  id uuid default gen_random_uuid() primary key,
  inventory_item_id uuid references inventory_items(id),
  location_id uuid references locations(id),
  quantity numeric not null,
  status text check (status in ('RESERVED', 'FULFILLED', 'CANCELLED')),
  order_reference text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table order_reservations enable row level security;
drop policy if exists "Auth all order reservations" on order_reservations;
create policy "Auth all order reservations" on order_reservations for all using (auth.role() = 'authenticated');

create or replace function handle_order_reservation_change() returns trigger as $$
begin
  if (tg_op = 'INSERT') then
    if (new.status = 'RESERVED') then
      update inventory_items
      set reserved_stock = reserved_stock + new.quantity
      where id = new.inventory_item_id;
    end if;
    return new;
  elsif (tg_op = 'UPDATE') then
    if (old.status = 'RESERVED') then
      update inventory_items
      set reserved_stock = greatest(0, reserved_stock - old.quantity)
      where id = old.inventory_item_id;
    end if;
    if (new.status = 'RESERVED') then
      update inventory_items
      set reserved_stock = reserved_stock + new.quantity
      where id = new.inventory_item_id;
    end if;
    return new;
  elsif (tg_op = 'DELETE') then
    if (old.status = 'RESERVED') then
      update inventory_items
      set reserved_stock = greatest(0, reserved_stock - old.quantity)
      where id = old.inventory_item_id;
    end if;
    return old;
  end if;
  return null;
end;
$$ language plpgsql;

drop trigger if exists order_reservation_change on order_reservations;
create trigger order_reservation_change
after insert or update or delete on order_reservations
for each row execute function handle_order_reservation_change();

create or replace function handle_purchase_order_receipt() returns trigger as $$
declare
  item jsonb;
  item_id uuid;
  received_qty numeric;
  quality_status text;
  expiry_value date;
  unit_cost numeric;
begin
  if (tg_op = 'UPDATE') then
    if (new.status in ('RECEIVED', 'PARTIALLY_RECEIVED')
        and old.status not in ('RECEIVED', 'PARTIALLY_RECEIVED')) then
      for item in
        select * from jsonb_array_elements(coalesce(new.received_manifest, new.manifest, '[]'::jsonb))
      loop
        item_id := (item->>'itemId')::uuid;
        received_qty := coalesce((item->>'receivedQty')::numeric, (item->>'quantity')::numeric, 0);
        quality_status := coalesce(item->>'qualityStatus', 'PASSED');
        expiry_value := nullif(item->>'expiryDate', '')::date;
        unit_cost := coalesce((item->>'unitCost')::numeric, (item->>'unit_cost')::numeric, 0);
        if quality_status = 'PASSED' and received_qty > 0 then
          perform set_config('inventory.movement_type', 'PURCHASE_RECEIPT', true);
          perform set_config('inventory.reference_id', new.id::text, true);
          perform set_config('inventory.actor_id', coalesce(new.created_by::text, ''), true);
          update inventory_items
          set stock = coalesce(stock, 0) + received_qty,
              cost_per_unit = case
                when unit_cost is null or unit_cost = 0 then cost_per_unit
                when coalesce(stock, 0) + received_qty = 0 then unit_cost
                else ((coalesce(stock, 0) * coalesce(cost_per_unit, 0)) + (received_qty * unit_cost)) / (coalesce(stock, 0) + received_qty)
              end,
              last_movement_at = now()
          where id = item_id;
          update inventory_items
          set expiry_date = case
            when expiry_value is null then expiry_date
            when expiry_date is null or expiry_value < expiry_date then expiry_value
            else expiry_date
          end
          where id = item_id;
        end if;
        insert into inventory_lots (
          inventory_item_id,
          purchase_order_id,
          location_id,
          received_at,
          expiry_date,
          quantity_received,
          quantity_remaining,
          quality_status,
          created_by,
          metadata
        ) values (
          item_id,
          new.id,
          new.location_id,
          new.received_at,
          expiry_value,
          received_qty,
          received_qty,
          quality_status,
          new.created_by,
          jsonb_build_object('supplier_name', new.supplier_name, 'unit_cost', unit_cost)
        );
      end loop;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists purchase_order_receipt_update on purchase_orders;
create trigger purchase_order_receipt_update
after update on purchase_orders
for each row execute function handle_purchase_order_receipt();

create table if not exists green_beans (
  id uuid default gen_random_uuid() primary key,
  bean_name text not null,
  origin text,
  variety text,
  quality_grade text,
  supplier text,
  purchase_date date,
  harvest_date date,
  quantity numeric default 0,
  cost_per_kg numeric default 0,
  batch_number text,
  is_organic boolean default false,
  status text default 'ACTIVE',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists green_beans_origin_idx on green_beans(origin);
create index if not exists green_beans_variety_idx on green_beans(variety);
create index if not exists green_beans_quality_grade_idx on green_beans(quality_grade);
create index if not exists green_beans_supplier_idx on green_beans(supplier);
create index if not exists green_beans_purchase_date_idx on green_beans(purchase_date);

alter table green_beans enable row level security;
drop policy if exists "Auth all green beans" on green_beans;
create policy "Auth all green beans" on green_beans for all using (auth.role() = 'authenticated');

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

create or replace function deduct_inventory_atomic(p_location_id uuid, p_items jsonb)
returns void as $$
declare
  item jsonb;
  item_id uuid;
  qty numeric;
  current_stock numeric;
begin
  for item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    item_id := (item->>'item_id')::uuid;
    qty := coalesce((item->>'quantity')::numeric, 0);
    if item_id is null or qty <= 0 then
      continue;
    end if;
    select stock into current_stock
    from inventory_items
    where id = item_id
      and (p_location_id is null or location_id = p_location_id)
    for update;
    if not found then
      raise exception 'ITEM_NOT_FOUND';
    end if;
    if current_stock < qty then
      raise exception 'INSUFFICIENT_STOCK';
    end if;
    update inventory_items
    set stock = current_stock - qty,
        last_movement_at = now()
    where id = item_id;
  end loop;
end;
$$ language plpgsql;

create or replace function deduct_inventory_with_cost(p_location_id uuid, p_items jsonb, p_method text, p_transaction_id text, p_user_id uuid, p_user_name text)
returns numeric as $$
declare
  item jsonb;
  item_id uuid;
  qty numeric;
  remaining_qty numeric;
  current_stock numeric;
  item_cost numeric;
  line_cost numeric;
  total_cost numeric := 0;
  lot record;
  lot_unit_cost numeric;
  lot_take numeric;
  item_details jsonb := '[]'::jsonb;
begin
  perform set_config('inventory.movement_type', 'SALE', true);
  perform set_config('inventory.reference_id', coalesce(p_transaction_id, ''), true);
  perform set_config('inventory.actor_id', coalesce(p_user_id::text, ''), true);
  perform set_config('inventory.actor_name', coalesce(p_user_name, ''), true);
  for item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    item_id := (item->>'item_id')::uuid;
    qty := coalesce((item->>'quantity')::numeric, 0);
    if item_id is null or qty <= 0 then
      continue;
    end if;
    select stock, cost_per_unit into current_stock, item_cost
    from inventory_items
    where id = item_id
      and (p_location_id is null or location_id = p_location_id)
    for update;
    if not found then
      raise exception 'ITEM_NOT_FOUND';
    end if;
    if current_stock < qty then
      raise exception 'INSUFFICIENT_STOCK';
    end if;

    line_cost := 0;
    remaining_qty := qty;

    if upper(coalesce(p_method, 'WEIGHTED_AVG')) = 'FIFO' then
      for lot in
        select id, quantity_remaining, metadata
        from inventory_lots
        where inventory_item_id = item_id
          and (p_location_id is null or location_id = p_location_id)
          and coalesce(quantity_remaining, 0) > 0
        order by received_at asc
        for update
      loop
        exit when remaining_qty <= 0;
        lot_unit_cost := coalesce((lot.metadata->>'unit_cost')::numeric, item_cost, 0);
        lot_take := least(coalesce(lot.quantity_remaining, 0), remaining_qty);
        if lot_take <= 0 then
          continue;
        end if;
        update inventory_lots
        set quantity_remaining = coalesce(quantity_remaining, 0) - lot_take
        where id = lot.id;
        line_cost := line_cost + (lot_take * lot_unit_cost);
        remaining_qty := remaining_qty - lot_take;
      end loop;

      if remaining_qty > 0 then
        line_cost := line_cost + (remaining_qty * coalesce(item_cost, 0));
      end if;
    else
      line_cost := qty * coalesce(item_cost, 0);
    end if;

    update inventory_items
    set stock = current_stock - qty,
        last_movement_at = now()
    where id = item_id;

    total_cost := total_cost + line_cost;
    item_details := item_details || jsonb_build_array(
      jsonb_build_object('item_id', item_id, 'quantity', qty, 'cost', line_cost)
    );
  end loop;

  if total_cost > 0 then
    insert into accounting_entries (transaction_id, entry_type, amount, created_by, metadata, debit_account, credit_account)
    values (
      p_transaction_id,
      'COGS',
      total_cost,
      p_user_id,
      jsonb_build_object('location_id', p_location_id, 'method', upper(coalesce(p_method, 'WEIGHTED_AVG')), 'items', item_details, 'user_name', p_user_name),
      'COGS',
      'FINISHED_GOODS_INVENTORY'
    );
  end if;

  return total_cost;
end;
$$ language plpgsql;

create or replace function add_inventory_atomic(p_location_id uuid, p_items jsonb, p_reference_id text, p_user_id uuid, p_user_name text, p_movement_type text)
returns void as $$
declare
  item jsonb;
  item_id uuid;
  qty numeric;
  current_stock numeric;
begin
  perform set_config('inventory.movement_type', coalesce(p_movement_type, 'RETURN'), true);
  perform set_config('inventory.reference_id', coalesce(p_reference_id, ''), true);
  perform set_config('inventory.actor_id', coalesce(p_user_id::text, ''), true);
  perform set_config('inventory.actor_name', coalesce(p_user_name, ''), true);
  for item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    item_id := (item->>'item_id')::uuid;
    qty := coalesce((item->>'quantity')::numeric, 0);
    if item_id is null or qty <= 0 then
      continue;
    end if;
    select stock into current_stock
    from inventory_items
    where id = item_id
      and (p_location_id is null or location_id = p_location_id)
    for update;
    if not found then
      raise exception 'ITEM_NOT_FOUND';
    end if;
    update inventory_items
    set stock = current_stock + qty,
        last_movement_at = now()
    where id = item_id;
  end loop;
end;
$$ language plpgsql;

create or replace function complete_stock_transfer(p_transfer_id uuid, p_user_id uuid, p_user_name text)
returns void as $$
declare
  v_transfer record;
  item jsonb;
  v_item_id uuid;
  v_qty numeric;
  v_source record;
  v_dest_id uuid;
begin
  select * into v_transfer
  from stock_transfers
  where id = p_transfer_id
  for update;

  if not found then
    raise exception 'TRANSFER_NOT_FOUND';
  end if;

  if v_transfer.status = 'COMPLETED' then
    return;
  end if;

  for item in select * from jsonb_array_elements(coalesce(v_transfer.manifest, '[]'::jsonb))
  loop
    v_item_id := (item->>'itemId')::uuid;
    v_qty := coalesce((item->>'quantity')::numeric, 0);

    if v_item_id is null or v_qty <= 0 then
      continue;
    end if;

    select *
    into v_source
    from inventory_items
    where id = v_item_id
      and location_id = v_transfer.source_location_id
    for update;

    if not found then
      raise exception 'SOURCE_ITEM_NOT_FOUND';
    end if;

    if coalesce(v_source.stock, 0) < v_qty then
      raise exception 'INSUFFICIENT_STOCK';
    end if;

    perform set_config('inventory.movement_type', 'TRANSFER_OUT', true);
    perform set_config('inventory.reference_id', v_transfer.id::text, true);
    perform set_config('inventory.actor_id', coalesce(p_user_id::text, ''), true);
    perform set_config('inventory.actor_name', coalesce(p_user_name, ''), true);
    update inventory_items
    set stock = coalesce(v_source.stock, 0) - v_qty,
        last_movement_at = now()
    where id = v_source.id;

    select id
    into v_dest_id
    from inventory_items
    where location_id = v_transfer.destination_location_id
      and (product_id = v_source.product_id or name = v_source.name)
    for update;

    if v_dest_id is null then
      insert into inventory_items (
        name, description, category, type, size, price,
        stock, batch_id, product_id, sku_prefix, image,
        location_id, expiry_date, roast_date, cost_per_unit,
        unit, min_stock, max_stock,
        bean_origin, bean_variety, roast_level
      )
      select
        name, description, category, type, size, price,
        v_qty, batch_id, product_id, sku_prefix, image,
        v_transfer.destination_location_id, expiry_date, roast_date, cost_per_unit,
        unit, min_stock, max_stock,
        bean_origin, bean_variety, roast_level
      from inventory_items
      where id = v_source.id;
    else
      perform set_config('inventory.movement_type', 'TRANSFER_IN', true);
      perform set_config('inventory.reference_id', v_transfer.id::text, true);
      perform set_config('inventory.actor_id', coalesce(p_user_id::text, ''), true);
      perform set_config('inventory.actor_name', coalesce(p_user_name, ''), true);
      update inventory_items
      set stock = coalesce(stock, 0) + v_qty,
          last_movement_at = now()
      where id = v_dest_id;
    end if;
  end loop;

  update stock_transfers
  set status = 'COMPLETED',
      received_at = now()
  where id = p_transfer_id;
end;
$$ language plpgsql security definer;

create or replace function handle_stock_transfer_completion_update_production_order()
returns trigger as $$
begin
  if (tg_op = 'UPDATE') then
    if new.status = 'COMPLETED' and (old.status is distinct from new.status) and new.production_order_id is not null then
      update production_orders
      set status = 'COMPLETED',
          updated_at = now(),
          transfer_id = new.id
      where id = new.production_order_id;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists stock_transfer_completion_update_production_order on stock_transfers;
create trigger stock_transfer_completion_update_production_order
after update on stock_transfers
for each row execute function handle_stock_transfer_completion_update_production_order();

create unique index if not exists inventory_items_batch_location_product_size_idx
on inventory_items(batch_id, location_id, product_id, size);

create or replace function upsert_packaged_inventory(p_items jsonb)
returns void as $$
declare
  item jsonb;
begin
  for item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    insert into inventory_items (
      name,
      category,
      type,
      size,
      price,
      stock,
      batch_id,
      bean_origin,
      bean_variety,
      roast_level,
      product_id,
      sku_prefix,
      image,
      location_id,
      expiry_date,
      roast_date,
      cost_per_unit
    ) values (
      item->>'name',
      item->>'category',
      item->>'type',
      item->>'size',
      coalesce((item->>'price')::numeric, 0),
      coalesce((item->>'stock')::numeric, 0),
      item->>'batch_id',
      item->>'bean_origin',
      item->>'bean_variety',
      item->>'roast_level',
      nullif(item->>'product_id', '')::uuid,
      item->>'sku_prefix',
      item->>'image',
      nullif(item->>'location_id', '')::uuid,
      nullif(item->>'expiry_date', '')::date,
      nullif(item->>'roast_date', '')::date,
      coalesce((item->>'cost_per_unit')::numeric, 0)
    )
    on conflict (batch_id, location_id, product_id, size) do update
    set
      stock = coalesce(inventory_items.stock, 0) + excluded.stock,
      price = excluded.price,
      cost_per_unit = excluded.cost_per_unit,
      expiry_date = excluded.expiry_date,
      roast_date = excluded.roast_date,
      sku_prefix = excluded.sku_prefix,
      image = excluded.image,
      name = excluded.name,
      category = excluded.category,
      bean_origin = excluded.bean_origin,
      bean_variety = excluded.bean_variety,
      roast_level = excluded.roast_level;
  end loop;
end;
$$ language plpgsql;

create or replace function post_roasting_packaging_entries(p_batch_id text, p_location_id uuid, p_finished_goods_value numeric, p_overhead_value numeric, p_items jsonb, p_user_id uuid, p_user_name text)
returns void as $$
begin
  if to_regclass('public.accounting_entries') is null then
    return;
  end if;

  if coalesce(p_overhead_value, 0) > 0 then
    insert into accounting_entries (entry_type, amount, created_by, metadata, debit_account, credit_account, batch_id)
    values (
      'WIP',
      p_overhead_value,
      p_user_id,
      jsonb_build_object('batch_id', p_batch_id, 'location_id', p_location_id, 'user_name', p_user_name, 'type', 'OVERHEAD_APPLIED'),
      'WIP',
      'PRODUCTION_OVERHEAD',
      p_batch_id
    );
  end if;

  if coalesce(p_finished_goods_value, 0) > 0 then
    insert into accounting_entries (entry_type, amount, created_by, metadata, debit_account, credit_account, batch_id)
    values (
      'FINISHED_GOODS',
      p_finished_goods_value,
      p_user_id,
      jsonb_build_object('batch_id', p_batch_id, 'location_id', p_location_id, 'user_name', p_user_name, 'items', coalesce(p_items, '[]'::jsonb)),
      'FINISHED_GOODS_INVENTORY',
      'WIP',
      p_batch_id
    );
  end if;
end;
$$ language plpgsql;
