# Implementation Plan: Staff Management System with RBAC

**Branch**: `001-staff-management` | **Date**: 2026-02-12 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/001-staff-management/spec.md`

**Note**: This plan covers Phase 0 (Research) and Phase 1 (Design). Phase 2 (Tasks) will be created by `/speckit.tasks` command.

---

## Summary

Build a centralized staff management system with Role-Based Access Control (RBAC) for a multi-branch roastery operation. The system enables management to control who works where, prevent unauthorized access, assign employees to branches, and maintain full audit trails.

**Technical Approach**: Supabase PostgreSQL with Row Level Security (RLS) policies for database-level permission enforcement, React frontend with TypeScript, Zod validation, and optimistic locking for concurrent edit handling.

---

## Technical Context

**Language/Version**: TypeScript 5.8 + React 19  
**Primary Dependencies**: 
- Supabase JS Client 2.45 (database + auth)
- Zod 3.24 (validation)
- React Hook Form (form management)
- libphonenumber-js (phone validation)
- TanStack Query (server state management)
- Zustand (UI state management)

**Storage**: PostgreSQL 15+ (Supabase)  
**Testing**: Jest + React Testing Library  
**Target Platform**: Web application (responsive)  
**Project Type**: Web application with backend API  
**Performance Goals**: 
- Role lookups < 100ms (SC-005)
- Staff creation < 5 seconds (SC-002)
- Support 1000+ staff members (SC-006)

**Constraints**:
- Database-level security enforcement required (no frontend-only checks)
- Immutable audit logs (no updates/deletes)
- Soft delete only (no hard deletes with history)
- 90-day phone number cooling period

**Scale/Scope**: 
- 1000+ staff members across multiple branches
- 7 distinct roles with hierarchy
- 1-year audit log retention

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principles Compliance

| Principle | Status | Notes |
|-----------|--------|-------|
| Security by Design | ✅ PASS | RLS policies enforce security at database level |
| Testability | ✅ PASS | All requirements have measurable success criteria |
| Simplicity | ✅ PASS | No over-engineering; uses existing Supabase stack |
| Observability | ✅ PASS | Comprehensive audit logging built-in |

### Risk Assessment

| Risk | Mitigation |
|------|------------|
| Permission escalation | Role hierarchy enforced at database and application levels |
| Data loss | Soft deletes only; immutable audit trail |
| Concurrent edit conflicts | Optimistic locking with version numbers |
| Phone number reuse abuse | 90-day cooling period with database constraint |

---

## Project Structure

### Documentation (this feature)

```text
specs/001-staff-management/
├── plan.md              # This file
├── research.md          # Phase 0: Technical decisions
├── data-model.md        # Phase 1: Database schema
├── quickstart.md        # Phase 1: Setup guide
├── contracts/           # Phase 1: API contracts
│   └── openapi.json     # OpenAPI 3.0 specification
├── spec.md              # Feature specification
└── tasks.md             # Phase 2: Implementation tasks (created by /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── components/
│   └── staff/
│       ├── StaffList.tsx           # Staff list with filtering
│       ├── StaffForm.tsx           # Create/edit staff form
│       ├── StaffDetail.tsx         # Staff detail view
│       ├── BranchAssignment.tsx    # Branch assignment UI
│       └── AuditLogViewer.tsx      # Audit log display
├── hooks/
│   ├── useStaff.ts                 # Staff CRUD operations
│   ├── useStaffBranches.ts         # Branch assignment hooks
│   ├── useAuditLogs.ts             # Audit log queries
│   └── useRoleCheck.ts             # Role hierarchy checks
├── lib/
│   ├── supabase.ts                 # Supabase client
│   ├── validations/
│   │   └── staffSchema.ts          # Zod schemas
│   └── permissions.ts              # Role hierarchy logic
├── types/
│   └── staff.ts                    # TypeScript interfaces
└── utils/
    ├── phone.ts                    # Phone formatting/validation
    └── audit.ts                    # Audit log helpers

tests/
├── unit/
│   ├── permissions.test.ts         # Role hierarchy tests
│   └── validations.test.ts         # Zod schema tests
├── integration/
│   ├── staff-api.test.ts           # API integration tests
│   └── rls-policies.test.ts        # RLS policy tests
└── e2e/
    └── staff-workflow.test.ts      # End-to-end workflows
