# Code Logic Analysis

Date: 2026-03-01

## Scope
- POS checkout and inventory deduction flow
- CRM list/search data safety
- Configuration Green Beans stock movement integrity
- General runtime stability and data-shape resilience

## Summary
The current system is functionally coherent and build-stable, with practical safeguards added in key high-risk paths (null-safe CRM filtering, POS numeric normalization, RPC fallbacks).

Main remaining risks are logic drift between schemas (legacy/new movement columns), permissive checkout assumptions, and broad use of dynamic typing (`any`) in critical data paths.

## Logic Review

### 1) POS Flow
- Product source now comes from `product_definitions`, merged with optional inventory rows.
- Checkout writes transaction first, then performs inventory deduction.
- Inventory deduction supports RPC-first and direct-update fallback.

Strengths:
- Graceful handling when DB functions are unavailable.
- Numeric normalization prevents common UI crashes around `toFixed()`.

Risks:
- If location is missing, deduction may not execute against intended inventory scope.
- Dynamic mapping between `id`, `product_id`, and `name` can hide data-shape problems.

### 2) CRM Flow
- Search now safely handles nullable name/phone/email fields.
- `full_name` vs `name` mismatch is normalized.

Strengths:
- Crash class (`toLowerCase` on undefined) addressed.

Risks:
- UI model still relies on local normalization rather than strict typed DTO mapping.

### 3) Green Beans in Configuration
- Opening stock and manual adjustments are logged through movement records.
- Fallback logic supports legacy and extended movement schemas.

Strengths:
- Stock change operations are now movement-backed rather than silent updates.

Risks:
- Mixed-schema compatibility should eventually be consolidated to a single canonical DB structure.

## Recommendations
1. Enforce required location in POS checkout path.
2. Introduce typed adapters per table response (`transactions`, `return_requests`, `green_beans`).
3. Move compatibility fallback logic into service modules to reduce component complexity.
4. Add focused tests for:
   - checkout with missing location,
   - adjustment movement logging,
   - CRM null-field search cases.

## Verification
- Build check: PASS (`npm run build`)

