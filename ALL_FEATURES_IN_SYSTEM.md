# Doha Roastery POS - Complete Feature Inventory

This file documents the implemented features in the current codebase.

## 1) Core Platform

- React + TypeScript single-page app with Supabase backend.
- Multi-language UI: Arabic and English with automatic RTL/LTR switching.
- Light/Dark theme toggle.
- Keyboard shortcuts and quick actions overlay.
- Persistent UI preferences in local storage (language, active tab, sidebar state, theme).

## 2) Authentication, Users, and Access Control

- Supabase auth login with username/email + password.
- Forgot/reset/change password flows.
- Session tracking with expiry warning and manual refresh.
- Account disable handling (`profiles.is_active = false`).
- Role-based module visibility and permissions.
- Roles in system:
  - `ADMIN`
  - `MANAGER`
  - `HR`
  - `ROASTER`
  - `CASHIER`
  - `WAREHOUSE_STAFF`

## 3) Main Application Modules

- Dashboard
- Staff
- Roasting
- Inventory
- POS
- Reports
- Branch Performance
- Branch Financials
- CRM
- AI Insights
- Configuration

## 4) Dashboard Features

- Today sales KPI.
- Weekly roasting count KPI.
- Total green bean stock KPI.
- Average waste ratio KPI.
- Low-stock warning banner.
- Sales and roasting trend charts.
- Recent roasting batches table.

## 5) Staff Management Features

### A) Employee Master Data
- Full employee profile (personal, contact, employment, financial, Qatar-specific fields).
- Employee create/edit with validation (Zod + react-hook-form).
- Employee photos and profile-related data fields.
- Department/status/type filters and search.
- List/grid view modes.

### B) Time & Attendance
- Clock-in / clock-out per employee.
- Quick clock action.
- Manual attendance entry with reason.
- Open time log tracking.
- Daily attendance integration and summary (present/absent/late/on leave).
- Attendance reports by period.
- Calendar-based attendance browsing.

### C) Scheduling
- Shift templates (Morning/Evening/Night/Split).
- Weekly schedule management per employee.
- Schedule views (weekly/monthly).
- Grace/break minutes controls.

### D) Payroll
- Monthly payroll generation from attendance + salary.
- Overtime and lateness deductions.
- Salary advance deductions.
- Payroll totals summary.
- Payroll approval workflow (`HR -> Manager -> Admin`).
- Payroll history writing after final approval.
- Payslip print view.
- Payroll CSV export and bank transfer CSV export.

### E) Salary Advances
- Salary advance request creation.
- Payment recording against advances.
- Auto-close advances when fully paid.
- Advances and payments tracking per employee.

### F) Performance Management
- KPI definition by role.
- KPI sources from POS and Roasting metrics.
- Performance review categories.
- Bonus rules (percentage/fixed) by score range.
- Performance reviews with period, notes, ratings, KPI scores, bonus computation.
- Auto-fill KPI values from live system data.
- Historical performance review list.

### G) Branch Workforce Operations
- Branch transfer requests for employees (temporary/permanent).
- Branch staffing targets by role.
- Coverage/availability style staff summaries.
- Shift swap requests with manager approve/reject workflow.

## 6) Roasting & Production Features

- New roasting batch creation from green beans.
- Batch lifecycle states (Preparation, Roasting, Cooling, Inspection, Packaging, Completed, Rejected, Deleted).
- Pre/post weight capture and automatic waste % calculation.
- Batch history log entries.
- Batch cancel flow with stock rollback movement.
- Active vs completed batches segregation.
- Filter/search by roast level and readiness.
- Green bean monthly consumption analytics snapshot.

### Packaging & Output
- Package allocation from roasted batch weight.
- Multi-line packaging allocations per batch.
- Production date, packaging date, destination location.
- Expiry date calculation from template shelf life.
- Packaging unit SKU generation.
- Inventory item creation from produced units.
- Production record/invoice insertion.
- Label preview + print with QR code.

## 7) Inventory & Network Operations Features

### A) Location Management
- Create/edit locations (warehouse/branch/roastery).
- Branch hierarchy, HQ flag, parent branch.
- Branch operating hours by weekday.
- GPS/contact/licensing/commercial details.
- Service level and replenishment settings.
- Branch category and emergency priority settings.

### B) Inventory Visibility
- Packaged inventory monitoring across locations.
- Network stock visibility model.
- Branch coverage metrics (current stock, in-transit, days coverage, risk flags).
- Stagnant stock controls.

### C) Transfers
- Transfer order lifecycle: draft/pending approval/approved/in-transit/received/completed/cancelled.
- Source/destination and manifest management.
- Transfer value threshold-based approval behavior.
- Receive flow with discrepancy tracking.

### D) Stock Adjustments
- Adjustment reasons (damage, theft, counting error, expiry, QC rejected, etc.).
- Adjustment approval workflow.
- Value threshold for manager-level approval.

### E) Purchases
- Purchase order lifecycle (draft/ordered/received/partial/rejected/cancelled).
- Supplier/location manifests and receiving updates.

### F) Cycle Counts
- Inventory count tasks by frequency (daily/weekly/monthly/annual).
- Count entry capture with variance and variance value.
- Approval flow for count discrepancies.

