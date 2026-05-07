-- Migration: 20260418_rls_role_based_policies.sql
-- Purpose: Replace blanket 'authenticated' policies with role-based access control
-- Depends on: profiles table with 'role' column

-- ============================================================
-- STEP 1: Create role helper functions
-- ============================================================

CREATE OR REPLACE FUNCTION current_user_is_admin() RETURNS BOOLEAN
LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN');
$$;

CREATE OR REPLACE FUNCTION current_user_is_manager() RETURNS BOOLEAN
LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER'));
$$;

CREATE OR REPLACE FUNCTION current_user_is_hr() RETURNS BOOLEAN
LANGUAGE SQL DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'HR'));
$$;

CREATE OR REPLACE FUNCTION current_user_is_roaster() RETURNS BOOLEAN
LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER', 'ROASTER'));
$$;

CREATE OR REPLACE FUNCTION current_user_is_warehouse() RETURNS BOOLEAN
LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER', 'WAREHOUSE_STAFF'));
$$;

-- Revoke public execute, grant authenticated only
REVOKE EXECUTE ON FUNCTION current_user_is_admin() FROM public;
REVOKE EXECUTE ON FUNCTION current_user_is_manager() FROM public;
REVOKE EXECUTE ON FUNCTION current_user_is_hr() FROM public;
REVOKE EXECUTE ON FUNCTION current_user_is_roaster() FROM public;
REVOKE EXECUTE ON FUNCTION current_user_is_warehouse() FROM public;
REVOKE EXECUTE ON FUNCTION current_user_is_cashier() FROM public;

GRANT EXECUTE ON FUNCTION current_user_is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION current_user_is_manager() TO authenticated;
GRANT EXECUTE ON FUNCTION current_user_is_hr() TO authenticated;
GRANT EXECUTE ON FUNCTION current_user_is_roaster() TO authenticated;
GRANT EXECUTE ON FUNCTION current_user_is_warehouse() TO authenticated;
GRANT EXECUTE ON FUNCTION current_user_is_cashier() TO authenticated;

-- ============================================================
-- STEP 2: Replace overly permissive policies
-- ============================================================

-- green_beans: was "Auth all green beans"
DROP POLICY IF EXISTS "Auth all green beans" ON green_beans;
DROP POLICY IF EXISTS "Auth all green bean movements" ON green_bean_movements;

CREATE POLICY "Authenticated read green_beans" ON green_beans
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admin full green_beans" ON green_beans
    FOR ALL USING (current_user_is_admin());
CREATE POLICY "Manager manage green_beans" ON green_beans
    FOR INSERT USING (current_user_is_manager()) WITH CHECK (current_user_is_manager());
CREATE POLICY "Manager update green_beans" ON green_beans
    FOR UPDATE USING (current_user_is_manager()) WITH CHECK (current_user_is_manager());
CREATE POLICY "Roaster update green_beans" ON green_beans
    FOR UPDATE USING (current_user_is_roaster()) WITH CHECK (current_user_is_roaster());

-- green_bean_movements: same role-based pattern
CREATE POLICY "Authenticated read green_bean_movements" ON green_bean_movements
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admin full green_bean_movements" ON green_bean_movements
    FOR ALL USING (current_user_is_admin());
CREATE POLICY "Manager manage green_bean_movements" ON green_bean_movements
    FOR INSERT USING (current_user_is_manager()) WITH CHECK (current_user_is_manager());
CREATE POLICY "Manager update green_bean_movements" ON green_bean_movements
    FOR UPDATE USING (current_user_is_manager()) WITH CHECK (current_user_is_manager());
CREATE POLICY "Roaster update green_bean_movements" ON green_bean_movements
    FOR UPDATE USING (current_user_is_roaster()) WITH CHECK (current_user_is_roaster());

-- locations: was "Auth all locations" + "Public read"
DROP POLICY IF EXISTS "Public read locations" ON locations;
DROP POLICY IF EXISTS "Auth all locations" ON locations;

CREATE POLICY "Authenticated read locations" ON locations
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admin full locations" ON locations
    FOR ALL USING (current_user_is_admin());
CREATE POLICY "Manager insert locations" ON locations
    FOR INSERT USING (current_user_is_manager()) WITH CHECK (current_user_is_manager());
CREATE POLICY "Manager update locations" ON locations
    FOR UPDATE USING (current_user_is_manager()) WITH CHECK (current_user_is_manager());

-- cash_movements: was "Enable read access for all users" (USING true)
DROP POLICY IF EXISTS "Enable read access for all users" ON cash_movements;

CREATE POLICY "Admin full cash_movements" ON cash_movements
    FOR ALL USING (current_user_is_admin());
CREATE POLICY "Manager manage cash_movements" ON cash_movements
    FOR SELECT USING (current_user_is_manager());
