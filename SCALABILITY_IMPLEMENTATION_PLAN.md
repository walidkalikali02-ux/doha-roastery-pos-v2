# Doha Roastery Scalability Implementation Plan

**Source:** `SCALABILITY_ANALYSIS_REPORT.md`  
**Date:** March 19, 2026  
**Goal:** Convert the report findings into an actionable delivery plan that reduces structural risk, improves large-dataset performance, and prepares the system for higher concurrency and feature growth.

---

## 1. Objectives

This plan is organized around five implementation objectives:

1. Stabilize the codebase structure so feature work stops increasing architectural debt.
2. Reduce read-path cost by introducing pagination, column selection, and caching.
3. Reduce write-path risk by moving high-concurrency operations into transactional RPCs.
4. Improve maintainability by decomposing the largest views and centralizing data access.
5. Add operational safety through error boundaries, logging, tests, and environment cleanup.

---

## 2. Delivery Strategy

The work should be executed in ordered phases. The sequence matters:

1. Move the project into a feature-based structure before making heavy performance changes.
2. Consolidate data access before introducing caching or virtualization.
3. Fix large read paths before optimizing analytics.
4. Move multi-step writes into RPC after read paths are stable and observable.
5. Add tests and observability continuously, but formalize them after the main refactor boundaries are in place.

---

## 3. Workstreams

### Workstream A: Foundation and App Shell

**Scope**
- Create `src/` root and move frontend runtime files under it.
- Split `App.tsx` into app shell, providers, and layout modules.
- Introduce route-based navigation and lazy loading.
- Move `supabaseClient.ts` to a data layer and switch to environment-based configuration.

**Primary Files Affected**
- `App.tsx`
- `index.tsx`
- `contexts/AuthContext.tsx`
- `supabaseClient.ts`
- `vite.config.ts`

**Outputs**
- `src/app/AppShell.tsx`
- `src/app/routes.tsx`
- `src/app/providers/*`
- `src/data/supabaseClient.ts`

**Success Criteria**
- Views load via route-level lazy imports.
- App shell no longer owns feature logic.
- Supabase URL/key come from environment configuration.

### Workstream B: Data Access Consolidation

**Scope**
- Move direct Supabase calls out of views into feature query/mutation modules.
- Standardize result mapping, error handling, pagination, and column selection.
- Introduce a query/cache layer such as TanStack Query.

**Primary Files Affected**
- `views/POSView.tsx`
- `views/InventoryView.tsx`
- `views/StaffView.tsx`
- `views/ConfigurationView.tsx`
- `views/RoastingView.tsx`
- `views/ReportsView.tsx`
- `views/CRMView.tsx`
- `views/BranchPerformanceView.tsx`
- `views/BranchFinancialsView.tsx`
- `views/DashboardView.tsx`

**Outputs**
- `src/features/*/services/*.ts`
- `src/data/cacheKeys.ts`
- shared query/error helpers

**Success Criteria**
- New view code does not call Supabase directly.
- All read-heavy features use paginated, typed query functions.
- Data fetching behavior is consistent across features.

### Workstream C: Large View Decomposition

**Scope**
- Decompose the four critical views first:
  - POS
  - Inventory
  - Staff
  - Configuration
- Extract tab-level components, modal components, and data hooks.
- Reduce state ownership to the smallest responsible container.

**Primary Files Affected**
- `views/POSView.tsx`
- `views/InventoryView.tsx`
- `views/StaffView.tsx`
- `views/ConfigurationView.tsx`

**Outputs**
- `src/features/pos/*`
- `src/features/inventory/*`
- `src/features/staff/*`
- `src/features/configuration/*`

**Success Criteria**
- No feature view remains a multi-thousand-line single file.
- Data hooks own fetch/mutate flows.
- UI modules can be tested independently.

### Workstream D: Read-Path Performance

**Scope**
- Add server-side pagination and narrow column selection.
- Add virtualization for long lists.
- Move client-side aggregations into SQL views or materialized views.
- Reduce parallel query fan-out in analytics screens.

**Primary Tables**
- `inventory_items`
- `transactions`
- `transaction_items`
- `employees`
- `employee_time_logs`
- `stock_transfers`
- `stock_adjustments`
- `purchase_orders`
- `inventory_count_entries`
- `product_definitions`
- `green_beans`
- `green_bean_movements`
- `roasting_batches`
- `inventory_movements`
- `customers`

**Outputs**
- paginated query contracts
- list virtualization in large tables
- SQL views/materialized views for dashboard and branch analytics

**Success Criteria**
- No major list screen loads full tables by default.
- Dashboard and branch analytics do not aggregate raw transaction history in the browser.
- List rendering remains responsive at high row counts.

