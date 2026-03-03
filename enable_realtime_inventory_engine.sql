-- Realtime Inventory Engine Extension
-- Prerequisite: run enable_inventory_features.sql first.

alter table inventory_items add column if not exists lead_time_days integer default 1;
alter table inventory_items add column if not exists safety_stock numeric default 0;
alter table inventory_items add column if not exists supplier_id uuid;

create table if not exists product_bom (
  id uuid default gen_random_uuid() primary key,
  product_id uuid not null references product_definitions(id) on delete cascade,
  inventory_item_id uuid not null references inventory_items(id) on delete cascade,
  branch_id uuid references locations(id) on delete cascade,
  service_type text not null default 'ALL' check (service_type in ('ALL', 'DINE_IN', 'TAKEAWAY')),
  quantity numeric not null check (quantity > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists product_bom_unique_idx on product_bom(product_id, inventory_item_id, coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid), service_type);
create index if not exists product_bom_product_branch_idx on product_bom(product_id, branch_id, service_type) where is_active = true;

alter table product_bom enable row level security;
drop policy if exists "Auth read product bom" on product_bom;
create policy "Auth read product bom" on product_bom for select using (branch_id is null or current_user_can_access_location(branch_id));
drop policy if exists "Warehouse write product bom" on product_bom;
create policy "Warehouse write product bom" on product_bom for all using (current_user_is_warehouse_staff() or current_user_is_admin());

create table if not exists calendar_events (
  id uuid default gen_random_uuid() primary key,
  event_name text not null,
  event_type text not null check (event_type in ('SEASONAL', 'CAMPAIGN', 'MATCH_DAY', 'PEAK_DAY', 'OTHER')),
  event_date date not null,
  branch_id uuid references locations(id) on delete cascade,
  multiplier numeric not null default 1 check (multiplier > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists calendar_events_date_branch_idx on calendar_events(event_date, branch_id) where is_active = true;

alter table calendar_events enable row level security;
drop policy if exists "Auth read calendar events" on calendar_events;
create policy "Auth read calendar events" on calendar_events for select using (branch_id is null or current_user_can_access_location(branch_id));
drop policy if exists "Admin write calendar events" on calendar_events;
create policy "Admin write calendar events" on calendar_events for all using (current_user_is_admin() or current_user_is_manager());

create table if not exists inventory_ledger (
  id uuid default gen_random_uuid() primary key,
  inventory_movement_id uuid unique references inventory_movements(id) on delete cascade,
  branch_id uuid references locations(id),
  inventory_item_id uuid references inventory_items(id),
  movement_direction text check (movement_direction in ('IN', 'OUT')) not null,
  quantity numeric not null check (quantity > 0),
  signed_quantity numeric not null,
  source_type text check (source_type in ('POS', 'PURCHASE_ORDER', 'TRANSFER', 'ADJUSTMENT', 'COUNT_APPROVAL', 'RETURN_TO_SUPPLIER', 'SYSTEM')) not null,
  reference_id text,
  actor_id uuid,
  actor_name text,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists inventory_ledger_branch_item_created_idx on inventory_ledger(branch_id, inventory_item_id, created_at desc);
create index if not exists inventory_ledger_source_created_idx on inventory_ledger(source_type, created_at desc);
create index if not exists inventory_ledger_reference_idx on inventory_ledger(reference_id);

alter table inventory_ledger enable row level security;
drop policy if exists "Auth read inventory ledger" on inventory_ledger;
create policy "Auth read inventory ledger" on inventory_ledger for select using (current_user_can_access_location(branch_id));

create or replace function mirror_movement_to_inventory_ledger() returns trigger as $$
declare
  v_source_type text;
  v_direction text;
begin
  v_source_type := case new.movement_type
    when 'SALE' then 'POS'
    when 'RETURN' then 'POS'
    when 'PURCHASE_RECEIPT' then 'PURCHASE_ORDER'
    when 'TRANSFER_OUT' then 'TRANSFER'
    when 'TRANSFER_IN' then 'TRANSFER'
    when 'ADJUSTMENT' then 'ADJUSTMENT'
    when 'COUNT_APPROVAL' then 'COUNT_APPROVAL'
    when 'RETURN_TO_SUPPLIER' then 'RETURN_TO_SUPPLIER'
    else 'SYSTEM'
  end;

  v_direction := case when coalesce(new.quantity, 0) < 0 then 'OUT' else 'IN' end;

  insert into inventory_ledger (
    inventory_movement_id,
    branch_id,
    inventory_item_id,
    movement_direction,
    quantity,
    signed_quantity,
    source_type,
    reference_id,
    actor_id,
    actor_name,
    created_at,
    metadata
  ) values (
    new.id,
    new.location_id,
    new.inventory_item_id,
    v_direction,
    abs(new.quantity),
    new.quantity,
    v_source_type,
    new.reference_id,
    new.actor_id,
    new.actor_name,
    new.created_at,
    coalesce(new.metadata, '{}'::jsonb)
  )
  on conflict (inventory_movement_id) do nothing;

  return new;
end;
$$ language plpgsql;

drop trigger if exists inventory_ledger_mirror on inventory_movements;
create trigger inventory_ledger_mirror
after insert on inventory_movements
for each row execute function mirror_movement_to_inventory_ledger();

create or replace function enforce_authorized_inventory_deduction() returns trigger as $$
declare
  v_adj_id uuid;
  v_is_approved boolean;
begin
  if new.movement_type = 'MANUAL_UPDATE' and coalesce(new.quantity, 0) < 0 then
    raise exception 'MANUAL_DEDUCTION_NOT_ALLOWED';
  end if;

  if new.movement_type = 'ADJUSTMENT' and coalesce(new.quantity, 0) < 0 then
    begin
      v_adj_id := new.reference_id::uuid;
    exception
      when others then
        raise exception 'ADJUSTMENT_REFERENCE_INVALID';
    end;

    select exists (
      select 1 from stock_adjustments sa
      where sa.id = v_adj_id and sa.status = 'APPROVED'
    ) into v_is_approved;

    if not coalesce(v_is_approved, false) then
      raise exception 'ADJUSTMENT_NOT_APPROVED';
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists inventory_deduction_guard on inventory_movements;
create trigger inventory_deduction_guard
before insert on inventory_movements
for each row execute function enforce_authorized_inventory_deduction();

insert into inventory_ledger (
  inventory_movement_id,
  branch_id,
  inventory_item_id,
  movement_direction,
  quantity,
  signed_quantity,
  source_type,
  reference_id,
  actor_id,
  actor_name,
  created_at,
  metadata
)
select
  m.id,
  m.location_id,
  m.inventory_item_id,
  case when coalesce(m.quantity, 0) < 0 then 'OUT' else 'IN' end,
  abs(m.quantity),
  m.quantity,
  case m.movement_type
    when 'SALE' then 'POS'
    when 'RETURN' then 'POS'
    when 'PURCHASE_RECEIPT' then 'PURCHASE_ORDER'
    when 'TRANSFER_OUT' then 'TRANSFER'
    when 'TRANSFER_IN' then 'TRANSFER'
    when 'ADJUSTMENT' then 'ADJUSTMENT'
    when 'COUNT_APPROVAL' then 'COUNT_APPROVAL'
    when 'RETURN_TO_SUPPLIER' then 'RETURN_TO_SUPPLIER'
    else 'SYSTEM'
  end,
  m.reference_id,
  m.actor_id,
  m.actor_name,
  m.created_at,
  coalesce(m.metadata, '{}'::jsonb)
from inventory_movements m
where not exists (
  select 1 from inventory_ledger l where l.inventory_movement_id = m.id
);

create table if not exists inventory_metrics (
  id uuid default gen_random_uuid() primary key,
  branch_id uuid not null references locations(id) on delete cascade,
  inventory_item_id uuid not null references inventory_items(id) on delete cascade,
  velocity_per_hour numeric not null default 0,
  avg_daily_usage numeric not null default 0,
  demand_multiplier numeric not null default 1,
  hours_to_stockout numeric,
  reorder_point numeric not null default 0,
  suggested_reorder_qty numeric not null default 0,
  needs_reorder boolean not null default false,
  forecast_accuracy_percent numeric,
  updated_at timestamptz not null default now(),
  unique(branch_id, inventory_item_id)
);
create index if not exists inventory_metrics_reorder_idx on inventory_metrics(branch_id, needs_reorder, hours_to_stockout);

alter table inventory_metrics enable row level security;
drop policy if exists "Auth read inventory metrics" on inventory_metrics;
create policy "Auth read inventory metrics" on inventory_metrics for select using (current_user_can_access_location(branch_id));
drop policy if exists "System write inventory metrics" on inventory_metrics;
create policy "System write inventory metrics" on inventory_metrics for all using (current_user_is_admin() or current_user_is_manager() or current_user_is_warehouse_staff());

create or replace function get_effective_demand_multiplier(p_branch_id uuid, p_at timestamptz default now())
returns numeric as $$
declare
  v_base numeric := 1;
  v_event numeric := 1;
begin
  if extract(isodow from p_at) in (5, 6) then
    v_base := 1.2;
  end if;

  select coalesce(max(multiplier), 1)
  into v_event
  from calendar_events
  where is_active = true
    and event_date = p_at::date
    and (branch_id = p_branch_id or branch_id is null);

  return coalesce(v_base, 1) * coalesce(v_event, 1);
end;
$$ language plpgsql stable;

create or replace function refresh_inventory_metric_item(p_branch_id uuid, p_inventory_item_id uuid)
returns void as $$
declare
  v_velocity numeric := 0;
  v_avg_daily numeric := 0;
  v_on_hand numeric := 0;
  v_multiplier numeric := 1;
  v_hours_to_stockout numeric := null;
  v_reorder_point numeric := 0;
  v_suggested_qty numeric := 0;
  v_lead_days integer := 1;
  v_safety_stock numeric := 0;
begin
  select coalesce(stock, 0), greatest(coalesce(lead_time_days, 1), 1), coalesce(safety_stock, 0)
  into v_on_hand, v_lead_days, v_safety_stock
  from inventory_items
  where id = p_inventory_item_id
    and location_id = p_branch_id;

  select coalesce(sum(quantity), 0) / 3.0
  into v_velocity
  from inventory_ledger
  where branch_id = p_branch_id
    and inventory_item_id = p_inventory_item_id
    and source_type = 'POS'
    and movement_direction = 'OUT'
    and created_at >= now() - interval '3 hours';

  select coalesce(sum(quantity), 0) / 30.0
  into v_avg_daily
  from inventory_ledger
  where branch_id = p_branch_id
    and inventory_item_id = p_inventory_item_id
    and source_type = 'POS'
    and movement_direction = 'OUT'
    and created_at >= now() - interval '30 days';

  v_multiplier := get_effective_demand_multiplier(p_branch_id, now());
  v_reorder_point := (coalesce(v_avg_daily, 0) * v_lead_days * v_multiplier) + v_safety_stock;

  if coalesce(v_velocity, 0) > 0 then
    v_hours_to_stockout := v_on_hand / (v_velocity * v_multiplier);
  end if;

  v_suggested_qty := greatest(0, ceil(v_reorder_point + coalesce(v_avg_daily, 0) - v_on_hand));

  insert into inventory_metrics (
    branch_id,
    inventory_item_id,
    velocity_per_hour,
    avg_daily_usage,
    demand_multiplier,
    hours_to_stockout,
    reorder_point,
    suggested_reorder_qty,
    needs_reorder,
    updated_at
  ) values (
    p_branch_id,
    p_inventory_item_id,
    coalesce(v_velocity, 0),
    coalesce(v_avg_daily, 0),
    coalesce(v_multiplier, 1),
    v_hours_to_stockout,
    coalesce(v_reorder_point, 0),
    coalesce(v_suggested_qty, 0),
    v_on_hand <= coalesce(v_reorder_point, 0),
    now()
  )
  on conflict (branch_id, inventory_item_id) do update
  set
    velocity_per_hour = excluded.velocity_per_hour,
    avg_daily_usage = excluded.avg_daily_usage,
    demand_multiplier = excluded.demand_multiplier,
    hours_to_stockout = excluded.hours_to_stockout,
    reorder_point = excluded.reorder_point,
    suggested_reorder_qty = excluded.suggested_reorder_qty,
    needs_reorder = excluded.needs_reorder,
    updated_at = excluded.updated_at;
end;
$$ language plpgsql;

create or replace function refresh_inventory_metrics(p_branch_id uuid default null)
returns void as $$
declare
  rec record;
begin
  for rec in
    select id, location_id
    from inventory_items
    where p_branch_id is null or location_id = p_branch_id
  loop
    perform refresh_inventory_metric_item(rec.location_id, rec.id);
  end loop;
end;
$$ language plpgsql;

create table if not exists stock_transfer_recommendations (
  id uuid default gen_random_uuid() primary key,
  from_branch_id uuid not null references locations(id),
  to_branch_id uuid not null references locations(id),
  inventory_item_id uuid not null references inventory_items(id),
  recommended_qty numeric not null check (recommended_qty > 0),
  reason text not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED')),
  created_at timestamptz not null default now()
);
create index if not exists stock_transfer_reco_to_branch_idx on stock_transfer_recommendations(to_branch_id, status, created_at desc);

create table if not exists inventory_alerts (
  id uuid default gen_random_uuid() primary key,
  branch_id uuid not null references locations(id),
  inventory_item_id uuid not null references inventory_items(id),
  alert_type text not null check (alert_type in ('STOCKOUT_RISK', 'REORDER_REACHED', 'VELOCITY_SPIKE')),
  severity text not null check (severity in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  message text not null,
  recommended_action text,
  channel text not null default 'DASHBOARD' check (channel in ('DASHBOARD', 'WEB', 'MOBILE', 'WEBHOOK')),
  status text not null default 'OPEN' check (status in ('OPEN', 'ACKNOWLEDGED', 'RESOLVED')),
  created_at timestamptz not null default now()
);
create index if not exists inventory_alerts_branch_status_idx on inventory_alerts(branch_id, status, created_at desc);

create or replace function recommend_stock_transfer_for_item(p_to_branch_id uuid, p_item_id uuid, p_needed_qty numeric)
returns table(from_branch_id uuid, recommended_qty numeric) as $$
begin
  return query
  with candidates as (
    select
      im.branch_id,
      greatest(
        0,
        coalesce(ii.stock, 0) - (coalesce(im.reorder_point, 0) + coalesce(ii.safety_stock, 0))
      ) as surplus
    from inventory_metrics im
    join inventory_items ii
      on ii.id = im.inventory_item_id
     and ii.location_id = im.branch_id
    where im.inventory_item_id = p_item_id
      and im.branch_id <> p_to_branch_id
      and coalesce(ii.stock, 0) > coalesce(im.reorder_point, 0)
  )
  select
    c.branch_id,
    least(c.surplus, p_needed_qty)
  from candidates c
  where c.surplus > 0
  order by c.surplus desc
  limit 1;
end;
$$ language plpgsql stable;

create or replace function evaluate_stockout_alert(p_branch_id uuid, p_inventory_item_id uuid)
returns void as $$
declare
  v_metric record;
  v_item_name text;
  v_branch_name text;
  v_from_branch uuid;
  v_reco_qty numeric;
  v_action text;
begin
  select * into v_metric
  from inventory_metrics
  where branch_id = p_branch_id
    and inventory_item_id = p_inventory_item_id;

  if not found then
    return;
  end if;

  if v_metric.hours_to_stockout is null or v_metric.hours_to_stockout > 4 then
    return;
  end if;

  select name into v_item_name from inventory_items where id = p_inventory_item_id;
  select name into v_branch_name from locations where id = p_branch_id;

  select from_branch_id, recommended_qty
    into v_from_branch, v_reco_qty
  from recommend_stock_transfer_for_item(
    p_branch_id,
    p_inventory_item_id,
    greatest(0, coalesce(v_metric.suggested_reorder_qty, 0))
  );

  if v_from_branch is not null and v_reco_qty > 0 then
    v_action := format('Recommend transfer %.2f units from branch %s', v_reco_qty, v_from_branch::text);
    insert into stock_transfer_recommendations (from_branch_id, to_branch_id, inventory_item_id, recommended_qty, reason)
    values (v_from_branch, p_branch_id, p_inventory_item_id, v_reco_qty, 'Predicted stockout');
  else
    v_action := 'Create draft purchase order';
  end if;

  insert into inventory_alerts (
    branch_id,
    inventory_item_id,
    alert_type,
    severity,
    message,
    recommended_action,
    channel
  ) values (
    p_branch_id,
    p_inventory_item_id,
    'STOCKOUT_RISK',
    case when v_metric.hours_to_stockout <= 2 then 'CRITICAL' else 'HIGH' end,
    format(
      '%s - %s | velocity %.2f/h | stockout in %.2f hours',
      coalesce(v_item_name, 'Item'),
      coalesce(v_branch_name, 'Branch'),
      coalesce(v_metric.velocity_per_hour, 0),
      coalesce(v_metric.hours_to_stockout, 0)
    ),
    v_action,
    'DASHBOARD'
  );
end;
$$ language plpgsql;

create or replace function generate_auto_reorder_purchase_orders(p_branch_id uuid default null, p_actor_id uuid default null)
returns integer as $$
declare
  rec record;
  v_count integer := 0;
begin
  for rec in
    select
      im.branch_id,
      im.inventory_item_id,
      greatest(1, ceil(coalesce(im.suggested_reorder_qty, 0))) as qty
    from inventory_metrics im
    where im.needs_reorder = true
      and (p_branch_id is null or im.branch_id = p_branch_id)
      and coalesce(im.suggested_reorder_qty, 0) > 0
  loop
    insert into purchase_orders (
      supplier_name,
      location_id,
      status,
      created_by,
      notes,
      total_value,
      items_count,
      manifest
    ) values (
      'AUTO_REPLENISHMENT',
      rec.branch_id,
      'DRAFT',
      p_actor_id,
      'Auto-generated by dynamic reorder policy',
      0,
      1,
      jsonb_build_array(jsonb_build_object('item_id', rec.inventory_item_id, 'quantity', rec.qty))
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$ language plpgsql;

create table if not exists stockout_events (
  id uuid default gen_random_uuid() primary key,
  branch_id uuid not null references locations(id),
  inventory_item_id uuid not null references inventory_items(id),
  detected_at timestamptz not null default now(),
  root_cause text not null check (root_cause in ('DEMAND_SPIKE', 'SUPPLIER_DELAY', 'INVENTORY_RECORDING_ERROR', 'CAMPAIGN_IMPACT', 'DATA_ENTRY_INCONSISTENCY')),
  resolution_action text,
  reference_id text,
  created_by uuid
);
create index if not exists stockout_events_branch_item_detected_idx on stockout_events(branch_id, inventory_item_id, detected_at desc);

create or replace function process_pos_inventory_event(
  p_branch_id uuid,
  p_event_type text,
  p_reference_id text,
  p_lines jsonb,
  p_user_id uuid default null,
  p_user_name text default null
)
returns void as $$
declare
  v_line jsonb;
  v_bom record;
  v_product_id uuid;
  v_service_type text;
  v_qty_effect numeric;
  v_stock numeric;
  v_movement_type text;
begin
  for v_line in
    select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb))
  loop
    v_product_id := nullif(v_line->>'product_id', '')::uuid;
    v_service_type := upper(coalesce(nullif(v_line->>'service_type', ''), 'ALL'));

    if p_event_type = 'SALE_COMPLETED' then
      v_qty_effect := -abs(coalesce((v_line->>'quantity')::numeric, 0));
      v_movement_type := 'SALE';
    elsif p_event_type = 'SALE_REVERSED' then
      v_qty_effect := abs(coalesce((v_line->>'quantity')::numeric, 0));
      v_movement_type := 'RETURN';
    elsif p_event_type = 'ORDER_MODIFIED' then
      v_qty_effect := coalesce((v_line->>'delta_quantity')::numeric, 0);
      v_movement_type := case when v_qty_effect < 0 then 'SALE' else 'RETURN' end;
    else
      raise exception 'UNSUPPORTED_EVENT_TYPE';
    end if;

    if v_product_id is null or v_qty_effect = 0 then
      continue;
    end if;

    for v_bom in
      select *
      from product_bom b
      where b.product_id = v_product_id
        and b.is_active = true
        and (b.branch_id = p_branch_id or b.branch_id is null)
        and (b.service_type = 'ALL' or b.service_type = v_service_type)
      order by case when b.branch_id = p_branch_id then 0 else 1 end
    loop
      select stock into v_stock
      from inventory_items
      where id = v_bom.inventory_item_id
        and location_id = p_branch_id
      for update;

      if not found then
        raise exception 'BOM_ITEM_NOT_FOUND';
      end if;

      if v_qty_effect < 0 and coalesce(v_stock, 0) < abs(v_qty_effect * v_bom.quantity) then
        raise exception 'INSUFFICIENT_BOM_STOCK';
      end if;

      perform set_config('inventory.movement_type', v_movement_type, true);
      perform set_config('inventory.reference_id', coalesce(p_reference_id, ''), true);
      perform set_config('inventory.actor_id', coalesce(p_user_id::text, ''), true);
      perform set_config('inventory.actor_name', coalesce(p_user_name, ''), true);

      update inventory_items
      set stock = coalesce(stock, 0) + (v_qty_effect * v_bom.quantity),
          last_movement_at = now()
      where id = v_bom.inventory_item_id
        and location_id = p_branch_id;

      perform refresh_inventory_metric_item(p_branch_id, v_bom.inventory_item_id);
      perform evaluate_stockout_alert(p_branch_id, v_bom.inventory_item_id);
    end loop;
  end loop;
end;
$$ language plpgsql;

create or replace view inventory_operational_kpis as
select
  im.branch_id,
  l.name as branch_name,
  im.inventory_item_id,
  i.name as item_name,
  im.hours_to_stockout,
  im.velocity_per_hour,
  im.avg_daily_usage,
  im.forecast_accuracy_percent,
  case when coalesce(i.stock, 0) = 0 then null else (coalesce(im.avg_daily_usage, 0) / nullif(i.stock, 0)) end as stock_turnover_rate,
  case when coalesce(im.velocity_per_hour, 0) = 0 then null else (coalesce(i.stock, 0) / im.velocity_per_hour) end as dead_stock_days_estimate,
  im.reorder_point,
  im.suggested_reorder_qty,
  im.updated_at
from inventory_metrics im
join inventory_items i on i.id = im.inventory_item_id and i.location_id = im.branch_id
left join locations l on l.id = im.branch_id;
