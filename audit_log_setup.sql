-- Enable Audit Logging for Employees

-- Create Audit Log Table
CREATE TABLE IF NOT EXISTS employee_audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    changed_by UUID REFERENCES auth.users(id),
    change_type TEXT NOT NULL, -- INSERT, UPDATE, DELETE
    old_data JSONB,
    new_data JSONB,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE employee_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and Managers can view audit logs" ON employee_audit_logs;

CREATE POLICY "Admins and Managers can view audit logs"
ON employee_audit_logs FOR SELECT
USING (
    auth.uid() IN (
        SELECT id FROM profiles WHERE role IN ('ADMIN', 'MANAGER')
    )
);

-- Trigger Function
CREATE OR REPLACE FUNCTION log_employee_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO employee_audit_logs (employee_id, changed_by, change_type, new_data)
        VALUES (NEW.id, auth.uid(), 'INSERT', row_to_json(NEW));
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO employee_audit_logs (employee_id, changed_by, change_type, old_data, new_data)
        VALUES (NEW.id, auth.uid(), 'UPDATE', row_to_json(OLD), row_to_json(NEW));
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO employee_audit_logs (employee_id, changed_by, change_type, old_data)
        VALUES (OLD.id, auth.uid(), 'DELETE', row_to_json(OLD));
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger
DROP TRIGGER IF EXISTS trigger_log_employee_changes ON employees;
CREATE TRIGGER trigger_log_employee_changes
AFTER INSERT OR UPDATE OR DELETE ON employees
FOR EACH ROW EXECUTE FUNCTION log_employee_changes();
