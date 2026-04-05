# Doha Roastery POS - Comprehensive Scalability & Architecture Analysis Report

**Generated:** March 19, 2026  
**Project:** Doha Roastery Management System  
**Type:** Point of Sale (POS) + Inventory Management + HR System  
**Tech Stack:** React 19, TypeScript, Vite, Supabase (PostgreSQL), Tailwind CSS

---

## Executive Summary

This report provides a comprehensive analysis of the Doha Roastery POS system, examining its architecture, code organization, scalability potential, and areas requiring attention. The system is a feature-rich application handling **point-of-sale operations**, **inventory management**, **roasting production**, **HR/payroll**, and **branch management**.

### Critical Findings at a Glance

| Category | Severity | Count | Impact |
|----------|----------|-------|--------|
| Monolithic Components (4000+ lines) | CRITICAL | 4 | Maintainability, Performance |
| State Management Issues | HIGH | 25+ | Re-render Performance |
| Missing Pagination | HIGH | 15+ | Data Scalability |
| Missing Error Boundaries | MEDIUM | 12 views | Crash Recovery |
| Missing Code Splitting | MEDIUM | All views | Initial Load Time |
| Fake Production Data | MEDIUM | 3 views | Data Integrity |
| Security Gaps | MEDIUM | 3 | Authorization |
| Code Duplication | LOW | 50+ | Maintainability |

---

## 1. Project Structure Overview

### 1.1 Current File Organization

```
doha-roastery-pos-main/
├── App.tsx                    (674 lines) - Root component with routing
├── index.tsx                 (15 lines)  - Entry point
├── types.ts                  (560 lines) - TypeScript interfaces
├── supabaseClient.ts         (7 lines)   - Database client
├── translations.ts           (2280 lines) - i18n translations
├── vite.config.ts            (23 lines)  - Build configuration
├── tsconfig.json             (25 lines)  - TypeScript configuration
├── contexts/
│   └── AuthContext.tsx       (257 lines) - Authentication state
├── services/
│   ├── inventoryService.ts   (130 lines) - Inventory operations
│   ├── crmService.ts         (80 lines)  - Customer operations
│   ├── beverageService.ts    (55 lines)  - Cost calculations
│   ├── shiftService.ts       (120 lines) - Shift management
│   └── geminiService.ts       (65 lines)  - AI integration
├── utils/
│   └── reportExport.ts       (85 lines)  - Export utilities
└── views/                    (19,704 lines total)
    ├── StaffView.tsx          (4,937 lines) - CRITICAL SIZE
    ├── InventoryView.tsx      (3,297 lines) - CRITICAL SIZE
    ├── ConfigurationView.tsx (3,271 lines) - CRITICAL SIZE
    ├── POSView.tsx           (2,543 lines) - CRITICAL SIZE
    ├── RoastingView.tsx      (794 lines)
    ├── ReportsView.tsx       (723 lines)
    ├── AIInsights.tsx        (526 lines)
    ├── CRMView.tsx           (447 lines)
    ├── BranchPerformanceView.tsx (342 lines)
    ├── BranchFinancialsView.tsx (342 lines)
    ├── DashboardView.tsx     (266 lines)
    └── LoginView.tsx         (216 lines)
```

### 1.2 Directory Structure Assessment

| Directory | Purpose | Issues |
|-----------|---------|--------|
| `/views` | All UI components | **Single-level structure creates flat architecture** |
| `/services` | API/Data operations | **Incomplete coverage** - many views bypass services |
| `/contexts` | React contexts | **Only Auth context** - missing state management |
| `/types` | TypeScript types | **Missing type organization** |
| MISSING: `/hooks` | Custom React hooks | **No custom hooks extracted** |
| MISSING: `/components` | Reusable UI components | **No shared components** |
| MISSING: `/utils` (expanded) | Utility functions | **Minimal utilities** |
| MISSING: `/constants` | App constants | **Constants inline in components** |

**Key Finding:** The project lacks a proper separation between **presentation**, **business logic**, and **data access layers**. Concerns are mixed throughout components rather than being isolated.

---

## 2. Critical Structural Weaknesses

### 2.1 Monolithic Components

Four view files constitute **71% of all frontend code** (14,048 lines in 4 files):

#### StaffView.tsx (4,937 lines) - Most Critical

```
Lines: 4,937
useState hooks: 93
useEffect hooks: 18
useMemo hooks: 20
Sub-components extracted: NONE
```

**Problems:**
- Contains 5 major feature areas in one file: Overview, Schedule, Payroll, Performance, Branch Staffing
- 93 state variables cause re-renders across unrelated features
- 18 useEffect hooks create cascading dependency chains
- Complex business logic (overtime calculation, payroll, shift swaps) is embedded in UI handlers
- Zero component decomposition makes testing impossible

**Specific Issues:**
- `fetchData` (line 1062) fires 5+ parallel Supabase queries on mount
- 60-second polling interval creates continuous database load
- Employee time log overlap prevention is computed client-side
- Payroll calculation with deductions is a 200+ line inline function

#### InventoryView.tsx (3,297 lines) - Critical

```
Lines: 3,297
useState hooks: 59
useEffect hooks: 3
useMemo hooks: 13
Sub-components extracted: NONE
```

**Problems:**
- 6 tabs in single component: locations, packaged inventory, transfers, adjustments, purchases, count tasks
- `fetchData` at line 1179 fires 9 parallel queries without pagination
- Realtime subscription for stock transfers (line 1236) - properly cleaned up but runs per-component
- Complex nested form objects with 25+ fields (`locationForm`)

**Code Smell Example:**
```tsx
// Lines 437-450: O(n*m) complexity in render
const filteredCountEntries = countEntries?.filter(entry => {
  const product = packagedItems?.find(p => p.id === entry.product_id);
  const location = locations?.find(l => l.id === entry.location_id);
  // ... more filtering
});
```

#### ConfigurationView.tsx (3,271 lines) - Critical

```
Lines: 3,297
useState hooks: 45
useEffect hooks: 2
Embedded SQL: 800+ lines (lines 530-1330)
```

**Problems:**
- **800+ lines of SQL migration script embedded as a JavaScript string** - should be a separate migration file
- 7 sub-tabs all eagerly loaded
- `checkSchemaIntegrity` function makes N sequential queries (one per column of interest) to test column existence
- Mixes UI concerns with database migration concerns

**Critical Anti-Pattern:**
```tsx
const sqlFixScript = `
  -- 800 lines of SQL
  ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS...
  CREATE TABLE IF NOT EXISTS...
  -- This should be a database migration, not UI code
`;
```

#### POSView.tsx (2,543 lines) - Critical

```
Lines: 2,543
useState hooks: 53
useEffect hooks: 5
```

**Problems:**
- Handles: POS sales, transaction history, returns processing, shift management, cash management, receipt printing
- `handleCheckout` function spans 150+ lines performing:
  - Invoice number generation
  - Transaction insertion
  - Inventory deduction with BOM traversal
  - RPC calls for inventory operations
  - Loyalty point updates
  - Receipt printing trigger
- Cart state uses simple `useState` instead of useReducer for complex operations

**Performance Issue:**
```tsx
// Line 1074-1109: Print CSS injected on every render
<style>
  {`@media print { ... }`}
</style>
```

### 2.2 Missing Architectural Layers

