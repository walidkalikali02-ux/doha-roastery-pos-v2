# Feature Specification: Cashier POS-Only Access

**Feature Branch**: `003-cashier-role-restriction`
**Created**: 2026-03-30
**Status**: Draft
**Input**: User description: "i want create account cashier ONLY ACCESS TO POS"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create Cashier Account (Priority: P1)

As an Administrator, I want to create a cashier account so that the employee can log in and process sales transactions while being restricted from other system features.

**Why this priority**: This is the foundational capability - without account creation, cashiers cannot access the system at all.

**Independent Test**: Can be fully tested by creating a new cashier account with basic credentials and verifying the user can log in and access the POS view.

**Acceptance Scenarios**:

1. **Given** an Administrator is logged in, **When** they create a new cashier account with name, phone/email, and temporary password, **Then** the system creates the account with CASHIER role and appropriate restrictions.
2. **Given** a cashier account is created, **When** the new cashier logs in, **Then** they see only POS-related navigation and functionality.
3. **Given** a cashier account exists, **When** the cashier attempts to access non-POS features (inventory, reports, roasting), **Then** access is denied.

---

### User Story 2 - Cashier POS Access Control (Priority: P1)

As a Cashier, I want to access only the POS functionality so that I can process sales without being exposed to sensitive business data I don't need.

**Why this priority**: Core security requirement - ensures proper access boundaries from day one.

**Independent Test**: Can be fully tested by logging in as a cashier and verifying only POS views/operations are accessible.

**Acceptance Scenarios**:

1. **Given** a Cashier is logged in, **When** they view the navigation menu, **Then** only POS and related cash-management options are visible.
2. **Given** a Cashier attempts to navigate to a restricted area via URL, **When** they enter the URL directly, **Then** the system redirects them to POS and shows a toast notification "Access restricted".
3. **Given** a Cashier is processing a sale, **When** they complete the transaction, **Then** the system records the sale with their cashier ID and they cannot modify historical transactions.

---

### User Story 3 - Cashier Shift Management (Priority: P2)

As a Cashier, I want to manage my shift (open/close) so that cash drawer accountability is maintained.

**Why this priority**: Essential for cash handling accountability but can initially operate with manager oversight.

**Independent Test**: Can be fully tested by having a cashier open and close a shift, verifying cash reconciliation.

**Acceptance Scenarios**:

1. **Given** a Cashier starts their shift, **When** they open a new shift with initial cash, **Then** the system records the shift start time and initial cash amount.
2. **Given** a Cashier ends their shift, **When** they close the shift with actual cash count, **Then** the system calculates and records any discrepancy.

---

### Edge Cases

- What happens when a cashier's role is changed from CASHIER to MANAGER while they are logged in? (Session should refresh permissions on next action)
- How does the system handle a cashier trying to access reports via direct URL? (Redirect to POS with toast notification)
- What occurs when a cashier tries to approve a refund request? (Action denied, requires MANAGER role)
- What happens when a cashier attempts to void a completed transaction? (Requires MANAGER approval)
- How are cashier permissions enforced when the system is offline? (Local validation, sync on reconnect)
- What happens when an admin creates a cashier with an email that already exists? (Validation error, duplicate check)
- What occurs if a cashier's assigned branch is deactivated? (Prompt reassignment before proceeding)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow Administrators to create cashier accounts with name, phone/email, and temporary credentials.

- **FR-002**: System MUST restrict CASHIER role users to only POS-related functionality.

- **FR-003**: System MUST hide non-POS navigation items from cashiers in the UI.

- **FR-004**: System MUST enforce role-based access control at the route/component level for all non-POS views.

- **FR-005**: System MUST prevent cashiers from viewing or modifying inventory, roasting, staff, or sensitive financial reports, but MUST allow cashiers to view their own daily sales and personal shift statistics.

- **FR-006**: System MUST allow cashiers to process sales and initiate return requests, but return completion MUST require MANAGER approval before refund is issued.

- **FR-007**: System MUST log all cashier actions for audit purposes.

- **FR-008**: System MUST enforce database-level row security for cashier data access.

- **FR-009**: System MUST assign each cashier to exactly one branch/location, and cashiers can only process sales and manage shifts at their assigned location.

- **FR-010**: System MUST allow cashiers to void/remove individual items from an active transaction, but MUST require MANAGER approval to void or cancel entire completed transactions.

### Key Entities

- **Cashier Account**: A user account with CASHIER role. Key attributes include login credentials (email/phone + password), assigned branch/location, shift assignments, and activation status.

- **Cashier Session**: Active login session for a cashier. Key attributes include login timestamp, session expiry, and current shift status.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Cashier account creation completes in under 10 seconds from form submission.

- **SC-002**: Zero successful accesses to restricted areas by CASHIER role users during security testing.

- **SC-003**: 100% of cashier navigation attempts to restricted URLs result in redirect or access-denied.

- **SC-004**: Cashiers can complete standard sales transactions without accessing any non-POS feature.

## Assumptions

- The system already has role-based access control infrastructure from the staff management feature (001-staff-management).
- CASHIER role already exists in the system with basic permissions defined.
- Authentication and authorization are handled by Supabase Auth and Row Level Security policies.
- Administrators have the ability to create and manage user accounts.

## Dependencies

- Staff Management System (001-staff-management) for user creation and role assignment.
- Authentication system for login/logout functionality.
- POS system for sales processing capability.

## Clarifications

### Session 2026-03-30

- Q: Should cashiers be able to VIEW reports or ONLY access POS? → A: POS + limited reports - Cashiers can view some reports (daily sales, personal stats) but not financial/inventory
- Q: Can cashiers process returns/refunds, or do they need MANAGER approval? → A: Initiate + approval required - Cashiers can start return, MANAGER must approve before completion
- Q: What should cashiers see when attempting to access restricted URLs? → A: Redirect + toast - Redirect to POS view and show a brief "Access restricted" toast notification
- Q: Should cashiers be assigned to specific branches/locations? → A: Single branch assigned - Each cashier is assigned to one specific branch location
- Q: Can cashiers void items or cancel transactions? → A: Void items, approval for full transaction - Cashiers can remove items mid-transaction, but voiding/canceling entire completed transactions requires MANAGER approval

## Out of Scope

- Payroll processing for cashiers (handled by HR system)
- Biometric authentication
- Advanced reporting access for cashiers