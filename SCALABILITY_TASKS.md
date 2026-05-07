# Doha Roastery Scalability Tasks

**Source documents**
- `SCALABILITY_ANALYSIS_REPORT.md`
- `SCALABILITY_IMPLEMENTATION_PLAN.md`

**Purpose**
- Convert the architecture and scalability plan into an actionable task backlog.
- Keep tasks implementation-focused, ordered, and easy to track.

---

## Phase 0: Baseline and Guardrails

- [ ] Create `src/` as the canonical frontend root.
- [ ] Move runtime entry files into `src/` and update import paths.
- [ ] Update `vite.config.ts` to support the new source layout.
- [ ] Document the target feature-module pattern to be used in all migrations.
- [ ] Capture the current bundle size baseline.
- [ ] Capture current render performance for the largest screens.
- [ ] Capture current query timings for POS, Inventory, Staff, and Reports flows.
- [ ] Define coding rules for feature services, hooks, and shared UI components.

**Exit criteria**
- [ ] Baseline metrics are recorded.
- [ ] The repo has a working `src/` root.
- [ ] One module pattern is agreed and documented.

---

## Phase 1: App Shell and Routing

- [ ] Split `App.tsx` into app shell, layout, and provider responsibilities.
- [ ] Create `src/app/AppShell.tsx`.
- [ ] Create `src/app/routes.tsx`.
- [ ] Move auth provider logic into `src/app/providers/AuthProvider.tsx`.
- [ ] Create theme and language providers in `src/app/providers/`.
- [ ] Extract shared layout components:
- [ ] Create `Sidebar.tsx`.
- [ ] Create `Header.tsx`.
- [ ] Create `Breadcrumbs.tsx`.
- [ ] Replace tab-only navigation with route-aware navigation.
- [ ] Add lazy loading for large feature screens.
- [ ] Move Supabase configuration into `src/data/supabaseClient.ts`.
- [ ] Replace hardcoded config access with environment variables.

**Exit criteria**
- [ ] The app loads through the new shell.
- [ ] Views are lazy loaded.
- [ ] Environment-based Supabase config is in place.

---

## Phase 2: Shared Data Layer

- [ ] Add a shared query layer strategy for all features.
- [ ] Add `src/data/cacheKeys.ts`.
- [ ] Add shared query error handling utilities.
- [ ] Add shared pagination helpers.
- [ ] Introduce a cache/query client pattern for frontend data fetching.
- [ ] Define a standard shape for query results, pagination metadata, and mutations.
- [ ] Define mapping utilities for Supabase row normalization.

**Exit criteria**
- [ ] Shared data access patterns exist and are ready for feature migration.
- [ ] Pagination and query error handling are reusable across modules.

---

## Phase 3: Migrate Smaller Features First

### Dashboard

- [ ] Move `DashboardView.tsx` into `src/features/dashboard/`.
- [ ] Create `useDashboardData.ts`.
- [ ] Remove direct Supabase access from the view.
- [ ] Replace browser aggregation where practical with summarized queries.

### CRM

- [ ] Move `CRMView.tsx` into `src/features/crm/`.
- [ ] Create `CustomerTable.tsx`.
- [ ] Create `CustomerForm.tsx`.
- [ ] Create `useCustomers.ts`.
- [ ] Unify delete behavior with the CRM service strategy.
- [ ] Add pagination to customers list queries.

### Reports

- [ ] Move `ReportsView.tsx` into `src/features/reports/`.
- [ ] Create `useReportsData.ts`.
- [ ] Create report widgets/components for profitability, production, and advanced reports.
- [ ] Remove direct Supabase access from the view.

### Branch Analytics

- [ ] Move `BranchPerformanceView.tsx` into `src/features/branch/`.
- [ ] Move `BranchFinancialsView.tsx` into `src/features/branch/`.
- [ ] Create `useBranchPerformance.ts`.
- [ ] Create `useBranchFinancials.ts`.
- [ ] Remove fake or derived placeholder business data from branch analytics.

**Exit criteria**
- [ ] Smaller features use the shared data layer.
- [ ] Direct Supabase usage is removed from migrated views.

---

## Phase 4: POS Refactor

### Module Structure

- [ ] Move `POSView.tsx` into `src/features/pos/`.
- [ ] Create `src/features/pos/components/`.
- [ ] Create `src/features/pos/hooks/`.
- [ ] Create `src/features/pos/services/`.

### Component Extraction

