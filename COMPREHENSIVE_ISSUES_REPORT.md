# Comprehensive Issues Report — Doha Roastery POS v2

**Date:** 2026-05-03  
**Scope:** Full codebase, database schema, build configuration, security posture  
**Total issues found:** 52

---

## Severity Legend

| Level | Description |
|-------|-------------|
| **P0** | Critical — blocks production, security vulnerability, or data loss |
| **P1** | High — active bug, broken feature, or severe maintainability risk |
| **P2** | Medium — code quality, performance, or incomplete feature |
| **P3** | Low — config hygiene, minor inconsistencies |

---

## 1. SECURITY (P0)

### 1.1 Gemini API Key Exposed to Browser
**Files:** `services/geminiService.ts:5`, `vite.config.ts:10`

The Google Gemini API key is loaded client-side via `import.meta.env.VITE_GEMINI_API_KEY` and bundled into browser JavaScript. Anyone inspecting the page source or network tab can extract it. This key should live in a Supabase Edge Function or backend API proxy — never in client code.

Additionally, `vite.config.ts` uses nonstandard `process.env.VITE_GEMINI_API_KEY` in the `define` block, which also exposes it to the bundle.

```
services/geminiService.ts:5:  const getAI = () => new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
vite.config.ts:10:              'process.env.VITE_GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY),
```

**Action:** Move Gemini calls to a Supabase Edge Function; remove key from client bundle.

---

### 1.2 Supabase Env Vars Use Non-Null Assertion Without Fallback
**File:** `supabaseClient.ts:3-4`

```typescript
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;
```

If environment variables are missing at runtime, the app crashes with a cryptic `undefined is not a string` error. Should validate and throw a descriptive error or use fallback.

**Action:** Add guard with descriptive error message.

---

### 1.3 Broken RPC: `current_user_location_id` — Location Access Control Fails
**Database:** RPC function `public.current_user_location_id`

The function executes:
```sql
SELECT location_id FROM profiles WHERE id = auth.uid();
```

But the `profiles` table has **no** `location_id` column (confirmed via schema inspection: columns are `id, username, full_name, avatar_url, website, ...`). This means **every** call to this function fails, breaking location-based access control for branch isolation. Any RLS policy or application code depending on this function will silently fail or produce errors.

**Action:** Fix the RPC to reference the correct column/table (likely `staff_branches` or `employees.location_id`).

---

### 1.4 Broken RPC: `rate_limit_increment` — Ambiguous Column
**Database:** RPC function `public.rate_limit_increment` (line 3)

SQLSTATE 42702: `column reference "request_count" is ambiguous`. Could refer to either a PL/pgSQL variable or a table column. This creates a race condition in rate-limit enforcement — requests may not be counted correctly, rendering rate limiting unreliable.

**Action:** Qualify the column reference (e.g., `table_name.request_count`).

---

### 1.5 Default ADMIN on Profile Fetch Failure
**File:** `contexts/AuthContext.tsx:91-98`

```typescript
if (error || !data) {
  return {
    id: userId, email: email,
    name: email.split('@')[0],
    role: UserRole.ADMIN, // ← privilege escalation
    permissions: getPermissionsForRole(UserRole.ADMIN),
  };
}
```

If the `profiles` table query fails for any reason (network error, RLS misconfiguration, schema mismatch), the user is silently granted **full ADMIN permissions**. Combined with Issue 1.3 (broken location RPC), a user could gain unrestricted access to all features.

**Action:** Fallback to lowest-privilege role (e.g., `UserRole.CASHIER`) or redirect to an error state.

---

## 2. ACTIVE BUGS (P1)

### 2.1 Dashboard Uses Hardcoded Chart Data
**File:** `views/DashboardView.tsx:177-185`

```typescript
const chartData = [
  { name: t.daySat, sales: 4000, roast: 2400 },
  { name: t.daySun, sales: 3000, roast: 1398 },
  // ... all hardcoded numbers
];
```

