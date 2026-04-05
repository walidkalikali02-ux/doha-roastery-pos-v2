
# Implementation Plan: Cashier POS-Only Access (Revised)

**Branch**: `003-cashier-role-restriction` | **Date**: 2026-03-30 | **Spec**: [spec.md](./spec.md)
**Revision**: v2 — Addresses senior review findings (redirect loop, RLS gaps, hook design, config filtering)

---

## Summary

Implement restricted access for CASHIER role users to ensure they can only access POS functionality, limited reports (personal stats), and shift management. The system enforces role-based restrictions at three layers: UI navigation filtering, application-level guards with toast feedback, and database-level RLS policies. Unauthorized access attempts trigger redirect to POS view + toast notification.

**Technical Approach**: Modify existing role-based navigation in App.tsx with role-aware redirect targets, enhance permission system in AuthContext.tsx, add a properly integrated role guard hook, implement database-level RLS policies on all restricted tables, and filter ConfigurationView/ReportsView sub-sections for cashier access.

---

## Technical Context

| Attribute | Value |
|-----------|-------|
| Language/Version | TypeScript 5.8 + React 19 |
| Database | PostgreSQL 15+ (Supabase) |
| Auth | Supabase Auth + custom `profiles` table with `role` column |
| Testing | Vitest + React Testing Library |
| Target Platform | Web SPA (tab-based navigation, no URL routing) |

**Primary Dependencies**:
- Supabase JS Client 2.45
- React Hook Form 7.54
- Zod 3.24
- Lucide React (icons)

**Performance Goals**:
- Permission changes take effect within 1s (SC-007)
- Role lookups < 100ms
- Zero successful accesses to restricted areas (SC-002)

**Constraints**:
- Tab-based navigation (no URL routes — guards operate on `activeTab` state)
- Database-level RLS must mirror UI restrictions (defense in depth)
- Cannot break ADMIN, MANAGER, or other existing role functionality
- Toast notification required on every unauthorized access attempt

---

## Constitution Check

| Principle | Status | Evidence |
|-----------|--------|----------|
| Security by Design | ✅ PASS | Three layers: UI filtering + app guard + RLS policies on 5 tables |
| Testability | ✅ PASS | Each restriction has discrete acceptance criterion |
| Simplicity | ✅ PASS | Extends existing RBAC arrays and guard pattern |
| Observability | ✅ PASS | Toast on denial + existing audit logging |

### Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Redirect loop (cashier → dashboard → restricted) | 🔴 Critical | Role-aware fallback: cashier → `pos`, others → `dashboard` |
| Permission bypass via direct state manipulation | 🟡 Medium | `useEffect` guard in App.tsx fires on every `activeTab` change |
| Inconsistent UI vs database permissions | 🔴 Critical | RLS policies defined per-table, tested in integration suite |
| Session not refreshing on role change | 🟡 Medium | Lazy permission refresh on next action attempt |
| Toast rendered behind modal | 🟢 Low | Standardized z-index scale, toast at `z-[70]` |

---

## Project Structure

### Documentation

```text
specs/003-cashier-role-restriction/
├── plan.md              # This file (v2)
├── research.md          # Phase 0: Technical decisions
├── data-model.md        # Phase 1: Permission + RLS changes
├── quickstart.md        # Phase 1: Setup & verification guide
├── spec.md              # Feature specification (input)
└── tasks.md             # Phase 2: Implementation tasks (via /speckit.tasks)
```

### Source Code Changes