- [ ] Extract `ProductGrid.tsx`.
- [ ] Extract `CartPanel.tsx`.
- [ ] Extract `ItemCustomizationModal.tsx`.
- [ ] Extract `PaymentPanel.tsx`.
- [ ] Extract `ShiftPanel.tsx`.
- [ ] Extract `ReturnsPanel.tsx`.
- [ ] Extract `CustomerSearch.tsx`.
- [ ] Extract `ReceiptModal.tsx`.
- [ ] Extract `LocationSelector.tsx`.

### Data Hooks

- [ ] Create `usePOSInventory(locationId)`.
- [ ] Create `usePOSTransactions(filters)`.
- [ ] Create `useReturnRequests(filters)`.
- [ ] Create `useCustomersSearch(query)`.
- [ ] Create `useShift(userId)`.
- [ ] Create `useInventoryAdjustments()`.

### Performance

- [ ] Add pagination for transaction history.
- [ ] Add pagination for return request history.
- [ ] Replace `select('*')` with explicit POS column selection.
- [ ] Limit inventory payloads to the columns required for product browsing and checkout.

### Integrity

- [ ] Consolidate sale completion into a single transactional backend flow.
- [ ] Consolidate stock updates used by POS into atomic RPC-backed mutations.

**Exit criteria**
- [ ] POS no longer exists as one monolithic view.
- [ ] POS reads are paginated where needed.
- [ ] POS inventory updates are atomic.

---

## Phase 5: Inventory Refactor

### Module Structure

- [ ] Move `InventoryView.tsx` into `src/features/inventory/`.
- [ ] Create `src/features/inventory/components/`.
- [ ] Create `src/features/inventory/hooks/`.
- [ ] Create `src/features/inventory/services/`.

### Component Extraction

- [ ] Extract `LocationsTab.tsx`.
- [ ] Extract `PackagedItemsTab.tsx`.
- [ ] Extract `TransfersTab.tsx`.
- [ ] Extract `AdjustmentsTab.tsx`.
- [ ] Extract `PurchasesTab.tsx`.
- [ ] Extract `CountsTab.tsx`.
- [ ] Extract `NetworkVisibility.tsx`.
- [ ] Extract `ItemEditorModal.tsx`.
- [ ] Extract `TransferWizard.tsx`.

### Data Hooks

- [ ] Create `useInventoryItems(filters, pagination)`.
- [ ] Create `useLocations(filters)`.
- [ ] Create `useTransfers(filters, pagination)`.
- [ ] Create `useAdjustments(filters, pagination)`.
- [ ] Create `usePurchaseOrders(filters, pagination)`.
- [ ] Create `useInventoryCounts(filters, pagination)`.
- [ ] Create `useNetworkVisibility(locationId)`.
- [ ] Create `useInventoryRealtime()` if realtime remains required.

### Performance

- [ ] Add pagination for `inventory_items`.
- [ ] Add pagination for `stock_transfers`.
- [ ] Add pagination for `stock_adjustments`.
- [ ] Add pagination for `purchase_orders`.
- [ ] Add pagination for `inventory_count_tasks`.
- [ ] Add pagination for `inventory_count_entries`.
- [ ] Replace `select('*')` with tab-specific column selection.

### Integrity

- [ ] Move transfer create/approve/ship/receive flows into transactional RPCs.
- [ ] Move stock adjustment application into an RPC that also records audit data.

**Exit criteria**
- [ ] Inventory tabs fetch only their own data.
- [ ] Inventory tables are paginated.
- [ ] Transfer and adjustment workflows are atomic.

---

## Phase 6: Staff Refactor

### Module Structure

- [ ] Move `StaffView.tsx` into `src/features/staff/`.
- [ ] Create `src/features/staff/components/`.
- [ ] Create `src/features/staff/hooks/`.
- [ ] Create `src/features/staff/services/`.

### Component Extraction

- [ ] Extract `StaffOverview.tsx`.
- [ ] Extract `EmployeeTable.tsx`.
- [ ] Extract `EmployeeForm.tsx`.
- [ ] Extract `ScheduleTab.tsx`.
- [ ] Extract `AttendanceTab.tsx`.
- [ ] Extract `PayrollTab.tsx`.
- [ ] Extract `PerformanceTab.tsx`.
- [ ] Extract `BranchStaffingTab.tsx`.

### Data Hooks

- [ ] Create `useEmployees(filters, pagination)`.
- [ ] Create `useTimeLogs(filters, pagination)`.
- [ ] Create `usePayroll(period)`.
- [ ] Create `usePerformance(period)`.
- [ ] Create `useBranchStaffingTargets()`.
- [ ] Create `useStaffLocations()`.

