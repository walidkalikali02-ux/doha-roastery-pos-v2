# Feature Specification: Fix Critical and High-Priority Engineering Issues

**Feature Branch**: `004-fix-engineering-issues`  
**Created**: 2026-04-18  
**Status**: Draft  
**Input**: User description: "Fix all critical and high-priority engineering issues identified in the codebase analysis — 40 issues across security, type safety, runtime errors, React anti-patterns, performance, code quality, database/RLS, accessibility, and testing/tooling."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Secure Application From Vulnerabilities (Priority: P1)

As a system administrator, I need all critical security vulnerabilities patched so that the application is protected against secret exposure, cross-site scripting attacks, and unauthorized data access. This includes preventing .env files from being committed, moving hardcoded credentials to environment variables, fixing XSS in the transfer voucher print function, and ensuring checkout operations are atomic to prevent data corruption.

**Why this priority**: Security vulnerabilities pose immediate risk of data breach, financial manipulation, and credential exposure. Without this foundation, all other improvements are built on insecure ground.

**Independent Test**: Can be fully tested by attempting to exploit each vulnerability (commit .env, inject script via voucher fields, manipulate checkout mid-transaction, access Supabase client with hardcoded keys) and verifying each is now mitigated.

**Acceptance Scenarios**:

1. **Given** a `.env` file exists in the project, **When** a developer attempts to commit it, **Then** git rejects the file and it is excluded from version control
2. **Given** the application loads, **When** a user views the Supabase client initialization, **Then** credentials are read from environment variables, not hardcoded strings
3. **Given** a user creates a transfer voucher with a destination name containing `<script>alert('xss')</script>`, **When** the voucher is printed, **Then** the script is not executed and the content is safely escaped
4. **Given** a POS checkout is in progress, **When** an inventory update fails after the transaction is recorded, **Then** the entire operation rolls back and no partial data is persisted

---

### User Story 2 - Prevent App Crashes With Error Boundaries (Priority: P1)

As a cashier using the POS system, I need the application to gracefully handle unexpected errors so that one broken component does not crash the entire application. When an error occurs in a view, I should see an error message for that section while the rest of the application remains functional.

**Why this priority**: Without error boundaries, any runtime error in any view crashes the entire app with a white screen — unacceptable for a production POS system where uptime is critical.

**Independent Test**: Can be tested by triggering an error in any view and verifying the app continues to function with an error message shown only in the affected area.

**Acceptance Scenarios**:

1. **Given** the application is running, **When** an unexpected error occurs in the Dashboard view, **Then** a user-friendly error message appears in place of the dashboard content while navigation and other views remain functional
2. **Given** an error boundary catches an error, **When** the user clicks "Try Again", **Then** the failed component re-renders in-place without losing navigation state or unsaved data in other views
3. **Given** an error boundary catches an error and "Try Again" also fails, **When** the user clicks "Reload Page", **Then** the full page reloads as a last resort

---

### User Story 3 - Harden Database Access With Role-Based Policies (Priority: P2)

As a business owner, I need data access restricted by user role so that cashiers cannot modify inventory or financial records, and employees cannot access sensitive HR data. Currently, any authenticated user has full read/write access to critical tables including financial records, customer data, and inventory.

**Why this priority**: Overly permissive RLS policies allow any authenticated user to modify financial records, inventory, and customer data — a significant security and compliance risk, but slightly lower priority than P0 crashes and XSS.

**Independent Test**: Can be tested by logging in as different user roles (CASHIER, ROASTER, MANAGER, ADMIN) and verifying each role can only access and modify data appropriate to their role.

**Acceptance Scenarios**:

1. **Given** a user with CASHIER role, **When** they attempt to modify a green_bean record directly, **Then** the operation is denied by RLS policy
2. **Given** a user with CASHIER role, **When** they view transactions, **Then** they only see their own transactions (matched by cashier_id, not by name)
3. **Given** a MANAGER role user, **When** they view an employee's profile, **Then** they cannot see salary_base, bank_name, or iban fields (restricted to ADMIN and HR)
4. **Given** an unauthenticated user, **When** they attempt to read locations data, **Then** the request is denied