### G) Green Bean Query Service (`inventoryService`)
- Server-side filtering, sorting, and pagination.
- Advanced filters (origin, supplier, organic flag, date ranges, quantity ranges).
- Low/good stock status filtering.
- Bulk green bean insertion.
- Order reservation creation and status updates.

## 8) POS Features

### A) Selling Workflow
- Product browsing by tabs (`ALL`, `PACKAGED`, `DRINKS`, `HISTORY`, `RETURNS`).
- Cart add/remove/quantity management.
- Beverage customization (size, milk type, sugar level, add-ons).
- VAT and discount handling in totals.
- Location-aware inventory selling.

### B) Payments
- Cash payment with received amount and change.
- Card payment with optional card reference.
- Mobile payment.
- Split payment (cash/card/mobile + card reference).

### C) Shift & Cash Drawer Management
- Open shift with starting cash.
- Shift totals (sales/cash in/cash out/expected cash).
- Cash in/out operations with reasons.
- Close shift with reconciliation and discrepancy output.
- Shift details and reports style UI.

### D) Receipts & Printing
- Thermal receipt print layout (`58mm`/`80mm`).
- Auto print after successful checkout.
- Reprint flow with role authorization (admin/manager).
- Reprint audit logging.

### E) Returns & Refunds
- Invoice search for return processing.
- Partial/full item return with required reason per item.
- Return request workflow with approval/rejection.
- Inventory re-add on approved return.
- Return receipt printing.

### F) CRM in POS
- Customer search/attach during checkout.
- Quick customer creation from POS.
- Customer transaction recording and loyalty update.

## 9) CRM Module Features

- Customer list with search and pagination behavior.
- Customer create/update/delete operations.
- Loyalty points and spend/visit overview.
- Tier tracking and last visit display.
- Customer metrics summary cards.

## 10) Reports Module Features

- Product profitability analytics (revenue/cost/profit/margin).
- Sales distribution chart.
- Production report cards (daily/monthly output, waste deltas, quality pass rate).
- Waste leaderboards:
  - by roast profile
  - by roaster
  - by bean
- Roaster monthly performance table.
- Advanced reports:
  - production cost report
  - green bean consumption report
  - roast profile consistency report
- Export to Excel-compatible file and PDF print export.

## 11) AI Insights Features

- AI/analytics dashboard with bilingual report output (Arabic/English blocks).
- Forecast next 7 days demand using historical movement patterns.
- Waste insights by bean/profile combo.
- QC pass rate summary.
- Roast parameter suggestions (charge temp / roasting time bands).
- Low-margin beverage detection using recipe + inventory unit conversion.

## 12) Branch Analytics Modules

### Branch Performance
- Cross-location performance with selectable period (day/week/month/year).
- Sortable branch table (sales, transactions, growth).
- Average transaction value and top products.
- Staff count by branch.

### Branch Financials
- Financial view by period (month/quarter/year).
- Revenue/cost/profit/margin by branch.
- Summary and detailed modes.
- Expense breakdown (labor/supplies/utilities/other).

## 13) Configuration Module Features

### A) Product Catalog
- Full product lifecycle management.
- Multi-type products: packaged coffee, beverage, accessory, raw material.
- Variant fields (size/flavor/label/parent variant).
- Status control (`ACTIVE`, `DISABLED`, `DISCONTINUED`).
- Supplier, SKU, perishable and expiry management.
- Recipe/BOM/add-on editing.
- Cost model inputs (labor, overhead, green bean estimate).
- Category/SKU/supplier/status filters.
- Product-level stock visibility by location.

### B) Package Templates
- Packaging template management (size, weight, cost, shelf life, SKU prefix).

### C) Roast Profiles
- Roast profile create/edit/toggle active.
- Profile forking from parent profile.
- Bean linkage and profile JSON details.

### D) Green Beans
- Green bean master data management.
- Green bean stock adjustments.
- Green bean movement logging with compatibility for old/new schema.
- Green bean movement history browsing.

### E) System Settings
- Store identity fields (name/address/phone).
- VAT rate and VAT number.
- Currency and printer width.
- Late penalty configuration.

### F) Database/Schema Utilities
- Product schema integrity checks.
- SQL upgrade scripts embedded in UI for schema alignment.
- Copy/apply SQL flow for missing columns/features.

### G) Catalog Import/Export
- Product catalog template export.
- Product catalog CSV/XLS export.
- Product catalog import from file.

## 14) Hardware & External Integrations

- Supabase (Auth + Postgres + RPC + views + storage usage).
- Google Gemini integration service for insights and stock prediction (`services/geminiService.ts`).
- Python thermal printer module with ESC/POS support (`thermal_printer/receipt_printer.py`).
- QR-code label image generation endpoint for roast labels.

## 15) Utility Services

- `beverageService.ts`: recipe cost and add-on price calculations.
- `crmService.ts`: customer CRUD/search operations.
- `shiftService.ts`: shift lifecycle and cash movement totals.
- `inventoryService.ts`: advanced inventory query and reservation APIs.
- `utils/reportExport.ts`: PDF/Excel report export helpers.

## 16) Feature-Enable SQL Scripts in Repository

- `enable_inventory_features.sql`
- `enable_staff_management.sql`
- `enable_cash_features.sql`
- `audit_log_setup.sql`
- `roasting-inv.sql`

These scripts provision/extend required DB structures for the corresponding modules.