```text
App.tsx                                    # MODIFY: Role arrays + role-aware redirect
├── contexts/
│   └── AuthContext.tsx                    # MODIFY: Cashier permission set
├── components/
│   └── common/
│       └── AccessDeniedToast.tsx          # NEW: Auto-dismissing toast
├── views/
│   ├── POSView.tsx                        # REVIEW: No unauthorized navigations
│   ├── ReportsView.tsx                    # MODIFY: Cashier section filtering
│   └── ConfigurationView.tsx              # MODIFY: Cashier section filtering
├── hooks/
│   └── useRoleGuard.ts                    # NEW: Guard hook with toast trigger
├── constants/
│   └── zIndex.ts                          # NEW: Z-index scale definition
├── types.ts                               # REVIEW: UserRole enum (no changes expected)
└── translations.ts                        # MODIFY: Add access denied message keys

supabase/migrations/
└── 20260330_cashier_rls_policies.sql      # NEW: All cashier RLS policies

tests/
├── unit/
│   ├── useRoleGuard.test.ts               # NEW: Hook logic tests
│   ├── permissions.test.ts                # MODIFY: Cashier permission coverage
│   └── menuFiltering.test.ts              # NEW: Menu role array tests
└── integration/
    ├── cashier-access.test.ts             # NEW: Navigation restriction tests
    └── cashier-rls.test.ts                # NEW: Database policy tests
```

---

## Phase 0: Research Summary

### Current System Analysis

**Navigation Items (App.tsx lines 61-73) — Access Matrix**:

| Menu ID | Icon | ADMIN | MANAGER | CASHIER (current) | CASHIER (proposed) | Change |
|---------|------|-------|---------|-------------------|-------------------|--------|
| `dashboard` | LayoutDashboard | ✅ | ✅ | ✅ | ❌ | REMOVE |
| `inventory` | Package | ✅ | ✅ | ✅ | ❌ | REMOVE |
| `pos` | ShoppingCart | ✅ | ✅ | ✅ | ✅ | KEEP |
| `crm` | Users | ✅ | ✅ | ✅ | ❌ | REMOVE |
| `suppliers` | Truck | ✅ | ✅ | ❌ | ❌ | NO CHANGE |
| `purchases` | ClipboardList | ✅ | ✅ | ❌ | ❌ | NO CHANGE |
| `accounting` | Calculator | ✅ | ❌ | ❌ | ❌ | NO CHANGE |
| `reports` | BarChart3 | ✅ | ✅ | ❌ | ⚠️ PARTIAL | ADD (filtered) |
| `configuration` | Settings | ✅ | ✅ | ✅ | ⚠️ PARTIAL | FILTER |
| `users` | UserCog | ✅ | ❌ | ❌ | ❌ | NO CHANGE |
| `audit` | Shield | ✅ | ❌ | ❌ | ❌ | NO CHANGE |

**Current Permissions (AuthContext.tsx lines 53-54)**:
```typescript
// BEFORE
CASHIER: ['can_sell', 'can_view_reports']
```

**Current Guard (App.tsx lines 79-87)**:
```typescript
// Existing behavior:
useEffect(() => {
  if (activeTab is not in user's allowed menus) {
    setActiveTab('dashboard'); // ← BUG: 'dashboard' will be restricted for cashier
  }
}, [activeTab]);
```

### ConfigurationView Sub-Sections (Research Finding)

Examined `ConfigurationView.tsx` to identify all sections:

| Section/Tab | Description | Cashier Access | Rationale |
|-------------|-------------|----------------|-----------|
| General Settings | Store name, address, currency | ❌ DENY | Store-level config |
| Tax Settings | Tax rates, rules | ❌ DENY | Financial config |
| Payment Methods | Accepted payment types | ❌ DENY | Financial config |
| Receipt Template | Receipt format, logo | ❌ DENY | Store-level config |
| Shift Settings | Cash drawer open/close, float amount | ✅ ALLOW | Core cashier function |
| Notification Settings | Alert preferences | ❌ DENY | Store-level config |

**Implementation**: ConfigurationView already renders sections via internal tab/accordion. Add role check to conditionally render only `shift-settings` section for CASHIER. If no sections are accessible, redirect to POS.

### ReportsView Sub-Sections (Research Finding)

| Report Type | Description | Cashier Access | Rationale |
|-------------|-------------|----------------|-----------|
| Sales Summary | Store-wide sales, revenue | ❌ DENY | Financial data |
| Inventory Report | Stock levels, valuation | ❌ DENY | Inventory data |
| Customer Report | Customer analytics | ❌ DENY | CRM data |
| Employee Performance | All staff stats | ❌ DENY | Management data |
| Personal Stats | Own sales count, own total, own shift history | ✅ ALLOW | Spec requirement |
| Financial Report | P&L, margins | ❌ DENY | Financial data |

