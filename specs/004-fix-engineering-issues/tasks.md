# Tasks: Fix Critical and High-Priority Engineering Issues

**Input**: Design documents from `/specs/004-fix-engineering-issues/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Included per FR-012 (automated tests required) and spec User Story 7 (establish test coverage).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, dependency installation, configuration files, and environment hardening.

- [ ] T001 Add `.env` to `.gitignore` and remove `.env` from git tracking in `.gitignore`
- [ ] T002 [P] Create `.env.example` template file with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GEMINI_API_KEY`, `VITE_DEMO_MODE` at project root
- [ ] T003 [P] Migrate Supabase credentials from hardcoded values to `import.meta.env.VITE_SUPABASE_URL` and `import.meta.env.VITE_SUPABASE_ANON_KEY` in `supabaseClient.ts`
- [ ] T004 [P] Update `vite.config.ts` to use `VITE_GEMINI_API_KEY` consistently (currently maps `GEMINI_API_KEY` to `process.env.API_KEY`)
- [ ] T005 [P] Install new dependencies: `react-error-boundary`, `uuid`, `@types/uuid`, `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `msw`, `eslint`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-config-prettier`, `prettier`, `lint-staged`, `husky`
- [ ] T006 [P] Create `.eslintrc.cjs` with `@typescript-eslint/recommended`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-config-prettier` config at project root
- [ ] T007 [P] Create `.prettierrc` with `{ "singleQuote": true, "trailingComma": "es5", "tabWidth": 2, "semi": true }` at project root
- [ ] T008 [P] Create `vitest.config.ts` with jsdom environment and path aliases at project root
- [ ] T009 [P] Add `lint`, `lint:fix`, `format`, `format:check`, `test`, `test:run`, `prepare` scripts to `package.json`
- [ ] T010 Set up husky pre-commit hook with lint-staged in `.husky/pre-commit`
- [ ] T011 [P] Create `utils/demoMode.ts` — export `isDemoMode()`, `getDemoUserId()`, `DEMO_USER_UUID` constant; `isDemoMode` checks `import.meta.env.VITE_DEMO_MODE === 'true'`
- [ ] T012 [P] Create `utils/numbers.ts` — export `toNumber(val: unknown, fallback?: number): number` and `safeDivide(numerator: number, denominator: number, fallback?: number): number`
- [ ] T013 [P] Create `utils/escaper.ts` — export `escapeHtml(input: string): string` that escapes `&`, `<`, `>`, `"`, `'`, `/`

**Checkpoint**: Project infrastructure configured. `npm run lint`, `npm run format`, `npm run test` commands work. `.env` excluded from git.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core shared components and database schema changes that MUST be complete before ANY user story can be implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T014 Create `components/common/ErrorBoundary.tsx` — uses `react-error-boundary` with fallback UI showing "Try Again" button and "Reload Page" link, supports `resetErrorBoundary`
- [ ] T015 Create `components/common/Toast.tsx` — toast notification component with success/error/warning/info variants, auto-dismiss, stacking, `role="alert"`, `aria-live="polite"`, `z-index: 70`
- [ ] T016 Create `components/common/ConfirmationModal.tsx` — blocking modal with title, message, confirm/cancel buttons, danger/warning/default variants, focus trap, escape key cancel, `z-index: 50`
- [ ] T017 Create `hooks/useErrorToast.ts` — hook providing `showError`, `showSuccess`, `showWarning`, `showInfo` functions that render `Toast` components
- [ ] T018 Create `hooks/useTimeout.ts` — safe setTimeout hook that clears on unmount, returns `resetTimeout()` function
- [ ] T019 Create `types/database.ts` — run `supabase gen types typescript` and import generated types; export type helpers for commonly used entities (Transaction, Employee, InventoryItem, GreenBean, Location, Customer, Shift)
- [ ] T020 Create Supabase migration `migrations/20260418_add_cashier_id_column.sql` — add `cashier_id UUID REFERENCES profiles(id)` to transactions, backfill from `cashier_name`, create `migration_flags` table, add index on `cashier_id`
- [ ] T021 Create Supabase migration `migrations/20260418_rls_role_based_policies.sql` — create `current_user_is_admin()`, `current_user_is_manager()`, `current_user_is_hr()`, `current_user_is_roaster()`, `current_user_is_warehouse()` functions; revoke public execute and grant to authenticated; replace all blanket `authenticated` policies with role-based policies per `contracts/rls-policies.md`
- [ ] T022 Create Supabase migration `migrations/20260418_create_process_checkout_rpc.sql` — create `process_checkout(p_items JSONB, p_payment_method TEXT, p_total NUMERIC, p_cashier_id UUID, p_shift_id UUID, p_location_id UUID)` function with `SELECT ... FOR UPDATE` stock validation, atomic transaction insert, inventory deduction, shift update
- [ ] T023 Create Supabase migration `migrations/20260418_employees_manager_view.sql` — create `employees_for_manager` view that excludes `salary_base`, `salary_allowances`, `bank_name`, `iban`, `national_id`, `qid`, `employee_pin` columns

