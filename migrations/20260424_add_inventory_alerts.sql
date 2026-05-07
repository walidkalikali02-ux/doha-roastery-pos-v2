-- ALT-001..ALT-006 support schema

create table if not exists inventory_alerts (
  id uuid default gen_random_uuid() primary key,
  inventory_item_id uuid not null references inventory_items(id) on delete cascade,
  product_id uuid not null references product_definitions(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  alert_type text not null check (alert_type in ('LOW_STOCK', 'OUT_OF_STOCK')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'DISMISSED', 'RESOLVED')),
  threshold_qty numeric not null default 0,
  current_qty numeric not null default 0,
  last_trigger_stock numeric,
  last_triggered_at timestamptz,
  dismissed_at timestamptz,
  dismissed_by uuid,
  dismissed_note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (inventory_item_id, alert_type)
);

create index if not exists inventory_alerts_status_idx on inventory_alerts(status, updated_at desc);
create index if not exists inventory_alerts_location_idx on inventory_alerts(location_id, status, updated_at desc);
create index if not exists inventory_alerts_product_idx on inventory_alerts(product_id, status, updated_at desc);

create table if not exists alert_notification_targets (
  id uuid default gen_random_uuid() primary key,
  channel text not null check (channel in ('EMAIL', 'WEBHOOK')),
  target text not null,
  severity text not null default 'P0' check (severity in ('P0', 'P1', 'P2', 'P3')),
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (channel, target)
);

create table if not exists alert_notification_logs (
  id uuid default gen_random_uuid() primary key,
  target_id uuid references alert_notification_targets(id) on delete set null,
  channel text not null,
  payload jsonb not null,
  status text not null default 'QUEUED' check (status in ('QUEUED', 'SENT', 'FAILED')),
  error_message text,
  created_at timestamptz default now()
);