**Implementation**: ReportsView receives `user` from context. When `user.role === CASHIER`, render only `PersonalStatsPanel` component. Filter at component level, not at data fetch level (data filtering handled by RLS).

### Existing Z-Index Usage (Audit)

| Component | Current z-index | Purpose |
|-----------|----------------|---------|
| Sidebar/Nav | `z-[30]` | Navigation overlay on mobile |
| Dropdown menus | `z-[40]` | Select menus, autocomplete |
| Modal overlay | `z-[50]` | Background dim |
| Modal content | `z-[51]` | Dialog boxes, payment modal |
| Toast (new) | `z-[70]` | Access denied notifications |

**Decision**: Toast at `z-[70]` — above modals so denial is always visible, below nothing (highest current is `z-[51]`).

---

## Phase 1: Design

### 1. Permission Model Changes

**AuthContext.tsx — `getPermissionsForRole`**:
```typescript
// AFTER
CASHIER: ['can_sell', 'can_view_own_stats', 'can_manage_shift']
```

**Impact scan for `can_view_reports` removal**:

| File | Usage | Action |
|------|-------|--------|
| `AuthContext.tsx` | Definition | Replace with `can_view_own_stats` |
| `ReportsView.tsx` | Permission check | Update to `can_view_own_stats` |
| No other files reference this permission | — | Confirmed via grep |

### 2. Role-Aware Redirect (Critical Fix)

**App.tsx guard — Updated logic**:

```typescript
// AFTER — Role-aware fallback tab
const getDefaultTab = (role: UserRole): string => {
  switch (role) {
    case UserRole.CASHIER:
      return 'pos';
    case UserRole.ADMIN:
    case UserRole.MANAGER:
    default:
      return 'dashboard';
  }
};

useEffect(() => {
  if (!user) return;
  
  const allowedMenus = allMenuItems
    .filter(item => item.roles.includes(user.role))
    .map(item => item.id);
  
  if (!allowedMenus.includes(activeTab)) {
    const fallback = getDefaultTab(user.role);
    setActiveTab(fallback);
    triggerAccessDeniedToast(); // NEW: toast trigger
  }
}, [activeTab, user?.role]);
```

**Why this matters**: Without role-aware redirect, cashier hits restricted tab → redirected to `dashboard` → `dashboard` is restricted → redirected to `dashboard` → infinite loop. `getDefaultTab` breaks the cycle by sending cashiers to `pos`.

**Initial login redirect (App.tsx line 157-158)** — already correct:
```typescript
// Existing: cashier lands on POS on login
if (user.role === UserRole.CASHIER) setActiveTab('pos');
```

### 3. `useRoleGuard` Hook (Corrected Design)

```typescript
// hooks/useRoleGuard.ts
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';

interface UseRoleGuardReturn {
  isAllowed: boolean;
  toastMessage: string | null;
  denyAccess: (message: string) => void;
  dismissToast: () => void;
}

const TOAST_DURATION_MS = 4000;

export function useRoleGuard(allowedRoles: UserRole[]): UseRoleGuardReturn {
  const { user } = useAuth();
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isAllowed = useMemo(
    () => (user ? allowedRoles.includes(user.role) : false),
    [user?.role, allowedRoles]
  );

  const denyAccess = useCallback((message: string) => {
    setToastMessage(message);
  }, []);

  const dismissToast = useCallback(() => {
    setToastMessage(null);
  }, []);

  // Auto-dismiss after duration
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  return { isAllowed, toastMessage, denyAccess, dismissToast };
}
```

**Integration point in App.tsx**:
```typescript
const { isAllowed, toastMessage, denyAccess, dismissToast } = useRoleGuard(
  allMenuItems.find(m => m.id === activeTab)?.roles ?? []
);

useEffect(() => {
  if (!user) return;
  if (!isAllowed) {
    setActiveTab(getDefaultTab(user.role));
    denyAccess(t.accessRestricted);
  }
}, [activeTab, isAllowed]);
```

### 4. `AccessDeniedToast` Component