**Checkpoint**: Foundation ready — ErrorBoundary, Toast, ConfirmationModal, useErrorToast, useTimeout, database types, and all migrations are in place. User story implementation can now begin.

---

## Phase 3: User Story 1 - Secure Application From Vulnerabilities (Priority: P1) 🎯 MVP

**Goal**: Patch all critical security vulnerabilities — .env exposure, hardcoded credentials, XSS, and checkout race conditions.

**Independent Test**: Attempt to exploit each vulnerability (commit .env, inject script in voucher fields, manipulate checkout mid-transaction) and verify each is mitigated.

### Implementation for User Story 1

- [ ] T024 [US1] Replace all `window.document.write()` calls with safe `window.open()` + `URL.createObjectURL()` pattern in `views/InventoryView.tsx`, applying `escapeHtml()` from `utils/escaper.ts` to all dynamic values in transfer voucher HTML
- [ ] T025 [US1] Refactor `handleCheckout` in `views/POSView.tsx` to call `supabase.rpc('process_checkout', { ... })` instead of separate transaction insert + inventory update + shift update calls
- [ ] T026 [US1] Map `process_checkout` RPC response in `POSView.tsx` — handle `{ success: false, error: "Item X no longer in stock" }` with toast notification, handle `{ success: true, transaction_id }` flow
- [ ] T027 [US1] Verify `.env` is in `.gitignore` and removed from git tracking by running `git ls-files .env` (should return empty)
- [ ] T028 [US1] Verify `supabaseClient.ts` reads from `import.meta.env.VITE_SUPABASE_URL` and `import.meta.env.VITE_ANON_KEY` and contains no hardcoded strings

**Checkpoint**: Security vulnerabilities patched. XSS in voucher printing mitigated. Checkout is atomic. `.env` not tracked. Credentials externalized.

---

## Phase 4: User Story 2 - Prevent App Crashes With Error Boundaries (Priority: P1)

**Goal**: Wrap all 13 views in ErrorBoundary so runtime errors display localized error messages instead of white-screen crashes.

**Independent Test**: Trigger an error in any view and verify the app continues with an error message in the affected area only.

### Implementation for User Story 2

- [ ] T029 [US2] Wrap all 13 view components in `ErrorBoundary` in `App.tsx` — DashboardView, StaffView, RoastingView, InventoryView, POSView, ReportsView, BranchPerformanceView, BranchFinancialsView, CRMView, AIInsights, ConfigurationView, ProfileView, LoginView
- [ ] T030 [P] [US2] Replace all 8 instances of `setTimeout(() => setShowSuccess(false), N)` in `views/RoastingView.tsx` with `useTimeout` hook from `hooks/useTimeout.ts` for proper cleanup on unmount (lines ~283, ~341, ~406)
- [ ] T031 [P] [US2] Replace `setTimeout(() => window.print(), 300)` in `views/POSView.tsx` (~line 815) with `useTimeout` hook for cleanup
- [ ] T032 [P] [US2] Replace `setTimeout` calls in `views/ReportsView.tsx` (~line 40) with `useTimeout` hook
- [ ] T033 [P] [US2] Replace `setTimeout` calls in `views/BranchPerformanceView.tsx` (~lines 249-252, 318, 332) with `useTimeout` hook
- [ ] T034 [P] [US2] Add `alert()` and `confirm()` replacement refactoring — replace `window.alert()` calls in `views/POSView.tsx` (~lines 205-209, 516, 830) with `useErrorToast().showError()` or `ConfirmationModal`
- [ ] T035 [P] [US2] Replace `window.confirm()` calls in `views/RoastingView.tsx` (~lines 190, 298, 373) with `ConfirmationModal`
- [ ] T036 [P] [US2] Replace `window.alert()` and `window.confirm()` calls in `views/InventoryView.tsx` (~lines 578-597, 627-649) with `ConfirmationModal` and `useErrorToast`
- [ ] T037 [P] [US2] Replace `window.alert()` call in `views/CRMView.tsx` (~line 128) with `useErrorToast().showError()`

