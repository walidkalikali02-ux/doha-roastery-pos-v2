-- Migration: 20260418_add_cashier_id_column.sql
-- Purpose: Add cashier_id column to transactions for ID-based matching (replaces name-based matching)
-- Depends on: existing transactions and profiles tables

-- Step 1: Add nullable cashier_id column
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS cashier_id UUID REFERENCES profiles(id);

-- Step 2: Create migration_flags table for tracking unmatched records
CREATE TABLE IF NOT EXISTS migration_flags (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    issue TEXT NOT NULL,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_by UUID REFERENCES profiles(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE migration_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view migration flags" ON migration_flags
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'ADMIN')
    );

CREATE POLICY "Admins can resolve migration flags" ON migration_flags
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'ADMIN')
    );

-- Step 3: Backfill cashier_id from existing cashier_name
UPDATE transactions t
SET cashier_id = p.id
FROM profiles p
WHERE t.cashier_name = COALESCE(p.full_name, p.username)
  AND t.cashier_id IS NULL;

-- Step 4: Flag unmatched records for manual review
INSERT INTO migration_flags (table_name, record_id, issue)
SELECT 'transactions', t.id, 'Could not match cashier_name: ' || COALESCE(t.cashier_name, 'NULL')
FROM transactions t
WHERE t.cashier_id IS NULL
  AND t.cashier_name IS NOT NULL;

-- Step 5: Create index for RLS policy lookups
CREATE INDEX IF NOT EXISTS idx_transactions_cashier_id ON transactions(cashier_id);

-- Note: NOT NULL constraint will be added in a follow-up migration
-- after the application code is confirmed to always provide cashier_id.
-- ALTER TABLE transactions ALTER COLUMN cashier_id SET NOT NULL;