---

### User Story 4 - Surface Errors Instead of Failing Silently (Priority: P2)

As a staff member using the application, I need to be informed when operations fail so that I am not left waiting for data that will never load. Currently, Supabase query errors are silently discarded across the entire application, leaving the UI in stale or broken states.

**Why this priority**: Silent errors create confusing user experiences where nothing appears wrong but data is missing or actions have no effect. This directly impacts trust in the system.

**Independent Test**: Can be tested by simulating network failures or Supabase errors and verifying the user sees an appropriate error message instead of a blank or stale view.

**Acceptance Scenarios**:

1. **Given** the network is unavailable, **When** a user loads the Dashboard, **Then** an error message is displayed indicating the data could not be loaded, rather than showing empty or stale data
2. **Given** a Supabase query returns an error, **When** the user attempts an action, **Then** a toast notification appears with the error details
3. **Given** an operation partially fails, **When** the user reviews the result, **Then** they are clearly informed of what succeeded and what failed

---

### User Story 5 - Improve Type Safety Across the Application (Priority: P3)

As a developer maintaining the codebase, I need proper TypeScript types instead of `any` so that compile-time errors catch bugs before they reach production. Currently, 40+ instances of `any` types mean the type checker provides no protection for most data flows.

**Why this priority**: Type safety is essential for maintainability and reducing runtime bugs, but it is a progressive improvement rather than an urgent fix.

**Independent Test**: Can be tested by enabling strict TypeScript checks and verifying that all view files compile without errors, and that previously `any`-typed data flows now have proper interfaces.

**Acceptance Scenarios**:

1. **Given** a developer runs the TypeScript compiler, **When** it processes view and service files, **Then** no `any` type warnings are produced for data flowing from Supabase queries
2. **Given** a Supabase query returns data, **When** the data is used in a component, **Then** the IDE provides autocomplete and type checking for all properties
3. **Given** a developer changes a type definition, **When** they compile, **Then** all affected components show type errors at the change site

---

### User Story 6 - Add Code Quality Tooling (Priority: P3)

As a developer, I need linting and formatting tools configured so that code style is consistent across the team and common errors are caught automatically. Currently there is no ESLint, Prettier, or pre-commit hooks.

**Why this priority**: Code quality tooling prevents regressions and enforces standards, enabling other improvements to be sustained. However, it does not directly fix existing vulnerabilities.

**Independent Test**: Can be tested by running the new lint and format commands and verifying they catch errors and enforce consistent style across all source files.

**Acceptance Scenarios**:

1. **Given** ESLint is configured, **When** a developer runs the lint command, **Then** it reports all existing code quality issues with specific file and line numbers
2. **Given** Prettier is configured, **When** a developer runs the format command, **Then** all source files are reformatted to a consistent style
3. **Given** pre-commit hooks are configured, **When** a developer commits code with lint errors, **Then** the commit is rejected with a descriptive error message

---

### User Story 7 - Establish Test Coverage for Critical Paths (Priority: P3)

As a developer, I need automated tests for the most critical business flows (checkout, inventory management, authentication) so that changes do not introduce regressions. Currently there is 0% test coverage.

**Why this priority**: Without tests, any change could break critical business operations without detection. However, establishing tests for a previously untested codebase is a progressive effort.

**Independent Test**: Can be tested by running the test suite and verifying that all critical path tests pass, including checkout flow, inventory deduction, and authentication scenarios.

**Acceptance Scenarios**:

1. **Given** the test framework is set up, **When** a developer runs tests, **Then** tests for the checkout flow verify that transactions are created, inventory is deducted, and shifts are updated
2. **Given** a test for inventory management, **When** stock is added or deducted, **Then** available quantities update correctly
3. **Given** a test for authentication, **When** invalid credentials are entered, **Then** login is rejected with an appropriate message

---

### Edge Cases