| Layer | Current State | Expected State |
|-------|---------------|----------------|
| **Data Access** | Direct Supabase calls in components | Repository pattern with centralized API |
| **Business Logic** | Inline in event handlers | Service layer with pure functions |
| **State Management** | Component useState | Context + Hooks or state library |
| **Validation** | Ad-hoc in components | Zod schemas in separate layer |
| **Error Handling** | Try-catch + alert() | Error boundary + toast system |
| **Code Splitting** | None (eager loading) | Route-based lazy loading |

### 2.3 State Management Anti-Patterns

#### Excessive useState Hooks

| Component | useState Count | Recommended | Issue |
|-----------|---------------|-------------|-------|
| StaffView | 93 | 5-10 | Every keystroke re-renders 4937 lines |
| InventoryView | 59 | 5-10 | Form state explosion |
| POSView | 53 | 5-15 | Cart + payment state complexity |
| ConfigurationView | 45 | 10-20 | Settings + form state |

#### Missing useReducer for Complex State

Cart state in POSView should use useReducer:
```tsx
// Current: Multiple useState for cart
const [cart, setCart] = useState<CartItem[]>([]);
const [customizations, setCustomizations] = useState<...>({});
const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
// ... 50 more state variables

// Should be:
const [state, dispatch] = useReducer(cartReducer, initialState);
```

#### Context Pollution

Only one context exists (`AuthContext`) but many concerns need global state:
- Cart state (for POS and returns)
- Location state (used in 8+ views)
- Notification/Toast state
- Theme state (currently hardcoded to 'light')

---

## 3. Data Layer Analysis

### 3.1 Services Layer Assessment

The services directory contains only 5 files totaling ~450 lines:

| Service | Lines | Purpose | Coverage |
|---------|-------|---------|----------|
| inventoryService.ts | 130 | Green bean inventory CRUD | Partial |
| crmService.ts | 80 | Customer CRUD | Complete |
| beverageService.ts | 55 | Cost calculations | Helper only |
| shiftService.ts | 120 | Shift management | Partial |
| geminiService.ts | 65 | AI insights | Complete |

**Problem:** Most views **bypass the services layer entirely** and call Supabase directly:

```tsx
// InventoryView.tsx line 1179
const { data: locations } = await supabase.from('locations').select('*');
const { data: products } = await supabase.from('product_definitions').select('*');
// ... 7 more direct calls
```

**Should be:**
```tsx
// services/locationService.ts
export const locationService = {
  getAll: () => supabase.from('locations').select('*'),
  getById: (id: string) => supabase.from('locations').select('*').eq('id', id).single(),
  // ... with proper typing and error handling
};
```

### 3.2 Database Query Patterns

#### No Pagination

Every data fetch uses `select('*')` without pagination:

```tsx
// CRMView.tsx - fetches ALL customers
const { data, count } = await supabase
  .from('customers')
  .select('*', { count: 'exact' })
  .eq('is_active', true)
  .order('created_at', { ascending: false })
  .range(from, to); // Only this view uses range
```

**InventoryView loads unbounded data:**
```tsx
// Line 1179-1210: No limits!
const [locationsResult, productsResult, transfersResult, ...] = await Promise.all([
  supabase.from('locations').select('*'),
  supabase.from('product_definitions').select('*'),
  supabase.from('stock_transfers').select('*'),
  // ... 6 more unlimited queries
]);
```

#### N+1 Query Pattern

Location lookups happen via `.find()` in loops:
```tsx
// BranchPerformanceView.tsx - O(n) find in loop
const location = locations?.find(l => l.id === item.location_id);
```

#### Missing Query Optimization

```tsx
// ReportsView.tsx - Fetching everything then grouping client-side
const { data: tx30 } = await supabase.from('transactions').select('*').gte('created_at', thirtyDaysAgo);
// Then groups by day in JavaScript
```

Should use database aggregation:
```sql
SELECT DATE(created_at), SUM(total), COUNT(*)
FROM transactions
WHERE created_at >= $1
GROUP BY DATE(created_at)
```

### 3.3 Supabase Client Configuration

**Security Issue in supabaseClient.ts:**
```tsx
const supabaseUrl = 'https://lweiutdbssdjltphimyo.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
// Anon key is hardcoded - should be environment variable
```

**Better approach:**
```tsx
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
```

### 3.4 Realtime Subscriptions

Only one view uses realtime subscriptions (InventoryView for stock_transfers):

```tsx
// Line 1236 - Proper cleanup exists but subscription runs per component instance
useEffect(() => {
  const channel = supabase.channel('stock_transfers_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_transfers' }, 
      () => fetchData())
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}, []);
```

**Problems:**
1. Realtime refetches ALL data on any change - should fetch only delta
2. No debouncing - rapid changes cause cascade of full data reloads
3. No other views use realtime despite having similar needs (transactions, orders)

---

## 4. Scalability Concerns

### 4.1 Data Volume Growth Projections

Assuming 3 years of operation:

| Data Type | Current Fetch | 3-Year Volume | Impact |
|-----------|--------------|---------------|--------|
| Transactions | 100 records | ~500,000 records | View will timeout |
| Inventory Items | Unlimited | ~10,000 items | 5+ second load time |
| Employees | Unlimited | ~200 employees | Manageable |
| Inventory Movements | Unlimited | ~2,000,000 records | Critical failure |
| Green Bean Batches | Unlimited | ~5,000 records | Slow loads |
| Time Logs | Unlimited | ~150,000 records | Critical failure |

### 4.2 Performance Bottlenecks Identified

#### Client-Side Computation

**AIInsights.tsx performs heavy analytics in browser:**
```tsx
// Lines 200-250: Computing statistics client-side
const computeForecastNext7Days = (transactions: Transaction[]) => {
  // Series of .reduce(), .map(), .filter() operations
  // on 30 days of transaction data
  // Should be server-side with database aggregation
};

const computeWasteInsights = (batches: RoastingBatch[]) => {
  // Statistical computation on all batches
  // No memoization, runs on every state change
};
```

**BranchPerformanceView uses fake data:**
```tsx
// Line 89
const growth = Math.random() * 30 - 10; // Random number in production code!
```

**BranchFinancials uses fake data:**
```tsx
// Lines 82-93
const expenses = [ // Hardcoded percentages!
  { name: 'Labor', amount: revenueThisMonth * 0.15 },
  { name: 'Rent', amount: revenueThisMonth * 0.08 },
  // ... not real data
];
```

#### Memory Consumption

Large state objects held in component memory:
- StaffView: All employees, all time logs, all schedules, all payroll data
- InventoryView: All locations, all products, all transfers, all adjustments
- POSView: All inventory items, last 100 transactions, customer list

#### Network Bandwidth

Each tab switch triggers full data refetch:
```tsx
// InventoryView.tsx
useEffect(() => {
  if (activeTab === 'transfers') fetchData();
  if (activeTab === 'adjustments') fetchData();
  // No caching, always fresh network request
}, [activeTab]);
```

### 4.3 Concurrency Issues

#### Race Conditions in Inventory Deduction

```tsx
// POSView.tsx line 516-560
// Fallback path makes N sequential UPDATE queries when RPC unavailable
for (const item of itemsToDeduct) {
  await supabase.from('inventory_items')
    .update({ stock: newStock })
    .eq('id', item.id);
  // Between these updates, another client could modify same item
}
```

