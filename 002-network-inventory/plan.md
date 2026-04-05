# Implementation Plan: Network Inventory Orchestration

**Branch**: `002-network-inventory` | **Date**: 2026-03-03 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `002-network-inventory/spec.md`

## Summary

Implement centralized hub-and-branch inventory orchestration with:
- policy-driven replenishment,
- atomic transfer lifecycle,
- real-time coverage/risk visibility,
- unified KPI dashboard,
- variance and daily review workflows.

## Technical Context

**Language/Version**: TypeScript 5.8 + React 19  
**Primary Dependencies**: Supabase JS 2.x, PostgreSQL/Supabase SQL functions, existing export utilities  
**Storage**: Supabase PostgreSQL  
**Target Platform**: Web dashboard (desktop/mobile responsive)  
**Performance Goal**: dashboard responses < 2s

## Architecture Decisions

1. **Policy as first-class data**: store hub/branch/SKU policies in dedicated tables (no hard-coded logic).
2. **Atomic inventory changes**: encapsulate dispatch/receipt mutations in SQL RPC functions + transactional updates.
3. **Event-driven computed layer**: maintain summary/materialized views for coverage and KPI snapshots.
4. **Internal-first replenishment**: recommendation engine evaluates transferable internal surplus before PO candidates.
5. **Immutable operations trail**: append-only event tables for transfers and adjustments.

## Phased Delivery

### Phase 1 - Data Foundation (P1)
- Extend `locations` and SKU policy schema.
- Add transfer policy + emergency rule tables.
- Add variance/root-cause + daily review tables.
- Add immutable audit event tables and protection triggers.

### Phase 2 - Transaction Integrity (P1)
- Add dispatch/receipt RPCs with strict state transition checks.
- Enforce atomic inventory and in-transit updates.
- Add emergency workflow fields and response-time stamping.

### Phase 3 - Real-Time Visibility (P1)
- Add network stock, in-transit, and coverage views.
- Add risk flags (stockout, overstock, below target).
- Wire dashboards to read from views.

### Phase 4 - Planning & Automation (P2)
- Add replenishment recommendation function.
- Add scheduled draft transfer generation.
- Add internal-before-external logic and notifications.

### Phase 5 - KPI, Reporting, Operations Review (P2)
- Add network KPI snapshots and comparative dashboard widgets.
- Add daily variance workflow screens with escalation.
- Add exports and time-range comparison.

## Data Model Additions (High Level)

- `hub_policies`
- `sku_branch_policies`
- `transfer_policy_rules`
- `transfer_approval_matrix`
- `transfer_event_logs` (immutable)
- `inventory_coverage_snapshots` (or view/materialized view)
- `variance_records`
- `daily_operational_reviews`
- `network_kpi_snapshots`

## API/Function Additions (High Level)

- `rpc_dispatch_transfer(transfer_id, actor_id, payload)`
- `rpc_receive_transfer(transfer_id, actor_id, payload)`
- `rpc_compute_replenishment(branch_id, sku_id, horizon_days)`
- `rpc_generate_scheduled_drafts(schedule_date)`
- `rpc_escalate_open_variances(cutoff_ts)`

## Validation and Control Rules

- Transfer state machine validation at DB layer.
- Emergency transfer requires reason code.
- Same-day deadline enforcement for variance records.
- Audit row immutability via trigger.

## Risks and Mitigations

- **Risk**: Dashboard latency at scale.  
  **Mitigation**: pre-aggregated snapshots/materialized views + indexed filter columns.
- **Risk**: race conditions in transfer posting.  
  **Mitigation**: `FOR UPDATE` locks + transactional RPC functions.
- **Risk**: policy drift between UI and DB.  
  **Mitigation**: server-side validation for all thresholds and transitions.

## Exit Criteria by Phase

- Phase 1: schemas and constraints deployed without regressions.
- Phase 2: dispatch/receipt tested for atomicity and consistency.
- Phase 3: visibility widgets show accurate near-real-time coverage/risk.
- Phase 4: recommendations and draft generation functionally validated.
- Phase 5: KPI dashboard/export and variance workflows operational.
