# Research: Staff Management System with RBAC

**Feature**: 001-staff-management  
**Date**: 2026-02-12  
**Researcher**: AI Planning Assistant

---

## Decision 1: Database Platform & RLS Implementation

**Decision**: Use Supabase PostgreSQL with native Row Level Security (RLS) policies

**Rationale**:
- Supabase is already established in the project stack (AGENTS.md)
- PostgreSQL RLS provides database-level security enforcement as required by FR-008
- Policies are enforced regardless of application layer, satisfying "Never rely on frontend role checks" requirement
- Native integration with Supabase Auth for user identity

**Implementation Pattern**:
```sql
-- Example RLS policy for staff table
CREATE POLICY "staff_access_policy" ON staff
  FOR ALL
  USING (
    -- Admin/Owner see all
    auth.jwt() ->> 'role' IN ('ADMIN', 'OWNER')
    OR
    -- Manager sees their branch
    (auth.jwt() ->> 'role' = 'MANAGER' 
     AND primary_branch_id IN (
       SELECT branch_id FROM staff_branches 
       WHERE staff_id = auth.uid()
     ))
    OR
    -- Users see own record
    user_id = auth.uid()
  );
```

**Alternatives Considered**:
- Application-level permission checks: Rejected - violates security requirement for database-level enforcement
- Separate auth service (Auth0, Cognito): Rejected - adds unnecessary complexity, Supabase Auth is sufficient

---

## Decision 2: Audit Logging Strategy

**Decision**: Dedicated `audit_logs` table with PostgreSQL triggers + application-layer logging

**Rationale**:
- Triggers ensure 100% capture even if application bypasses API (FR-009 requirement)
- Application layer provides context (IP address, user agent) not available in triggers
- Hybrid approach satisfies "immutable audit log" requirement with maximum observability

**Implementation Pattern**:
```sql
-- Trigger for automatic audit capture
CREATE TRIGGER staff_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON staff
  FOR EACH ROW
  EXECUTE FUNCTION log_staff_change();
```

**Retention Strategy**:
- 1 year active retention (per clarification)
- Archive to cold storage after 1 year
- Use PostgreSQL partitioning by date for performance

**Alternatives Considered**:
- External audit service (AWS CloudTrail): Rejected - adds vendor lock-in and cost
- Append-only application logs: Rejected - can be bypassed, doesn't guarantee 100% capture

---

## Decision 3: Optimistic Locking Implementation

**Decision**: Use integer `version` column with check constraint

**Rationale**:
- Simple, database-native approach
- Works well with Supabase client
- Clear error semantics for conflict detection (FR-015)
- No additional infrastructure needed

**Implementation Pattern**:
```sql
ALTER TABLE staff ADD COLUMN version INTEGER DEFAULT 1;

-- Update query must include version check
UPDATE staff 
SET name = 'New Name', version = version + 1
WHERE id = 'uuid' AND version = :expected_version;

-- Check rows affected = 1, else conflict occurred
```

**Conflict Response**:
- HTTP 409 Conflict status
- Return current server-side data
- Client can choose to retry or show merge UI

**Alternatives Considered**:
- Timestamp-based (`updated_at`): Rejected - clock skew issues in distributed systems
- UUID etag: Rejected - more complex, no clear benefit over version integers

---

## Decision 4: Phone Number Validation & Uniqueness

**Decision**: E.164 standard format with PostgreSQL unique partial index

**Rationale**:
- E.164 is the international standard for phone numbers
- Partial index excludes deactivated staff, allowing reuse after 90 days (per clarification)
- Libphonenumber-js for client-side validation

**Implementation Pattern**:
```sql
-- Partial unique index for active staff only
CREATE UNIQUE INDEX idx_staff_phone_active 
ON staff(phone) 
WHERE is_active = true;

-- Validation check for 90-day cooling period
CREATE OR REPLACE FUNCTION check_phone_cooling_period()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM staff 
    WHERE phone = NEW.phone 
    AND is_active = false
    AND updated_at > NOW() - INTERVAL '90 days'
  ) THEN
    RAISE EXCEPTION 'Phone number in 90-day cooling period';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Alternatives Considered**:
- Simple unique constraint: Rejected - prevents phone reuse entirely, violates clarified requirement
- Application-level validation only: Rejected - race conditions possible

---

## Decision 5: Role Hierarchy Enforcement

**Decision**: Database enum + application-level role comparison

**Rationale**:
- PostgreSQL ENUM ensures data integrity
- Application encodes hierarchy logic (OWNER > ADMIN > MANAGER > ...)
- Prevents invalid role assignments as required by FR-005 and FR-013

**Role Hierarchy Definition**:
```typescript
const ROLE_HIERARCHY = {
  'OWNER': 100,
  'ADMIN': 90,
  'MANAGER': 70,
  'ROASTER': 50,
  'WAREHOUSE_STAFF': 50,
  'CASHIER': 40,
  'AUDITOR': 20
} as const;

