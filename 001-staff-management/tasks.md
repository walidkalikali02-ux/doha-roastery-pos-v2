# Tasks: Staff Management System with RBAC

**Feature**: 001-staff-management  
**Branch**: `001-staff-management`  
**Created**: 2026-02-12  
**Status**: Ready for Implementation

---

## Phase 1: Setup - Project Initialization

**Goal**: Establish project foundation, install dependencies, and configure development environment

**Independent Test**: Run `npm test` and `npm run lint` successfully with no errors

### Tasks

- [ ] T001 Install required dependencies: @supabase/supabase-js, zod, libphonenumber-js, @tanstack/react-query, zustand, react-hook-form in package.json
- [ ] T002 [P] Install dev dependencies: @types/libphonenumber-js, @tanstack/eslint-plugin-query in package.json
- [ ] T003 Create Supabase client configuration file at src/lib/supabase.ts with environment variable validation
- [ ] T004 Create project directory structure: src/components/staff/, src/hooks/, src/lib/validations/, src/types/, src/utils/, tests/unit/, tests/integration/, tests/e2e/
- [ ] T005 [P] Create TypeScript type definitions for Staff, Role, BranchAssignment, AuditLog in src/types/staff.ts
- [ ] T006 [P] Create Zod validation schemas for CreateStaffRequest, UpdateStaffRequest in src/lib/validations/staffSchema.ts
- [ ] T007 [P] Create phone number utility functions (format, validate E.164) in src/utils/phone.ts
- [ ] T008 Create permission utility with ROLE_HIERARCHY and canAssignRole() function in src/lib/permissions.ts
- [ ] T009 Setup environment variable types and validation for Supabase credentials
- [ ] T010 Create database migration file for roles table with initial seed data

---

## Phase 2: Foundational - Database Schema & RLS

**Goal**: Create core database tables, triggers, functions, and RLS policies required by all user stories

**Independent Test**: Execute all SQL migrations successfully; verify tables exist with correct constraints

**Blocking**: Must complete before any user story implementation

### Tasks

- [ ] T011 Create database migration for staff table with all columns, indexes, and constraints in supabase/migrations/001_staff_table.sql
- [ ] T012 Create database migration for staff_branches junction table with primary branch constraint in supabase/migrations/002_staff_branches.sql
- [ ] T013 Create database migration for audit_logs table with immutability trigger in supabase/migrations/003_audit_logs.sql
- [ ] T014 Create PostgreSQL function update_updated_at_column() in supabase/migrations/004_functions.sql
- [ ] T015 Create PostgreSQL function check_phone_cooling_period() in supabase/migrations/004_functions.sql
- [ ] T016 Create PostgreSQL function log_staff_change() in supabase/migrations/004_functions.sql
- [ ] T017 Create PostgreSQL function prevent_audit_update() in supabase/migrations/004_functions.sql
- [ ] T018 Enable RLS on staff table and create admin/owner policy in supabase/migrations/005_rls_policies.sql
- [ ] T019 Create RLS policy for Manager branch-scoped access on staff table in supabase/migrations/005_rls_policies.sql
- [ ] T020 Create RLS policy for self-access and auditor read-only on staff table in supabase/migrations/005_rls_policies.sql
- [ ] T021 [P] Create RLS policies for staff_branches table (admin, manager, self) in supabase/migrations/006_rls_staff_branches.sql
- [ ] T022 [P] Create RLS policies for audit_logs table (admin/auditor) in supabase/migrations/007_rls_audit_logs.sql
- [ ] T023 Create audit utility helper functions in src/utils/audit.ts

---

## Phase 3: User Story 1 - Create New Staff Member (P1)

**Story**: As an Administrator, I want to create a new staff member record so that I can grant them system access with appropriate permissions for their role and branch assignment.

**Why this priority**: Foundational capability that enables all other staff management functions. Without staff creation, the system cannot onboard employees.

**Independent Test**: Can create a staff member via API/UI with name, phone, email, role, and primary branch; verify record exists with correct permissions.

