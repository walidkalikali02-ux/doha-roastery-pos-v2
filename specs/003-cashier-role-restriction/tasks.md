

# Phase 2: Implementation Tasks

**Branch**: `003-cashier-role-restriction` | **Generated**: 2026-03-30
**Source**: [plan.md](./plan.md) v2

---

## Task Overview

| Task | Title | Priority | Estimate | Dependencies |
|------|-------|----------|----------|--------------|
| T1 | Z-Index Constants | 🟢 Low | 15 min | None |
| T2 | AccessDeniedToast Component | 🟡 Medium | 45 min | T1 |
| T3 | Translation Keys | 🟡 Medium | 30 min | None |
| T4 | `useRoleGuard` Hook | 🔴 High | 1 hr | T2 |
| T5 | AuthContext Permission Update | 🔴 High | 30 min | None |
| T6 | App.tsx Navigation Guard & Redirect | 🔴 Critical | 1.5 hr | T3, T4, T5 |
| T7 | ConfigurationView Section Filtering | 🟡 Medium | 1 hr | T5, T6 |
| T8 | ReportsView & PersonalStatsPanel | 🟡 Medium | 2 hr | T5, T6 |
| T9 | RLS Migration | 🔴 High | 1.5 hr | None |
| T10 | Unit Tests | 🟡 Medium | 1.5 hr | T2, T4, T5 |
| T11 | Integration Tests (UI) | 🟡 Medium | 2 hr | T6, T7, T8 |
| T12 | Integration Tests (RLS) | 🟡 Medium | 1.5 hr | T9 |
| T13 | Manual QA & Cleanup | 🟢 Low | 1 hr | T11, T12 |

**Total Estimate**: ~14 hours

**Critical Path**: T1 → T2 → T4 → T6 → T7/T8 → T11 → T13

---

## T1: Z-Index Constants

**Priority**: 🟢 Low | **Estimate**: 15 min | **Dependencies**: None

### Objective

Create a centralized z-index scale to prevent layer conflicts between navigation, modals, and the new toast component.

### Files

| File | Action | Detail |
|------|--------|--------|
| `src/constants/zIndex.ts` | CREATE | Z-index scale definition |

### Steps

1. Create `src/constants/` directory if it does not exist
2. Create `src/constants/zIndex.ts` with the following content:

```typescript
export const Z_INDEX = {
  NAV: 30,
  DROPDOWN: 40,
  MODAL_OVERLAY: 50,
  MODAL_CONTENT: 51,
  TOAST: 70,
} as const;

export type ZIndexKey = keyof typeof Z_INDEX;
```

3. Verify file exports correctly by importing in any existing file temporarily (remove after verification)

### Acceptance Criteria

- [ ] `Z_INDEX.TOAST` equals `70`
- [ ] File exports `Z_INDEX` object and `ZIndexKey` type
- [ ] No existing file imports break

### Notes

- Do NOT refactor existing z-index usages in this task. This file documents the convention and is consumed only by new components.
- Existing components keep their hardcoded `z-[30]`, `z-[50]`, etc. Refactoring those is a separate tech debt item.

---

## T2: AccessDeniedToast Component

**Priority**: 🟡 Medium | **Estimate**: 45 min | **Dependencies**: T1

### Objective

Create a reusable toast component that displays access denial messages with auto-dismiss and manual close.

### Files

| File | Action | Detail |
|------|--------|--------|
| `src/components/common/AccessDeniedToast.tsx` | CREATE | Toast component |

### Steps

1. Create `src/components/common/` directory if it does not exist
2. Create `AccessDeniedToast.tsx`:

```typescript
import { AlertTriangle, X } from 'lucide-react';
import { Z_INDEX } from '../../constants/zIndex';

interface AccessDeniedToastProps {
  message: string;
  onDismiss: () => void;
}

export function AccessDeniedToast({ message, onDismiss }: AccessDeniedToastProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{ zIndex: Z_INDEX.TOAST }}
      className="fixed bottom-4 right-4 bg-orange-50 border-2 border-orange-600
                 px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 max-w-sm
                 animate-in slide-in-from-bottom-4 duration-300"
    >
      <AlertTriangle className="text-orange-600 shrink-0" size={20} />
      <span className="text-orange-900 text-sm font-medium">{message}</span>
      <button
        onClick={onDismiss}
        className="text-orange-400 hover:text-orange-600 shrink-0 ml-2"
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  );
}
```

3. Verify the component renders correctly in isolation:
   - Orange border and background
   - Warning icon on the left
   - Message text in the middle
   - Close button on the right
   - Fixed position bottom-right of viewport

### Acceptance Criteria

- [ ] Component renders with `role="alert"` and `aria-live="assertive"` for screen readers
- [ ] Z-index uses `Z_INDEX.TOAST` from constants (not hardcoded)
- [ ] Close button calls `onDismiss` callback on click
- [ ] `aria-label="Dismiss"` present on close button
- [ ] Component does not manage its own visibility (parent controls mount/unmount)
- [ ] Max width constrained (`max-w-sm`) so long messages don't span full screen

### Edge Cases

- Very long message text: truncated by `max-w-sm`, wraps to second line
- RTL languages: `flex` handles direction automatically if parent sets `dir="rtl"`

---

## T3: Translation Keys

**Priority**: 🟡 Medium | **Estimate**: 30 min | **Dependencies**: None

### Objective

Add all translation keys needed for access denial messages, personal stats labels, and shift settings labels.

