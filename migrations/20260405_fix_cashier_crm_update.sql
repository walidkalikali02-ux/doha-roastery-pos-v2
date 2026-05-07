-- Migration: 20260405_fix_cashier_crm_update
-- Issue: Cashiers cannot edit customer information in CRM

-- First check what columns exist in customers table
-- This helps debug column name mismatches
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'customers';

-- Add missing columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'last_edited_by_name') THEN
    ALTER TABLE public.customers ADD COLUMN last_edited_by_name TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'full_name') THEN
    ALTER TABLE public.customers ADD COLUMN full_name TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'is_active') THEN
    ALTER TABLE public.customers ADD COLUMN is_active BOOLEAN DEFAULT true;
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
