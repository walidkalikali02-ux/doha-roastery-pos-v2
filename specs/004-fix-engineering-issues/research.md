# Research: Fix Critical and High-Priority Engineering Issues

**Branch**: `004-fix-engineering-issues` | **Date**: 2026-04-18

## Research Tasks

### R-001: React Error Boundary Best Practices

**Decision**: Use per-view class-based ErrorBoundary component with "Try Again" (reset state) and "Reload Page" (window.location.reload) fallback.

**Rationale**: React 19 still requires class components for error boundaries (no hook equivalent). Per-view boundaries limit blast radius — one view crashing doesn't affect navigation or other tabs. The "Try Again" button calls `resetErrorBoundary()` (react-error-boundary pattern) which re-renders the children. "Reload Page" is a last resort for persistent errors.

**Alternatives considered**:
- `react-error-boundary` npm package — adds a dependency but provides `useErrorBoundary` hook and `ErrorBoundary` wrapper. Decided to use it for convenience and community support.
- Global error boundary only — simpler but causes entire app unmount; rejected because spec requires localized errors per-view.
- `componentDidCatch` in App.tsx — too coarse-grained; crashes the whole app.

### R-002: Environment Variable Strategy for Vite + Supabase

**Decision**: Use Vite's `import.meta.env` with `VITE_` prefix for all client-side variables. Create `.env.example` template. Move Supabase credentials to `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

**Rationale**: Vite only exposes env vars prefixed with `VITE_` to the client bundle. This is the documented and recommended approach. Supabase anon keys are designed to be public, but externalizing them enables per-environment configuration (dev/staging/prod) and easy key rotation.

**Alternatives considered**:
- Runtime config injection via `window.__ENV__` — unnecessary complexity for a SPA; Vite's build-time replacement is sufficient.
- `dotenv` package — Vite already handles `.env` files natively; no additional package needed.
- Hardcoded with `.env` as backup — current broken state; fully rejected.

### R-003: XSS Prevention in Print Functions

**Decision**: Replace `document.write()` with a dedicated HTML escaping utility function (`escapeHtml`) applied to all dynamic values before interpolation. For complex print templates, use `URL.createObjectURL(new Blob([...]))` + `window.open()` pattern.

**Rationale**: `document.write()` is inherently dangerous for XSS and is deprecated in modern web standards. The `escapeHtml` utility handles the common case. For the transfer voucher, constructing a safe HTML string with all values escaped and opening in a new window/print tab avoids XSS while preserving the print workflow.

**Alternatives considered**:
- DOMPurify library — adds a dependency; overkill for this use case where we control all template content.
- React portal-based print component — would require significant refactoring of the print flow; deferred to future work.
- Sanitize only item names (current approach) — incomplete; other fields like `status`, `sourceName`, `destName` remain vulnerable.

### R-004: Atomic Checkout via Supabase RPC

**Decision**: Create a Supabase PostgreSQL function `process_checkout()` that wraps transaction insert, inventory deduction, and shift update in a single database transaction with explicit row-level locking (`SELECT ... FOR UPDATE`) to prevent concurrent stock issues.

**Rationale**: The current checkout flow makes 3+ separate async calls with no database-level transaction. If any step fails after the transaction insert, data becomes inconsistent. A PostgreSQL function ensures atomicity. Using `SELECT ... FOR UPDATE` on inventory items before deducting prevents the concurrent-sales-of-last-item scenario.

**Alternatives considered**:
- Application-level transaction with compensating actions — complex, error-prone, and still subject to race conditions.
- Optimistic concurrency control with version numbers — adds complexity; database-level locking is simpler and more reliable for a POS system.
- Separate RPCs per step — still not atomic; defers the core problem.

### R-005: Error Handling Pattern for Supabase Queries

**Decision**: Create a `useErrorToast` hook that wraps all Supabase queries. Pattern: `const { data, error } = await supabase...; if (error) { showErrorToast(error.message); return; }`. Also create a `withErrorHandling` wrapper for service functions.

**Rationale**: Centralizing error surfacing in a hook ensures every query follows the same pattern. The toast approach is non-blocking (per FR-013: toasts for informational feedback). This is minimal overhead to implement and can be applied file-by-file.

**Alternatives considered**:
- React Query / TanStack Query — would add a dependency and require significant refactoring of all data fetching. Too large a scope change for this feature.
- Global error interceptor on Supabase client — Supabase JS client doesn't support interceptors natively; would require wrapping the client.
- Try/catch around every query call — already partially done but inconsistent; the hook pattern is more maintainable.

### R-006: RLS Policy Architecture for Role-Based Access

**Decision**: Replace all `auth.role() = 'authenticated'` policies with role-specific helper functions: `current_user_is_admin()`, `current_user_is_manager()`, `current_user_is_cashier()`, etc. Add column-level security for sensitive employee fields. Add `cashier_id UUID` column to `transactions` table.

