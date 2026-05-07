# Data Model: Fix Critical and High-Priority Engineering Issues

**Branch**: `004-fix-engineering-issues` | **Date**: 2026-04-18

## Overview

This data model covers the database schema changes and new application entities required to implement the engineering fixes. The primary schema changes are: adding a `cashier_id` column to the `transactions` table, and creating new RLS policies. The application-layer entities (ErrorBoundary, Toast, ConfirmationModal, DemoMode) are new UI/logic constructs, not database entities.

## Database Schema Changes

### 1. `transactions` table — Add `cashier_id` column

```sql
-- Migration: 20260418_add_cashier_id_column.sql

-- Step 1: Add nullable column
ALTER TABLE transactions ADD COLUMN cashier_id UUID REFERENCES profiles(id);

-- Step 2: Backfill from existing cashier_name
UPDATE transactions t
SET cashier_id = p.id
FROM profiles p
WHERE t.cashier_name = COALESCE(p.full_name, p.username)
  AND t.cashier_id IS NULL;

-- Step 3: Flag unmatched records for manual review
INSERT INTO migration_flags (table_name, record_id, issue, created_at)
SELECT 'transactions', t.id, 'Could not match cashier_name: ' || t.cashier_name, NOW()
FROM transactions t
WHERE t.cashier_id IS NULL AND t.cashier_name IS NOT NULL;

-- Step 4: Set NOT NULL constraint (after application code updated to always provide cashier_id)
-- This step is performed in a follow-up migration once the application is confirmed working
-- ALTER TABLE transactions ALTER COLUMN cashier_id SET NOT NULL;

-- Step 5: Create index for RLS policy lookups
CREATE INDEX idx_transactions_cashier_id ON transactions(cashier_id);
```

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| cashier_id | UUID | YES (temporary) | NULL | References `profiles.id`. Will become NOT NULL after application migration is confirmed. |

**Validation rules**:
- `cashier_id` must reference a valid `profiles.id` or be NULL (during migration period)
- New inserts must always provide `cashier_id = auth.uid()` for authenticated non-demo users

**State transitions**:
- Phase 1 (this migration): Column added as nullable, backfill attempted, unmatched flagged
- Phase 2 (follow-up): After application code confirmed working, `NOT NULL` constraint added

### 2. `migration_flags` table — New table for tracking migration issues

```sql
CREATE TABLE migration_flags (
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
    FOR SELECT USING (current_user_is_admin());

CREATE POLICY "Admins can resolve migration flags" ON migration_flags
    FOR UPDATE USING (current_user_is_admin());
```

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| table_name | TEXT | NO | — | Name of the affected table |
| record_id | UUID | NO | — | ID of the affected record |
| issue | TEXT | NO | — | Description of the migration issue |
| resolved | BOOLEAN | NO | FALSE | Whether the issue has been addressed |
| resolved_by | UUID | YES | NULL | Admin who resolved the issue |
| resolved_at | TIMESTAMPTZ | YES | NULL | When the issue was resolved |
| created_at | TIMESTAMPTZ | NO | NOW() | When the issue was flagged |

### 3. RLS Policy Changes

See `contracts/rls-policies.md` for full details. Summary of changes:

| Table | Current Policy | New Policy |
|-------|---------------|------------|
| green_beans | `authenticated` → full CRUD | Role-based: CASHIER=read, ROASTER=read/write, MANAGER=read/write, ADMIN=full |
| green_bean_movements | `authenticated` → full CRUD | Role-based: same as green_beans |
| locations | `authenticated` → full CRUD, `public` → read | Role-based: CASHIER=read, WAREHOUSE_STAFF=read/write, ADMIN=full |
| cash_movements | `public` → read | Role-based: CASHIER=read own, MANAGER=read all, ADMIN=full |
| accounting_entries | `authenticated` → insert | Role-based: MANAGER=create, ADMIN=full |
| customers | `authenticated` → full CRUD | Role-based: CASHIER=read/create/update own branch, MANAGER=read/write, ADMIN=full |
| order_reservations | `authenticated` → full CRUD | Role-based: CASHIER=read own, MANAGER=read/write, ADMIN=full |
| transactions | (cashier_name match) | `cashier_id = auth.uid()` for CASHIER read; role-based for others |
| employees | ADMIN/MANAGER select/insert/update, no DELETE | Add DELETE for ADMIN only; MANAGER cannot see salary/bank columns |