**Acceptance Scenarios**:
1. Given an Administrator is logged in, When they enter staff details and submit, Then the system creates both an authentication user and a staff record with the assigned role and branch.
2. Given an Administrator attempts to create a staff member with missing required fields, When they submit the form, Then the system displays validation errors and prevents creation.
3. Given an Administrator creates a staff member with a Manager role, When the creation is successful, Then the Manager can only view and manage staff within their assigned branch(es).

### Tasks

- [ ] T024 [US1] [P] Create useStaff hook with createStaff mutation in src/hooks/useStaff.ts
- [ ] T025 [US1] Create StaffForm component with validation for name, phone, email, role, branch in src/components/staff/StaffForm.tsx
- [ ] T026 [US1] [P] Create role selection dropdown component with role hierarchy awareness in src/components/staff/RoleSelect.tsx
- [ ] T027 [US1] [P] Create branch selection component integrated with Branch Management system in src/components/staff/BranchSelect.tsx
- [ ] T028 [US1] Implement phone input with E.164 validation and formatting in src/components/staff/PhoneInput.tsx
- [ ] T029 [US1] Create StaffCreatePage container component with form submission handling in src/components/staff/StaffCreatePage.tsx
- [ ] T030 [US1] Add optimistic UI updates for staff creation in useStaff hook
- [ ] T031 [US1] [P] Create unit tests for staff creation validation logic in tests/unit/validations.test.ts
- [ ] T032 [US1] Create integration test for staff creation API endpoint in tests/integration/staff-api.test.ts
- [ ] T033 [US1] [P] Add error handling for duplicate phone numbers with user-friendly messages

---

## Phase 4: User Story 2 - Edit Staff Role and Branch Assignment (P1)

**Story**: As a Manager or Administrator, I want to modify a staff member's role or branch assignment so that I can adapt to organizational changes and ensure staff have appropriate access levels.

**Why this priority**: Staff roles and assignments change frequently in multi-branch operations. Ensures access control system remains accurate and secure.

**Independent Test**: Can modify an existing staff member's role from Cashier to Manager and change primary branch; verify permission changes take effect immediately.

**Acceptance Scenarios**:
1. Given an Administrator views a staff profile, When they change the staff member's role from Cashier to Manager and save, Then the staff member immediately gains Manager-level permissions and loses Cashier-specific restrictions.
2. Given a Manager views a staff profile in their branch, When they attempt to edit the staff member's role to Administrator, Then the system prevents this action because Managers cannot assign higher-privilege roles.
3. Given an Administrator changes a staff member's primary branch, When the change is saved, Then all permission scopes update to reflect the new branch assignment immediately.

### Tasks

- [ ] T034 [US2] Add updateStaff mutation to useStaff hook with optimistic locking in src/hooks/useStaff.ts
- [ ] T035 [US2] Create StaffEditForm component pre-populated with existing staff data in src/components/staff/StaffEditForm.tsx
- [ ] T036 [US2] [P] Create StaffDetail component for viewing and editing staff profile in src/components/staff/StaffDetail.tsx
- [ ] T037 [US2] Implement role assignment validation using canAssignRole() to enforce hierarchy in StaffEditForm
- [ ] T038 [US2] [P] Create BranchAssignment component for managing primary/secondary branch assignments in src/components/staff/BranchAssignment.tsx
- [ ] T039 [US2] Implement optimistic locking conflict detection and retry logic in updateStaff mutation
- [ ] T040 [US2] [P] Create useStaffBranches hook for managing branch assignments in src/hooks/useStaffBranches.ts
- [ ] T041 [US2] Add UI for handling optimistic locking conflicts (show error, allow refresh) in StaffEditForm
- [ ] T042 [US2] Create integration test for role hierarchy enforcement in tests/integration/permissions.test.ts
- [ ] T043 [US2] [P] Create unit tests for optimistic locking logic in tests/unit/permissions.test.ts

---

## Phase 5: User Story 3 - Deactivate Staff Member (P1)

