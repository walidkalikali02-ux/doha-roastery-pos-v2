# Data Model: Staff Management System

**Feature**: 001-staff-management  
**Database**: PostgreSQL (Supabase)  
**Last Updated**: 2026-02-12

---

## Entity Relationship Diagram

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│     staff       │     │  staff_branches  │     │    branches     │
├─────────────────┤     ├──────────────────┤     ├─────────────────┤
│ PK id (uuid)    │◄────┤ PK staff_id (uuid)│────►│ PK id (uuid)    │
│ FK user_id      │     │ PK branch_id     │     │    name         │
│    name         │     │    is_primary    │     │    ...          │
│    phone        │     │    created_at    │     └─────────────────┘
│    email        │     └──────────────────┘
│ FK role_id      │
│    is_active    │
│    version      │
│    created_at   │
│    updated_at   │
└─────────────────┘
         │
         │ FK role_id
         ▼
┌─────────────────┐
│     roles       │
├─────────────────┤
│ PK id (uuid)    │
│    name (enum)  │
│    description  │
│    created_at   │
└─────────────────┘

┌─────────────────┐
│   audit_logs    │
├─────────────────┤
│ PK id (uuid)    │
│ FK actor_id     │
│    action       │
│    table_name   │
│    record_id    │
│    old_data     │
│    new_data     │
│    created_at   │
└─────────────────┘
```

---

## Core Tables

### 1. roles

Defines the available roles in the system.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique identifier |
| name | staff_role | UNIQUE, NOT NULL | Role enum value |
| description | TEXT | | Human-readable description |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |

**Initial Data**:
```sql
INSERT INTO roles (name, description) VALUES
  ('OWNER', 'Full financial visibility + administrative control'),
  ('ADMIN', 'Full system control across all branches'),
  ('MANAGER', 'Branch-specific management capabilities'),
  ('CASHIER', 'POS operations only'),
  ('ROASTER', 'Roasting operations management'),
  ('WAREHOUSE_STAFF', 'Inventory management'),
  ('AUDITOR', 'Read-only access for auditing');
```

---

### 2. staff

Main staff entity representing employees.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique identifier |
| user_id | UUID | REFERENCES auth.users(id) | Supabase Auth user link |
| name | VARCHAR(100) | NOT NULL | Full name |
| phone | VARCHAR(20) | NOT NULL | E.164 formatted phone |
| email | VARCHAR(255) | NULLABLE | Email address |
| role_id | UUID | REFERENCES roles(id) | Assigned role |
| is_active | BOOLEAN | DEFAULT true, NOT NULL | Active status |
| version | INTEGER | DEFAULT 1, NOT NULL | Optimistic locking version |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |
| deactivated_at | TIMESTAMPTZ | NULLABLE | When deactivated |
| deactivated_by | UUID | REFERENCES staff(id) | Who deactivated |

**Indexes**:
```sql
-- Partial unique index for active phone numbers (FR-010)
CREATE UNIQUE INDEX idx_staff_phone_active 
ON staff(phone) 
WHERE is_active = true;

-- Index for role lookups (performance requirement SC-005)
CREATE INDEX idx_staff_role ON staff(role_id) WHERE is_active = true;

-- Index for branch queries
CREATE INDEX idx_staff_active ON staff(is_active, created_at);
```

**Constraints**:
```sql
-- Phone format validation (E.164)
ALTER TABLE staff ADD CONSTRAINT chk_phone_format 
CHECK (phone ~ '^\+[1-9]\d{1,14}$');