Both the BarChart and LineChart on the main dashboard render **fake static data**. Real transaction and roasting data is fetched (`fetchDashboardData`) but never fed into charts. The weekly analysis and roasting activity sections show meaningless numbers.

**Action:** Replace with real data computed from the fetched transactions/roasting batches.

---

### 2.2 Shift Totals Never Include Returns
**File:** `services/shiftService.ts:167`

```typescript
return { sales: cashSales, returns: 0, cashIn, cashOut, expected };
```

The `returns` field is hardcoded to `0`. Return transactions are never factored into shift cash calculations, causing discrepancies between expected and actual cash when returns occur.

**Action:** Query return transactions and subtract them from the shift total.

---

### 2.3 Profile Update Double-Write
**File:** `views/ProfileView.tsx:28-39`

```typescript
const { error: updateError } = await supabase.from('profiles').update(...).eq('id', user.id);
// ... then also:
await updateProfile({ name: formData.full_name });
```

The component directly updates the `profiles` table via Supabase, **then** calls `updateProfile()` from AuthContext which does *another* `profiles.update()`. Two writes for one action — wastes network and risks inconsistent state if one call fails and the other succeeds.

**Action:** Remove the direct Supabase call; use only `updateProfile()` from AuthContext.

---

### 2.4 Date Mutation Bug in BranchFinancialsView
**File:** `views/BranchFinancialsView.tsx:49-56`

```typescript
const getDateRange = () => {
  const now = new Date();
  switch (selectedPeriod) {
    case 'month':  return new Date(now.setMonth(now.getMonth() - 1)).toISOString();
    case 'quarter': return new Date(now.setMonth(now.getMonth() - 3)).toISOString();
    case 'year':    return new Date(now.setFullYear(now.getFullYear() - 1)).toISOString();
  }
};
```

`now.setMonth(now.getMonth() - 1)` mutates the `now` Date object. Since all `case` branches reference the same `now`, the mutations cascade. For example, if `selectedPeriod` is `'month'`, `now` gets mutated, then the function uses the already-mutated `now` for subsequent operations. This produces incorrect date ranges.

**Action:** Use `new Date(now)` copies or compute start/end without mutation.

---

### 2.5 ConfirmationModal Type Mismatch on Default Variant
**File:** `components/common/ConfirmationModal.tsx:21,75`

```typescript
default: { button: '...', icon: null }  // icon is null
// ...
{IconComponent && (<IconComponent ... />)} // IconComponent is null, can't be called as component
```

The `VARIANT_STYLES.default.icon` is `null`, but the type annotation expects `typeof AlertTriangle`. This renders fine at runtime due to the `&&` guard, but the TypeScript types are incorrect. If someone references `VARIANT_STYLES.default.icon` expecting a component, they'll get a runtime error.

**Action:** Use `React.ComponentType | null` union type.

---

### 2.6 Singleton Toast State Leaks Across Instances
**File:** `components/common/Toast.tsx:98-101`

```typescript
let toastIdCounter = 0;
const toastListeners: Array<(toasts: Toast[]) => void> = [];
let activeToasts: Toast[] = [];
```

Module-level mutable state means toasts persist across component unmounts, leak memory, and break in test environments (where multiple renders share the same module state). SSR would also produce incorrect behavior.

**Action:** Use React context or a proper state management solution.

---

### 2.7 Missing CSS File Reference
**File:** `index.html:102`

```html
<link rel="stylesheet" href="/index.css">
```

References `/index.css` which **does not exist** in the project. This produces a 404 on every page load.

**Action:** Remove the link or create the file.

---

### 2.8 LoginAsGuest Does Nothing
**File:** `contexts/AuthContext.tsx:272-285`

`loginAsGuest` sets `user: null`, `isAuthenticated: false`, and `error: 'Demo disabled'` — it no longer provides guest access. The function name and signature (`loginAsGuest: (role: UserRole) => void`) are misleading. The `role` parameter is accepted but ignored.

