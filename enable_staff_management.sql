-- Enable Staff Management Module

-- Create locations table (Branches)
CREATE TABLE IF NOT EXISTS locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  is_active BOOLEAN DEFAULT true,
  is_roastery BOOLEAN DEFAULT false,
  type TEXT CHECK (type IN ('WAREHOUSE', 'BRANCH', 'ROASTERY')),
  contact_person JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed initial locations if empty
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM locations) THEN
    INSERT INTO locations (name, address, type, is_roastery) VALUES
    ('Main Branch', 'Doha, Qatar', 'BRANCH', false),
    ('Roastery HQ', 'Industrial Area', 'ROASTERY', true),
    ('Warehouse A', 'Logistics Park', 'WAREHOUSE', false);
  END IF;
END $$;

-- Create employees table
CREATE TABLE IF NOT EXISTS employees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id TEXT NOT NULL UNIQUE, -- DR-XXXX (Auto-generated via Trigger)
  
  -- Personal Information
  first_name_en TEXT NOT NULL,
  last_name_en TEXT NOT NULL,
  first_name_ar TEXT,
  last_name_ar TEXT,
  national_id TEXT,
  nationality TEXT,
  dob DATE,
  gender TEXT CHECK (gender IN ('Male', 'Female')),
  marital_status TEXT,
  
  -- Contact Information
  phone TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  
  -- Employment Details
  hire_date DATE NOT NULL,
  department TEXT,
  position TEXT,
  role TEXT NOT NULL, -- UserRole
  manager_id UUID REFERENCES employees(id),
  employment_type TEXT CHECK (employment_type IN ('Full-time', 'Part-time', 'Contract', 'Intern')),
  employment_status TEXT CHECK (employment_status IN ('Active', 'Probation', 'Suspended', 'Terminated', 'Resigned')) DEFAULT 'Active',
  shift_template TEXT CHECK (shift_template IN ('Morning', 'Evening', 'Night', 'Split')),
  shift_start_time TIME,
  shift_end_time TIME,
  shift_break_minutes INTEGER DEFAULT 0,
  shift_grace_minutes INTEGER DEFAULT 15,
  employee_pin TEXT UNIQUE,
  is_on_leave BOOLEAN DEFAULT false,
  location_id UUID REFERENCES locations(id),
  
  -- Qatar Specifics
  qid TEXT UNIQUE CHECK (length(qid) = 11),
  visa_status TEXT,
  visa_expiry DATE,
  health_card_expiry DATE,
  
  -- Profile Photo
  photo_url TEXT,
  
  -- Financials
  salary_base NUMERIC(10, 2) DEFAULT 0,
  salary_allowances NUMERIC(10, 2) DEFAULT 0,
  bank_name TEXT,
  iban TEXT,
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE employees ADD COLUMN IF NOT EXISTS shift_start_time TIME;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS shift_end_time TIME;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS shift_template TEXT CHECK (shift_template IN ('Morning', 'Evening', 'Night', 'Split'));
ALTER TABLE employees ADD COLUMN IF NOT EXISTS shift_break_minutes INTEGER DEFAULT 0;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS shift_grace_minutes INTEGER DEFAULT 15;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS employee_pin TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_on_leave BOOLEAN DEFAULT false;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id);

CREATE TABLE IF NOT EXISTS employee_time_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  clock_in_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  clock_out_at TIMESTAMP WITH TIME ZONE,
  is_manual BOOLEAN DEFAULT false,
  manual_reason TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE employee_time_logs ADD COLUMN IF NOT EXISTS is_manual BOOLEAN DEFAULT false;
ALTER TABLE employee_time_logs ADD COLUMN IF NOT EXISTS manual_reason TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS employee_time_logs_open_unique
ON employee_time_logs (employee_id)
WHERE clock_out_at IS NULL;

CREATE OR REPLACE FUNCTION check_time_log_overlap()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.clock_out_at IS NOT NULL AND NEW.clock_out_at <= NEW.clock_in_at THEN
    RAISE EXCEPTION 'Clock out must be after clock in';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM employee_time_logs
    WHERE employee_id = NEW.employee_id
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND tstzrange(clock_in_at, COALESCE(clock_out_at, 'infinity')) &&
          tstzrange(NEW.clock_in_at, COALESCE(NEW.clock_out_at, 'infinity'))
  ) THEN
    RAISE EXCEPTION 'Overlapping time log';
  END IF;

  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS prevent_time_log_overlap ON employee_time_logs;