```

**Structure Decision**: Web application structure with clear separation of concerns. Components organized by feature (staff/), hooks for data fetching, lib/ for shared utilities, and comprehensive test coverage at all levels.

---

## Phase 0: Research Summary

### Technical Decisions Made

| Decision | Technology | Rationale |
|----------|-----------|-----------|
| Database Platform | Supabase PostgreSQL | Existing stack, native RLS support |
| Security Model | PostgreSQL RLS policies | Database-level enforcement per requirements |
| Audit Strategy | Triggers + application logs | 100% capture guarantee |
| Concurrency | Integer version column | Simple optimistic locking |
| Phone Validation | E.164 + partial unique index | Supports 90-day cooling period |
| Role Model | PostgreSQL ENUM + hierarchy map | Data integrity with flexibility |
| Branch Assignment | Junction table with is_primary | Many-to-many with constraints |
| Session Strategy | Short JWT + refresh validation | Lazy revocation as specified |

### Research Artifacts

See [research.md](./research.md) for detailed technical analysis including:
- RLS policy implementation patterns
- Audit logging trigger functions
- Optimistic locking SQL patterns
- Phone validation strategies
- Role hierarchy enforcement

---

## Phase 1: Design Summary

### Data Model

See [data-model.md](./data-model.md) for complete schema including:
- 4 core entities: staff, roles, staff_branches, audit_logs
- RLS policies for each table
- Indexes for performance requirements
- Triggers for audit logging and validation
- State transition diagrams

### API Contracts

See [contracts/openapi.json](./contracts/openapi.json) for complete REST API specification including:
- 8 endpoints (CRUD + branch assignment + audit logs)
- Request/response schemas with Zod validation
- Error responses (401, 403, 404, 409)
- Optimistic locking conflict handling

### Key Implementation Patterns

**Optimistic Locking**:
```typescript
// Frontend
const updateStaff = useMutation({
  mutationFn: async ({ id, data, version }) => {
    const { data: result, error } = await supabase
      .from('staff')
      .update({ ...data, version: version + 1 })
      .eq('id', id)
      .eq('version', version)
      .single();
    
    if (error?.code === 'PGRST116') {
      throw new ConflictError('Record modified by another user');
    }
    return result;
  }
});
```

**Role Hierarchy Check**:
```typescript
const ROLE_HIERARCHY = {
  'OWNER': 100, 'ADMIN': 90, 'MANAGER': 70,
  'ROASTER': 50, 'WAREHOUSE_STAFF': 50,
  'CASHIER': 40, 'AUDITOR': 20
};

function canAssignRole(assignerRole: Role, targetRole: Role): boolean {
  return ROLE_HIERARCHY[assignerRole] > ROLE_HIERARCHY[targetRole];
}
```

**RLS Policy Pattern**:
```sql
CREATE POLICY staff_admin_all ON staff
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff s
      JOIN roles r ON s.role_id = r.id
      WHERE s.user_id = auth.uid()
      AND r.name IN ('ADMIN', 'OWNER')
      AND s.is_active = true
    )
  );
```

---

## Complexity Tracking

> No constitution violations requiring justification. All complexity is justified by requirements.

| Complexity | Justification | Simpler Alternative Rejected |
|------------|---------------|------------------------------|
| RLS Policies | Security requirement for database-level enforcement | Application-level checks only: Insufficient security |
| Junction Table (staff_branches) | Many-to-many relationship needed for multi-branch support | Array column: Loses referential integrity |
| Optimistic Locking | Concurrent edit conflict resolution required | Last-write-wins: Unacceptable data loss risk |
| Audit Triggers | 100% audit capture requirement | Application logging only: Can be bypassed |
| Phone Cooling Period | Business rule to prevent abuse | Immediate reuse: Security risk |

---

## Getting Started

See [quickstart.md](./quickstart.md) for:
- Environment setup
- Database migration scripts
- Development workflow
- Common code patterns
- Troubleshooting guide

---

## Next Steps

1. **Run `/speckit.tasks`** to generate Phase 2 implementation tasks
2. **Implement database migrations** from data-model.md
3. **Set up RLS policies** in Supabase dashboard
4. **Build frontend components** following contracts/openapi.json
5. **Write integration tests** for RLS policies and API endpoints
6. **Run full test suite** with `npm test && npm run lint`

---

## Success Criteria Verification

| Criterion | How Verified |
|-----------|--------------|
| SC-001: < 3 clicks to create staff | UI/UX testing |
| SC-002: < 5 seconds creation time | Performance testing |
| SC-003: Zero unauthorized access | Security audit + penetration testing |
| SC-004: 100% audit capture | Database trigger validation |
| SC-005: < 100ms permission lookups | Load testing with 1000+ records |
| SC-006: 1000+ staff support | Scale testing |
| SC-007: Immediate permission changes | Integration testing |
| SC-008: No duplicate roles | Database constraint validation |
| SC-009: 100% data preservation on deactivation | Data integrity testing |

---

**Status**: Phase 0 and Phase 1 Complete  
**Ready for**: Phase 2 - Task Generation (`/speckit.tasks`)