## Application Entities

### 4. ErrorBoundary Component

| Field | Type | Description |
|-------|------|-------------|
| children | ReactNode | The wrapped view component |
| fallback | ReactNode (optional) | Custom fallback UI override |
| onError | (error: Error, errorInfo: React.ErrorInfo) => void (optional) | Callback for logging |
| resetErrorBoundary | () => void | Function to retry rendering the failed component |

**State transitions**: `idle` → `error` (on catch) → `idle` (on retry) or `persistent-error` (on retry failure)

**Behavior**:
- Catches all errors in child component tree
- Renders fallback UI with "Try Again" button and "Reload Page" link
- "Try Again" calls `resetErrorBoundary()` which re-renders children
- "Reload Page" calls `window.location.reload()`
- Preserves navigation state and unsaved data in other views

### 5. Toast Notification Component

| Field | Type | Description |
|-------|------|-------------|
| message | string | The notification text |
| type | 'success' \| 'error' \| 'warning' \| 'info' | Visual variant |
| duration | number (ms) | Auto-dismiss time (default: 4000 for success/info, 6000 for error/warning) |
| action | { label: string; onClick: () => void } (optional) | Optional action button |

**State transitions**: `hidden` → `entering` → `visible` → `exiting` → `hidden`

**Behavior**:
- Auto-dismisses after duration
- Multiple toasts stack vertically
- Accessible: `role="alert"` and `aria-live="polite"`

### 6. ConfirmationModal Component

| Field | Type | Description |
|-------|------|-------------|
| open | boolean | Whether the modal is visible |
| title | string | Modal heading |
| message | string | Body text describing the action |
| confirmLabel | string | Confirm button text (default: "Confirm") |
| cancelLabel | string | Cancel button text (default: "Cancel") |
| variant | 'danger' \| 'warning' \| 'default' | Visual style |
| onConfirm | () => void | Callback when confirmed |
| onCancel | () => void | Callback when cancelled |

**State transitions**: `closed` → `open` (on trigger) → `closed` (on confirm/cancel)

**Behavior**:
- Blocks interaction with underlying UI
- Focus trapped within modal (accessibility)
- Escape key cancels
- Used for destructive actions: delete, void transaction, refund approval

### 7. DemoMode Module

| Field | Type | Description |
|-------|------|-------------|
| isDemoMode | () => boolean | Returns true if `VITE_DEMO_MODE` env var is 'true' |
| getDemoUserId | () => string \| null | Returns demo user ID if in demo mode, null otherwise |
| DEMO_USER_UUID | string | Constant '00000000-0000-0000-0000-000000000000' |

**Validation rules**:
- `isDemoMode()` always returns `false` in production builds (Vite tree-shaking eliminates the `true` branch)
- All demo-user checks throughout the codebase must route through this module
- In production: `getDemoUserId()` returns `null`
- In development: `getDemoUserId()` returns the `DEMO_USER_UUID`

**State transitions**: None (pure function, stateless module)

### 8. Atomic Checkout RPC

| Parameter | Type | Description |
|-----------|------|-------------|
| p_items | JSONB | Array of { product_id, quantity, unit_price } |
| p_payment_method | TEXT | Payment method enum value |
| p_total | NUMERIC | Total amount |
| p_cashier_id | UUID | Authenticated cashier user ID |
| p_shift_id | UUID | Current shift ID |
| p_location_id | UUID | Branch location ID |

**Returns**: JSONB with `{ success: boolean, transaction_id: UUID, error: TEXT | null }`

**Behavior**:
- Validates sufficient stock for all items (with row-level lock `SELECT ... FOR UPDATE`)
- If any item has insufficient stock, returns `{ success: false, error: "Item X no longer in stock" }`
- Creates transaction record
- Deducts inventory for all items
- Updates shift totals
- All within a single PostgreSQL transaction

### 9. EscapeHtml Utility

| Parameter | Type | Returns | Description |
|-----------|------|---------|-------------|
| input | string | string | Escapes &, <, >, ", ', / for safe HTML rendering |

**Behavior**: Pure function, no side effects. Used in print voucher rendering and any HTML string interpolation.