CREATE TRIGGER prevent_time_log_overlap
BEFORE INSERT OR UPDATE ON employee_time_logs
FOR EACH ROW
EXECUTE FUNCTION check_time_log_overlap();

CREATE TABLE IF NOT EXISTS employee_weekly_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  day_of_week SMALLINT CHECK (day_of_week BETWEEN 0 AND 6),
  is_working BOOLEAN DEFAULT true,
  start_time TIME,
  end_time TIME,
  break_minutes INTEGER DEFAULT 0,
  grace_minutes INTEGER DEFAULT 15,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS employee_weekly_schedules_unique
ON employee_weekly_schedules (employee_id, day_of_week);

CREATE TABLE IF NOT EXISTS employee_shift_swap_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  target_employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  reason TEXT,
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')) DEFAULT 'pending',
  manager_id UUID REFERENCES auth.users(id),
  manager_comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employee_schedule_overrides (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  is_working BOOLEAN DEFAULT true,
  start_time TIME,
  end_time TIME,
  break_minutes INTEGER DEFAULT 0,
  grace_minutes INTEGER DEFAULT 15,
  swap_request_id UUID REFERENCES employee_shift_swap_requests(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS employee_schedule_overrides_unique
ON employee_schedule_overrides (employee_id, shift_date);

CREATE TABLE IF NOT EXISTS employee_salary_advances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  requested_at DATE DEFAULT CURRENT_DATE,
  reason TEXT,
  status TEXT CHECK (status IN ('open', 'closed', 'cancelled')) DEFAULT 'open',
  monthly_deduction NUMERIC(10, 2) DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employee_salary_advance_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  advance_id UUID REFERENCES employee_salary_advances(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  paid_at DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS employee_salary_advances_employee_idx
ON employee_salary_advances (employee_id);

CREATE INDEX IF NOT EXISTS employee_salary_advance_payments_employee_idx
ON employee_salary_advance_payments (employee_id);

CREATE INDEX IF NOT EXISTS employee_salary_advance_payments_advance_idx
ON employee_salary_advance_payments (advance_id);

CREATE TABLE IF NOT EXISTS payroll_approvals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  month TEXT NOT NULL,
  status TEXT CHECK (status IN ('draft', 'hr_approved', 'manager_approved', 'admin_approved')) DEFAULT 'draft',
  created_by UUID REFERENCES auth.users(id),
  hr_approved_by UUID REFERENCES auth.users(id),
  hr_approved_at TIMESTAMP WITH TIME ZONE,
  manager_approved_by UUID REFERENCES auth.users(id),
  manager_approved_at TIMESTAMP WITH TIME ZONE,
  admin_approved_by UUID REFERENCES auth.users(id),
  admin_approved_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS payroll_approvals_month_unique
ON payroll_approvals (month);

CREATE TABLE IF NOT EXISTS payroll_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  month TEXT NOT NULL,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  gross_salary NUMERIC(10, 2) NOT NULL,
  overtime_hours NUMERIC(10, 2) NOT NULL DEFAULT 0,
  overtime_pay NUMERIC(10, 2) NOT NULL DEFAULT 0,
  absence_deductions NUMERIC(10, 2) NOT NULL DEFAULT 0,
  late_penalties NUMERIC(10, 2) NOT NULL DEFAULT 0,
  advance_deductions NUMERIC(10, 2) NOT NULL DEFAULT 0,
  net_pay NUMERIC(10, 2) NOT NULL,
  present_days INT NOT NULL DEFAULT 0,
  absent_days INT NOT NULL DEFAULT 0,
  late_days INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS payroll_history_month_employee_unique
ON payroll_history (month, employee_id);

CREATE TABLE IF NOT EXISTS performance_kpis (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  role TEXT NOT NULL,
  name TEXT NOT NULL,
  unit TEXT,
  target_value NUMERIC(10, 2),
  source_module TEXT,
  source_metric TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE performance_kpis ADD COLUMN IF NOT EXISTS source_module TEXT;
ALTER TABLE performance_kpis ADD COLUMN IF NOT EXISTS source_metric TEXT;

CREATE TABLE IF NOT EXISTS performance_review_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  role TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS performance_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  period_type TEXT CHECK (period_type IN ('monthly', 'quarterly', 'annual')) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  overall_score NUMERIC(10, 2),
  notes TEXT,
  manager_feedback TEXT,
  improvement_notes TEXT,
  bonus_rule_id UUID,
  bonus_type TEXT CHECK (bonus_type IN ('percentage', 'fixed')),
  bonus_rate NUMERIC(10, 2),
  bonus_amount NUMERIC(10, 2),
  status TEXT CHECK (status IN ('draft', 'completed')) DEFAULT 'draft',
  created_by UUID REFERENCES auth.users(id),
  reviewed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE performance_reviews ADD COLUMN IF NOT EXISTS manager_feedback TEXT;
ALTER TABLE performance_reviews ADD COLUMN IF NOT EXISTS improvement_notes TEXT;
ALTER TABLE performance_reviews ADD COLUMN IF NOT EXISTS bonus_rule_id UUID;
ALTER TABLE performance_reviews ADD COLUMN IF NOT EXISTS bonus_type TEXT CHECK (bonus_type IN ('percentage', 'fixed'));
ALTER TABLE performance_reviews ADD COLUMN IF NOT EXISTS bonus_rate NUMERIC(10, 2);
ALTER TABLE performance_reviews ADD COLUMN IF NOT EXISTS bonus_amount NUMERIC(10, 2);

CREATE TABLE IF NOT EXISTS performance_review_kpis (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id UUID REFERENCES performance_reviews(id) ON DELETE CASCADE,
  kpi_id UUID REFERENCES performance_kpis(id) ON DELETE SET NULL,
  actual_value NUMERIC(10, 2),
  score NUMERIC(10, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS performance_review_ratings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id UUID REFERENCES performance_reviews(id) ON DELETE CASCADE,
  category_id UUID REFERENCES performance_review_categories(id) ON DELETE CASCADE,
  rating INT CHECK (rating BETWEEN 1 AND 5) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS performance_bonus_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  role TEXT NOT NULL,
  min_score NUMERIC(10, 2),
  max_score NUMERIC(10, 2),
  bonus_type TEXT CHECK (bonus_type IN ('percentage', 'fixed')) NOT NULL,
  bonus_rate NUMERIC(10, 2),
  bonus_amount NUMERIC(10, 2),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS performance_kpis_role_idx
ON performance_kpis (role);

CREATE INDEX IF NOT EXISTS performance_review_categories_role_idx
ON performance_review_categories (role);

CREATE UNIQUE INDEX IF NOT EXISTS performance_review_kpis_unique
ON performance_review_kpis (review_id, kpi_id);

CREATE UNIQUE INDEX IF NOT EXISTS performance_review_ratings_unique
ON performance_review_ratings (review_id, category_id);

CREATE INDEX IF NOT EXISTS performance_reviews_employee_idx
ON performance_reviews (employee_id);

CREATE INDEX IF NOT EXISTS performance_bonus_rules_role_idx
ON performance_bonus_rules (role);

DROP VIEW IF EXISTS employee_daily_attendance;
CREATE VIEW employee_daily_attendance AS
WITH todays_logs AS (
  SELECT
    employee_id,
    DATE(clock_in_at) AS work_date,
    MIN(clock_in_at) AS first_clock_in_at,
    MAX(clock_out_at) AS last_clock_out_at,
    SUM(
      CASE
        WHEN clock_out_at IS NOT NULL THEN EXTRACT(EPOCH FROM (clock_out_at - clock_in_at))
        ELSE 0
      END
    ) / 3600.0 AS total_hours
  FROM employee_time_logs
  WHERE DATE(clock_in_at) = CURRENT_DATE
  GROUP BY employee_id, DATE(clock_in_at)
),
schedule_today AS (
  SELECT
    employee_id,
    is_working,
    start_time,
    end_time,
    break_minutes,
    grace_minutes
  FROM employee_weekly_schedules
  WHERE day_of_week = EXTRACT(DOW FROM CURRENT_DATE)::int
),
overrides_today AS (
  SELECT
    employee_id,
    is_working,
    start_time,
    end_time,
    break_minutes,
    grace_minutes
  FROM employee_schedule_overrides
  WHERE shift_date = CURRENT_DATE
)
SELECT
  e.id AS employee_id,
  CURRENT_DATE AS work_date,
  tl.first_clock_in_at,
  tl.last_clock_out_at,
  COALESCE(tl.total_hours, 0) AS total_hours,
  CASE
    WHEN e.is_on_leave THEN false
    WHEN COALESCE(ot.is_working, st.is_working, CASE WHEN e.shift_start_time IS NULL OR e.shift_end_time IS NULL THEN false ELSE true END) = false THEN false
    WHEN tl.first_clock_in_at IS NULL OR COALESCE(ot.start_time, st.start_time, e.shift_start_time) IS NULL THEN false
    ELSE (tl.first_clock_in_at::time > (COALESCE(ot.start_time, st.start_time, e.shift_start_time) + (COALESCE(ot.grace_minutes, st.grace_minutes, e.shift_grace_minutes, 15) * INTERVAL '1 minute')))
  END AS is_late,
  CASE
    WHEN e.is_on_leave THEN false
    WHEN COALESCE(ot.is_working, st.is_working, CASE WHEN e.shift_start_time IS NULL OR e.shift_end_time IS NULL THEN false ELSE true END) = false THEN false
    WHEN tl.last_clock_out_at IS NULL OR COALESCE(ot.end_time, st.end_time, e.shift_end_time) IS NULL THEN false
    ELSE (tl.last_clock_out_at::time < COALESCE(ot.end_time, st.end_time, e.shift_end_time))
  END AS is_early_departure,
  CASE
    WHEN COALESCE(ot.is_working, st.is_working, CASE WHEN e.shift_start_time IS NULL OR e.shift_end_time IS NULL THEN false ELSE true END) = false THEN 0
    WHEN COALESCE(ot.start_time, st.start_time, e.shift_start_time) IS NULL OR COALESCE(ot.end_time, st.end_time, e.shift_end_time) IS NULL THEN 0
    ELSE GREATEST(
      0,
      (
        COALESCE(tl.total_hours, 0) - EXTRACT(EPOCH FROM (COALESCE(ot.end_time, st.end_time, e.shift_end_time) - COALESCE(ot.start_time, st.start_time, e.shift_start_time))) / 3600.0
      )
    )
  END AS overtime_hours,
  CASE
    WHEN e.is_on_leave THEN false
    WHEN COALESCE(ot.is_working, st.is_working, CASE WHEN e.shift_start_time IS NULL OR e.shift_end_time IS NULL THEN false ELSE true END) = false THEN false
    WHEN tl.first_clock_in_at IS NULL AND COALESCE(ot.end_time, st.end_time, e.shift_end_time) IS NOT NULL AND NOW()::time >= COALESCE(ot.end_time, st.end_time, e.shift_end_time) THEN true
    ELSE false
  END AS is_absent,
  e.is_on_leave AS is_on_leave
FROM employees e
LEFT JOIN todays_logs tl ON tl.employee_id = e.id
LEFT JOIN schedule_today st ON st.employee_id = e.id
LEFT JOIN overrides_today ot ON ot.employee_id = e.id;

-- Create Storage Bucket for Employee Photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('employee-photos', 'employee-photos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for Storage
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'employee-photos');
CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'employee-photos' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated Update" ON storage.objects FOR UPDATE WITH CHECK (bucket_id = 'employee-photos' AND auth.role() = 'authenticated');

-- RLS Policies for Employees Table
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and Managers can view all employees" ON employees;
DROP POLICY IF EXISTS "Admins and Managers can insert employees" ON employees;
DROP POLICY IF EXISTS "Admins and Managers can update employees" ON employees;

CREATE POLICY "Admins and Managers can view all employees" 
ON employees FOR SELECT 
USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('ADMIN', 'MANAGER')
  )
);

CREATE POLICY "Admins and Managers can insert employees" 
ON employees FOR INSERT 
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('ADMIN', 'MANAGER')
  )
);

CREATE POLICY "Admins and Managers can update employees" 
ON employees FOR UPDATE 
USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('ADMIN', 'MANAGER')
  )
);