**Story**: As an Administrator, I want to deactivate a staff member so that when they leave the organization, they immediately lose system access while preserving all historical records for audit purposes.

**Why this priority**: Security-critical capability that prevents unauthorized access from former employees. Preserving historical data supports accountability and compliance.

**Independent Test**: Can deactivate an active staff member; verify access is denied on next authentication while historical actions remain visible in audit logs.

**Acceptance Scenarios**:
1. Given an Administrator deactivates an active staff member, When the deactivation is confirmed, Then the staff member immediately loses all system access and cannot log in.
2. Given a deactivated staff member attempts to log in, When they submit valid credentials, Then the system denies access and displays an appropriate message indicating the account is inactive.
3. Given an Administrator views audit logs, When they search for actions performed by a deactivated staff member, Then all historical records remain visible and intact.

### Tasks

- [ ] T044 [US3] Add deactivateStaff mutation to useStaff hook in src/hooks/useStaff.ts
- [ ] T045 [US3] Create deactivate confirmation dialog with warning about 90-day phone cooling period in src/components/staff/DeactivateDialog.tsx
- [ ] T046 [US3] [P] Add deactivate button to StaffDetail component with permission check
- [ ] T047 [US3] Implement soft delete (set is_active=false, deactivated_at=NOW()) in deactivateStaff mutation
- [ ] T048 [US3] [P] Create integration test for deactivation and access revocation in tests/integration/staff-api.test.ts
- [ ] T049 [US3] Create test verifying audit log entries remain after deactivation in tests/integration/audit.test.ts
- [ ] T050 [US3] Add visual indicator for deactivated staff in staff list (grayed out, badge)
- [ ] T051 [US3] [P] Create deactivated staff filter in staff list view

---

## Phase 6: User Story 4 - View Staff List with Role-Based Filtering (P2)

**Story**: As a Manager or Administrator, I want to view a list of all staff members relevant to my scope so that I can monitor team composition and identify access control issues.

**Why this priority**: Essential for ongoing staff management and security oversight. Can be worked around initially through individual profile lookups (lower priority than P1 stories).

**Independent Test**: Can view staff list as Manager showing only assigned branch(es); as Administrator showing all staff; can filter by role and status.

**Acceptance Scenarios**:
1. Given a Manager is assigned to Branch A, When they view the staff list, Then they see only staff members assigned to Branch A.
2. Given an Administrator views the staff list, When the list loads, Then they see all staff members across all branches with their roles and status.
3. Given any user views the staff list, When they apply filters by role or status, Then the list updates to show only matching staff members within their permission scope.

### Tasks

- [ ] T052 [US4] Create useStaffList hook with filtering and pagination in src/hooks/useStaff.ts
- [ ] T053 [US4] [P] Create StaffList component with table/grid view in src/components/staff/StaffList.tsx
- [ ] T054 [US4] Create StaffListFilters component for role, status, branch filtering in src/components/staff/StaffListFilters.tsx
- [ ] T055 [US4] [P] Implement role-based filtering showing only accessible staff based on RLS policies
- [ ] T056 [US4] Add pagination controls to StaffList component
- [ ] T057 [US4] [P] Create StaffListPage container component with query parameters in src/components/staff/StaffListPage.tsx
- [ ] T058 [US4] Add sorting functionality (name, role, created_at) to StaffList
- [ ] T059 [US4] [P] Create loading and empty states for StaffList
- [ ] T060 [US4] Create integration test for role-based filtering in tests/integration/rls-policies.test.ts
- [ ] T061 [US4] Add search functionality by name or phone in StaffListFilters

---

## Phase 7: User Story 5 - Audit Staff Actions (P2)

**Story**: As an Administrator or Auditor, I want to view a log of all staff-related actions so that I can track who made what changes and when for accountability and compliance.

**Why this priority**: Critical for security auditing and compliance. Initial operations can function without full audit visibility as long as logging is captured.

**Independent Test**: Can view audit logs showing staff creation, editing, deactivation with timestamps and actor identification; can filter by action type, date range, actor.

