# Implementation Plan: Fix Critical and High-Priority Engineering Issues

**Branch**: `004-fix-engineering-issues` | **Date**: 2026-04-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-fix-engineering-issues/spec.md`

## Summary

Address 40 engineering issues identified in the codebase analysis, prioritized by severity: P0 security vulnerabilities (exposed .env, hardcoded credentials, XSS, race conditions), P1 stability and correctness (error boundaries, type safety, RLS policies, silent errors, N+1 queries, no tests, no linting), and P2 maintainability (demo-user cleanup, division-by-zero, timer cleanup, code duplication, accessibility, embedded SQL). The approach is phased: immediate security hardening and crash prevention, then database policy enforcement and error surfacing, followed by progressive type safety, tooling, and test coverage.

## Technical Context

**Language/Version**: TypeScript 5.8 + React 19  
**Primary Dependencies**: Vite 6.2+, Supabase JS Client v2.45+, lucide-react, react-hook-form, zod, recharts  
**Storage**: Supabase (PostgreSQL) with Row Level Security  
**Testing**: Vitest + React Testing Library (to be added; currently 0% coverage)  
**Target Platform**: Web browser (POS system, desktop-first)  
**Project Type**: Single web application (no src/ directory, files at root level)  
**Performance Goals**: Checkout completes in <2 seconds; UI renders in <1 second; no full-app crashes  
**Constraints**: Must maintain backward compatibility with existing Supabase schema; POS operators cannot tolerate white-screen crashes  
**Scale/Scope**: ~13 views, 5 services, 6 user roles, multi-branch roastery POS  

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The constitution file (`.specify/memory/constitution.md`) contains only template placeholders and no defined principles, constraints, or governance rules. **No gates can fail** as there are no enforceable rules defined. Proceeding with standard engineering best practices as the de facto constitution.

| Principle | Status | Notes |
|-----------|--------|-------|
| N/A (empty constitution) | PASS | No defined principles to violate; defaulting to standard React/TypeScript/Supabase best practices |

## Project Structure

### Documentation (this feature)

```text
specs/004-fix-engineering-issues/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── rls-policies.md
│   └── error-handling.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
/ (project root - existing flat structure)
├── App.tsx                    # Main app shell (add ErrorBoundary wrapping, DemoMode flag)
├── index.tsx                  # Entry point
├── supabaseClient.ts          # Supabase init (migrate to env vars)
├── types.ts                   # Type definitions (replace `any` with generated Supabase types)
├── translations.ts            # i18n
├── contexts/
│   └── AuthContext.tsx         # Auth provider (centralize demo-user logic)
├── components/
│   ├── common/
│   │   ├── AccessDeniedToast.tsx
│   │   ├── ErrorBoundary.tsx   # NEW
│   │   ├── Toast.tsx           # NEW
│   │   └── ConfirmationModal.tsx # NEW
│   └── reports/
│       └── PersonalStatsPanel.tsx
├── hooks/
│   ├── useRoleGuard.ts
│   ├── useErrorToast.ts        # NEW
│   └── useTimeout.ts           # NEW
├── services/
│   ├── beverageService.ts
│   ├── crmService.ts
│   ├── geminiService.ts
│   ├── inventoryService.ts
│   ├── shiftService.ts
│   └── demoMode.ts             # NEW (centralized demo-user flag)
├── utils/
│   ├── reportExport.ts
│   ├── numbers.ts              # NEW (shared toNumber, safeDivide)
│   └── escaper.ts              # NEW (HTML escaping for print)
├── views/
│   ├── POSView.tsx              # Refactor (checkout RPC, error handling)
│   ├── InventoryView.tsx        # Refactor (XSS fix, shared utils)
│   └── ... (11 other views)
├── migrations/
│   ├── 20260330_cashier_rls_policies.sql
│   ├── 20260405_fix_cashier_crm_update.sql
│   ├── 20260409_create_transactions_table.sql
│   ├── fix_cashier_profile_update.sql
│   ├── 20260418_add_cashier_id_column.sql      # NEW
│   └── 20260418_rls_role_based_policies.sql     # NEW
├── __tests__/                   # NEW
│   ├── checkout.test.tsx
│   ├── inventory.test.tsx
│   └── auth.test.tsx
├── .env                         # (removed from git)
├── .env.example                 # NEW
├── .gitignore                   # (add .env)
├── .eslintrc.cjs                # NEW
├── .prettierrc                  # NEW
├── vitest.config.ts             # NEW
└── package.json                 # (add lint, test, format scripts)
```

**Structure Decision**: Maintaining the existing flat structure (no `src/` migration) to minimize change scope. New files follow existing patterns. Test directory and config files added at root level per Vitest conventions.

## Complexity Tracking

> No constitution violations to justify. The project structure remains flat as-is; migrating to `src/` is explicitly deferred per spec assumptions.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| N/A | N/A | N/A |