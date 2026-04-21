# Quickstart Guide: Fix Critical and High-Priority Engineering Issues

**Branch**: `004-fix-engineering-issues` | **Date**: 2026-04-18

## Prerequisites

- Node.js 18+ and npm 9+
- Supabase CLI installed (`npm install -g supabase`)
- Access to the Supabase project (for generating types and running migrations)
- PostgreSQL client (for running migration SQL)

## Step 1: Environment Setup

```bash
# 1. Create .env.example from current .env
cat .env | sed 's/=.*/=/' > .env.example
# Add template values:
# VITE_SUPABASE_URL=
# VITE_SUPABASE_ANON_KEY=
# VITE_GEMINI_API_KEY=
# VITE_DEMO_MODE=false

# 2. Add .env to .gitignore
echo ".env" >> .gitignore

# 3. Remove .env from git tracking (keep local file)
git rm --cached .env

# 4. Update supabaseClient.ts to use env vars
# Replace hardcoded values with:
# const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
# const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;
```

## Step 2: Install New Dependencies

```bash
# Error boundary utility
npm install react-error-boundary

# Testing framework
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom msw

# Linting and formatting
npm install -D eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-plugin-react eslint-plugin-react-hooks eslint-config-prettier prettier lint-staged husky

# UUID polyfill (for crypto.randomUUID fallback)
npm install uuid
npm install -D @types/uuid
```

## Step 3: Configure ESLint and Prettier

```bash
# Initialize ESLint config
npx eslint --init

# Add scripts to package.json:
# "lint": "eslint . --ext .ts,.tsx",
# "lint:fix": "eslint . --ext .ts,.tsx --fix",
# "format": "prettier --write .",
# "format:check": "prettier --check .",
# "test": "vitest",
# "test:run": "vitest run",
# "prepare": "husky install"

# Set up pre-commit hooks
npx husky install
npx husky add .husky/pre-commit "npx lint-staged"
```

## Step 4: Generate Supabase Types

```bash
# Generate TypeScript types from database schema
npx supabase gen types typescript --project-id <project-ref> > types/database.ts
```

## Step 5: Run Database Migrations

Execute the following migrations in order on the Supabase project:

1. `migrations/20260418_add_cashier_id_column.sql` — Add `cashier_id` column to transactions
2. `migrations/20260418_rls_role_based_policies.sql` — Replace blanket policies with role-based ones
3. `migrations/20260418_role_helper_functions.sql` — Create `current_user_is_admin()`, `current_user_is_manager()`, etc.

```bash
# Apply migrations via Supabase CLI or Dashboard SQL Editor
supabase db push
# Or execute each file manually in the Dashboard SQL Editor
```

## Step 6: Create New Components and Hooks

### Files to Create

| File | Purpose |
|------|---------|
| `components/common/ErrorBoundary.tsx` | Error boundary with "Try Again" and "Reload Page" |
| `components/common/Toast.tsx` | Toast notification component |
| `components/common/ConfirmationModal.tsx` | Confirmation dialog replacing `window.confirm()` |
| `hooks/useErrorToast.ts` | Hook for surfacing Supabase errors as toasts |
| `hooks/useTimeout.ts` | Safe setTimeout hook with cleanup |
| `utils/demoMode.ts` | Centralized demo-user feature flag |
| `utils/numbers.ts` | Shared `toNumber()` and `safeDivide()` utilities |
| `utils/escaper.ts` | HTML escaping for print functions |
| `__tests__/checkout.test.tsx` | Checkout flow tests |
| `__tests__/inventory.test.tsx` | Inventory management tests |
| `__tests__/auth.test.tsx` | Authentication tests |
| `vitest.config.ts` | Vitest configuration |

## Step 7: Wrap Views with Error Boundaries

In `App.tsx`, wrap each view component with `ErrorBoundary`:

```tsx
import { ErrorBoundary } from './components/common/ErrorBoundary';

// Replace direct view rendering:
<DashboardView />
// With:
<ErrorBoundary><DashboardView /></ErrorBoundary>
```

Apply this pattern to all 13 views.

## Step 8: Replace `window.confirm()` / `window.alert()`

Systematically find and replace each instance:

```bash
# Find all instances
grep -rn "window.confirm\|window.alert" views/ services/
```

For each instance:
1. If the action is destructive (delete, void, refund) → replace with `ConfirmationModal`
2. If the action is informational (success, error, warning) → replace with `useErrorToast`

## Step 9: Fix XSS in Print Functions

In `utils/escaper.ts`, create the escaping function. Then update `InventoryView.tsx`'s `printTransferVoucher` to use `escapeHtml()` on all dynamic values.

## Step 10: Create Atomic Checkout RPC

Create the `process_checkout` PostgreSQL function in Supabase. Update `POSView.tsx` to call `supabase.rpc('process_checkout', { ... })` instead of the current multi-step approach.

## Verification Checklist

- [ ] `.env` is in `.gitignore` and not tracked
- [ ] `supabaseClient.ts` reads from `import.meta.env.VITE_*`
- [ ] All `window.confirm()` / `window.alert()` replaced
- [ ] All views wrapped in `ErrorBoundary`
- [ ] XSS test passes (script tags in voucher fields don't execute)
- [ ] `npm run lint` passes with zero errors
- [ ] `npm run test` passes all critical path tests
- [ ] RLS policies reject unauthorized access (test with each role)
- [ ] Concurrent checkout fails gracefully when stock is insufficient
- [ ] Division by zero returns 0% instead of NaN/Infinity
- [ ] Demo mode is disabled in production builds