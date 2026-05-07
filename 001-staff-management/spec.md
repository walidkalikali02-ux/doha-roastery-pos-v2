# Feature Specification: Staff Management System with RBAC

**Feature Branch**: `001-staff-management`  
**Created**: 2026-02-12  
**Status**: Draft  
**Input**: User description: "Building a centralized staff management system with RBAC (Role-Based Access Control), multi-branch support, audit logging, and integration with POS and inventory systems. Enables management to control who works where, prevent unauthorized access, assign employees to branches, and track accountability."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create New Staff Member (Priority: P1)

As an Administrator, I want to create a new staff member record so that I can grant them system access with appropriate permissions for their role and branch assignment.

**Why this priority**: This is the foundational capability that enables all other staff management functions. Without the ability to create staff records, the system cannot onboard employees.

**Independent Test**: Can be fully tested by creating a staff member with name, phone, email, role, and primary branch assignment, and verifying the record exists with correct permissions.

**Acceptance Scenarios**:

1. **Given** an Administrator is logged in, **When** they enter staff details (name, phone, optional email, role, primary branch) and submit, **Then** the system creates both an authentication user and a staff record with the assigned role and branch.

2. **Given** an Administrator attempts to create a staff member with missing required fields (name, phone, role, branch), **When** they submit the form, **Then** the system displays validation errors and prevents creation.

3. **Given** an Administrator creates a staff member with a Manager role, **When** the creation is successful, **Then** the Manager can only view and manage staff within their assigned branch(es).

---

### User Story 2 - Edit Staff Role and Branch Assignment (Priority: P1)

As a Manager or Administrator, I want to modify a staff member's role or branch assignment so that I can adapt to organizational changes and ensure staff have appropriate access levels.

**Why this priority**: Staff roles and assignments change frequently in multi-branch operations. This capability ensures the access control system remains accurate and secure over time.

**Independent Test**: Can be fully tested by modifying an existing staff member's role from Cashier to Manager and changing their primary branch, then verifying the permission changes take effect immediately.

**Acceptance Scenarios**:

1. **Given** an Administrator views a staff profile, **When** they change the staff member's role from Cashier to Manager and save, **Then** the staff member immediately gains Manager-level permissions and loses Cashier-specific restrictions.

2. **Given** a Manager views a staff profile in their branch, **When** they attempt to edit the staff member's role to Administrator, **Then** the system prevents this action because Managers cannot assign higher-privilege roles.

3. **Given** an Administrator changes a staff member's primary branch, **When** the change is saved, **Then** all permission scopes update to reflect the new branch assignment immediately.

---

### User Story 3 - Deactivate Staff Member (Priority: P1)

As an Administrator, I want to deactivate a staff member so that when they leave the organization, they immediately lose system access while preserving all historical records for audit purposes.

**Why this priority**: Security-critical capability that prevents unauthorized access from former employees. Preserving historical data supports accountability and compliance requirements.

**Independent Test**: Can be fully tested by deactivating an active staff member and attempting to log in with their credentials, verifying access is denied while their historical actions remain visible in audit logs.

**Acceptance Scenarios**:

1. **Given** an Administrator deactivates an active staff member, **When** the deactivation is confirmed, **Then** the staff member immediately loses all system access and cannot log in.

2. **Given** a deactivated staff member attempts to log in, **When** they submit valid credentials, **Then** the system denies access and displays an appropriate message indicating the account is inactive.

3. **Given** an Administrator views audit logs, **When** they search for actions performed by a deactivated staff member, **Then** all historical records remain visible and intact.

---

### User Story 4 - View Staff List with Role-Based Filtering (Priority: P2)

As a Manager or Administrator, I want to view a list of all staff members relevant to my scope so that I can monitor team composition and identify access control issues.

**Why this priority**: Essential for ongoing staff management and security oversight, but can be worked around initially through individual profile lookups.

**Independent Test**: Can be fully tested by logging in as a Manager and verifying only staff from their assigned branch(es) appear in the list, while Administrators see all staff.

