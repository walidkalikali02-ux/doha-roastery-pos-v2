create or replace function public.replace_product_branch_inventory(
  p_product_id uuid,
  p_location_ids uuid[],
  p_stocks jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product record;
  v_location_id uuid;
  v_stock numeric;
begin
  select
    id,
    name,
    category,
    type,
    image,
    sku,
    unit,
    base_price,
    selling_price,
    cost_price,
    description,
    main_category,
    sub_category,
    variant_of,
    variant_label,
    variant_size,
    variant_flavor,
    is_active,
    product_status,
    labor_cost,
    roasting_overhead,
    estimated_green_bean_cost,
    supplier,
    bean_id,
    roast_level,
    template_id
  into v_product
  from public.product_definitions
  where id = p_product_id;

  if not found then
    raise exception 'Product % not found', p_product_id;
  end if;

  delete from public.inventory_items
  where product_id = p_product_id
    and location_id = any(coalesce(p_location_ids, '{}'::uuid[]));

  foreach v_location_id in array coalesce(p_location_ids, '{}'::uuid[])
  loop
    v_stock := coalesce(nullif(trim(both from coalesce(p_stocks ->> v_location_id::text, '0')), '')::numeric, 0);

    insert into public.inventory_items (
      name,
      category,
      type,
      size,
      price,
      stock,
      reserved_stock,
      damaged_stock,
      product_id,
      location_id,
      sku_prefix,
      image,
      created_at,
      last_movement_at
    )
    values (
      v_product.name,
      v_product.category,
      coalesce(v_product.type, 'PACKAGED_COFFEE'),
      v_product.variant_size,
      coalesce(v_product.selling_price, v_product.base_price, 0),
      v_stock,
      0,
      0,
      p_product_id,
      v_location_id,
      v_product.sku,
      v_product.image,
      now(),
      now()
    );
  end loop;
end;
$$;

