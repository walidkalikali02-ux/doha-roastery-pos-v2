# RLS Policies Contract: Role-Based Access Control

**Branch**: `004-fix-engineering-issues` | **Date**: 2026-04-18

## Overview

This contract defines the Row Level Security policies that replace the current blanket `authenticated` policies. Each table's policies follow the role hierarchy: ADMIN > MANAGER > HR > ROASTER > CASHIER > WAREHOUSE_STAFF.

## Role Helper Functions

The following PostgreSQL functions are used as policy qualifiers:

```sql
-- Already exists in cashier migration:
-- current_user_is_cashier() RETURNS BOOLEAN

-- To be created:
CREATE OR REPLACE FUNCTION current_user_is_admin() RETURNS BOOLEAN
LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN');
$$;

CREATE OR REPLACE FUNCTION current_user_is_manager() RETURNS BOOLEAN
LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER'));
$$;

CREATE OR REPLACE FUNCTION current_user_is_hr() RETURNS BOOLEAN
LANGUAGE SQL SECURITY DEFINER STABLE AS $$
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
REVOKE EXECUTE ON FUNCTION current_user_is_warehouse() FROM public;
-- Also for existing current_user_is_cashier():
REVOKE EXECUTE ON FUNCTION current_user_is_cashier() FROM public;

GRANT EXECUTE ON FUNCTION current_user_is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION current_user_is_manager() TO authenticated;
GRANT EXECUTE ON FUNCTION current_user_is_hr() TO authenticated;
GRANT EXECUTE ON FUNCTION current_user_is_warehouse() TO authenticated;
GRANT EXECUTE ON FUNCTION current_user_is_cashier() TO authenticated;
```

## Table Policies

### green_beans

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| ADMIN | ✅ | ✅ | ✅ | ✅ |
| MANAGER | ✅ | ✅ | ✅ | ❌ |
| ROASTER | ✅ | ✅ (status changes) | ✅ (own roasts) | ❌ |
| CASHIER | ✅ | ❌ | ❌ | ❌ |
| WAREHOUSE_STAFF | ✅ | ✅ | ✅ | ❌ |

```sql
-- Replace existing "Auth all green beans" policy
DROP POLICY IF EXISTS "Auth all green beans" ON green_beans;

CREATE POLICY "Role-based read green_beans" ON green_beans
  FOR SELECT USING (true); -- Readable by all authenticated (needed for POS product listing)

CREATE POLICY "Admin full green_beans" ON green_beans
  FOR ALL USING (current_user_is_admin());

CREATE POLICY "Manager manage green_beans" ON green_beans
  FOR INSERT USING (current_user_is_manager())
  WITH CHECK (current_user_is_manager());

CREATE POLICY "Manager update green_beans" ON green_beans
  FOR UPDATE USING (current_user_is_manager())
  WITH CHECK (current_user_is_manager());

CREATE POLICY "Roaster update green_beans" ON green_beans
  FOR UPDATE USING (current_user_is_roaster())
  WITH CHECK (current_user_is_roaster());
```

### transactions

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| ADMIN | ✅ (all) | ✅ | ✅ | ✅ |
| MANAGER | ✅ (all) | ✅ | ✅ | ❌ |
| CASHIER | ✅ (own only) | ✅ (own) | ✅ (own, status only) | ❌ |

```sql
-- Replace existing cashier_name-based policy
DROP POLICY IF EXISTS "Cashiers can view own transactions" ON transactions;
-- (and any other permissive policies)

CREATE POLICY "Admin full transactions" ON transactions
  FOR ALL USING (current_user_is_admin());

CREATE POLICY "Manager manage transactions" ON transactions
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
```

### locations

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| ADMIN | ✅ | ✅ | ✅ | ✅ |
| MANAGER | ✅ | ✅ | ✅ | ❌ |
| All others | ✅ | ❌ | ❌ | ❌ |