**Checkpoint**: Error boundaries active on all views. All `setTimeout` calls cleaned up. All `window.alert()`/`window.confirm()` replaced with Toast/ConfirmationModal.

---

## Phase 5: User Story 3 - Harden Database Access With Role-Based Policies (Priority: P2)

**Goal**: Deploy role-based RLS policies so cashiers cannot modify inventory/financial records, and managers cannot see sensitive employee data.

**Independent Test**: Log in as CASHIER, ROASTER, MANAGER, ADMIN; verify each role can only access/modify data appropriate to their role.

### Implementation for User Story 3

- [ ] T038 [US3] Apply migration `migrations/20260418_add_cashier_id_column.sql` to Supabase — verify `cashier_id` column added, backfill completed, unmatched records flagged
- [ ] T039 [US3] Apply migration `migrations/20260418_rls_role_based_policies.sql` to Supabase — verify all role helper functions created, blanket policies dropped, role-based policies created per `contracts/rls-policies.md`
- [ ] T040 [US3] Apply migration `migrations/20260418_employees_manager_view.sql` to Supabase — verify `employees_for_manager` view created excluding sensitive columns
- [ ] T041 [US3] Update `views/StaffView.tsx` to use `employees_for_manager` view for MANAGER role, full `employees` table for ADMIN/HR role
- [ ] T042 [US3] Update `views/POSView.tsx` to set `cashier_id = user.id` on new transactions instead of relying on `cashier_name`
- [ ] T043 [US3] Update `services/shiftService.ts` to use `cashier_id` instead of name-based matching for shift and transaction queries
- [ ] T044 [US3] Centralize demo-user logic — update `services/shiftService.ts`, `views/POSView.tsx`, `contexts/AuthContext.tsx`, `views/ProfileView.tsx` to use `utils/demoMode.ts` instead of scattered `"demo-user"` checks

**Checkpoint**: RLS policies active on all tables. `cashier_id` column in use. Demo-user logic centralized. Manager cannot see salary/bank fields.

---

## Phase 6: User Story 4 - Surface Errors Instead of Failing Silently (Priority: P2)

**Goal**: Replace all silent Supabase error discarding with toast notifications so users see meaningful error messages.

**Independent Test**: Simulate network failures or Supabase errors and verify toast notifications appear instead of blank/stale views.

### Implementation for User Story 4

- [ ] T045 [P] [US4] Refactor `services/beverageService.ts` — destructure `{ data, error }` from all Supabase calls, return `ServiceResult<T>` pattern, surface errors via return value
- [ ] T046 [P] [US4] Refactor `services/crmService.ts` — destructure `{ data, error }` from all Supabase calls, return `ServiceResult<T>` pattern, surface errors via return value
- [ ] T047 [P] [US4] Refactor `services/inventoryService.ts` — destructure `{ data, error }` from all Supabase calls, return `ServiceResult<T>` pattern, surface errors via return value
- [ ] T048 [P] [US4] Refactor `services/shiftService.ts` — destructure `{ data, error }` from all Supabase calls, return `ServiceResult<T>` pattern, surface errors via return value
- [ ] T049 [US4] Add `useErrorToast` to all view components that call Supabase directly (not through services) — `views/DashboardView.tsx`, `views/StaffView.tsx`, `views/RoastingView.tsx`, `views/ReportsView.tsx`, `views/ConfigurationView.tsx`, `views/AIInsights.tsx`, `views/BranchPerformanceView.tsx`, `views/BranchFinancialsView.tsx`, `views/ProfileView.tsx`
- [ ] T050 [US4] Update all direct Supabase query calls in views to destructure `{ data, error }` and call `showError(error.message)` when error is non-null, replacing silent `if (data) setSomething(data)` pattern
- [ ] T051 [P] [US4] Add division-by-zero guards in `views/RoastingView.tsx` — replace `((batch.preWeight - post) / batch.preWeight * 100)` with `safeDivide(batch.preWeight - post, batch.preWeight, 0) * 100`
- [ ] T052 [P] [US4] Add division-by-zero guard in `views/AIInsights.tsx` — replace `((selling - cost) / selling) * 100` with `safeDivide(selling - cost, selling, 0) * 100`