### Workstream E: Write-Path Concurrency and Integrity

**Scope**
- Move multi-step write flows into transactional RPCs.
- Standardize audit logging behavior.
- Eliminate mixed delete semantics where behavior is inconsistent.

**Primary RPC/Table Focus**
- POS sale completion
- returns
- inventory deductions and additions
- stock transfer lifecycle
- stock adjustments
- roasting batch creation/completion

**Outputs**
- RPC-backed write paths for high-risk workflows
- clearer mutation boundaries in frontend services

**Success Criteria**
- Client does not orchestrate inventory-critical multi-step writes.
- Inventory and transaction updates are atomic.
- Concurrency-sensitive flows behave correctly under parallel users.

### Workstream F: Quality, Security, and Operations

**Scope**
- Add error boundaries and structured logging.
- Add unit tests for service/query layers.
- Add E2E coverage for critical business paths.
- Move secrets/config to environment variables.
- Remove fake data from branch analytics and financial views.

**Primary Files Affected**
- `views/BranchPerformanceView.tsx`
- `views/BranchFinancialsView.tsx`
- `services/geminiService.ts`
- app shell and shared providers

**Outputs**
- error boundaries
- logging hooks/adapters
- test suites
- environment cleanup

**Success Criteria**
- Critical views fail gracefully.
- High-value flows have automated test coverage.
- No frontend-shipped sensitive configuration beyond intended public values.

---

## 4. Phase Plan

### Phase 0: Baseline and Guardrails

**Duration:** 2 to 4 days

**Tasks**
- Add build verification and define a clean app entry under `src/`.
- Capture current performance baseline:
  - initial bundle size
  - first contentful render
  - largest list render latency
  - key query timings
- Define target coding conventions for feature modules, hooks, and query layers.

**Exit Criteria**
- Baseline metrics are recorded.
- New folder structure exists.
- Team has one agreed module pattern to follow.

### Phase 1: App Shell and Routing

**Duration:** 3 to 5 days

**Tasks**
- Move shell responsibilities out of `App.tsx`.
- Add route-level lazy loading.
- Separate providers from layout.
- Move Supabase client to environment-based config.

**Dependencies**
- Phase 0 complete.

**Exit Criteria**
- Existing screens still function through the new shell.
- Large views are lazy loaded.

### Phase 2: Data Layer Consolidation

**Duration:** 1 to 2 weeks

**Tasks**
- Build feature query/mutation modules.
- Introduce shared pagination and error wrappers.
- Introduce cache keys and query invalidation patterns.
- Migrate smaller views first:
  - Dashboard
  - CRM
  - Reports
  - Branch Performance
  - Branch Financials

**Dependencies**
- Phase 1 complete.

**Exit Criteria**
- Direct Supabase usage is removed from migrated views.
- Query signatures are consistent.

### Phase 3: Critical View Decomposition

**Duration:** 2 to 4 weeks

**Tasks**
- Decompose `POSView.tsx`.
- Decompose `InventoryView.tsx`.
- Decompose `StaffView.tsx`.
- Decompose `ConfigurationView.tsx`.
- Move feature types next to their modules.

**Dependencies**
- Phase 2 patterns are stable.

**Exit Criteria**
- Critical views are split into components plus hooks plus services.
- State is localized and easier to reason about.

### Phase 4: Read-Path Performance

**Duration:** 1 to 2 weeks

**Tasks**
- Add pagination for all read-heavy tables.
- Add column selection to replace `select('*')`.
- Add virtualization for long tables/lists.
- Create SQL views/materialized views for:
  - dashboard summaries
  - branch performance
  - branch financials
  - other browser-aggregated analytics
- Add missing indexes for dominant filters and sorts.

**Dependencies**
- Phase 2 complete.
- Phase 3 recommended for largest views.

**Exit Criteria**
- No critical feature depends on full-table reads by default.
- Analytics views use database-side summaries.

### Phase 5: Write-Path Hardening

**Duration:** 1 to 2 weeks

**Tasks**
- Move high-risk workflows into RPC:
  - POS sale completion
  - inventory updates
  - transfer lifecycle
  - roasting lifecycle
- Standardize mutation error handling and optimistic update rules.
- Align delete semantics for customers and other entities.

**Dependencies**
- Phase 2 complete.
- Database migration path agreed.

**Exit Criteria**
- High-concurrency workflows are atomic.
- Frontend no longer coordinates multi-step inventory writes manually.

### Phase 6: Quality and Operations

**Duration:** 1 to 2 weeks, then ongoing

**Tasks**
- Add error boundaries.
- Add logging and telemetry hooks.
- Add service-layer unit tests.
- Add E2E tests for:
  - login
  - POS sale
  - inventory transfer
  - employee CRUD
  - core reports