```sql
DROP POLICY IF EXISTS "Public read locations" ON locations;
DROP POLICY IF EXISTS "Auth all locations" ON locations;

CREATE POLICY "Authenticated read locations" ON locations
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admin full locations" ON locations
  FOR ALL USING (current_user_is_admin());

CREATE POLICY "Manager manage locations" ON locations
  FOR INSERT USING (current_user_is_manager()) WITH CHECK (current_user_is_manager());
CREATE POLICY "Manager update locations" ON locations
  FOR UPDATE USING (current_user_is_manager()) WITH CHECK (current_user_is_manager());
```

### cash_movements

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| ADMIN | ✅ (all) | ✅ | ✅ | ✅ |
| MANAGER | ✅ (all) | ✅ | ✅ | ❌ |
| CASHIER | ✅ (own branch, own shift) | ✅ | ❌ | ❌ |

```sql
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
```

### customers

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| ADMIN | ✅ | ✅ | ✅ | ✅ |
| MANAGER | ✅ | ✅ | ✅ | ❌ |
| CASHIER | ✅ (own branch) | ✅ | ✅ (own branch) | ❌ |
| HR | ✅ (read-only) | ❌ | ❌ | ❌ |

```sql
DROP POLICY IF EXISTS "Enable read access for all users on customers" ON customers;
-- Remove any permissive USING (true) policies

CREATE POLICY "Admin full customers" ON customers
  FOR ALL USING (current_user_is_admin());

CREATE POLICY "Manager manage customers" ON customers
  FOR SELECT USING (current_user_is_manager());
CREATE POLICY "Manager insert customers" ON customers
  FOR INSERT WITH CHECK (current_user_is_manager());
CREATE POLICY "Manager update customers" ON customers
  FOR UPDATE USING (current_user_is_manager());

CREATE POLICY "Cashier manage branch customers" ON customers
  FOR SELECT USING (current_user_is_cashier());
CREATE POLICY "Cashier insert customers" ON customers
  FOR INSERT WITH CHECK (current_user_is_cashier());
CREATE POLICY "Cashier update customers" ON customers
  FOR UPDATE USING (current_user_is_cashier());

CREATE POLICY "HR read customers" ON customers
  FOR SELECT USING (current_user_is_hr());
```

### employees — Column-Level Security

In addition to row-level policies, MANAGER role must not see sensitive columns:

```sql
-- Create a restricted view for MANAGER role
CREATE OR REPLACE VIEW employees_for_manager AS
SELECT
  id, employee_id, full_name, username, role, employment_status,
  hire_date, branch_id, phone, email, emergency_contact,
  -- salary_base, salary_allowances, bank_name, iban, national_id, qid, employee_pin
  -- are EXCLUDED for MANAGER
  created_at, updated_at
FROM employees;

-- Grant SELECT on this view to MANAGER role via RLS policy
-- ADMIN and HR continue to see full table
```

### accounting_entries

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| ADMIN | ✅ | ✅ | ✅ | ✅ |
| MANAGER | ✅ | ✅ | ❌ | ❌ |

```sql
DROP POLICY IF EXISTS "Auth insert accounting entries" ON accounting_entries;

CREATE POLICY "Admin full accounting_entries" ON accounting_entries
  FOR ALL USING (current_user_is_admin());

CREATE POLICY "Manager read accounting_entries" ON accounting_entries
  FOR SELECT USING (current_user_is_manager());
CREATE POLICY "Manager insert accounting_entries" ON accounting_entries
  FOR INSERT WITH CHECK (current_user_is_manager());
```

### order_reservations

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| ADMIN | ✅ | ✅ | ✅ | ✅ |
| MANAGER | ✅ | ✅ | ✅ | ❌ |
| CASHIER | ✅ (own) | ✅ | ✅ (own) | ❌ |

```sql
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
```

## Audit Trail

All policy changes should be applied in a single migration file with a clear header comment indicating what was dropped and what replaces it. The migration should be idempotent (use `DROP POLICY IF EXISTS` before creating).

```sql
-- Migration: 20260418_rls_role_based_policies.sql
-- Purpose: Replace blanket 'authenticated' policies with role-based access control
-- Depends on: 20260418_add_cashier_id_column.sql, helpers (current_user_is_* functions)
```