### Files

| File | Action | Detail |
|------|--------|--------|
| `src/translations.ts` | MODIFY | Add new keys to all language objects |

### Steps

1. Open `src/translations.ts`
2. Locate the English translation object
3. Add the following keys at the end of the object (maintain alphabetical order if the file follows that convention, otherwise append):

```typescript
// Access control
accessRestricted: 'Access restricted: This feature is not available for your role',
accessDeniedTitle: 'Access Denied',

// Shift settings (ConfigurationView)
shiftSettings: 'Shift Settings',
cashDrawerFloat: 'Cash Drawer Float',
openShift: 'Open Shift',
closeShift: 'Close Shift',

// Personal stats (ReportsView)
personalStats: 'My Stats',
totalSalesToday: 'Total Sales Today',
totalSalesThisWeek: 'Total Sales This Week',
shiftHistory: 'Shift History',
noSalesRecorded: 'No sales recorded',
noShiftHistory: 'No shift history available',
```

4. Add corresponding Arabic translations (or other languages present in the file):

```typescript
// Arabic equivalents
accessRestricted: 'وصول مقيد: هذه الميزة غير متوفرة لدورك',
accessDeniedTitle: 'الوصول مرفوض',
shiftSettings: 'إعدادات الوردية',
cashDrawerFloat: 'رصيد درج النقد',
openShift: 'فتح الوردية',
closeShift: 'إغلاق الوردية',
personalStats: 'إحصائياتي',
totalSalesToday: 'إجمالي المبيعات اليوم',
totalSalesThisWeek: 'إجمالي المبيعات هذا الأسبوع',
shiftHistory: 'سجل الورديات',
noSalesRecorded: 'لم يتم تسجيل مبيعات',
noShiftHistory: 'لا يوجد سجل ورديات',
```

5. Verify TypeScript compilation succeeds (all language objects have same shape)

### Acceptance Criteria

- [ ] All new keys added to every language object in the file
- [ ] TypeScript compiles without errors (type safety on translation keys)
- [ ] No existing keys modified or removed
- [ ] Keys follow existing naming convention in the file

### Notes

- If the translations file uses a typed interface/type for keys, update that type definition to include the new keys.

---

## T4: `useRoleGuard` Hook

**Priority**: 🔴 High | **Estimate**: 1 hr | **Dependencies**: T2

### Objective

Create a hook that checks whether the current user's role is in an allowed list, provides a function to trigger denial toast, and auto-dismisses the toast after 4 seconds.

### Files

| File | Action | Detail |
|------|--------|--------|
| `src/hooks/useRoleGuard.ts` | CREATE | Role guard hook |

### Steps

1. Create `src/hooks/` directory if it does not exist
2. Create `useRoleGuard.ts`:

```typescript
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

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  return { isAllowed, toastMessage, denyAccess, dismissToast };
}
```

3. Export from hooks index if one exists, otherwise direct import is fine

### Acceptance Criteria

- [ ] `isAllowed` returns `true` when user role is in `allowedRoles`
- [ ] `isAllowed` returns `false` when user role is NOT in `allowedRoles`
- [ ] `isAllowed` returns `false` when user is `null`
- [ ] `denyAccess("message")` sets `toastMessage` to `"message"`
- [ ] `toastMessage` auto-resets to `null` after 4000ms
- [ ] `dismissToast()` immediately sets `toastMessage` to `null`
- [ ] Timer is cleaned up on unmount (no memory leak)
- [ ] Calling `denyAccess` while a toast is already showing resets the 4s timer

### Implementation Details

- `TOAST_DURATION_MS` is a module-level constant, not exported (internal concern)
- `allowedRoles` comparison uses `Array.includes` — sufficient for arrays of 3-4 items
- No dependency on `AccessDeniedToast` component — the hook manages state, the parent renders the toast

---

## T5: AuthContext Permission Update

**Priority**: 🔴 High | **Estimate**: 30 min | **Dependencies**: None

### Objective

Update the CASHIER permission set to remove `can_view_reports` and add `can_view_own_stats` and `can_manage_shift`.

### Files

| File | Action | Detail |
|------|--------|--------|
| `src/contexts/AuthContext.tsx` | MODIFY | Update `getPermissionsForRole` |

### Steps

1. Open `src/contexts/AuthContext.tsx`
2. Locate `getPermissionsForRole` function (around line 53-54)
3. Change the CASHIER entry:

```typescript
// BEFORE
CASHIER: ['can_sell', 'can_view_reports']

// AFTER
CASHIER: ['can_sell', 'can_view_own_stats', 'can_manage_shift']
```

4. Run a **global search** for `can_view_reports` across the entire codebase:

```bash
grep -rn "can_view_reports" src/
```

5. For each result found:
   - If it's a CASHIER-specific check → replace with `can_view_own_stats`
   - If it's used for ADMIN/MANAGER → leave unchanged (they have broader permissions)
   - Document findings in PR description

6. Verify that the `UserPermission` type (if it exists) includes the new permission names. If permissions are typed as a union:

```typescript
// If this type exists, update it:
type UserPermission = 'can_sell' | 'can_view_reports' | /* ... */ | 'can_view_own_stats' | 'can_manage_shift';
```

### Acceptance Criteria

