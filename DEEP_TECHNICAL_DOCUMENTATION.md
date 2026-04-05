# Doha Roastery POS - Deep Technical Documentation

Last reviewed against the codebase on 2026-04-02.

## 1. Executive Summary

This repository is a single-page operational system for a coffee roastery and retail network. It combines:

- retail POS
- roasting and packaging operations
- inventory and branch distribution
- staff and workforce administration
- CRM and returns handling
- reporting and AI-assisted analysis

The frontend is a Vite + React 19 + TypeScript application. Supabase is used directly from the client for authentication, database access, RPC calls, realtime subscriptions, and storage uploads. Most business logic lives inside large view components rather than in a layered service/domain architecture.

The current system is functional but highly front-end heavy: the UI orchestrates workflows, validation, calculations, and persistence directly against Supabase tables and SQL functions.

## 2. Actual Runtime Stack

From `package.json` and source:

- React `19.2.3`
- React DOM `19.2.3`
- TypeScript `~5.8.2`
- Vite `^6.2.0`
- Supabase JS `^2.45.0`
- Google GenAI SDK `^1.37.0`
- React Hook Form `^7.54.0`
- Zod `^3.24.0`
- Recharts `^3.6.0`
- Lucide React `^0.562.0`

Important repository reality:

- `package.json` defines `dev`, `build`, and `preview` only.
- The repo-level `AGENTS.md` mentions `npm test && npm run lint`, but those scripts do not currently exist in `package.json`.
- `README.md` says to set `GEMINI_API_KEY`, while `services/geminiService.ts` reads `process.env.API_KEY`.

## 3. Application Shape

### 3.1 Entry Points

- `index.tsx` mounts the React app.
- `App.tsx` is the application shell.
- `contexts/AuthContext.tsx` owns auth/session state.
- `supabaseClient.ts` creates the Supabase client.

### 3.2 Navigation Model

This is not a route-based app. `App.tsx` uses an `activeTab` state and conditionally renders views.

Top-level tabs:

- `dashboard`
- `staff`
- `roasting`
- `inventory`
- `pos`
- `reports`
- `branchPerformance`
- `branchFinancials`
- `crm`
- `ai`
- `configuration`
- `profile`

The default tab depends on role:

- `CASHIER` -> `pos`
- `ADMIN` / `MANAGER` -> `dashboard`
- others fall back to role-appropriate tabs through login handling

### 3.3 Cross-Cutting Context

`App.tsx` also owns:

- language context (`ar` / `en`)
- theme context (`light` / `dark`)
- sidebar persistence
- keyboard shortcuts
- session expiry warning banner logic
- unauthorized tab recovery plus access-denied toast

## 4. Authentication and Authorization

### 4.1 Auth Flow

`AuthContext.tsx` is the core auth layer.

It:

- reads the current Supabase auth session on startup
- subscribes to `supabase.auth.onAuthStateChange`
- loads the matching `profiles` row
- maps the profile into the app `User` shape
- signs out disabled users if `profiles.is_active = false`

Login uses `supabase.auth.signInWithPassword`. If the login identifier does not contain `@`, the app transforms it into `<identifier>@roastery.com`.

### 4.2 Roles

The active enum in `types.ts`:

- `ADMIN`
- `MANAGER`
- `HR`
- `ROASTER`
- `CASHIER`
- `WAREHOUSE_STAFF`

### 4.3 Permission Model

Permissions are not a full policy engine. They are a simple role-to-string mapping in `AuthContext.tsx` and are used alongside direct role checks in views.

Examples:

- `can_roast`
- `can_edit_stock`
- `can_sell`
- `can_view_reports`
- `can_manage_shift`

### 4.4 UI-Level Access Control

Access control is enforced in multiple places:

- menu filtering in `App.tsx`
- active-tab fallback in `App.tsx`
- `useRoleGuard()` for toast-based denial feedback
- direct role checks inside views before protected operations

This is defense in depth on the client, but real security depends on Supabase RLS and RPC policy design.

### 4.5 Database-Level Role Restriction

The migration `migrations/20260330_cashier_rls_policies.sql` adds or updates RLS behavior for:

- `transactions`
- `shifts`
- `cash_movements`
- `profiles`
- `customers`
- `product_definitions`

The cashier restriction design is centered on:

- `cashier_id = auth.uid()` for shifts
- `cashier_name = current profile display name` for transactions

That second rule is important: transaction ownership is name-based, not user-id based.

## 5. Shared Domain Model

`types.ts` is the shared type hub. Main domain groups:

- auth and user roles
- employees and workforce
- products, recipes, add-ons, beverages
- inventory items and cart items
- transactions and payment breakdowns
- customers and return requests
- roasting batches, roast profiles, packaging units
- locations and settings
- payroll, salary advances, performance records

The system is effectively modeling an ERP-lite domain in a single TypeScript file.

## 6. Module-by-Module Analysis

### 6.1 Dashboard (`views/DashboardView.tsx`)

Purpose:

- summarize today's sales
- show roast activity
- show current green bean stock
- surface low-stock warnings

Live data sources:

- `transactions`
- `roasting_batches`
- `green_beans`

Notable implementation detail:

- KPI cards are live
- chart series are currently static demo arrays, not database-driven

### 6.2 Staff Management (`views/StaffView.tsx`)

This is the largest module in the repository and effectively a workforce subsystem.

Primary capabilities confirmed from code:

- employee master data CRUD on `employees`
- employee photo upload to Supabase Storage bucket `employee-photos`
- open time-log monitoring from `employee_time_logs`
- daily attendance reads from `employee_daily_attendance`
- weekly schedules in `employee_weekly_schedules`
- schedule overrides in `employee_schedule_overrides`
- shift swap requests in `employee_shift_swap_requests`
- salary advances in `employee_salary_advances`
- advance payments in `employee_salary_advance_payments`
- payroll history in `payroll_history`
- payroll approval chain in `payroll_approvals`
- KPI definitions in `performance_kpis`
- review categories in `performance_review_categories`
- bonus rules in `performance_bonus_rules`
- performance reviews with KPI and category ratings
- branch transfers via `employee_branch_transfers`
- branch staffing targets via `branch_staffing_targets`

Operational patterns:

- most datasets are loaded directly from Supabase in the view
- there are many targeted fetch functions instead of one consolidated store
- attendance data refreshes after time-log mutations
- payroll data reloads when the selected payroll month changes

Staff-management SQL support:

- `enable_staff_management.sql`
- `audit_log_setup.sql`

Important schema features from SQL:

- uniqueness on employee identifiers and contact fields
- partial unique index enforcing one open time log per employee
- overlap-prevention trigger on time logs
- audit trigger for employee changes

### 6.3 Roasting and Production (`views/RoastingView.tsx`)

Purpose:

- consume green beans into roast batches
- record roast completion and waste
- package completed batches into sellable inventory

Live data sources:

- `green_beans`
- `roasting_batches`
- `product_definitions`
- `package_templates`
- `locations`
- `green_bean_movements`

Core workflows:

1. Start batch
- validate requested pre-weight against current green bean quantity
- create a batch id like `B-YYYYMM-####`
- insert into `roasting_batches`
- decrement `green_beans.quantity`
- insert a `green_bean_movements` consumption record

2. Finish batch
- capture `post_weight`
- calculate waste percentage
- mark batch `COMPLETED`

3. Package batch
- map packaging lines to `product_definitions` and `package_templates`
- generate `PackagingUnit` rows in batch JSON
- insert sellable records into `inventory_items`
- optionally prepare receipt-like payload data for the Python thermal printer flow

4. Cancel batch
- only allowed before output is recorded
- restore consumed green bean quantity
- delete related `green_bean_movements`
- soft-delete batch by setting status to `DELETED`

Architectural note:

- packaging output is inserted directly as inventory rows; there is no separate production ledger table in the frontend workflow

### 6.4 Inventory and Network Operations (`views/InventoryView.tsx`)

This is the second large operational module and covers multi-location inventory administration.

Visible sub-tabs:

- `locations`
- `packaged`
- `transfers`
- `purchases`
- `counts`
- `adjustments`

Primary data sources:

- `inventory_items`
- `locations`
- `stock_adjustments`
- `stock_transfers`
- `purchase_orders`
- `inventory_count_tasks`
- `inventory_count_entries`
- `network_stock_visibility`
- `branch_coverage_status`
- `inventory_movements`

RPC dependencies:

- `approve_stock_transfer`
- `ship_stock_transfer`
- `receive_stock_transfer`
- `create_production_order`