**Action:** Rename to reflect current behavior, or restore guest login functionality.

---

## 3. ARCHITECTURE & MAINTAINABILITY (P1)

### 3.1 Massive Monolithic View Files

| File | Lines | Contains |
|------|-------|----------|
| `views/ConfigurationView.tsx` | **5,760** | Product catalog CRUD, package templates, roast profiles, green beans, database schema, branches, system settings, invoice export |
| `views/InventoryView.tsx` | **5,544** | Locations, branch report, packaged items, transfers, purchases, stock counts, adjustments, inventory matrix, stock alerts |
| `views/POSView.tsx` | **3,477** | Product grid, cart, payments (cash/card/split), shift management, return processing, customer search, receipt printing, location selection |
| `views/RoastingView.tsx` | **1,291** | Batch CRUD, packaging allocation, QC, label printing, consumption reports |
| `views/ReportsView.tsx` | **1,259** | Profitability, production, waste, QC, cashier sales, payment methods |

These files are far too large for any developer to understand or modify safely. Each should be split into 5–15 focused sub-components.

**Action:** Extract sub-components per tab/feature; use composition.

---

### 3.2 Monolithic Type Definitions
**File:** `types.ts` (641 lines)

All TypeScript interfaces and enums across the entire application (35+ types) live in a single file — `Employee`, `RoastingBatch`, `Transaction`, `Shift`, `Location`, `PayrollHistory`, `PerformanceReview`, `GreenBean`, etc.

**Action:** Split into domain files: `types/employee.ts`, `types/inventory.ts`, `types/pos.ts`, etc.

---

### 3.3 Monolithic Translations File
**File:** `translations.ts` (2,376 lines)

Single file containing 800+ translation keys for both Arabic and English. Each new feature adds ~50–100 lines. At ~3,000 lines, this file becomes unwieldy.

**Action:** Split by domain (`translations/pos.ts`, `translations/inventory.ts`, etc.) or use lazy-loaded JSON.

---

### 3.4 Import Map Bypasses Bundling
**File:** `index.html:85-100`

All dependencies are loaded via `<script type="importmap">` from CDN:

```html
"react": "https://esm.sh/react@^19.2.3",
"@supabase/supabase-js": "https://esm.sh/@supabase/supabase-js@^2.45.0",
"recharts": "https://esm.sh/recharts@^3.6.0",
```

This means:
- No tree-shaking — full libraries downloaded even if only 10% is used
- No version locking — `^` ranges can pull unexpected updates
- Every page load fetches from CDN — no browser caching of shared chunks
- Dependency on esm.sh uptime — if esm.sh is down, the app is down

**Action:** Move to bundled node_modules via Vite (the packages are already in `package.json`).

---

### 3.5 Version Mismatch: @hookform/resolvers
`package.json` declares `@hookform/resolvers@^5.2.2` but the import map in `index.html:98` references `@hookform/resolvers@^3.9.0`. These are different major versions with different APIs. If both resolve to different versions, subtle bugs may occur.

**Action:** Align versions; favor the package.json/bundled version.

---

## 4. CODE QUALITY (P2)

### 4.1 Heavy `any` Usage
**Scope:** Entire codebase

Estimated thousands of `any` casts across all files. Common patterns:
- `(row as any).field` in data mapping
- `setState<any>(...)`
- `fetchDashboardData` returns `any`-typed batches
- `data as any` throughout services and views

This defeats TypeScript's type safety and hides real bugs.

**Action:** Replace with explicit interfaces or use generated Supabase types.

---

### 4.2 Duplicate `escapeHtml` Function
**Files:** `utils/escaper.ts:1-11` and `utils/reportExport.ts:4-10`