```typescript
// components/common/AccessDeniedToast.tsx
import { AlertTriangle, X } from 'lucide-react';

interface AccessDeniedToastProps {
  message: string;
  onDismiss: () => void;
}

export function AccessDeniedToast({ message, onDismiss }: AccessDeniedToastProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed bottom-4 right-4 z-[70] bg-orange-50 border-2 border-orange-600
                 px-4 py-3 rounded-xl shadow-lg flex items-center gap-3
                 animate-in slide-in-from-bottom-4 duration-300"
    >
      <AlertTriangle className="text-orange-600 shrink-0" size={20} />
      <span className="text-orange-900 text-sm font-medium">{message}</span>
      <button
        onClick={onDismiss}
        className="text-orange-400 hover:text-orange-600 shrink-0"
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  );
}
```

**Rendered in App.tsx**:
```typescript
{toastMessage && (
  <AccessDeniedToast message={toastMessage} onDismiss={dismissToast} />
)}
```

### 5. Z-Index Scale

```typescript
// constants/zIndex.ts
export const Z_INDEX = {
  NAV: 30,
  DROPDOWN: 40,
  MODAL_OVERLAY: 50,
  MODAL_CONTENT: 51,
  TOAST: 70,
} as const;
```

Consumed via Tailwind arbitrary values: `z-[${Z_INDEX.TOAST}]` or directly in style prop. Existing components remain unchanged — this file documents the convention and is used by new components.

### 6. ConfigurationView Filtering

```typescript
// views/ConfigurationView.tsx — Cashier filtering approach

const { user } = useAuth();

const configSections = [
  { id: 'general',       label: t.generalSettings,    roles: [UserRole.ADMIN, UserRole.MANAGER] },
  { id: 'tax',           label: t.taxSettings,         roles: [UserRole.ADMIN, UserRole.MANAGER] },
  { id: 'payment',       label: t.paymentMethods,      roles: [UserRole.ADMIN, UserRole.MANAGER] },
  { id: 'receipt',       label: t.receiptTemplate,     roles: [UserRole.ADMIN, UserRole.MANAGER] },
  { id: 'shift',         label: t.shiftSettings,       roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER] },
  { id: 'notifications', label: t.notificationSettings, roles: [UserRole.ADMIN, UserRole.MANAGER] },
];

const visibleSections = configSections.filter(s => s.roles.includes(user.role));

// If only 'shift' visible, skip section tabs and render ShiftSettings directly
// If zero sections visible (shouldn't happen), redirect to POS
```

### 7. ReportsView Filtering

```typescript
// views/ReportsView.tsx — Cashier filtering approach

const { user } = useAuth();

if (user.role === UserRole.CASHIER) {
  return <PersonalStatsPanel userId={user.id} />;
}

// Otherwise render full reports view as-is
```

`PersonalStatsPanel` is a new lightweight component that shows:
- Total sales today (count + amount)
- Total sales this week
- Shift history (open/close times, drawer amounts)
- All data scoped to `user.id` (enforced by RLS)

### 8. Database — RLS Policies

**Migration file**: `supabase/migrations/20260330_cashier_rls_policies.sql`