ALTER TABLE employee_time_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and Managers can view time logs" ON employee_time_logs;
DROP POLICY IF EXISTS "Admins and Managers can insert time logs" ON employee_time_logs;
DROP POLICY IF EXISTS "Admins and Managers can update time logs" ON employee_time_logs;

CREATE POLICY "Admins and Managers can view time logs" 
ON employee_time_logs FOR SELECT 
USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('ADMIN', 'MANAGER')
  )
);

CREATE POLICY "Admins and Managers can insert time logs" 
ON employee_time_logs FOR INSERT 
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('ADMIN', 'MANAGER')
  )
);

CREATE POLICY "Admins and Managers can update time logs" 
ON employee_time_logs FOR UPDATE 
USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('ADMIN', 'MANAGER')
  )
);

ALTER TABLE employee_shift_swap_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and Managers can view shift swap requests" ON employee_shift_swap_requests;
DROP POLICY IF EXISTS "Admins and Managers can insert shift swap requests" ON employee_shift_swap_requests;
DROP POLICY IF EXISTS "Admins and Managers can update shift swap requests" ON employee_shift_swap_requests;

CREATE POLICY "Admins and Managers can view shift swap requests" 
ON employee_shift_swap_requests FOR SELECT 
USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('ADMIN', 'MANAGER')
  )
);

