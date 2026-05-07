-- ============================================
-- CASHIER ROLE RLS POLICIES
-- Migration: 20260330_cashier_rls_policies
-- Feature: 003-cashier-role-restriction
-- ============================================
-- Pre-migration audit results:
-- The codebase uses:
--   - `transactions` table with `cashier_name` (not `sales.cashier_id`)
--   - `shifts` table with `cashier_id`, `cashier_name`
--   - `cash_movements` table with permissive policies (needs restriction)
--   - Existing RLS helpers: current_user_is_admin(), current_user_is_manager(), etc.
--   - NO existing `current_user_is_cashier()` function
--
-- IMPORTANT: This migration creates cashier-specific RLS policies.
-- Tables affected: transactions, shifts, cash_movements, profiles
-- ============================================

-- Helper function: get current user's role
-- Creates a new function following the existing pattern in enable_inventory_features.sql
CREATE OR REPLACE FUNCTION public.current_user_is_cashier()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'CASHIER' 
    AND is_active = true
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ----------------------------------------
-- TRANSACTIONS (POS sales)
-- Cashiers can only see their own transactions (matched by cashier_name)
-- ----------------------------------------

-- First, check if transactions table exists and has RLS
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transactions') THEN
    ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing permissive policies if they exist
    DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.transactions;
    DROP POLICY IF EXISTS "Allow all access" ON public.transactions;
    
    -- Create cashier-specific policies
    -- Cashiers can only see their own transactions
    CREATE POLICY "cashier_select_own_transactions"
      ON public.transactions FOR SELECT
      USING (
        CASE
          WHEN public.current_user_is_cashier() THEN cashier_name = (SELECT COALESCE(full_name, username) FROM public.profiles WHERE id = auth.uid())
          ELSE true
        END
      );
    
    -- Cashiers can insert transactions (their own name is recorded)
    CREATE POLICY "cashier_insert_transactions"
      ON public.transactions FOR INSERT
      WITH CHECK (true); -- Allow insert, cashier_name will be set by app
    
    -- Cashiers cannot update or delete transactions
    CREATE POLICY "cashier_update_own_transactions"
      ON public.transactions FOR UPDATE
      USING (
        CASE
          WHEN public.current_user_is_cashier() THEN false -- No updates for cashiers
          ELSE true
        END
      );
  END IF;
END $$;

-- ----------------------------------------
-- SHIFTS
-- Cashiers can only manage their own shifts
-- ----------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shifts') THEN
    ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing permissive policies if they exist
    DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.shifts;
    
    -- Cashiers can only see their own shifts
    CREATE POLICY "cashier_select_own_shifts"
      ON public.shifts FOR SELECT
      USING (
        CASE
          WHEN public.current_user_is_cashier() THEN cashier_id = auth.uid()
          ELSE true
        END
      );
    
    -- Cashiers can insert their own shifts
    CREATE POLICY "cashier_insert_own_shifts"
      ON public.shifts FOR INSERT
      WITH CHECK (
        CASE
          WHEN public.current_user_is_cashier() THEN cashier_id = auth.uid()
          ELSE true
        END
      );
    
    -- Cashiers can update their own shifts (for closing)
    CREATE POLICY "cashier_update_own_shifts"
      ON public.shifts FOR UPDATE
      USING (
        CASE
          WHEN public.current_user_is_cashier() THEN cashier_id = auth.uid()
          ELSE true
        END
      );
  END IF;
END $$;

-- ----------------------------------------
-- CASH_MOVEMENTS
-- Cashiers can only see movements related to their shifts
-- ----------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cash_movements') THEN
    -- Drop permissive policy
    DROP POLICY IF EXISTS "Enable read access for all users" ON public.cash_movements;
    DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.cash_movements;
    
    -- Create cashier-specific policies
    CREATE POLICY "cashier_select_own_cash_movements"
      ON public.cash_movements FOR SELECT
      USING (
        CASE
          WHEN public.current_user_is_cashier() THEN 
            shift_id IN (SELECT id FROM public.shifts WHERE cashier_id = auth.uid())
          ELSE true
        END
      );
    
    CREATE POLICY "cashier_insert_own_cash_movements"
      ON public.cash_movements FOR INSERT
      WITH CHECK (
        CASE
          WHEN public.current_user_is_cashier() THEN 
            shift_id IN (SELECT id FROM public.shifts WHERE cashier_id = auth.uid() AND status = 'OPEN')
          ELSE true
        END
      );
  END IF;