**Database has atomic operations but view uses fallback:**
```tsx
if (rpcError) {
  // Fallback to manual deduction - NOT ATOMIC
  await applyInventoryDeductions(newTransaction.items, selectedLocation.id);
}
```

#### No Optimistic Locking

When two cashiers process sales simultaneously for same inventory:
1. Both read quantity X
2. Both compute X - quantity_n
3. Both write new quantity
4. Result: stock mismatch

### 4.4 Missing Indexes

From database schema analysis:

**Tables without proper indexes for common queries:**
- `employee_audit_logs`: No index on `employee_id` or `changed_at`
- `cash_movements`: No index on `shift_id`
- `green_bean_movements`: No index on `bean_id`, `batch_reference`, or `movement_at`

**Views with expensive operations:**
- `branch_coverage_status`: Uses `jsonb_array_elements` in CTE joins
- `network_stock_visibility`: Complex CTEs without materialization

---

## 5. Code Quality Issues

### 5.1 Code Duplication Analysis

#### Duplicated Pattern: Loading State Management

Found 50+ instances of:
```tsx
setIsSaving(true);
try {
  await supabase.from('table').insert(data);
  setSuccess(true);
} catch (err) {
  console.error(err);
  setError(err.message);
} finally {
  setIsSaving(false);
}
```

**Should be extracted:**
```tsx
// hooks/useAsyncOperation.ts
const useAsyncOperation = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const execute = async <T>(operation: () => Promise<T>): Promise<T | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await operation();
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    } finally {
      setLoading(false);
    }
  };
  
  return { loading, error, execute };
};
```

#### Duplicated Pattern: Success Toast

```tsx
// Appears in 8+ files
setSuccess(true);
setTimeout(() => setSuccess(false), 3000);
// Memory leak: setTimeout never cleared on unmount
```

#### Duplicated Pattern: Location Lookup

```tsx
// Appears in 6+ files
const locationName = locations?.find(l => l.id === item.location_id)?.name || 'Unknown';
// Should be a utility function or useMemo
```

#### Duplicated Pattern: Card Styling

```tsx
// Same Tailwind classes repeated 50+ times
className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100"
// Should be a <Card> component
```

### 5.2 Missing Reusable Components

| Pattern | Current Implementation | Should Be |
|---------|------------------------|-----------|
| Card | Duplicated Tailwind classes | `<Card>` component |
| Modal | Inline JSX in each view | `<Modal>` component |
| DataTable | Inline table HTML | `<DataTable>` component |
| FormField | Inline label + input | `<FormField>` component |
| Toast/Alert | setTimeout pattern | `<Toast>` with auto-dismiss |
| LoadingSpinner | Duplicated in multiple views | `<LoadingSpinner>` component |
| Empty State | Repeated text patterns | `<EmptyState>` component |
| Badge | Inline status badges | `<Badge>` component |
| DateDisplay | Inline date formatting | `<DateDisplay>` component |
| CurrencyDisplay | Inline number formatting | `<Currency>` component |

### 5.3 Type Safety Issues

#### Inconsistent Type Definitions

```tsx
// types.ts has comprehensive types but views use inline types:
const [formData, setFormData] = useState<Partial<Employee>>({});
// vs
const [localData, setLocalData] = useState<any>({}); // Lost type safety
```

#### Type Assertion Overuse

```tsx
// Many instances of 'as any' or type assertions
const { data } = await supabase.from('table').select('*');
return data as Employee[]; // Assumes success, losing error handling
```

#### Service Return Types

Services don't export proper return types:
```tsx
export const crmService = {
  async getCustomers(): Promise<{ data: Customer[]; count: number }> {
    // No error type in return
  }
};
```

### 5.4 Error Handling

#### Console-Only Error Logging

```tsx
// Pattern used throughout:
} catch (error) {
  console.error('Error fetching:', error);
  // User never sees the error
}
```

#### No Error Boundary

The application has zero error boundaries. A single component crash unmounts the entire application:

```tsx
// Should wrap each view:
<ErrorBoundary fallback={<ErrorView onRetry={refetch} />}>
  <StaffView />
</ErrorBoundary>
```

#### Silent Failures

```tsx
// ConfigurationView.tsx line 226
} catch (e) {
  console.warn('Failed to fetch, falling back to legacy:', e);
  // Continues silently, user doesn't know data may be incomplete
}
```

### 5.5 Accessibility Issues

- Missing ARIA labels on icon-only buttons
- No focus management in modals
- No keyboard navigation for custom dropdowns
- RTL support exists but skips some components
- No skip links for keyboard users
- Missing form field descriptions for screen readers

---

## 6. Security Analysis

### 6.1 Authentication Flow

**AuthContext.tsx Analysis:**

```tsx
// Proper session management exists
const { data: { subscription } } = supabase.auth.onAuthStateChange(...);
// Session refresh handled
const refreshSession = async () => { ... };
```

**Issues:**
1. Demo mode code is disabled but still in codebase
2. Role stored in profiles table - could be manipulated without RLS
3. Permissions array fetched but not validated server-side

### 6.2 Authorization

**Row Level Security exists in database (from SQL files):**
```sql
CREATE POLICY "Admins can manage all employees"
  ON employees FOR ALL
  USING (current_user_is_admin());
```

**But frontend doesn't check permissions consistently:**
```tsx
// App.tsx uses role-based menu filtering
const menuItems = allMenuItems.filter(item => item.roles.includes(userRole));
// Server-side enforcement exists, but UX could mislead users
```

### 6.3 Input Validation

**React Hook Form + Zod used in LoginView:**
```tsx
const schema = useMemo(() => z.object({
  identifier: z.string().min(1, t.usernameRequired),
  password: z.string().min(8, t.passwordMinLength),
}), [t]);
```

**But inconsistent across application:**
- Many forms lack validation
- No server-side validation schema sync
- No rate limiting on auth endpoints

### 6.4 Sensitive Data

**API Key Hardcoded:**
```tsx
// geminiService.ts
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });
// Process.env in browser - could be logged or leaked
```

**Environment file tracked:**
```gitignore
# .env is NOT in gitignore, could be committed
GEMINI_API_KEY=YOUR_API_KEY_HERE
```

### 6.5 Missing Security Headers

No Content Security Policy defined. Consider adding:
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
```

---

## 7. Performance Optimization Opportunities

### 7.1 Bundle Size

Current setup uses global Tailwind from CDN:
```html
<script src="https://cdn.tailwindcss.com"></script>
```

**Problems:**
- Full Tailwind library loads on every page (~200KB)
- No tree-shaking possible
- CDN dependency for core functionality

**Recommendation:**
```bash
npm install tailwindcss @tailwindcss/forms
# Configure purging for production
```

### 7.2 Code Splitting

No lazy loading implemented:
```tsx
// Current: All views imported eagerly
import DashboardView from './views/DashboardView';
import StaffView from './views/StaffView';
// ...

