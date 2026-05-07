# Research: Cashier POS-Only Access

**Feature Branch**: `003-cashier-role-restriction`
**Date**: 2026-03-30

---

## Research Questions

### Q1: How is role-based navigation currently implemented?

**Finding**: Navigation is controlled via `allMenuItems` array in `App.tsx` (lines 61-73). Each menu item has a `roles` array specifying which `UserRole` values can access it.

**Implementation**:
```typescript
const allMenuItems = [
  { id: 'dashboard', label: t.dashboard, icon: LayoutDashboard, 
    roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.HR, UserRole.ROASTER, UserRole.CASHIER, UserRole.WAREHOUSE_STAFF] },
  { id: 'pos', label: t.pos, icon: ShoppingCart, 
    roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER] },
  // ...
];

const menuItems = allMenuItems.filter(item => item.roles.includes(userRole));
```

**Guard Mechanism**: A useEffect hook (lines 79-87) monitors `activeTab` and resets to 'dashboard' if user role doesn't match the menu item's allowed roles.

**Gap Identified**: No toast notification when access is denied — just silent redirect.

---

### Q2: What permissions does CASHIER currently have?

**Finding**: `AuthContext.tsx` lines 53-54 define CASHIER permissions:

```typescript
case UserRole.CASHIER:
  return ['can_sell', 'can_view_reports'];
```

**Discrepancy Found**: CASHIER has `can_view_reports` permission, but the Reports menu item (line 67) does NOT include CASHIER in its roles array. This means the permission exists but the UI blocks access.

**Recommendation**: Remove `can_view_reports` from CASHIER permissions and replace with `can_view_own_stats` for limited reports access.

---

### Q3: What views does CASHIER currently access?

**Current Access** (from App.tsx menu roles):
| View | Access | Proposed |
|------|--------|----------|
| dashboard | ✅ | ❌ Remove |
| inventory | ✅ | ❌ Remove |
| pos | ✅ | ✅ Keep |
| crm | ✅ | ❌ Remove |
| configuration | ✅ | ⚠️ Partial (shift settings only) |
| reports | ❌ Hidden | ⚠️ Partial (via API for stats) |

---

### Q4: How are in-view permissions checked?

**Finding**: Views check permissions directly via `user?.role` comparison:

```typescript
// POSView.tsx line 782 - Reprint authorization
if (user?.role !== 'ADMIN' && user?.role !== 'MANAGER') {
  alert(t.reprintAuthRequired);
  return;
}

// POSView.tsx line 937 - Return approval
if (user?.role !== 'ADMIN' && user?.role !== 'MANAGER') {
  alert(t.notAuthorizedApproveReturns);
  return;
}
```

**Pattern**: Direct role comparison, not permission array checking. This is simpler but less flexible.

---

### Q5: What database-level security exists?

**Finding**: Supabase RLS policies use role-checking functions:

```sql
-- From enable_inventory_features.sql
CREATE OR REPLACE FUNCTION current_user_is_admin() RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'OWNER')
  );
END;
$$ LANGUAGE plpgsql STABLE;
```

**Existing Functions**:
- `current_user_is_admin()`
- `current_user_is_manager()`
- `current_user_is_warehouse_staff()`
- `current_user_is_roaster()`
- `current_user_can_access_location(location_id)`

**Gap**: No `current_user_is_cashier()` function exists but would be useful for POS-specific RLS policies.

---

### Q6: How does existing staff creation work?

**Finding**: `StaffView.tsx` uses react-hook-form + Zod for form handling, with direct Supabase inserts:

```typescript
// Line 1206-1285 pattern
const onSubmit = async (data: EmployeeFormValues) => {
  const payload = {
    first_name_en: data.first_name_en.trim(),
    phone: data.phone.trim(),
    email: data.email.trim(),
    role: data.role,
    // ...
    created_by: user?.id
  };
  
  if (editingEmployee) {
    await supabase.from('employees').update(payload).eq('id', editingEmployee.id);
  } else {
    await supabase.from('employees').insert([payload]);
  }
};
```

**Key Note**: No auth user creation — employees are separate from `profiles`/auth.users. RLS policies restrict insert/update to ADMIN and MANAGER only.

---

### Q7: How does the app handle default landing pages?

**Finding**: `App.tsx` lines 152-159:

```typescript
const handleLoginSuccess = (role: string) => {
  switch (role) {
    case UserRole.ADMIN:
    case UserRole.MANAGER:
    case UserRole.HR:
      setActiveTab('dashboard');
      break;
    case UserRole.ROASTER:
      setActiveTab('roasting');
      break;
    case UserRole.WAREHOUSE_STAFF:
      setActiveTab('inventory');
      break;
    default: // CASHIER and others
      setActiveTab('pos');
  }
};
```

**Current Behavior**: CASHIER already defaults to POS view on login. ✅ No change needed.

---

## Research Conclusions

### Decision 1: Menu Role Array Modification
**Chosen**: Direct modification of `allMenuItems` role arrays
**Alternatives Considered**:
- Creating separate menu for CASHIER — Rejected: More complexity, maintenance burden
- Permission-based filtering — Rejected: Current system uses role arrays, consistency

### Decision 2: Toast Notification Pattern
**Chosen**: New `AccessDeniedToast` component with 3-second auto-dismiss
**Alternatives Considered**:
- Using existing alert() — Rejected: Poor UX, not styled
- Modal dialog — Rejected: Too intrusive for access denial

### Decision 3: Reports Access
**Chosen**: Filter at view level, allow API access for personal stats
**Alternatives Considered**:
- Complete block — Rejected: Cashiers need to see their own sales statistics
- New reports view — Rejected: Unnecessary duplication

### Decision 4: RLS Function Addition
**Chosen**: Add `current_user_is_cashier()` function
**Alternatives Considered**:
- Use existing `role = 'CASHIER'` checks — Rejected: Consistency with other role functions

---

## Technical References

| Topic | File | Lines |
|-------|------|-------|
| Menu roles | App.tsx | 61-73 |
| Role guard | App.tsx | 79-87 |
| Tab change guard | App.tsx | 121-128 |
| Login redirect | App.tsx | 152-159 |
| Permission definitions | AuthContext.tsx | 43-60 |
| In-view permission checks | POSView.tsx | 782, 937, 1881 |
| RLS functions | enable_inventory_features.sql | 110-148 |
| Employee schema | enable_staff_management.sql | 27-84 |
| Employee creation | StaffView.tsx | 1206-1285 |