```sql
-- ============================================
-- CASHIER ROLE RLS POLICIES
-- Migration: 20260330_cashier_rls_policies
-- ============================================

-- Helper function
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() AND is_active = true;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ----------------------------------------
-- 1. SALES / TRANSACTIONS
-- Cashier: read/insert/update own transactions only
-- ----------------------------------------

-- Read own sales
CREATE POLICY "cashier_select_own_sales"
  ON public.sales
  FOR SELECT
  USING (
    CASE
      WHEN current_user_role() = 'CASHIER' THEN cashier_id = auth.uid()
      ELSE true  -- ADMIN/MANAGER see all
    END
  );

-- Insert sales (cashier can create)
CREATE POLICY "cashier_insert_sales"
  ON public.sales
  FOR INSERT
  WITH CHECK (
    cashier_id = auth.uid()
  );

-- Update own sales (void items in active transaction)
CREATE POLICY "cashier_update_own_sales"
  ON public.sales
  FOR UPDATE
  USING (
    CASE
      WHEN current_user_role() = 'CASHIER' THEN cashier_id = auth.uid()
      ELSE true
    END
  );

-- ----------------------------------------
-- 2. SALE ITEMS
-- Cashier: read/insert/update items on own sales
-- ----------------------------------------

CREATE POLICY "cashier_select_own_sale_items"
  ON public.sale_items
  FOR SELECT
  USING (
    CASE
      WHEN current_user_role() = 'CASHIER'
        THEN sale_id IN (SELECT id FROM public.sales WHERE cashier_id = auth.uid())
      ELSE true
    END
  );

CREATE POLICY "cashier_insert_sale_items"
  ON public.sale_items
  FOR INSERT
  WITH CHECK (
    sale_id IN (SELECT id FROM public.sales WHERE cashier_id = auth.uid())
  );

CREATE POLICY "cashier_update_sale_items"
  ON public.sale_items
  FOR UPDATE
  USING (
    CASE
      WHEN current_user_role() = 'CASHIER'
        THEN sale_id IN (SELECT id FROM public.sales WHERE cashier_id = auth.uid())
      ELSE true
    END
  );

-- ----------------------------------------
-- 3. INVENTORY / PRODUCTS
-- Cashier: read-only (needed for POS product lookup)
-- No insert, update, or delete
-- ----------------------------------------

CREATE POLICY "cashier_read_products"
  ON public.products
  FOR SELECT
  USING (true);  -- All roles can read products

-- Explicit deny for mutations (if no other INSERT/UPDATE/DELETE policies match, denied by default)
-- No INSERT/UPDATE/DELETE policy created for CASHIER = implicit deny

-- ----------------------------------------
-- 4. CUSTOMERS
-- Cashier: read-only (needed for POS customer selection)
-- No insert, update, or delete
-- ----------------------------------------

CREATE POLICY "cashier_read_customers"
  ON public.customers
  FOR SELECT
  USING (true);  -- All roles can read for POS lookup

-- No INSERT/UPDATE/DELETE policy for CASHIER on customers

-- ----------------------------------------
-- 5. SHIFTS
-- Cashier: full CRUD on own shifts
-- ----------------------------------------

CREATE POLICY "cashier_select_own_shifts"
  ON public.shifts
  FOR SELECT
  USING (
    CASE
      WHEN current_user_role() = 'CASHIER' THEN user_id = auth.uid()
      ELSE true
    END
  );

CREATE POLICY "cashier_insert_own_shifts"
  ON public.shifts
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "cashier_update_own_shifts"
  ON public.shifts
  FOR UPDATE
  USING (
    CASE
      WHEN current_user_role() = 'CASHIER' THEN user_id = auth.uid()
      ELSE true
    END
  );

-- ----------------------------------------
-- 6. RESTRICTED TABLES — No cashier access
-- These tables have no SELECT policy for CASHIER
-- ----------------------------------------

-- suppliers: existing policies already exclude CASHIER (verify)
-- purchases: existing policies already exclude CASHIER (verify)
-- accounting_entries: existing policies already exclude CASHIER (verify)
-- audit_logs: existing policies already exclude CASHIER (verify)

-- ----------------------------------------
-- 7. PROFILES
-- Cashier: read own profile only
-- ----------------------------------------

CREATE POLICY "cashier_read_own_profile"
  ON public.profiles
  FOR SELECT
  USING (
    CASE
      WHEN current_user_role() = 'CASHIER' THEN id = auth.uid()
      ELSE true
    END
  );
```

**Important pre-migration check**: Verify existing RLS policies on each table. If tables already have permissive `SELECT` policies (e.g., `USING (true)`), those must be tightened or replaced. The new policies above assume RLS is enabled but no conflicting broad policies exist. The migration must include `DROP POLICY IF EXISTS` for any conflicting policies found during implementation.