// Should be:
const DashboardView = lazy(() => import('./views/DashboardView'));
const StaffView = lazy(() => import('./views/StaffView'));
```

**Estimated impact:**
- View bundle sizes: StaffView ~200KB, InventoryView ~150KB
- Initial load could be reduced by 60%+ with route-based splitting

### 7.3 React Optimization

#### Missing Memoization

| Component | Heavy Computation | Memoized? |
|-----------|------------------|-----------|
| StaffView | Payroll calculation | No |
| InventoryView | Product location summary | Partial |
| ReportsView | All report data | No |
| AIInsights | Forecast computation | No |
| POSView | Cart total | No |

#### Function Recreation

```tsx
// Every view has this pattern:
const handleSave = async () => { ... }
// Not wrapped in useCallback, causes child re-renders
```

#### Large Inline JSX

StaffView has render functions embedded in component:
```tsx
// Lines 2000-4500: JSX for 5 tabs all inline
// Should be separate components:
const OverviewTab = () => { ... };
const ScheduleTab = () => { ... };
```

### 7.4 Database Optimization

#### Missing Indexes

```sql
-- Should be added:
CREATE INDEX idx_employee_time_logs_employee ON employee_time_logs(employee_id);
CREATE INDEX idx_employee_time_logs_clock_in ON employee_time_logs(clock_in_at);
CREATE INDEX idx_cash_movements_shift ON cash_movements(shift_id);
CREATE INDEX idx_inventory_movements_created ON inventory_movements(created_at);
CREATE INDEX idx_transactions_created ON transactions(created_at);
```

#### Query Batching

Replace multiple sequential queries:
```tsx
// Current: Sequential
const { data: employees } = await supabase.from('employees').select('*');
const { data: locations } = await supabase.from('locations').select('*');
const { data: schedules } = await supabase.from('schedules').select('*');

// Better: Parallel
const [employees, locations, schedules] = await Promise.all([
  supabase.from('employees').select('*'),
  supabase.from('locations').select('*'),
  supabase.from('schedules').select('*')
]);
```

### 7.5 Caching Strategy

**No caching implemented:**
- Every tab switch re-fetches all data
- No React Query/SWR for query caching
- No local storage caching for user preferences

**Recommended additions:**
```tsx
// Install React Query
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const { data: inventory } = useQuery({
  queryKey: ['inventory', locationId],
  queryFn: () => inventoryService.getAll(locationId),
  staleTime: 5 * 60 * 1000, // 5 minutes
});
```

---

## 8. Maintenance Concerns

### 8.1 Technical Debt

| Issue | Count | Priority |
|-------|-------|----------|
| TODO/FIXME comments | 0 found | - |
| Console.log statements | 15+ | Low |
| Any type usage | 20+ | Medium |
| Hardcoded strings (Arabic) | 500+ | Low |
| Inline SQL | 800+ lines | High |
| Fake data in production | 3 instances | High |

### 8.2 Dependency Management

**package.json dependencies:**
```json
{
  "dependencies": {
    "@google/genai": "^1.37.0",
    "@hookform/resolvers": "^5.2.2",
    "@supabase/supabase-js": "^2.45.0",
    "lucide-react": "^0.562.0",
    "react": "^19.2.3",
    "react-dom": "^19.2.3",
    "react-hook-form": "^7.54.0",
    "recharts": "^3.6.0",
    "zod": "^3.24.0"
  }
}
```

**Observations:**
- React 19.2.3 - Very recent version, good
- No state management library (Redux, Zustand, Jotai)
- No UI component library (Headless UI, Radix)
- No testing framework (Jest, Vitest)
- No linting configuration (ESLint)
- No formatting configuration (Prettier)
- Uses CDN Tailwind instead of npm package

### 8.3 Testing Coverage

**No test files found:**
- No unit tests
- No integration tests
- No end-to-end tests
- No test configuration files

**Critical areas requiring tests:**
1. POS checkout flow
2. Inventory deduction logic
3. Payroll calculation
4. Authentication flow
5. CRUD operations in all services

### 8.4 Documentation

**Existing documentation:**
- README.md (basic)
- ALL_FEATURES_IN_SYSTEM.md
- CODE_ANALYSIS.md
- DEEP_TECHNICAL_DOCUMENTATION.md
- FULL_FEATURES_DOCUMENTATION.md
- SYSTEM_DOCUMENTATION.md

**Missing:**
- API documentation
- Component prop documentation
- State management guidelines
- Development setup guide
- Deployment guide

---

## 9. Detailed File-by-File Analysis

### 9.1 App.tsx (674 lines)

**Purpose:** Root component with routing context providers

**Structure:**
```tsx
- LanguageContext (language state, translations)
- ThemeContext (hardcoded to 'light', toggle does nothing)
- AuthProvider (authentication state)
- AppContent (routing logic)
```

**Issues:**
1. **Theme context hardcoded:**
   ```tsx
   const theme = 'light';
   const toggleTheme = () => {}; // Empty function!
   ```
   Theme toggle UX exists but doesn't work.

2. **Session warning threshold:**
   ```tsx
   const WARNING_THRESHOLD = 5 * 60 * 1000; // 5 minutes
   // Hardcoded, should be configurable
   ```

3. **Breadcrumb state complexity:**
   ```tsx
   const [activeDetailId, setActiveDetailId] = useState<string | null>(null);
   // Tracks "drill-down" state but handled inconsistently across views
   ```

4. **No route protection patterns:**
   ```tsx
   // Each view manually validates role in useEffect and redirects
   // Should use protected route wrapper
   ```

### 9.2 types.ts (560 lines)

**Assessment:** Comprehensive TypeScript interfaces for business entities.

**Positive aspects:**
- Enums for status values (BatchStatus, UserRole)
- Comprehensive employee type with Qatar-specific fields
- Proper transaction/payment modeling

**Issues:**
1. **Loose types in interfaces:**
   ```tsx
   metadata?: any; // Should be typed
   ```

2. **Optional fields inconsistency:**
   ```tsx
   interface InventoryItem {
     id: string;
     name: string;
     // Many fields are optional - can lead to null checks everywhere
     description?: string;
     category?: string;
     // ...
   }
   ```

3. **Missing types:**
   - No API response types
   - No error types
   - No form types

### 9.3 translations.ts (2,280 lines)

**Structure:** Single object with Arabic and English translations nested by feature.

**Issues:**
1. **2,280 lines of translations in one file**
   - Should be split by feature or use i18next with JSON files
   - Every language change recreates the entire object

2. **Hardcoded RTL direction:**
   ```tsx
   ar: { dir: 'rtl', ... }
   en: { dir: 'ltr', ... }
   ```

3. **Missing translation keys:**
   - Some views have `t.key || 'fallback'` patterns suggesting missing translations

**Recommendation:**
```
/locales
  /ar
    common.json
    pos.json
    inventory.json
    staff.json
    ...
  /en
    common.json
    pos.json
    ...