**Acceptance Scenarios**:
1. Given an Administrator creates a new staff member, When the creation is complete, Then the audit log records the action with the Administrator's ID, timestamp, and details of the created record.
2. Given an Administrator views the audit log, When they filter by action type "Staff Created", Then they see all staff creation events with actor and timestamp information.
3. Given an Auditor views the audit log, When they access any staff-related action, Then they can view full details but cannot modify or delete log entries.

### Tasks

- [ ] T062 [US5] Create useAuditLogs hook with filtering in src/hooks/useAuditLogs.ts
- [ ] T063 [US5] [P] Create AuditLogViewer component with table view in src/components/staff/AuditLogViewer.tsx
- [ ] T064 [US5] Create AuditLogFilters component for action type, date range, actor filtering in src/components/staff/AuditLogFilters.tsx
- [ ] T065 [US5] [P] Implement audit log entry display with before/after diff view
- [ ] T066 [US5] Add pagination and date range filtering to AuditLogViewer
- [ ] T067 [US5] [P] Create AuditLogPage container component in src/components/staff/AuditLogPage.tsx
- [ ] T068 [US5] Add export functionality for audit logs (CSV/JSON)
- [ ] T069 [US5] [P] Create integration test for audit log capture in tests/integration/audit.test.ts
- [ ] T070 [US5] Verify Auditor role has read-only access to audit logs in tests/integration/rls-policies.test.ts

---

## Phase 8: Polish & Cross-Cutting Concerns

**Goal**: Error handling, edge cases, performance optimization, documentation

**Independent Test**: All edge cases from spec handled; performance meets success criteria; documentation complete

### Tasks

- [ ] T071 [P] Add comprehensive error boundaries for staff management components
- [ ] T072 [P] Create error message mapping for database constraint violations (phone unique, cooling period)
- [ ] T073 Implement retry logic with exponential backoff for failed API calls in hooks
- [ ] T074 [P] Add loading skeletons for all data-dependent components
- [ ] T075 Create Storybook stories for all staff components
- [ ] T076 [P] Add accessibility attributes (ARIA labels, keyboard navigation) to all forms
- [ ] T077 Implement client-side caching strategy with TanStack Query for staff data
- [ ] T078 [P] Add React Query devtools configuration for development
- [ ] T079 Create end-to-end test for complete staff workflow in tests/e2e/staff-workflow.test.ts
- [ ] T080 [P] Add performance monitoring for role permission lookups (target: <100ms)
- [ ] T081 Document API endpoints with examples in docs/api.md
- [ ] T082 [P] Create troubleshooting guide for common issues (duplicate phone, conflicts)
- [ ] T083 Verify all success criteria (SC-001 through SC-009) are met

---

## Dependency Graph

```
Phase 1: Setup
├── T001-T010 (Dependencies, Types, Utils)
│
Phase 2: Foundational
├── T011-T023 (Database Schema, RLS)
│   └── Depends on: Phase 1
│
Phase 3: US1 - Create Staff
├── T024-T033 (Create functionality)
│   └── Depends on: Phase 2
│
Phase 4: US2 - Edit Staff
├── T034-T043 (Edit, Optimistic Locking)
│   ├── Depends on: Phase 2
│   └── Depends on: US1 (needs staff to edit)
│
Phase 5: US3 - Deactivate Staff
├── T044-T051 (Deactivation)
│   ├── Depends on: Phase 2
│   └── Depends on: US1 (needs staff to deactivate)
│
Phase 6: US4 - View Staff List
├── T052-T061 (List, Filtering)
│   ├── Depends on: Phase 2
│   └── Parallel with: US1, US2, US3
│
Phase 7: US5 - Audit Logs
├── T062-T070 (Audit viewer)
│   ├── Depends on: Phase 2
│   └── Depends on: US1, US2, US3 (needs actions to log)
│
Phase 8: Polish
└── T071-T083 (Error handling, Docs)
    └── Depends on: All previous phases
```

---

## Parallel Execution Opportunities