**Checkpoint**: All Supabase errors surfaced to users via toasts. Division-by-zero displays 0%. No silent error discarding.

---

## Phase 7: User Story 5 - Improve Type Safety (Priority: P3)

**Goal**: Replace `any` types with proper TypeScript interfaces for Supabase data, starting with service files and highest-risk view files.

**Independent Test**: Run `npm run lint` and TypeScript compiler; verify no `any` type warnings for data flowing from Supabase queries.

### Implementation for User Story 5

- [ ] T053 [US5] Import generated types from `types/database.ts` into all service files (`services/beverageService.ts`, `services/crmService.ts`, `services/inventoryService.ts`, `services/shiftService.ts`, `services/geminiService.ts`) and replace `any` return types with proper database types
- [ ] T054 [P] [US5] Replace `useState<any[]>([])` with proper typed state in `views/DashboardView.tsx` — import database types for green beans, locations, transactions
- [ ] T055 [P] [US5] Replace `useState<any[]>([])` with proper typed state in `views/RoastingView.tsx` — import database types for beans, locations, monthly consumption
- [ ] T056 [P] [US5] Replace `useState<any[]>([])` with proper typed state in `views/ReportsView.tsx` — import database types for transactions, inventory
- [ ] T057 [P] [US5] Replace `useState<any>(null)` with proper typed state in `views/POSView.tsx` — import database types for lastTransaction, lastReturnRequest, shiftReport; replace `new Map<string, any>()`
- [ ] T058 [P] [US5] Replace `useState<any[]>([])` with proper typed state in `views/BranchPerformanceView.tsx`, `views/InventoryView.tsx`, `views/AIInsights.tsx`, `views/ConfigurationView.tsx`
- [ ] T059 [P] [US5] Replace all `catch (err: any)` with `catch (err: unknown)` and type narrowing (`if (err instanceof Error)`) in `views/StaffView.tsx`, `views/POSView.tsx`, `views/ProfileView.tsx`, `views/CRMView.tsx`, `views/BranchPerformanceView.tsx`
- [ ] T060 [P] [US5] Update `components/reports/PersonalStatsPanel.tsx` — replace `TransactionRecord { items: any[] }` with proper typed interface from database types
- [ ] T061 [US5] Update `views/InventoryView.tsx` to add missing `Location` fields (`contact_person_name`, `contact_person_phone`, `contact_person_email`) to `types.ts` `Location` interface

**Checkpoint**: All service files and view files have proper TypeScript types. No `any` for Supabase data. TypeScript compiler passes with no type warnings for data flows.

---

## Phase 8: User Story 6 - Add Code Quality Tooling (Priority: P3)

**Goal**: ESLint + Prettier configured, existing code formatted, lint errors identified.

**Independent Test**: Run `npm run lint` and `npm run format:check`; verify reports pass with consistent style.

### Implementation for User Story 6

- [ ] T062 [US6] Run `npm run format` to apply Prettier formatting to all `.ts`, `.tsx`, `.js`, `.jsx` files
- [ ] T063 [US6] Run `npm run lint` and fix all auto-fixable lint errors with `npm run lint:fix`
- [ ] T064 [US6] Manually fix remaining lint errors (unused imports, missing dependencies in useEffect, etc.) across all view and service files
- [ ] T065 [P] [US6] Remove all `console.log` statements from production code in `views/ReportsView.tsx` (~lines 107, 161-166), `views/RoastingView.tsx` (~line 276), `views/BranchPerformanceView.tsx` (~lines 226, 236, 318, 332), `views/POSView.tsx` (~line 984)
- [ ] T066 [P] [US6] Deduplicate `toNumber()` helper — remove from `views/POSView.tsx`, `views/ConfigurationView.tsx`, `views/InventoryView.tsx` and import from `utils/numbers.ts` instead
- [ ] T067 [P] [US6] Deduplicate `getAvailableStock()` logic — remove from `views/POSView.tsx` and `views/InventoryView.tsx` and create shared `utils/inventory.ts`
- [ ] T068 [P] [US6] Move embedded SQL migration from `views/ConfigurationView.tsx` (lines 565-1390) to a separate `migrations/` file; update the component to reference it or load from API instead

