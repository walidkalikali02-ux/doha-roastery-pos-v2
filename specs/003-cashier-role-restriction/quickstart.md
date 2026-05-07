# Quickstart: Cashier POS-Only Access

**Feature Branch**: `003-cashier-role-restriction`
**Date**: 2026-03-30

---

## Prerequisites

- Node.js 18+
- Supabase CLI installed
- Access to Supabase dashboard
- Admin account in the system

---

## Development Setup

### 1. Checkout Feature Branch

```bash
git checkout 003-cashier-role-restriction
npm install
```

### 2. Run Development Server

```bash
npm run dev
# Opens at http://localhost:3000 (or 3001 if 3000 is busy)
```

### 3. Verify Current State

Login with an admin account and observe:
- Cashier role can access: dashboard, inventory, pos, crm, configuration
- This is the baseline before changes

---

## Testing Guide

### Test Account Setup

Create a test cashier account (or use existing):

1. Login as ADMIN
2. Go to Staff management
3. Create employee with role `CASHIER`
4. Note the credentials

### Pre-Implementation Tests

Run these tests BEFORE making changes to document current behavior:

| Test Case | Expected Result (Current) |
|-----------|---------------------------|
| Login as CASHIER | Redirect to POS view |
| Click Inventory | Inventory view opens |
| Click CRM | CRM view opens |
| Click Configuration | Configuration view opens |
| Click Dashboard | Dashboard view opens |
| Try to access Reports | Hidden from menu |
| Try to access Staff | Hidden from menu |
| Try to access Roasting | Hidden from menu |

### Post-Implementation Tests

After implementing changes, verify:

| Test Case | Expected Result (After) |
|-----------|-------------------------|
| Login as CASHIER | Redirect to POS view |
| Click Inventory (if visible) | Redirect to POS + Toast |
| Click CRM (if visible) | Redirect to POS + Toast |
| Click Configuration (if visible) | Redirect to POS + Toast |
| Click Dashboard (if visible) | Redirect to POS + Toast |
| Direct state manipulation (localStorage) | Guard resets to POS |
| View own sales stats | Allowed (via reports API) |
| View other staff's stats | Blocked |
| Initiate return | Allowed, requires manager approval |
| Void item in active transaction | Allowed |
| Void completed transaction | Blocked, requires manager |

---

## Implementation Checklist

### Phase 1: Navigation Changes

- [ ] Update `allMenuItems` in `App.tsx`
  - [ ] Remove CASHIER from dashboard roles
  - [ ] Remove CASHIER from inventory roles
  - [ ] Remove CASHIER from crm roles
  - [ ] Remove CASHIER from configuration roles
- [ ] Update guard redirect target from 'dashboard' to 'pos' for CASHIER
- [ ] Add toast on unauthorized access

### Phase 2: Permission Changes

- [ ] Update `getPermissionsForRole` in `AuthContext.tsx`
  - [ ] Change CASHIER permissions from `['can_sell', 'can_view_reports']`
  - [ ] To `['can_sell', 'can_view_own_stats', 'can_manage_shift']`

### Phase 3: UI Components

- [ ] Create `AccessDeniedToast` component
- [ ] Create `useRoleGuard` hook (optional, for future use)
- [ ] Add translation key for access denied message

### Phase 4: Database (Optional)

- [ ] Add `current_user_is_cashier()` RLS function
- [ ] Add RLS policies for cashier-specific data access

---

## Debugging Common Issues

### Issue: Cashier can still see inventory

**Cause**: Menu items not updated in `allMenuItems`
**Fix**: Verify the `roles` array for inventory excludes CASHIER

### Issue: Toast not showing

**Cause**: Toast state not managed correctly
**Fix**: Check that `showAccessDeniedToast` state is set when redirect occurs

### Issue: Changes not taking effect

**Cause**: Browser cached old JS bundle
**Fix**: Hard refresh (Cmd+Shift+R) or clear localStorage

### Issue: Guard redirects to wrong view

**Cause**: Guard logic still targets 'dashboard'
**Fix**: Update line 84 to use 'pos' when redirecting CASHIER

---

## Code Patterns

### Menu Item Modification

```typescript
// Before
{ id: 'inventory', label: t.inventory, icon: ClipboardList, 
  roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.ROASTER, UserRole.CASHIER, UserRole.WAREHOUSE_STAFF] },

// After
{ id: 'inventory', label: t.inventory, icon: ClipboardList, 
  roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.ROASTER, UserRole.WAREHOUSE_STAFF] },
```

### Guard Modification

```typescript
// Before
useEffect(() => {
  if (isAuthenticated && user) {
    const isAllowed = allMenuItems.find(i => i.id === activeTab)?.roles.includes(user.role);
    if (!isAllowed) {
      setActiveTab('dashboard');
    }
  }
}, [activeTab, isAuthenticated, user]);

// After
useEffect(() => {
  if (isAuthenticated && user) {
    const isAllowed = allMenuItems.find(i => i.id === activeTab)?.roles.includes(user.role);
    if (!isAllowed) {
      setActiveTab(user.role === UserRole.CASHIER ? 'pos' : 'dashboard');
      setAccessDeniedToast(true); // Show toast
    }
  }
}, [activeTab, isAuthenticated, user]);
```

### Toast Component Usage

```tsx
{accessDeniedToast && (
  <AccessDeniedToast 
    message={t.accessRestricted}
    onClose={() => setAccessDeniedToast(false)}
  />
)}
```

---

## Rollback Plan

If issues arise, rollback is simple:

1. Revert menu item changes in `App.tsx`
2. Revert permission changes in `AuthContext.tsx`
3. Remove toast component if added

```bash
git revert HEAD~N  # where N is number of commits
```

---

## Success Metrics

After implementation, verify:

- [ ] CASHIER login lands on POS
- [ ] CASHIER cannot access restricted views
- [ ] Toast appears on unauthorized access attempt
- [ ] POS operations work normally for CASHIER
- [ ] Other roles (ADMIN, MANAGER, etc.) unaffected
- [ ] No console errors
- [ ] No TypeScript errors