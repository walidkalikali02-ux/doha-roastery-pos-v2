-- Migration: 20260508_fix_deduct_inventory_rls_bypass.sql
-- Purpose: Fix POS checkout by making deduct_inventory_with_cost bypass RLS
--          via SECURITY DEFINER + set role postgres to bypass inventory_items UPDATE policy.

CREATE OR REPLACE FUNCTION public.deduct_inventory_with_cost(p_location_id uuid, p_items jsonb, p_method text, p_transaction_id text, p_user_id uuid, p_user_name text)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
  original_session_user text;
begin
  original_session_user := current_user;

  perform set_config('inventory.movement_type', 'SALE', true);
  perform set_config('inventory.reference_id', coalesce(p_transaction_id, ''), true);
  perform set_config('inventory.actor_id', coalesce(p_user_id::text, ''), true);
  perform set_config('inventory.actor_name', coalesce(p_user_name, ''), true);

  set role postgres;

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

  reset role;

  return total_cost;
end;
$function$;