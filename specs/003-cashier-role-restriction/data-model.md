# Data Model: Cashier POS-Only Access

**Feature Branch**: `003-cashier-role-restriction`
**Date**: 2026-03-30

---

## Overview

This feature does not introduce new database tables. Changes are limited to:
1. Permission definitions (frontend)
2. Navigation access control (frontend)
3. Optional RLS function for cashier role

---

## Permission Model Changes

### Current State

**UserRole Enum** (`types.ts`):
```typescript
export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  HR = 'HR',
  ROASTER = 'ROASTER',
  CASHIER = 'CASHIER',
  WAREHOUSE_STAFF = 'WAREHOUSE_STAFF'
}
```

**Current CASHIER Permissions** (`AuthContext.tsx`):
```typescript
CASHIER: ['can_sell', 'can_view_reports']
```

### Proposed State

**Updated CASHIER Permissions**:
```typescript
CASHIER: ['can_sell', 'can_view_own_stats', 'can_manage_shift']
```

| Permission | Meaning |
|------------|---------|
| `can_sell` | Process sales transactions in POS |
| `can_view_own_stats` | View personal sales statistics only |
| `can_manage_shift` | Open/close cash drawer, manage own shifts |

---

## Navigation Access Control

### Menu Items Structure

**Type Definition**:
```typescript
interface MenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  roles: UserRole[];
}
```

### Current vs Proposed Access

| Menu ID | Current Roles | Proposed Roles | Change |
|---------|--------------|----------------|--------|
| dashboard | ADMIN, MANAGER, HR, ROASTER, **CASHIER**, WAREHOUSE_STAFF | ADMIN, MANAGER, HR, ROASTER, WAREHOUSE_STAFF | ❌ Remove CASHIER |
| staff | ADMIN, MANAGER, HR | (unchanged) | — |
| roasting | ADMIN, MANAGER, ROASTER | (unchanged) | — |
| inventory | ADMIN, MANAGER, ROASTER, **CASHIER**, WAREHOUSE_STAFF | ADMIN, MANAGER, ROASTER, WAREHOUSE_STAFF | ❌ Remove CASHIER |
| pos | ADMIN, MANAGER, **CASHIER** | ADMIN, MANAGER, CASHIER | ✅ Keep |
| reports | ADMIN, MANAGER, HR | (unchanged) | — |
| branchPerformance | ADMIN, MANAGER | (unchanged) | — |
| branchFinancials | ADMIN, MANAGER | (unchanged) | — |
| crm | ADMIN, MANAGER, **CASHIER** | ADMIN, MANAGER | ❌ Remove CASHIER |
| ai | ADMIN, MANAGER | (unchanged) | — |
| configuration | ADMIN, MANAGER, ROASTER, **CASHIER**, WAREHOUSE_STAFF | ADMIN, MANAGER, ROASTER, WAREHOUSE_STAFF | ❌ Remove CASHIER |

---

## Database RLS Additions

### New Function

```sql
-- Add to enable_inventory_features.sql or create new migration
CREATE OR REPLACE FUNCTION current_user_is_cashier()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role = 'CASHIER'
      AND is_active = true
  );
END;
$$ LANGUAGE plpgsql STABLE;
```

### RLS Policy Pattern for Cashier

```sql
-- Example: Cashiers can only see their own time logs
CREATE POLICY "Cashiers can view own time logs"
ON employee_time_logs FOR SELECT
USING (
  current_user_is_cashier()
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.employee_id = employee_time_logs.employee_id
  )
);

-- Example: Cashiers cannot access inventory movements
CREATE POLICY "Cashiers cannot access inventory"
ON inventory_movements FOR ALL
USING (
  NOT current_user_is_cashier()
);
```

---

## State Transitions

### User Login Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Login     │────►│ Auth Check  │────►│ Role Lookup │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                    ┌──────────────────────────┘
                    ▼
            ┌─────────────┐     ┌─────────────┐
            │ is CASHIER? │────►│ setActiveTab │
            └─────────────┘     │   ('pos')    │
                    │           └─────────────┘
                    │ No
                    ▼
            ┌─────────────┐
            │ Role-based  │
            │ default tab │
            └─────────────┘
```

### Unauthorized Access Attempt

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ User clicks │     │ Role check  │────►│ isAllowed?  │
│ restricted  │────►│ in handler  │     └─────────────┘
│ menu item   │     └─────────────┘            │
└─────────────┘                          ┌─────┴─────┐
                                         │           │
                                    Yes  │           │ No
                                         ▼           ▼
                                   ┌─────────┐ ┌─────────────┐
                                   │ Proceed │ │ Redirect to │
                                   │ normally│ │    POS      │
                                   └─────────┘ └─────────────┘
                                                      │
                                                      ▼
                                               ┌─────────────┐
                                               │ Show Toast │
                                               │ "Access    │
                                               │ restricted"│
                                               └─────────────┘
```

---

## Relationships

### User to Employee

```
┌──────────────┐     ┌──────────────┐
│  auth.users  │     │   profiles   │
│  (Supabase)  │────►│              │
│              │     │ - id         │
│              │     │ - role       │
│              │     │ - employee_id│
└──────────────┘     └──────────────┘
                             │
                             ▼
                      ┌──────────────┐
                      │  employees   │
                      │              │
                      │ - id         │
                      │ - first_name │
                      │ - phone      │
                      │ - role       │
                      │ - location_id│
                      └──────────────┘
```

### Cashier to Location

Cashiers are assigned to exactly one location (branch):

```sql
-- employees.location_id references locations.id
-- Cashiers can only access data for their assigned location
```

---

## Validation Rules

### Role Assignment

1. CASHIER role can only be assigned by ADMIN or MANAGER
2. A user can have exactly one role
3. Role changes require re-authentication (lazy refresh)
4. CASHIER must have `location_id` assigned

### Access Control

1. CASHIER cannot access: dashboard, inventory, reports (full), crm, staff, roasting, configuration (full)
2. CASHIER can access: pos, limited reports (own stats)
3. All other roles remain unchanged