### Performance

- [ ] Add pagination for `employees`.
- [ ] Add pagination for `employee_time_logs`.
- [ ] Add pagination for payroll-related records.
- [ ] Add pagination for performance review records.
- [ ] Limit date-range queries by default.

**Exit criteria**
- [ ] Staff workflows are split by domain.
- [ ] Employee and attendance data no longer load unbounded lists by default.

---

## Phase 7: Configuration Refactor

### Module Structure

- [ ] Move `ConfigurationView.tsx` into `src/features/configuration/`.
- [ ] Create `src/features/configuration/components/`.
- [ ] Create `src/features/configuration/hooks/`.
- [ ] Create `src/features/configuration/services/`.

### Component Extraction

- [ ] Extract `CatalogTab.tsx`.
- [ ] Extract `TemplatesTab.tsx`.
- [ ] Extract `RoastProfilesTab.tsx`.
- [ ] Extract `GreenBeansTab.tsx`.
- [ ] Extract `DatabaseStatus.tsx`.
- [ ] Extract `SettingsTab.tsx`.
- [ ] Extract `RecipeEditor.tsx`.
- [ ] Extract `AddOnsEditor.tsx`.

### Data Hooks

- [ ] Create `useCatalog(filters, pagination)`.
- [ ] Create `usePackageTemplates(filters)`.
- [ ] Create `useRoastProfiles(filters)`.
- [ ] Create `useGreenBeans(filters, pagination)`.
- [ ] Create `useGreenBeanMovements(filters, pagination)`.
- [ ] Create `useSystemSettings()`.
- [ ] Create `useSchemaStatus()`.

### Performance

- [ ] Add pagination for `product_definitions`.
- [ ] Add pagination for `green_beans`.
- [ ] Add pagination for `green_bean_movements`.
- [ ] Replace schema probing from the browser with a safer backend-supported approach if retained.

**Exit criteria**
- [ ] Configuration concerns are split by sub-tab.
- [ ] Catalog and green bean data are paginated and isolated.

---

## Phase 8: Roasting and Remaining Feature Migration

### Roasting

- [ ] Move `RoastingView.tsx` into `src/features/roasting/`.
- [ ] Extract `BatchList.tsx`.
- [ ] Extract `BatchDetails.tsx`.
- [ ] Extract `PackagingModal.tsx`.
- [ ] Create `useRoastingData.ts`.
- [ ] Paginate roasting history queries.
- [ ] Replace raw browser orchestration for batch lifecycle with RPC-backed writes.

### AI Insights

- [ ] Move `AIInsights.tsx` into `src/features/ai/`.
- [ ] Create `InsightsSummary.tsx`.
- [ ] Create `ForecastTable.tsx`.
- [ ] Create `useAIInsights.ts`.
- [ ] Reduce fan-out queries and shift aggregation to SQL views or backend summaries.

### Login/Auth

- [ ] Move `LoginView.tsx` into `src/features/auth/`.
- [ ] Move auth-facing logic to app providers and hooks.

**Exit criteria**
- [ ] Remaining views conform to the feature-module pattern.

---

## Phase 9: Read-Path Performance

### Pagination and Column Selection

- [ ] Replace `select('*')` in all read-heavy screens with explicit column lists.
- [ ] Standardize server-side pagination contracts across features.
- [ ] Add default page size rules by entity type.

### Virtualization

- [ ] Add virtualization to `inventory_items` list/grid.
- [ ] Add virtualization to employee tables.
- [ ] Add virtualization to transaction history.
- [ ] Add virtualization to `inventory_count_entries`.
- [ ] Add virtualization to transfer and purchase order lists where needed.

### SQL Views / Materialized Views

- [ ] Create `daily_sales_summary`.
- [ ] Create `weekly_roast_summary`.
- [ ] Create `stock_summary`.
- [ ] Create `branch_sales_summary`.
- [ ] Create `branch_staff_counts`.
- [ ] Create `branch_revenue_summary`.
- [ ] Create `branch_cost_summary`.
- [ ] Point dashboard and branch analytics features to those summaries.

### Index Review