```

### 9.4 Service Files Analysis

#### inventoryService.ts (130 lines)

**Positive:** 
- Provides read interface with filtering, sorting, pagination
- Uses Supabase PostgREST capabilities

**Issues:**
- No write operations (create, update, delete)
- No caching strategy
- No error handling wrapper

#### crmService.ts (80 lines)

**Positive:**
- CRUD complete
- Proper typing

**Issues:**
- No pagination default (fetches all with limit in parameter)
- `createCustomer` doesn't validate uniqueness before insert

#### beverageService.ts (55 lines)

**Assessment:** Pure calculation functions - good:

```tsx
static calculateRecipeCost(recipe: Recipe): number {
  return recipe.ingredients.reduce((total, ing) => {
    return total + (ing.amount * (ing.cost_per_unit || 0));
  }, 0);
}
```

**Issue:** Should be in a utility file, not a service.

#### shiftService.ts (120 lines)

**Issues:**
- `getShiftTotals` iterates all transactions to find matching cashier - O(n)
- Proper error handling exists
- Demo user UUID resolution inline

#### geminiService.ts (65 lines)

**Issues:**
- Error returns fallback string instead of throwing
- No request timeout
- Response parsing could fail silently

---

## 10. Recommendation Summary

### 10.1 Immediate Actions (Priority: Critical)

| Action | Impact | Effort |
|--------|--------|--------|
| Decompose StaffView into 5 separate components | Maintainability | High |
| Decompose InventoryView into 6 components | Maintainability | High |
| Decompose ConfigurationView, extract SQL to migration | Security/Maintainability | High |
| Add route-based code splitting (React.lazy) | Performance | Medium |
| Implement server-side pagination | Data Scalability | Medium |
| Add error boundaries | Crash Recovery | Low |

### 10.2 Short-Term Actions (Priority: High)

| Action | Impact | Effort |
|--------|--------|--------|
| Create shared UI components (Card, Modal, DataTable, etc.) | DRY | Medium |
| Extract business logic to custom hooks | Testability | Medium |
| Implement React Query for data layer | Performance/Caching | Medium |
| Add proper TypeScript types for API responses | Type Safety | Low |
| Fix fake data in BranchPerformance/Financials | Data Integrity | Low |
| Add missing database indexes | Performance | Low |
| Move API key to environment | Security | Low |

### 10.3 Medium-Term Actions (Priority: Medium)

| Action | Impact | Effort |
|--------|--------|--------|
| Create services layer for all Supabase operations | Architecture | High |
| Implement useReducer for complex state (cart, forms) | Performance | Medium |
| Add comprehensive error handling | UX | Medium |
| Write unit tests for service layer | Quality | High |
| Implement E2E tests for critical paths | Quality | High |
| Set up ESLint + Prettier | Dev Experience | Low |

### 10.4 Long-Term Actions (Priority: Low)

| Action | Impact | Effort |
|--------|--------|--------|
| Split translations into JSON files | Maintainability | Medium |
| Implement offline-first with service workers | UX | High |
| Add performance monitoring | Observability | Medium |
| Create CI/CD pipeline | DevOps | Medium |
| Document architecture decisions | Knowledge | Low |

---

## 11. Proposed Architecture

### 11.1 Recommended Directory Structure

```
src/
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Modal.tsx
│   │   ├── DataTable.tsx
│   │   ├── FormField.tsx
│   │   └── index.ts
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── Breadcrumbs.tsx
│   └── features/
│       ├── pos/
│       │   ├── Cart.tsx
│       │   ├── ProductGrid.tsx
│       │   ├── PaymentModal.tsx
│       │   └── Receipt.tsx
│       ├── inventory/
│       │   ├── LocationList.tsx
│       │   ├── TransferForm.tsx
│       │   └── StockTable.tsx
│       ├── staff/
│       │   ├── EmployeeList.tsx
│       │   ├── ScheduleCalendar.tsx
│       │   ├── PayrollCalculator.tsx
│       │   └── PerformanceMetrics.tsx
│       └── shared/
├── hooks/
│   ├── useAsync.ts
│   ├── usePagination.ts
│   ├── useAuth.ts
│   ├── useToast.ts
│   └── useSupabaseSubscription.ts
├── services/
│   ├── api/
│   │   ├── inventory.api.ts
│   │   ├── employees.api.ts
│   │   ├── transactions.api.ts
│   │   └── index.ts
│   └── business/
│       ├── payroll.service.ts
│       ├── inventory.service.ts
│       └── pos.service.ts
├── stores/
│   ├── auth.store.ts
│   ├── cart.store.ts
│   ├── location.store.ts
│   └── ui.store.ts
├── types/
│   ├── entities.ts
│   ├── api.ts
│   └── forms.ts
├── utils/
│   ├── format.ts
│   ├── validation.ts
│   ├── dates.ts
│   └── calculations.ts
├── constants/
│   ├── roles.ts
│   ├── status.ts
│   └── defaults.ts
├── i18n/
│   ├── ar/
│   │   ├── common.json
│   │   └── features/
│   └── en/
│       └── ...
├── views/
│   ├── Dashboard/
│   ├── POS/
│   ├── Inventory/
│   ├── Staff/
│   └── ...
└── migrations/
    ├── 001_initial.sql
    ├── 002_staff_management.sql
    └── 003_inventory_features.sql
```

### 11.2 Recommended Data Fetching Pattern

```tsx
// hooks/useQuery.ts
export function useQuery<T>(
  key: string[],
  fetcher: () => Promise<T>,
  options?: { staleTime?: number; enabled?: boolean }
) {
  // Wrap React Query or custom caching
}

// views/inventory/LocationsList.tsx
function LocationsList() {
  const { data, isLoading, error } = useQuery(
    ['locations'],
    () => locationService.getAll(),
    { staleTime: 5 * 60 * 1000 }
  );
  
  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorDisplay error={error} />;
  
  return <DataTable data={data} columns={columns} />;
}
```

### 11.3 Recommended Component Pattern

```tsx
// components/features/staff/EmployeeList.tsx
interface EmployeeListProps {
  locationId?: string;
  onEmployeeSelect: (employee: Employee) => void;
}

export function EmployeeList({ locationId, onEmployeeSelect }: EmployeeListProps) {
  // Data fetching delegated to hook
  const { employees, isLoading, error } = useEmployees(locationId);
  
  // Filtering delegated to hook
  const { filtered, filterState, setFilter } = useEmployeeFilter(employees);
  
  // Pagination delegated to hook
  const { paginated, pagination, setPagination } = usePagination(filtered, 20);
  
  // Render
  return (
    <Card>
      <EmployeeFilter value={filterState} onChange={setFilter} />
      <DataTable 
        data={paginated}
        columns={employeeColumns}
        onRowClick={onEmployeeSelect}
      />
      <Pagination state={pagination} onChange={setPagination} />
    </Card>
  );
}
```

---

## 12. Conclusion

The Doha Roastery POS system demonstrates solid business logic and comprehensive feature coverage for a roastery management system. However, the current architecture poses significant risks for scalability and maintainability as the codebase grows.

### Key Strengths
- Comprehensive business features (POS, inventory, HR, roasting)
- Strong database schema with proper constraints and RLS
- Good internationalization foundation
- Responsive UI with Tailwind CSS
- Proper authentication flow with Supabase Auth

### Key Weaknesses
- **Monolithic components** that exceed reasonable size limits
- **No pagination** leading to unbounded data fetching
- **Missing code splitting** causing poor initial load times
- **Business logic embedded in UI** preventing testing and reuse
- **No state management library** leading to prop drilling and context pollution
- **Zero test coverage** for a production system
- **Services layer incomplete** with direct DB calls scattered throughout views

### Risk Assessment

| Risk | Current | 1 Year | 3 Years |
|------|---------|--------|---------|
| Performance degradation | Low | High | Critical |
| Maintainability issues | Medium | High | Critical |
| Data volume limits | Medium | High | Critical |
| Developer onboarding | Medium | High | High |
| Bug regression | Medium | High | Critical |
| Feature velocity | Medium | Low | Low |

The primary recommendation is to **immediately decompose the 4 critical view files** (StaffView, InventoryView, ConfigurationView, POSView) into smaller, focused components. This single action would reduce risk significantly and enable parallel development.

---

**Report prepared for:** Development Team  
**Scope:** Architecture and scalability analysis  
**Methodology:** Static code analysis, pattern identification, scalability projection

---

## 13. Addendum: Ultra-Deep Technical Analysis (March 19, 2026)

This addendum captures a deeper architectural and scalability review based on a full pass over the current codebase. It focuses on high-concurrency risks, large dataset handling, and future feature growth. No code changes were made.

### 13.1 Architecture Map (Current)

```
[Browser UI]
  |
  |-- App.tsx (app shell + tabs + theme/lang + auth gate)
  |       |
  |       |-- contexts/AuthContext.tsx (Supabase auth + profile)
  |       |
  |       |-- views/
  |             |-- POSView.tsx
  |             |-- InventoryView.tsx
  |             |-- StaffView.tsx
  |             |-- ConfigurationView.tsx
  |             |-- RoastingView.tsx
  |             |-- ReportsView.tsx
  |             |-- AIInsights.tsx
  |             |-- CRMView.tsx
  |             |-- BranchPerformanceView.tsx
  |             |-- BranchFinancialsView.tsx
  |             |-- DashboardView.tsx
  |             |-- LoginView.tsx
  |
  |-- services/ (partial data access)
  |     |-- inventoryService.ts
  |     |-- crmService.ts
  |     |-- shiftService.ts
  |     |-- beverageService.ts
  |     |-- geminiService.ts
  |
  |-- supabaseClient.ts (hardcoded Supabase URL + anon key)
  |-- utils/reportExport.ts
  |-- types.ts