// Assignment check
function canAssignRole(assignerRole: Role, targetRole: Role): boolean {
  return ROLE_HIERARCHY[assignerRole] > ROLE_HIERARCHY[targetRole];
}
```

**Database Schema**:
```sql
CREATE TYPE staff_role AS ENUM (
  'OWNER', 'ADMIN', 'MANAGER', 'ROASTER', 
  'WAREHOUSE_STAFF', 'CASHIER', 'AUDITOR'
);
```

**Alternatives Considered**:
- Separate permissions table: Rejected - overkill for 7 fixed roles, adds complexity
- JWT claim-based roles only: Rejected - need database persistence for queries

---

## Decision 6: Multi-Branch Assignment Data Model

**Decision**: Junction table `staff_branches` with `is_primary` flag

**Rationale**:
- Supports many-to-many relationship (FR-012)
- Single source of truth for branch assignments
- Constraint ensures exactly one primary branch (FR-002)

**Schema Design**:
```sql
CREATE TABLE staff_branches (
  staff_id UUID REFERENCES staff(id),
  branch_id UUID REFERENCES branches(id),
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (staff_id, branch_id)
);

-- Constraint: exactly one primary branch per staff
CREATE UNIQUE INDEX idx_one_primary_branch 
ON staff_branches(staff_id) 
WHERE is_primary = true;
```

**Query Pattern**:
```sql
-- Get staff with their primary branch
SELECT s.*, b.branch_id as primary_branch_id
FROM staff s
JOIN staff_branches b ON s.id = b.staff_id AND b.is_primary = true
WHERE s.is_active = true;
```

**Alternatives Considered**:
- Array column in staff table: Rejected - harder to query, no referential integrity
- Separate primary_branch_id FK + secondary array: Rejected - data duplication risk

---

## Decision 7: Session/Token Strategy for Lazy Revocation

**Decision**: JWT with short expiration (15 min) + refresh token validation on deactivation

**Rationale**:
- Balances security with performance (per clarification: lazy revocation)
- Short JWT expiration ensures quick permission propagation
- Refresh token check on renewal allows revocation without immediate session termination

**Implementation Flow**:
1. User deactivated → `is_active` set to false
2. Current JWT valid until expiration (max 15 min)
3. On refresh token request, check `is_active` status
4. If deactivated, reject refresh → user effectively logged out

**Token Claims**:
```json
{
  "sub": "user_uuid",
  "role": "MANAGER",
  "branch_ids": ["branch_1", "branch_2"],
  "iat": 1707753600,
  "exp": 1707754500
}
```

**Alternatives Considered**:
- Immediate session invalidation (token blacklist): Rejected - requires infrastructure (Redis), overkill for this use case
- Long-lived tokens with database check on every request: Rejected - adds latency to every API call

---

## Decision 8: Frontend State Management

**Decision**: React Query (TanStack Query) for server state + Zustand for UI state

**Rationale**:
- React Query provides caching, background refetching, and optimistic updates
- Built-in support for optimistic locking conflict handling (retry with fresh data)
- Zustand is lightweight for local UI state (filters, modals)

**Pattern for Optimistic Locking**:
```typescript
const updateStaff = useMutation({
  mutationFn: updateStaffApi,
  onError: (error) => {
    if (error.response?.status === 409) {
      // Conflict - show error with option to retry
      showConflictError(error.response.data.currentVersion);
    }
  }
});
```

**Alternatives Considered**:
- Redux Toolkit: Rejected - overkill for this feature scope
- Apollo Client: Rejected - requires GraphQL, project uses REST

---

## Summary Table

| Decision | Technology/Pattern | Key Rationale |
|----------|-------------------|---------------|
| Database | Supabase PostgreSQL | Existing stack, native RLS |
| Security | PostgreSQL RLS policies | Database-level enforcement |
| Audit | Triggers + Application logs | 100% capture guaranteed |
| Concurrency | Integer version column | Simple, effective |
| Phone | E.164 + partial unique index | Supports 90-day reuse |
| Roles | PostgreSQL ENUM + hierarchy map | Data integrity + flexibility |
| Branches | Junction table with is_primary | Many-to-many with constraints |
| Sessions | Short JWT + refresh validation | Lazy revocation as specified |
| Frontend | React Query + Zustand | Caching + optimistic updates |

---

## Open Questions for Implementation

None - all technical decisions resolved. Ready for Phase 1 design.