- Remove fake data and unsupported client-side secret usage.

**Dependencies**
- Phases 2 to 5 materially complete.

**Exit Criteria**
- Critical flows are covered by automated tests.
- Runtime failures are observable.

---

## 5. Feature-by-Feature Priority

### Priority 1

- `POS`
- `Inventory`

**Reason**
- Highest transaction sensitivity.
- Highest concurrency risk.
- Most inventory integrity impact.

### Priority 2

- `Staff`
- `Configuration`

**Reason**
- Largest files and highest maintenance cost.
- Heavy form/state complexity.

### Priority 3

- `Dashboard`
- `Reports`
- `Branch Performance`
- `Branch Financials`
- `AI Insights`
- `CRM`
- `Roasting`

**Reason**
- Important, but lower immediate operational risk than POS and Inventory.
- Good candidates to establish patterns during migration.

---

## 6. Table-Level Performance Actions

### Immediate Pagination Targets

- `inventory_items`
- `transactions`
- `transaction_items`
- `employees`
- `employee_time_logs`
- `stock_transfers`
- `stock_adjustments`
- `purchase_orders`
- `inventory_count_tasks`
- `inventory_count_entries`
- `product_definitions`
- `green_beans`
- `green_bean_movements`
- `customers`

### Immediate Index Review Targets

- `transactions(created_at, location_id)`
- `transaction_items(transaction_id)`
- `inventory_items(location_id, product_id, updated_at)`
- `stock_transfers(created_at)`
- `stock_adjustments(created_at)`
- `roasting_batches(roast_date)`
- `green_bean_movements(movement_at)`
- `employees(created_at, location_id)`
- `employee_time_logs(clock_in_at)`
- `customers(created_at, phone)`

### Immediate SQL View / Materialized View Targets

- `daily_sales_summary`
- `weekly_roast_summary`
- `stock_summary`
- `branch_sales_summary`
- `branch_staff_counts`
- `branch_revenue_summary`
- `branch_cost_summary`

### Immediate RPC Targets

- POS sale completion
- return creation and approval
- stock transfer create/approve/ship/receive
- stock adjustment apply
- roasting batch create
- roasting batch finish

---

## 7. Risks and Constraints

### Risk 1: Refactor Without Pattern Discipline

If migration starts before module rules are defined, the codebase will move files without improving architecture.

**Mitigation**
- Define the target feature-module contract first.
- Require all migrated features to use the same query/mutation pattern.

### Risk 2: Performance Work Before Data Access Cleanup

Adding caching or virtualization before query standardization can hide bad data access instead of fixing it.

**Mitigation**
- Make data access consolidation a hard dependency for major performance work.

### Risk 3: RPC Expansion Without Database Governance

Moving logic into RPC increases backend power and must be versioned and reviewed carefully.

**Mitigation**
- Introduce explicit migration files and RPC ownership.
- Require schema review for inventory-critical changes.

### Risk 4: Long-Lived Dual Architecture

If old and new patterns coexist too long, complexity increases.

**Mitigation**
- Migrate by feature completely once started.
- Avoid partial decomposition of a feature over many weeks.

---

## 8. Recommended Milestones

### Milestone 1: Structural Stability

- `src/` introduced
- app shell split
- routes and lazy loading active
- environment config fixed

### Milestone 2: Data Layer Standardized

- shared query/mutation pattern in place
- smaller views migrated
- pagination primitives available

### Milestone 3: Critical Features Decomposed

- POS, Inventory, Staff, Configuration migrated to feature modules

### Milestone 4: Performance Stabilized

- paginated lists
- virtualized heavy screens
- SQL summary views live
- index review completed

### Milestone 5: Operational Hardening

- RPC-backed write paths
- error boundaries
- logging
- automated tests for critical flows

---

## 9. Suggested Execution Order

1. Set the architecture boundary: `src/`, app shell, routes, provider split.
2. Build the shared data layer contract.
3. Migrate small read-only or low-risk features to validate patterns.
4. Migrate POS and Inventory completely.
5. Migrate Staff and Configuration completely.
6. Add SQL views, indexes, and virtualization.
7. Move critical write paths into RPC.
8. Finish with tests, observability, and residual cleanup.

---

## 10. Definition of Done

The plan should be considered complete when:

- No major feature view remains a monolith with direct Supabase calls.
- All large lists are paginated and high-volume lists are virtualized.
- Dashboard and branch analytics aggregate in the database, not the browser.
- High-risk write workflows are atomic through RPC.
- App shell, providers, and layout are separated.
- Environment configuration is cleaned up.
- Error handling, logging, and tests cover critical user flows.

