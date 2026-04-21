# Doha Roastery POS v2 — Engineering Analysis Report

**Date:** 2026-04-18  
**Codebase:** doha-roastery-pos-v2  
**Stack:** React 19 + TypeScript 5.8, Vite, Supabase  
**Total Files Analyzed:** 30+ source files, 4 migrations, 5 SQL scripts  

---

## Executive Summary

This report identifies **40 engineering issues** across 9 categories. The most critical findings involve security vulnerabilities (exposed secrets, XSS, overly permissive database policies) and fundamental architecture gaps (no error boundaries, no tests, no linting). The codebase has significant technical debt in the form of massive god components (2500+ lines), pervasive `any` types, duplicated logic, and client-side-only authorization checks.

**Overall Risk Level: HIGH**

| Category | P0 | P1 | P2 | Total |
|----------|----|----|-----|-------|
| Security | 3 | 2 | 1 | 6 |
| Type Safety | 0 | 2 | 1 | 3 |
| Runtime Errors | 0 | 2 | 2 | 4 |
| React Anti-Patterns | 0 | 1 | 4 | 5 |
| Performance | 0 | 2 | 3 | 5 |
| Code Quality | 0 | 1 | 5 | 6 |
| Database/RLS | 0 | 2 | 3 | 5 |
| Accessibility | 0 | 0 | 4 | 4 |
| Testing/Tooling | 0 | 2 | 0 | 2 |
| **Total** | **3** | **14** | **23** | **40** |

---

## P0 — CRITICAL (Fix Immediately)

### 1. `.env` File Tracked in Git

- **File:** `.env`, `.gitignore`
- **Issue:** `.gitignore` has **no `.env` entry**. The `.env` file is committed to git history. Any real secrets (API keys, credentials) added to this file will leak to the repository.
- **Impact:** Secret exposure in version control history.
- **Fix:** Add `.env` to `.gitignore`, run `git rm --cached .env`, and rotate any secrets previously stored in it.
- **References:** `.gitignore` (missing entry)

### 2. Hardcoded Supabase Credentials in Source

- **File:** `supabaseClient.ts:4-5`
- **Issue:** Supabase URL and anon key are hardcoded directly in the source file:
  ```ts
  const supabaseUrl = 'https://lweiutdbssdjltphimyo.supabase.co';
  const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
  ```
- **Impact:** Cannot rotate keys without code changes and redeployment. If the key is revoked, all clients break.
- **Fix:** Use Vite environment variables:
  ```ts
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  ```

### 3. XSS via `window.document.write()`

- **File:** `InventoryView.tsx:657-713` (`printTransferVoucher`)
- **Issue:** User-controlled data (`order.status`, `sourceName`, `destName`) is interpolated directly into HTML written via `window.document.write()` without proper escaping. While `.replaceAll('<','&lt;')` escapes item names, other fields are not sanitized.
- **Impact:** Cross-site scripting attack vector. A malicious user could inject arbitrary HTML/JS through transfer voucher fields.
- **Fix:** Escape all dynamic values or use a proper HTML templating/rendering approach instead of `document.write()`.

### 4. Race Condition in POS Checkout (Data Integrity)

- **File:** `POSView.tsx:677-834` (`handleCheckout`)
- **Issue:** Transaction insert, inventory updates, and shift updates are separate async calls with no database-level transaction. If inventory updates fail after the transaction is inserted, the database becomes inconsistent (recorded sale without deducted inventory).
- **Impact:** Financial data corruption — transactions without corresponding inventory deductions.
- **Fix:** Use a Supabase RPC (server-side function) to wrap checkout in a single atomic database transaction.

---

## P1 — HIGH (Fix Soon)

### 5. No React Error Boundaries

- **Files:** All view components
- **Issue:** Zero error boundaries exist in the entire application. A runtime error in any view component (POS, Dashboard, Staff, etc.) crashes the **entire app** with a white screen.
- **Impact:** Poor user experience; no graceful recovery from errors.
- **Fix:** Wrap each top-level view in a React Error Boundary component. Create a reusable `ErrorBoundary` wrapper.

### 6. Pervasive `any` Types (~40+ Instances)