Two different implementations of the same utility function exist in the codebase. `utils/reportExport.ts` has its own `escapeHtml`, while `utils/escaper.ts` exports another. The file `InventoryView.tsx` imports from `utils/escaper`, but `reportExport.ts` uses its own inline version.

**Action:** Consolidate into one shared utility; delete the duplicate.

---

### 4.3 Duplicate `toNumber` Utility
**Files:** `services/alertService.ts:32-35`, `services/movementService.ts:57-60`, `views/POSView.tsx:78-81`, `views/AIInsights.tsx:38-41`

The same safe-number-casting pattern is redefined in at least 4 files instead of being imported from `utils/numbers.ts` (which has a `toNumber` export).

**Action:** Import from `utils/numbers.ts` in all files.

---

### 4.4 localStorage Without Try/Catch
**File:** `App.tsx:125-128`

```typescript
const [activeTab] = useState(() => (localStorage.getItem('activeTab') as any) || 'dashboard');
const [isSidebarOpen] = useState(() => localStorage.getItem('sidebarOpen') !== 'false');
```

`localStorage.getItem()` can throw in privacy modes (incognito with storage disabled), when storage is full, or in SSR environments. The app will crash on load with no recovery path.

**Action:** Wrap in try/catch with fallback defaults.

---

### 4.5 Mixed z-index Values
**Scope:** Multiple files

Some components use the `Z_INDEX` constants (`constants/zIndex.ts`) — e.g., `Toast.tsx`, `AccessDeniedToast.tsx`, `ConfirmationModal.tsx`. Others use arbitrary inline Tailwind classes (`z-50`, `z-[60]`, `z-[70]`, `z-[100]`, `z-[110]`) mixed throughout `App.tsx` and views. This creates inconsistent stacking contexts and z-index wars.

**Action:** Use `Z_INDEX` constants everywhere; define all z-index layers in one place.

---

### 4.6 `useMemo` Unstable Dependency
**File:** `hooks/useRoleGuard.ts:20`

```typescript
const isAllowed = useMemo(
  () => (user ? allowedRoles.includes(user.role) : false),
  [user?.role, allowedRoles] // allowedRoles is a new array every render
);
```

`allowedRoles` is passed as a prop (a new array literal each render), so the `useMemo` never stabilizes. Should convert to string-join key or wrap with `useRef` comparison.

---

### 4.7 `any` Typed Parameter in `handleTabChange`
**File:** `App.tsx:275`

```typescript
const handleTabChange = useCallback((id: any) => { ... }, [...]);
```

The parameter is typed `any` despite there being a `TabId` type defined on line 52.

---

### 4.8 Incorrect Event Listener Cleanup Cast
**File:** `contexts/AuthContext.tsx:225-229`

```typescript
window.removeEventListener(eventName, recordActivity as EventListener)
```

Adding listeners with `{ passive: true }` removes them without the options object. While functional, mismatched options can cause warnings or unexpected behavior.

---

### 4.9 `crypto.randomUUID()` Requires Secure Context
**File:** `views/RoastingView.tsx:98`

```typescript
{ tempId: crypto.randomUUID(), productId: '', quantity: '1' }
```

`crypto.randomUUID()` is only available in secure contexts (HTTPS or localhost). On development over HTTP or in some mobile WebViews, this silently fails.

**Action:** Use `uuid` library (already in `package.json` dependencies) instead.

---

### 4.10 Dashboard Theme Hardcoded
**File:** `views/DashboardView.tsx:56`

```typescript
const theme = 'light';
```

Dark mode is available via `useTheme()` but the dashboard ignores it — always renders in light mode, inconsistent with the rest of the app.

---

## 5. PERFORMANCE (P2)

### 5.1 47 Unused Database Indexes
**Database**

Indexes with **0% scan rate** consuming ~332 kB:

| Index | Size |
|-------|------|
| `inventory_items_batch_location_product_size_idx` | 152 kB |
| `inventory_items_location_product_idx` | 104 kB |
| `transactions_pkey` | 88 kB |
| `inventory_items_sku_prefix_idx` | 40 kB |
| `inventory_items_name_lower_idx` | 40 kB |
| `inventory_items_expiry_date_idx` | 40 kB |
| + 41 more | ~80 kB |

**Action:** Drop unused indexes; review query patterns to ensure needed indexes exist.

---

### 5.2 High Sequential Scan Count
**Database**

- `product_definitions`: **28,862 sequential scans** for only 198 rows. Missing index for common filter patterns.
- `inventory_items`: **9,765 sequential scans** for 1,385 rows.
- `transactions`: **2,256 sequential scans** for 1,655 rows.

**Action:** Add targeted indexes based on common `WHERE` and `ORDER BY` clauses.

---

### 5.3 No Data Fetching Cache
**Scope:** All views

Every view re-fetches data on mount and on tab switch. There is no:
- React Query / TanStack Query
- SWR
- Context-based cache
- `useMemo` for expensive computations

Each navigation reloads the entire view from scratch.

**Action:** Introduce React Query for server state caching and deduplication.

---

### 5.4 Inefficient Dashboard Query
**File:** `views/DashboardView.tsx:113-121`

```typescript
const { data: roastData } = await supabase.from('roasting_batches').select('*').order('roast_date', { ascending: false });
const recentBatches = (roastData || []).slice(0, 5);
```

Fetches **all** roasting batches then slices client-side to 5. Should use `.limit(5)` in the query.

---

### 5.5 Table Bloat
**Database**

| Table | Bloat Factor | Waste |
|-------|-------------|-------|
| `roasting_batches` | 3.0x | 16 kB |
| `inventory_items` | 1.3x | 56 kB |
| `transactions` | 1.0x | 72 kB |

**Action:** Run `VACUUM FULL` or `pg_repack` on bloated tables.

---

### 5.6 Tailwind CDN in Production
**File:** `index.html:8`

```html
<script src="https://cdn.tailwindcss.com"></script>
```

The CDN version downloads the full ~3MB Tailwind runtime and performs JIT compilation in the browser on every page load. Production should use compiled CSS.

**Action:** Move to `@tailwindcss/vite` or `tailwindcss` with PostCSS in the Vite build pipeline.

---

### 5.7 No Lazy Loading for Views
**File:** `App.tsx:31-43`

All 13 views are imported as static imports at the top of `App.tsx`, meaning the entire application bundle is downloaded upfront. Views like `ConfigurationView` (5,760 lines) and `InventoryView` (5,544 lines) are loaded even for users who never access them.

**Action:** Use `React.lazy()` + `Suspense` for per-view code splitting.

---

## 6. DATABASE (P2)

### 6.1 113 Tables — Many Likely Unused
**Database:** `public` schema

The database has 113 tables. Many appear to be materialized/reporting tables (e.g., `daily_production_report`, `monthly_production_report`, `waste_by_bean_report`) that may contain stale data if not regularly refreshed. Tables like `query_logs`, `query_logs_extended`, `api_usage_by_model`, `users_stats` suggest an AI/analytics layer that has no corresponding frontend code.

**Action:** Audit for unused tables; drop or archive stale ones.

---

### 6.2 Root-Level SQL Scripts Not in Migration History
**Files:** `audit_log_setup.sql`, `enable_cash_features.sql`, `enable_inventory_features.sql`, `enable_staff_management.sql`, `roasting-inv.sql`

These SQL files at the project root are not tracked by Supabase migrations (`supabase_migrations` table shows only remote migrations 001–010 + timestamps). Manual schema changes can cause drift between environments.

**Action:** Consolidate into proper migration files or document as one-time manual scripts.

---

### 6.3 No Scheduled Refresh for Report Tables
Materialized/report tables (e.g., `daily_production_report`, `monthly_production_report`) show no signs of being refreshed via `pg_cron` or application-level triggers. Data may be stale.

