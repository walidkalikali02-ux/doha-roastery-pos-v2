# Feature Specification: Network Inventory Orchestration

**Feature Branch**: `002-network-inventory`  
**Created**: 2026-03-03  
**Status**: Draft  
**Input**: User description covering central hub configuration, branch/item configuration, real-time visibility, transfer lifecycle/policies, replenishment planning, forecasting, service level management, KPIs, unified dashboard, variance workflows, audit/control, automation, and reporting.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configure Hub, Branch, and SKU Policies (Priority: P1)

As an Inventory Admin, I want to configure hub rules, branch service/replenishment parameters, and SKU inventory policy values so that planning and transfers run on governed parameters.

**Independent Test**: Configure one hub, two branches, and two SKUs; verify all policy values persist and are editable with audit logging.

**Acceptance Scenarios**:

1. **Given** an admin opens branch setup, **When** they save service level target, lead time, emergency priority, replenishment frequency, and velocity category, **Then** values are stored and shown in branch profile.
2. **Given** an admin opens SKU setup, **When** they save min stock per branch, reorder threshold, safety stock, transfer unit, shelf life, and moving class, **Then** configuration is stored and used by planning functions.
3. **Given** a location is marked as hub, **When** admin sets dispatch capacity and safety stock policy, **Then** dispatch planning enforces hub constraints.

---

### User Story 2 - Real-Time Network Visibility and Coverage (Priority: P1)

As an Operations Manager, I want real-time visibility across hub, branches, and in-transit quantities plus coverage risk flags so I can prevent stockouts and overstock.

**Independent Test**: Complete sale, transfer, production, and adjustment transactions; verify stock, in-transit, and coverage values update within the same refresh cycle.

**Acceptance Scenarios**:

1. **Given** a sale posts at a branch, **When** transaction commits, **Then** branch on-hand and coverage recalculate automatically.
2. **Given** transfer dispatch and receipt events occur, **When** each event commits, **Then** in-transit and on-hand values update atomically.
3. **Given** coverage falls below target, **When** dashboard refreshes, **Then** branch receives stockout-risk and service-level-breach flags.

---

### User Story 3 - Policy-Driven Internal Transfer Lifecycle (Priority: P1)

As a Warehouse/Manager role, I want policy-driven transfer creation/approval/dispatch/receipt including emergency flows so inventory movement is controlled and traceable.

**Independent Test**: Execute normal and emergency transfer flows end-to-end with approval hierarchy and immutable event logging.

**Acceptance Scenarios**:

1. **Given** a branch request is created, **When** policy engine evaluates candidates, **Then** system recommends internal source before external PO.
2. **Given** an emergency transfer is flagged, **When** approved, **Then** schedule override applies, reason code is mandatory, notifications are sent, and response KPI is captured.
3. **Given** dispatch and receipt are posted, **When** operations complete, **Then** inventory updates are atomic and transfer state transitions are valid.

---

### User Story 4 - Automated Replenishment, Forecasting, and Scheduling (Priority: P2)

As a Planner, I want dynamic recommendations and auto-draft transfer orders based on demand/lead-time/safety rules so distribution is proactive.

**Independent Test**: Run planner for a week window; verify generated draft transfers match policy inputs and can be manually adjusted before dispatch.

**Acceptance Scenarios**:

1. **Given** historical and forecast demand exists, **When** planner runs, **Then** recommended qty uses consumption, lead time, safety stock, and velocity.
2. **Given** fixed schedules are configured, **When** cycle trigger runs, **Then** draft transfer orders are generated automatically.
3. **Given** planner recommendations are reviewed, **When** user edits quantities, **Then** updates are retained and dispatch uses final approved quantities.

---

### User Story 5 - Unified Network Control Tower Dashboard (Priority: P2)

As Leadership, I want one dashboard for hub health, branch coverage, transfers, emergency dependency, variance, and service KPIs so daily network decisions are data-driven.

**Independent Test**: Filter by branch/SKU/date range; verify all widgets and exports reflect filtered scope with response under performance target.

**Acceptance Scenarios**:

1. **Given** user selects branch and SKU filters, **When** dashboard loads, **Then** all KPIs and grids reflect scoped network data.
2. **Given** unresolved variances exist, **When** daily review opens, **Then** owner/deadline/action status is visible with escalation indicators.
3. **Given** user exports report, **When** export is generated, **Then** CSV/XLSX contains the same filtered metrics as UI.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support one central hub location with production inventory, distribution inventory, safety stock, and max daily dispatch capacity.
- **FR-002**: System MUST support per-branch policy fields: service level target, replenishment frequency, lead time from hub, emergency priority, and velocity category.
- **FR-003**: System MUST support per-SKU policy fields: min stock per branch, reorder threshold, safety stock, transfer unit, shelf life, and moving-classification.
- **FR-004**: System MUST show real-time hub, branch, and in-transit quantities and auto-refresh after sales, transfers, adjustments, and production postings.
- **FR-005**: System MUST compute days of coverage per branch and SKU as `on_hand / avg_daily_consumption`.
- **FR-006**: System MUST flag stockout risk, overstock risk, and coverage below service-level threshold.
- **FR-007**: System MUST implement transfer policy engine for allowed sources, approval hierarchy, emergency override permissions, and internal-first recommendation.
- **FR-008**: System MUST enforce transfer lifecycle states: request, approval, dispatch, in-transit, receipt, completion/cancel.
- **FR-009**: System MUST update inventory atomically at dispatch/receipt transitions.
- **FR-010**: System MUST support emergency transfer flag, reason code, manager notification, and response-time KPI capture.
- **FR-011**: System MUST generate replenishment recommendations using historical consumption, forecast demand, lead time, safety stock, and replenishment frequency.
- **FR-012**: System MUST support scheduled cycles with auto-draft transfer order generation and manual quantity override before dispatch.
- **FR-013**: System MUST calculate branch service KPIs: fill rate, stockout incidents, emergency-order frequency.
- **FR-014**: System MUST compute network KPIs: turnover, waste %, internal transfer frequency, emergency purchase ratio, holding cost by branch, planned-vs-actual variance.
- **FR-015**: System MUST provide a unified dashboard with branch/SKU/time filters and export capability.
- **FR-016**: System MUST record daily expected vs actual consumption variances and classify causes (demand spike, waste, counting error, theft/loss, data error).
- **FR-017**: System MUST enforce root-cause workflow with owner assignment, same-day deadline, corrective action notes, and closure-time tracking.
- **FR-018**: System MUST provide daily operational review log with selected improvement and measured result.
- **FR-019**: System MUST maintain immutable audit trails for all transfers and adjustments.
- **FR-020**: System MUST enforce RBAC for approvals, emergency overrides, and adjustments.
- **FR-021**: System MUST automate low-stock alerts, internal-transfer recommendation before external PO, draft transfer generation, safety-stock tuning suggestions, and unresolved variance escalation.
- **FR-022**: System MUST support branch/network/waste/emergency/financial-impact reporting.

### Non-Functional Requirements

- **NFR-001**: Dashboard queries MUST return in under 2 seconds at normal operating load.
- **NFR-002**: Inventory transactions MUST maintain atomicity and strong consistency.
- **NFR-003**: System MUST support real-time synchronization across all branches.
- **NFR-004**: Data model MUST support multi-region expansion without redesigning core entities.

### Key Entities

- **HubPolicy**: per-hub operational limits and stock rules.
- **BranchPolicy**: branch-level service/replenishment configuration.
- **SkuBranchPolicy**: SKU-specific thresholds by branch.
- **TransferPolicyRule**: allowed sources, approval chain, and emergency override matrix.
- **TransferEventLog**: immutable lifecycle event stream for transfer state changes.
- **CoverageSnapshot**: computed coverage and risk flags by branch/SKU/time.
- **VarianceRecord**: expected vs actual, category, owner, deadline, correction, closure.
- **DailyReviewLog**: daily improvement commitment and measured impact.
- **NetworkKpiSnapshot**: cached KPI metrics for dashboard speed.

## Success Criteria *(mandatory)*

- **SC-001**: 100% of branch and SKU policies are persisted and versioned with audit logs.
- **SC-002**: Inventory state reflects sale/transfer/adjustment/production events within one refresh cycle.
- **SC-003**: Coverage computation matches formula output within +/-0.5% tolerance.
- **SC-004**: 100% of transfer lifecycle transitions are policy-validated and audit-logged.
- **SC-005**: At least 95% of dashboard queries complete in < 2 seconds.
- **SC-006**: Emergency transfer response-time KPI is captured for 100% of emergency requests.
- **SC-007**: Variance workflow enforces owner + deadline + corrective action before closure.
- **SC-008**: Auto-recommendation engine proposes internal redistribution before external PO in eligible cases.

## Assumptions

- Existing `locations`, `inventory_items`, `stock_transfers`, `inventory_movements`, and `transactions` remain core operational tables.
- Existing Supabase stack, RLS approach, and role definitions remain in effect.
- Forecasting starts with deterministic/statistical models before ML upgrades.

## Dependencies

- Existing inventory and transfer posting logic in `InventoryView` and SQL functions.
- Existing user role model (`ADMIN`, `MANAGER`, `WAREHOUSE_STAFF`, etc.).
- Existing reporting export utility.

## Out of Scope (Phase 1)

- External supplier optimization using third-party lead-time APIs.
- Cross-company (multi-tenant) benchmark analytics.
- Fully automated dispatch without human approval.