- [ ] CASHIER permissions are exactly `['can_sell', 'can_view_own_stats', 'can_manage_shift']`
- [ ] No remaining references to `can_view_reports` in CASHIER context
- [ ] ADMIN and MANAGER permissions unchanged
- [ ] TypeScript compiles without errors
- [ ] If permission type union exists, new permissions are included

### Risks

- If other code checks `can_view_reports` and uses it for CASHIER-specific logic, that code will break. The grep in step 4 catches this.

---

## T6: App.tsx Navigation Guard & Redirect

**Priority**: 🔴 Critical | **Estimate**: 1.5 hr | **Dependencies**: T3, T4, T5

### Objective

Update `allMenuItems` role arrays to restrict CASHIER access, implement role-aware redirect with `getDefaultTab`, and integrate the role guard hook with toast rendering. **This is the most critical task — it fixes the redirect loop bug and enforces all UI-level restrictions.**

### Files

| File | Action | Detail |
|------|--------|--------|
| `src/App.tsx` | MODIFY | Menu roles, guard logic, toast rendering |

### Steps

#### Step 1: Add `getDefaultTab` helper function

Add above the component or inside it (before JSX):

```typescript
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
```

#### Step 2: Update `allMenuItems` role arrays (lines 61-73)

Remove `UserRole.CASHIER` from the following items:
- `dashboard`
- `inventory`
- `crm`

Keep `UserRole.CASHIER` on:
- `pos`

Add `UserRole.CASHIER` to (if not present):
- `reports`
- `configuration`

Result should look like:

```typescript
const allMenuItems = [
  { id: 'dashboard',     /* ... */ roles: [UserRole.ADMIN, UserRole.MANAGER] },
  { id: 'inventory',     /* ... */ roles: [UserRole.ADMIN, UserRole.MANAGER] },
  { id: 'pos',           /* ... */ roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER] },
  { id: 'crm',           /* ... */ roles: [UserRole.ADMIN, UserRole.MANAGER] },
  { id: 'suppliers',     /* ... */ roles: [UserRole.ADMIN, UserRole.MANAGER] },
  { id: 'purchases',     /* ... */ roles: [UserRole.ADMIN, UserRole.MANAGER] },
  { id: 'accounting',    /* ... */ roles: [UserRole.ADMIN] },
  { id: 'reports',       /* ... */ roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER] },
  { id: 'configuration', /* ... */ roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER] },
  { id: 'users',         /* ... */ roles: [UserRole.ADMIN] },
  { id: 'audit',         /* ... */ roles: [UserRole.ADMIN] },
];
```

#### Step 3: Import and integrate `useRoleGuard`

```typescript
import { useRoleGuard } from './hooks/useRoleGuard';
import { AccessDeniedToast } from './components/common/AccessDeniedToast';
```

Inside the component body:

```typescript
const currentMenuRoles = allMenuItems.find(m => m.id === activeTab)?.roles ?? [];
const { toastMessage, denyAccess, dismissToast } = useRoleGuard(currentMenuRoles);
```

#### Step 4: Update the existing guard `useEffect` (lines 79-87)

Replace the existing guard:

```typescript
// BEFORE (approximate)
useEffect(() => {
  // ... checks activeTab against allowed menus
  // ... redirects to 'dashboard'
}, [activeTab]);

// AFTER
useEffect(() => {
  if (!user) return;

  const allowedMenuIds = allMenuItems
    .filter(item => item.roles.includes(user.role))
    .map(item => item.id);

  if (!allowedMenuIds.includes(activeTab)) {
    const fallback = getDefaultTab(user.role);
    setActiveTab(fallback);
    denyAccess(t.accessRestricted);
  }
}, [activeTab, user?.role]);
```

#### Step 5: Verify initial login redirect (line 157-158)

Confirm this existing code is still correct:

```typescript
if (user.role === UserRole.CASHIER) {
  setActiveTab('pos');
}
```

If this logic uses `'dashboard'` as a fallback before the role check runs, ensure `getDefaultTab` is used instead.

#### Step 6: Render the toast

In the JSX return, add at the end (sibling to main layout, not nested inside):

```typescript
return (
  <>
    {/* ... existing layout JSX ... */}

    {toastMessage && (
      <AccessDeniedToast message={toastMessage} onDismiss={dismissToast} />
    )}
  </>
);
```

### Acceptance Criteria

- [ ] CASHIER sees exactly 3 sidebar items: POS, Reports, Configuration
- [ ] CASHIER on login → lands on POS (not dashboard)
- [ ] Setting `activeTab = 'inventory'` via state → redirects to POS
- [ ] Setting `activeTab = 'dashboard'` via state → redirects to POS
- [ ] Redirect triggers toast with `t.accessRestricted` message
- [ ] Toast auto-dismisses after 4 seconds
- [ ] ADMIN login → sees all 11 items, lands on dashboard (unchanged)
- [ ] MANAGER login → sees their items, lands on dashboard (unchanged)
- [ ] No redirect loop occurs for any role

### Testing Checklist (manual during development)

1. Login as CASHIER → POS view, 3 sidebar items
2. React DevTools: change `activeTab` to `'inventory'` → snaps back to `'pos'` + orange toast
3. React DevTools: change `activeTab` to `'dashboard'` → snaps back to `'pos'` + orange toast
4. Login as ADMIN → dashboard, all items visible
5. Login as MANAGER → dashboard, expected items visible

---

## T7: ConfigurationView Section Filtering

**Priority**: 🟡 Medium | **Estimate**: 1 hr | **Dependencies**: T5, T6

### Objective