CREATE POLICY "Admins and Managers can insert shift swap requests" 
ON employee_shift_swap_requests FOR INSERT 
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('ADMIN', 'MANAGER')
  )
);

CREATE POLICY "Admins and Managers can update shift swap requests" 
ON employee_shift_swap_requests FOR UPDATE 
USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('ADMIN', 'MANAGER')
  )
);

ALTER TABLE employee_schedule_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and Managers can view schedule overrides" ON employee_schedule_overrides;
DROP POLICY IF EXISTS "Admins and Managers can insert schedule overrides" ON employee_schedule_overrides;
DROP POLICY IF EXISTS "Admins and Managers can update schedule overrides" ON employee_schedule_overrides;

CREATE POLICY "Admins and Managers can view schedule overrides" 
ON employee_schedule_overrides FOR SELECT 
USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('ADMIN', 'MANAGER')
  )
);

CREATE POLICY "Admins and Managers can insert schedule overrides" 
ON employee_schedule_overrides FOR INSERT 
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('ADMIN', 'MANAGER')
  )
);

CREATE POLICY "Admins and Managers can update schedule overrides" 
ON employee_schedule_overrides FOR UPDATE 
USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('ADMIN', 'MANAGER')
  )
);

ALTER TABLE employee_salary_advances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and Managers can view salary advances" ON employee_salary_advances;
DROP POLICY IF EXISTS "Admins and Managers can insert salary advances" ON employee_salary_advances;
DROP POLICY IF EXISTS "Admins and Managers can update salary advances" ON employee_salary_advances;

