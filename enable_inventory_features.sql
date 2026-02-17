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
  quality_status text check (quality_status in ('PASSED', 'FAILED')) default 'PASSED',
  created_by uuid,
  metadata jsonb
);

create table if not exists accounting_entries (
  id uuid default gen_random_uuid() primary key,
  purchase_order_id uuid references purchase_orders(id) on delete set null,
  stock_adjustment_id uuid references stock_adjustments(id) on delete set null,
  entry_type text check (entry_type in ('PURCHASE', 'ADJUSTMENT')) not null,
  amount numeric not null,
  created_at timestamptz default now(),
  created_by uuid,
  metadata jsonb
);
alter table accounting_entries add column if not exists stock_adjustment_id uuid;

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

create or replace function handle_purchase_order_accounting_entry() returns trigger as $$
begin
  if (tg_op in ('INSERT', 'UPDATE')) then
    if (new.status in ('ORDERED', 'RECEIVED', 'PARTIALLY_RECEIVED')) then
      insert into accounting_entries (purchase_order_id, entry_type, amount, created_by, metadata)
      select new.id, 'PURCHASE', coalesce(new.total_value, 0), new.created_by,
             jsonb_build_object('supplier_name', new.supplier_name, 'location_id', new.location_id, 'status', new.status)
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
    insert into accounting_entries (stock_adjustment_id, entry_type, amount, created_by, metadata)
    values (
      new.id,
      'ADJUSTMENT',
      coalesce(abs(new.value), abs(new.quantity)),
      new.user_id,
      jsonb_build_object(
        'reason', new.reason,
        'location_id', new.location_id,
        'status', new.status,
        'item_name', new.item_name,
        'location_name', new.location_name
      )
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
  location_id uuid references locations(id),
  quantity numeric not null,
  reason text check (reason in ('DAMAGE', 'THEFT', 'COUNTING_ERROR', 'GIFT', 'SAMPLE', 'EXPIRY', 'OTHER')),
  notes text,
  status text check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  created_at timestamptz default now(),
  user_name text,
  user_id uuid,
  value numeric
);

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
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

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

-- 4. Enable RLS
alter table locations enable row level security;
drop policy if exists "Public read locations" on locations;
create policy "Public read locations" on locations for select using (true);
drop policy if exists "Auth all locations" on locations;
create policy "Auth all locations" on locations for all using (auth.role() = 'authenticated');

alter table stock_transfers enable row level security;
drop policy if exists "Auth all transfers" on stock_transfers;
create policy "Auth all transfers" on stock_transfers for all using (auth.role() = 'authenticated');

alter table purchase_orders enable row level security;
drop policy if exists "Auth all purchase orders" on purchase_orders;
create policy "Auth all purchase orders" on purchase_orders for all using (auth.role() = 'authenticated');

alter table inventory_lots enable row level security;
drop policy if exists "Auth all inventory lots" on inventory_lots;
create policy "Auth all inventory lots" on inventory_lots for all using (auth.role() = 'authenticated');

alter table accounting_entries enable row level security;
drop policy if exists "Auth all accounting entries" on accounting_entries;
create policy "Auth all accounting entries" on accounting_entries for all using (auth.role() = 'authenticated');

alter table stock_adjustments enable row level security;
drop policy if exists "Auth all adjustments" on stock_adjustments;
create policy "Auth all adjustments" on stock_adjustments for all using (auth.role() = 'authenticated');

alter table inventory_count_tasks enable row level security;
drop policy if exists "Auth all count tasks" on inventory_count_tasks;
create policy "Auth all count tasks" on inventory_count_tasks for all using (auth.role() = 'authenticated');

alter table inventory_count_entries enable row level security;
drop policy if exists "Auth all count entries" on inventory_count_entries;
create policy "Auth all count entries" on inventory_count_entries for all using (auth.role() = 'authenticated');

-- 5. Seed Initial Locations if empty
insert into locations (name, type, is_roastery, address)
select 'Central Roastery', 'ROASTERY', true, 'Industrial Area, Doha'
where not exists (select 1 from locations where type = 'ROASTERY');

insert into locations (name, type, is_roastery, address)
select 'Katara Branch', 'BRANCH', false, 'Katara Cultural Village'
where not exists (select 1 from locations where type = 'BRANCH');

alter table inventory_items add column if not exists location_id uuid references locations(id);
create index if not exists inventory_items_location_id_idx on inventory_items(location_id);
alter table inventory_items add column if not exists reserved_stock numeric default 0;
alter table inventory_items add column if not exists damaged_stock numeric default 0;
alter table inventory_items add column if not exists max_stock numeric;
alter table inventory_items add column if not exists last_movement_at timestamptz default now();
alter table inventory_items add column if not exists product_id uuid references product_definitions(id);
create index if not exists inventory_items_product_id_idx on inventory_items(product_id);

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
        if quality_status = 'PASSED' and received_qty > 0 then
          update inventory_items
          set stock = coalesce(stock, 0) + received_qty,
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
          quality_status,
          new.created_by,
          jsonb_build_object('supplier_name', new.supplier_name)
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
