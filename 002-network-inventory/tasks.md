# Tasks: Network Inventory Orchestration

**Feature**: 002-network-inventory  
**Branch**: `002-network-inventory`  
**Created**: 2026-03-03  
**Status**: Ready for Implementation

## Phase 1: Schema & Policy Foundation (P1)

- [ ] T001 Add hub policy columns/tables in SQL migration (`hub_policies`, dispatch capacity, safety stock policy)
- [ ] T002 Add branch policy fields in `locations` (if missing): service level, replenishment frequency, lead time, emergency priority, velocity
- [ ] T003 Add SKU branch policy table (`sku_branch_policies`) with min stock, reorder point, safety stock, transfer unit, shelf-life, moving class
- [ ] T004 Add transfer policy tables (`transfer_policy_rules`, `transfer_approval_matrix`, emergency override permissions)
- [ ] T005 Add immutable transfer/adjustment event log tables and triggers
- [ ] T006 Add variance + root-cause workflow tables (`variance_records`)
- [ ] T007 Add daily operational review table (`daily_operational_reviews`)
- [ ] T008 Add RLS policies for new tables by role

## Phase 2: Atomic Transfer Lifecycle (P1)

- [ ] T009 Implement DB state machine constraints for transfer statuses
- [ ] T010 Implement `rpc_dispatch_transfer` with transactional inventory + in-transit updates
- [ ] T011 Implement `rpc_receive_transfer` with transactional in-transit decrement + destination increment
- [ ] T012 Add emergency flow validation (reason required, override permissions)
- [ ] T013 Capture emergency response-time KPI timestamps
- [ ] T014 Add test SQL scenarios for invalid transitions and rollback behavior

## Phase 3: Real-Time Visibility & Coverage (P1)

- [ ] T015 Create network inventory view (hub, branch, in-transit by SKU)
- [ ] T016 Create coverage calculation view/function: `days_coverage = on_hand / avg_daily_consumption`
- [ ] T017 Add risk flags: stockout risk, overstock risk, below-service-level
- [ ] T018 Extend `InventoryView` data loading to consume new fields/views
- [ ] T019 Add UI cards for hub stock health, branch coverage status, active/emergency transfers
- [ ] T020 Add filters (branch, SKU, date range) and export hook integration

## Phase 4: Replenishment & Planning Automation (P2)

- [ ] T021 Implement replenishment recommendation function using consumption + forecast + lead time + safety stock + frequency
- [ ] T022 Implement branch velocity-driven replenishment adaptation rules
- [ ] T023 Implement scheduled cycle configuration table and scheduler function for draft transfers
- [ ] T024 Build auto-draft transfer generation workflow with manual pre-dispatch edit
- [ ] T025 Implement internal-redistribution-first recommendation before PO path
- [ ] T026 Add low-stock alerts and unresolved variance escalation jobs

## Phase 5: KPI & Dashboard (P2)

- [ ] T027 Add KPI snapshot computation (turnover, waste, transfer frequency, emergency purchase ratio, holding cost, planned-vs-actual variance)
- [ ] T028 Add service-level KPI computation (fill rate, stockout incidents, emergency frequency)
- [ ] T029 Build unified network dashboard view/components
- [ ] T030 Add comparative branch service performance widget
- [ ] T031 Add daily deviation indicators and variance owner/deadline status
- [ ] T032 Add reporting endpoints/queries for branch/network/waste/emergency/financial impact reports

## Phase 6: Hardening, Performance, and QA

- [ ] T033 Add indexes for dashboard filters and high-frequency joins
- [ ] T034 Add materialized views/caching strategy to keep dashboard <2s
- [ ] T035 Add integration tests for atomicity of dispatch/receipt
- [ ] T036 Add integration tests for coverage and risk flag correctness
- [ ] T037 Add integration tests for emergency override RBAC
- [ ] T038 Add audit immutability tests (prevent update/delete)
- [ ] T039 Add load/perf tests for dashboard query SLA
- [ ] T040 Update technical documentation and operations runbook

## Suggested First Build Slice (Immediate)

- [ ] S1: T002 + T003 + T015 + T016 + T017 (policy + visibility + coverage baseline)
- [ ] S2: T009 + T010 + T011 + T014 (atomic lifecycle baseline)
- [ ] S3: T019 + T020 (first control tower UI)