- What happens when a checkout operation fails mid-way due to a network interruption? The entire operation must roll back with no partial data persisted.
- What happens when two cashiers attempt to sell the same last item simultaneously? The second transaction must be rejected with a clear "Item no longer in stock" error; stock must never go below zero.
- What happens when two users with the same cashier name exist in the system? Transactions must be correctly attributed by unique ID, not by name.
- What happens when `window.print()` is called and the component unmounts before the print dialog closes? Timer cleanup must prevent state updates on unmounted components.
- What happens when a user with CASHIER role tries to access an admin-only API directly (bypassing the UI)? RLS policies must reject the operation server-side regardless of client claims.
- What happens when division by zero occurs in waste percentage or profit margin calculations? The system must display 0% or a safe default rather than `Infinity` or `NaN`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST exclude `.env` files from version control by adding `.env` to `.gitignore` and removing any tracked `.env` from git history
- **FR-002**: System MUST read all Supabase connection credentials from environment variables rather than hardcoded strings in source code
- **FR-003**: System MUST escape all user-controlled data before rendering it in HTML, particularly in the transfer voucher print function
- **FR-004**: System MUST execute POS checkout as an atomic operation where transaction creation, inventory deduction, and shift update all succeed or all roll back together. If stock is insufficient for any item (e.g., due to concurrent sales), the entire checkout must be rejected with a clear "Item no longer in stock" message; stock must never go below zero.
- **FR-005**: System MUST display a user-friendly error message when any view component encounters a runtime error, without crashing the entire application. The error boundary must provide a "Try Again" button that re-renders the failed component in-place without losing navigation state or unsaved data in other views, and a secondary "Reload Page" link as a last resort if the retry fails.
- **FR-006**: System MUST enforce role-based Row Level Security (RLS) policies on all database tables so that users can only access and modify data appropriate to their assigned role
- **FR-016**: System MUST gate the demo-user authentication bypass behind a development-only feature flag that is disabled in production builds; all demo-user logic must be centralized in a single utility module
- **FR-007**: System MUST match cashier transactions by unique user ID (`cashier_id` column) rather than by name string, preventing data leakage between cashiers with identical names. Existing historical transactions must be backfilled by matching `cashier_name` to `profiles.full_name` or `profiles.username`; any records that cannot be matched must be flagged for manual review.
- **FR-008**: System MUST display meaningful error messages to users when Supabase queries fail, rather than silently discarding errors
- **FR-009**: System MUST handle division-by-zero scenarios gracefully by displaying 0% or a safe default value instead of `Infinity` or `NaN`
- **FR-010**: System MUST clean up all `setTimeout` calls when components unmount to prevent state updates on unmounted components
- **FR-011**: System MUST enforce consistent code style and catch common errors via automated linting and formatting tools
- **FR-012**: System MUST have automated tests covering at minimum the checkout flow, inventory management, and authentication
- **FR-013**: System MUST replace all `window.confirm()` and `window.alert()` calls with accessible custom modal and toast components. Modal dialogs are used for destructive or confirmation actions requiring an explicit user response (e.g., delete, void transaction, refund approval). Toast notifications are used for informational feedback that auto-dismisses (e.g., success, error, warning messages).
- **FR-014**: System MUST provide accessible labels for all icon-only buttons, form inputs, and dynamic content updates via `aria-label` and `aria-live` attributes
- **FR-015**: System MUST restrict access to sensitive employee fields (salary, bank details, national ID) to ADMIN and HR roles only, not to MANAGER role

### Key Entities

- **Error Boundary**: A reusable component that catches runtime errors in its child component tree, displays a fallback UI with a "Try Again" button to re-render the failed component in-place (preserving navigation state and unsaved data in other views), and a secondary "Reload Page" link as a last resort if the retry fails
- **Toast Notification**: A transient, auto-dismissing message component for surfacing informational feedback (success, error, warning) without requiring user action
- **Confirmation Modal**: A blocking dialog component for destructive or irreversible actions (delete, void, refund) that requires explicit user confirmation before proceeding
- **Role-Based Access Policy**: Database-level policies that govern which user roles can perform which operations on each table, enforced server-side regardless of client behavior
- **Atomic Checkout Transaction**: A server-side operation that creates a sale transaction, deducts inventory, and updates shift records as a single indivisible unit
- **Demo Mode Flag**: A development-only feature flag that gates all demo-user authentication bypass logic; centralized in a single utility module and disabled in production builds