- [ ] Review indexes on `transactions(created_at, location_id)`.
- [ ] Review indexes on `transaction_items(transaction_id)`.
- [ ] Review indexes on `inventory_items(location_id, product_id, updated_at)`.
- [ ] Review indexes on `stock_transfers(created_at)`.
- [ ] Review indexes on `stock_adjustments(created_at)`.
- [ ] Review indexes on `roasting_batches(roast_date)`.
- [ ] Review indexes on `green_bean_movements(movement_at)`.
- [ ] Review indexes on `employees(created_at, location_id)`.
- [ ] Review indexes on `employee_time_logs(clock_in_at)`.
- [ ] Review indexes on `customers(created_at, phone)`.

**Exit criteria**
- [ ] Large list screens are responsive under high row counts.
- [ ] Browser-side analytics aggregation is materially reduced.

---

## Phase 10: Write-Path Hardening

- [ ] Create or formalize RPC for POS sale completion.
- [ ] Create or formalize RPC for returns flow.
- [ ] Create or formalize RPC for transfer creation.
- [ ] Create or formalize RPC for transfer approval.
- [ ] Create or formalize RPC for transfer shipment.
- [ ] Create or formalize RPC for transfer receiving.
- [ ] Create or formalize RPC for stock adjustment application.
- [ ] Create or formalize RPC for roasting batch creation.
- [ ] Create or formalize RPC for roasting batch completion.
- [ ] Standardize mutation error handling and rollback behavior in the frontend.
- [ ] Ensure audit logging is applied consistently in high-risk workflows.

**Exit criteria**
- [ ] High-concurrency workflows are atomic.
- [ ] Frontend no longer coordinates multi-step inventory-critical writes directly.

---

## Phase 11: Shared UI, Types, and Utilities

- [ ] Create `src/components/ui/`.
- [ ] Extract reusable `Button.tsx`.
- [ ] Extract reusable `Modal.tsx`.
- [ ] Extract reusable `Table.tsx`.
- [ ] Extract reusable `Input.tsx`.
- [ ] Extract reusable `Spinner.tsx`.
- [ ] Create shared hooks:
- [ ] `useDebounce.ts`
- [ ] `usePagination.ts`
- [ ] `useLocalStorage.ts`
- [ ] Split `types.ts` into domain-scoped type files.
- [ ] Add shared formatting and date utilities under `src/utils/`.

**Exit criteria**
- [ ] Shared primitives replace repeated UI and helper logic.
- [ ] Types are organized by domain instead of one flat file.

---

## Phase 12: Quality, Security, and Operations

### Safety

- [ ] Add app-level error boundaries.
- [ ] Add feature-level fallback error handling where needed.
- [ ] Add structured logging for query failures and mutation failures.

### Security

- [ ] Move all environment-dependent config to environment variables.
- [ ] Remove unsafe client-side AI key usage.
- [ ] Review RLS assumptions for frontend-exposed tables and RPCs.

### Tests

- [ ] Add unit tests for feature service/query layers.
- [ ] Add integration coverage for data hooks if tooling supports it.
- [ ] Add E2E test for login.
- [ ] Add E2E test for POS sale completion.
- [ ] Add E2E test for inventory transfer lifecycle.
- [ ] Add E2E test for employee create/edit flows.
- [ ] Add E2E test for critical reporting screens.

### Cleanup

- [ ] Remove fake branch performance data.
- [ ] Remove fake branch financial data.
- [ ] Review and remove dead code uncovered during migration.
- [ ] Align soft-delete vs hard-delete behavior for customers and similar entities.

**Exit criteria**
- [ ] Critical failures are visible and recoverable.
- [ ] Sensitive config is handled correctly.
- [ ] Core flows have automated test coverage.

---

## Cross-Cutting Tracking

### Definition of Done

- [ ] No critical view remains a multi-thousand-line monolith with direct Supabase calls.
- [ ] All major read-heavy screens use pagination.
- [ ] High-volume screens use virtualization where needed.
- [ ] Dashboard and branch analytics use database-side summaries.
- [ ] Critical write paths are RPC-backed and atomic.
- [ ] Shared UI, hooks, and typed data access patterns are in place.
- [ ] Error handling, logging, and tests cover critical business flows.

### Recommended Execution Order

- [ ] Complete Phase 0.
- [ ] Complete Phase 1.
- [ ] Complete Phase 2.
- [ ] Complete Phase 3.
- [ ] Complete Phase 4.
- [ ] Complete Phase 5.
- [ ] Complete Phase 6.
- [ ] Complete Phase 7.
- [ ] Complete Phase 8.
- [ ] Complete Phase 9.
- [ ] Complete Phase 10.
- [ ] Complete Phase 11.
- [ ] Complete Phase 12.

