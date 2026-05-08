-- Migration: 20260508_fix_product_definitions_visibility.sql
-- Purpose: Allow authenticated cashiers to read product catalog data in POS
-- Depends on: product_definitions table and existing admin/manager policy

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'product_definitions') then
    alter table public.product_definitions enable row level security;

    drop policy if exists "authenticated_select_product_definitions" on public.product_definitions;
    create policy "authenticated_select_product_definitions"
      on public.product_definitions
      for select
      using (auth.role() = 'authenticated');

    grant select on public.product_definitions to authenticated;
  end if;
end $$;