**Rollback**:
```sql
-- Rollback: 20260330_cashier_rls_policies
DROP POLICY IF EXISTS "cashier_select_own_sales" ON public.sales;
DROP POLICY IF EXISTS "cashier_insert_sales" ON public.sales;
DROP POLICY IF EXISTS "cashier_update_own_sales" ON public.sales;
DROP POLICY IF EXISTS "cashier_select_own_sale_items" ON public.sale_items;
DROP POLICY IF EXISTS "cashier_insert_sale_items" ON public.sale_items;
DROP POLICY IF EXISTS "cashier_update_sale_items" ON public.sale_items;
DROP POLICY IF EXISTS "cashier_read_products" ON public.products;
DROP POLICY IF EXISTS "cashier_read_customers" ON public.customers;
DROP POLICY IF EXISTS "cashier_select_own_shifts" ON public.shifts;
DROP POLICY IF EXISTS "cashier_insert_own_shifts" ON public.shifts;
DROP POLICY IF EXISTS "cashier_update_own_shifts" ON public.shifts;
DROP POLICY IF EXISTS "cashier_read_own_profile" ON public.profiles;
DROP FUNCTION IF EXISTS public.current_user_role();
```

### 9. Translation Keys

```typescript
// translations.ts — New keys added

// English
accessRestricted: 'Access restricted: This feature is not available for your role',
accessDeniedTitle: 'Access Denied',
shiftSettings: 'Shift Settings',
personalStats: 'My Stats',
totalSalesToday: 'Total Sales Today',
totalSalesThisWeek: 'Total Sales This Week',
shiftHistory: 'Shift History',

// Arabic (example)
accessRestricted: 'وصول مقيد: هذه الميزة غير متوفرة لدورك',
accessDeniedTitle: 'الوصول مرفوض',
shiftSettings: 'إعدادات الوردية',
personalStats: 'إحصائياتي',
```

### 10. `alert()` → Modal Migration (Tech Debt Flag)

**Current** (POSView.tsx line 937-940):
```typescript
if (user?.role !== 'ADMIN' && user?.role !== 'MANAGER') {
  alert(t.notAuthorizedApproveReturns); // ← native alert, blocking
  return;
}
```

**Decision**: Out of scope for this feature. Flagged as tech debt item `TD-014`. The native `alert()` works correctly for authorization denial — it's a UX concern, not a security concern. Will be migrated to modal in a future pass.

---

## UI/UX Flow (Complete)

```
Cashier Login
     │
     ▼
getDefaultTab(CASHIER) → 'pos'
     │
     ▼
┌─────────────────────────────────────────┐
│  Navigation Sidebar                      │
│  ┌─────────────────────┐                │
│  │ 🛒 POS           ✅ │                │
│  │ 📊 Reports        ✅ │ (filtered)    │
│  │ ⚙️ Configuration  ✅ │ (filtered)    │
│  │                      │                │
│  │ (all other items     │                │
│  │  not rendered)       │                │
│  └─────────────────────┘                │
└─────────────────────────────────────────┘
     │
     ├── Click "POS" → Render POSView (full access)
     │   ├── Process Sales ✅
     │   ├── Void Items ✅ (in active transaction)
     │   └── Initiate Return → Manager Approval prompt
     │
     ├── Click "Reports" → Render PersonalStatsPanel only
     │   ├── My sales today ✅
     │   ├── My sales this week ✅
     │   └── My shift history ✅
     │
     ├── Click "Configuration" → Render ShiftSettings only
     │   ├── Open cash drawer ✅
     │   ├── Close cash drawer ✅
     │   └── Set float amount ✅
     │
     └── Direct state manipulation (activeTab = 'inventory')
         │
         ▼
    useEffect guard fires
         │
         ├── setActiveTab('pos')
         └── denyAccess(t.accessRestricted)
              │
              ▼
         ┌──────────────────────────────────────┐
         │ ⚠️ Access restricted: This feature   │
         │    is not available for your role  ✕  │
         └──────────────────────────────────────┘
              │
              └── Auto-dismiss after 4 seconds
```

---

## Complexity Tracking

| Complexity | Justification | Simpler Alternative Rejected |
|------------|---------------|------------------------------|
| Role-aware redirect target | Prevents redirect loop (critical bug) | Static target: Causes infinite loop for cashier |
| Toast with auto-dismiss | Required by spec + good UX | Silent redirect: User confused about what happened |
| ConfigurationView section filtering | Required by spec (shift access) | Full block: Cashier loses shift management |
| ReportsView personal stats panel | Required by spec (own stats) | Full block: Cashier loses useful self-service data |
| 12 RLS policies across 6 tables | Defense in depth, required by security principle | UI-only: One DevTools manipulation = data breach |
| `current_user_role()` helper function | Reused across all policies, single point of maintenance | Inline subquery: Duplicated in every policy, error-prone |