CREATE POLICY "Admins and Managers can view salary advances" 
ON employee_salary_advances FOR SELECT 
USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('ADMIN', 'MANAGER')
  )
);

CREATE POLICY "Admins and Managers can insert salary advances" 
ON employee_salary_advances FOR INSERT 
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('ADMIN', 'MANAGER')
  )
);

CREATE POLICY "Admins and Managers can update salary advances" 
ON employee_salary_advances FOR UPDATE 
USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('ADMIN', 'MANAGER')
  )
);

ALTER TABLE employee_salary_advance_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and Managers can view salary advance payments" ON employee_salary_advance_payments;
DROP POLICY IF EXISTS "Admins and Managers can insert salary advance payments" ON employee_salary_advance_payments;
DROP POLICY IF EXISTS "Admins and Managers can update salary advance payments" ON employee_salary_advance_payments;

CREATE POLICY "Admins and Managers can view salary advance payments" 
ON employee_salary_advance_payments FOR SELECT 
USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('ADMIN', 'MANAGER')
  )
);

CREATE POLICY "Admins and Managers can insert salary advance payments" 
ON employee_salary_advance_payments FOR INSERT 
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('ADMIN', 'MANAGER')
  )
);

CREATE POLICY "Admins and Managers can update salary advance payments" 
ON employee_salary_advance_payments FOR UPDATE 
USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('ADMIN', 'MANAGER')
  )
);

ALTER TABLE payroll_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Payroll approvers can view approvals" ON payroll_approvals;
DROP POLICY IF EXISTS "Payroll approvers can insert approvals" ON payroll_approvals;
DROP POLICY IF EXISTS "Payroll approvers can update approvals" ON payroll_approvals;

CREATE POLICY "Payroll approvers can view approvals" 
ON payroll_approvals FOR SELECT 
USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('ADMIN', 'MANAGER', 'HR')
  )
);

CREATE POLICY "Payroll approvers can insert approvals" 
ON payroll_approvals FOR INSERT 
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('ADMIN', 'HR')
  )
);