## Clarifications

### Session 2026-04-18

- Q: What should happen when two cashiers attempt to sell the same last item simultaneously? → A: Reject the second transaction with "Item no longer in stock" error; stock must never go below zero.
- Q: When should modal vs. toast be used for notifications? → A: Modals for destructive/confirmation actions requiring explicit response (delete, void, refund); toasts for informational feedback that auto-dismisses (success, error, warning).
- Q: Should the existing "demo-user" bypass logic be removed entirely or gated behind a development-only feature flag? → A: Gate behind a development-only feature flag; all demo-user paths check the flag and are disabled in production builds; scattered logic centralized to a single utility module.
- Q: What scope should the cashier_id migration cover — add column and backfill, or start fresh? → A: Add `cashier_id` column and backfill existing transactions by matching `cashier_name` to `profiles.full_name` or `profiles.username`; records that cannot be matched must be flagged for manual review.
- Q: What error recovery experience should error boundaries provide — retry or full reload? → A: Both — "Try Again" re-renders the failed component in-place without losing state; secondary "Reload Page" link as a last resort if retry fails.

## Assumptions

- `.env` file currently contains placeholder values (`GEMINI_API_KEY=YOUR_API_KEY_HERE`) and no real secrets have been committed that need rotation
- The existing Supabase anon key is considered public but should still be externalized for easier rotation
- Role-based RLS policies will follow the existing role hierarchy: ADMIN, MANAGER, HR, ROASTER, CASHIER, WAREHOUSE_STAFF
- The test framework will use Vitest and React Testing Library, consistent with the Vite + React stack
- Error boundaries will be implemented per-view (not per-component) as a pragmatic starting point
- God component refactoring (breaking up 1000+ line files) is deferred to future work and not in scope for this feature
- Removing `any` types is a progressive effort — Phase 1 focuses on generating Supabase types and replacing the highest-risk `any` usages, not eliminating all instances immediately

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero secrets or credentials are hardcoded in tracked source files (verifiable by searching for `supabaseUrl` and `supabaseAnonKey` string literals)
- **SC-002**: Any runtime error in a view component results in a localized error message with a "Try Again" button rather than a full application crash; if retry fails, a "Reload Page" link is available as a fallback (verifiable by triggering errors in each view)
- **SC-003**: All database tables have role-based RLS policies where no table grants full CRUD access to all authenticated users; cashier transactions are matched by `cashier_id` with historical data fully backfilled (verifiable by auditing RLS policies in Supabase dashboard and confirming zero unmigrated cashier records)
- **SC-004**: POS checkout is atomic — no scenario can result in a recorded transaction without corresponding inventory deductions, and concurrent sales of the last item result in a "no longer in stock" rejection rather than negative stock (verifiable by simulating mid-checkout failures and concurrent checkout attempts)
- **SC-005**: All Supabase error responses are surfaced to the user within 3 seconds (verifiable by simulating network failures)
- **SC-006**: Division-by-zero calculations display 0% rather than `Infinity` or `NaN` (verifiable by entering zero values in waste and margin calculations)
- **SC-007**: No user-controlled data renders as unescaped HTML in any print or display function (verifiable by injecting script tags in all input fields)
- **SC-008**: Linting passes with zero errors on all source files (verifiable by running the lint command)
- **SC-009**: Critical path tests exist for checkout, inventory, and authentication with at least 80% coverage of those specific flows (verifiable by running the test suite)
- **SC-010**: All icon-only buttons have visible or programmatic labels accessible to screen readers (verifiable by accessibility audit)