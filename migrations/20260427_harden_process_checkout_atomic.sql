-- Migration: 20260427_harden_process_checkout_atomic.sql
-- Purpose: Harden checkout against race conditions by moving stock validation + deduction
--          inside one DB transaction with row-level locks and structured error payloads.

create or replace function process_checkout(
  p_items jsonb,
  p_payment_method text,
  p_total numeric,
  p_cashier_id uuid,
  p_shift_id uuid,
  p_location_id uuid
) returns jsonb
language plpgsql
security definer
as $$
declare
  v_transaction_id uuid;
  v_cashier_name text;
  v_item jsonb;
  v_row record;
  v_product_id uuid;
  v_product_name text;
  v_product_type text;
  v_requested_qty numeric;
  v_available_qty numeric;
  v_row_available numeric;
  v_take_qty numeric;
  v_remaining_qty numeric;
  v_dispatch_items jsonb := '[]'::jsonb;
  v_stock_issues jsonb := '[]'::jsonb;
begin
  if p_location_id is null then
    return jsonb_build_object(
      'success', false,
      'transaction_id', null,
      'error_code', 'INVALID_LOCATION',
      'error', 'Location is required'
    );
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object(
      'success', false,
      'transaction_id', null,
      'error_code', 'EMPTY_CART',
      'error', 'At least one checkout item is required'
    );
  end if;

  -- Build row-locked deduction plan by product.
  -- We lock inventory rows now, validate availability, and then deduct in this same transaction.
  for v_item in
    select *
    from jsonb_array_elements(p_items)
  loop
    v_product_id := nullif(v_item->>'product_id', '')::uuid;
    v_requested_qty := coalesce((v_item->>'quantity')::numeric, 0);

    if v_product_id is null or v_requested_qty <= 0 then
      continue;
    end if;

    select pd.name, pd.type
    into v_product_name, v_product_type
    from product_definitions pd
    where pd.id = v_product_id;

    -- Drinks are treated as virtually available in POS.
    if coalesce(v_product_type, '') = 'BEVERAGE' then
      continue;
    end if;

    v_available_qty := 0;
    v_remaining_qty := v_requested_qty;

    for v_row in
      select
        ii.id,
        coalesce(ii.stock, 0) as stock,
        coalesce(ii.reserved_stock, 0) as reserved_stock,
        coalesce(ii.damaged_stock, 0) as damaged_stock
      from inventory_items ii
      where ii.location_id = p_location_id
        and ii.product_id = v_product_id
      order by ii.created_at asc, ii.id asc
      for update
    loop
      v_row_available := greatest(0, v_row.stock - v_row.reserved_stock - v_row.damaged_stock);
      if v_row_available <= 0 then
        continue;
      end if;

      v_available_qty := v_available_qty + v_row_available;

      if v_remaining_qty > 0 then
        v_take_qty := least(v_row_available, v_remaining_qty);
        if v_take_qty > 0 then
          v_dispatch_items := v_dispatch_items || jsonb_build_array(
            jsonb_build_object(
              'item_id', v_row.id,
              'quantity', v_take_qty
            )
          );
          v_remaining_qty := v_remaining_qty - v_take_qty;
        end if;
      end if;
    end loop;

    if v_remaining_qty > 0 then
      v_stock_issues := v_stock_issues || jsonb_build_array(
        jsonb_build_object(
          'product_id', v_product_id,
          'product_name', coalesce(v_product_name, v_product_id::text),
          'requested_qty', v_requested_qty,
          'available_qty', v_available_qty
        )
      );
    end if;
  end loop;

  if jsonb_array_length(v_stock_issues) > 0 then
    return jsonb_build_object(
      'success', false,
      'transaction_id', null,
      'error_code', 'INSUFFICIENT_STOCK',
      'error', 'Insufficient stock for one or more items',
      'stock_issues', v_stock_issues
    );
  end if;

  select coalesce(p.full_name, p.username)
  into v_cashier_name
  from profiles p
  where p.id = p_cashier_id;

  insert into transactions (
    id,
    cashier_id,
    cashier_name,
    location_id,
    payment_method,
    total,
    subtotal,
    vat_amount,
    discount_amount,
    discount_percent,
    discount_type,
    items,
    payment_breakdown,
    received_amount,
    change_amount,
    is_returned,
    user_id
  ) values (
    gen_random_uuid()::text,
    p_cashier_id,
    coalesce(v_cashier_name, 'Cashier'),
    p_location_id,
    p_payment_method,
    p_total,
    p_total,
    0,
    0,
    0,
    null,
    p_items,
    null,
    p_total,
    0,
    false,
    p_cashier_id
  )
  returning id::uuid into v_transaction_id;

  -- Deduct and log inventory movement atomically (includes internal row locks and audit side-effects).
  perform deduct_inventory_with_cost(
    p_location_id,
    v_dispatch_items,
    'WEIGHTED_AVG',
    v_transaction_id::text,
    p_cashier_id,
    coalesce(v_cashier_name, 'Cashier')
  );

  if p_shift_id is not null then
    update shifts
    set total_sales = coalesce(total_sales, 0) + p_total,
        transaction_count = coalesce(transaction_count, 0) + 1,
        updated_at = now()
    where id = p_shift_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'error_code', null,
    'error', null,
    'stock_issues', '[]'::jsonb
  );
exception
  when others then
    return jsonb_build_object(
      'success', false,
      'transaction_id', null,
      'error_code', coalesce(nullif(SQLSTATE, ''), 'CHECKOUT_ERROR'),
      'error', SQLERRM,
      'stock_issues', '[]'::jsonb
    );
end;
$$;

revoke execute on function process_checkout(jsonb, text, numeric, uuid, uuid, uuid) from public;
grant execute on function process_checkout(jsonb, text, numeric, uuid, uuid, uuid) to authenticated;