Capabilities:

- branch/location creation and editing
- branch photo upload to storage bucket `branch-photos`
- stock transfer creation and lifecycle handling
- production-order creation for replenishment
- purchase-order creation, receiving, and inventory updates
- cycle counting task creation and count entry approval
- stock adjustments with approval threshold logic
- inventory traceability lookup from `inventory_movements`
- realtime refresh for `stock_transfers`

Approval logic in UI:

- stock adjustment approval threshold is client-side
- warehouse staff role is checked before count and adjustment actions

Schema support script:

- `enable_inventory_features.sql`

That script creates or evolves:

- enriched `locations`
- `stock_transfers`
- `production_orders`
- `production_order_items`
- helper auth functions
- delete guards for locations

### 6.5 POS (`views/POSView.tsx`)

The POS module is the transactional heart of the system.

Visible POS tabs:

- `ALL`
- `PACKAGED`
- `DRINKS`
- `HISTORY`
- `RETURNS`

Primary data sources:

- `locations`
- `inventory_items`
- `product_definitions`
- `system_settings`
- `transactions`
- `return_requests`
- `reprint_logs`

RPC dependencies:

- `deduct_inventory_with_cost`
- `add_inventory_atomic`
- `record_customer_transaction`

Cash/shift dependency:

- `shiftService`
- tables `shifts` and `cash_movements`

Checkout flow as implemented:

1. load active location inventory and product definitions
2. combine product definitions with stock rows
3. build cart totals using `system_settings.vat_rate`
4. create sequential day-local invoice sequence by counting today's transactions
5. insert a `transactions` row
6. compute inventory deductions from:
   - direct packaged items
   - BOM components
   - beverage recipe ingredients
   - beverage add-on ingredient mappings
7. call `deduct_inventory_with_cost`
8. if RPC is missing, fall back to direct `inventory_items.stock` updates
9. call customer loyalty RPC if a customer is attached
10. print the receipt with `window.print()`

Returns flow:

- cashier creates a `return_requests` record
- manager/admin approves or rejects
- on approval the app restocks inventory with `add_inventory_atomic`
- if RPC is missing, inventory is updated directly
- original transaction is marked `is_returned = true`

Reprint flow:

- restricted in UI to `ADMIN` and `MANAGER`
- inserts a row into `reprint_logs`
- prints the stored transaction view

Important implementation detail:

- transaction IDs are generated client-side with `crypto.randomUUID()`
- the field used for lookup in returns is the transaction `id`

### 6.6 Reports (`views/ReportsView.tsx`)

Reports uses prebuilt database views/report tables rather than constructing everything in the frontend.

Sources used:

- `product_profitability_report`
- `transactions`
- `daily_production_report`
- `monthly_production_report`
- `waste_by_roast_profile_report`
- `waste_by_roaster_report`
- `waste_by_bean_report`
- `qc_monthly_report`
- `roaster_performance_monthly_report`
- `production_cost_report`
- `green_bean_consumption_monthly_report`
- `roast_profile_consistency_report`

Other functionality:

- cashier personal stats panel for self-service report access
- export to Excel-compatible HTML
- print-based PDF export

### 6.7 CRM (`views/CRMView.tsx`, `services/crmService.ts`)

Capabilities:

- customer search with pagination
- customer create/update/delete
- soft-delete path in service (`is_active = false`)

Notable inconsistency:

- `crmService.deleteCustomer()` performs soft delete
- `CRMView.tsx` contains a direct hard delete path using `.delete().eq('id', id)`

This is a real behavior mismatch between service-layer intent and view implementation.

### 6.8 AI Insights (`views/AIInsights.tsx`, `services/geminiService.ts`)

AI is implemented in two layers:

1. `AIInsights.tsx`
- computes operational statistics locally from Supabase data
- builds forecast and optimization suggestions
- produces bilingual insight content

2. `services/geminiService.ts`
- provides external Gemini-backed text generation and stock prediction helpers

Data sampled in the view:

- `transactions`
- `inventory_items`
- `roasting_batches`
- `green_beans`
- `inventory_movements`
- `locations`
- `product_definitions`
- `product_profitability_report`

Important implementation detail:

- the view contains substantial deterministic analytics logic already
- the Gemini service is present, but the UI is not purely delegating the analysis to Gemini

