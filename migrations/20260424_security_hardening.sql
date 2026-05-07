-- SEC-001..SEC-004 hardening: RLS + immutability + approvals

alter table if exists public.system_settings
  add column if not exists adjustment_approval_threshold numeric not null default 50;

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'inventory_items') then
    alter table public.inventory_items enable row level security;

    drop policy if exists "sec_inventory_items_select" on public.inventory_items;
    create policy "sec_inventory_items_select"
      on public.inventory_items
      for select
      using (
        current_user_can_access_location(location_id)
        and (
          current_user_is_admin()
          or current_user_is_manager()
          or current_user_is_warehouse_staff()
          or current_user_is_roaster()
          or exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'CASHIER' and p.is_active = true
          )
        )
      );

    drop policy if exists "sec_inventory_items_insert" on public.inventory_items;
    create policy "sec_inventory_items_insert"
      on public.inventory_items
      for insert
      with check (
        current_user_can_access_location(location_id)
        and (current_user_is_admin() or current_user_is_manager() or current_user_is_warehouse_staff())
      );

    drop policy if exists "sec_inventory_items_update" on public.inventory_items;
    create policy "sec_inventory_items_update"
      on public.inventory_items
      for update
      using (
        current_user_can_access_location(location_id)
        and (current_user_is_admin() or current_user_is_manager() or current_user_is_warehouse_staff())
      )
      with check (
        current_user_can_access_location(location_id)
        and (current_user_is_admin() or current_user_is_manager() or current_user_is_warehouse_staff())
      );

    drop policy if exists "sec_inventory_items_delete" on public.inventory_items;
    create policy "sec_inventory_items_delete"
      on public.inventory_items
      for delete
      using (current_user_is_admin());
  end if;
end $$;

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'inventory_movements') then
    alter table public.inventory_movements enable row level security;

    drop policy if exists "sec_inventory_movements_select" on public.inventory_movements;
    create policy "sec_inventory_movements_select"
      on public.inventory_movements
      for select
      using (
        current_user_can_access_location(location_id)
        and (
          current_user_is_admin()
          or current_user_is_manager()
          or current_user_is_warehouse_staff()
          or current_user_is_roaster()
          or (
            exists (
              select 1 from public.profiles p
              where p.id = auth.uid() and p.role = 'CASHIER' and p.is_active = true
            )
            and movement_type = 'SALE'
            and actor_id = auth.uid()
          )
        )
      );

    drop policy if exists "sec_inventory_movements_insert" on public.inventory_movements;
    create policy "sec_inventory_movements_insert"
      on public.inventory_movements
      for insert
      with check (
        current_user_can_access_location(location_id)
        and (
          current_user_is_admin()
          or current_user_is_manager()
          or current_user_is_warehouse_staff()
          or current_user_is_roaster()
          or exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'CASHIER' and p.is_active = true
          )
        )
      );

    drop policy if exists "sec_inventory_movements_update_block" on public.inventory_movements;
    create policy "sec_inventory_movements_update_block"
      on public.inventory_movements
      for update
      using (false)
      with check (false);

    drop policy if exists "sec_inventory_movements_delete_block" on public.inventory_movements;
    create policy "sec_inventory_movements_delete_block"
      on public.inventory_movements
      for delete
      using (false);
  end if;
end $$;

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'inventory_alerts') then
    alter table public.inventory_alerts enable row level security;

    drop policy if exists "sec_inventory_alerts_select" on public.inventory_alerts;
    create policy "sec_inventory_alerts_select"
      on public.inventory_alerts
      for select
      using (
        current_user_can_access_location(location_id)
        and (current_user_is_admin() or current_user_is_manager() or current_user_is_warehouse_staff())
      );

    drop policy if exists "sec_inventory_alerts_insert" on public.inventory_alerts;
    create policy "sec_inventory_alerts_insert"
      on public.inventory_alerts
      for insert
      with check (
        current_user_can_access_location(location_id)
        and (current_user_is_admin() or current_user_is_manager() or current_user_is_warehouse_staff())
      );

    drop policy if exists "sec_inventory_alerts_update" on public.inventory_alerts;
    create policy "sec_inventory_alerts_update"
      on public.inventory_alerts
      for update
      using (
        current_user_can_access_location(location_id)
        and (current_user_is_admin() or current_user_is_manager() or current_user_is_warehouse_staff())
      )
      with check (
        current_user_can_access_location(location_id)
        and (current_user_is_admin() or current_user_is_manager() or current_user_is_warehouse_staff())
      );

    drop policy if exists "sec_inventory_alerts_delete_block" on public.inventory_alerts;
    create policy "sec_inventory_alerts_delete_block"
      on public.inventory_alerts
      for delete
      using (false);
  end if;
end $$;

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'alert_notification_targets') then
    alter table public.alert_notification_targets enable row level security;

    drop policy if exists "sec_alert_targets_admin_all" on public.alert_notification_targets;
    create policy "sec_alert_targets_admin_all"
      on public.alert_notification_targets
      for all
      using (current_user_is_admin())
      with check (current_user_is_admin());
  end if;
end $$;

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'alert_notification_logs') then
    alter table public.alert_notification_logs enable row level security;

    drop policy if exists "sec_alert_logs_admin_read" on public.alert_notification_logs;
    create policy "sec_alert_logs_admin_read"
      on public.alert_notification_logs
      for select
      using (current_user_is_admin() or current_user_is_manager());

    drop policy if exists "sec_alert_logs_insert_internal" on public.alert_notification_logs;
    create policy "sec_alert_logs_insert_internal"
      on public.alert_notification_logs
      for insert
      with check (current_user_is_admin() or current_user_is_manager());

    drop policy if exists "sec_alert_logs_update_block" on public.alert_notification_logs;
    create policy "sec_alert_logs_update_block"
      on public.alert_notification_logs
      for update
      using (false)
      with check (false);

    drop policy if exists "sec_alert_logs_delete_block" on public.alert_notification_logs;
    create policy "sec_alert_logs_delete_block"
      on public.alert_notification_logs
      for delete
      using (false);
  end if;
end $$;

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'inventory_movement_audit_logs') then
    alter table public.inventory_movement_audit_logs enable row level security;

    drop policy if exists "sec_inventory_audit_select" on public.inventory_movement_audit_logs;
    create policy "sec_inventory_audit_select"
      on public.inventory_movement_audit_logs
      for select
      using (current_user_is_admin() or current_user_is_manager());

    -- insert remains allowed for trigger-based writes
    drop policy if exists "sec_inventory_audit_insert" on public.inventory_movement_audit_logs;
    create policy "sec_inventory_audit_insert"
      on public.inventory_movement_audit_logs
      for insert
      with check (auth.uid() is not null);

    drop policy if exists "sec_inventory_audit_update_block" on public.inventory_movement_audit_logs;
    create policy "sec_inventory_audit_update_block"
      on public.inventory_movement_audit_logs
      for update
      using (false)
      with check (false);

    drop policy if exists "sec_inventory_audit_delete_block" on public.inventory_movement_audit_logs;
    create policy "sec_inventory_audit_delete_block"
      on public.inventory_movement_audit_logs
      for delete
      using (false);
  end if;
end $$;