---

## Implementation Order

```
Phase 2 Task Dependency Graph:

  T1: Z-index constants
   │
   ├─► T2: AccessDeniedToast component
   │    │
   │    └─► T4: useRoleGuard hook
   │         │
   │         └─► T6: App.tsx guard + redirect logic
   │
   T3: Translation keys
   │    │
   │    └─► T6 (needs translations)
   │
   T5: AuthContext permission update
   │    │
   │    └─► T6 (needs updated permissions)
   │
   T7: ConfigurationView section filtering ─── depends on T5, T6
   │
   T8: ReportsView / PersonalStatsPanel ───── depends on T5, T6
   │
   T9: RLS migration ─────────────────────── independent (database)
   │
   T10: Unit tests ────────────────────────── depends on T2, T4, T5
   │
   T11: Integration tests ─────────────────── depends on T6, T7, T8, T9
   │
   T12: RLS integration tests ─────────────── depends on T9
```

**Critical path**: T1 → T2 → T4 → T6 → T7/T8 → T11

---

## Testing Strategy

### Unit Tests

| Test File | What It Covers | Key Assertions |
|-----------|---------------|----------------|
| `useRoleGuard.test.ts` | Hook logic | `isAllowed` correct per role; `denyAccess` sets message; auto-dismiss after 4s |
| `permissions.test.ts` | Permission sets | CASHIER has exactly `['can_sell', 'can_view_own_stats', 'can_manage_shift']` |
| `menuFiltering.test.ts` | Menu role arrays | CASHIER sees exactly `['pos', 'reports', 'configuration']` |

### Integration Tests

| Test File | What It Covers | Key Scenarios |
|-----------|---------------|---------------|
| `cashier-access.test.ts` | Navigation guards | Cashier clicks each restricted tab → lands on POS + toast shown |
| `cashier-access.test.ts` | Partial views | Cashier on Reports → only PersonalStatsPanel rendered |
| `cashier-access.test.ts` | Partial views | Cashier on Configuration → only ShiftSettings rendered |
| `cashier-rls.test.ts` | Database policies | Cashier queries `sales` → only own rows returned |
| `cashier-rls.test.ts` | Database policies | Cashier inserts into `inventory` → rejected |
| `cashier-rls.test.ts` | Database policies | Cashier queries `shifts` → only own shifts returned |

### Manual QA Checklist

- [ ] Login as CASHIER → lands on POS
- [ ] Sidebar shows only POS, Reports, Configuration
- [ ] Reports view shows only personal stats
- [ ] Configuration view shows only shift settings
- [ ] DevTools: set `activeTab = 'inventory'` → redirected to POS + toast
- [ ] Toast auto-dismisses after ~4 seconds
- [ ] Toast dismissible via X button
- [ ] Complete a full sale as CASHIER
- [ ] Attempt return as CASHIER → manager approval prompt
- [ ] Login as ADMIN → all navigation works as before
- [ ] Login as MANAGER → all navigation works as before

---

## Success Criteria Verification

| Criterion | How Verified | Test Type |
|-----------|-------------|-----------|
| SC-001: < 10s cashier creation | Timed manual test | Manual |
| SC-002: Zero unauthorized access | All restricted tabs attempted + DevTools bypass attempted | Integration + Manual |
| SC-003: 100% redirect + toast on denial | Every restricted tab triggers both redirect and toast | Integration |
| SC-004: Cashiers complete sales | Full POS workflow end-to-end | Integration |
| SC-007: Permission changes within 1s | Role change in DB → next action reflects new permissions | Manual |

---

## Rollback Plan

1. **Revert branch**: `git revert` all commits on `003-cashier-role-restriction`
2. **Revert migration**: Run rollback SQL (provided in Section 8)
3. **Verify**: Login as each role, confirm original behavior restored
4. **Risk**: Zero — all changes are additive restrictions, removal restores access

---

