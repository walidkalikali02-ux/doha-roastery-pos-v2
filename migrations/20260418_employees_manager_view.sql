-- Migration: 20260418_employees_manager_view.sql
-- Purpose: Create restricted view for MANAGER role that excludes sensitive columns
-- Depends on: employees table, current_user_is_hr(), current_user_is_admin()

-- Create view that excludes salary, bank, and national ID fields for MANAGER role
CREATE OR REPLACE VIEW employees_for_manager AS
SELECT
    id,
    employee_id,
    full_name,
    username,
    role,
    email,
    phone,
    emergency_contact,
    employment_status,
    employment_type,
    hire_date,
    termination_date,
    branch_id,
    location_id,
    avatar_url,
    -- EXCLUDED: salary_base, salary_allowances, bank_name, iban, national_id, qid, employee_pin
    is_active,
    created_at,
    updated_at
FROM employees;

-- Grant access to the view
GRANT SELECT ON employees_for_manager TO authenticated;

-- Note: RLS on the underlying employees table still applies.
-- MANAGER will use this view, ADMIN and HR will use the full employees table.