Filter ConfigurationView so CASHIER users see only the Shift Settings section. All other sections are hidden.

### Files

| File | Action | Detail |
|------|--------|--------|
| `src/views/ConfigurationView.tsx` | MODIFY | Add role-based section filtering |

### Steps

1. Open `ConfigurationView.tsx`
2. Identify how sections/tabs are currently defined (array of objects, hardcoded JSX, switch statement, etc.)
3. Create a section access mapping:

```typescript
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';

// Inside the component:
const { user } = useAuth();

const configSections = [
  { id: 'general',       label: t.generalSettings,       roles: [UserRole.ADMIN, UserRole.MANAGER] },
  { id: 'tax',           label: t.taxSettings,            roles: [UserRole.ADMIN, UserRole.MANAGER] },
  { id: 'payment',       label: t.paymentMethods,         roles: [UserRole.ADMIN, UserRole.MANAGER] },
  { id: 'receipt',       label: t.receiptTemplate,        roles: [UserRole.ADMIN, UserRole.MANAGER] },
  { id: 'shift',         label: t.shiftSettings,          roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER] },
  { id: 'notifications', label: t.notificationSettings,   roles: [UserRole.ADMIN, UserRole.MANAGER] },
];

const visibleSections = configSections.filter(
  s => user && s.roles.includes(user.role)
);
```

4. **If section IDs differ from the list above**, map them to the actual IDs used in the component. The mapping table in the plan is authoritative for access decisions.

5. Update the rendering logic:
   - If the view uses tabs: filter the tab list to `visibleSections` only
   - If the view uses accordion/cards: conditionally render only visible sections
   - If the view uses a switch statement: add role checks before each case

6. **Single-section optimization**: When only one section is visible (CASHIER case), skip the tab/section selector and render the content directly:

```typescript
if (visibleSections.length === 1) {
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">{visibleSections[0].label}</h2>
      {renderSection(visibleSections[0].id)}
    </div>
  );
}
```

7. **Safety net**: If `visibleSections.length === 0` (should not happen), render nothing with a console warning:

```typescript
if (visibleSections.length === 0) {
  console.warn('ConfigurationView: No sections available for role', user?.role);
  return null;
}
```

### Acceptance Criteria

- [ ] CASHIER sees only "Shift Settings" — no tab selector, direct rendering
- [ ] ADMIN sees all 6 sections
- [ ] MANAGER sees all 6 sections (or whatever their current access is — do not modify)
- [ ] No other role's access is changed
- [ ] No TypeScript errors
- [ ] Section tab selector hidden when only one section visible

### Edge Cases

- User with no role → `visibleSections` empty → null rendered + console warning
- Component mounted before auth loads → guard should prevent this (T6), but add null check on `user`

---

## T8: ReportsView & PersonalStatsPanel

**Priority**: 🟡 Medium | **Estimate**: 2 hr | **Dependencies**: T5, T6

### Objective

Create a `PersonalStatsPanel` component showing cashier's own sales and shift history. Modify `ReportsView` to render only this panel when the user is a CASHIER.

### Files

| File | Action | Detail |
|------|--------|--------|
| `src/views/ReportsView.tsx` | MODIFY | Add cashier early-return |
| `src/components/reports/PersonalStatsPanel.tsx` | CREATE | Personal stats display |

### Steps

#### Step 1: Create PersonalStatsPanel

Create `src/components/reports/PersonalStatsPanel.tsx`:

```typescript
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ShoppingCart, Calendar, Clock } from 'lucide-react';

interface PersonalStatsPanelProps {
  userId: string;
  translations: Record<string, string>; // or your translation type
}

interface SalesStats {
  todayCount: number;
  todayAmount: number;
  weekCount: number;
  weekAmount: number;
}

interface ShiftRecord {
  id: string;
  opened_at: string;
  closed_at: string | null;
  opening_amount: number;
  closing_amount: number | null;
}

export function PersonalStatsPanel({ userId, translations: t }: PersonalStatsPanelProps) {
  const [stats, setStats] = useState<SalesStats | null>(null);
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      setLoading(true);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      weekAgo.setHours(0, 0, 0, 0);

      // Fetch today's sales
      const { data: todaySales } = await supabase
        .from('sales')
        .select('total')
        .eq('cashier_id', userId)
        .gte('created_at', today.toISOString());

      // Fetch week's sales
      const { data: weekSales } = await supabase
        .from('sales')
        .select('total')
        .eq('cashier_id', userId)
        .gte('created_at', weekAgo.toISOString());

      // Fetch recent shifts
      const { data: shiftData } = await supabase
        .from('shifts')
        .select('*')
        .eq('user_id', userId)
        .order('opened_at', { ascending: false })
        .limit(10);

      setStats({
        todayCount: todaySales?.length ?? 0,
        todayAmount: todaySales?.reduce((sum, s) => sum + (s.total || 0), 0) ?? 0,
        weekCount: weekSales?.length ?? 0,
        weekAmount: weekSales?.reduce((sum, s) => sum + (s.total || 0), 0) ?? 0,
      });
      setShifts(shiftData ?? []);
      setLoading(false);
    }

    fetchStats();
  }, [userId]);

  if (loading) {
    return <div className="animate-pulse p-6">Loading stats...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-bold">{t.personalStats}</h2>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 text-gray-600 mb-1">
            <ShoppingCart size={16} />
            <span className="text-sm">{t.totalSalesToday}</span>
          </div>
          <div className="text-2xl font-bold">{stats?.todayCount ?? 0}</div>
          <div className="text-sm text-gray-500">
            {stats?.todayAmount?.toFixed(2) ?? '0.00'}
          </div>
        </div>

        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 text-gray-600 mb-1">
            <Calendar size={16} />
            <span className="text-sm">{t.totalSalesThisWeek}</span>
          </div>
          <div className="text-2xl font-bold">{stats?.weekCount ?? 0}</div>
          <div className="text-sm text-gray-500">
            {stats?.weekAmount?.toFixed(2) ?? '0.00'}
          </div>
        </div>
      </div>

      {/* Shift History */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Clock size={18} />
          {t.shiftHistory}
        </h3>
        {shifts.length === 0 ? (
          <p className="text-gray-500 text-sm">{t.noShiftHistory}</p>
        ) : (
          <div className="space-y-2">
            {shifts.map(shift => (
              <div key={shift.id} className="bg-white rounded-lg border p-3 flex justify-between items-center">
                <div>
                  <div className="text-sm font-medium">
                    {new Date(shift.opened_at).toLocaleDateString()}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(shift.opened_at).toLocaleTimeString()}
                    {shift.closed_at && ` — ${new Date(shift.closed_at).toLocaleTimeString()}`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm">Open: {shift.opening_amount?.toFixed(2)}</div>
                  {shift.closing_amount != null && (
                    <div className="text-sm">Close: {shift.closing_amount.toFixed(2)}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

#### Step 2: Modify ReportsView

Open `src/views/ReportsView.tsx` and add early return for CASHIER:

```typescript
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';
import { PersonalStatsPanel } from '../components/reports/PersonalStatsPanel';