CREATE POLICY "Payroll approvers can update approvals" 
ON payroll_approvals FOR UPDATE 
USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('ADMIN', 'MANAGER', 'HR')
  )
);

ALTER TABLE payroll_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Payroll approvers can view history" ON payroll_history;
DROP POLICY IF EXISTS "Admins can insert payroll history" ON payroll_history;
DROP POLICY IF EXISTS "Admins can update payroll history" ON payroll_history;

CREATE POLICY "Payroll approvers can view history" 
ON payroll_history FOR SELECT 
USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('ADMIN', 'MANAGER', 'HR')
  )
);

CREATE POLICY "Admins can insert payroll history" 
ON payroll_history FOR INSERT 
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('ADMIN')
  )
);

CREATE POLICY "Admins can update payroll history" 
ON payroll_history FOR UPDATE 
USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('ADMIN')
  )
);

ALTER TABLE performance_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_review_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_review_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_review_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_bonus_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Performance reviewers can view kpis" ON performance_kpis;
DROP POLICY IF EXISTS "Performance admins can insert kpis" ON performance_kpis;
DROP POLICY IF EXISTS "Performance admins can update kpis" ON performance_kpis;
DROP POLICY IF EXISTS "Performance reviewers can view categories" ON performance_review_categories;
DROP POLICY IF EXISTS "Performance admins can insert categories" ON performance_review_categories;
DROP POLICY IF EXISTS "Performance admins can update categories" ON performance_review_categories;
DROP POLICY IF EXISTS "Performance reviewers can view bonus rules" ON performance_bonus_rules;
DROP POLICY IF EXISTS "Performance admins can insert bonus rules" ON performance_bonus_rules;
DROP POLICY IF EXISTS "Performance admins can update bonus rules" ON performance_bonus_rules;

CREATE POLICY "Performance reviewers can view kpis" 
ON performance_kpis FOR SELECT 
USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('ADMIN', 'MANAGER', 'HR')
  )
);

CREATE POLICY "Performance admins can insert kpis" 
ON performance_kpis FOR INSERT 
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('ADMIN', 'HR')
  )
);

CREATE POLICY "Performance admins can update kpis" 
ON performance_kpis FOR UPDATE 
USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('ADMIN', 'HR')
  )
);

CREATE POLICY "Performance reviewers can view categories" 
ON performance_review_categories FOR SELECT 
USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('ADMIN', 'MANAGER', 'HR')
  )
);

CREATE POLICY "Performance admins can insert categories" 
ON performance_review_categories FOR INSERT 
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('ADMIN', 'HR')
  )
);

CREATE POLICY "Performance admins can update categories" 
ON performance_review_categories FOR UPDATE 
USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('ADMIN', 'HR')
  )
);

CREATE POLICY "Performance reviewers can view bonus rules" 
ON performance_bonus_rules FOR SELECT 
USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('ADMIN', 'MANAGER', 'HR')
  )
);

CREATE POLICY "Performance admins can insert bonus rules" 
ON performance_bonus_rules FOR INSERT 
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('ADMIN', 'HR')
  )
);

CREATE POLICY "Performance admins can update bonus rules" 
ON performance_bonus_rules FOR UPDATE 
USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('ADMIN', 'HR')
  )
);

DROP POLICY IF EXISTS "Performance reviewers can view reviews" ON performance_reviews;
DROP POLICY IF EXISTS "Performance reviewers can insert reviews" ON performance_reviews;
DROP POLICY IF EXISTS "Performance reviewers can update reviews" ON performance_reviews;

CREATE POLICY "Performance reviewers can view reviews" 
ON performance_reviews FOR SELECT 
USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('ADMIN', 'MANAGER', 'HR')
  )
);

CREATE POLICY "Performance reviewers can insert reviews" 
ON performance_reviews FOR INSERT 
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('ADMIN', 'MANAGER', 'HR')
  )
);

CREATE POLICY "Performance reviewers can update reviews" 
ON performance_reviews FOR UPDATE 
USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('ADMIN', 'MANAGER', 'HR')
  )
);

DROP POLICY IF EXISTS "Performance reviewers can view review kpis" ON performance_review_kpis;
DROP POLICY IF EXISTS "Performance reviewers can insert review kpis" ON performance_review_kpis;
DROP POLICY IF EXISTS "Performance reviewers can update review kpis" ON performance_review_kpis;
DROP POLICY IF EXISTS "Performance reviewers can view review ratings" ON performance_review_ratings;
DROP POLICY IF EXISTS "Performance reviewers can insert review ratings" ON performance_review_ratings;
DROP POLICY IF EXISTS "Performance reviewers can update review ratings" ON performance_review_ratings;