**Checkpoint**: `npm run lint` passes with zero errors. Code is consistently formatted. Duplicated utilities consolidated. Debug logging removed.

---

## Phase 9: User Story 7 - Establish Test Coverage (Priority: P3)

**Goal**: Set up test framework and write tests for checkout flow, inventory management, and authentication.

**Independent Test**: Run `npm run test` and verify all critical path tests pass.

### Implementation for User Story 7

- [ ] T069 [US7] Configure Vitest test environment with jsdom, React Testing Library, and MSW mocks in `vitest.config.ts` and `__tests__/setup.ts`
- [ ] T070 [US7] Create MSW handlers for Supabase auth endpoints in `__tests__/mocks/supabase.ts`
- [ ] T071 [P] [US7] Write integration test for POS checkout flow in `__tests__/checkout.test.tsx` — test successful checkout, insufficient stock rejection, concurrent checkout handling, error recovery
- [ ] T072 [P] [US7] Write integration test for inventory management in `__tests__/inventory.test.tsx` — test stock addition, deduction, transfer voucher XSS prevention, error handling
- [ ] T073 [P] [US7] Write integration test for authentication in `__tests__/auth.test.tsx` — test valid login, invalid credentials, demo mode flag, role-based access
- [ ] T074 [US7] Write unit tests for `utils/numbers.ts` — test `toNumber` with various inputs (strings, null, undefined, valid numbers), test `safeDivide` with zero denominator
- [ ] T075 [US7] Write unit tests for `utils/escaper.ts` — test `escapeHtml` with XSS payloads, special characters, empty strings
- [ ] T076 [US7] Write unit tests for `utils/demoMode.ts` — test `isDemoMode()` in dev vs production env, test `getDemoUserId()` returns null in production
- [ ] T077 [US7] Verify all tests pass with `npm run test` and coverage meets 80% threshold for checkout, inventory, and auth flows

**Checkpoint**: Test framework operational. 80% coverage on critical paths. All tests pass.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Accessibility fixes, cross-cutting improvements, and final validation.

- [ ] T078 [P] Add `aria-label` attributes to all icon-only buttons in `views/StaffView.tsx` (~line 168), `views/RoastingView.tsx` (~lines 587, 724), `views/CRMView.tsx` (~lines 265-269), `views/InventoryView.tsx` (multiple action buttons), `views/POSView.tsx` (cart action buttons)
- [ ] T079 [P] Add visible `<label>` elements with `htmlFor` for form inputs in `views/POSView.tsx` (cash received input), `views/RoastingView.tsx` (pre-weight input), `views/CRMView.tsx` (phone input)
- [ ] T080 [P] Add `aria-live="polite"` regions for dynamic content updates in `components/reports/PersonalStatsPanel.tsx` and `views/POSView.tsx` (cart total, item count)
- [ ] T081 [P] Add text alternatives for color-only status indicators in `views/StaffView.tsx` (~lines 148-150 employment status dots) and `views/DashboardView.tsx` (low stock warnings)
- [ ] T082 Replace `crypto.randomUUID()` calls in `views/RoastingView.tsx` (~lines 53, 160, 213) with `uuid` package or polyfill for browser compatibility
- [ ] T083 Fix `useMemo` dependency issues — memoize translation object in `views/StaffView.tsx` (~line 215) and `views/LoginView.tsx` (~line 24) to prevent unnecessary recalculations
- [ ] T084 Fix `useEffect` dependency issues — wrap `fetchDashboardData` in `useCallback` in `views/DashboardView.tsx` (~line 53) and `views/CRMView.tsx` (~line 42)
- [ ] T085 Run full accessibility audit with keyboard navigation and screen reader testing
- [ ] T086 Run `quickstart.md` validation — execute each step and verify all checkpoints pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Phase 2 (ErrorBoundary, Toast, useTimeout shared components; migrations for process_checkout RPC)
- **User Story 2 (Phase 4)**: Depends on Phase 2 (ErrorBoundary, Toast, ConfirmationModal, useTimeout, useErrorToast)
- **User Story 3 (Phase 5)**: Depends on Phase 2 (migrations, demoMode util) and Phase 1 (env vars)
- **User Story 4 (Phase 6)**: Depends on Phase 2 (useErrorToast hook, Toast component, safeDivide util)
- **User Story 5 (Phase 7)**: Depends on Phase 2 (types/database.ts). Can proceed in parallel with US3/US4 but benefits from US4 error pattern.
- **User Story 6 (Phase 8)**: Depends on Phase 1 (ESLint/Prettier config). Can proceed once Phase 1 is complete.
- **User Story 7 (Phase 9)**: Depends on Phase 2 (Vitest config) and some implementation from US1-US4 for meaningful test targets.
- **Polish (Phase 10)**: Depends on all user stories being complete.

