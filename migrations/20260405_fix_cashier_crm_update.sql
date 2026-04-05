-- Migration: 20260405_fix_cashier_crm_update
-- Issue: Cashiers cannot edit customer information in CRM

-- Add missing last_edited_by_name column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'last_edited_by_name'
  ) THEN
    ALTER TABLE public.customers ADD COLUMN last_edited_by_name TEXT;
  END IF;
END $$;

-- Drop potentially conflicting policies
DROP POLICY IF EXISTS "cashier_select_customers" ON public.customers;
DROP POLICY IF EXISTS "cashier_insert_customers" ON public.customers;
DROP POLICY IF EXISTS "cashier_update_customers" ON public.customers;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.customers;
DROP POLICY IF EXISTS "Enable insert for authenticated" ON public.customers;

-- Enable RLS and create permissive policies
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_select_customers"
  ON public.customers FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_insert_customers"
  ON public.customers FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated_update_customers"
  ON public.customers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON public.customers TO authenticated;