### Within Phase 1 (Setup)
- T002, T005, T006, T007 can be done in parallel after T001
- T008, T009, T010 can be done in parallel after T003, T004

### Within Phase 2 (Foundational)
- T011, T012, T013 can be done in parallel (different tables)
- T014-T017 (functions) can be done in parallel
- T021, T022 (RLS policies) can be done in parallel after T018-T020

### User Story Parallelization
**US1, US4 can be developed in parallel** once Phase 2 is complete:
- US4 (View List) only needs database schema, not create/edit functionality
- Both can be worked on simultaneously by different developers

**US2, US3 can be developed in parallel** once US1 is complete:
- US2 (Edit) and US3 (Deactivate) are independent
- Both require existing staff records (from US1)

**US5 should come after US1-US3** because it needs audit data from those actions.

---

## Implementation Strategy

### MVP Scope (Recommended First Deliverable)
**Complete US1 (Create Staff) only**:
- Setup Phase (T001-T010)
- Foundational Phase (T011-T023)
- US1 Phase (T024-T033)
- Minimal Polish (T071, T074, T076)

**Why**: US1 is the foundational capability. With just staff creation, the business can start onboarding employees. List view can be worked around by direct record access.

### Incremental Delivery

**Sprint 1**: Setup + Foundational + US1
- Focus: Get staff creation working end-to-end
- Deliverable: Can create staff members via UI

**Sprint 2**: US2 + US3
- Focus: Staff lifecycle management
- Deliverable: Can edit and deactivate staff

**Sprint 3**: US4 + US5
- Focus: Operational visibility
- Deliverable: Can view staff list and audit logs

**Sprint 4**: Polish
- Focus: Performance, edge cases, documentation
- Deliverable: Production-ready feature

---

## Task Statistics

| Category | Count | Parallel Tasks |
|----------|-------|----------------|
| Phase 1: Setup | 10 | 6 |
| Phase 2: Foundational | 13 | 7 |
| Phase 3: US1 (Create) | 10 | 5 |
| Phase 4: US2 (Edit) | 10 | 5 |
| Phase 5: US3 (Deactivate) | 8 | 3 |
| Phase 6: US4 (List) | 10 | 6 |
| Phase 7: US5 (Audit) | 9 | 5 |
| Phase 8: Polish | 13 | 8 |
| **Total** | **83** | **40** |

---

## Independent Test Criteria by Story

| Story | Test Criteria | How to Verify |
|-------|--------------|---------------|
| US1 | Can create staff with all required fields | Create staff via UI/API, verify in database |
| US1 | Validation prevents missing fields | Submit incomplete form, verify error messages |
| US1 | Role assignment works correctly | Create Manager, verify permissions |
| US2 | Can edit staff role and branch | Change role, verify in database |
| US2 | Role hierarchy enforced | Manager tries to assign ADMIN, verify rejection |
| US2 | Optimistic locking works | Two simultaneous edits, verify conflict detected |
| US3 | Can deactivate staff | Deactivate, verify is_active=false |
| US3 | Access revoked on next auth | Try login after deactivation, verify rejection |
| US3 | Audit history preserved | Check audit logs for deactivated staff |
| US4 | List shows only accessible staff | Manager sees only their branch staff |
| US4 | Filtering works correctly | Filter by role/status, verify results |
| US5 | Actions appear in audit log | Create/edit staff, verify audit entries |
| US5 | Filtering by action type works | Filter audit by "CREATE", verify results |
| US5 | Auditor has read-only access | Auditor tries to edit, verify rejection |

---

## Next Steps

1. **Start with Phase 1**: Run `npm install` and setup project structure
2. **Create a feature branch**: `git checkout -b 001-staff-management`
3. **Begin with T001-T010**: Setup dependencies and types
4. **Proceed to database migrations**: T011-T023
5. **Focus on US1 first**: T024-T033 (MVP scope)
6. **Run tests frequently**: `npm test && npm run lint`

**Recommended**: Begin implementation with T001 (install dependencies) and work through Phase 1 and Phase 2 before starting user story implementation.