CREATE POLICY "Manager insert cash_movements" ON cash_movements
    FOR INSERT WITH CHECK (current_user_is_manager());
CREATE POLICY "Manager update cash_movements" ON cash_movements
    FOR UPDATE USING (current_user_is_manager());
CREATE POLICY "Cashier read own cash_movements" ON cash_movements
    FOR SELECT USING (
        current_user_is_cashier()
        AND shift_id IN (SELECT id FROM shifts WHERE cashier_id = auth.uid())
    );
CREATE POLICY "Cashier insert cash_movements" ON cash_movements
    FOR INSERT WITH CHECK (current_user_is_cashier());

-- accounting_entries: was "Auth insert accounting entries"
DROP POLICY IF EXISTS "Auth insert accounting entries" ON accounting_entries;

CREATE POLICY "Admin full accounting_entries" ON accounting_entries
    FOR ALL USING (current_user_is_admin());
CREATE POLICY "Manager read accounting_entries" ON accounting_entries
    FOR SELECT USING (current_user_is_manager());
CREATE POLICY "Manager insert accounting_entries" ON accounting_entries
    FOR INSERT WITH CHECK (current_user_is_manager());

-- customers: was permissive USING (true)
DROP POLICY IF EXISTS "Enable read access for all users on customers" ON customers;
DROP POLICY IF EXISTS "Enable insert for authenticated users on customers" ON customers;
DROP POLICY IF EXISTS "Enable update for authenticated users on customers" ON customers;

CREATE POLICY "Admin full customers" ON customers
    FOR ALL USING (current_user_is_admin());
CREATE POLICY "Manager manage customers" ON customers
    FOR SELECT USING (current_user_is_manager());
CREATE POLICY "Manager insert customers" ON customers
    FOR INSERT WITH CHECK (current_user_is_manager());
CREATE POLICY "Manager update customers" ON customers
    FOR UPDATE USING (current_user_is_manager());
CREATE POLICY "Cashier read customers" ON customers
    FOR SELECT USING (current_user_is_cashier());
CREATE POLICY "Cashier insert customers" ON customers
    FOR INSERT WITH CHECK (current_user_is_cashier());
CREATE POLICY "Cashier update customers" ON customers
    FOR UPDATE USING (current_user_is_cashier());
CREATE POLICY "HR read customers" ON customers
    FOR SELECT USING (current_user_is_hr());

-- order_reservations: was "Auth all order reservations"
DROP POLICY IF EXISTS "Auth all order reservations" ON order_reservations;

CREATE POLICY "Admin full order_reservations" ON order_reservations
    FOR ALL USING (current_user_is_admin());
CREATE POLICY "Manager manage order_reservations" ON order_reservations
    FOR SELECT USING (current_user_is_manager());
CREATE POLICY "Manager insert order_reservations" ON order_reservations
    FOR INSERT WITH CHECK (current_user_is_manager());
CREATE POLICY "Manager update order_reservations" ON order_reservations
    FOR UPDATE USING (current_user_is_manager());
CREATE POLICY "Cashier read own order_reservations" ON order_reservations
    FOR SELECT USING (current_user_is_cashier() AND reserved_by = auth.uid());
CREATE POLICY "Cashier insert order_reservations" ON order_reservations
    FOR INSERT WITH CHECK (current_user_is_cashier());
CREATE POLICY "Cashier update own order_reservations" ON order_reservations
    FOR UPDATE USING (current_user_is_cashier() AND reserved_by = auth.uid());

-- ============================================================
-- STEP 3: Update transactions policies for cashier_id matching
-- ============================================================

DROP POLICY IF EXISTS "Cashiers can view own transactions" ON transactions;
DROP POLICY IF EXISTS "Cashiers can create transactions" ON transactions;

CREATE POLICY "Admin full transactions" ON transactions
    FOR ALL USING (current_user_is_admin());
CREATE POLICY "Manager manage_transactions" ON transactions
    FOR SELECT USING (current_user_is_manager());
CREATE POLICY "Manager insert transactions" ON transactions
    FOR INSERT WITH CHECK (current_user_is_manager());
CREATE POLICY "Manager update transactions" ON transactions
    FOR UPDATE USING (current_user_is_manager());
CREATE POLICY "Cashier read own transactions" ON transactions
    FOR SELECT USING (cashier_id = auth.uid());
CREATE POLICY "Cashier create transaction" ON transactions
    FOR INSERT WITH CHECK (cashier_id = auth.uid() AND current_user_is_cashier());
CREATE POLICY "Cashier update own transaction" ON transactions
    FOR UPDATE USING (cashier_id = auth.uid())
    WITH CHECK (cashier_id = auth.uid());

-- ============================================================
-- STEP 4: Add DELETE policy for ADMIN on employees
-- ============================================================

CREATE POLICY "Admin delete employees" ON employees
    FOR DELETE USING (current_user_is_admin());