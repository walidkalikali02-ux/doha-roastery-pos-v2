-- AUD-001..AUD-005: immutable inventory movement audit log

create table if not exists inventory_movement_audit_logs (
  id uuid default gen_random_uuid() primary key,
  movement_id uuid not null unique references inventory_movements(id) on delete restrict,
  inventory_item_id uuid references inventory_items(id) on delete set null,
  product_id uuid references product_definitions(id) on delete set null,
  product_sku text,
  barcode_scanned text,
  operation_type text not null,
  quantity numeric not null,
  quantity_before numeric,
  quantity_after numeric,
  user_id uuid,
  user_role text,
  reason_code text,
  reference_id text,
  occurred_at timestamptz not null,
  location_id uuid references locations(id) on delete set null,
  location_name text,
  pos_transaction_id uuid,
  created_at timestamptz default now()
);

create index if not exists inventory_movement_audit_logs_occurred_idx
  on inventory_movement_audit_logs(occurred_at desc);
create index if not exists inventory_movement_audit_logs_product_idx
  on inventory_movement_audit_logs(product_id, occurred_at desc);
create index if not exists inventory_movement_audit_logs_user_idx
  on inventory_movement_audit_logs(user_id, occurred_at desc);
create index if not exists inventory_movement_audit_logs_location_idx
  on inventory_movement_audit_logs(location_id, occurred_at desc);
create index if not exists inventory_movement_audit_logs_operation_idx
  on inventory_movement_audit_logs(operation_type, occurred_at desc);

create or replace function sync_inventory_movement_audit_log()
returns trigger as $$
declare
  v_product_id uuid;
  v_sku text;
  v_barcode text;
  v_role text;
  v_location_name text;
  v_reason text;
  v_scanned_barcode text;
  v_pos_tx uuid;
begin
  select ii.product_id into v_product_id
  from inventory_items ii
  where ii.id = new.inventory_item_id;

  if v_product_id is not null then
    select pd.sku, pd.barcode
    into v_sku, v_barcode
    from product_definitions pd
    where pd.id = v_product_id;
  end if;

  if new.actor_id is not null then
    select p.role into v_role
    from profiles p
    where p.id = new.actor_id;
  end if;

  if new.location_id is not null then
    select l.name into v_location_name
    from locations l
    where l.id = new.location_id;
  end if;

  v_scanned_barcode := nullif(current_setting('inventory.scanned_barcode', true), '');
  v_reason := nullif(split_part(coalesce(new.reference_id, ''), '::', 2), '');

  if new.movement_type = 'SALE'
     and coalesce(new.reference_id, '') ~* '^[0-9a-fA-F-]{36}$' then
    v_pos_tx := new.reference_id::uuid;
  else
    v_pos_tx := null;
  end if;

  insert into inventory_movement_audit_logs (
    movement_id,
    inventory_item_id,
    product_id,
    product_sku,
    barcode_scanned,
    operation_type,
    quantity,
    quantity_before,
    quantity_after,
    user_id,
    user_role,
    reason_code,
    reference_id,
    occurred_at,
    location_id,
    location_name,
    pos_transaction_id
  )
  values (
    new.id,
    new.inventory_item_id,
    v_product_id,
    v_sku,
    coalesce(v_scanned_barcode, v_barcode),
    new.movement_type,
    new.quantity,
    new.before_stock,
    new.after_stock,
    new.actor_id,
    v_role,
    v_reason,
    new.reference_id,
    coalesce(new.created_at, now()),
    new.location_id,
    v_location_name,
    v_pos_tx
  )
  on conflict (movement_id) do nothing;

  return new;
end;
$$ language plpgsql;

drop trigger if exists inventory_movement_audit_log_sync on inventory_movements;
create trigger inventory_movement_audit_log_sync
after insert on inventory_movements
for each row execute function sync_inventory_movement_audit_log();

create or replace function block_inventory_movement_audit_log_mutation()
returns trigger as $$
begin
  raise exception 'inventory_movement_audit_logs is immutable';
end;
$$ language plpgsql;

drop trigger if exists inventory_movement_audit_log_block_update on inventory_movement_audit_logs;
create trigger inventory_movement_audit_log_block_update
before update on inventory_movement_audit_logs
for each row execute function block_inventory_movement_audit_log_mutation();

drop trigger if exists inventory_movement_audit_log_block_delete on inventory_movement_audit_logs;
create trigger inventory_movement_audit_log_block_delete
before delete on inventory_movement_audit_logs
for each row execute function block_inventory_movement_audit_log_mutation();

alter table inventory_movement_audit_logs enable row level security;
drop policy if exists "Admin manager read inventory movement audit logs" on inventory_movement_audit_logs;
create policy "Admin manager read inventory movement audit logs"
on inventory_movement_audit_logs for select
using (current_user_is_admin() or current_user_is_manager());