**Acceptance Scenarios**:

1. **Given** a Manager is assigned to Branch A, **When** they view the staff list, **Then** they see only staff members assigned to Branch A.

2. **Given** an Administrator views the staff list, **When** the list loads, **Then** they see all staff members across all branches with their roles and status.

3. **Given** any user views the staff list, **When** they apply filters by role or status, **Then** the list updates to show only matching staff members within their permission scope.

---

### User Story 5 - Audit Staff Actions (Priority: P2)

As an Administrator or Auditor, I want to view a log of all staff-related actions so that I can track who made what changes and when for accountability and compliance.

**Why this priority**: Critical for security auditing and compliance, but initial operations can function without full audit visibility as long as logging is captured.

**Independent Test**: Can be fully tested by performing staff creation, editing, and deactivation actions, then verifying all actions appear in the audit log with timestamps and actor identification.

**Acceptance Scenarios**:

1. **Given** an Administrator creates a new staff member, **When** the creation is complete, **Then** the audit log records the action with the Administrator's ID, timestamp, and details of the created record.

2. **Given** an Administrator views the audit log, **When** they filter by action type "Staff Created", **Then** they see all staff creation events with actor and timestamp information.

3. **Given** an Auditor views the audit log, **When** they access any staff-related action, **Then** they can view full details but cannot modify or delete log entries.

---

### Edge Cases

- What happens when attempting to create a staff member with a phone number that already exists in the system?
- How does the system handle a Manager attempting to edit an Administrator's record?
- What occurs when deactivating a staff member who is currently logged in and performing actions? (Access is denied on next request/token refresh using lazy revocation)
- How does the system respond when all branches are deleted but staff members still reference them?
- What happens when a staff member's primary branch is changed while they are actively working?
- How are permission conflicts resolved when a staff member has secondary branch access with conflicting role requirements?
- What happens when two Managers attempt to edit the same staff member simultaneously? (System uses optimistic locking to detect and reject conflicting updates)
- What occurs when attempting to delete (not deactivate) a staff member with historical transaction data?
- What happens when attempting to create a staff member with a phone number that was used by a deactivated staff member within the last 90 days?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow Administrators to create staff member records with name, phone number, optional email, assigned role, and primary branch.

- **FR-002**: System MUST enforce that each staff member has exactly one primary branch assignment.

- **FR-003**: System MUST support the following roles with distinct permission levels: ADMIN (full system control), OWNER (financial visibility + administrative control), MANAGER (branch-specific management), CASHIER (POS operations only), ROASTER (roasting operations), WAREHOUSE_STAFF (inventory management), and AUDITOR (read-only access).

- **FR-004**: System MUST allow Administrators to edit all staff member details including role and branch assignments.

- **FR-005**: System MUST allow Managers to edit staff member details only within their assigned branch(es) and cannot assign roles higher than their own (Role hierarchy: OWNER > ADMIN > MANAGER > CASHIER/ROASTER/WAREHOUSE_STAFF > AUDITOR).

- **FR-006**: System MUST support deactivating staff members (soft delete) which revokes access on the next authentication check (lazy revocation) while preserving all historical records.

- **FR-007**: System MUST prevent any hard deletion of staff records that have associated historical data or audit trail entries.

- **FR-008**: System MUST enforce row-level security so that users can only view and manage staff records within their permission scope (Admin/Owner: all branches, Manager: assigned branches only, Cashier/Warehouse: own record only).

- **FR-009**: System MUST log all staff-related actions (create, edit, deactivate, view) with actor ID, action type, target ID, and timestamp in an immutable audit log.

- **FR-010**: System MUST validate that phone numbers are unique across all active staff members and cannot be reused for new staff until 90 days after deactivation of the previous holder.

- **FR-011**: System MUST immediately enforce permission changes when a staff member's role or branch assignment is modified.

- **FR-012**: System MUST support assigning staff members to multiple branches (primary + secondary access) for cross-location operations.