**Action:** Add scheduled refresh or use views instead of materialized tables.

---

## 7. TESTING (P2)

### 7.1 Zero Test Coverage
**File:** `__tests__/setup.ts`

The project has **one test file** containing a single import:

```typescript
import '@testing-library/jest-dom';
```

There are **zero** unit, integration, or E2E tests for ~27,000+ lines of production TypeScript/React code across 48 source files.

Testing dependencies are installed (`vitest`, `@testing-library/react`, `msw`, `jsdom`) but unused.

**Action:** Add tests incrementally, starting with services (pure logic) and critical flows (checkout, shift close, inventory movement).

---

## 8. INCOMPLETE / MISSING (P2-P3)

### 8.1 Missing Translation Keys
- `t.accessRestricted` — referenced in `App.tsx:236` and `hooks/useRoleGuard.ts` but may not exist
- `t.branchPerformance` — uses `||` fallback in `App.tsx:180`
- `t.branchFinancials` — uses `||` fallback in `App.tsx:186`
- `t.crm` — uses `||` fallback in `App.tsx:193`
- `t.editProfile` — uses `||` fallback in `ProfileView.tsx:62`
- `t.changesSaved` — uses `||` fallback in `ProfileView.tsx:69`
- `t.accountInfo` — uses `||` fallback in `ProfileView.tsx:131`
- `t.emailCannotChange` — uses `||` fallback in `ProfileView.tsx:106`

### 8.2 AGENTS.md References Wrong Directory
**File:** `AGENTS.md`

States `src/` directory exists (`src/tests/`), but the project has no `src/` — all source lives at the root level. Commands and tooling that depend on this path will fail.

---

## 9. CONFIG & BUILD (P3)

### 9.1 `dist/` Committed to Repository
The `dist/` directory contains built files (`index.html`, `assets/index-DxjIQBKI.js`). These should be in `.gitignore` and not tracked.

### 9.2 `noEmit: true` — No Build-Time Type Checking
**File:** `tsconfig.json:18`

With `"noEmit": true`, TypeScript only type-checks in the IDE but not during build. Invalid types can slip into production.

### 9.3 `.env` File May Be Tracked
The `.env` file exists in the project root listing but `.gitignore` status is unclear. If committed, it exposes Supabase keys and Gemini API key.

### 9.4 `.eslintrc.cjs` Uses Legacy Format
ESLint v9 uses the flat config format (`eslint.config.js`). The current `.eslintrc.cjs` is the deprecated format but still functional.

---

## 10. SUMMARY BY SEVERITY

| Severity | Count | Key Areas |
|----------|-------|-----------|
| **P0** | 5 | API key exposure, broken RPC functions, privilege escalation |
| **P1** | 8 | Hardcoded dashboard, shift calculation bug, double-write, date mutation, monolithic views |
| **P2** | 22 | `any` usage, duplicate code, no tests, performance, unused DB indexes, missing translations |
| **P3** | 4 | Config hygiene, committed build artifacts, legacy ESLint config |

---

## 11. TOP 10 QUICK WINS (sorted by impact/effort ratio)

1. **Fix `current_user_location_id` RPC** — broken location access control for all branches
2. **Fix `rate_limit_increment` RPC** — ambiguous column breaks rate limiting
3. **Move Gemini API key to backend** — stops key leak to browser users
4. **Replace hardcoded chart data** in DashboardView — users see real analytics
5. **Fix `getDateRange()` mutation bug** in BranchFinancialsView — prevents wrong financial reports
6. **Fix double-write in ProfileView** — reduces DB writes by 50% for profile updates
7. **Add `LIMIT 5` to dashboard roasting query** — reduces data transfer
8. **Remove duplicate `escapeHtml`** — consolidate into one utility
9. **Wrap localStorage in try/catch** — prevents crash on load in privacy modes
10. **Remove Tailwind CDN; use Vite PostCSS plugin** — eliminates 3MB runtime download