**Rationale**: The existing codebase already has `current_user_is_cashier()` defined in the cashier RLS migration. Extending this pattern to all roles provides consistent, auditable access control. Column-level security for salary/bank fields protects sensitive PII from MANAGER role. The `cashier_id` column eliminates name-based matching which has a known collision vulnerability.

**Alternatives considered**:
- Policy-per-role-per-table (direct `auth.jwt() ->> 'role'` checks) — harder to maintain; changes require updating many policies.
- Single helper `current_user_role()` returning the role string — simpler but requires every policy to check against a list; helper functions per role are more explicit and self-documenting.
- Application-level authorization only — already the status quo and insecure; server-side enforcement is required per FR-006.

### R-007: Demo Mode Feature Flag Implementation

**Decision**: Create a `utils/demoMode.ts` module that exports `isDemoMode()` checking `import.meta.env.VITE_DEMO_MODE === 'true'`. All demo-user checks throughout the codebase will route through this single module. In production builds, Vite's tree-shaking will eliminate demo-only code paths.

**Rationale**: Using Vite env vars with `VITE_` prefix is consistent with the environment variable strategy (R-002). The feature flag pattern allows demo/testing scenarios in development while ensuring production builds never activate demo mode. Centralizing all demo logic in one module makes it auditable and easy to disable.

**Alternatives considered**:
- Runtime feature flag service (LaunchDarkly, etc.) — overkill for a single flag; adds external dependency.
- Build-time constant (`if (import.meta.env.PROD)`) — doesn't allow toggling in development; less flexible.
- Remove entirely — rejected per clarification: demo mode is useful for development/testing.

### R-008: Testing Framework Setup

**Decision**: Vitest + React Testing Library + MSW (Mock Service Worker) for API mocking. Test directory at project root `__tests__/`. Configuration in `vitest.config.ts`.

**Rationale**: Vitest is the native test runner for Vite projects, using the same transform pipeline. React Testing Library is the standard for testing React components. MSW provides realistic API mocking for Supabase calls without relying on implementation details. The project already uses Vite, so Vitest is the zero-config choice.

**Alternatives considered**:
- Jest — requires complex Babel/SWC configuration for Vite+React; Vitest is native.
- Cypress — end-to-end testing only; doesn't replace unit/integration test needs.
- No API mocking (.hit real Supabase) — tests would be flaky, order-dependent, and require network access.

### R-009: Linting and Formatting Configuration

**Decision**: ESLint with `@typescript-eslint/recommended`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, and `eslint-config-prettier`. Prettier with 2-space indent, single quotes, trailing commas. Pre-commit hooks via `lint-staged` + `husky`. Scripts: `npm run lint`, `npm run lint:fix`, `npm run format`.

**Rationale**: These are the standard, well-maintained packages for a React + TypeScript project. `eslint-config-prettier` disables ESLint rules that conflict with Prettier, avoiding double-formatting issues. `lint-staged` ensures only staged files are linted on commit for speed. Starting with `recommended` configs (not `strict`) allows incremental adoption without blocking existing code.

**Alternatives considered**:
- Biome (Rome) — faster but less mature ecosystem; would be unfamiliar to most contributors.
- TSLint — deprecated; not an option for TypeScript 5.8.
- No Prettier (ESLint formatting only) — Prettier provides superior formatting with less configuration debate.

### R-010: TypeScript Type Generation for Supabase

**Decision**: Use Supabase CLI `supabase gen types typescript` to generate types from the database schema, importing them into a shared `types/database.ts` file. Replace `any` types incrementally, starting with service files (highest risk) then view files.

**Rationale**: Auto-generated types stay in sync with the database schema, eliminating the manual maintenance burden. Starting with service files (the data access layer) creates a typed boundary that views can consume. This incremental approach avoids a massive refactor while progressively improving type safety.

**Alternatives considered**:
- Manual type definitions — error-prone and goes stale; would create a maintenance burden.
- `zod` schema inference (the project already uses zod) — good for runtime validation but doesn't generate database types.
- Skip type generation, just remove `any` — without proper types, removing `any` creates a flood of `unknown` types that slow development.

### R-011: cashier_id Migration Strategy

**Decision**: Add `cashier_id UUID REFERENCES profiles(id)` column to `transactions` table as nullable first, then backfill using `UPDATE transactions SET cashier_id = p.id FROM profiles p WHERE transactions.cashier_name = COALESCE(p.full_name, p.username)`, then set `NOT NULL` constraint and add RLS policy matching on `cashier_id = auth.uid()`. Unmatched records get `cashier_id = NULL` and are flagged in a `migration_flags` table for manual review.

**Rationale**: The nullable-first approach avoids breaking existing inserts while the backfill runs. The `COALESCE` matching handles the same logic the RLS policy currently uses (full_name → username). NULL records are expected for demo-user transactions and historical edge cases, which can be audited and manually assigned.

**Alternatives considered**:
- Add column with default UUID (dummy value) — masks the fact that some records couldn't be matched; worse than NULL for auditing.
- Delete unmatched records — unacceptable data loss in a financial system.
- Simultaneous column + NOT NULL — would break all existing inserts until the application is updated; too risky for production.