// Inside the component, before existing return:
const { user } = useAuth();

if (user?.role === UserRole.CASHIER) {
  return <PersonalStatsPanel userId={user.id} translations={t} />;
}

// ... existing full reports rendering for ADMIN/MANAGER
```

### Acceptance Criteria

- [ ] CASHIER on Reports tab sees only PersonalStatsPanel
- [ ] PersonalStatsPanel shows: today's sales count + amount, week's sales count + amount, shift history (last 10)
- [ ] ADMIN/MANAGER on Reports tab see the full reports view (unchanged)
- [ ] Empty states rendered correctly: "No sales recorded", "No shift history available"
- [ ] Loading state shown while data fetches
- [ ] Data queries include `cashier_id = userId` / `user_id = userId` filters
- [ ] Currency amounts display with 2 decimal places
- [ ] Dates formatted using `toLocaleDateString()` / `toLocaleTimeString()`

### Notes

- The `cashier_id` and `user_id` column names must match the actual database schema. Verify column names before implementation.
- RLS policies (T9) provide a second layer of protection, but the client-side queries must also filter by user ID for performance (avoid fetching all rows then filtering).
- Currency formatting should ideally use the store's currency setting. If a currency formatter utility exists, use it instead of `.toFixed(2)`.

---

## T9: RLS Migration

**Priority**: 🔴 High | **Estimate**: 1.5 hr | **Dependencies**: None (can run in parallel with UI tasks)

### Objective

Create and apply a Supabase migration that adds Row Level Security policies restricting CASHIER database access to own sales, own shifts, and read-only products/customers.

### Files

| File | Action | Detail |
|------|--------|--------|
| `supabase/migrations/20260330_cashier_rls_policies.sql` | CREATE | All RLS policies |

### Pre-Implementation Steps (CRITICAL)

Before writing the migration:

1. **Audit existing RLS status** on each affected table:

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('sales', 'sale_items', 'products', 'customers', 'shifts', 'profiles');
```

2. **List existing policies** on each table:

```sql
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('sales', 'sale_items', 'products', 'customers', 'shifts', 'profiles');
```

3. **Document findings** in a comment block at the top of the migration file. If any table has a permissive `USING (true)` policy for SELECT, that policy must be dropped or replaced — otherwise it overrides the new restrictive policy.

4. **Verify column names** match what the policies reference:
   - `sales.cashier_id` — confirm this column exists
   - `shifts.user_id` — confirm this column exists
   - `profiles.id` — confirm this matches `auth.uid()`
   - `profiles.role` — confirm this column exists and stores `'CASHIER'`
   - `profiles.is_active` — confirm this column exists

### Migration Content

