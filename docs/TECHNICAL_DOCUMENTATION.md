# Doha Roastery POS - Technical Documentation

**Last Updated:** April 2026  
**Tech Stack:** React 19 + TypeScript 5.8 + Supabase + Vite 6

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Project Structure](#2-project-structure)
3. [Views & Navigation](#3-views--navigation)
4. [Data Model (Types)](#4-data-model-types)
5. [Services Layer](#5-services-layer)
6. [Authentication & Authorization](#6-authentication--authorization)
7. [Database Schema](#7-database-schema)
8. [Role Permissions Matrix](#8-role-permissions-matrix)

---

## 1. Project Overview

**Doha Roastery POS** is a comprehensive Point of Sale and business management system for a coffee roastery with multiple branches.

### Key Features
- **POS Operations** - Sales, payments, receipts, returns
- **Inventory Management** - Stock tracking, transfers, purchase orders
- **Roasting Production** - Batch tracking, packaging, green bean management
- **Staff Management** - Employees, scheduling, time tracking, payroll
- **Customer Loyalty** - CRM with points system
- **Reports & Analytics** - Sales, financial, performance reports
- **AI Insights** - Demand forecasting, waste analysis

### Tech Stack
- **Frontend:** React 19.2.3, TypeScript 5.8.2
- **Backend:** Supabase (PostgreSQL)
- **Build:** Vite 6.4
- **Charts:** Recharts
- **AI:** Google Gemini

---

## 2. Project Structure

```
doha-roastery-pos-main/
├── views/                    # Main page components (14 views)
├── components/               # Shared components
│   ├── common/              # Common UI components
│   └── reports/            # Report-specific components
├── services/                # API service layer (5 services)
├── contexts/                # React contexts (Auth)
├── hooks/                   # Custom hooks
├── utils/                   # Utility functions
├── constants/               # Constants (zIndex)
├── migrations/              # Database migrations
├── specs/                   # Feature specifications
├── App.tsx                  # Main application (routing, layout)
├── index.tsx                # React entry point
├── index.html               # HTML entry with RTL support
├── types.ts                 # TypeScript type definitions
├── translations.ts          # i18n (Arabic/English)
├── supabaseClient.ts        # Supabase client config
└── vite.config.ts          # Vite configuration
```

**Note:** This project does NOT use a `src/` directory. All code is at root level.

### Entry Point Flow
```
index.html → index.tsx → App.tsx → [Views based on auth/route]
```

---

## 3. Views & Navigation

### View Files (in `/views/`)

| View | File | Purpose | Roles |
|------|------|---------|-------|
| Login | `LoginView.tsx` | User authentication | Public |
| Dashboard | `DashboardView.tsx` | Overview with stats | ADMIN, MANAGER, HR, ROASTER, WAREHOUSE_STAFF |
| POS | `POSView.tsx` | Point of Sale | ADMIN, MANAGER, CASHIER |
| CRM | `CRMView.tsx` | Customer management | ADMIN, MANAGER, CASHIER |
| Reports | `ReportsView.tsx` | Business reports | ADMIN, MANAGER, HR, CASHIER |
| Inventory | `InventoryView.tsx` | Stock management | ADMIN, MANAGER, ROASTER, WAREHOUSE_STAFF |
| Roasting | `RoastingView.tsx` | Production management | ADMIN, MANAGER, ROASTER |
| Staff | `StaffView.tsx` | HR management | ADMIN, MANAGER, HR |
| Configuration | `ConfigurationView.tsx` | System settings | ADMIN, MANAGER, ROASTER, WAREHOUSE_STAFF |
| Branch Performance | `BranchPerformanceView.tsx` | Location KPIs | ADMIN, MANAGER |
| Branch Financials | `BranchFinancialsView.tsx` | Revenue analysis | ADMIN, MANAGER |
| AI Insights | `AIInsights.tsx` | AI analytics | ADMIN, MANAGER |
| Profile | `ProfileView.tsx` | User profile | ALL ROLES |

### Navigation Flow (App.tsx)

```typescript
App.tsx manages:
1. Authentication state (AuthContext)
2. Active view/tab state
3. Menu filtering by role
4. Language (Arabic/English)
5. Theme (light mode)
```

**Default Tab by Role:**
- CASHIER → POS
- Others → Dashboard

---

## 4. Data Model (Types)

**File:** `/types.ts` (638 lines, comprehensive)

### Core Enums

```typescript
// User Roles
enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  HR = 'HR',
  ROASTER = 'ROASTER',
  CASHIER = 'CASHIER',
  WAREHOUSE_STAFF = 'WAREHOUSE_STAFF'
}

// Payment Methods
type PaymentMethod = 'CASH' | 'CARD' | 'MOBILE' | 'SPLIT';

// Product Types
type ProductType = 'PACKAGED_COFFEE' | 'BEVERAGE' | 'INGREDIENT' | 'ACCESSORY' | 'RAW_MATERIAL';

// Batch Status
enum BatchStatus {
  PREPARATION = 'Preparation',
  ROASTING = 'Roasting',
  COOLING = 'Cooling',
  INSPECTION = 'Inspection',
  PACKAGING = 'Packaging',
  COMPLETED = 'Completed',
  REJECTED = 'QC Rejected',
  DELETED = 'DELETED'
}
```

### Core Interfaces

```typescript
// User (authentication)
interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  permissions: string[];
  avatar?: string;
  location_id?: string;
}

// Transaction (POS sale)
interface Transaction {
  id: string;
  items: CartItem[];
  total: number;
  subtotal?: number;
  vat_amount?: number;
  payment_method: PaymentMethod;
  payment_breakdown?: PaymentBreakdown;
  cashier_name?: string;
  customer_id?: string;
  created_at: string;
}

// Customer (CRM)
interface Customer {
  id: string;
  full_name: string;
  phone: string;
  email?: string;
  loyalty_points: number;
  total_spent: number;
  last_visit_date?: string;
  notes?: string;
  is_active: boolean;
  last_edited_by_name?: string;
}

// Shift (POS)
interface Shift {
  id: string;
  cashier_id: string;
  cashier_name: string;
  start_time: string;
  end_time?: string;
  initial_cash: number;
  total_cash_sales: number;
  status: 'OPEN' | 'CLOSED';
}

// Inventory Item
interface InventoryItem {
  id: string;
  name: string;
  type: ProductType;
  price: number;
  stock: number;
  location_id?: string;
  productId?: string;
}

// Employee
interface Employee {
  id: string;
  employee_id: string; // DR-XXXX
  first_name_en: string;
  last_name_en: string;
  role: UserRole;
  employment_status: EmploymentStatus;
  hire_date: string;
  salary_base?: number;
  location_id?: string;
}
```

---

## 5. Services Layer

**Directory:** `/services/`

### Service Files

| Service | File | Purpose |
|---------|------|---------|
| CRM | `crmService.ts` | Customer CRUD, loyalty tracking |
| Inventory | `inventoryService.ts` | Green bean inventory, reservations |
| Beverage | `beverageService.ts` | Cost calculations (no DB) |
| Shift | `shiftService.ts` | Shift management, cash reconciliation |
| Gemini | `geminiService.ts` | AI insights API |

### CRM Service Methods

```typescript
crmService = {
  getCustomers(page, limit, searchQuery)  // Paginated list
  createCustomer(customerData)            // INSERT
  updateCustomer(id, data, editedByName)  // UPDATE
  deleteCustomer(id)                      // SOFT DELETE (is_active = false)
  getCustomerByPhone(phone)              // Lookup by phone
}
```

### Shift Service Methods

```typescript
shiftService = {
  getOpenShift(userId)                    // Find open shift
  startShift(userId, userName, initialCash) // Open shift
  closeShift(shiftId, actualCash, ...)   // Close shift
  addCashMovement(shiftId, type, amount, reason, ...) // Petty cash
  getShiftTotals(shift)                  // Calculate expected cash
}
```

### Supabase Client

```typescript
// supabaseClient.ts
createClient(
  'https://lweiutdbssdjltphimyo.supabase.co',
  'eyJhbGci...' // Anonymous key
)
```

---

## 6. Authentication & Authorization

**Files:** 
- `/contexts/AuthContext.tsx`
- `/hooks/useRoleGuard.ts`
- `/constants/zIndex.ts`

### Login Flow

```
1. User opens app → App.tsx checks isAuthenticated
2. If false → Shows LoginView
3. User enters credentials
4. AuthContext.login() calls supabase.auth.signInWithPassword()
5. On success → updateAuthStateFromSession() fetches profile
6. Profile.role determines menu items and default tab
```

### Role Check Logic

```typescript
// In App.tsx
const userRole = user?.role || 'CASHIER';
const menuItems = allMenuItems.filter(item => item.roles.includes(userRole));
```

### Role Guard Hook

```typescript
// useRoleGuard.ts
const { isAllowed, denyAccess } = useRoleGuard([UserRole.ADMIN, UserRole.MANAGER]);

if (!isAllowed) {
  denyAccess('Access denied message');
}
```

### Permission System

```typescript
getPermissionsForRole(role) returns string[]:
- ADMIN: ['can_delete', 'can_edit_stock', 'can_roast', ...]
- CASHIER: ['can_sell', 'can_view_own_stats', 'can_manage_shift']
```

---

## 7. Database Schema

**Migrations:** `/migrations/`

### Core Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `transactions` | POS sales | id, items (JSONB), total, cashier_name, payment_method |
| `customers` | CRM | id, full_name, phone, loyalty_points, total_spent |
| `shifts` | Cash tracking | id, cashier_id, initial_cash, status |
| `cash_movements` | Petty cash | id, shift_id, type (IN/OUT), amount |
| `profiles` | User accounts | id, role, full_name (FK to auth.users) |

### Staff Tables

| Table | Purpose |
|-------|---------|
| `employees` | Employee records (DR-XXXX ID) |
| `locations` | Branches, warehouses, roastery |
| `employee_time_logs` | Clock in/out |
| `employee_weekly_schedules` | Recurring schedules |
| `payroll_history` | Processed payroll |
| `performance_reviews` | Employee reviews |

### Inventory Tables

| Table | Purpose |
|-------|---------|
| `product_definitions` | Product catalog |
| `inventory_items` | Stock at locations |
| `stock_transfers` | Inter-branch transfers |
| `purchase_orders` | Supplier orders |
| `green_beans` | Green coffee inventory |

### RLS Helper Functions

```sql
current_user_is_cashier()      -- Returns true if role = 'CASHIER'
current_user_is_admin()       -- Returns true if role IN ('ADMIN', 'OWNER')
current_user_is_manager()      -- Returns true if role = 'MANAGER'
current_user_can_access_location(p_location_id) -- Location-based access
```

### Cashier RLS Policies

```sql
-- transactions: Cashiers can only SELECT their own (by cashier_name)
CREATE POLICY "cashier_select_own_transactions" ON transactions
  FOR SELECT USING (cashier_name = (SELECT full_name FROM profiles WHERE id = auth.uid()));

-- shifts: Cashiers can only access their own shifts
CREATE POLICY "cashier_select_own_shifts" ON shifts
  FOR SELECT USING (cashier_id = auth.uid());

-- profiles: Cashiers can UPDATE only their own profile
CREATE POLICY "cashier_update_own_profile" ON profiles
  FOR UPDATE USING (id = auth.uid());
```

---

## 8. Role Permissions Matrix

| Feature | ADMIN | MANAGER | HR | CASHIER | ROASTER | WAREHOUSE |
|---------|-------|---------|-----|---------|---------|-----------|
| Dashboard | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| POS | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| CRM | ✅ | ✅ | ❌ | ✅ (edit only) | ❌ | ❌ |
| Reports | ✅ | ✅ | ✅ | ✅ (own stats) | ❌ | ❌ |
| Staff | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Roasting | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Inventory | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| Configuration | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| AI Insights | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Profile | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Quick Reference

### Adding a New View
1. Create file in `/views/`
2. Add to `allMenuItems` in App.tsx with roles array
3. Add route handling in App.tsx

### Adding a Service
1. Create file in `/services/`
2. Import `supabaseClient`
3. Export named object with async methods

### Adding Database Table
1. Create migration in `/migrations/`
2. Add types to `/types.ts`
3. Create service methods in `/services/`

### Role Check Flow
```typescript
// Frontend (UI filtering)
const menuItems = allMenuItems.filter(item => item.roles.includes(userRole));

// Component-level guard
const { isAllowed } = useRoleGuard([UserRole.ADMIN]);
if (!isAllowed) return <AccessDenied />;

// Backend (RLS)
CREATE POLICY "cashier_select_own" ON table FOR SELECT USING (condition);
```

---

## File Index

| File | Lines | Purpose |
|------|-------|---------|
| `/App.tsx` | 428 | Main app, routing, auth |
| `/types.ts` | 638 | All TypeScript interfaces |
| `/translations.ts` | 2200+ | Arabic/English strings |
| `/views/POSView.tsx` | 2500+ | POS operations |
| `/views/StaffView.tsx` | 3000+ | HR management |
| `/views/InventoryView.tsx` | 2500+ | Inventory management |
| `/views/ConfigurationView.tsx` | 4000+ | System configuration |
| `/views/StaffView.tsx` | 3000+ | Employee management |

---

*Documentation generated: April 2026*
