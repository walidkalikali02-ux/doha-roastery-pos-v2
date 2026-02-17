# Quickstart Guide: Staff Management System

**Feature**: 001-staff-management  
**Last Updated**: 2026-02-12

---

## Prerequisites

- Node.js 18+ with npm
- Supabase CLI installed
- Access to Supabase project
- Branch Management system operational (dependency)

## Environment Setup

### 1. Configure Environment Variables

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 2. Install Dependencies

```bash
npm install @supabase/supabase-js zod libphonenumber-js
npm install -D @types/libphonenumber-js
```

### 3. Database Migrations

Run the following SQL in Supabase SQL Editor or via migrations:

```sql
-- 1. Create ENUM for roles
CREATE TYPE staff_role AS ENUM (
  'OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 
  'ROASTER', 'WAREHOUSE_STAFF', 'AUDITOR'
);

-- 2. Create roles table and seed data
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name staff_role UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO roles (name, description) VALUES
  ('OWNER', 'Full financial visibility + administrative control'),
  ('ADMIN', 'Full system control across all branches'),
  ('MANAGER', 'Branch-specific management capabilities'),
  ('CASHIER', 'POS operations only'),
  ('ROASTER', 'Roasting operations management'),
  ('WAREHOUSE_STAFF', 'Inventory management'),
  ('AUDITOR', 'Read-only access for auditing')
ON CONFLICT (name) DO NOTHING;

-- 3. Create staff table
CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  role_id UUID REFERENCES roles(id),
  is_active BOOLEAN DEFAULT true NOT NULL,
  version INTEGER DEFAULT 1 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deactivated_at TIMESTAMPTZ,
  deactivated_by UUID REFERENCES staff(id),
  CONSTRAINT chk_phone_format CHECK (phone ~ '^\+[1-9]\d{1,14}$'),
  CONSTRAINT chk_email_format CHECK (email IS NULL OR email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- 4. Create staff_branches junction table
CREATE TABLE IF NOT EXISTS staff_branches (
  staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE RESTRICT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (staff_id, branch_id)
);

-- 5. Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES staff(id),
  action VARCHAR(50) NOT NULL,
  table_name VARCHAR(100) NOT NULL,
  record_id UUID NOT NULL,
  old_data JSONB,
  new_data JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Create indexes
CREATE UNIQUE INDEX idx_staff_phone_active ON staff(phone) WHERE is_active = true;
CREATE INDEX idx_staff_role ON staff(role_id) WHERE is_active = true;
CREATE INDEX idx_staff_active ON staff(is_active, created_at);
CREATE UNIQUE INDEX idx_one_primary_branch ON staff_branches(staff_id) WHERE is_primary = true;
CREATE INDEX idx_staff_branches_branch ON staff_branches(branch_id);
CREATE INDEX idx_audit_record ON audit_logs(table_name, record_id);
CREATE INDEX idx_audit_actor ON audit_logs(actor_id, created_at DESC);
CREATE INDEX idx_audit_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_action ON audit_logs(action, table_name);
```

### 4. Enable RLS and Create Policies

```sql
-- Enable RLS
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

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

-- Auditor: Read-only access
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

-- Audit logs policies
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

### 5. Create Functions and Triggers

```sql
-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Phone cooling period check
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

-- Audit logging function
CREATE OR REPLACE FUNCTION log_staff_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (actor_id, action, table_name, record_id, new_data)
    VALUES (auth.uid(), 'CREATE', 'staff', NEW.id, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (actor_id, action, table_name, record_id, old_data, new_data)
    VALUES (auth.uid(), 'UPDATE', 'staff', NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (actor_id, action, table_name, record_id, old_data)
    VALUES (auth.uid(), 'DELETE', 'staff', OLD.id, to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER set_staff_updated_at
  BEFORE UPDATE ON staff
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER check_phone_cooling_period_trigger
  BEFORE INSERT ON staff
  FOR EACH ROW
  EXECUTE FUNCTION check_phone_cooling_period();

CREATE TRIGGER staff_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON staff
  FOR EACH ROW
  EXECUTE FUNCTION log_staff_change();
```

---

## Development Workflow

### 1. Start Development Server

```bash
npm run dev
```

### 2. Run Tests

```bash
npm test
```

### 3. Run Linter

```bash
npm run lint
```

---

## Common Tasks

### Create a New Staff Member

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function createStaff(data: CreateStaffRequest) {
  const { data: staff, error } = await supabase
    .from('staff')
    .insert({
      name: data.name,
      phone: data.phone,
      email: data.email,
      role_id: data.role_id,
      // primary_branch_id will be set via staff_branches
    })
    .select()
    .single();

  if (error) throw error;
  
  // Assign primary branch
  await supabase
    .from('staff_branches')
    .insert({
      staff_id: staff.id,
      branch_id: data.primary_branch_id,
      is_primary: true
    });

  return staff;
}
```

### Handle Optimistic Locking Conflict

```typescript
async function updateStaff(id: string, data: UpdateStaffRequest) {
  const { data: staff, error } = await supabase
    .from('staff')
    .update({
      name: data.name,
      // ... other fields
      version: data.version + 1
    })
    .eq('id', id)
    .eq('version', data.version) // Optimistic locking check
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows updated - version mismatch
      throw new Error('CONFLICT: Record was modified by another user');
    }
    throw error;
  }

  return staff;
}
```

### Query Audit Logs

```typescript
async function getAuditLogs(filters: AuditLogFilters) {
  let query = supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters.actor_id) {
    query = query.eq('actor_id', filters.actor_id);
  }
  if (filters.action) {
    query = query.eq('action', filters.action);
  }
  if (filters.from_date) {
    query = query.gte('created_at', filters.from_date);
  }

  const { data, error } = await query.limit(50);
  if (error) throw error;
  return data;
}
```

---

## Testing

### Run Integration Tests

```bash
npm test -- --testPathPattern=staff-management
```

### Seed Test Data

```sql
-- Create test staff member
INSERT INTO staff (name, phone, role_id, is_active)
SELECT 'Test User', '+97450000000', id, true
FROM roles WHERE name = 'MANAGER';
```

---

## Troubleshooting

### Issue: RLS Policy Blocking Access

**Solution**: Check user role in JWT claims:
```sql
SELECT auth.jwt() ->> 'role';
```

### Issue: Phone Number Uniqueness Error

**Solution**: Verify phone is not in cooling period:
```sql
SELECT phone, deactivated_at 
FROM staff 
WHERE phone = '+9745xxxxxxx' 
AND deactivated_at > NOW() - INTERVAL '90 days';
```

### Issue: Optimistic Locking Conflicts

**Solution**: Implement retry logic in frontend:
```typescript
async function updateWithRetry(id: string, data: any, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await updateStaff(id, data);
    } catch (error) {
      if (error.message.includes('CONFLICT') && i < maxRetries - 1) {
        // Fetch latest version and retry
        const latest = await getStaff(id);
        data.version = latest.version;
        continue;
      }
      throw error;
    }
  }
}
```

---

## API Reference

See [contracts/openapi.json](./contracts/openapi.json) for complete API specification.

Key endpoints:
- `GET /rest/v1/staff` - List staff members
- `POST /rest/v1/staff` - Create staff member
- `PATCH /rest/v1/staff?id=eq.{id}` - Update staff member
- `DELETE /rest/v1/staff?id=eq.{id}` - Deactivate staff member
- `GET /rest/v1/audit_logs` - Query audit logs

---

## Next Steps

1. Implement frontend UI components
2. Add form validation with Zod schemas
3. Implement role-based UI controls
4. Add comprehensive integration tests
5. Set up audit log archival job