```sql
-- ============================================
-- CASHIER ROLE RLS POLICIES
-- Migration: 20260330_cashier_rls_policies
-- ============================================
-- Pre-migration audit results:
-- [Document findings from steps 1-2 here]
-- ============================================

-- Enable RLS on tables if not already enabled
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user's role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() AND is_active = true;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ----------------------------------------
-- DROP conflicting policies (if found in audit)
-- Uncomment and modify as needed:
-- ----------------------------------------
-- DROP POLICY IF EXISTS "some_existing_permissive_policy" ON public.sales;

-- ----------------------------------------
-- SALES
-- ----------------------------------------
CREATE POLICY "cashier_select_own_sales"
  ON public.sales FOR SELECT
  USING (
    CASE
      WHEN public.current_user_role() = 'CASHIER' THEN cashier_id = auth.uid()
      ELSE true
    END
  );

CREATE POLICY "cashier_insert_sales"
  ON public.sales FOR INSERT
  WITH CHECK (cashier_id = auth.uid());

CREATE POLICY "cashier_update_own_sales"
  ON public.sales FOR UPDATE
  USING (
    CASE
      WHEN public.current_user_role() = 'CASHIER' THEN cashier_id = auth.uid()
      ELSE true
    END
  );

-- ----------------------------------------
-- SALE ITEMS
-- ----------------------------------------
CREATE POLICY "cashier_select_own_sale_items"
  ON public.sale_items FOR SELECT
  USING (
    CASE
      WHEN public.current_user_role() = 'CASHIER'
        THEN sale_id IN (SELECT id FROM public.sales WHERE cashier_id = auth.uid())
      ELSE true
    END
  );

CREATE POLICY "cashier_insert_sale_items"
  ON public.sale_items FOR INSERT
  WITH CHECK (
    sale_id IN (SELECT id FROM public.sales WHERE cashier_id = auth.uid())
  );

CREATE POLICY "cashier_update_sale_items"
  ON public.sale_items FOR UPDATE
  USING (
    CASE
      WHEN public.current_user_role() = 'CASHIER'
        THEN sale_id IN (SELECT id FROM public.sales WHERE cashier_id = auth.uid())
      ELSE true
    END
  );

-- ----------------------------------------
-- PRODUCTS (read-only for all, POS needs this)
-- ----------------------------------------
CREATE POLICY "all_roles_read_products"
  ON public.products FOR SELECT
  USING (true);

-- ----------------------------------------
-- CUSTOMERS (read-only for all, POS needs this)
-- ----------------------------------------
CREATE POLICY "all_roles_read_customers"
  ON public.customers FOR SELECT
  USING (true);

-- ----------------------------------------
-- SHIFTS
-- ----------------------------------------
CREATE POLICY "cashier_select_own_shifts"
  ON public.shifts FOR SELECT
  USING (
    CASE
      WHEN public.current_user_role() = 'CASHIER' THEN user_id = auth.uid()
      ELSE true
    END
  );

CREATE POLICY "cashier_insert_own_shifts"
  ON public.shifts FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "cashier_update_own_shifts"
  ON public.shifts FOR UPDATE
  USING (
    CASE
      WHEN public.current_user_role() = 'CASHIER' THEN user_id = auth.uid()
      ELSE true
    END
  );

-- ----------------------------------------
-- PROFILES (own profile only for cashier)
-- ----------------------------------------
CREATE POLICY "cashier_read_own_profile"
  ON public.profiles FOR SELECT
  USING (
    CASE
      WHEN public.current_user_role() = 'CASHIER' THEN id = auth.uid()
      ELSE true
    END
  );
```

### Rollback Script

Create `supabase/migrations/20260330_cashier_rls_policies_rollback.sql` (not auto-applied, kept for emergencies):

```sql
DROP POLICY IF EXISTS "cashier_select_own_sales" ON public.sales;
DROP POLICY IF EXISTS "cashier_insert_sales" ON public.sales;
DROP POLICY IF EXISTS "cashier_update_own_sales" ON public.sales;
DROP POLICY IF EXISTS "cashier_select_own_sale_items" ON public.sale_items;
DROP POLICY IF EXISTS "cashier_insert_sale_items" ON public.sale_items;
DROP POLICY IF EXISTS "cashier_update_sale_items" ON public.sale_items;
DROP POLICY IF EXISTS "all_roles_read_products" ON public.products;
DROP POLICY IF EXISTS "all_roles_read_customers" ON public.customers;
DROP POLICY IF EXISTS "cashier_select_own_shifts" ON public.shifts;
DROP POLICY IF EXISTS "cashier_insert_own_shifts" ON public.shifts;
DROP POLICY IF EXISTS "cashier_update_own_shifts" ON public.shifts;
DROP POLICY IF EXISTS "cashier_read_own_profile" ON public.profiles;
DROP FUNCTION IF EXISTS public.current_user_role();
```

### Acceptance Criteria

- [ ] Migration applies without errors on clean database
- [ ] Migration applies without errors on existing database with data
- [ ] `current_user_role()` returns correct role for authenticated user
- [ ] Cashier can SELECT only own rows from `sales`
- [ ] Cashier can INSERT into `sales` with own `cashier_id`
- [ ] Cashier CANNOT INSERT into `sales` with another user's `cashier_id`
- [ ] Cashier can SELECT all `products` (needed for POS)
- [ ] Cashier can SELECT all `customers` (needed for POS)
- [ ] Cashier CANNOT INSERT/UPDATE/DELETE `products`
- [ ] Cashier CANNOT INSERT/UPDATE/DELETE `customers`
- [ ] Cashier can SELECT/INSERT/UPDATE only own `shifts`
- [ ] Cashier can SELECT only own `profile`
- [ ] ADMIN can SELECT all rows in all tables (unchanged)
- [ ] MANAGER can SELECT all rows in all tables (unchanged)
- [ ] Rollback script executes cleanly

### Warnings

- `SECURITY DEFINER` on `current_user_role()` means the function runs with the privileges of the function creator (typically superuser). This is intentional — the function needs to read `profiles` without being blocked by RLS on `profiles` itself (circular dependency).
- The `CASE WHEN ... ELSE true` pattern means non-CASHIER roles are unrestricted by these specific policies. Existing policies for ADMIN/MANAGER remain unchanged.
- If a table has `FORCE ROW LEVEL SECURITY` for table owners, ensure the service role is not affected.

---

## T10: Unit Tests

**Priority**: 🟡 Medium | **Estimate**: 1.5 hr | **Dependencies**: T2, T4, T5