- **FR-013**: System MUST restrict OWNER role assignment so that only users with OWNER role can assign the OWNER role to others; ADMIN cannot assign OWNER role.

- **FR-014**: System MUST retain audit logs for 1 year before archival or purging.

- **FR-015**: System MUST implement optimistic locking for staff record edits, rejecting updates if the record was modified by another user since the current user loaded it (conflict detection based on version/timestamp).

### Key Entities *(include if feature involves data)*

- **Staff**: Represents an operational employee in the system. Key attributes include identity information (name, phone, email), role assignment, primary branch, active status, and audit timestamps. Relationships: linked to authentication user, belongs to one primary branch, can have multiple branch assignments.

- **Role**: Defines permission levels and access scope. Key attributes include role name (ADMIN, MANAGER, CASHIER, etc.) and description. Roles determine what actions staff members can perform and what data they can access.

- **Branch Assignment**: Links staff members to physical branch locations. Key attributes include staff ID, branch ID, and assignment type (primary/secondary). Enables multi-branch operations while maintaining access control boundaries.

- **Audit Log**: Immutable record of all staff-related actions. Key attributes include actor ID (who performed the action), action type (create, edit, deactivate), target ID (affected staff member), timestamp, and change details. Supports compliance and accountability requirements.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Administrators can create a new staff member account in under 3 clicks from the staff management interface.

- **SC-002**: Staff member creation process completes in under 5 seconds from form submission to account activation.

- **SC-003**: Zero unauthorized access incidents occur where users access staff records outside their permission scope.

- **SC-004**: 100% of staff-related actions (create, edit, deactivate) are captured in the audit log with complete actor and timestamp information.

- **SC-005**: Role permission lookups execute in under 100 milliseconds to ensure no perceptible delay in access control enforcement.

- **SC-006**: System supports management of 1000+ staff members across multiple branches without performance degradation.

- **SC-007**: Permission changes take effect immediately (within 1 second) without requiring users to log out and back in.

- **SC-008**: No duplicate role assignments exist within the system - each staff member has a single, clearly defined role.

- **SC-009**: 100% of staff deactivation requests preserve all historical transaction and audit data associated with the staff member.

## Assumptions

- The system assumes that branch locations are already defined and managed separately from staff management.
- Phone numbers are used as the primary unique identifier for staff members, with email being optional.
- Authentication and authorization infrastructure (user login system) exists and is separate from staff record management.
- Staff members are employees of the roastery business, not customers or external vendors.
- The POS and Inventory systems already exist and will integrate with staff management via role-based permissions.
- All permission enforcement occurs at the database/policy level, not just in the user interface.
- Audit logs are append-only and cannot be modified by any user role, including Administrators.
- The system operates in a multi-tenant environment where data isolation between different roastery businesses is maintained at a higher level.

## Dependencies

- Branch Management system must be operational to assign staff to branches.
- Authentication/User Management system must be available to link staff records to login credentials.
- POS and Inventory systems require integration points to enforce role-based access control.
- Database must support row-level security policies for permission enforcement.

## Clarifications

### Session 2026-02-12

- Q: What is the hierarchy between OWNER and ADMIN roles? Who can assign whom? → A: OWNER is higher than ADMIN; only OWNER can assign OWNER role, ADMIN cannot assign OWNER role
- Q: Can a deactivated staff member's phone number be reused when creating a new staff member? → A: Yes, after 90-day cooling period to prevent immediate reuse
- Q: How long should audit logs be retained before archival or purging? → A: 1 year
- Q: Should active user sessions be terminated immediately when a staff member is deactivated? → A: Lazy revocation - access denied on next request/token refresh
- Q: How should the system handle concurrent edits to the same staff record by different users? → A: Optimistic locking - detect conflicts, reject if data changed since read

## Out of Scope

- Payroll processing and salary management
- HR documentation storage (contracts, certificates, etc.)
- Vacation and leave tracking
- Biometric attendance systems
- Shift scheduling and management
- Performance analytics and reporting
- Automated role approval workflows
- Integration with external HR or payroll systems