- **Files:** `RoastingView.tsx`, `ReportsView.tsx`, `POSView.tsx`, `InventoryView.tsx`, `ConfigurationView.tsx`, `AIInsights.tsx`, `BranchPerformanceView.tsx`, `DashboardView.tsx`
- **Issue:** Nearly all Supabase query responses are typed `any`. Key examples:
  - `RoastingView.tsx:34,39,41` — `useState<any[]>([])` for beans, locations, monthlyConsumption
  - `ReportsView.tsx:22-31` — 10+ `useState<any[]>([])`
  - `POSView.tsx:106,107,149` — `useState<any>(null)` for lastTransaction, lastReturnRequest, shiftReport
  - `POSView.tsx:357` — `new Map<string, any>()`
  - `InventoryView.tsx` — `any` throughout for Supabase responses
- **Impact:** Complete loss of type safety; IDE cannot catch errors; refactoring is unsafe.
- **Fix:** Generate TypeScript types from Supabase schema (`supabase gen types typescript`) or define proper interfaces for all data shapes.

### 7. Supabase Errors Silently Discarded

- **Files:** `StaffView.tsx:624-633`, `RoastingView.tsx:74-77`, `POSView.tsx:293-338`, `DashboardView.tsx:64-84`, `InventoryView.tsx`, `CRMView.tsx`
- **Issue:** Pattern used throughout:
  ```ts
  const { data } = await supabase.from('table').select('*');
  if (data) setSomething(data);
  // error is silently discarded
  ```
- **Impact:** Failures are invisible to users. Queries can fail silently, leaving UI in stale or broken states.
- **Fix:** Always destructure and check `error`, surface meaningful messages to the user:
  ```ts
  const { data, error } = await supabase.from('table').select('*');
  if (error) { showError(error.message); return; }
  ```

### 8. Client-Side-Only Role Checks (Authorization Bypass)

- **Files:** `POSView.tsx`, `CRMView.tsx`, `BranchPerformanceView.tsx`, `InventoryView.tsx`
- **Issue:** Authorization is checked only on the client side (e.g., `user?.role !== 'ADMIN'`). A modified API client or direct Supabase calls bypass all role restrictions.
- **Impact:** Any authenticated user can perform admin operations by bypassing the UI.
- **Fix:** Implement Row Level Security (RLS) policies on all tables. Never trust client-side role checks alone.

### 9. Overly Permissive RLS Policies (8 Tables)

- **Files:** `roasting-inv.sql`, `enable_inventory_features.sql`, `enable_cash_features.sql`
- **Issue:** Eight tables use blanket `auth.role() = 'authenticated'` (any logged-in user = full CRUD):

  | Table | Policy | File |
  |-------|--------|------|
  | `green_beans` | "Auth all green beans" — FOR ALL | `roasting-inv.sql:18` |
  | `green_bean_movements` | "Auth all green bean movements" — FOR ALL | `roasting-inv.sql:17-18` |
  | `order_reservations` | "Auth all order reservations" — FOR ALL | `enable_inventory_features.sql:1432` |
  | `locations` | "Auth all locations" — FOR ALL | `enable_inventory_features.sql:778` |
  | `cash_movements` | "Enable read access for all users" — USING (true) | `enable_cash_features.sql:26` |
  | `accounting_entries` | "Auth insert accounting entries" — FOR ALL | `enable_inventory_features.sql:869` |
  | `customers` | Permissive USING (true) for SELECT, INSERT, UPDATE | `migrations/20260405_fix_cashier_crm_update.sql:34-41` |
  | `locations` | "Public read" — USING (true) | `enable_inventory_features.sql:776` |

- **Impact:** Any authenticated user (including CASHIER role) can insert, update, or delete financial records, inventory, and customer data.
- **Fix:** Replace with role-specific policies using `current_user_is_admin()`, `current_user_is_manager()`, etc.

### 10. Cashier Transaction Matching by Name (Not ID)

- **File:** `migrations/20260330_cashier_rls_policies.sql:51`
- **Issue:** RLS policy matches transactions by `cashier_name = (SELECT COALESCE(full_name, username) FROM profiles WHERE id = auth.uid())`. This is a string match, not an ID match.
- **Impact:** If two cashiers share a name, they can see each other's transactions. If a cashier changes their name, they lose access to their own transactions.
- **Fix:** Add a `cashier_id UUID` column to the `transactions` table and match on `cashier_id = auth.uid()`.