### Objective

Write unit tests for the role guard hook, permission definitions, and menu filtering logic.

### Files

| File | Action | Detail |
|------|--------|--------|
| `tests/unit/useRoleGuard.test.ts` | CREATE | Hook logic tests |
| `tests/unit/permissions.test.ts` | MODIFY | Add cashier permission assertions |
| `tests/unit/menuFiltering.test.ts` | CREATE | Menu role array tests |

### Test Cases

#### `useRoleGuard.test.ts`

```typescript
describe('useRoleGuard', () => {
  it('returns isAllowed=true when user role is in allowedRoles', () => {});

  it('returns isAllowed=false when user role is NOT in allowedRoles', () => {});

  it('returns isAllowed=false when user is null', () => {});

  it('denyAccess sets toastMessage', () => {});

  it('toastMessage auto-clears after 4000ms', () => {
    // Use vi.useFakeTimers()
  });

  it('dismissToast clears toastMessage immediately', () => {});

  it('calling denyAccess while toast is showing resets the timer', () => {
    // Call denyAccess, advance 2000ms, call denyAccess again
    // Advance 2000ms — toast should still be showing
    // Advance 2000ms more — now toast should be gone
  });

  it('cleans up timer on unmount', () => {
    // Verify no "update on unmounted component" warning
  });
});
```

#### `permissions.test.ts`

```typescript
describe('getPermissionsForRole', () => {
  it('CASHIER has exactly can_sell, can_view_own_stats, can_manage_shift', () => {
    const perms = getPermissionsForRole(UserRole.CASHIER);
    expect(perms).toEqual(['can_sell', 'can_view_own_stats', 'can_manage_shift']);
  });

  it('CASHIER does NOT have can_view_reports', () => {
    const perms = getPermissionsForRole(UserRole.CASHIER);
    expect(perms).not.toContain('can_view_reports');
  });

  it('ADMIN permissions are unchanged', () => {
    // Snapshot or explicit list
  });

  it('MANAGER permissions are unchanged', () => {
    // Snapshot or explicit list
  });
});
```

#### `menuFiltering.test.ts`

```typescript
describe('allMenuItems role filtering', () => {
  it('CASHIER sees exactly pos, reports, configuration', () => {
    const cashierMenus = allMenuItems
      .filter(item => item.roles.includes(UserRole.CASHIER))
      .map(item => item.id);
    expect(cashierMenus).toEqual(['pos', 'reports', 'configuration']);
  });

  it('CASHIER does NOT see dashboard, inventory, crm', () => {
    const cashierMenus = allMenuItems
      .filter(item => item.roles.includes(UserRole.CASHIER))
      .map(item => item.id);
    expect(cashierMenus).not.toContain('dashboard');
    expect(cashierMenus).not.toContain('inventory');
    expect(cashierMenus).not.toContain('crm');
  });

  it('ADMIN sees all 11 menu items', () => {
    const adminMenus = allMenuItems
      .filter(item => item.roles.includes(UserRole.ADMIN));
    expect(adminMenus).toHaveLength(11);
  });

  it('every menu item has at least one role', () => {
    allMenuItems.forEach(item => {
      expect(item.roles.length).toBeGreaterThan(0);
    });
  });
});
```

### Acceptance Criteria

- [ ] All tests pass with `vitest run`
- [ ] Hook tests use `renderHook` from `@testing-library/react`
- [ ] Timer tests use `vi.useFakeTimers()` and `vi.advanceTimersByTime()`
- [ ] AuthContext is mocked for hook tests (no real Supabase calls)
- [ ] Permission snapshot tests lock down ADMIN/MANAGER permissions against regressions

---

## T11: Integration Tests (UI)

**Priority**: 🟡 Medium | **Estimate**: 2 hr | **Dependencies**: T6, T7, T8

### Objective

Test the complete cashier navigation flow: login, sidebar rendering, restricted tab attempts, toast display, view filtering.

### Files

| File | Action | Detail |
|------|--------|--------|
| `tests/integration/cashier-access.test.ts` | CREATE | Full navigation tests |

### Test Cases

```typescript
describe('Cashier Access Restrictions', () => {
  describe('Navigation', () => {
    it('cashier sees only POS, Reports, Configuration in sidebar', () => {});

    it('cashier lands on POS view after login', () => {});

    it('cashier navigating to inventory is redirected to POS', () => {});

    it('cashier navigating to dashboard is redirected to POS', () => {});

    it('cashier navigating to crm is redirected to POS', () => {});

    it('redirect shows access denied toast', () => {});

    it('toast disappears after ~4 seconds', () => {});

    it('toast can be dismissed by clicking X', () => {});
  });

  describe('Reports View - Cashier', () => {
    it('renders PersonalStatsPanel instead of full reports', () => {});

    it('shows today sales count and amount', () => {});

    it('shows week sales count and amount', () => {});

    it('shows shift history', () => {});

    it('shows empty state when no sales exist', () => {});
  });

  describe('Configuration View - Cashier', () => {
    it('renders only shift settings section', () => {});

    it('does not render general, tax, payment, receipt, notification sections', () => {});

    it('does not show section tab selector (single section)', () => {});
  });

  describe('Non-Cashier Roles Unaffected', () => {
    it('admin sees all navigation items', () => {});

    it('admin sees full reports view', () => {});

    it('admin sees all configuration sections', () => {});

    it('manager navigation unchanged', () => {});
  });
});
```

