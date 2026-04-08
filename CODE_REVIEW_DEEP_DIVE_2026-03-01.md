# Deep Code Review (2026-03-01)

## Coverage
- App shell/navigation
- POS checkout and inventory mutation flow
- Roasting stock mutation flow
- CRM query and validation paths
- Configuration green-bean movement model

## Build Status
- `npm run build`: PASS

## Findings

### Critical
1. Non-atomic multi-write flows in operational modules
- POS checkout and roasting workflows perform multiple dependent writes.
- If one write fails after earlier writes succeed, partial state can remain.
- Recommendation: move critical sequences into database RPC transactions where possible.

### High
2. Inconsistent runtime error feedback
- Several catch blocks only log to console without user-visible errors.
- Impact: operations appear unresponsive while silently failing.
- Recommendation: standardize `alert/toast + structured log` for user-facing operations.

3. Mixed schema compatibility burden
- Green-bean movement logic supports legacy and extended schemas.
- Impact: harder long-term maintenance and testing.
- Recommendation: execute migration to canonical movement schema and remove fallback branches.

### Medium
4. Dynamic typing in hot paths
- Heavy `any` usage in POS/Configuration/Inventory mapping paths.
- Impact: schema drift can surface as runtime defects.
- Recommendation: introduce typed DTO adapters at query boundaries.

5. Initial bundle remains heavy
- Core bundle still warns at >500KB.
- Recommendation: continue splitting and isolate large chart/report dependencies.

## Prioritized Action Plan
1. Consolidate write-critical operations into transactional RPCs.
2. Normalize user-visible error handling for critical mutations.
3. Finalize green-bean movement schema migration.
4. Replace `any` in POS and inventory critical paths first.
5. Continue bundle optimization through route/component splitting.