### 11. Massive Component Files (God Components)

- **Files & Sizes:**

  | File | Approx. Lines | State Variables |
  |------|--------------|-----------------|
  | `InventoryView.tsx` | ~2500 | 20+ |
  | `POSView.tsx` | ~1700 | 40+ |
  | `ConfigurationView.tsx` | ~1390 | 15+ |
  | `ReportsView.tsx` | ~929 | 15+ |
  | `StaffView.tsx` | ~750 | 10+ |

- **Impact:** Difficult to maintain, test, and reason about. High cognitive load. Increased re-render surface area.
- **Fix:** Extract custom hooks for data fetching, separate sub-components, create utility modules for shared logic.

### 12. No Tests

- **Issue:** No `tests/` directory exists. `package.json` has no test runner configured. **0% test coverage.**
- **Impact:** Any change could introduce regressions without detection. No verification that business logic (checkout, inventory deduction, shift management) works correctly.
- **Fix:** Add a test framework (Vitest + React Testing Library), write tests for critical business logic first (checkout flow, inventory management, auth).

### 13. No Linting or Formatting

- **Issue:** No ESLint configuration, no Prettier configuration, no pre-commit hooks for code quality.
- **Impact:** Inconsistent code style, no automated catch of common errors, no enforcement of best practices.
- **Fix:** Add ESLint + Prettier with appropriate React/TypeScript rules. Add `lint` and `format` scripts to `package.json`.

### 14. N+1 Query Pattern in POS Checkout

- **File:** `POSView.tsx:735-797` (`handleCheckout`)
- **Issue:** For each cart item, an individual Supabase query is made to look up inventory. Then individual update queries are sent per item. This creates O(n) network requests for n items.
- **Impact:** Checkout is slow with large carts. Network latency compounds.
- **Fix:** Batch inventory lookups with a single query using `.in('id', cartItemIds)`. Use Supabase RPC for bulk updates.

---

## P2 — MEDIUM (Plan to Fix)

### 15. Demo User Bypass Scattered Across Codebase

- **Files:** `shiftService.ts:4-7`, `POSView.tsx:695`, `AuthContext.tsx:224`, `ProfileView.tsx:224`
- **Issue:** `"demo-user"` checks are scattered. `shiftService.ts` maps it to a nil UUID (`00000000-0000-0000-0000-000000000000`), creating records with null/nil user references.
- **Impact:** Data integrity loss; no accountability for demo transactions.
- **Fix:** Centralize into a single utility. Gate behind a dev-only feature flag. Remove from production builds.

### 16. Division by Zero

- **File:** `RoastingView.tsx:352`
  ```ts
  const waste = ((batch.preWeight - post) / batch.preWeight * 100);
  ```
  If `batch.preWeight` is 0, this produces `Infinity` or `NaN`.

- **File:** `AIInsights.tsx:265`
  ```ts
  const marginPct = ((selling - cost) / selling) * 100;
  ```
  If `selling` is 0, division by zero.

- **Fix:** Add zero guards: `if (batch.preWeight === 0) return 0;`

### 17. `setTimeout` Without Cleanup

- **Files:** `RoastingView.tsx:283,341,406`, `POSView.tsx:815-817`
- **Issue:** `setTimeout(() => setShowSuccess(false), 3000)` and `setTimeout(() => window.print(), 300)` are called without cleanup. If the component unmounts before the timeout fires, it attempts to update unmounted state.
- **Fix:** Store timeout IDs and clear them in `useEffect` cleanup functions or use a custom `useTimeout` hook.

### 18. Code Duplication

| Duplicated Code | Files |
|----------------|-------|
| `toNumber()` helper | `POSView.tsx:41-44`, `ConfigurationView.tsx:224-227`, `InventoryView.tsx:924-931` |
| `getAvailableStock()` logic | `POSView.tsx:505-509`, `InventoryView.tsx:286-290` |
| Supabase query pattern (select→check error→set state) | Every service and view file |
| `applyInventoryDeductions` / `applyInventoryAdditions` | `POSView.tsx:566-665` (80% duplicated structure) |