### Acceptance Criteria

- [ ] All tests pass
- [ ] Tests mock AuthContext to simulate different roles
- [ ] Tests mock Supabase client for data queries
- [ ] Toast assertions check for `role="alert"` element in DOM
- [ ] Tests verify both positive (cashier CAN do) and negative (cashier CANNOT do) cases
- [ ] Non-regression tests confirm ADMIN and MANAGER are unaffected

---

## T12: Integration Tests (RLS)

**Priority**: 🟡 Medium | **Estimate**: 1.5 hr | **Dependencies**: T9

### Objective

Test database-level restrictions by executing queries as different roles against a test database with RLS policies applied.

### Files

| File | Action | Detail |
|------|--------|--------|
| `tests/integration/cashier-rls.test.ts` | CREATE | Database policy tests |

### Test Cases

```typescript
describe('Cashier RLS Policies', () => {
  // Setup: Create test users (admin, cashier_a, cashier_b)
  // Setup: Create test data (sales for each cashier, products, customers, shifts)

  describe('Sales', () => {
    it('cashier_a can SELECT only own sales', () => {});
    it('cashier_a CANNOT see cashier_b sales', () => {});
    it('cashier_a can INSERT sale with own cashier_id', () => {});
    it('cashier_a CANNOT INSERT sale with cashier_b id', () => {});
    it('admin can SELECT all sales', () => {});
  });

  describe('Products', () => {
    it('cashier can SELECT all products', () => {});
    it('cashier CANNOT INSERT product', () => {});
    it('cashier CANNOT UPDATE product', () => {});
    it('cashier CANNOT DELETE product', () => {});
  });

  describe('Customers', () => {
    it('cashier can SELECT all customers', () => {});
    it('cashier CANNOT INSERT customer', () => {});
    it('cashier CANNOT UPDATE customer', () => {});
  });

  describe('Shifts', () => {
    it('cashier_a can SELECT only own shifts', () => {});
    it('cashier_a CANNOT see cashier_b shifts', () => {});
    it('cashier_a can INSERT own shift', () => {});
    it('cashier_a can UPDATE own shift (close)', () => {});
  });

  describe('Profiles', () => {
    it('cashier can SELECT only own profile', () => {});
    it('cashier CANNOT see other profiles', () => {});
  });

  describe('Restricted Tables', () => {
    it('cashier CANNOT SELECT from suppliers', () => {});
    it('cashier CANNOT SELECT from purchases', () => {});
    it('cashier CANNOT SELECT from accounting_entries', () => {});
  });
});
```

### Acceptance Criteria

- [ ] Tests run against a real Supabase instance (local or test environment)
- [ ] Test users created with proper roles in `profiles` table
- [ ] Each test authenticates as the specific user before querying
- [ ] All SELECT restriction tests verify row count (not just no error)
- [ ] All mutation restriction tests verify rejection (error returned)
- [ ] Cleanup: test data removed after suite completes

### Notes

- These tests require a running Supabase instance. They should be tagged/categorized so they can be skipped in CI if no database is available.
- Consider using `supabase start` for local testing or a dedicated test project.

---

## T13: Manual QA & Cleanup

**Priority**: 🟢 Low | **Estimate**: 1 hr | **Dependencies**: T11, T12

### Objective

Perform final manual QA walkthrough, clean up any TODO comments, verify all acceptance criteria, and prepare for PR review.

### Checklist

#### Functional QA

- [ ] Login as CASHIER → lands on POS
- [ ] Sidebar shows exactly 3 items: POS, Reports, Configuration
- [ ] Click POS → POS view renders, can search products, add to cart, complete sale
- [ ] Click Reports → PersonalStatsPanel renders, shows own stats
- [ ] Click Configuration → ShiftSettings renders (no tab selector), can open/close shift
- [ ] React DevTools: set `activeTab = 'inventory'` → snaps to POS + toast
- [ ] React DevTools: set `activeTab = 'dashboard'` → snaps to POS + toast
- [ ] React DevTools: set `activeTab = 'crm'` → snaps to POS + toast
- [ ] Toast auto-dismisses after ~4 seconds
- [ ] Toast X button dismisses immediately
- [ ] Initiate return as CASHIER → manager approval prompt shown (existing `alert()`)
- [ ] Login as ADMIN → all 11 navigation items, dashboard landing, all reports, all config sections
- [ ] Login as MANAGER → expected navigation items, dashboard landing, full reports

#### Code Cleanup

- [ ] Remove any `console.log` debug statements added during development
- [ ] Remove any `TODO` or `FIXME` comments (or convert to tracked issues)
- [ ] Verify no unused imports in modified files
- [ ] Run `tsc --noEmit` — zero TypeScript errors
- [ ] Run `vitest run` — all tests pass
- [ ] Run linter — zero new warnings

#### Documentation

- [ ] Update `quickstart.md` if any setup steps changed
- [ ] Add entry to CHANGELOG if project maintains one
- [ ] PR description includes: summary, screenshots (sidebar before/after), test results

#### Performance Spot Check

- [ ] Role permission lookup < 100ms (check DevTools Performance tab)
- [ ] No extra network requests on tab switch for role checking
- [ ] PersonalStatsPanel loads data within 2 seconds on normal connection

### Acceptance Criteria

- [ ] All checklist items completed
- [ ] PR ready for review with clean diff, no debug artifacts

---

## Summary