END $$;

-- ----------------------------------------
-- PROFILES
-- Cashiers can read and update their own profile
-- ----------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    
    -- Check if restrictive policy already exists
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'profiles' 
      AND policyname = 'cashier_read_own_profile'
    ) THEN
      CREATE POLICY "cashier_read_own_profile"
        ON public.profiles FOR SELECT
        USING (
          CASE
            WHEN public.current_user_is_cashier() THEN id = auth.uid()
            ELSE true
          END
        );
    END IF;
    
    -- Allow cashiers to update their own profile (name, phone, etc.)
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'profiles' 
      AND policyname = 'cashier_update_own_profile'
    ) THEN
      CREATE POLICY "cashier_update_own_profile"
        ON public.profiles FOR UPDATE
        USING (
          CASE
            WHEN public.current_user_is_cashier() THEN id = auth.uid()
            ELSE true
          END
        )
        WITH CHECK (
          CASE
            WHEN public.current_user_is_cashier() THEN id = auth.uid()
            ELSE true
          END
        );
    END IF;
  END IF;
END $$;

-- ----------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customers') THEN
    ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
    
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'customers' 
      AND policyname = 'cashier_select_customers'
    ) THEN
      CREATE POLICY "cashier_select_customers"
        ON public.customers FOR SELECT
        USING (true);
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'customers' 
      AND policyname = 'cashier_insert_customers'
    ) THEN
      CREATE POLICY "cashier_insert_customers"
        ON public.customers FOR INSERT
        WITH CHECK (true);
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'customers' 
      AND policyname = 'cashier_update_customers'
    ) THEN
      CREATE POLICY "cashier_update_customers"
        ON public.customers FOR UPDATE
        USING (true);
    END IF;
  END IF;
END $$;

-- ----------------------------------------
-- PRODUCTS / PRODUCT_DEFINITIONS (read-only for all, POS needs this)
-- Note: Codebase uses 'product_definitions' table, not 'products'
-- ----------------------------------------

DO $$
BEGIN
  -- Try product_definitions first (actual table name)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_definitions') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'product_definitions' 
      AND policyname = 'admin_manager_all_product_definitions'
    ) THEN
      ALTER TABLE public.product_definitions ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "admin_manager_all_product_definitions"
        ON public.product_definitions FOR ALL
        USING (
          EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('ADMIN', 'MANAGER')
          )
        );
    END IF;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'products' 
      AND policyname = 'admin_manager_all_products'
    ) THEN
      ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "admin_manager_all_products"
        ON public.products FOR ALL
        USING (
          EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('ADMIN', 'MANAGER')
          )
        );
    END IF;
  END IF;
END $$;

-- ----------------------------------------
-- Grant necessary permissions
-- ----------------------------------------

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.transactions TO authenticated;
GRANT INSERT ON public.transactions TO authenticated;
GRANT SELECT ON public.shifts TO authenticated;
GRANT INSERT ON public.shifts TO authenticated;
GRANT UPDATE ON public.shifts TO authenticated;
GRANT SELECT ON public.cash_movements TO authenticated;
GRANT INSERT ON public.cash_movements TO authenticated;
GRANT SELECT ON public.profiles TO authenticated;

-- ============================================
-- ROLLBACK SCRIPT (save for reference)
-- ============================================
-- To rollback:
-- DROP POLICY IF EXISTS "cashier_select_own_transactions" ON public.transactions;
-- DROP POLICY IF EXISTS "cashier_insert_transactions" ON public.transactions;
-- DROP POLICY IF EXISTS "cashier_update_own_transactions" ON public.transactions;
-- DROP POLICY IF EXISTS "cashier_select_own_shifts" ON public.shifts;
-- DROP POLICY IF EXISTS "cashier_insert_own_shifts" ON public.shifts;
-- DROP POLICY IF EXISTS "cashier_update_own_shifts" ON public.shifts;
-- DROP POLICY IF EXISTS "cashier_select_own_cash_movements" ON public.cash_movements;
-- DROP POLICY IF EXISTS "cashier_insert_own_cash_movements" ON public.cash_movements;
-- DROP POLICY IF EXISTS "cashier_read_own_profile" ON public.profiles;
-- DROP FUNCTION IF EXISTS public.current_user_is_cashier();
-- ============================================