Environment mismatch:

- README expects `GEMINI_API_KEY`
- service reads `process.env.API_KEY`

### 6.9 Configuration (`views/ConfigurationView.tsx`)

This module acts as a control plane for master data and schema health.

Visible sub-tabs:

- `catalog`
- `templates`
- `roastProfiles`
- `greenBeans`
- `settings`
- `database`
- `profile`

Primary capabilities:

- package template CRUD
- product catalog CRUD/upsert
- ingredient management via `inventory_items` records with type `INGREDIENT`
- system settings update
- roast profile CRUD, fork, and activation
- green bean CRUD and movement logging
- schema integrity checks against expected product columns
- copyable SQL repair script generation

The `database` sub-tab is notable because it embeds SQL fix content directly in the frontend. This is helpful operationally but also means schema management knowledge is partially duplicated in UI code.

### 6.10 Branch Analytics

`BranchPerformanceView.tsx`:

- uses `locations`
- uses `transactions`
- uses `staff`
- computes branch-level sales, order counts, and staffing-related indicators

`BranchFinancialsView.tsx`:

- uses `locations`
- uses `transactions`
- uses `inventory_movements`
- computes branch financial summaries and detail views

### 6.11 Profile (`views/ProfileView.tsx`)

Simple self-service profile editing:

- updates `profiles.full_name`
- updates `profiles.avatar_url`

This aligns with the cashier profile update RLS migration.

## 7. Services and Utilities

### 7.1 `services/inventoryService.ts`

Responsibilities:

- filtered/paginated green bean fetch from `green_beans`
- bulk insert for green beans
- order reservation create/update on `order_reservations`

This is more query-helper than true business service.

### 7.2 `services/shiftService.ts`

Responsibilities:

- get current open shift
- start shift
- close shift
- add cash movement
- compute shift totals from transactions plus cash movements

The total calculation is based on:

- full cash transactions
- cash portion of split payments
- movements in/out

### 7.3 `services/beverageService.ts`

Pure calculation helper:

- recipe material cost
- add-on pricing
- cost breakdown

### 7.4 `utils/reportExport.ts`

Simple browser-only export utilities:

- generates HTML tables
- downloads as Excel-compatible HTML blob
- opens a print window for PDF export

### 7.5 `components/reports/PersonalStatsPanel.tsx`

Cashier self-service reporting widget using:

- own transactions by `cashier_name`
- own shifts by `cashier_id`

### 7.6 `components/common/AccessDeniedToast.tsx`

Small access-denial feedback component used by the role guard flow.

## 8. Database Objects Referenced by the Frontend

### 8.1 Core Tables

- `profiles`
- `locations`
- `employees`
- `transactions`
- `return_requests`
- `customers`
- `green_beans`
- `green_bean_movements`
- `roasting_batches`
- `package_templates`
- `product_definitions`
- `inventory_items`
- `inventory_movements`
- `system_settings`
- `shifts`
- `cash_movements`

### 8.2 Workforce Tables

- `employee_time_logs`
- `employee_daily_attendance`
- `employee_weekly_schedules`
- `employee_schedule_overrides`
- `employee_shift_swap_requests`
- `employee_salary_advances`
- `employee_salary_advance_payments`
- `payroll_approvals`
- `payroll_history`
- `performance_kpis`
- `performance_review_categories`
- `performance_bonus_rules`
- `performance_reviews`
- `performance_review_kpis`
- `performance_review_ratings`
- `employee_branch_transfers`
- `branch_staffing_targets`
- `employee_audit_logs`

### 8.3 Inventory/Network Tables and Views

- `stock_adjustments`
- `stock_transfers`
- `purchase_orders`
- `inventory_count_tasks`
- `inventory_count_entries`
- `network_stock_visibility`
- `branch_coverage_status`
- `production_orders`
- `production_order_items`
- `order_reservations`

### 8.4 Reporting Views

- `product_profitability_report`
- `daily_production_report`
- `monthly_production_report`
- `waste_by_roast_profile_report`
- `waste_by_roaster_report`
- `waste_by_bean_report`
- `qc_monthly_report`
- `roaster_performance_monthly_report`
- `production_cost_report`
- `green_bean_consumption_monthly_report`
- `roast_profile_consistency_report`