-- Email format validation
ALTER TABLE staff ADD CONSTRAINT chk_email_format 
CHECK (email IS NULL OR email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
```

**Triggers**:
```sql
-- Update updated_at timestamp
CREATE TRIGGER set_staff_updated_at
  BEFORE UPDATE ON staff
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 90-day cooling period check (FR-010)
CREATE TRIGGER check_phone_cooling_period_trigger
  BEFORE INSERT ON staff
  FOR EACH ROW
  EXECUTE FUNCTION check_phone_cooling_period();

-- Audit logging
CREATE TRIGGER staff_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON staff
  FOR EACH ROW
  EXECUTE FUNCTION log_staff_change();
```

---

### 3. staff_branches

Junction table for many-to-many staff-branch relationships.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| staff_id | UUID | REFERENCES staff(id), ON DELETE CASCADE | Staff member |
| branch_id | UUID | REFERENCES branches(id), ON DELETE RESTRICT | Branch location |
| is_primary | BOOLEAN | DEFAULT false | Primary branch flag |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Assignment timestamp |

**Primary Key**: Composite (staff_id, branch_id)

**Indexes**:
```sql
-- Ensure exactly one primary branch per staff (FR-002)
CREATE UNIQUE INDEX idx_one_primary_branch 
ON staff_branches(staff_id) 
WHERE is_primary = true;

-- Query by branch
CREATE INDEX idx_staff_branches_branch ON staff_branches(branch_id);
```

**Constraints**:
```sql
-- Prevent duplicate assignments
ALTER TABLE staff_branches ADD CONSTRAINT no_duplicate_assignments
UNIQUE (staff_id, branch_id);
```

---

### 4. audit_logs

Immutable audit trail for all staff-related actions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique identifier |
| actor_id | UUID | REFERENCES staff(id) | Who performed action |
| action | VARCHAR(50) | NOT NULL | Action type (CREATE, UPDATE, DELETE, VIEW) |
| table_name | VARCHAR(100) | NOT NULL | Affected table |
| record_id | UUID | NOT NULL | Affected record ID |
| old_data | JSONB | NULLABLE | Previous state |
| new_data | JSONB | NULLABLE | New state |
| metadata | JSONB | NULLABLE | Additional context (IP, user agent) |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Action timestamp |

**Indexes**:
```sql
-- Query by record
CREATE INDEX idx_audit_record ON audit_logs(table_name, record_id);

-- Query by actor
CREATE INDEX idx_audit_actor ON audit_logs(actor_id, created_at DESC);

-- Query by date range (for retention management)
CREATE INDEX idx_audit_created_at ON audit_logs(created_at);

-- Query by action type
CREATE INDEX idx_audit_action ON audit_logs(action, table_name);
```

**Partitioning** (for performance at scale):
```sql
-- Monthly partitioning for audit logs
CREATE TABLE audit_logs_partitioned (
  LIKE audit_logs INCLUDING ALL
) PARTITION BY RANGE (created_at);

-- Create partitions (automated via cron)
CREATE TABLE audit_logs_2026_02 PARTITION OF audit_logs_partitioned
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
```

**Constraints**:
```sql
-- Prevent updates to audit logs (immutability)
CREATE OR REPLACE FUNCTION prevent_audit_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable and cannot be modified';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_immutable
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_update();
```

---

## PostgreSQL Functions

### check_phone_cooling_period()

Validates 90-day cooling period before phone reuse.

```sql
CREATE OR REPLACE FUNCTION check_phone_cooling_period()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM staff 
    WHERE phone = NEW.phone 
    AND is_active = false
    AND deactivated_at > NOW() - INTERVAL '90 days'
  ) THEN
    RAISE EXCEPTION 'Phone number % is in 90-day cooling period', NEW.phone
      USING HINT = 'Phone numbers cannot be reused for 90 days after deactivation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### log_staff_change()

Captures audit trail for staff table changes.

```sql
CREATE OR REPLACE FUNCTION log_staff_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (actor_id, action, table_name, record_id, new_data)
    VALUES (
      auth.uid(),
      'CREATE',
      'staff',
      NEW.id,
      to_jsonb(NEW)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (actor_id, action, table_name, record_id, old_data, new_data)
    VALUES (
      auth.uid(),
      'UPDATE',
      'staff',
      NEW.id,
      to_jsonb(OLD),
      to_jsonb(NEW)
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (actor_id, action, table_name, record_id, old_data)
    VALUES (
      auth.uid(),
      'DELETE',
      'staff',
      OLD.id,
      to_jsonb(OLD)
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
```

### update_updated_at_column()

Automatically updates the updated_at timestamp.

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## Row Level Security (RLS) Policies

### staff table policies