CREATE POLICY "Performance reviewers can view review kpis" 
ON performance_review_kpis FOR SELECT 
USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('ADMIN', 'MANAGER', 'HR')
  )
);

CREATE POLICY "Performance reviewers can insert review kpis" 
ON performance_review_kpis FOR INSERT 
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('ADMIN', 'MANAGER', 'HR')
  )
);

CREATE POLICY "Performance reviewers can update review kpis" 
ON performance_review_kpis FOR UPDATE 
USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('ADMIN', 'MANAGER', 'HR')
  )
);

CREATE POLICY "Performance reviewers can view review ratings" 
ON performance_review_ratings FOR SELECT 
USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('ADMIN', 'MANAGER', 'HR')
  )
);

CREATE POLICY "Performance reviewers can insert review ratings" 
ON performance_review_ratings FOR INSERT 
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('ADMIN', 'MANAGER', 'HR')
  )
);

CREATE POLICY "Performance reviewers can update review ratings" 
ON performance_review_ratings FOR UPDATE 
USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('ADMIN', 'MANAGER', 'HR')
  )
);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_employees_updated_at ON employees;
CREATE TRIGGER update_employees_updated_at
BEFORE UPDATE ON employees
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_shift_swap_requests_updated_at ON employee_shift_swap_requests;
CREATE TRIGGER update_shift_swap_requests_updated_at
BEFORE UPDATE ON employee_shift_swap_requests
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_schedule_overrides_updated_at ON employee_schedule_overrides;
CREATE TRIGGER update_schedule_overrides_updated_at
BEFORE UPDATE ON employee_schedule_overrides
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_salary_advances_updated_at ON employee_salary_advances;
CREATE TRIGGER update_salary_advances_updated_at
BEFORE UPDATE ON employee_salary_advances
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_payroll_approvals_updated_at ON payroll_approvals;
CREATE TRIGGER update_payroll_approvals_updated_at
BEFORE UPDATE ON payroll_approvals
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_payroll_history_updated_at ON payroll_history;
CREATE TRIGGER update_payroll_history_updated_at
BEFORE UPDATE ON payroll_history
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_performance_kpis_updated_at ON performance_kpis;
CREATE TRIGGER update_performance_kpis_updated_at
BEFORE UPDATE ON performance_kpis
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_performance_review_categories_updated_at ON performance_review_categories;
CREATE TRIGGER update_performance_review_categories_updated_at
BEFORE UPDATE ON performance_review_categories
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_performance_reviews_updated_at ON performance_reviews;
CREATE TRIGGER update_performance_reviews_updated_at
BEFORE UPDATE ON performance_reviews
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_performance_bonus_rules_updated_at ON performance_bonus_rules;
CREATE TRIGGER update_performance_bonus_rules_updated_at
BEFORE UPDATE ON performance_bonus_rules
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

-- Function to Auto-Generate Employee ID (DR-XXXX)
CREATE OR REPLACE FUNCTION generate_employee_id()
RETURNS TRIGGER AS $$
DECLARE
  last_id TEXT;
  next_num INT;
BEGIN
  -- Only generate if not provided
  IF NEW.employee_id IS NULL OR NEW.employee_id = '' THEN
    -- Find the last ID that matches the pattern DR-XXXX
    SELECT employee_id INTO last_id 
    FROM employees 
    WHERE employee_id ~ '^DR-\d{4}$'
    ORDER BY employee_id DESC 
    LIMIT 1;
    
    IF last_id IS NULL THEN
      next_num := 1;
    ELSE
      -- Extract the numeric part
      next_num := CAST(SUBSTRING(last_id FROM 4) AS INT) + 1;
    END IF;
    
    NEW.employee_id := 'DR-' || LPAD(CAST(next_num AS TEXT), 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for Employee ID Generation
DROP TRIGGER IF EXISTS trigger_generate_employee_id ON employees;
CREATE TRIGGER trigger_generate_employee_id
BEFORE INSERT ON employees
FOR EACH ROW
EXECUTE FUNCTION generate_employee_id();

-- Add location_id to employees for Branch/Location assignment
ALTER TABLE employees ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id);