### User Story Dependencies

- **US1 (Security)**: Can start after Phase 2. Core security — no dependency on other stories.
- **US2 (Error Boundaries)**: Can start after Phase 2. Independent of US1 but benefits from shared components.
- **US3 (RLS Policies)**: Can start after Phase 2. Depends on Phase 1 (env vars) and Phase 2 (migrations, demoMode).
- **US4 (Error Surfacing)**: Can start after Phase 2. Independent of other stories but naturally follows US2 (both touch view files).
- **US5 (Type Safety)**: Can start after Phase 2. Independent. Progressively apply types.
- **US6 (Linting)**: Can start after Phase 1. Independent. Format all files first.
- **US7 (Testing)**: Can start after Phase 2. Best after US1-US4 have implementation to test.

### Parallel Opportunities

- **Phase 1**: T002-T009 all parallel (different files)
- **Phase 2**: T014-T018 parallel (different components), T020-T023 parallel (different migration files)
- **Phase 3 (US1)**: T024, T025, T026 can proceed sequentially; T027-T028 are verification tasks
- **Phase 4 (US2)**: T030-T037 all parallel (different files)
- **Phase 5 (US3)**: T045-T048 parallel (different service files), T051-T052 parallel (different views)
- **Phase 6 (US4)**: Same as US3 above
- **Phase 7 (US5)**: T054-T061 all parallel (different files)
- **Phase 8 (US6)**: T065-T068 all parallel (different files)
- **Phase 9 (US7)**: T071-T073 parallel (different test files), T074-T076 parallel (different utils)
- **Phase 10 (Polish)**: T078-T081 parallel (different views), T082-T084 parallel (different files)

---

## Parallel Example: Phase 4 (User Story 2)

```bash
# All Timer/Alert replacements can run in parallel (different files):
Task: "Replace setTimeout in RoastingView.tsx with useTimeout hook"
Task: "Replace setTimeout in POSView.tsx with useTimeout hook"
Task: "Replace setTimeout in ReportsView.tsx with useTimeout hook"
Task: "Replace setTimeout in BranchPerformanceView.tsx with useTimeout hook"
Task: "Replace window.confirm in CRMView.tsx with ConfirmationModal"
Task: "Replace window.alert in POSView.tsx with useErrorToast"

# After all parallel tasks complete:
Task: "Verify no window.alert/confirm/setTimeout leaks remain in any view"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (Security Vulnerabilities)
4. **STOP and VALIDATE**: Test US1 independently — verify .env not tracked, XSS mitigated, checkout atomic
5. Deploy if ready — application is now secure

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy (MVP — security patched!)
3. Add User Story 2 → Test independently → Deploy (no more white-screen crashes)
4. Add User Story 3 → Test independently → Deploy (RLS enforced)
5. Add User Story 4 → Test independently → Deploy (errors surfaced, no silent failures)
6. Add User Stories 5-7 + Polish → Full quality improvement delivered

### Parallel Team Strategy

With multiple developers after Phase 2 completes:

- **Developer A**: US1 (Security) → US3 (RLS Policies)
- **Developer B**: US2 (Error Boundaries) → US4 (Error Surfacing)
- **Developer C**: US6 (Linting/Formatting) → US5 (Type Safety)
- **Developer D**: US7 (Tests) — starts after US1-US2 have implementation to test

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Migration tasks (T020-T023) must be applied to Supabase before client code can reference new schemas
- T038-T040 should be applied sequentially to Supabase in order
- `console.log` removal (T065) should happen after US4 error surfacing is in place so developers have alternatives
- Type safety (US5) is progressive — `any` types in files not updated in this feature can be addressed later
- Commit after each task or logical group; verify at each checkpoint