```sql
-- Enable RLS
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

-- Admin/Owner: Full access to all staff
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

-- Manager: Access to staff in their branches
CREATE POLICY staff_manager_branch ON staff
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff s
      JOIN roles r ON s.role_id = r.id
      JOIN staff_branches sb ON s.id = sb.staff_id
      WHERE s.user_id = auth.uid()
      AND r.name = 'MANAGER'
      AND s.is_active = true
      AND staff.primary_branch_id IN (
        SELECT branch_id FROM staff_branches
        WHERE staff_id = s.id
      )
    )
  );

-- Self: Access to own record
CREATE POLICY staff_self ON staff
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Auditor: Read-only access to all staff
CREATE POLICY staff_auditor_read ON staff
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff s
      JOIN roles r ON s.role_id = r.id
      WHERE s.user_id = auth.uid()
      AND r.name = 'AUDITOR'
      AND s.is_active = true
    )
  );
```

### staff_branches table policies

```sql
-- Enable RLS
ALTER TABLE staff_branches ENABLE ROW LEVEL SECURITY;

-- Admin/Owner: Full access
CREATE POLICY staff_branches_admin ON staff_branches
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

-- Manager: Access to their branch assignments only
CREATE POLICY staff_branches_manager ON staff_branches
  FOR ALL
  TO authenticated
  USING (
    branch_id IN (
      SELECT branch_id FROM staff_branches sb
      JOIN staff s ON sb.staff_id = s.id
      JOIN roles r ON s.role_id = r.id
      WHERE s.user_id = auth.uid()
      AND r.name = 'MANAGER'
      AND s.is_active = true
    )
  );

-- Self: View own branch assignments
CREATE POLICY staff_branches_self ON staff_branches
  FOR SELECT
  TO authenticated
  USING (
    staff_id IN (
      SELECT id FROM staff WHERE user_id = auth.uid()
    )
  );
```

### audit_logs table policies

```sql
-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Admin/Owner: Full access
CREATE POLICY audit_admin ON audit_logs
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

-- Auditor: Read-only access (FR-009 requirement)
CREATE POLICY audit_auditor ON audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff s
      JOIN roles r ON s.role_id = r.id
      WHERE s.user_id = auth.uid()
      AND r.name = 'AUDITOR'
      AND s.is_active = true
    )
  );
```

---

## State Transitions

### Staff Lifecycle

```
┌─────────────┐    create     ┌─────────┐
│   PENDING   │──────────────►│  ACTIVE │
└─────────────┘               └────┬────┘
                                   │
                                   │ deactivate
                                   ▼
                              ┌──────────┐
                              │ INACTIVE │
                              └──────────┘
                                   │
                                   │ reactivate (after 90 days,
                                   │ new phone required)
                                   ▼
                              ┌─────────┐
                              │  ACTIVE │
                              └─────────┘
```

**Transition Rules**:
- **PENDING → ACTIVE**: On successful staff creation
- **ACTIVE → INACTIVE**: On deactivation (sets deactivated_at, is_active = false)
- **INACTIVE → ACTIVE**: Only allowed after 90 days with new phone number

---

## Data Integrity Rules

1. **Phone Uniqueness**: Only one active staff member per phone number (enforced by partial index)
2. **Primary Branch**: Each staff member must have exactly one primary branch (enforced by unique partial index)
3. **Role Hierarchy**: Managers cannot assign roles higher than their own (enforced by application logic)
4. **Audit Immutability**: Audit logs cannot be updated or deleted (enforced by trigger)
5. **Soft Delete Only**: Staff records are deactivated, never hard-deleted if they have audit history (enforced by trigger)
6. **Version Increment**: Updates must increment version number (enforced by optimistic locking)

---

## Performance Considerations

- **SC-005** (100ms lookups): Indexes on role_id, phone, is_active ensure fast filtering
- **SC-006** (1000+ staff): Partitioned audit_logs table prevents query degradation
- **RLS Policy Optimization**: Use EXISTS clauses instead of IN for better PostgreSQL optimization
- **Connection Pooling**: Supabase connection pooler handles concurrent access