### 8.5 RPC Functions Used

- `approve_stock_transfer`
- `ship_stock_transfer`
- `receive_stock_transfer`
- `create_production_order`
- `deduct_inventory_with_cost`
- `add_inventory_atomic`
- `record_customer_transaction`

## 9. Storage and External Integrations

### 9.1 Supabase Storage

Buckets referenced in code:

- `employee-photos`
- `branch-photos`

### 9.2 Thermal Printing

The repository contains `thermal_printer/receipt_printer.py` and a README for ESC/POS printing. In the current frontend:

- retail receipts print via `window.print()`
- roasting production logs prepare print payloads but only log them
- there is no integrated backend bridge in this repo that actually calls the Python printer module

So the Python printer is present as an integration artifact, not as an active end-to-end runtime path inside the web app.

### 9.3 Gemini

`services/geminiService.ts` integrates with Google GenAI.

Current caveats:

- environment variable naming is inconsistent
- in browser builds, `process.env.API_KEY` may not resolve without extra build-time injection

## 10. Internationalization and UX

`translations.ts` is a large inline translation dictionary for Arabic and English.

The app supports:

- document `dir` switching (`rtl` / `ltr`)
- document `lang` switching
- bilingual labels across the operational UI

The translation layer is code-local rather than file-split or library-driven. This keeps things simple but makes the translation file large and tightly coupled to component implementation.

## 11. Architectural Strengths

- very broad operational surface area in one deployable frontend
- Supabase allows rapid delivery with auth, storage, DB, and realtime from one platform
- modules are functionally rich and map closely to daily business operations
- many workflows have fallback behavior if advanced RPCs are missing
- the app supports bilingual operation and role-specific navigation

## 12. Architectural Weaknesses and Risks

### 12.1 Very Large View Components

`StaffView.tsx`, `InventoryView.tsx`, `ConfigurationView.tsx`, and `POSView.tsx` are each extremely large. This creates:

- high cognitive load
- difficult testing
- fragile refactors
- repeated state/fetch patterns

### 12.2 Client-Centric Business Logic

Critical workflows are calculated in the browser:

- invoice numbering
- inventory deductions and additions
- approval thresholds
- batch packaging transformations

This increases the risk of race conditions, duplicated logic, and inconsistent outcomes across clients.

### 12.3 Supabase Credentials in Source

`supabaseClient.ts` contains the Supabase URL and anon key inline. An anon key is expected to be public to the client, but keeping it hardcoded in source still makes environment management and rotation harder than using environment variables.

### 12.4 Inconsistent Documentation

Before this rewrite, repository docs were stale in several places:

- wrong project path references
- outdated stack descriptions
- partially mismatched feature descriptions

### 12.5 Test Coverage Gap

There are no visible automated tests for:

- POS checkout and returns
- roasting conversions
- payroll calculations
- inventory transfer workflows
- schema compatibility utilities

### 12.6 Mixed Hard Delete / Soft Delete Patterns

The CRM area shows both soft-delete and hard-delete implementations, which should be unified before relying on auditability assumptions.

## 13. Recommended Refactor Priorities

1. Extract domain hooks or services from `POSView`, `InventoryView`, `StaffView`, and `ConfigurationView`.
2. Move inventory mutation logic behind Supabase RPCs consistently and eliminate fallback stock math in the client where possible.
3. Standardize transaction ownership on `user_id` rather than display-name matching.
4. Resolve environment-variable handling for Gemini and Supabase config.
5. Add integration tests for checkout, returns, roasting completion, and stock transfers.
6. Split translation data and large domain types into smaller files.
7. Reconcile CRM delete semantics.

## 14. Repository SQL and Migration Map

Main setup and migration files:

- `enable_staff_management.sql`
- `audit_log_setup.sql`
- `enable_inventory_features.sql`
- `enable_cash_features.sql`
- `migrations/20260330_cashier_rls_policies.sql`
- `migrations/fix_cashier_profile_update.sql`

These files matter because a meaningful part of application behavior depends on database-side objects not created by the frontend itself.

## 15. Current Codebase Reality in One Sentence

This project is a feature-rich React + Supabase operations platform where most domain behavior is implemented directly in client views, with SQL scripts and RPC functions providing the backend contracts for inventory, workforce, cash, reporting, and access control.