[Supabase]
  |
  |-- Tables: transactions, inventory_items, green_beans, roasting_batches,
  |           locations, employees/staff, customers, etc.
  |-- Reports/Views: product_profitability_report, daily_production_report, etc.
  |-- RPC: deduct_inventory_with_cost, add_inventory_atomic, record_customer_transaction
  |-- Storage: inventory images, staff photos

[External]
  |
  |-- Google GenAI (Gemini API)
  |-- Optional Python thermal printer module (thermal_printer/)
```

### 13.2 Structural Risks & Coupling

- Monolithic views with mixed responsibilities (POS, Inventory, Staff, Configuration).
- Services layer exists but is bypassed by most views, leading to scattered Supabase logic.
- App shell embeds navigation, auth gating, theme/lang state, and feature switching in one file.
- No routing or code splitting; all features are bundled upfront.
- Flat repository layout lacks `src/`, `features/`, `hooks/`, `components/`.

### 13.3 Scalability & Performance Risks

- Widespread use of `select('*')` without pagination in many views.
- Client-side aggregation and analytics on full datasets (Dashboard, Branch Performance/Financials, AIInsights).
- No list virtualization for large tables.
- Parallel multi-query fan-out in several views (AIInsights, Reports, Configuration).
- Lack of shared caching or query invalidation strategy.

### 13.4 High-Concurrency & Data Integrity Risks

- Multi-step writes performed client-side without transactional boundaries.
- Mixed delete semantics (soft delete in service vs hard delete in view) can break data consistency.
- Supabase anon key hardcoded in frontend; safety depends entirely on RLS correctness.

### 13.5 Maintainability & Extensibility Risks

- Large, state-heavy components with many hooks and intertwined logic.
- Duplicated normalization logic across views.
- No tests or automated validation.
- No consistent domain-layer abstractions.

### 13.6 Security & External Integration Risks

- Gemini API usage from frontend is unsafe if API keys are shipped to clients.
- Use of preview model names can introduce reliability risks.
- Missing environment separation (hardcoded Supabase URL + anon key).

### 13.7 Database & Query Efficiency

- Frequent order-by on `created_at`, `roast_date`, `movement_at` without visible index guarantees.
- Several read-heavy endpoints rely on client-side processing instead of SQL aggregation.
- Unbounded reads in CRM, Branch analytics, and Roasting views.

### 13.8 Recommendations (Targeted)

1. Consolidate all Supabase queries into a dedicated data layer with typed interfaces.
2. Replace `select('*')` with column selection and pagination in all read-heavy views.
3. Move aggregation workloads into SQL views or RPC for dashboards/analytics.
4. Introduce lazy loading + routing for feature-level code splitting.
5. Add list virtualization in large datasets (inventory, staff, transactions).
6. Use RPC for multi-step write workflows to enforce atomicity.
7. Add error boundaries and structured logging.
8. Move secrets/config to environment variables.

### 13.9 Priority Actions

1. Data access consolidation + pagination
2. Component decomposition of 4 critical views
3. Server-side aggregation for analytics
4. Code splitting and routing
5. Observability + error boundaries

---

## 14. Addendum: Module Restructuring Proposal (Target Layout + Migration Plan)

This addendum proposes a feature-based module layout with a staged migration plan. It is designed to reduce coupling, improve scalability, and make large‑dataset handling and future feature expansion more manageable.

### 14.1 Target Folder Layout

```
src/
  app/
    AppShell.tsx
    routes.tsx
    providers/
      AuthProvider.tsx
      ThemeProvider.tsx
      LanguageProvider.tsx
    layout/
      Sidebar.tsx
      Header.tsx
      Breadcrumbs.tsx

  features/
    pos/
      components/
        CartPanel.tsx
        PaymentPanel.tsx
        ReturnsPanel.tsx
        ShiftPanel.tsx
        CustomerSearch.tsx
      hooks/
        usePOSInventory.ts
        usePOSHistory.ts
        useShift.ts
      services/
        posQueries.ts
        posMutations.ts
      types.ts
      index.ts
      POSView.tsx

    inventory/
      components/
        LocationsTab.tsx
        TransfersTab.tsx
        AdjustmentsTab.tsx
        PurchasesTab.tsx
        CountsTab.tsx
        NetworkVisibility.tsx
      hooks/
        useInventoryData.ts
      services/
        inventoryQueries.ts
        inventoryMutations.ts
      types.ts
      InventoryView.tsx

    staff/
      components/
        StaffOverview.tsx
        PayrollTab.tsx
        ScheduleTab.tsx
        PerformanceTab.tsx
        BranchStaffingTab.tsx
      hooks/
        useStaffData.ts
      services/
        staffQueries.ts
        staffMutations.ts
      types.ts
      StaffView.tsx

    configuration/
      components/
        CatalogTab.tsx
        TemplatesTab.tsx
        RoastProfilesTab.tsx
        GreenBeansTab.tsx
        DatabaseStatus.tsx
        SettingsTab.tsx
      hooks/
        useConfigData.ts
      services/
        configQueries.ts
        configMutations.ts
      types.ts
      ConfigurationView.tsx

    roasting/
      components/
        BatchList.tsx
        BatchDetails.tsx
        PackagingModal.tsx
      hooks/
        useRoastingData.ts
      services/
        roastingQueries.ts
        roastingMutations.ts
      types.ts
      RoastingView.tsx

    reports/
      components/
        ProfitabilityWidget.tsx
        ProductionWidget.tsx
        AdvancedReports.tsx
      hooks/
        useReportsData.ts
      services/
        reportsQueries.ts
      ReportsView.tsx

    ai/
      components/
        InsightsSummary.tsx
        ForecastTable.tsx
      hooks/
        useAIInsights.ts
      services/
        aiQueries.ts
      AIInsights.tsx

    crm/
      components/
        CustomerTable.tsx
        CustomerForm.tsx
      hooks/
        useCustomers.ts
      services/
        crmQueries.ts
      CRMView.tsx

    branch/
      components/
        BranchPerformance.tsx
        BranchFinancials.tsx
      hooks/
        useBranchPerformance.ts
        useBranchFinancials.ts
      BranchPerformanceView.tsx
      BranchFinancialsView.tsx

    dashboard/
      components/
        StatCard.tsx
        WeeklyChart.tsx
      hooks/
        useDashboardData.ts
      DashboardView.tsx

    auth/
      LoginView.tsx

  data/
    supabaseClient.ts
    queryClient.ts
    cacheKeys.ts

  services/
    shared/
      errorHandling.ts
      formatters.ts

  components/
    ui/
      Button.tsx
      Modal.tsx
      Table.tsx
      Input.tsx
      Spinner.tsx

  hooks/
    useDebounce.ts
    usePagination.ts
    useLocalStorage.ts

  types/
    domain/
      inventory.ts
      staff.ts
      pos.ts
    shared.ts

  utils/
    reportExport.ts
    date.ts
    numbers.ts