- **Fix:** Create shared utility modules (`utils/numbers.ts`, `utils/inventory.ts`). Create a data fetching abstraction layer.

### 19. `window.confirm()` / `window.alert()` Instead of Modals

- **Files:** `RoastingView.tsx:190,298,373`, `POSView.tsx:516,205-209,830`, `InventoryView.tsx:578-597,627-649`, `CRMView.tsx:128`
- **Issue:** Using browser-native dialogs that block the UI thread and are not accessible.
- **Fix:** Replace with custom modal/toast components.

### 20. 800+ Lines of SQL Embedded in React Component

- **File:** `ConfigurationView.tsx:565-1390+`
- **Issue:** A massive SQL migration script is embedded as a template literal inside a React component.
- **Impact:** Cannot be versioned independently, cannot be tested separately, mixes concerns.
- **Fix:** Move to migration files in `migrations/` directory. Execute via Supabase CLI.

### 21. Accessibility Issues

| Issue | Files |
|-------|-------|
| Icon-only buttons missing `aria-label` | All files (Staff, Roasting, CRM, Inventory) |
| Color-only status indicators (no text alternative) | `StaffView.tsx:148-150`, `DashboardView.tsx` |
| Missing form labels (`htmlFor`/`id`) | `POSView.tsx` (cash input), `RoastingView.tsx` (weight input), `CRMView.tsx` (phone input) |
| No `aria-live` regions for dynamic updates | `PersonalStatsPanel.tsx`, `POSView.tsx` (cart updates) |
| `window.confirm()`/`alert()` not accessible | Multiple files (see #19) |

### 22. `console.log` Statements Left in Production Code

- **Files & Lines:**
  - `ReportsView.tsx:107,161-166`
  - `RoastingView.tsx:276`
  - `BranchPerformanceView.tsx:226,236,318,332`
  - `POSView.tsx:984`

- **Fix:** Remove all debug logging, or add a `logger` utility that strips logs in production builds.

### 23. Gemini API Key Environment Variable Mismatch

- **File:** `vite.config.ts:10` defines `process.env.API_KEY` from `GEMINI_API_KEY`
- **File:** `services/geminiService.ts:5` uses `process.env.API_KEY`
- **Issue:** The env var in `.env` is `GEMINI_API_KEY`, but the service reads `API_KEY`. Vite replaces these at build time, so the current setup may work, but the naming mismatch is confusing and error-prone.
- **Fix:** Standardize env var names. For Vite, use `VITE_GEMINI_API_KEY` prefix and `import.meta.env`.

### 24. `crypto.randomUUID()` Without Polyfill

- **File:** `RoastingView.tsx:53,160,213`
- **Issue:** `crypto.randomUUID()` is not available in older browsers or non-HTTPS contexts.
- **Fix:** Add a polyfill or use a UUID library (`uuid` package).

### 25. Implicit `any` in Catch Clauses

- **Files:** `StaffView.tsx:707`, `POSView.tsx:203,233,280`, `ProfileView.tsx:41`, `CRMView.tsx:110,140`, `BranchPerformanceView.tsx:296,343`
- **Issue:** Pattern: `} catch (err: any) {` — should use `unknown` and narrow with type guards.
- **Fix:** Use `} catch (err: unknown) { if (err instanceof Error) { ... } }`

### 26. `useMemo`/`useEffect` Dependency Issues

- **File:** `StaffView.tsx:215-216` — `useMemo(() => createEmployeeSchema(t), [t])` — `t` is a new object every render from `useLanguage()`, so the memo never caches.
- **File:** `LoginView.tsx:24-28` — Same issue.
- **File:** `DashboardView.tsx:53-55` — `useEffect(() => fetchDashboardData(), [])` — `fetchDashboardData` is not wrapped in `useCallback`.
- **File:** `PersonalStatsPanel.tsx:42-116` — Dependencies only partially listed.

### 27. Missing `updated_at` Triggers on Several Tables

- **Tables:** `cash_movements`, `transactions`, `inventory_movements`, `inventory_lots`
- **Issue:** While other tables (employees, performance_reviews) have automatic `updated_at` triggers, these tables don't.
- **Fix:** Add consistent `updated_at` triggers.

### 28. Location Type Mismatch

- **File:** `types.ts:403-441` vs `InventoryView.tsx`
- **Issue:** The `Location` type has many optional fields, but `InventoryView.tsx` uses extra fields (`contact_person_name`, `contact_person_phone`, `contact_person_email`) that aren't in the type definition.
- **Fix:** Update the `Location` type in `types.ts` to include all fields used in the codebase, or generate types from the database schema.

### 29. Race Condition in `generate_employee_id()`

- **File:** `enable_staff_management.sql:954-980`
- **Issue:** Finds max employee ID then increments. Under concurrent inserts, two transactions could get the same max and try to insert the same ID.
- **Fix:** Use a database sequence or `SERIAL` approach instead of max+1.

### 30. Sensitive Employee Data Without Column-Level Protection

- **File:** `enable_staff_management.sql`
- **Issue:** The `employees` table stores `national_id`, `salary_base`, `bank_name`, `iban`, `qid`, `employee_pin` — all highly sensitive PII. RLS policy gives full column access to ADMIN and MANAGER.
- **Fix:** Create restricted views or column-level policies so financial/banking fields are only visible to ADMIN and HR.

### 31. `SECURITY DEFINER` on `current_user_is_cashier()`

- **File:** `migrations/20260330_cashier_rls_policies.sql:20-28`
- **Issue:** The function is `SECURITY DEFINER` and called in many RLS policies. If altered maliciously, it affects all cashier-scoped access.
- **Fix:** Revoke EXECUTE from `public`, grant only to `authenticated`:
  ```sql
  REVOKE EXECUTE ON FUNCTION current_user_is_cashier() FROM public;
  GRANT EXECUTE ON FUNCTION current_user_is_cashier() TO authenticated;
  ```

---

## Architecture Concerns

### No `src/` Directory Structure

All source files live at the project root instead of a `src/` directory. This makes imports fragile and the project harder to navigate. Consider migrating to:

```
src/
  components/
  views/
  services/
  hooks/
  contexts/
  utils/
  constants/
  types/
```

### Only 1 Hook, 1 Context, 2 Shared Components

The codebase has 13 views but only:
- 1 custom hook (`useRoleGuard.ts`)
- 1 context (`AuthContext.tsx`)
- 2 shared components (`AccessDeniedToast`, `PersonalStatsPanel`)

This indicates logic is not being extracted from view components. Most views contain inline logic that should be in hooks and shared components.

### Missing Contexts

- No `LanguageContext` file (defined inline in `App.tsx`)
- No `ThemeContext` file (defined inline in `App.tsx`)
- No `ToastContext` or notification system (using `alert()` instead)
- No `ErrorBoundary` component

---

## Recommended Priority Actions

### Immediate (This Week)

1. **Add `.env` to `.gitignore`** and `git rm --cached .env`
2. **Move Supabase credentials** to environment variables
3. **Fix XSS** in `printTransferVoucher` (`InventoryView.tsx:657-713`)
4. **Add an ErrorBoundary component** and wrap all views
5. **Add ESLint + Prettier** with React/TypeScript rules

### This Sprint

6. **Fix RLS policies** — Replace blanket `authenticated` policies with role-based checks
7. **Add `cashier_id` column** to transactions table, match on `auth.uid()`
8. **Start reducing `any` types** — Generate Supabase types, create interfaces
9. **Add error handling** — Always check `error` from Supabase queries
10. **Add division-by-zero guards** in `RoastingView.tsx` and `AIInsights.tsx`

### Ongoing

11. **Break up god components** — Extract hooks, sub-components, utilities
12. **Add tests** — Start with critical paths (checkout, inventory, auth)
13. **Centralize error handling** — Create toast/notification system, remove `alert()`
14. **Extract shared utilities** — `toNumber()`, `getAvailableStock()`, data fetching abstraction
15. **Move SQL migrations** out of React components
16. **Standardize env var naming** for Vite compatibility

---

*Report generated by opencode engineering analysis on 2026-04-18.*