```

### 14.2 Module-by-Module Restructuring Summary

- **App Shell**
  - Split `App.tsx` into `AppShell`, `providers`, and `layout` modules.
  - Introduce `routes.tsx` to control routing and lazy loading.

- **POS**
  - Move `POSView.tsx` to `features/pos/`.
  - Extract UI submodules (cart, payment, returns, shift).
  - Centralize data access into `posQueries.ts` and `posMutations.ts`.

- **Inventory**
  - Move `InventoryView.tsx` to `features/inventory/`.
  - Split into tab‑level components and dedicated hooks.
  - Move queries/mutations into `inventoryQueries.ts`.

- **Staff**
  - Move `StaffView.tsx` to `features/staff/`.
  - Split into feature sections (overview, schedule, payroll, performance).
  - Centralize data access via `staffQueries.ts` and `staffMutations.ts`.

- **Configuration**
  - Move `ConfigurationView.tsx` to `features/configuration/`.
  - Split into sub‑tabs and dedicated hooks/services.

- **Roasting**
  - Move `RoastingView.tsx` to `features/roasting/`.
  - Extract batch list/details/packaging workflows.

- **Reports / AI / CRM / Branch / Dashboard**
  - Move each to its own feature module with hooks and query layers.

- **Shared Types & Data Layer**
  - Split `types.ts` into domain‑scoped files under `src/types/domain/`.
  - Move Supabase client and query utilities into `src/data/`.

### 14.3 Staged Migration Plan (Low-Risk)

**Phase 0: Prep**
1. Create `src/` root.
2. Move `index.tsx`, `App.tsx`, `supabaseClient.ts`, `types.ts`, `utils/` into `src/`.
3. Update import paths and Vite config.

**Phase 1: App Shell + Routing**
1. Split `App.tsx` into `AppShell`, `providers`, and `layout`.
2. Introduce `routes.tsx` for lazy loading.
3. Keep views intact until feature modules are migrated.

**Phase 2: High-Risk Feature Modules**
1. POS → `features/pos/`
2. Inventory → `features/inventory/`
3. Staff → `features/staff/`
4. Configuration → `features/configuration/`
5. Roasting → `features/roasting/`

**Phase 3: Remaining Views**
1. Reports, AI, CRM, Branch, Dashboard → `features/`.

**Phase 4: Data Layer Consolidation**
1. Move Supabase calls into feature‑level services.
2. Standardize pagination and column selection.
3. Introduce shared query helpers and error handling.

**Phase 5: Shared UI + Hooks**
1. Extract common UI components (modal, table, button).
2. Extract shared hooks (pagination, debounce, local storage).

**Phase 6: Types & Validation**
1. Split `types.ts` into domain modules.
2. Normalize mapping utilities per feature.

### 14.4 Mapping (Current → Target)

- `App.tsx` → `src/app/AppShell.tsx`
- `contexts/AuthContext.tsx` → `src/app/providers/AuthProvider.tsx`
- `views/POSView.tsx` → `src/features/pos/POSView.tsx`
- `views/InventoryView.tsx` → `src/features/inventory/InventoryView.tsx`
- `views/StaffView.tsx` → `src/features/staff/StaffView.tsx`
- `views/ConfigurationView.tsx` → `src/features/configuration/ConfigurationView.tsx`
- `views/RoastingView.tsx` → `src/features/roasting/RoastingView.tsx`
- `views/ReportsView.tsx` → `src/features/reports/ReportsView.tsx`
- `views/AIInsights.tsx` → `src/features/ai/AIInsights.tsx`
- `views/CRMView.tsx` → `src/features/crm/CRMView.tsx`
- `views/BranchPerformanceView.tsx` → `src/features/branch/BranchPerformanceView.tsx`
- `views/BranchFinancialsView.tsx` → `src/features/branch/BranchFinancialsView.tsx`
- `views/DashboardView.tsx` → `src/features/dashboard/DashboardView.tsx`
- `views/LoginView.tsx` → `src/features/auth/LoginView.tsx`
- `supabaseClient.ts` → `src/data/supabaseClient.ts`
- `types.ts` → `src/types/domain/*` + `src/types/shared.ts`

---

## 15. Addendum: Mapping Largest Views to Sub-Components and Data Hooks

This section decomposes the four largest views into proposed sub‑components and feature‑level data hooks. The goal is to isolate UI from data access, reduce re-render scope, and enable pagination and caching.

### 15.1 POSView.tsx → `features/pos/`

**Proposed UI Components**
- `POSView.tsx` (container + layout)
- `ProductGrid.tsx` (item grid + search/filter UI)
- `CartPanel.tsx` (cart state + line items)
- `ItemCustomizationModal.tsx` (size/milk/add‑on controls)
- `PaymentPanel.tsx` (cash/card/split UI + validations)
- `ShiftPanel.tsx` (open/close shift, cash movements)
- `ReturnsPanel.tsx` (return processing workflow)
- `CustomerSearch.tsx` (CRM lookup + selection)
- `ReceiptModal.tsx` (print/reprint UI)
- `LocationSelector.tsx` (location switching)

**Proposed Data Hooks**
- `usePOSInventory(locationId)`  
  Fetch: `inventory_items`, `product_definitions`, `system_settings`
- `usePOSTransactions(filters)`  
  Fetch: recent `transactions` + `transaction_items`
- `useReturnRequests(filters)`  
  Fetch: `return_requests`
- `useCustomersSearch(query)`  
  Fetch: CRM via `crmService`
- `useShift(userId)`  
  Fetch + mutate `shifts` and `cash_movements`
- `useInventoryAdjustments()`  
  RPC for `deduct_inventory_with_cost` + `add_inventory_atomic`

**Key Split Benefits**
- Breaks a single 2,500+ line view into independent UI modules.
- Enables pagination on history and inventory without affecting cart UI.

### 15.2 InventoryView.tsx → `features/inventory/`

**Proposed UI Components**
- `InventoryView.tsx` (container + tab switch)
- `LocationsTab.tsx` (branches/warehouses management)
- `PackagedItemsTab.tsx` (packaged inventory list)
- `TransfersTab.tsx` (approval/shipping/receiving)
- `AdjustmentsTab.tsx` (stock adjustments)
- `PurchasesTab.tsx` (purchase orders)
- `CountsTab.tsx` (count tasks + entries)
- `NetworkVisibility.tsx` (network coverage + health)
- `ItemEditorModal.tsx` (create/edit inventory items)
- `TransferWizard.tsx` (multi‑step transfer)

**Proposed Data Hooks**
- `useInventoryItems(filters, pagination)`
- `useLocations(filters)`
- `useTransfers(filters, pagination)`
- `useAdjustments(filters, pagination)`
- `usePurchaseOrders(filters, pagination)`
- `useInventoryCounts(filters, pagination)`
- `useNetworkVisibility(locationId)`
- `useInventoryRealtime()` (optional channel subscription)

**Key Split Benefits**
- Limits tab scope to only relevant data.
- Enables pagination and lazy loading per tab.

### 15.3 StaffView.tsx → `features/staff/`

**Proposed UI Components**
- `StaffView.tsx` (container + tab switch)
- `StaffOverview.tsx` (headcount, KPIs)
- `EmployeeTable.tsx` (employee list with filters)
- `EmployeeForm.tsx` (create/edit employee)
- `ScheduleTab.tsx` (schedule & swap workflows)
- `AttendanceTab.tsx` (time logs + daily attendance)
- `PayrollTab.tsx` (salary advances + approvals)
- `PerformanceTab.tsx` (KPIs, reviews, bonuses)
- `BranchStaffingTab.tsx` (targets per branch)

**Proposed Data Hooks**
- `useEmployees(filters, pagination)`
- `useTimeLogs(filters, pagination)`
- `usePayroll(period)`
- `usePerformance(period)`
- `useBranchStaffingTargets()`
- `useStaffLocations()` (branches + roastery)

**Key Split Benefits**
- Isolates complex payroll logic from base HR CRUD.
- Enables targeted data fetching per tab.

### 15.4 ConfigurationView.tsx → `features/configuration/`

**Proposed UI Components**
- `ConfigurationView.tsx` (container + sub‑tab switch)
- `CatalogTab.tsx` (product definitions)
- `TemplatesTab.tsx` (package templates)
- `RoastProfilesTab.tsx` (roast profiles)
- `GreenBeansTab.tsx` (green bean inventory + movements)
- `DatabaseStatus.tsx` (schema checks + SQL copy)
- `SettingsTab.tsx` (system settings)
- `RecipeEditor.tsx` (recipe ingredients + BOM)
- `AddOnsEditor.tsx` (product add‑ons)

**Proposed Data Hooks**
- `useCatalog(filters, pagination)`
- `usePackageTemplates(filters)`
- `useRoastProfiles(filters)`
- `useGreenBeans(filters, pagination)`
- `useGreenBeanMovements(filters, pagination)`
- `useSystemSettings()`
- `useSchemaStatus()` (column checks via RPC or cached query)

**Key Split Benefits**
- Separates schema checks from normal UI rendering.
- Enables catalog pagination and targeted data fetch.

---

**Recommended Implementation Order**

1. POS and Inventory (highest concurrency and data volume risk)
2. Staff (largest component, most complex workflows)
3. Configuration (schema checks + catalog operations)

---

## 16. Addendum: Performance Roadmap (Pagination, Virtualization, SQL Views/RPC)

This roadmap ties performance work directly to the tables and reports currently used in the application. It is organized by feature area and prioritizes large‑dataset read paths and high‑concurrency write paths.

### 16.1 Phase 1: Pagination + Column Selection (Immediate)

**POS**
- `inventory_items`  
  - Replace `select('*')` with column selection needed for POS grid and cart.  
  - Add pagination by `location_id` + `type` + `name` search.
- `transactions`, `transaction_items`  
  - Paginate history view and return lookups by `created_at`.

**Inventory**
- `inventory_items`  
  - Paginate by location and type; fetch minimal columns in list views.
- `stock_transfers`, `stock_adjustments`, `purchase_orders`, `inventory_count_tasks`, `inventory_count_entries`  
  - Paginate each tab by `created_at` or `counted_at`.
- `locations`  
  - Select only location columns needed per tab.

**Staff**
- `employees` / `staff`  
  - Paginate employee table by `created_at` or `employee_id`.
- `employee_time_logs`, `shift_swaps`, `salary_advances`, `performance_reviews`  
  - Paginate per tab and limit by date range.

**Configuration**
- `product_definitions`, `package_templates`, `roast_profiles`, `green_beans`  
  - Paginate each list, fetch only required columns per sub‑tab.
- `green_bean_movements`  
  - Paginate by `movement_at`.

**Branch Analytics**
- `transactions`, `transaction_items`, `inventory_movements`  
  - Only query ranges needed for the selected period.

### 16.2 Phase 2: Virtualization (Medium)

**Candidates**
- `inventory_items` grid/list
- `employees` table
- `transactions` history list
- `inventory_count_entries`
- `stock_transfers` and `purchase_orders` lists

**Goal**: use windowed rendering in long lists to reduce DOM nodes and improve scroll performance.

### 16.3 Phase 3: SQL Views for Analytics (Medium–High)

Move client‑side aggregation into SQL views or materialized views:

**Dashboard**
- `transactions` → view: `daily_sales_summary` (sum total by day)
- `roasting_batches` → view: `weekly_roast_summary`
- `green_beans` → view: `stock_summary`

**Branch Performance**
- `transactions` + `transaction_items` → view: `branch_sales_summary`
- `staff` → view: `branch_staff_counts`

**Branch Financials**
- `transactions` → view: `branch_revenue_summary`
- `inventory_movements` → view: `branch_cost_summary`

**Reports**
- Existing report tables already used (e.g. `product_profitability_report`, `daily_production_report`, etc.) should be kept, but ensure they are indexed and refreshed on schedule.

### 16.4 Phase 4: RPC for High‑Concurrency Writes (High)

Move multi‑step write flows into RPC functions:

**POS**
- `record_customer_transaction` (already used) → expand to insert transaction + items + update stock in one RPC.
- `deduct_inventory_with_cost` / `add_inventory_atomic` (already used) → ensure all inventory updates are consolidated into atomic RPC calls.

**Inventory**
- Transfers: `create_transfer`, `approve_transfer`, `ship_transfer`, `receive_transfer` should be RPCs with transactional guarantees.
- Adjustments: `apply_stock_adjustment` RPC to update stock and audit logs together.

**Roasting**
- `create_roasting_batch` RPC to insert batch + update green bean stock + insert movement.
- `finish_roasting_batch` RPC to update batch status and insert finished inventory.

### 16.5 Indexing Recommendations (Tie to Tables)

**Transactional tables**
- `transactions.created_at`, `transactions.location_id`
- `transaction_items.transaction_id`

**Inventory**
- `inventory_items.location_id`, `inventory_items.product_id`, `inventory_items.updated_at`
- `stock_transfers.created_at`
- `stock_adjustments.created_at`

**Roasting**
- `roasting_batches.roast_date`
- `green_bean_movements.movement_at`

**HR**
- `employees.created_at`, `employees.location_id`
- `employee_time_logs.clock_in_at`

**CRM**
- `customers.created_at`, `customers.phone`

### 16.6 Roadmap Sequence (Suggested Order)

1. Replace `select('*')` + add pagination (highest impact, lowest risk).
2. Add list virtualization for large tables.
3. Move analytics into SQL views/materialized views.
4. Consolidate high‑concurrency writes into RPC.
5. Add indexing to support new access patterns.
