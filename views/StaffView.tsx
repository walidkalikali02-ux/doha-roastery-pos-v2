import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  Users, Plus, Search, FileText, Download, Clock, 
  Edit, X, Upload, CreditCard, Printer, 
  MapPin, Phone, User, Briefcase, Loader2
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useLanguage } from '../App';
import { Employee, UserRole, ShiftTemplate, SystemSettings, SalaryAdvance, SalaryAdvancePayment, PayrollApproval, PerformanceKpi, PerformanceReview, PerformanceReviewCategory, PerformanceBonusRule, Location } from '../types';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';

// --- Zod Schema ---
const createEmployeeSchema = (t: Record<string, string>) => z.object({
  first_name_en: z.string().min(2, t.firstNameEnRequired),
  last_name_en: z.string().min(2, t.lastNameEnRequired),
  first_name_ar: z.string().optional(),
  last_name_ar: z.string().optional(),
  national_id: z.string().optional(),
  nationality: z.string().optional(),
  dob: z.string().optional(), // Date string YYYY-MM-DD
  gender: z.enum(['Male', 'Female'] as const).optional(),
  marital_status: z.string().optional(),
  
  phone: z.string().min(8, t.phoneRequired),
  email: z.string().email(t.invalidEmail),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  
  hire_date: z.string().min(1, t.hireDateRequired),
  department: z.string().optional(),
  position: z.string().optional(),
  role: z.nativeEnum(UserRole),
  manager_id: z.string().optional(),
  employment_type: z.enum(['Full-time', 'Part-time', 'Contract', 'Intern'] as const),
  employment_status: z.enum(['Active', 'Probation', 'Suspended', 'Terminated', 'Resigned'] as const),
  
  qid: z.string().regex(/^\d{11}$/, t.qidDigits).optional().or(z.literal('')),
  visa_status: z.string().optional(),
  visa_expiry: z.string().optional(),
  health_card_expiry: z.string().optional(),
  
  salary_base: z.number().min(0).optional(),
  salary_allowances: z.number().min(0).optional(),
  bank_name: z.string().optional(),
  iban: z.string().optional(),
  shift_template: z.enum(['Morning', 'Evening', 'Night', 'Split'] as const).optional().or(z.literal('')),
  shift_start_time: z.string().optional(),
  shift_end_time: z.string().optional(),
  shift_break_minutes: z.number().min(0).optional(),
  shift_grace_minutes: z.number().min(0).optional(),
  employee_pin: z.string().optional(),
  is_on_leave: z.boolean().optional(),
  location_id: z.string().optional(),
});

type EmployeeFormValues = z.infer<ReturnType<typeof createEmployeeSchema>>;

type SalaryAdvancePaymentFormValues = {
  advance_id: string;
  amount: string;
  paid_at: string;
  notes: string;
};

const SHIFT_TEMPLATES: Record<ShiftTemplate, { start: string; end: string }> = {
  Morning: { start: '07:00', end: '15:00' },
  Evening: { start: '15:00', end: '23:00' },
  Night: { start: '23:00', end: '07:00' },
  Split: { start: '09:00', end: '21:00' }
};

type EmployeeTimeLog = {
  id: string;
  employee_id: string;
  clock_in_at: string;
  clock_out_at: string | null;
  location_id?: string | null;
};

type BranchTransfer = {
  id: string;
  employee_id: string;
  from_location_id: string | null;
  to_location_id: string;
  transfer_type: 'TEMPORARY' | 'PERMANENT';
  status: 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED';
  reason: string | null;
  start_at: string | null;
  end_at: string | null;
  requested_by_name: string | null;
  requested_at: string;
  approved_by_name: string | null;
  approved_at: string | null;
  created_at: string;
};

type BranchStaffingTarget = {
  id: string;
  location_id: string;
  role: UserRole;
  min_required: number;
};

type DailyAttendanceRow = {
  employee_id: string;
  work_date: string;
  first_clock_in_at: string | null;
  last_clock_out_at: string | null;
  total_hours: number;
  is_late: boolean;
  is_early_departure: boolean;
  overtime_hours: number;
  is_absent: boolean;
  is_on_leave: boolean;
};

type WeeklyScheduleDay = {
  day_of_week: number;
  is_working: boolean;
  start_time: string;
  end_time: string;
  break_minutes: number;
  grace_minutes: number;
};

type ShiftSwapRequest = {
  id: string;
  requester_id: string;
  target_employee_id: string;
  shift_date: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  manager_id?: string | null;
  manager_comment?: string | null;
  created_at: string;
  requester?: { first_name_en: string; last_name_en: string };
  target?: { first_name_en: string; last_name_en: string };
};

const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const OVERTIME_HOLIDAYS = new Set<string>();

export default function StaffView() {
  const { t, lang } = useLanguage();
  const employeeSchema = useMemo(() => createEmployeeSchema(t), [t]);
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [staffTab, setStaffTab] = useState<'overview' | 'schedule' | 'payroll' | 'performance' | 'branches'>('overview');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [openTimeLogs, setOpenTimeLogs] = useState<Record<string, EmployeeTimeLog>>({});
  const [clockingEmployeeIds, setClockingEmployeeIds] = useState<Record<string, boolean>>({});
  const [manualEntryEmployee, setManualEntryEmployee] = useState<Employee | null>(null);
  const [manualClockInAt, setManualClockInAt] = useState('');
  const [manualClockOutAt, setManualClockOutAt] = useState('');

  const [formTab, setFormTab] = useState<'personal' | 'contact' | 'employment' | 'financial' | 'schedule'>('personal');
  const [manualReason, setManualReason] = useState('');
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [quickClockValue, setQuickClockValue] = useState('');
  const [quickClocking, setQuickClocking] = useState(false);
  const [dailyAttendance, setDailyAttendance] = useState<DailyAttendanceRow[]>([]);
  const [branchTransfers, setBranchTransfers] = useState<BranchTransfer[]>([]);
  const [branchStaffingTargets, setBranchStaffingTargets] = useState<BranchStaffingTarget[]>([]);
  const [showBranchTransferModal, setShowBranchTransferModal] = useState(false);
  const [branchTransferEmployee, setBranchTransferEmployee] = useState<Employee | null>(null);
  const [branchTransferForm, setBranchTransferForm] = useState({
    to_location_id: '',
    transfer_type: 'TEMPORARY' as 'TEMPORARY' | 'PERMANENT',
    start_at: '',
    end_at: '',
    reason: ''
  });
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    id: '',
    printer_width: '80mm',
    store_name: 'Doha Roastery',
    store_address: '',
    store_phone: '',
    vat_rate: 0,
    currency: 'QAR',
    late_penalty_type: 'per_minute',
    late_penalty_amount: 0
  });
  const [salaryAdvances, setSalaryAdvances] = useState<SalaryAdvance[]>([]);
  const [salaryAdvancePayments, setSalaryAdvancePayments] = useState<SalaryAdvancePayment[]>([]);
  const [salaryAdvanceForm, setSalaryAdvanceForm] = useState({
    amount: '',
    monthly_deduction: '',
    requested_at: new Date().toISOString().slice(0, 10),
    reason: ''
  });
  const [salaryAdvancePaymentForm, setSalaryAdvancePaymentForm] = useState({
    advance_id: '',
    amount: '',
    paid_at: new Date().toISOString().slice(0, 10),
    notes: ''
  });
  const [salaryAdvanceSaving, setSalaryAdvanceSaving] = useState(false);
  const [salaryAdvancePaymentSaving, setSalaryAdvancePaymentSaving] = useState(false);
  const [calendarEmployeeId, setCalendarEmployeeId] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [calendarLogs, setCalendarLogs] = useState<EmployeeTimeLog[]>([]);
  const [reportPeriod, setReportPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reportLogs, setReportLogs] = useState<EmployeeTimeLog[]>([]);
  const [payrollMonth, setPayrollMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [payrollLogs, setPayrollLogs] = useState<EmployeeTimeLog[]>([]);
  const [payrollPayments, setPayrollPayments] = useState<SalaryAdvancePayment[]>([]);
  const [payrollLoading, setPayrollLoading] = useState(false);
  const [payrollApproval, setPayrollApproval] = useState<PayrollApproval | null>(null);
  const [payrollApprovalSaving, setPayrollApprovalSaving] = useState(false);
  const [performanceKpis, setPerformanceKpis] = useState<PerformanceKpi[]>([]);
  const [performanceKpisLoading, setPerformanceKpisLoading] = useState(false);
  const [reviewRoleKpis, setReviewRoleKpis] = useState<PerformanceKpi[]>([]);
  const [reviewRoleKpisLoading, setReviewRoleKpisLoading] = useState(false);
  const [performanceCategories, setPerformanceCategories] = useState<PerformanceReviewCategory[]>([]);
  const [performanceCategoriesLoading, setPerformanceCategoriesLoading] = useState(false);
  const [performanceBonusRules, setPerformanceBonusRules] = useState<PerformanceBonusRule[]>([]);
  const [performanceBonusRulesLoading, setPerformanceBonusRulesLoading] = useState(false);
  const [performanceReviews, setPerformanceReviews] = useState<PerformanceReview[]>([]);
  const [performanceReviewsLoading, setPerformanceReviewsLoading] = useState(false);
  const [kpiForm, setKpiForm] = useState({
    role: UserRole.ROASTER,
    name: '',
    unit: '',
    target_value: '',
    source_module: '',
    source_metric: ''
  });
  const [categoryForm, setCategoryForm] = useState({
    role: UserRole.ROASTER,
    name: '',
    description: ''
  });
  const [bonusRuleForm, setBonusRuleForm] = useState({
    role: UserRole.ROASTER,
    min_score: '',
    max_score: '',
    bonus_type: 'percentage' as 'percentage' | 'fixed',
    bonus_rate: '',
    bonus_amount: ''
  });
  const [reviewEmployeeId, setReviewEmployeeId] = useState('');
  const [reviewPeriodType, setReviewPeriodType] = useState<'monthly' | 'quarterly' | 'annual'>('monthly');
  const [reviewPeriodStart, setReviewPeriodStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [reviewPeriodEnd, setReviewPeriodEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewManagerFeedback, setReviewManagerFeedback] = useState('');
  const [reviewImprovementNotes, setReviewImprovementNotes] = useState('');
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewKpiValues, setReviewKpiValues] = useState<Record<string, string>>({});
  const [reviewCategoryRatings, setReviewCategoryRatings] = useState<Record<string, number>>({});
  const [reviewAutoFillLoading, setReviewAutoFillLoading] = useState(false);
  const [payslipEmployeeId, setPayslipEmployeeId] = useState<string | null>(null);
  const [scheduleCalendar, setScheduleCalendar] = useState<WeeklyScheduleDay[]>([]);
  const [scheduleCalendarLoading, setScheduleCalendarLoading] = useState(false);
  const [scheduleViewMode, setScheduleViewMode] = useState<'weekly' | 'monthly'>('weekly');
  const [scheduleWeekDate, setScheduleWeekDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [scheduleOverrides, setScheduleOverrides] = useState<Record<string, WeeklyScheduleDay>>({});
  const [bulkScheduleOpen, setBulkScheduleOpen] = useState(false);
  const [bulkScheduleEmployeeIds, setBulkScheduleEmployeeIds] = useState<string[]>([]);
  const [bulkScheduleSaving, setBulkScheduleSaving] = useState(false);
  const [swapRequests, setSwapRequests] = useState<ShiftSwapRequest[]>([]);
  const [swapRequestsLoading, setSwapRequestsLoading] = useState(false);
  const [swapRequestSubmitting, setSwapRequestSubmitting] = useState(false);
  const [swapRequesterId, setSwapRequesterId] = useState('');
  const [swapTargetId, setSwapTargetId] = useState('');
  const [swapDate, setSwapDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [swapReason, setSwapReason] = useState('');
  const [swapReviewNotes, setSwapReviewNotes] = useState<Record<string, string>>({});
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklyScheduleDay[]>([]);
  const [weeklyScheduleLoading, setWeeklyScheduleLoading] = useState(false);
  const [weeklyScheduleSaving, setWeeklyScheduleSaving] = useState(false);
  
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    shouldUnregister: false, // Keep values when tabs are hidden
    defaultValues: {
      role: UserRole.CASHIER,
      employment_type: 'Full-time',
      employment_status: 'Active',
      salary_base: 0,
      salary_allowances: 0,
      shift_template: '',
      shift_break_minutes: 0,
      shift_grace_minutes: 15,
      is_on_leave: false
    }
  });

  const hasTabErrors = (tab: typeof formTab) => {
    switch (tab) {
      case 'personal':
        return !!(errors.first_name_en || errors.last_name_en || errors.nationality || errors.gender || errors.dob || errors.marital_status || errors.national_id);
      case 'contact':
        return !!(errors.phone || errors.email || errors.emergency_contact_name || errors.emergency_contact_phone);
      case 'employment':
        return !!(errors.role || errors.department || errors.position || errors.hire_date || errors.employment_status || errors.employment_type || errors.manager_id || errors.qid || errors.visa_status || errors.visa_expiry || errors.health_card_expiry);
      case 'financial':
        return !!(errors.salary_base || errors.salary_allowances || errors.bank_name || errors.iban);
      case 'schedule':
        return !!(errors.shift_template || errors.shift_start_time || errors.shift_end_time || errors.shift_break_minutes || errors.shift_grace_minutes);
      default:
        return false;
    }
  };

  const weekDayLabels: { [key: number]: string } = {
    0: t.daySun,
    1: t.dayMon,
    2: t.dayTue,
    3: t.dayWed,
    4: t.dayThu,
    5: t.dayFri,
    6: t.daySat,
  };

  const shiftTemplateRegister = register('shift_template');

  // Image Upload Handler
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      if (!event.target.files || event.target.files.length === 0) return;
      
      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('employee-photos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('employee-photos')
        .getPublicUrl(filePath);

      // We need to store this URL to save it with the employee record
      // Since photo_url isn't in the form schema as a controlled field yet, we can register it or handle it separately.
      // Better to use setValue if we add it to schema or just use a state if it's outside.
      // But wait, employeeSchema doesn't strictly enforce photo_url existence in validation but it is in type.
      // I should update schema to include photo_url or just handle it.
      // Let's assume we want to save it. I'll add a hidden input or just manage it in state to merge on submit.
      
      // For now, let's update a local state or ref, but easier to use setValue if I add it to the form.
      // I'll add it to the form logic.
      setUploadedPhotoUrl(publicUrl);
      
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Error uploading image');
    } finally {
      setUploading(false);
    }
  };
  
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string | null>(null);

  const fetchOpenTimeLogs = async () => {
    const { data, error } = await supabase
      .from('employee_time_logs')
      .select('id, employee_id, clock_in_at, clock_out_at, location_id')
      .is('clock_out_at', null);
    if (error) throw error;
    const map: Record<string, EmployeeTimeLog> = {};
    (data || []).forEach(log => {
      map[log.employee_id] = log as EmployeeTimeLog;
    });
    setOpenTimeLogs(map);
  };

  const fetchDailyAttendance = async () => {
    const { data, error } = await supabase
      .from('employee_daily_attendance')
      .select('*');
    if (error) throw error;
    setDailyAttendance((data || []) as DailyAttendanceRow[]);
  };

  const fetchSystemSettings = async () => {
    const { data, error } = await supabase
      .from('system_settings')
      .select('*')
      .single();
    if (error) throw error;
    if (data) {
      setSystemSettings((prev: SystemSettings) => ({ ...prev, ...data }));
    }
  };

  const fetchSalaryAdvances = async (employeeId: string) => {
    const { data, error } = await supabase
      .from('employee_salary_advances')
      .select('*')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    const advances = (data || []) as SalaryAdvance[];
    setSalaryAdvances(advances);
    return advances;
  };

  const fetchSalaryAdvancePayments = async (employeeId: string) => {
    const { data, error } = await supabase
      .from('employee_salary_advance_payments')
      .select('*')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    const payments = (data || []) as SalaryAdvancePayment[];
    setSalaryAdvancePayments(payments);
    return payments;
  };

  const fetchCalendarLogs = async (employeeId: string, monthValue: string) => {
    if (!employeeId) {
      setCalendarLogs([]);
      return;
    }
    const [year, month] = monthValue.split('-').map(Number);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);
    const { data, error } = await supabase
      .from('employee_time_logs')
      .select('id, employee_id, clock_in_at, clock_out_at')
      .eq('employee_id', employeeId)
      .gte('clock_in_at', start.toISOString())
      .lt('clock_in_at', end.toISOString());
    if (error) throw error;
    setCalendarLogs((data || []) as EmployeeTimeLog[]);
  };

  const fetchReportLogs = async (period: 'daily' | 'weekly' | 'monthly', dateString: string) => {
    const { start, end } = getRangeForPeriod(period, dateString);
    const { data, error } = await supabase
      .from('employee_time_logs')
      .select('id, employee_id, clock_in_at, clock_out_at')
      .gte('clock_in_at', start.toISOString())
      .lte('clock_in_at', end.toISOString());
    if (error) throw error;
    setReportLogs((data || []) as EmployeeTimeLog[]);
  };

  const fetchPayrollLogs = async (monthValue: string) => {
    const { start, end } = getRangeForPeriod('monthly', `${monthValue}-01`);
    const { data, error } = await supabase
      .from('employee_time_logs')
      .select('id, employee_id, clock_in_at, clock_out_at')
      .gte('clock_in_at', start.toISOString())
      .lte('clock_in_at', end.toISOString());
    if (error) throw error;
    setPayrollLogs((data || []) as EmployeeTimeLog[]);
  };

  const fetchPayrollPayments = async (monthValue: string) => {
    const { start, end } = getRangeForPeriod('monthly', `${monthValue}-01`);
    const { data, error } = await supabase
      .from('employee_salary_advance_payments')
      .select('*')
      .gte('paid_at', start.toISOString().slice(0, 10))
      .lte('paid_at', end.toISOString().slice(0, 10));
    if (error) throw error;
    setPayrollPayments((data || []) as SalaryAdvancePayment[]);
  };

  const fetchPayrollApproval = async (monthValue: string) => {
    const { data, error } = await supabase
      .from('payroll_approvals')
      .select('*')
      .eq('month', monthValue)
      .maybeSingle();
    if (error) throw error;
    setPayrollApproval((data || null) as PayrollApproval | null);
  };

  const fetchPerformanceKpis = async (role?: UserRole) => {
    if (!role) {
      setPerformanceKpis([]);
      return;
    }
    setPerformanceKpisLoading(true);
    try {
      const { data, error } = await supabase
        .from('performance_kpis')
        .select('*')
        .eq('role', role)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPerformanceKpis((data || []) as PerformanceKpi[]);
    } finally {
      setPerformanceKpisLoading(false);
    }
  };

  const fetchReviewRoleKpis = async (role?: UserRole) => {
    if (!role) {
      setReviewRoleKpis([]);
      return;
    }
    setReviewRoleKpisLoading(true);
    try {
      const { data, error } = await supabase
        .from('performance_kpis')
        .select('*')
        .eq('role', role)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setReviewRoleKpis((data || []) as PerformanceKpi[]);
    } finally {
      setReviewRoleKpisLoading(false);
    }
  };

  const fetchPerformanceCategories = async (role?: UserRole) => {
    if (!role) {
      setPerformanceCategories([]);
      return;
    }
    setPerformanceCategoriesLoading(true);
    try {
      const { data, error } = await supabase
        .from('performance_review_categories')
        .select('*')
        .eq('role', role)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPerformanceCategories((data || []) as PerformanceReviewCategory[]);
    } finally {
      setPerformanceCategoriesLoading(false);
    }
  };

  const fetchPerformanceBonusRules = async (role?: UserRole) => {
    if (!role) {
      setPerformanceBonusRules([]);
      return;
    }
    setPerformanceBonusRulesLoading(true);
    try {
      const { data, error } = await supabase
        .from('performance_bonus_rules')
        .select('*')
        .eq('role', role)
        .order('min_score', { ascending: true });
      if (error) throw error;
      setPerformanceBonusRules((data || []) as PerformanceBonusRule[]);
    } finally {
      setPerformanceBonusRulesLoading(false);
    }
  };

  const fetchPerformanceReviews = async (employeeId?: string) => {
    if (!employeeId) {
      setPerformanceReviews([]);
      return;
    }
    setPerformanceReviewsLoading(true);
    try {
      const { data, error } = await supabase
        .from('performance_reviews')
        .select('*')
        .eq('employee_id', employeeId)
        .order('period_start', { ascending: false })
        .limit(12);
      if (error) throw error;
      setPerformanceReviews((data || []) as PerformanceReview[]);
    } finally {
      setPerformanceReviewsLoading(false);
    }
  };

  const loadScheduleCalendar = async (employeeId: string) => {
    const employee = employees.find((emp: Employee) => emp.id === employeeId);
    if (!employee) {
      setScheduleCalendar([]);
      return;
    }
    try {
      setScheduleCalendarLoading(true);
      const { data, error } = await supabase
        .from('employee_weekly_schedules')
        .select('day_of_week, is_working, start_time, end_time, break_minutes, grace_minutes')
        .eq('employee_id', employeeId);
      if (error) throw error;
      const defaults = buildDefaultWeeklySchedule(employee);
      const byDay = new Map((data || []).map(row => [row.day_of_week, row]));
      const merged = defaults.map(day => {
        const row = byDay.get(day.day_of_week);
        if (!row) return day;
        return {
          day_of_week: day.day_of_week,
          is_working: row.is_working ?? true,
          start_time: row.start_time ?? day.start_time,
          end_time: row.end_time ?? day.end_time,
          break_minutes: row.break_minutes ?? day.break_minutes,
          grace_minutes: row.grace_minutes ?? day.grace_minutes
        };
      });
      setScheduleCalendar(merged);
    } catch (error) {
      setScheduleCalendar(buildDefaultWeeklySchedule(employee));
    } finally {
      setScheduleCalendarLoading(false);
    }
  };

  const buildDefaultWeeklySchedule = (employee: Employee): WeeklyScheduleDay[] => {
    return WEEK_DAYS.map((_, dayIndex) => ({
      day_of_week: dayIndex,
      is_working: true,
      start_time: employee.shift_start_time || '',
      end_time: employee.shift_end_time || '',
      break_minutes: employee.shift_break_minutes ?? 0,
      grace_minutes: employee.shift_grace_minutes ?? 15
    }));
  };

  const loadWeeklySchedule = async (employee: Employee) => {
    try {
      setWeeklyScheduleLoading(true);
      const { data, error } = await supabase
        .from('employee_weekly_schedules')
        .select('day_of_week, is_working, start_time, end_time, break_minutes, grace_minutes')
        .eq('employee_id', employee.id);
      if (error) throw error;
      const defaults = buildDefaultWeeklySchedule(employee);
      const byDay = new Map((data || []).map(row => [row.day_of_week, row]));
      const merged = defaults.map(day => {
        const row = byDay.get(day.day_of_week);
        if (!row) return day;
        return {
          day_of_week: day.day_of_week,
          is_working: row.is_working ?? true,
          start_time: row.start_time ?? day.start_time,
          end_time: row.end_time ?? day.end_time,
          break_minutes: row.break_minutes ?? day.break_minutes,
          grace_minutes: row.grace_minutes ?? day.grace_minutes
        };
      });
      setWeeklySchedule(merged);
    } catch (error) {
      setWeeklySchedule(buildDefaultWeeklySchedule(employee));
    } finally {
      setWeeklyScheduleLoading(false);
    }
  };

  const updateWeeklySchedule = (dayIndex: number, changes: Partial<WeeklyScheduleDay>) => {
    setWeeklySchedule((prev: WeeklyScheduleDay[]) => prev.map((day: WeeklyScheduleDay, index: number) => (index === dayIndex ? { ...day, ...changes } : day)));
  };

  const saveWeeklySchedule = async () => {
    if (!editingEmployee) return;
    try {
      setWeeklyScheduleSaving(true);
      const rows = weeklySchedule.map((day: WeeklyScheduleDay) => ({
        employee_id: editingEmployee.id,
        day_of_week: day.day_of_week,
        is_working: day.is_working,
        start_time: day.is_working ? day.start_time || null : null,
        end_time: day.is_working ? day.end_time || null : null,
        break_minutes: day.is_working ? Number(day.break_minutes || 0) : 0,
        grace_minutes: day.is_working ? Number(day.grace_minutes || 15) : 15
      }));
      const { error } = await supabase
        .from('employee_weekly_schedules')
        .upsert(rows, { onConflict: 'employee_id,day_of_week' });
      if (error) throw error;
    } catch (error) {
      alert('Error saving weekly schedule');
    } finally {
      setWeeklyScheduleSaving(false);
    }
  };

  const toggleBulkScheduleEmployee = (employeeId: string) => {
    setBulkScheduleEmployeeIds((prev: string[]) => 
      prev.includes(employeeId) ? prev.filter((id: string) => id !== employeeId) : [...prev, employeeId]
    );
  };

  const selectAllBulkScheduleEmployees = () => {
    setBulkScheduleEmployeeIds(employees.map(emp => emp.id));
  };

  const clearBulkScheduleEmployees = () => {
    setBulkScheduleEmployeeIds([]);
  };

  const applyBulkSchedule = async () => {
    if (!scheduleCalendar.length) {
      alert('Select an employee with a saved schedule to apply.');
      return;
    }
    if (!bulkScheduleEmployeeIds.length) {
      alert('Select at least one employee.');
      return;
    }
    try {
      setBulkScheduleSaving(true);
      const rows = bulkScheduleEmployeeIds.flatMap(employeeId =>
        scheduleCalendar.map(day => ({
          employee_id: employeeId,
          day_of_week: day.day_of_week,
          is_working: day.is_working,
          start_time: day.is_working ? day.start_time || null : null,
          end_time: day.is_working ? day.end_time || null : null,
          break_minutes: day.is_working ? Number(day.break_minutes || 0) : 0,
          grace_minutes: day.is_working ? Number(day.grace_minutes || 15) : 15
        }))
      );
      const { error } = await supabase
        .from('employee_weekly_schedules')
        .upsert(rows, { onConflict: 'employee_id,day_of_week' });
      if (error) throw error;
      setBulkScheduleOpen(false);
      clearBulkScheduleEmployees();
    } catch (error: any) {
      alert('Failed to apply schedule. ' + (error?.message || 'Please try again.'));
    } finally {
      setBulkScheduleSaving(false);
    }
  };

  const loadScheduleOverrides = async (employeeId: string, start: Date, end: Date) => {
    if (!employeeId) {
      setScheduleOverrides({});
      return;
    }
    const { data, error } = await supabase
      .from('employee_schedule_overrides')
      .select('employee_id, shift_date, is_working, start_time, end_time, break_minutes, grace_minutes, swap_request_id')
      .eq('employee_id', employeeId)
      .gte('shift_date', formatDateKey(start))
      .lte('shift_date', formatDateKey(end));
    if (error) throw error;
    const map: Record<string, WeeklyScheduleDay> = {};
    (data || []).forEach(row => {
      const date = new Date(`${row.shift_date}T00:00:00`);
      map[row.shift_date] = {
        day_of_week: date.getDay(),
        is_working: row.is_working ?? true,
        start_time: row.start_time ?? '',
        end_time: row.end_time ?? '',
        break_minutes: row.break_minutes ?? 0,
        grace_minutes: row.grace_minutes ?? 15
      };
    });
    setScheduleOverrides(map);
  };

  const fetchSwapRequests = async () => {
    try {
      setSwapRequestsLoading(true);
      const { data, error } = await supabase
        .from('employee_shift_swap_requests')
        .select('id, requester_id, target_employee_id, shift_date, reason, status, manager_id, manager_comment, created_at, requester:requester_id(first_name_en,last_name_en), target:target_employee_id(first_name_en,last_name_en)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const mapped = (data || []).map((row: any) => ({
        ...row,
        requester: Array.isArray(row.requester) ? row.requester[0] : row.requester,
        target: Array.isArray(row.target) ? row.target[0] : row.target
      })) as ShiftSwapRequest[];
      setSwapRequests(mapped as unknown as ShiftSwapRequest[]);
    } catch (error) {
      setSwapRequests([]);
    } finally {
      setSwapRequestsLoading(false);
    }
  };

  const resolveScheduleForSwap = async (employeeId: string, shiftDate: string) => {
    const date = new Date(`${shiftDate}T00:00:00`);
    const employee = employees.find((emp: Employee) => emp.id === employeeId);
    const base: WeeklyScheduleDay = {
      day_of_week: date.getDay(),
      is_working: !!(employee?.shift_start_time && employee?.shift_end_time),
      start_time: employee?.shift_start_time || '',
      end_time: employee?.shift_end_time || '',
      break_minutes: employee?.shift_break_minutes ?? 0,
      grace_minutes: employee?.shift_grace_minutes ?? 15
    };
    const { data: overrideData, error: overrideError } = await supabase
      .from('employee_schedule_overrides')
      .select('is_working, start_time, end_time, break_minutes, grace_minutes')
      .eq('employee_id', employeeId)
      .eq('shift_date', shiftDate);
    if (overrideError) throw overrideError;
    const override = (overrideData || [])[0];
    if (override) {
      return {
        ...base,
        is_working: override.is_working ?? base.is_working,
        start_time: override.start_time ?? base.start_time,
        end_time: override.end_time ?? base.end_time,
        break_minutes: override.break_minutes ?? base.break_minutes,
        grace_minutes: override.grace_minutes ?? base.grace_minutes
      };
    }
    const { data: weeklyData, error: weeklyError } = await supabase
      .from('employee_weekly_schedules')
      .select('is_working, start_time, end_time, break_minutes, grace_minutes')
      .eq('employee_id', employeeId)
      .eq('day_of_week', date.getDay());
    if (weeklyError) throw weeklyError;
    const weekly = (weeklyData || [])[0];
    if (weekly) {
      return {
        ...base,
        is_working: weekly.is_working ?? base.is_working,
        start_time: weekly.start_time ?? base.start_time,
        end_time: weekly.end_time ?? base.end_time,
        break_minutes: weekly.break_minutes ?? base.break_minutes,
        grace_minutes: weekly.grace_minutes ?? base.grace_minutes
      };
    }
    return base;
  };

  const submitSwapRequest = async () => {
    if (!swapRequesterId || !swapTargetId) {
      alert('Select both employees.');
      return;
    }
    if (swapRequesterId === swapTargetId) {
      alert(t.requesterTargetDifferent);
      return;
    }
    if (!swapDate) {
      alert('Select a date.');
      return;
    }
    try {
      setSwapRequestSubmitting(true);
      const { error } = await supabase
        .from('employee_shift_swap_requests')
        .insert({
          requester_id: swapRequesterId,
          target_employee_id: swapTargetId,
          shift_date: swapDate,
          reason: swapReason || null
        });
      if (error) throw error;
      setSwapReason('');
      await fetchSwapRequests();
    } catch (error: any) {
      alert('Failed to submit request. ' + (error?.message || 'Please try again.'));
    } finally {
      setSwapRequestSubmitting(false);
    }
  };

  const approveSwapRequest = async (request: ShiftSwapRequest) => {
    if (!user) return;
    try {
      setSwapRequestsLoading(true);
      const requesterSchedule = await resolveScheduleForSwap(request.requester_id, request.shift_date);
      const targetSchedule = await resolveScheduleForSwap(request.target_employee_id, request.shift_date);
      const overrides = [
        {
          employee_id: request.requester_id,
          shift_date: request.shift_date,
          is_working: targetSchedule.is_working,
          start_time: targetSchedule.is_working ? targetSchedule.start_time || null : null,
          end_time: targetSchedule.is_working ? targetSchedule.end_time || null : null,
          break_minutes: targetSchedule.is_working ? Number(targetSchedule.break_minutes || 0) : 0,
          grace_minutes: targetSchedule.is_working ? Number(targetSchedule.grace_minutes || 15) : 15,
          swap_request_id: request.id
        },
        {
          employee_id: request.target_employee_id,
          shift_date: request.shift_date,
          is_working: requesterSchedule.is_working,
          start_time: requesterSchedule.is_working ? requesterSchedule.start_time || null : null,
          end_time: requesterSchedule.is_working ? requesterSchedule.end_time || null : null,
          break_minutes: requesterSchedule.is_working ? Number(requesterSchedule.break_minutes || 0) : 0,
          grace_minutes: requesterSchedule.is_working ? Number(requesterSchedule.grace_minutes || 15) : 15,
          swap_request_id: request.id
        }
      ];
      const { error: overrideError } = await supabase
        .from('employee_schedule_overrides')
        .upsert(overrides, { onConflict: 'employee_id,shift_date' });
      if (overrideError) throw overrideError;
      const { error } = await supabase
        .from('employee_shift_swap_requests')
        .update({
          status: 'approved',
          manager_id: user.id,
          manager_comment: swapReviewNotes[request.id] || null
        })
        .eq('id', request.id);
      if (error) throw error;
      await fetchSwapRequests();
      if (calendarEmployeeId) {
        const dateString = scheduleViewMode === 'weekly' ? scheduleWeekDate : `${calendarMonth}-01`;
        const { start, end } = getRangeForPeriod(scheduleViewMode === 'weekly' ? 'weekly' : 'monthly', dateString);
        await loadScheduleOverrides(calendarEmployeeId, start, end);
      }
    } catch (error: any) {
      alert('Failed to approve request. ' + (error?.message || 'Please try again.'));
    } finally {
      setSwapRequestsLoading(false);
    }
  };

  const rejectSwapRequest = async (request: ShiftSwapRequest) => {
    if (!user) return;
    try {
      setSwapRequestsLoading(true);
      const { error } = await supabase
        .from('employee_shift_swap_requests')
        .update({
          status: 'rejected',
          manager_id: user.id,
          manager_comment: swapReviewNotes[request.id] || null
        })
        .eq('id', request.id);
      if (error) throw error;
      await fetchSwapRequests();
    } catch (error: any) {
      alert('Failed to reject request. ' + (error?.message || 'Please try again.'));
    } finally {
      setSwapRequestsLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('employees').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setEmployees(data || []);
      await fetchOpenTimeLogs();
      await fetchDailyAttendance();
    } catch (err) {
      console.error('Error fetching employees:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSalaryAdvance = async (event?: React.SyntheticEvent) => {
    event?.preventDefault();
    if (!editingEmployee) return;
    setSalaryAdvanceSaving(true);
    try {
      const payload = {
        employee_id: editingEmployee.id,
        amount: Number(salaryAdvanceForm.amount),
        requested_at: salaryAdvanceForm.requested_at || new Date().toISOString().slice(0, 10),
        reason: salaryAdvanceForm.reason || null,
        status: 'open',
        monthly_deduction: Number(salaryAdvanceForm.monthly_deduction || 0),
        created_by: user?.id
      };
      const { data, error } = await supabase
        .from('employee_salary_advances')
        .insert([payload])
        .select()
        .single();
      if (error) throw error;
      await fetchSalaryAdvances(editingEmployee.id);
      if (data?.id && !salaryAdvancePaymentForm.advance_id) {
        setSalaryAdvancePaymentForm(prev => ({ ...prev, advance_id: data.id }));
      }
      setSalaryAdvanceForm({
        amount: '',
        monthly_deduction: '',
        requested_at: new Date().toISOString().slice(0, 10),
        reason: ''
      });
    } catch (error: any) {
      alert('Failed to add salary advance. ' + (error?.message || 'Please try again.'));
    } finally {
      setSalaryAdvanceSaving(false);
    }
  };

  const handleCreateSalaryAdvancePayment = async (event?: React.SyntheticEvent) => {
    event?.preventDefault();
    if (!editingEmployee || !salaryAdvancePaymentForm.advance_id) return;
    setSalaryAdvancePaymentSaving(true);
    try {
      const payload = {
        advance_id: salaryAdvancePaymentForm.advance_id,
        employee_id: editingEmployee.id,
        amount: Number(salaryAdvancePaymentForm.amount),
        paid_at: salaryAdvancePaymentForm.paid_at || new Date().toISOString().slice(0, 10),
        notes: salaryAdvancePaymentForm.notes || null,
        created_by: user?.id
      };
      const { error } = await supabase
        .from('employee_salary_advance_payments')
        .insert([payload]);
      if (error) throw error;
      const payments = await fetchSalaryAdvancePayments(editingEmployee.id);
      const advances = await fetchSalaryAdvances(editingEmployee.id);
      const paidTotal = payments
        .filter(payment => payment.advance_id === payload.advance_id)
        .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
      const advance = advances.find(item => item.id === payload.advance_id);
      if (advance && paidTotal >= Number(advance.amount) && advance.status !== 'closed') {
        const { error: updateError } = await supabase
          .from('employee_salary_advances')
          .update({ status: 'closed' })
          .eq('id', advance.id);
        if (updateError) throw updateError;
        await fetchSalaryAdvances(editingEmployee.id);
      }
      setSalaryAdvancePaymentForm((prev: SalaryAdvancePaymentFormValues) => ({
        ...prev,
        amount: '',
        paid_at: new Date().toISOString().slice(0, 10),
        notes: ''
      }));
    } catch (error: any) {
      alert('Failed to record payment. ' + (error?.message || 'Please try again.'));
    } finally {
      setSalaryAdvancePaymentSaving(false);
    }
  };

  const fetchLocations = async () => {
    const { data } = await supabase.from('locations').select('*').eq('type', 'BRANCH').eq('is_active', true);
    if (data) setLocations(data);
  };

  const fetchBranchTransfers = async () => {
    const { data } = await supabase
      .from('employee_branch_transfers')
      .select('id,employee_id,from_location_id,to_location_id,transfer_type,status,reason,start_at,end_at,requested_by_name,requested_at,approved_by_name,approved_at,created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (data) setBranchTransfers(data as any);
  };

  const fetchBranchStaffingTargets = async () => {
    const { data } = await supabase
      .from('branch_staffing_targets')
      .select('id,location_id,role,min_required');
    if (data) setBranchStaffingTargets(data as any);
  };

  useEffect(() => {
    fetchEmployees();
    fetchLocations();
    fetchBranchTransfers().catch(() => {});
    fetchBranchStaffingTargets().catch(() => {});
    fetchSystemSettings().catch(() => {});
  }, []);

  useEffect(() => {
    if (employees.length && !calendarEmployeeId) {
      setCalendarEmployeeId(employees[0].id);
    }
  }, [employees, calendarEmployeeId]);

  useEffect(() => {
    if (employees.length && !reviewEmployeeId) {
      setReviewEmployeeId(employees[0].id);
    }
  }, [employees, reviewEmployeeId]);

  useEffect(() => {
    fetchCalendarLogs(calendarEmployeeId, calendarMonth).catch(() => {});
  }, [calendarEmployeeId, calendarMonth]);

  useEffect(() => {
    fetchReportLogs(reportPeriod, reportDate).catch(() => {});
  }, [reportPeriod, reportDate]);

  useEffect(() => {
    fetchPerformanceKpis(kpiForm.role).catch(() => {});
  }, [kpiForm.role]);

  useEffect(() => {
    const reviewEmployee = employees.find((emp: Employee) => emp.id === reviewEmployeeId);
    fetchReviewRoleKpis(reviewEmployee?.role).catch(() => {});
    fetchPerformanceCategories(reviewEmployee?.role).catch(() => {});
    fetchPerformanceBonusRules(reviewEmployee?.role).catch(() => {});
    fetchPerformanceReviews(reviewEmployeeId).catch(() => {});
    setReviewKpiValues({});
    setReviewCategoryRatings({});
  }, [employees, reviewEmployeeId]);

  useEffect(() => {
    fetchPerformanceCategories(categoryForm.role).catch(() => {});
  }, [categoryForm.role]);

  useEffect(() => {
    fetchPerformanceBonusRules(bonusRuleForm.role).catch(() => {});
  }, [bonusRuleForm.role]);

  useEffect(() => {
    let isMounted = true;
    const loadPayroll = async () => {
      try {
        setPayrollLoading(true);
        await Promise.all([
          fetchPayrollLogs(payrollMonth),
          fetchPayrollPayments(payrollMonth),
          fetchPayrollApproval(payrollMonth)
        ]);
      } catch (error) {
        if (isMounted) {
          setPayrollLogs([]);
          setPayrollPayments([]);
          setPayrollApproval(null);
        }
      } finally {
        if (isMounted) {
          setPayrollLoading(false);
        }
      }
    };
    loadPayroll();
    return () => {
      isMounted = false;
    };
  }, [payrollMonth]);

  useEffect(() => {
    if (calendarEmployeeId) {
      loadScheduleCalendar(calendarEmployeeId).catch(() => {});
    }
  }, [calendarEmployeeId, employees]);

  useEffect(() => {
    if (employees.length) {
      if (!swapRequesterId) setSwapRequesterId(employees[0].id);
      if (!swapTargetId) setSwapTargetId((employees[1] || employees[0]).id);
    }
  }, [employees, swapRequesterId, swapTargetId]);

  useEffect(() => {
    const dateString = scheduleViewMode === 'weekly' ? scheduleWeekDate : `${calendarMonth}-01`;
    if (!calendarEmployeeId) {
      setScheduleOverrides({});
      return;
    }
    const { start, end } = getRangeForPeriod(scheduleViewMode === 'weekly' ? 'weekly' : 'monthly', dateString);
    loadScheduleOverrides(calendarEmployeeId, start, end).catch(() => {});
  }, [calendarEmployeeId, scheduleViewMode, scheduleWeekDate, calendarMonth]);

  useEffect(() => {
    fetchSwapRequests().catch(() => {});
  }, []);

  useEffect(() => {
    if (editingEmployee) {
      loadWeeklySchedule(editingEmployee).catch(() => {});
      fetchSalaryAdvances(editingEmployee.id).catch(() => {});
      fetchSalaryAdvancePayments(editingEmployee.id).catch(() => {});
    } else {
      setWeeklySchedule([]);
      setSalaryAdvances([]);
      setSalaryAdvancePayments([]);
    }
  }, [editingEmployee]);

  useEffect(() => {
    if (!salaryAdvancePaymentForm.advance_id && salaryAdvances.length) {
      const openAdvance = salaryAdvances.find((advance: SalaryAdvance) => advance.status === 'open') || salaryAdvances[0];
      setSalaryAdvancePaymentForm((prev: SalaryAdvancePaymentFormValues) => ({ ...prev, advance_id: openAdvance.id }));
    }
  }, [salaryAdvances, salaryAdvancePaymentForm.advance_id]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchOpenTimeLogs().catch(() => {});
      fetchDailyAttendance().catch(() => {});
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Handle Form Submit
  const normalizeEmptyString = (value?: string | null) => {
    if (value === undefined || value === null) return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  };

  const toNumberOrDefault = (value: unknown, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const onSubmit = async (data: EmployeeFormValues) => {
    try {
      setLoading(true);
      const salaryBase = toNumberOrDefault(data.salary_base, 0);
      const salaryAllowances = toNumberOrDefault(data.salary_allowances, 0);
      const shiftBreakMinutes = toNumberOrDefault(data.shift_break_minutes, 0);
      const shiftGraceMinutes = toNumberOrDefault(data.shift_grace_minutes, 15);

      const payload = {
        ...data,
        first_name_en: data.first_name_en.trim(),
        last_name_en: data.last_name_en.trim(),
        first_name_ar: normalizeEmptyString(data.first_name_ar),
        last_name_ar: normalizeEmptyString(data.last_name_ar),
        national_id: normalizeEmptyString(data.national_id),
        nationality: normalizeEmptyString(data.nationality),
        dob: normalizeEmptyString(data.dob),
        gender: data.gender ?? null,
        marital_status: normalizeEmptyString(data.marital_status),
        phone: data.phone.trim(),
        email: data.email.trim(),
        emergency_contact_name: normalizeEmptyString(data.emergency_contact_name),
        emergency_contact_phone: normalizeEmptyString(data.emergency_contact_phone),
        department: normalizeEmptyString(data.department),
        position: normalizeEmptyString(data.position),
        manager_id: normalizeEmptyString(data.manager_id),
        qid: normalizeEmptyString(data.qid),
        visa_status: normalizeEmptyString(data.visa_status),
        visa_expiry: normalizeEmptyString(data.visa_expiry),
        health_card_expiry: normalizeEmptyString(data.health_card_expiry),
        shift_template: normalizeEmptyString(data.shift_template),
        shift_start_time: normalizeEmptyString(data.shift_start_time),
        shift_end_time: normalizeEmptyString(data.shift_end_time),
        employee_pin: normalizeEmptyString(data.employee_pin),
        location_id: normalizeEmptyString(data.location_id),
        is_on_leave: data.is_on_leave ?? false,
        // employee_id is auto-generated by DB trigger for new records
        ...(editingEmployee ? { employee_id: editingEmployee.employee_id } : {}), 
        created_by: user?.id,
        photo_url: uploadedPhotoUrl || editingEmployee?.photo_url,
        salary_base: salaryBase,
        salary_allowances: salaryAllowances,
        shift_break_minutes: shiftBreakMinutes,
        shift_grace_minutes: shiftGraceMinutes
      };

      if (editingEmployee) {
        const { error } = await supabase.from('employees').update(payload).eq('id', editingEmployee.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('employees').insert([payload]);
        if (error) throw error;
      }

      await fetchEmployees();
      setShowForm(false);
      setEditingEmployee(null);
      setUploadedPhotoUrl(null);
      reset();
    } catch (err: any) {
      console.error('Error saving employee:', err);
      if (err.code === '23505') { // Postgres unique constraint violation code
        if (err.message.includes('phone')) {
          alert('Error: Phone number already exists.');
        } else if (err.message.includes('qid')) {
          alert('Error: QID already exists.');
        } else if (err.message.includes('email')) {
          alert('Error: Email already exists.');
        } else {
          alert('Error: Duplicate entry detected (Phone, Email, or QID).');
        }
      } else {
        const details = [err?.message, err?.details, err?.hint].filter(Boolean).join(' | ');
        const code = err?.code ? `(${err.code}) ` : '';
        alert('Failed to save employee. ' + (code + (details || 'Please check inputs and try again.')));
      }
    } finally {
      setLoading(false);
    }
  };

  const onInvalid = (errors: any) => {
    const tabs = ['personal', 'contact', 'employment', 'financial', 'schedule'];
    const errorTabs = tabs.filter(tab => hasTabErrors(tab as any));
    if (errorTabs.length > 0) {
      alert(`Please check errors in the following tabs: ${errorTabs.map(tab => tab.charAt(0).toUpperCase() + tab.slice(1)).join(', ')}`);
    }
  };

  const setClocking = (employeeId: string, value: boolean) => {
    setClockingEmployeeIds((prev: Record<string, boolean>) => ({ ...prev, [employeeId]: value }));
  };

  const getActiveTemporaryBranch = (employeeId: string, at: Date) => {
    const atMs = at.getTime();
    const row = branchTransfers.find(t =>
      t.employee_id === employeeId &&
      t.transfer_type === 'TEMPORARY' &&
      t.status === 'APPROVED' &&
      t.start_at &&
      t.end_at &&
      new Date(t.start_at).getTime() <= atMs &&
      new Date(t.end_at).getTime() >= atMs
    );
    return row ? row.to_location_id : null;
  };

  const employeeAllowedAtBranch = (employee: Employee, locationId: string, at: Date) => {
    if (!locationId) return false;
    if (employee.location_id && employee.location_id === locationId) return true;
    return getActiveTemporaryBranch(employee.id, at) === locationId;
  };

  const handleClockIn = async (employee: Employee) => {
    if (!user?.id) return;
    if (openTimeLogs[employee.id]) {
      alert('Clock out is required before clocking in again.');
      return;
    }
    try {
      setClocking(employee.id, true);
      const now = new Date().toISOString();
      const clockLocationId = (user as any)?.location_id || employee.location_id || null;
      if (clockLocationId && !employeeAllowedAtBranch(employee, clockLocationId, new Date())) {
        alert(t.actionFailed);
        return;
      }
      const { error } = await supabase.from('employee_time_logs').insert([
        { employee_id: employee.id, clock_in_at: now, created_by: user.id, location_id: clockLocationId }
      ]);
      if (error) throw error;
      await fetchOpenTimeLogs();
      await fetchDailyAttendance();
    } catch (err: any) {
      console.error('Error clocking in:', err);
      if (err.code === '23505') {
        alert('Clock out is required before clocking in again.');
      } else if (typeof err.message === 'string' && err.message.toLowerCase().includes('overlapping')) {
        alert('Time log overlaps an existing shift.');
      } else if (typeof err.message === 'string' && err.message.includes('EMPLOYEE_NOT_ASSIGNED_TO_BRANCH')) {
        alert(t.actionFailed);
      } else if (typeof err.message === 'string' && err.message.includes('EMPLOYEE_NO_HOME_BRANCH')) {
        alert(t.actionFailed);
      } else {
        alert('Failed to clock in. ' + (err.message || 'Please try again.'));
      }
    } finally {
      setClocking(employee.id, false);
    }
  };

  const handleClockOut = async (employee: Employee) => {
    const openLog = openTimeLogs[employee.id];
    if (!openLog) return;
    try {
      setClocking(employee.id, true);
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('employee_time_logs')
        .update({ clock_out_at: now })
        .eq('id', openLog.id);
      if (error) throw error;
      await fetchOpenTimeLogs();
      await fetchDailyAttendance();
    } catch (err: any) {
      console.error('Error clocking out:', err);
      alert('Failed to clock out. ' + (err.message || 'Please try again.'));
    } finally {
      setClocking(employee.id, false);
    }
  };

  const isPrivileged = user?.role === UserRole.ADMIN || user?.role === UserRole.MANAGER;

  const openManualEntry = (employee: Employee) => {
    setManualEntryEmployee(employee);
    setManualClockInAt('');
    setManualClockOutAt('');
    setManualReason('');
  };

  const closeManualEntry = () => {
    setManualEntryEmployee(null);
    setManualClockInAt('');
    setManualClockOutAt('');
    setManualReason('');
  };

  const handleManualEntrySave = async () => {
    if (!user?.id || !manualEntryEmployee) return;
    if (!manualClockInAt || !manualClockOutAt) {
      alert('Clock in and clock out times are required.');
      return;
    }
    if (!manualReason.trim()) {
      alert(t.manualReasonRequired);
      return;
    }
    const clockInIso = new Date(manualClockInAt).toISOString();
    const clockOutIso = new Date(manualClockOutAt).toISOString();
    if (new Date(clockOutIso) <= new Date(clockInIso)) {
      alert('Clock out time must be after clock in time.');
      return;
    }
    try {
      setManualSubmitting(true);
      const clockLocationId = (user as any)?.location_id || manualEntryEmployee.location_id || null;
      if (clockLocationId && !employeeAllowedAtBranch(manualEntryEmployee, clockLocationId, new Date(clockInIso))) {
        alert(t.actionFailed);
        return;
      }
      const { error } = await supabase.from('employee_time_logs').insert([
        {
          employee_id: manualEntryEmployee.id,
          clock_in_at: clockInIso,
          clock_out_at: clockOutIso,
          created_by: user.id,
          location_id: clockLocationId,
          is_manual: true,
          manual_reason: manualReason.trim()
        }
      ]);
      if (error) throw error;
      await fetchOpenTimeLogs();
      await fetchDailyAttendance();
      closeManualEntry();
    } catch (err: any) {
      console.error('Error saving manual entry:', err);
      if (typeof err.message === 'string' && err.message.toLowerCase().includes('overlapping')) {
        alert('Time log overlaps an existing shift.');
      } else if (typeof err.message === 'string' && err.message.includes('EMPLOYEE_NOT_ASSIGNED_TO_BRANCH')) {
        alert(t.actionFailed);
      } else {
        alert('Failed to save manual entry. ' + (err.message || 'Please try again.'));
      }
    } finally {
      setManualSubmitting(false);
    }
  };

  const handleQuickClockIn = async () => {
    const value = quickClockValue.trim();
    if (!value) {
      alert('Enter employee ID or PIN.');
      return;
    }
    try {
      setQuickClocking(true);
      const lowerValue = value.toLowerCase();
      const employee =
        employees.find(e => e.employee_id.toLowerCase() === lowerValue) ||
        employees.find(e => e.employee_pin === value);
      if (!employee) {
        alert('No matching employee found.');
        return;
      }
      await handleClockIn(employee);
      setQuickClockValue('');
    } finally {
      setQuickClocking(false);
    }
  };

  // Calculations
  const calculateAge = (dobString?: string) => {
    if (!dobString) return 'N/A';
    const dob = new Date(dobString);
    const diff = Date.now() - dob.getTime();
    const ageDate = new Date(diff);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  };

  const calculateTenure = (hireDateString: string) => {
    if (!hireDateString) return 'N/A';
    const hireDate = new Date(hireDateString);
    const diff = Date.now() - hireDate.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const years = Math.floor(days / 365);
    const months = Math.floor((days % 365) / 30);
    if (years > 0) return `${years}y ${months}m`;
    return `${months}m`;
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const calculateMonthlyGrossSalary = (base?: number | null, allowances?: number | null) => {
    return (Number(base) || 0) + (Number(allowances) || 0);
  };

  const calculateShiftHours = (startTime?: string | null, endTime?: string | null, breakMinutes?: number | null) => {
    if (!startTime || !endTime) return null;
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);
    if ([startHours, startMinutes, endHours, endMinutes].some(value => Number.isNaN(value))) return null;
    const startTotal = startHours * 60 + startMinutes;
    const endTotal = endHours * 60 + endMinutes;
    const rawMinutes = endTotal >= startTotal ? endTotal - startTotal : 24 * 60 - startTotal + endTotal;
    const breakTotal = Number(breakMinutes) || 0;
    return Math.max(0, (rawMinutes - breakTotal) / 60);
  };

  const calculateHourlyRate = (employee?: Employee | null) => {
    if (!employee) return 0;
    const monthlyGross = calculateMonthlyGrossSalary(employee.salary_base, employee.salary_allowances);
    const shiftHours = calculateShiftHours(employee.shift_start_time, employee.shift_end_time, employee.shift_break_minutes) || 8;
    return monthlyGross / (30 * shiftHours);
  };

  const formatTime = (timestamp?: string | null) => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const toMinutes = (time?: string | null) => {
    if (!time) return null;
    const [hours, minutes] = time.split(':').map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
    return hours * 60 + minutes;
  };

  const isNowWithinShift = (employee: Employee, at: Date) => {
    const template = employee.shift_template ? SHIFT_TEMPLATES[employee.shift_template as ShiftTemplate] : null;
    const start = employee.shift_start_time || template?.start || null;
    const end = employee.shift_end_time || template?.end || null;
    const startM = toMinutes(start);
    const endM = toMinutes(end);
    if (startM === null || endM === null) return false;
    const nowM = at.getHours() * 60 + at.getMinutes();
    if (startM <= endM) return nowM >= startM && nowM <= endM;
    return nowM >= startM || nowM <= endM;
  };

  const branchRoles: UserRole[] = [
    UserRole.MANAGER,
    UserRole.CASHIER,
    UserRole.ROASTER,
    UserRole.WAREHOUSE_STAFF,
    UserRole.HR
  ];

  const getTargetMin = (locationId: string, role: UserRole) => {
    const trow = branchStaffingTargets.find(r => r.location_id === locationId && r.role === role);
    return trow ? Number(trow.min_required) || 0 : 0;
  };

  const upsertTargetMin = async (locationId: string, role: UserRole, minRequired: number) => {
    const payload = { location_id: locationId, role, min_required: Math.max(0, Math.trunc(Number(minRequired) || 0)) };
    const { data, error } = await supabase.from('branch_staffing_targets').upsert(payload, { onConflict: 'location_id,role' }).select('id,location_id,role,min_required');
    if (error) throw error;
    if (data && data[0]) {
      setBranchStaffingTargets(prev => {
        const exists = prev.find(x => x.location_id === locationId && x.role === role);
        if (exists) return prev.map(x => (x.location_id === locationId && x.role === role) ? (data[0] as any) : x);
        return [...prev, data[0] as any];
      });
    }
  };

  const toMinutesFromTimestamp = (timestamp?: string | null) => {
    if (!timestamp) return null;
    const date = new Date(timestamp);
    return date.getHours() * 60 + date.getMinutes();
  };

  const formatDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatMonthLabel = (monthValue: string) => {
    if (!monthValue) return '';
    const [year, month] = monthValue.split('-').map(Number);
    if (!year || !month) return monthValue;
    return new Date(year, month - 1, 1).toLocaleDateString(lang === 'ar' ? 'ar-QA' : 'en-US', {
      year: 'numeric',
      month: 'long'
    });
  };

  const formatScheduleLabel = (schedule?: WeeklyScheduleDay) => {
    if (!schedule || !schedule.is_working) return 'Off';
    if (!schedule.start_time || !schedule.end_time) return 'TBD';
    return `${schedule.start_time} - ${schedule.end_time}`;
  };

  const getRangeForPeriod = (period: 'daily' | 'weekly' | 'monthly', dateString: string) => {
    const base = new Date(dateString);
    const start = new Date(base);
    const end = new Date(base);
    if (period === 'weekly') {
      const day = base.getDay();
      const diff = (day + 6) % 7;
      start.setDate(base.getDate() - diff);
      end.setDate(start.getDate() + 6);
    } else if (period === 'monthly') {
      start.setDate(1);
      end.setMonth(start.getMonth() + 1);
      end.setDate(0);
    }
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  };

  const buildLogMap = (logs: EmployeeTimeLog[]) => {
    const map: Record<string, EmployeeTimeLog[]> = {};
    logs.forEach(log => {
      const dateKey = formatDateKey(new Date(log.clock_in_at));
      const key = `${log.employee_id}:${dateKey}`;
      if (!map[key]) map[key] = [];
      map[key].push(log);
    });
    return map;
  };

  const filteredEmployees = useMemo(() => {
    return employees.filter(e => {
      const matchesSearch = 
        e.first_name_en.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.last_name_en.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.employee_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.phone.includes(searchTerm) ||
        e.qid?.includes(searchTerm) ||
        e.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.role.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesDept = filterDepartment ? e.department === filterDepartment : true;
      const matchesStatus = filterStatus ? e.employment_status === filterStatus : true;
      const matchesType = filterType ? e.employment_type === filterType : true;

      return matchesSearch && matchesDept && matchesStatus && matchesType;
    });
  }, [employees, searchTerm, filterDepartment, filterStatus, filterType]);

  // Extract unique departments for filter dropdown
  const departments = useMemo(() => {
    const depts = new Set(employees.map((e: Employee) => e.department).filter(Boolean));
    return Array.from(depts);
  }, [employees]);

  const attendanceSummary = useMemo(() => {
    const present = dailyAttendance.filter((row: DailyAttendanceRow) => !!row.first_clock_in_at && !row.is_on_leave).length;
    const absent = dailyAttendance.filter((row: DailyAttendanceRow) => row.is_absent).length;
    const late = dailyAttendance.filter((row: DailyAttendanceRow) => row.is_late).length;
    const onLeave = dailyAttendance.filter((row: DailyAttendanceRow) => row.is_on_leave).length;
    return { present, absent, late, onLeave };
  }, [dailyAttendance]);

  const overtimePayToday = useMemo(() => {
    return dailyAttendance.reduce((total: number, row: DailyAttendanceRow) => {
      const employee = employees.find((emp: Employee) => emp.id === row.employee_id);
      if (!employee || row.overtime_hours <= 0) return total;
      const dateKey = row.work_date;
      const dayIndex = new Date(`${dateKey}T00:00:00`).getDay();
      const isHoliday = OVERTIME_HOLIDAYS.has(dateKey);
      const isWeekend = dayIndex === 5 || dayIndex === 6;
      const multiplier = isHoliday || isWeekend ? 1.5 : 1.25;
      const hourlyRate = calculateHourlyRate(employee);
      return total + row.overtime_hours * hourlyRate * multiplier;
    }, 0);
  }, [dailyAttendance, employees]);

  const absenceDeductionsToday = useMemo(() => {
    return dailyAttendance.reduce((total, row) => {
      if (!row.is_absent) return total;
      const employee = employees.find(emp => emp.id === row.employee_id);
      if (!employee) return total;
      const monthlyGross = calculateMonthlyGrossSalary(employee.salary_base, employee.salary_allowances);
      const dailyRate = monthlyGross / 30;
      return total + dailyRate;
    }, 0);
  }, [dailyAttendance, employees]);

  const latePenaltiesToday = useMemo(() => {
    const penaltyType = systemSettings.late_penalty_type || 'per_minute';
    const penaltyAmount = Number(systemSettings.late_penalty_amount) || 0;
    if (penaltyAmount === 0) return 0;
    return dailyAttendance.reduce((total, row) => {
      if (!row.is_late) return total;
      if (penaltyType === 'per_occurrence') return total + penaltyAmount;
      const employee = employees.find(emp => emp.id === row.employee_id);
      if (!employee || !row.first_clock_in_at) return total;
      const startMinutes = toMinutes(employee.shift_start_time);
      const graceMinutes = employee.shift_grace_minutes ?? 15;
      const clockMinutes = toMinutesFromTimestamp(row.first_clock_in_at);
      if (startMinutes === null || clockMinutes === null) return total;
      const lateMinutes = Math.max(0, clockMinutes - (startMinutes + graceMinutes));
      return total + lateMinutes * penaltyAmount;
    }, 0);
  }, [dailyAttendance, employees, systemSettings]);

  const salaryAdvancePaidMap = useMemo(() => {
    return salaryAdvancePayments.reduce((acc: Record<string, number>, payment: SalaryAdvancePayment) => {
      const amount = Number(payment.amount) || 0;
      acc[payment.advance_id] = (acc[payment.advance_id] || 0) + amount;
      return acc;
    }, {} as Record<string, number>);
  }, [salaryAdvancePayments]);

  const workingNow = useMemo(() => {
    return employees.filter(employee => !!openTimeLogs[employee.id]);
  }, [employees, openTimeLogs]);

  const branchStaffing = useMemo(() => {
    const at = new Date();
    const initRoleCounts = () => branchRoles.reduce((acc, r) => {
      acc[r] = { active: 0, available: 0, onShift: 0, clockedIn: 0 };
      return acc;
    }, {} as Record<UserRole, { active: number; available: number; onShift: number; clockedIn: number }>);

    const map = new Map<string, { location: Location; byRole: Record<UserRole, { active: number; available: number; onShift: number; clockedIn: number }> }>();
    locations.forEach(loc => {
      map.set(loc.id, { location: loc, byRole: initRoleCounts() });
    });

    employees.forEach(emp => {
      const assigned = getActiveTemporaryBranch(emp.id, at) || emp.location_id || '';
      if (!assigned) return;
      const bucket = map.get(assigned);
      if (!bucket) return;
      if (!branchRoles.includes(emp.role)) return;

      const roleBucket = bucket.byRole[emp.role];
      const isActive = emp.employment_status === 'Active';
      const isAvailable = isActive && !emp.is_on_leave;
      const onShift = isAvailable && isNowWithinShift(emp, at);
      const openLog = openTimeLogs[emp.id];
      const clockedIn = !!openLog && (!openLog.location_id || openLog.location_id === assigned);

      if (isActive) roleBucket.active += 1;
      if (isAvailable) roleBucket.available += 1;
      if (onShift) roleBucket.onShift += 1;
      if (clockedIn) roleBucket.clockedIn += 1;
    });

    return Array.from(map.values()).sort((a, b) => (a.location.name || '').localeCompare(b.location.name || ''));
  }, [employees, locations, branchTransfers, openTimeLogs, branchRoles]);

  const calendarDays = useMemo(() => {
    if (!calendarMonth) return [];
    const [year, month] = calendarMonth.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month, 0).getDate();
    const days: { date: Date; status: 'present' | 'absent' | 'late' | 'on_leave' | 'none' }[] = [];
    const logMap = buildLogMap(calendarLogs);
    for (let i = 0; i < startOffset; i += 1) {
      days.push({ date: new Date(year, month - 1, 0 - (startOffset - 1 - i)), status: 'none' });
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month - 1, day);
      const dateKey = formatDateKey(date);
      const employee = employees.find(e => e.id === calendarEmployeeId);
      const key = `${calendarEmployeeId}:${dateKey}`;
      const logs = logMap[key] || [];
      let status: 'present' | 'absent' | 'late' | 'on_leave' | 'none' = 'none';
      if (employee?.is_on_leave) {
        status = 'on_leave';
      } else if (logs.length > 0) {
        const firstClock = logs.reduce((min, log) => {
          const value = new Date(log.clock_in_at).getTime();
          return min === null || value < min ? value : min;
        }, null as number | null);
        const startMinutes = toMinutes(employee?.shift_start_time);
        const graceMinutes = employee?.shift_grace_minutes ?? 15;
        if (startMinutes !== null && firstClock !== null) {
          const clockMinutes = toMinutesFromTimestamp(new Date(firstClock).toISOString());
          status = clockMinutes !== null && clockMinutes > startMinutes + graceMinutes ? 'late' : 'present';
        } else {
          status = 'present';
        }
      } else {
        const now = new Date();
        if (date < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
          status = 'absent';
        }
      }
      days.push({ date, status });
    }
    return days;
  }, [calendarMonth, calendarLogs, calendarEmployeeId, employees]);

  const scheduleMonthDays = useMemo(() => {
    if (!calendarMonth) return [];
    const [year, month] = calendarMonth.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month, 0).getDate();
    const scheduleMap = new Map<number, WeeklyScheduleDay>();
    scheduleCalendar.forEach(day => {
      scheduleMap.set(day.day_of_week, day);
    });
    const days: { date: Date; inMonth: boolean; schedule?: WeeklyScheduleDay }[] = [];
    for (let i = 0; i < startOffset; i += 1) {
      const date = new Date(year, month - 1, 0 - (startOffset - 1 - i));
      const dateKey = formatDateKey(date);
      const override = scheduleOverrides[dateKey];
      days.push({ date, inMonth: false, schedule: override || scheduleMap.get(date.getDay()) });
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month - 1, day);
      const dateKey = formatDateKey(date);
      const override = scheduleOverrides[dateKey];
      days.push({ date, inMonth: true, schedule: override || scheduleMap.get(date.getDay()) });
    }
    return days;
  }, [calendarMonth, scheduleCalendar, scheduleOverrides]);

  const scheduleWeekDays = useMemo(() => {
    const baseDate = new Date(scheduleWeekDate);
    if (Number.isNaN(baseDate.getTime())) return [];
    const dayIndex = (baseDate.getDay() + 6) % 7;
    const start = new Date(baseDate);
    start.setDate(baseDate.getDate() - dayIndex);
    const scheduleMap = new Map<number, WeeklyScheduleDay>();
    scheduleCalendar.forEach((day: WeeklyScheduleDay) => {
      scheduleMap.set(day.day_of_week, day);
    });
    return Array.from({ length: 7 }).map((_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const dateKey = formatDateKey(date);
      const override = scheduleOverrides[dateKey];
      return { date, schedule: override || scheduleMap.get(date.getDay()) };
    });
  }, [scheduleWeekDate, scheduleCalendar, scheduleOverrides]);

  const reportSummary = useMemo(() => {
    const { start, end } = getRangeForPeriod(reportPeriod, reportDate);
    const logMap = buildLogMap(reportLogs);
    let present = 0;
    let absent = 0;
    let late = 0;
    let onLeave = 0;
    const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    for (let d = new Date(start); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateKey = formatDateKey(d);
      employees.forEach(employee => {
        if (employee.is_on_leave) {
          onLeave += 1;
          return;
        }
        const key = `${employee.id}:${dateKey}`;
        const logs = logMap[key] || [];
        if (logs.length > 0) {
          present += 1;
          const firstClock = logs.reduce((min, log) => {
            const value = new Date(log.clock_in_at).getTime();
            return min === null || value < min ? value : min;
          }, null as number | null);
          const startMinutes = toMinutes(employee.shift_start_time);
          const graceMinutes = employee.shift_grace_minutes ?? 15;
          if (startMinutes !== null && firstClock !== null) {
            const clockMinutes = toMinutesFromTimestamp(new Date(firstClock).toISOString());
            if (clockMinutes !== null && clockMinutes > startMinutes + graceMinutes) {
              late += 1;
            }
          }
        } else {
          const today = new Date();
          const isPast = d < new Date(today.getFullYear(), today.getMonth(), today.getDate());
          if (isPast) {
            absent += 1;
          }
        }
      });
    }
    return { present, absent, late, onLeave };
  }, [reportPeriod, reportDate, reportLogs, employees]);

  const reportEmployeeStats = useMemo(() => {
    const { start, end } = getRangeForPeriod(reportPeriod, reportDate);
    const logMap = buildLogMap(reportLogs);
    const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    const stats = employees.map(employee => {
      let present = 0;
      let absent = 0;
      let late = 0;
      let maxConsecutiveAbsences = 0;
      let currentConsecutiveAbsences = 0;
      for (let d = new Date(start); d <= endDate; d.setDate(d.getDate() + 1)) {
        const today = new Date();
        const isPast = d < new Date(today.getFullYear(), today.getMonth(), today.getDate());
        if (!isPast) continue;
        if (employee.is_on_leave) {
          currentConsecutiveAbsences = 0;
          continue;
        }
        const dateKey = formatDateKey(d);
        const key = `${employee.id}:${dateKey}`;
        const logs = logMap[key] || [];
        if (logs.length > 0) {
          present += 1;
          currentConsecutiveAbsences = 0;
          const firstClock = logs.reduce((min, log) => {
            const value = new Date(log.clock_in_at).getTime();
            return min === null || value < min ? value : min;
          }, null as number | null);
          const startMinutes = toMinutes(employee.shift_start_time);
          const graceMinutes = employee.shift_grace_minutes ?? 15;
          if (startMinutes !== null && firstClock !== null) {
            const clockMinutes = toMinutesFromTimestamp(new Date(firstClock).toISOString());
            if (clockMinutes !== null && clockMinutes > startMinutes + graceMinutes) {
              late += 1;
            }
          }
        } else {
          absent += 1;
          currentConsecutiveAbsences += 1;
          if (currentConsecutiveAbsences > maxConsecutiveAbsences) {
            maxConsecutiveAbsences = currentConsecutiveAbsences;
          }
        }
      }
      const scheduledDays = present + absent;
      const attendanceRate = scheduledDays > 0 ? Math.round((present / scheduledDays) * 1000) / 10 : 0;
      return {
        employee,
        present,
        absent,
        late,
        maxConsecutiveAbsences,
        attendanceRate
      };
    });
    const anomalies = stats.filter(stat => stat.maxConsecutiveAbsences >= 3 || stat.late >= 3);
    return { stats, anomalies };
  }, [reportPeriod, reportDate, reportLogs, employees]);

  const payrollSummary = useMemo(() => {
    const { start, end } = getRangeForPeriod('monthly', `${payrollMonth}-01`);
    const logMap = buildLogMap(payrollLogs);
    const penaltyType = systemSettings.late_penalty_type || 'per_minute';
    const penaltyAmount = Number(systemSettings.late_penalty_amount) || 0;
    const monthEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    const paymentByEmployee = payrollPayments.reduce((acc, payment) => {
      const amount = Number(payment.amount) || 0;
      acc[payment.employee_id] = (acc[payment.employee_id] || 0) + amount;
      return acc;
    }, {} as Record<string, number>);

    const items = employees.map(employee => {
      const monthlyGross = calculateMonthlyGrossSalary(employee.salary_base, employee.salary_allowances);
      const shiftHours = calculateShiftHours(employee.shift_start_time, employee.shift_end_time, employee.shift_break_minutes) || 0;
      const dailyRate = monthlyGross / 30;
      let present = 0;
      let absent = 0;
      let late = 0;
      let overtimeHours = 0;
      let overtimePay = 0;
      let latePenalties = 0;
      for (let d = new Date(start); d <= monthEnd; d.setDate(d.getDate() + 1)) {
        const today = new Date();
        const isPast = d < new Date(today.getFullYear(), today.getMonth(), today.getDate());
        if (!isPast) continue;
        if (employee.is_on_leave) {
          continue;
        }
        const dateKey = formatDateKey(d);
        const key = `${employee.id}:${dateKey}`;
        const logs = logMap[key] || [];
        if (logs.length > 0) {
          present += 1;
          const totalHours = logs.reduce((sum, log) => {
            if (!log.clock_out_at) return sum;
            const diff = (new Date(log.clock_out_at).getTime() - new Date(log.clock_in_at).getTime()) / 3600000;
            return sum + Math.max(0, diff);
          }, 0);
          if (shiftHours > 0 && totalHours > shiftHours) {
            const extra = totalHours - shiftHours;
            overtimeHours += extra;
            const dateKeyValue = formatDateKey(d);
            const dayIndex = new Date(`${dateKeyValue}T00:00:00`).getDay();
            const isHoliday = OVERTIME_HOLIDAYS.has(dateKeyValue);
            const isWeekend = dayIndex === 5 || dayIndex === 6;
            const multiplier = isHoliday || isWeekend ? 1.5 : 1.25;
            const hourlyRate = calculateHourlyRate(employee);
            overtimePay += extra * hourlyRate * multiplier;
          }
          const firstClock = logs.reduce((min, log) => {
            const value = new Date(log.clock_in_at).getTime();
            return min === null || value < min ? value : min;
          }, null as number | null);
          const startMinutes = toMinutes(employee.shift_start_time);
          const graceMinutes = employee.shift_grace_minutes ?? 15;
          if (startMinutes !== null && firstClock !== null) {
            const clockMinutes = toMinutesFromTimestamp(new Date(firstClock).toISOString());
            if (clockMinutes !== null && clockMinutes > startMinutes + graceMinutes) {
              late += 1;
              if (penaltyAmount > 0) {
                if (penaltyType === 'per_occurrence') {
                  latePenalties += penaltyAmount;
                } else {
                  const lateMinutes = Math.max(0, clockMinutes - (startMinutes + graceMinutes));
                  latePenalties += lateMinutes * penaltyAmount;
                }
              }
            }
          }
        } else {
          absent += 1;
        }
      }
      const absenceDeductions = absent * dailyRate;
      const advanceDeductions = paymentByEmployee[employee.id] || 0;
      const netPay = monthlyGross + overtimePay - absenceDeductions - latePenalties - advanceDeductions;
      return {
        employee,
        monthlyGross,
        present,
        absent,
        late,
        overtimeHours,
        overtimePay,
        absenceDeductions,
        latePenalties,
        advanceDeductions,
        netPay
      };
    });

    const totals = items.reduce(
      (acc, item) => {
        acc.gross += item.monthlyGross;
        acc.overtimePay += item.overtimePay;
        acc.absenceDeductions += item.absenceDeductions;
        acc.latePenalties += item.latePenalties;
        acc.advanceDeductions += item.advanceDeductions;
        acc.netPay += item.netPay;
        acc.overtimeHours += item.overtimeHours;
        return acc;
      },
      {
        gross: 0,
        overtimePay: 0,
        absenceDeductions: 0,
        latePenalties: 0,
        advanceDeductions: 0,
        netPay: 0,
        overtimeHours: 0
      }
    );

    return { items, totals };
  }, [employees, payrollLogs, payrollPayments, payrollMonth, systemSettings]);

  const performanceTrendData = useMemo(() => {
    const sorted = [...performanceReviews]
      .filter(review => typeof review.overall_score === 'number')
      .sort((a, b) => new Date(a.period_end).getTime() - new Date(b.period_end).getTime());
    return sorted.map(review => ({
      label: review.period_end,
      score: review.overall_score ?? 0
    }));
  }, [performanceReviews]);

  const selectedPayslipItem = useMemo(() => {
    if (!payslipEmployeeId) return null;
    return payrollSummary.items.find((item: any) => item.employee.id === payslipEmployeeId) || null;
  }, [payslipEmployeeId, payrollSummary.items]);

  const selectedPayslipTotals = useMemo(() => {
    if (!selectedPayslipItem) return null;
    const baseSalary = Number(selectedPayslipItem.employee.salary_base) || 0;
    const allowances = Number(selectedPayslipItem.employee.salary_allowances) || 0;
    const grossSalary = selectedPayslipItem.monthlyGross;
    const overtimePay = selectedPayslipItem.overtimePay;
    const totalEarnings = grossSalary + overtimePay;
    const totalDeductions = selectedPayslipItem.absenceDeductions + selectedPayslipItem.latePenalties + selectedPayslipItem.advanceDeductions;
    return {
      baseSalary,
      allowances,
      grossSalary,
      overtimePay,
      totalEarnings,
      totalDeductions
    };
  }, [selectedPayslipItem]);

  const handlePrintPayslip = (employeeId: string) => {
    setPayslipEmployeeId(employeeId);
    setTimeout(() => window.print(), 200);
  };

  const handleExport = () => {
    const headers = [
      'Employee ID',
      'First Name',
      'Last Name',
      'Role',
      'Department',
      'Status',
      'Type',
      'Email',
      'Phone',
      'QID',
      'Hire Date'
    ];

    const rows = filteredEmployees.map(emp => [
      emp.employee_id,
      emp.first_name_en,
      emp.last_name_en,
      emp.role,
      emp.department || '',
      emp.employment_status,
      emp.employment_type,
      emp.email,
      emp.phone,
      emp.qid || '',
      emp.hire_date
    ]);

    const escapeValue = (value: string) => {
      const escaped = value.replace(/"/g, '""');
      return `"${escaped}"`;
    };

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => escapeValue(String(cell ?? ''))).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `employees_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleExportPayroll = () => {
    const headers = [
      'Employee ID',
      'Name',
      'Department',
      'Role',
      'Month',
      'Gross Salary',
      'Overtime Hours',
      'Overtime Pay',
      'Absence Deductions',
      'Late Penalties',
      'Advance Deductions',
      'Net Pay',
      'Present Days',
      'Absent Days',
      'Late Days'
    ];

    const rows = payrollSummary.items.map((item: any) => [
      item.employee.employee_id,
      `${item.employee.first_name_en} ${item.employee.last_name_en}`,
      item.employee.department || '',
      item.employee.role,
      payrollMonth,
      item.monthlyGross,
      Math.round(item.overtimeHours * 100) / 100,
      item.overtimePay,
      item.absenceDeductions,
      item.latePenalties,
      item.advanceDeductions,
      item.netPay,
      item.present,
      item.absent,
      item.late
    ]);

    const escapeValue = (value: string) => {
      const escaped = value.replace(/"/g, '""');
      return `"${escaped}"`;
    };

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => escapeValue(String(cell ?? ''))).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `payroll_summary_${payrollMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleExportPayrollBank = () => {
    const headers = [
      'Employee ID',
      'Name',
      'Bank Name',
      'IBAN',
      'Net Pay',
      'Month',
      'Currency'
    ];

    const rows = payrollSummary.items.map(item => [
      item.employee.employee_id,
      `${item.employee.first_name_en} ${item.employee.last_name_en}`,
      item.employee.bank_name || '',
      item.employee.iban || '',
      item.netPay,
      payrollMonth,
      systemSettings.currency || 'QAR'
    ]);

    const escapeValue = (value: string) => {
      const escaped = value.replace(/"/g, '""');
      return `"${escaped}"`;
    };

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => escapeValue(String(cell ?? ''))).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `payroll_bank_transfer_${payrollMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const getPayrollApprovalStatusLabel = (status?: PayrollApproval['status']) => {
    if (!status) return 'Not started';
    switch (status) {
      case 'draft':
        return 'Draft';
      case 'hr_approved':
        return 'HR approved';
      case 'manager_approved':
        return 'Manager approved';
      case 'admin_approved':
        return 'Admin approved';
      default:
        return 'Not started';
    }
  };

  const formatApprovalTime = (value?: string) => {
    if (!value) return '-';
    return new Date(value).toLocaleString(lang === 'ar' ? 'ar-QA' : 'en-US');
  };

  const getPayrollApprovalAction = () => {
    const status = payrollApproval?.status || 'draft';
    if (user?.role === UserRole.HR && status === 'draft') {
      return { label: 'Approve as HR', nextStatus: 'hr_approved' as PayrollApproval['status'] };
    }
    if (user?.role === UserRole.MANAGER && status === 'hr_approved') {
      return { label: 'Approve as Manager', nextStatus: 'manager_approved' as PayrollApproval['status'] };
    }
    if (user?.role === UserRole.ADMIN && status === 'manager_approved') {
      return { label: 'Approve as Admin', nextStatus: 'admin_approved' as PayrollApproval['status'] };
    }
    return null;
  };

  const handlePayrollApprovalAction = async (nextStatus: PayrollApproval['status']) => {
    if (!user) return;
    setPayrollApprovalSaving(true);
    try {
      const approverId = user.id !== 'demo-user' ? user.id : null;
      const now = new Date().toISOString();
      const payload: Partial<PayrollApproval> = {
        status: nextStatus
      };
      if (nextStatus === 'hr_approved') {
        payload.hr_approved_by = approverId || undefined;
        payload.hr_approved_at = now;
      }
      if (nextStatus === 'manager_approved') {
        payload.manager_approved_by = approverId || undefined;
        payload.manager_approved_at = now;
      }
      if (nextStatus === 'admin_approved') {
        payload.admin_approved_by = approverId || undefined;
        payload.admin_approved_at = now;
      }
      if (payrollApproval) {
        const { data, error } = await supabase
          .from('payroll_approvals')
          .update(payload)
          .eq('id', payrollApproval.id)
          .select()
          .single();
        if (error) throw error;
        setPayrollApproval(data as PayrollApproval);
      } else {
        const { data, error } = await supabase
          .from('payroll_approvals')
          .insert([
            {
              month: payrollMonth,
              created_by: approverId || undefined,
              ...payload
            }
          ])
          .select()
          .single();
        if (error) throw error;
        setPayrollApproval(data as PayrollApproval);
      }
      if (nextStatus === 'admin_approved' && payrollSummary.items.length) {
        const historyRows = payrollSummary.items.map(item => ({
          month: payrollMonth,
          employee_id: item.employee.id,
          gross_salary: item.monthlyGross,
          overtime_hours: Math.round(item.overtimeHours * 100) / 100,
          overtime_pay: item.overtimePay,
          absence_deductions: item.absenceDeductions,
          late_penalties: item.latePenalties,
          advance_deductions: item.advanceDeductions,
          net_pay: item.netPay,
          present_days: item.present,
          absent_days: item.absent,
          late_days: item.late,
          created_by: approverId || undefined
        }));
        const { error: historyError } = await supabase
          .from('payroll_history')
          .upsert(historyRows, { onConflict: 'month,employee_id' });
        if (historyError) throw historyError;
      }
    } finally {
      setPayrollApprovalSaving(false);
    }
  };

  const handleCreateKpi = async () => {
    if (!kpiForm.name.trim()) return;
    try {
      const payload = {
        role: kpiForm.role,
        name: kpiForm.name.trim(),
        unit: kpiForm.unit.trim() || null,
        target_value: kpiForm.target_value ? Number(kpiForm.target_value) : null,
        source_module: kpiForm.source_module || null,
        source_metric: kpiForm.source_metric || null,
        created_by: user?.id
      };
      const { error } = await supabase
        .from('performance_kpis')
        .insert([payload]);
      if (error) throw error;
      setKpiForm(prev => ({ ...prev, name: '', unit: '', target_value: '', source_module: '', source_metric: '' }));
      await fetchPerformanceKpis(kpiForm.role);
    } catch (error: any) {
      alert('Failed to add KPI. ' + (error?.message || 'Please try again.'));
    }
  };

  const handleCreateCategory = async () => {
    if (!categoryForm.name.trim()) return;
    try {
      const payload = {
        role: categoryForm.role,
        name: categoryForm.name.trim(),
        description: categoryForm.description.trim() || null,
        created_by: user?.id
      };
      const { error } = await supabase
        .from('performance_review_categories')
        .insert([payload]);
      if (error) throw error;
      setCategoryForm(prev => ({ ...prev, name: '', description: '' }));
      await fetchPerformanceCategories(categoryForm.role);
    } catch (error: any) {
      alert('Failed to add category. ' + (error?.message || 'Please try again.'));
    }
  };

  const handleCreateBonusRule = async () => {
    if (!bonusRuleForm.bonus_type) return;
    try {
      const payload = {
        role: bonusRuleForm.role,
        min_score: bonusRuleForm.min_score ? Number(bonusRuleForm.min_score) : null,
        max_score: bonusRuleForm.max_score ? Number(bonusRuleForm.max_score) : null,
        bonus_type: bonusRuleForm.bonus_type,
        bonus_rate: bonusRuleForm.bonus_rate ? Number(bonusRuleForm.bonus_rate) : null,
        bonus_amount: bonusRuleForm.bonus_amount ? Number(bonusRuleForm.bonus_amount) : null,
        created_by: user?.id
      };
      const { error } = await supabase
        .from('performance_bonus_rules')
        .insert([payload]);
      if (error) throw error;
      setBonusRuleForm(prev => ({ ...prev, min_score: '', max_score: '', bonus_rate: '', bonus_amount: '' }));
      await fetchPerformanceBonusRules(bonusRuleForm.role);
    } catch (error: any) {
      alert('Failed to add bonus rule. ' + (error?.message || 'Please try again.'));
    }
  };

  const handleAutoFillReviewKpis = async () => {
    if (!reviewEmployeeId) return;
    const reviewEmployee = employees.find((emp: Employee) => emp.id === reviewEmployeeId);
    if (!reviewEmployee) return;
    setReviewAutoFillLoading(true);
    try {
      const start = new Date(reviewPeriodStart);
      const end = new Date(reviewPeriodEnd);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      const days = Math.max(1, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      const fullName = `${reviewEmployee.first_name_en} ${reviewEmployee.last_name_en}`.trim();

      const { data: txData } = await supabase
        .from('transactions')
        .select('total, cashier_name, created_at')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());
      const matchedTransactions = (txData || []).filter(tx => (tx.cashier_name || '').trim() === fullName);
      const txCount = matchedTransactions.length;
      const txTotal = matchedTransactions.reduce((sum, tx) => sum + Number(tx.total || 0), 0);

      const { data: roastData } = await supabase
        .from('roasting_batches')
        .select('waste_percentage, operator, roast_date, quality_score, qc_status')
        .gte('roast_date', start.toISOString().slice(0, 10))
        .lte('roast_date', end.toISOString().slice(0, 10));
      const matchedRoasts = (roastData || []).filter(batch => (batch.operator || '').trim() === fullName);
      const roastCount = matchedRoasts.length;
      const avgWaste = roastCount
        ? matchedRoasts.reduce((sum, batch) => sum + Number(batch.waste_percentage || 0), 0) / roastCount
        : 0;
      const qualitySamples = matchedRoasts.map((batch: any) => Number(batch.quality_score)).filter((value: number) => Number.isFinite(value));
      const avgQualityScore = qualitySamples.length
        ? qualitySamples.reduce((sum: number, value: number) => sum + value, 0) / qualitySamples.length
        : 0;
      const qcEvaluated = matchedRoasts.filter((batch: any) => batch.qc_status === 'PASSED' || batch.qc_status === 'FAILED');
      const qcTotal = qcEvaluated.length;
      const qcPassed = qcEvaluated.filter((batch: any) => batch.qc_status === 'PASSED').length;
      const qcSuccessRate = qcTotal ? (qcPassed / qcTotal) * 100 : 0;

      const nextValues: Record<string, string> = {};
      reviewRoleKpis.forEach((kpi: PerformanceKpi) => {
        if (!kpi.source_module || !kpi.source_metric) return;
        if (kpi.source_module === 'POS') {
          if (kpi.source_metric === 'transactions_count') nextValues[kpi.id] = String(txCount);
          if (kpi.source_metric === 'transactions_per_day') nextValues[kpi.id] = String(Math.round((txCount / days) * 100) / 100);
          if (kpi.source_metric === 'sales_total') nextValues[kpi.id] = String(Math.round(txTotal * 100) / 100);
          if (kpi.source_metric === 'sales_per_day') nextValues[kpi.id] = String(Math.round((txTotal / days) * 100) / 100);
        }
        if (kpi.source_module === 'ROASTING') {
          if (kpi.source_metric === 'avg_waste_percentage') nextValues[kpi.id] = String(Math.round(avgWaste * 100) / 100);
          if (kpi.source_metric === 'batch_count') nextValues[kpi.id] = String(roastCount);
          if (kpi.source_metric === 'avg_quality_score') nextValues[kpi.id] = String(Math.round(avgQualityScore * 100) / 100);
          if (kpi.source_metric === 'qc_success_rate') nextValues[kpi.id] = String(Math.round(qcSuccessRate * 100) / 100);
        }
      });

      setReviewKpiValues(prev => ({ ...prev, ...nextValues }));
    } finally {
      setReviewAutoFillLoading(false);
    }
  };

  const handleCreateReview = async () => {
    if (!reviewEmployeeId || !reviewPeriodStart || !reviewPeriodEnd) return;
    setReviewSaving(true);
    try {
      const reviewEmployee = employees.find(emp => emp.id === reviewEmployeeId);
      const grossSalary = reviewEmployee
        ? (Number(reviewEmployee.salary_base) || 0) + (Number(reviewEmployee.salary_allowances) || 0)
        : 0;
      const kpiRows = reviewRoleKpis.map(kpi => {
        const rawValue = reviewKpiValues[kpi.id];
        const actualValue = rawValue === '' || rawValue == null ? null : Number(rawValue);
        const target = Number(kpi.target_value) || 0;
        const isInverseMetric = kpi.source_module === 'ROASTING' && kpi.source_metric === 'avg_waste_percentage';
        const score = actualValue != null && target > 0
          ? Math.round((((isInverseMetric ? (actualValue > 0 ? target / actualValue : 0) : actualValue / target)) * 100) * 100) / 100
          : null;
        return {
          review_id: '',
          kpi_id: kpi.id,
          actual_value: actualValue,
          score
        };
      });
      const ratingRows = performanceCategories
        .map((category: PerformanceReviewCategory) => {
          const rating = reviewCategoryRatings[category.id];
          if (!rating) return null;
          return {
            review_id: '',
            category_id: category.id,
            rating
          };
        })
        .filter(Boolean) as Array<{ review_id: string; category_id: string; rating: number }>;
      const scoreValues = kpiRows.map(item => item.score).filter(value => typeof value === 'number') as number[];
      const ratingScores = ratingRows.map(item => Math.round((item.rating / 5) * 10000) / 100);
      const combinedScores = [...scoreValues, ...ratingScores];
      const overallScore = combinedScores.length
        ? Math.round((combinedScores.reduce((sum, value) => sum + value, 0) / combinedScores.length) * 100) / 100
        : null;
      const bonusRule = performanceBonusRules
        .filter(rule => rule.is_active !== false)
        .filter(rule => (rule.min_score == null || (overallScore ?? 0) >= rule.min_score) && (rule.max_score == null || (overallScore ?? 0) <= rule.max_score))
        .sort((a, b) => (b.min_score || 0) - (a.min_score || 0))[0];
      const bonusType = bonusRule?.bonus_type;
      const bonusRate = bonusRule?.bonus_rate ?? null;
      const bonusAmount = bonusType === 'percentage'
        ? Math.round(((grossSalary * (bonusRate || 0)) / 100) * 100) / 100
        : bonusRule?.bonus_amount ?? null;
      const payload = {
        employee_id: reviewEmployeeId,
        period_type: reviewPeriodType,
        period_start: reviewPeriodStart,
        period_end: reviewPeriodEnd,
        overall_score: overallScore,
        notes: reviewNotes || null,
        manager_feedback: reviewManagerFeedback || null,
        improvement_notes: reviewImprovementNotes || null,
        bonus_rule_id: bonusRule?.id || null,
        bonus_type: bonusType || null,
        bonus_rate: bonusRate,
        bonus_amount: bonusAmount,
        status: 'completed',
        created_by: user?.id,
        reviewed_by: user?.id
      };
      const { data, error } = await supabase
        .from('performance_reviews')
        .insert([payload])
        .select()
        .single();
      if (error) throw error;
      if (kpiRows.length) {
        const rows = kpiRows.map(row => ({ ...row, review_id: data.id }));
        const { error: kpiError } = await supabase
          .from('performance_review_kpis')
          .insert(rows);
        if (kpiError) throw kpiError;
      }
      if (ratingRows.length) {
        const rows = ratingRows.map(row => ({ ...row, review_id: data.id }));
        const { error: ratingError } = await supabase
          .from('performance_review_ratings')
          .insert(rows);
        if (ratingError) throw ratingError;
      }
      await fetchPerformanceReviews(reviewEmployeeId);
      setReviewNotes('');
      setReviewManagerFeedback('');
      setReviewImprovementNotes('');
      setReviewKpiValues({});
      setReviewCategoryRatings({});
    } catch (error: any) {
      alert('Failed to save review. ' + (error?.message || 'Please try again.'));
    } finally {
      setReviewSaving(false);
    }
  };

  const payrollApprovalAction = getPayrollApprovalAction();
  const payrollApprovalStatusLabel = getPayrollApprovalStatusLabel(payrollApproval?.status);
  const payrollApprovalDisabled = payrollApprovalSaving || payrollLoading || payrollSummary.items.length === 0;

  return (
    <div className="space-y-6 pb-20">
      <style>
        {`
          @media print {
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              height: auto !important;
              overflow: visible !important;
            }
            body * { visibility: hidden; }
            #payslip-print, #payslip-print * { 
              visibility: visible;
              color: black !important;
            }
            #payslip-print {
              display: block !important;
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              background: white;
              padding: 24px;
            }
            .no-print { display: none !important; }
          }
        `}
      </style>

      <div id="payslip-print" className={`hidden ${lang === 'ar' ? 'font-arabic' : 'font-sans'}`} dir={t.dir}>
        {selectedPayslipItem ? (
          <div className="max-w-3xl mx-auto border border-orange-200 p-6">
            <div className="flex justify-between items-start gap-6">
              <div>
                <div className="text-xl font-bold">{systemSettings.store_name}</div>
                {systemSettings.store_address && <div className="text-sm text-black">{systemSettings.store_address}</div>}
                {systemSettings.store_phone && <div className="text-sm text-black">{systemSettings.store_phone}</div>}
              </div>
              <div className="text-right">
                <div className="text-xl font-bold">{t.payslip}</div>
                <div className="text-sm">{t.payPeriod}: {formatMonthLabel(payrollMonth)}</div>
                <div className="text-sm">{t.generatedOn}: {new Date().toLocaleDateString(lang === 'ar' ? 'ar-QA' : 'en-US')}</div>
              </div>
            </div>

            <div className="mt-6 border-t border-b border-orange-200 py-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="font-semibold mb-2">{t.employeeInfo}</div>
                <div className="flex items-center justify-between">
                  <span className="text-black">{t.employeeName}</span>
                  <span className="font-medium">
                    {selectedPayslipItem.employee.first_name_en} {selectedPayslipItem.employee.last_name_en}
                  </span>
                </div>
                {(selectedPayslipItem.employee.first_name_ar || selectedPayslipItem.employee.last_name_ar) && (
                  <div className="text-right text-black">
                    {selectedPayslipItem.employee.first_name_ar || ''} {selectedPayslipItem.employee.last_name_ar || ''}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-black">{t.employeeId}</span>
                  <span className="font-medium">{selectedPayslipItem.employee.employee_id}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-black">{t.departmentLabel}</span>
                  <span className="font-medium">{selectedPayslipItem.employee.department || '-'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-black">{t.role}</span>
                  <span className="font-medium">{selectedPayslipItem.employee.role}</span>
                </div>
              </div>
              <div>
                <div className="font-semibold mb-2">{t.payrollDetails}</div>
                <div className="flex items-center justify-between">
                  <span className="text-black">{t.presentDays}</span>
                  <span className="font-medium">{selectedPayslipItem.present}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-black">{t.absentDays}</span>
                  <span className="font-medium">{selectedPayslipItem.absent}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-black">{t.lateDays}</span>
                  <span className="font-medium">{selectedPayslipItem.late}</span>
                </div>
                {selectedPayslipItem.employee.bank_name && (
                  <div className="flex items-center justify-between">
                    <span className="text-black">{t.bankName}</span>
                    <span className="font-medium">{selectedPayslipItem.employee.bank_name}</span>
                  </div>
                )}
                {selectedPayslipItem.employee.iban && (
                  <div className="flex items-center justify-between">
                    <span className="text-black">{t.iban}</span>
                    <span className="font-medium">{selectedPayslipItem.employee.iban}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div>
                <div className="font-semibold mb-2">{t.totalEarnings}</div>
                <div className="flex items-center justify-between">
                  <span className="text-black">{t.baseSalary}</span>
                  <span className="font-medium">{formatCurrency(selectedPayslipTotals?.baseSalary || 0)} {t.currency}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-black">{t.allowances}</span>
                  <span className="font-medium">{formatCurrency(selectedPayslipTotals?.allowances || 0)} {t.currency}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-black">{t.grossSalary}</span>
                  <span className="font-medium">{formatCurrency(selectedPayslipTotals?.grossSalary || 0)} {t.currency}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-black">{t.overtimePay}</span>
                  <span className="font-medium">
                    {formatCurrency(selectedPayslipTotals?.overtimePay || 0)} {t.currency}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-black">{t.overtimeHours}</span>
                  <span className="font-medium">{Math.round(selectedPayslipItem.overtimeHours * 100) / 100}</span>
                </div>
                <div className="flex items-center justify-between font-semibold border-t border-orange-100 mt-2 pt-2">
                  <span>{t.totalEarnings}</span>
                  <span>{formatCurrency(selectedPayslipTotals?.totalEarnings || 0)} {t.currency}</span>
                </div>
              </div>

              <div>
                <div className="font-semibold mb-2">{t.totalDeductions}</div>
                <div className="flex items-center justify-between">
                  <span className="text-black">{t.absenceDeductions}</span>
                  <span className="font-medium">{formatCurrency(selectedPayslipItem.absenceDeductions)} {t.currency}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-black">{t.latePenalties}</span>
                  <span className="font-medium">{formatCurrency(selectedPayslipItem.latePenalties)} {t.currency}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-black">{t.advanceDeductions}</span>
                  <span className="font-medium">{formatCurrency(selectedPayslipItem.advanceDeductions)} {t.currency}</span>
                </div>
                <div className="flex items-center justify-between font-semibold border-t border-orange-100 mt-2 pt-2">
                  <span>{t.totalDeductions}</span>
                  <span>{formatCurrency(selectedPayslipTotals?.totalDeductions || 0)} {t.currency}</span>
                </div>
                <div className="flex items-center justify-between font-bold text-base border-t border-orange-100 mt-2 pt-2">
                  <span>{t.netPay}</span>
                  <span>{formatCurrency(selectedPayslipItem.netPay)} {t.currency}</span>
                </div>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-6 text-sm">
              <div className="border-t border-orange-200 pt-2">{t.signatureEmployee}</div>
              <div className="border-t border-orange-200 pt-2 text-right">{t.signatureManager}</div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-black">{t.noPayslipData}</div>
        )}
      </div>

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{t.staffManagementTitle}</h1>
          <p className="text-black">{t.staffManagementSubtitle}</p>
        </div>
        <button 
          onClick={() => { setEditingEmployee(null); reset(); setShowForm(true); }}
          className="bg-orange-600 text-white  px-6 py-2 rounded-full font-bold flex items-center gap-2 hover:opacity-90 transition-opacity"
        >
          <Plus size={20} /> {t.addEmployee}
        </button>
      </div>

      {!showForm && (
      <div className="mt-6 flex flex-wrap gap-2 bg-white/60 border border-orange-100 rounded-2xl p-2">
        <button
          onClick={() => setStaffTab('overview')}
          className={`px-4 py-2 rounded-xl font-semibold text-sm ${
            staffTab === 'overview' ? 'bg-orange-600 text-white' : 'bg-white text-black '
          }`}
        >
          {t.staffTabOverview}
        </button>
        <button
          onClick={() => setStaffTab('schedule')}
          className={`px-4 py-2 rounded-xl font-semibold text-sm ${
            staffTab === 'schedule' ? 'bg-orange-600 text-white' : 'bg-white text-black '
          }`}
        >
          {t.staffTabSchedule}
        </button>
        <button
          onClick={() => setStaffTab('payroll')}
          className={`px-4 py-2 rounded-xl font-semibold text-sm ${
            staffTab === 'payroll' ? 'bg-orange-600 text-white' : 'bg-white text-black '
          }`}
        >
          {t.staffTabPayroll}
        </button>
        <button
          onClick={() => setStaffTab('performance')}
          className={`px-4 py-2 rounded-xl font-semibold text-sm ${
            staffTab === 'performance' ? 'bg-orange-600 text-white' : 'bg-white text-black '
          }`}
        >
          {t.staffTabPerformance}
        </button>
        <button
          onClick={() => setStaffTab('branches')}
          className={`px-4 py-2 rounded-xl font-semibold text-sm ${
            staffTab === 'branches' ? 'bg-orange-600 text-white' : 'bg-white text-black '
          }`}
        >
          {t.branchStaffing || 'Branch Staffing'}
        </button>
      </div>
      )}

      {/* List View */}
      {!showForm ? (
        <div className="bg-white  rounded-3xl p-6 shadow-sm border border-orange-100 ">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-black" size={20} />
              <input 
                type="text" 
                placeholder={t.searchStaffPlaceholder}
                className="w-full pl-12 pr-4 py-3 bg-white  rounded-xl outline-none focus:ring-2 focus:ring-stone-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex flex-wrap gap-2">
              <select 
                className="px-4 py-3 bg-white  rounded-xl outline-none focus:ring-2 focus:ring-stone-500 min-w-[140px]"
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
              >
                <option value="">{t.allDepartments}</option>
                {departments.map(d => <option key={d} value={d as string}>{d}</option>)}
              </select>

              <select 
                className="px-4 py-3 bg-white  rounded-xl outline-none focus:ring-2 focus:ring-stone-500 min-w-[140px]"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">{t.allStatus}</option>
                <option value="Active">{t.active}</option>
                <option value="Probation">{t.probation}</option>
                <option value="Suspended">{t.suspended}</option>
                <option value="Terminated">{t.terminated}</option>
                <option value="Resigned">{t.resigned}</option>
              </select>

              <select 
                className="px-4 py-3 bg-white  rounded-xl outline-none focus:ring-2 focus:ring-stone-500 min-w-[140px]"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="">{t.allTypes}</option>
                <option value="Full-time">{t.fullTime}</option>
                <option value="Part-time">{t.partTime}</option>
                <option value="Contract">{t.contract}</option>
                <option value="Intern">{t.intern}</option>
              </select>
              
              {(filterDepartment || filterStatus || filterType) && (
                <button 
                  onClick={() => { setFilterDepartment(''); setFilterStatus(''); setFilterType(''); }}
                  className="px-4 py-3 bg-white  rounded-xl transition-colors"
                  title={t.clearFilters}
                >
                  <X size={18} />
                </button>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-4 py-3 rounded-xl font-medium flex items-center gap-2 ${
                    viewMode === 'list' ? 'bg-orange-600 text-white hover' : 'bg-white  text-black '
                  }`}
                >
                  <FileText size={18} /> {t.listView}
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-4 py-3 rounded-xl font-medium flex items-center gap-2 ${
                    viewMode === 'grid' ? 'bg-orange-600 text-white hover' : 'bg-white  text-black '
                  }`}
                >
                  <Users size={18} /> {t.gridView}
                </button>
                <button
                  onClick={handleExport}
                  className="px-4 py-3 rounded-xl font-medium flex items-center gap-2 bg-white  text-black   "
                >
                  <Download size={18} /> {t.exportCsv}
                </button>
              </div>
            </div>
          </div>

          {staffTab === 'overview' && (
            <>
          <div className="mb-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white/60 rounded-2xl p-4 border border-orange-100 ">
              <div className="text-sm font-bold mb-3">{t.dailyAttendanceOverview}</div>
              <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
                <div className="bg-white  rounded-xl p-3 border border-orange-100 ">
                  <div className="text-xs text-black">{t.presentLabel}</div>
                  <div className="text-xl font-bold">{attendanceSummary.present}</div>
                </div>
                <div className="bg-white  rounded-xl p-3 border border-orange-100 ">
                  <div className="text-xs text-black">{t.absentLabel}</div>
                  <div className="text-xl font-bold">{attendanceSummary.absent}</div>
                </div>
                <div className="bg-white  rounded-xl p-3 border border-orange-100 ">
                  <div className="text-xs text-black">{t.lateLabel}</div>
                  <div className="text-xl font-bold">{attendanceSummary.late}</div>
                </div>
                <div className="bg-white  rounded-xl p-3 border border-orange-100 ">
                  <div className="text-xs text-black">{t.onLeave}</div>
                  <div className="text-xl font-bold">{attendanceSummary.onLeave}</div>
                </div>
                <div className="bg-white  rounded-xl p-3 border border-orange-100 ">
                  <div className="text-xs text-black">{t.overtimePayToday}</div>
                  <div className="text-xl font-bold">{formatCurrency(overtimePayToday)} {t.currency}</div>
                </div>
                <div className="bg-white  rounded-xl p-3 border border-orange-100 ">
                  <div className="text-xs text-black">{t.absenceDeductionsToday}</div>
                  <div className="text-xl font-bold">{formatCurrency(absenceDeductionsToday)} {t.currency}</div>
                </div>
                <div className="bg-white  rounded-xl p-3 border border-orange-100 ">
                  <div className="text-xs text-black">{t.latePenaltiesToday}</div>
                  <div className="text-xl font-bold">{formatCurrency(latePenaltiesToday)} {t.currency}</div>
                </div>
              </div>
            </div>
            <div className="bg-white/60 rounded-2xl p-4 border border-orange-100 ">
              <div className="text-sm font-bold mb-3">{t.workingNow}</div>
              {workingNow.length === 0 ? (
                <div className="text-sm text-black">{t.noActiveStaff}</div>
              ) : (
                <div className="space-y-2 max-h-40 overflow-auto pr-1">
                  {workingNow.map(employee => (
                    <div key={employee.id} className="flex items-center justify-between text-sm">
                      <div className="font-medium truncate">{employee.first_name_en} {employee.last_name_en}</div>
                      <div className="text-xs text-black">{formatTime(openTimeLogs[employee.id]?.clock_in_at)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mb-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white/60 rounded-2xl p-4 border border-orange-100 ">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <div className="text-sm font-bold">{t.monthlyAttendanceCalendar}</div>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={calendarEmployeeId}
                    onChange={(e) => setCalendarEmployeeId(e.target.value)}
                    className="px-3 py-2 bg-white  rounded-xl border border-orange-100  text-sm"
                  >
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.first_name_en} {emp.last_name_en}
                      </option>
                    ))}
                  </select>
                  <input
                    type="month"
                    value={calendarMonth}
                    onChange={(e) => setCalendarMonth(e.target.value)}
                    className="px-3 py-2 bg-white  rounded-xl border border-orange-100  text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-7 gap-2 text-xs text-black mb-2">
                <div>{t.dayMon}</div>
                <div>{t.dayTue}</div>
                <div>{t.dayWed}</div>
                <div>{t.dayThu}</div>
                <div>{t.dayFri}</div>
                <div>{t.daySat}</div>
                <div>{t.daySun}</div>
              </div>
              <div className="grid grid-cols-7 gap-2">
                {calendarDays.map((day, index) => (
                  <div
                    key={`${day.date.toISOString()}-${index}`}
                    className={`h-10 rounded-lg flex items-center justify-center text-sm font-medium border ${
                      day.status === 'present' ? 'bg-white text-green-800 border-green-200' :
                      day.status === 'late' ? 'bg-white text-yellow-800 border-yellow-200' :
                      day.status === 'absent' ? 'bg-white text-red-800 border-red-200' :
                      day.status === 'on_leave' ? 'bg-white text-blue-800 border-blue-200' :
                      'bg-white text-black border-transparent'
                    }`}
                  >
                    {day.date.getDate()}
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white/60 rounded-2xl p-4 border border-orange-100 ">
              <div className="text-sm font-bold mb-3">{t.attendanceSummaryReports}</div>
              <div className="flex flex-wrap gap-2 mb-4">
                <select
                  value={reportPeriod}
                  onChange={(e) => setReportPeriod(e.target.value as 'daily' | 'weekly' | 'monthly')}
                  className="px-3 py-2 bg-white  rounded-xl border border-orange-100  text-sm"
                >
                  <option value="daily">{t.daily}</option>
                  <option value="weekly">{t.weekly}</option>
                  <option value="monthly">{t.monthly}</option>
                </select>
                <input
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="px-3 py-2 bg-white  rounded-xl border border-orange-100  text-sm"
                />
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>{t.presentLabel}</span>
                  <span className="font-bold">{reportSummary.present}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{t.absentLabel}</span>
                  <span className="font-bold">{reportSummary.absent}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{t.lateLabel}</span>
                  <span className="font-bold">{reportSummary.late}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{t.onLeave}</span>
                  <span className="font-bold">{reportSummary.onLeave}</span>
                </div>
              </div>
              <div className="mt-4">
                <div className="text-xs font-bold text-black mb-2">{t.anomalies}</div>
                {reportEmployeeStats.anomalies.length === 0 ? (
                  <div className="text-xs text-black">{t.noAnomaliesDetected}</div>
                ) : (
                  <div className="space-y-2 text-xs">
                    {reportEmployeeStats.anomalies.map(stat => (
                      <div key={stat.employee.id} className="flex items-center justify-between gap-2">
                        <div className="truncate font-medium">
                          {stat.employee.first_name_en} {stat.employee.last_name_en}
                        </div>
                        <div className="flex items-center gap-2">
                          {stat.maxConsecutiveAbsences >= 3 && (
                            <span className="px-2 py-1 rounded-full bg-white text-red-800 border border-red-200">
                              {stat.maxConsecutiveAbsences} {t.absences}
                            </span>
                          )}
                          {stat.late >= 3 && (
                            <span className="px-2 py-1 rounded-full bg-white text-yellow-800 border border-yellow-200">
                              {stat.late} {t.lateLabel}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-4">
                <div className="text-xs font-bold text-black mb-2">{t.attendanceRate}</div>
                <div className="space-y-2 text-xs max-h-40 overflow-auto pr-1">
                  {reportEmployeeStats.stats.map(stat => (
                    <div key={stat.employee.id} className="flex items-center justify-between">
                      <div className="truncate">
                        {stat.employee.first_name_en} {stat.employee.last_name_en}
                      </div>
                      <div className="font-bold">{stat.attendanceRate}%</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
            </>
          )}

          {staffTab === 'payroll' && (
          <div className="mb-6 bg-white/60 rounded-2xl p-4 border border-orange-100 ">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <div className="text-sm font-bold">{t.monthlyPayrollSummary}</div>
              <div className="flex flex-wrap gap-2">
                <input
                  type="month"
                  value={payrollMonth}
                  onChange={(e) => setPayrollMonth(e.target.value)}
                  className="px-3 py-2 bg-white  rounded-xl border border-orange-100  text-sm"
                />
                <button
                  type="button"
                  onClick={handleExportPayroll}
                  className="px-4 py-2 rounded-xl font-medium flex items-center gap-2 bg-white  text-black   "
                >
                  <Download size={18} /> {t.exportPayrollCsv}
                </button>
                <button
                  type="button"
                  onClick={handleExportPayrollBank}
                  className="px-4 py-2 rounded-xl font-medium flex items-center gap-2 bg-white  text-black   "
                >
                  <Download size={18} /> {t.exportBankCsv}
                </button>
              </div>
            </div>
            <div className="space-y-3 mb-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-sm">
                <div className="text-black">
                  {t.approvalStatus}:{' '}
                  <span className="font-semibold text-black ">
                    {payrollApprovalStatusLabel}
                  </span>
                </div>
                {payrollApprovalAction && (
                  <button
                    type="button"
                    onClick={() => handlePayrollApprovalAction(payrollApprovalAction.nextStatus)}
                    disabled={payrollApprovalDisabled}
                    className="px-4 py-2 rounded-xl font-medium bg-orange-600 text-white  disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                  {payrollApprovalSaving ? t.saving : payrollApprovalAction.label}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                <div className="bg-white  rounded-xl p-3 border border-orange-100 ">
                <div className="text-black">{t.hrApproved}</div>
                  <div className="font-semibold">{formatApprovalTime(payrollApproval?.hr_approved_at)}</div>
                </div>
                <div className="bg-white  rounded-xl p-3 border border-orange-100 ">
                <div className="text-black">{t.managerApproved}</div>
                  <div className="font-semibold">{formatApprovalTime(payrollApproval?.manager_approved_at)}</div>
                </div>
                <div className="bg-white  rounded-xl p-3 border border-orange-100 ">
                <div className="text-black">{t.adminApproved}</div>
                  <div className="font-semibold">{formatApprovalTime(payrollApproval?.admin_approved_at)}</div>
                </div>
              </div>
            </div>
            {payrollLoading ? (
            <div className="text-sm text-black">{t.loadingPayrollSummary}</div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-sm">
                  <div className="bg-white  rounded-xl p-3 border border-orange-100 ">
                  <div className="text-xs text-black">{t.grossSalary}</div>
                  <div className="font-bold">{formatCurrency(payrollSummary.totals.gross)} {t.currency}</div>
                  </div>
                  <div className="bg-white  rounded-xl p-3 border border-orange-100 ">
                  <div className="text-xs text-black">{t.overtimePay}</div>
                  <div className="font-bold">{formatCurrency(payrollSummary.totals.overtimePay)} {t.currency}</div>
                  </div>
                  <div className="bg-white  rounded-xl p-3 border border-orange-100 ">
                  <div className="text-xs text-black">{t.absenceDeductions}</div>
                  <div className="font-bold">{formatCurrency(payrollSummary.totals.absenceDeductions)} {t.currency}</div>
                  </div>
                  <div className="bg-white  rounded-xl p-3 border border-orange-100 ">
                  <div className="text-xs text-black">{t.latePenalties}</div>
                  <div className="font-bold">{formatCurrency(payrollSummary.totals.latePenalties)} {t.currency}</div>
                  </div>
                  <div className="bg-white  rounded-xl p-3 border border-orange-100 ">
                  <div className="text-xs text-black">{t.advanceDeductions}</div>
                  <div className="font-bold">{formatCurrency(payrollSummary.totals.advanceDeductions)} {t.currency}</div>
                  </div>
                  <div className="bg-white  rounded-xl p-3 border border-orange-100 ">
                  <div className="text-xs text-black">{t.netPay}</div>
                  <div className="font-bold">{formatCurrency(payrollSummary.totals.netPay)} {t.currency}</div>
                  </div>
                </div>
                {payrollSummary.items.length === 0 ? (
                <div className="text-sm text-black">{t.noPayrollData}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-black">
                        <th className="py-2 pr-3">{t.employeeName}</th>
                        <th className="py-2 pr-3">{t.grossSalary}</th>
                        <th className="py-2 pr-3">{t.overtimeLabel}</th>
                        <th className="py-2 pr-3">{t.absenceLabel}</th>
                        <th className="py-2 pr-3">{t.lateLabel}</th>
                        <th className="py-2 pr-3">{t.advancesLabel}</th>
                        <th className="py-2 pr-3">{t.netPay}</th>
                        <th className="py-2 pr-3">{t.presentLabel}</th>
                        <th className="py-2 pr-3">{t.absentLabel}</th>
                          <th className="py-2 pr-3 no-print">{t.payslip}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-200 ">
                        {payrollSummary.items.map(item => (
                          <tr key={item.employee.id} className="text-black ">
                            <td className="py-2 pr-3">
                              <div className="font-medium">{item.employee.first_name_en} {item.employee.last_name_en}</div>
                              <div className="text-xs text-black">{item.employee.employee_id}</div>
                            </td>
                          <td className="py-2 pr-3">{formatCurrency(item.monthlyGross)} {t.currency}</td>
                            <td className="py-2 pr-3">
                            <div>{formatCurrency(item.overtimePay)} {t.currency}</div>
                            <div className="text-xs text-black">{Math.round(item.overtimeHours * 100) / 100} {t.hoursShort}</div>
                            </td>
                          <td className="py-2 pr-3">{formatCurrency(item.absenceDeductions)} {t.currency}</td>
                          <td className="py-2 pr-3">{formatCurrency(item.latePenalties)} {t.currency}</td>
                          <td className="py-2 pr-3">{formatCurrency(item.advanceDeductions)} {t.currency}</td>
                          <td className="py-2 pr-3 font-bold">{formatCurrency(item.netPay)} {t.currency}</td>
                            <td className="py-2 pr-3">{item.present}</td>
                            <td className="py-2 pr-3">{item.absent}</td>
                            <td className="py-2 pr-3 no-print">
                              <button
                                type="button"
                                onClick={() => handlePrintPayslip(item.employee.id)}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white  text-black   "
                              >
                                <Printer size={16} /> {t.printPayslip}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
              )}
            </div>
            )}
          </div>
          )}

          {staffTab === 'performance' && (
          <div className="mb-6 bg-white/60 rounded-2xl p-4 border border-orange-100 ">
            <div className="text-sm font-bold mb-4">{t.performanceReviewsKpis}</div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="bg-white  rounded-2xl p-4 border border-orange-100  space-y-6">
                <div>
                  <div className="text-sm font-semibold mb-3">{t.roleKpis}</div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">{t.role}</label>
                    <select
                      value={kpiForm.role}
                      onChange={(e) => setKpiForm(prev => ({ ...prev, role: e.target.value as UserRole }))}
                      className="w-full px-3 py-2 rounded-xl bg-white text-black border-none"
                    >
                      {Object.values(UserRole).map(role => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">{t.kpiName}</label>
                    <input
                      value={kpiForm.name}
                      onChange={(e) => setKpiForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl bg-white text-black border-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">{t.unitLabel}</label>
                    <input
                      value={kpiForm.unit}
                      onChange={(e) => setKpiForm(prev => ({ ...prev, unit: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl bg-white text-black border-none"
                      placeholder={t.unitPlaceholder}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">{t.targetLabel}</label>
                    <input
                      type="number"
                      value={kpiForm.target_value}
                      onChange={(e) => setKpiForm(prev => ({ ...prev, target_value: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl bg-white text-black border-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">{t.sourceModule}</label>
                    <select
                      value={kpiForm.source_module}
                      onChange={(e) => setKpiForm(prev => ({ ...prev, source_module: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl bg-white text-black border-none"
                    >
                      <option value="">{t.manual}</option>
                      <option value="POS">{t.pos}</option>
                      <option value="ROASTING">{t.roasting}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">{t.sourceMetric}</label>
                    <select
                      value={kpiForm.source_metric}
                      onChange={(e) => setKpiForm(prev => ({ ...prev, source_metric: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl bg-white text-black border-none"
                    >
                      <option value="">{t.selectOption}</option>
                      {kpiForm.source_module === 'POS' && (
                        <>
                          <option value="transactions_count">{t.transactionsCount}</option>
                          <option value="transactions_per_day">{t.transactionsPerDay}</option>
                          <option value="sales_total">{t.salesTotal}</option>
                          <option value="sales_per_day">{t.salesPerDay}</option>
                        </>
                      )}
                      {kpiForm.source_module === 'ROASTING' && (
                        <>
                          <option value="avg_waste_percentage">{t.avgWastePercentage}</option>
                          <option value="batch_count">{t.batchCount}</option>
                          <option value="avg_quality_score">{t.avgQualityScore}</option>
                          <option value="qc_success_rate">{t.qcSuccessRate}</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={handleCreateKpi}
                      disabled={performanceKpisLoading || !kpiForm.name.trim()}
                      className="px-4 py-2 rounded-xl font-medium bg-orange-600 text-white  disabled:opacity-50"
                    >
                      {t.addKpi}
                    </button>
                  </div>
                  <div className="mt-4">
                    {performanceKpisLoading ? (
                      <div className="text-sm text-black">{t.loadingKpis}</div>
                    ) : performanceKpis.length === 0 ? (
                      <div className="text-sm text-black">{t.noKpisDefinedRole}</div>
                    ) : (
                      <div className="space-y-2 text-sm">
                        {performanceKpis.map(kpi => (
                          <div key={kpi.id} className="flex items-center justify-between rounded-xl border border-orange-100  px-3 py-2">
                            <div>
                              <div className="font-medium">{kpi.name}</div>
                              <div className="text-xs text-black">
                                {t.targetLabel}: {kpi.target_value ?? '-'} {kpi.unit || ''}
                              </div>
                              {kpi.source_module && kpi.source_metric && (
                                <div className="text-xs text-black">
                                  {t.sourceLabel}: {kpi.source_module} · {kpi.source_metric}
                                </div>
                              )}
                            </div>
                            <div className="text-xs text-black">{kpi.role}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-semibold mb-3">{t.ratingCategories}</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">{t.role}</label>
                      <select
                        value={categoryForm.role}
                        onChange={(e) => setCategoryForm(prev => ({ ...prev, role: e.target.value as UserRole }))}
                        className="w-full px-3 py-2 rounded-xl bg-white text-black border-none"
                      >
                        {Object.values(UserRole).map(role => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">{t.categoryName}</label>
                      <input
                        value={categoryForm.name}
                        onChange={(e) => setCategoryForm(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl bg-white text-black border-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">{t.descriptionLabel}</label>
                      <input
                        value={categoryForm.description}
                        onChange={(e) => setCategoryForm(prev => ({ ...prev, description: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl bg-white text-black border-none"
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={handleCreateCategory}
                      disabled={performanceCategoriesLoading || !categoryForm.name.trim()}
                      className="px-4 py-2 rounded-xl font-medium bg-orange-600 text-white  disabled:opacity-50"
                    >
                      {t.addCategory}
                    </button>
                  </div>
                  <div className="mt-4">
                    {performanceCategoriesLoading ? (
                      <div className="text-sm text-black">{t.loadingCategories}</div>
                    ) : performanceCategories.length === 0 ? (
                      <div className="text-sm text-black">{t.noRatingCategories}</div>
                    ) : (
                      <div className="space-y-2 text-sm">
                        {performanceCategories.map(category => (
                          <div key={category.id} className="rounded-xl border border-orange-100  px-3 py-2">
                            <div className="font-medium">{category.name}</div>
                            {category.description && <div className="text-xs text-black">{category.description}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-semibold mb-3">{t.bonusRules}</div>
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium mb-1">{t.role}</label>
                      <select
                        value={bonusRuleForm.role}
                        onChange={(e) => setBonusRuleForm(prev => ({ ...prev, role: e.target.value as UserRole }))}
                        className="w-full px-3 py-2 rounded-xl bg-white text-black border-none"
                      >
                        {Object.values(UserRole).map(role => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">{t.minScore}</label>
                      <input
                        type="number"
                        value={bonusRuleForm.min_score}
                        onChange={(e) => setBonusRuleForm(prev => ({ ...prev, min_score: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl bg-white text-black border-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">{t.maxScore}</label>
                      <input
                        type="number"
                        value={bonusRuleForm.max_score}
                        onChange={(e) => setBonusRuleForm(prev => ({ ...prev, max_score: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl bg-white text-black border-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">{t.typeLabel}</label>
                      <select
                        value={bonusRuleForm.bonus_type}
                        onChange={(e) => setBonusRuleForm(prev => ({ ...prev, bonus_type: e.target.value as 'percentage' | 'fixed' }))}
                        className="w-full px-3 py-2 rounded-xl bg-white text-black border-none"
                      >
                        <option value="percentage">{t.percentage}</option>
                        <option value="fixed">{t.fixed}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">{t.rateLabel}</label>
                      <input
                        type="number"
                        value={bonusRuleForm.bonus_rate}
                        onChange={(e) => setBonusRuleForm(prev => ({ ...prev, bonus_rate: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl bg-white text-black border-none"
                        disabled={bonusRuleForm.bonus_type !== 'percentage'}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">{t.amountLabel}</label>
                      <input
                        type="number"
                        value={bonusRuleForm.bonus_amount}
                        onChange={(e) => setBonusRuleForm(prev => ({ ...prev, bonus_amount: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl bg-white text-black border-none"
                        disabled={bonusRuleForm.bonus_type !== 'fixed'}
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={handleCreateBonusRule}
                      disabled={performanceBonusRulesLoading}
                      className="px-4 py-2 rounded-xl font-medium bg-orange-600 text-white  disabled:opacity-50"
                    >
                      {t.addBonusRule}
                    </button>
                  </div>
                  <div className="mt-4">
                    {performanceBonusRulesLoading ? (
                      <div className="text-sm text-black">{t.loadingBonusRules}</div>
                    ) : performanceBonusRules.length === 0 ? (
                      <div className="text-sm text-black">{t.noBonusRules}</div>
                    ) : (
                      <div className="space-y-2 text-sm">
                        {performanceBonusRules.map(rule => (
                          <div key={rule.id} className="rounded-xl border border-orange-100  px-3 py-2 flex items-center justify-between gap-3">
                            <div>
                              <div className="font-medium">{rule.role}</div>
                              <div className="text-xs text-black">
                                {t.scoreLabel} {rule.min_score ?? '-'} → {rule.max_score ?? '-'}
                              </div>
                            </div>
                            <div className="text-xs text-black">
                              {rule.bonus_type === 'percentage'
                                ? `${rule.bonus_rate ?? 0}%`
                                : `${rule.bonus_amount ?? 0} QAR`}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="bg-white  rounded-2xl p-4 border border-orange-100 ">
                <div className="text-sm font-semibold mb-3">{t.createReview}</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">{t.employeeName}</label>
                    <select
                      value={reviewEmployeeId}
                      onChange={(e) => setReviewEmployeeId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white text-black border-none"
                    >
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.first_name_en} {emp.last_name_en}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">{t.periodType}</label>
                    <select
                      value={reviewPeriodType}
                      onChange={(e) => setReviewPeriodType(e.target.value as 'monthly' | 'quarterly' | 'annual')}
                      className="w-full px-3 py-2 rounded-xl bg-white text-black border-none"
                    >
                      <option value="monthly">{t.monthly}</option>
                      <option value="quarterly">{t.quarterly}</option>
                      <option value="annual">{t.annual}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">{t.startDate}</label>
                    <input
                      type="date"
                      value={reviewPeriodStart}
                      onChange={(e) => setReviewPeriodStart(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white text-black border-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">{t.endDate}</label>
                    <input
                      type="date"
                      value={reviewPeriodEnd}
                      onChange={(e) => setReviewPeriodEnd(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white text-black border-none"
                    />
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">{t.managerFeedback}</label>
                    <textarea
                      value={reviewManagerFeedback}
                      onChange={(e) => setReviewManagerFeedback(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white text-black border-none min-h-[80px]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">{t.improvementNotes}</label>
                    <textarea
                      value={reviewImprovementNotes}
                      onChange={(e) => setReviewImprovementNotes(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white text-black border-none min-h-[80px]"
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block text-xs font-medium mb-1">{t.additionalNotes}</label>
                  <textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white text-black border-none min-h-[80px]"
                  />
                </div>
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-semibold">{t.kpisLabel}</div>
                    <button
                      type="button"
                      onClick={handleAutoFillReviewKpis}
                      disabled={reviewAutoFillLoading || reviewRoleKpis.length === 0}
                      className="px-3 py-2 rounded-xl text-xs font-medium bg-white  disabled:opacity-50"
                    >
                      {reviewAutoFillLoading ? t.autoFilling : t.autoFillKpis}
                    </button>
                  </div>
                  {reviewRoleKpisLoading ? (
                    <div className="text-sm text-black">{t.loadingKpis}</div>
                  ) : reviewRoleKpis.length === 0 ? (
                    <div className="text-sm text-black">{t.noKpisConfigured}</div>
                  ) : (
                    <div className="space-y-2">
                      {reviewRoleKpis.map(kpi => (
                        <div key={kpi.id} className="flex items-center gap-3">
                          <div className="flex-1">
                            <div className="text-sm font-medium">{kpi.name}</div>
                            <div className="text-xs text-black">
                              {t.targetLabel}: {kpi.target_value ?? '-'} {kpi.unit || ''}
                            </div>
                          </div>
                          <input
                            type="number"
                            value={reviewKpiValues[kpi.id] ?? ''}
                            onChange={(e) => setReviewKpiValues(prev => ({ ...prev, [kpi.id]: e.target.value }))}
                            className="w-32 px-3 py-2 rounded-xl bg-white text-black border-none"
                            placeholder={t.actualLabel}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="mt-4">
                  <div className="text-xs font-semibold mb-2">{t.ratingsLabel}</div>
                  {performanceCategoriesLoading ? (
                    <div className="text-sm text-black">{t.loadingCategories}</div>
                  ) : performanceCategories.length === 0 ? (
                    <div className="text-sm text-black">{t.noRatingCategories}</div>
                  ) : (
                    <div className="space-y-2 text-sm">
                      {performanceCategories.map(category => (
                        <div key={category.id} className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-medium">{category.name}</div>
                            {category.description && <div className="text-xs text-black">{category.description}</div>}
                          </div>
                          <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map(value => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => setReviewCategoryRatings(prev => ({ ...prev, [category.id]: value }))}
                                className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                                  reviewCategoryRatings[category.id] === value
                                    ? 'bg-orange-600 text-white  '
                                    : 'bg-white  text-black '
                                }`}
                              >
                                {value}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={handleCreateReview}
                    disabled={reviewSaving}
                    className="px-4 py-2 rounded-xl font-medium bg-orange-600 text-white  disabled:opacity-50"
                  >
                    {reviewSaving ? t.saving : t.saveReview}
                  </button>
                </div>
                <div className="mt-4">
                  <div className="text-xs font-semibold mb-2">{t.performanceTrend}</div>
                  {performanceReviews.length === 0 ? (
                    <div className="text-sm text-black">{t.noTrendData}</div>
                  ) : (
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={performanceTrendData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
                          <XAxis dataKey="label" axisLine={false} tickLine={false} fontSize={10} />
                          <YAxis axisLine={false} tickLine={false} fontSize={10} domain={[0, 'auto']} />
                          <Tooltip />
                          <Line type="monotone" dataKey="score" stroke="#111827" strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
                <div className="mt-4">
                  <div className="text-xs font-semibold mb-2">{t.recentReviews}</div>
                  {performanceReviewsLoading ? (
                    <div className="text-sm text-black">{t.loadingReviews}</div>
                  ) : performanceReviews.length === 0 ? (
                    <div className="text-sm text-black">{t.noReviewsRecorded}</div>
                  ) : (
                    <div className="space-y-2 text-sm">
                      {performanceReviews.map(review => (
                        <div key={review.id} className="rounded-xl border border-orange-100  px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <div className="font-medium">
                                {review.period_type} {review.period_start} → {review.period_end}
                              </div>
                              {review.manager_feedback && <div className="text-xs text-black">{t.managerLabel}: {review.manager_feedback}</div>}
                              {review.improvement_notes && <div className="text-xs text-black">{t.improvementLabel}: {review.improvement_notes}</div>}
                              {review.notes && <div className="text-xs text-black">{t.notesLabel}: {review.notes}</div>}
                              {review.bonus_amount != null && (
                                <div className="text-xs text-black">
                                  {t.bonusLabel}: {review.bonus_amount} {t.currency}
                                </div>
                              )}
                            </div>
                            <div className="text-xs text-black">
                              {t.scoreLabel}: {review.overall_score ?? '-'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          )}

          {staffTab === 'schedule' && (
            <>
          <div className="mb-6 bg-white/60 rounded-2xl p-4 border border-orange-100 ">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <div className="text-sm font-bold">{t.scheduleCalendar}</div>
              <div className="flex flex-wrap gap-2">
                <select
                  value={calendarEmployeeId}
                  onChange={(e) => setCalendarEmployeeId(e.target.value)}
                  className="px-3 py-2 bg-white  rounded-xl border border-orange-100  text-sm"
                >
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name_en} {emp.last_name_en}
                    </option>
                  ))}
                </select>
                <select
                  value={scheduleViewMode}
                  onChange={(e) => setScheduleViewMode(e.target.value as 'weekly' | 'monthly')}
                  className="px-3 py-2 bg-white  rounded-xl border border-orange-100  text-sm"
                >
                  <option value="weekly">{t.weekly}</option>
                  <option value="monthly">{t.monthly}</option>
                </select>
                {scheduleViewMode === 'weekly' ? (
                  <input
                    type="date"
                    value={scheduleWeekDate}
                    onChange={(e) => setScheduleWeekDate(e.target.value)}
                    className="px-3 py-2 bg-white  rounded-xl border border-orange-100  text-sm"
                  />
                ) : (
                  <input
                    type="month"
                    value={calendarMonth}
                    onChange={(e) => setCalendarMonth(e.target.value)}
                    className="px-3 py-2 bg-white  rounded-xl border border-orange-100  text-sm"
                  />
                )}
                <button
                  type="button"
                  onClick={() => setBulkScheduleOpen(true)}
                  className="px-3 py-2 rounded-xl font-medium bg-orange-600 text-white hover"
                >
                  {t.bulkAssign}
                </button>
              </div>
            </div>
            {scheduleCalendarLoading ? (
              <div className="text-sm text-black">{t.loadingSchedule}</div>
            ) : scheduleViewMode === 'weekly' ? (
              <div>
                <div className="grid grid-cols-7 gap-2 text-xs text-black mb-2">
                  <div>{t.dayMon}</div>
                  <div>{t.dayTue}</div>
                  <div>{t.dayWed}</div>
                  <div>{t.dayThu}</div>
                  <div>{t.dayFri}</div>
                  <div>{t.daySat}</div>
                  <div>{t.daySun}</div>
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {scheduleWeekDays.map(day => (
                    <div
                      key={day.date.toISOString()}
                      className="rounded-lg bg-white  border border-orange-100  p-2 min-h-[72px]"
                    >
                      <div className="text-xs font-semibold">{day.date.getDate()}</div>
                      <div className="text-xs text-black">{formatScheduleLabel(day.schedule)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-7 gap-2 text-xs text-black mb-2">
                  <div>{t.dayMon}</div>
                  <div>{t.dayTue}</div>
                  <div>{t.dayWed}</div>
                  <div>{t.dayThu}</div>
                  <div>{t.dayFri}</div>
                  <div>{t.daySat}</div>
                  <div>{t.daySun}</div>
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {scheduleMonthDays.map(day => (
                    <div
                      key={`${day.date.toISOString()}-${day.inMonth}`}
                      className={`rounded-lg border p-2 min-h-[72px] ${
                        day.inMonth
                          ? 'bg-white  border-orange-100 '
                          : 'bg-white/40 border-orange-100  text-black'
                      }`}
                    >
                      <div className="text-xs font-semibold">{day.date.getDate()}</div>
                      <div className="text-xs text-black">{formatScheduleLabel(day.schedule)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {bulkScheduleOpen && (
              <div className="mt-4 border-t border-orange-100  pt-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
                  <div className="text-sm font-bold">{t.bulkScheduleAssignment}</div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={selectAllBulkScheduleEmployees}
                      className="px-3 py-2 rounded-xl font-medium bg-white "
                    >
                      {t.selectAll}
                    </button>
                    <button
                      type="button"
                      onClick={clearBulkScheduleEmployees}
                      className="px-3 py-2 rounded-xl font-medium bg-white "
                    >
                      {t.clear}
                    </button>
                    <button
                      type="button"
                      onClick={() => setBulkScheduleOpen(false)}
                      className="px-3 py-2 rounded-xl font-medium bg-white "
                    >
                      {t.close}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-60 overflow-auto pr-1">
                  {employees.map(emp => (
                    <label key={emp.id} className="flex items-center gap-2 text-sm bg-white  border border-orange-100  rounded-xl p-2">
                      <input
                        type="checkbox"
                        checked={bulkScheduleEmployeeIds.includes(emp.id)}
                        onChange={() => toggleBulkScheduleEmployee(emp.id)}
                        className="h-4 w-4"
                      />
                      <span className="truncate">{emp.first_name_en} {emp.last_name_en}</span>
                    </label>
                  ))}
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={applyBulkSchedule}
                    disabled={bulkScheduleSaving}
                    className="px-4 py-2 rounded-xl font-bold bg-orange-600 text-white  disabled:opacity-50"
                  >
                    {bulkScheduleSaving ? t.applying : t.applySchedule}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="mb-6 bg-white/60 rounded-2xl p-4 border border-orange-100 ">
            <div className="text-sm font-bold mb-4">{t.shiftSwapRequests}</div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-white  rounded-2xl p-4 border border-orange-100 ">
                <div className="text-sm font-semibold mb-3">{t.newRequest}</div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">{t.requester}</label>
                    <select
                      value={swapRequesterId}
                      onChange={(e) => setSwapRequesterId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white text-black border-none"
                    >
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.first_name_en} {emp.last_name_en}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">{t.targetLabel}</label>
                    <select
                      value={swapTargetId}
                      onChange={(e) => setSwapTargetId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white text-black border-none"
                    >
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.first_name_en} {emp.last_name_en}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">{t.shiftDate}</label>
                    <input
                      type="date"
                      value={swapDate}
                      onChange={(e) => setSwapDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white text-black border-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">{t.reason}</label>
                    <input
                      type="text"
                      value={swapReason}
                      onChange={(e) => setSwapReason(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white text-black border-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={submitSwapRequest}
                    disabled={swapRequestSubmitting}
                    className="w-full px-4 py-2 rounded-xl font-bold bg-orange-600 text-white  disabled:opacity-50"
                  >
                    {swapRequestSubmitting ? t.submitting : t.submitRequest}
                  </button>
                </div>
              </div>
              <div className="lg:col-span-2 bg-white  rounded-2xl p-4 border border-orange-100 ">
                <div className="text-sm font-semibold mb-3">{t.requestsLabel}</div>
                {swapRequestsLoading ? (
                  <div className="text-sm text-black">{t.loadingRequests}</div>
                ) : swapRequests.length === 0 ? (
                  <div className="text-sm text-black">{t.noSwapRequests}</div>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-auto pr-1">
                    {swapRequests.map(request => (
                      <div key={request.id} className="rounded-xl border border-orange-100  p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-medium">
                              {(request.requester?.first_name_en || t.unknown)} {(request.requester?.last_name_en || '')} → {(request.target?.first_name_en || t.unknown)} {(request.target?.last_name_en || '')}
                            </div>
                            <div className="text-xs text-black">{request.shift_date}</div>
                            {request.reason && (
                              <div className="text-xs text-black mt-1">{request.reason}</div>
                            )}
                          </div>
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              request.status === 'pending'
                                ? 'bg-white text-yellow-800 border border-yellow-200'
                                : request.status === 'approved'
                                ? 'bg-white text-green-800 border border-green-200'
                                : request.status === 'rejected'
                                ? 'bg-white text-red-800 border border-red-200'
                                : 'bg-white text-black border border-orange-100'
                            }`}
                          >
                            {request.status}
                          </span>
                        </div>
                        {request.status === 'pending' && isPrivileged && (
                          <div className="mt-3 space-y-2">
                            <input
                              type="text"
                              placeholder={t.managerNoteOptional}
                              value={swapReviewNotes[request.id] || ''}
                              onChange={(e) =>
                                setSwapReviewNotes(prev => ({ ...prev, [request.id]: e.target.value }))
                              }
                              className="w-full px-3 py-2 rounded-xl bg-white text-black border-none"
                            />
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => approveSwapRequest(request)}
                                disabled={swapRequestsLoading}
                                className="px-3 py-2 rounded-xl font-medium bg-orange-600 text-white  disabled:opacity-50"
                              >
                                {t.approve}
                              </button>
                              <button
                                type="button"
                                onClick={() => rejectSwapRequest(request)}
                                disabled={swapRequestsLoading}
                                className="px-3 py-2 rounded-xl font-medium bg-white "
                              >
                                {t.reject}
                              </button>
                            </div>
                          </div>
                        )}
                        {request.status !== 'pending' && request.manager_comment && (
                          <div className="text-xs text-black mt-2">{t.managerNote}: {request.manager_comment}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
            </>
          )}

          {staffTab === 'overview' && (
            <>
          <div className="mb-6 flex flex-col md:flex-row gap-3 items-center">
            <input
              type="text"
              placeholder={t.enterEmployeeIdOrPin}
              value={quickClockValue}
              onChange={(e) => setQuickClockValue(e.target.value)}
              className="w-full md:max-w-sm px-4 py-3 bg-white  rounded-xl outline-none focus:ring-2 focus:ring-stone-500"
            />
            <button
              onClick={handleQuickClockIn}
              disabled={quickClocking}
              className="px-4 py-3 rounded-xl font-medium bg-orange-600 text-white  disabled:opacity-50"
            >
              {quickClocking ? t.clockingIn : t.clockIn}
            </button>
          </div>

          {manualEntryEmployee && (
            <div className="mb-6 p-4 rounded-2xl bg-white/60 border border-orange-100 ">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="font-bold text-sm">{t.manualAttendanceEntry}</div>
                  <div className="text-xs text-black">
                    {manualEntryEmployee.first_name_en} {manualEntryEmployee.last_name_en} • {manualEntryEmployee.employee_id}
                  </div>
                </div>
                <button
                  onClick={closeManualEntry}
                  className="px-3 py-1 rounded-full text-xs font-bold bg-white "
                >
                  {t.close}
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t.clockIn}</label>
                  <input
                    type="datetime-local"
                    value={manualClockInAt}
                    onChange={(e) => setManualClockInAt(e.target.value)}
                    className="w-full p-2 rounded-lg bg-white  border border-orange-100 "
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t.clockOut}</label>
                  <input
                    type="datetime-local"
                    value={manualClockOutAt}
                    onChange={(e) => setManualClockOutAt(e.target.value)}
                    className="w-full p-2 rounded-lg bg-white  border border-orange-100 "
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t.reason}</label>
                  <input
                    type="text"
                    value={manualReason}
                    onChange={(e) => setManualReason(e.target.value)}
                    className="w-full p-2 rounded-lg bg-white  border border-orange-100 "
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={closeManualEntry}
                  className="px-4 py-2 rounded-xl bg-white "
                >
                  {t.cancel}
                </button>
                <button
                  onClick={handleManualEntrySave}
                  disabled={manualSubmitting}
                  className="px-4 py-2 rounded-xl bg-orange-600 text-white  font-bold disabled:opacity-50"
                >
                  {manualSubmitting ? t.saving : t.saveManualEntry}
                </button>
              </div>
            </div>
          )}

          {viewMode === 'list' ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-black border-b border-orange-100 ">
                    <th className="pb-4 pl-4">{t.staffId}</th>
                    <th className="pb-4">{t.name}</th>
                    <th className="pb-4">{t.role}</th>
                    <th className="pb-4">{t.departmentLabel}</th>
                    <th className="pb-4">{t.branchLabel}</th>
                    <th className="pb-4">{t.grossSalary}</th>
                    <th className="pb-4">{t.status}</th>
                    <th className="pb-4">{t.tenure}</th>
                    <th className="pb-4">{t.clock}</th>
                    <th className="pb-4 pr-4 text-right">{t.action}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 ">
                  {loading ? (
                    <tr><td colSpan={9} className="text-center py-8">{t.loadingStaff}</td></tr>
                  ) : filteredEmployees.length === 0 ? (
                    <tr><td colSpan={9} className="text-center py-8">{t.noEmployees}</td></tr>
                  ) : (
                    filteredEmployees.map(emp => (
                      <tr key={emp.id} className=" /50 transition-colors">
                        <td className="py-4 pl-4 font-mono text-sm">{emp.employee_id}</td>
                        <td className="py-4">
                          <div className="font-bold">{emp.first_name_en} {emp.last_name_en}</div>
                          <div className="text-xs text-black">{emp.email}</div>
                        </td>
                        <td className="py-4">
                          <span className="px-3 py-1 bg-white  rounded-full text-xs font-medium">
                            {emp.role}
                          </span>
                        </td>
                        <td className="py-4">{emp.department || '-'}</td>
                        <td className="py-4">{locations.find(l => l.id === emp.location_id)?.name || '-'}</td>
                        <td className="py-4 text-sm font-mono">
                          {formatCurrency(calculateMonthlyGrossSalary(emp.salary_base, emp.salary_allowances))} QAR
                        </td>
                        <td className="py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                            emp.employment_status === 'Active' ? 'bg-white text-green-800 border-green-200' :
                            emp.employment_status === 'Probation' ? 'bg-white text-yellow-800 border-yellow-200' :
                            'bg-white text-red-800 border-red-200'
                          }`}>
                            {emp.employment_status}
                          </span>
                        </td>
                        <td className="py-4 text-sm text-black">{calculateTenure(emp.hire_date)}</td>
                        <td className="py-4">
                          {openTimeLogs[emp.id] ? (
                            <button
                              onClick={() => handleClockOut(emp)}
                              disabled={clockingEmployeeIds[emp.id]}
                              className="px-3 py-1 rounded-full text-xs font-bold bg-white text-red-800 border border-red-200 hover:bg-red-50 disabled:opacity-50"
                            >
                              <span className="inline-flex items-center gap-1">
                                <Clock size={12} />
                                {clockingEmployeeIds[emp.id] ? t.clockingOut : t.clockOut}
                              </span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleClockIn(emp)}
                              disabled={clockingEmployeeIds[emp.id]}
                              className="px-3 py-1 rounded-full text-xs font-bold bg-white text-green-800 border border-green-200 hover:bg-green-50 disabled:opacity-50"
                            >
                              <span className="inline-flex items-center gap-1">
                                <Clock size={12} />
                                {clockingEmployeeIds[emp.id] ? t.clockingIn : t.clockIn}
                              </span>
                            </button>
                          )}
                          {isPrivileged && (
                            <button
                              onClick={() => openManualEntry(emp)}
                              className="ml-2 px-3 py-1 rounded-full text-xs font-bold bg-white text-black"
                            >
                              {t.manualEntry}
                            </button>
                          )}
                        </td>
                        <td className="py-4 pr-4 text-right">
                          <button 
                            onClick={() => {
                              setEditingEmployee(emp);
                              setUploadedPhotoUrl(emp.photo_url || null);
                              reset({
                                ...emp,
                                salary_base: Number(emp.salary_base),
                                salary_allowances: Number(emp.salary_allowances),
                                shift_break_minutes: Number(emp.shift_break_minutes ?? 0),
                                shift_grace_minutes: Number(emp.shift_grace_minutes ?? 15)
                              });
                              setShowForm(true);
                            }}
                            className="p-2 rounded-full text-black  "
                          >
                            <Edit size={18} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div>
              {loading ? (
                <div className="text-center py-12">{t.loadingStaff}</div>
              ) : filteredEmployees.length === 0 ? (
                <div className="text-center py-12">{t.noEmployees}</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredEmployees.map(emp => (
                    <div key={emp.id} className="bg-white/50 rounded-2xl p-4 border border-orange-100 ">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-white  flex items-center justify-center overflow-hidden">
                          {emp.photo_url ? (
                            <img src={emp.photo_url} alt={`${emp.first_name_en} ${emp.last_name_en}`} className="w-full h-full object-cover" />
                          ) : (
                            <span className="font-bold text-black ">
                              {(emp.first_name_en?.[0] || '') + (emp.last_name_en?.[0] || '')}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold truncate">{emp.first_name_en} {emp.last_name_en}</div>
                          <div className="text-xs text-black truncate">{emp.role}</div>
                          <div className="text-xs text-black truncate">{emp.department || '-'}</div>
                          <div className="text-xs text-black truncate">{locations.find(l => l.id === emp.location_id)?.name || '-'}</div>
                        </div>
                        <button 
                          onClick={() => {
                            setEditingEmployee(emp);
                            setUploadedPhotoUrl(emp.photo_url || null);
                            reset({
                              ...emp,
                              salary_base: Number(emp.salary_base),
                              salary_allowances: Number(emp.salary_allowances),
                              shift_break_minutes: Number(emp.shift_break_minutes ?? 0),
                              shift_grace_minutes: Number(emp.shift_grace_minutes ?? 15)
                            });
                            setShowForm(true);
                          }}
                          className="p-2 rounded-full text-black  "
                        >
                          <Edit size={18} />
                        </button>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                            emp.employment_status === 'Active' ? 'bg-white text-green-800 border-green-200' :
                            emp.employment_status === 'Probation' ? 'bg-white text-yellow-800 border-yellow-200' :
                            'bg-white text-red-800 border-red-200'
                          }`}>
                          {emp.employment_status}
                        </span>
                        <div className="text-xs text-black font-mono">{emp.employee_id}</div>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-black">
                        <span>{t.grossSalary}</span>
                        <span className="font-mono text-black ">
                          {formatCurrency(calculateMonthlyGrossSalary(emp.salary_base, emp.salary_allowances))} QAR
                        </span>
                      </div>
                      <div className="mt-3">
                        {openTimeLogs[emp.id] ? (
                          <button
                            onClick={() => handleClockOut(emp)}
                            disabled={clockingEmployeeIds[emp.id]}
                            className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-white text-red-800 border border-red-200 hover:bg-red-50 disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            <Clock size={14} />
                            {clockingEmployeeIds[emp.id] ? t.clockingOut : t.clockOut}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleClockIn(emp)}
                            disabled={clockingEmployeeIds[emp.id]}
                            className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-white text-green-800 border border-green-200 hover:bg-green-50 disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            <Clock size={14} />
                            {clockingEmployeeIds[emp.id] ? t.clockingIn : t.clockIn}
                          </button>
                        )}
                        {isPrivileged && (
                          <button
                            onClick={() => openManualEntry(emp)}
                            className="w-full mt-2 px-3 py-2 rounded-xl text-xs font-bold bg-white text-black"
                          >
                            {t.manualEntry}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
            </>
          )}
        </div>
      ) : (
        /* Form View */
        <div className="bg-white  rounded-3xl p-6 shadow-sm border border-orange-100  max-w-5xl mx-auto flex flex-col h-[85vh]">
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-orange-100 ">
            <div>
              <h2 className="text-2xl font-bold">{editingEmployee ? `${t.editEmployee}: ${editingEmployee.employee_id}` : t.newEmployee}</h2>
              <p className="text-sm text-black">{t.staffManagementSubtitle}</p>
            </div>
            <button onClick={() => setShowForm(false)} className="p-2 rounded-full hover:bg-stone-100 transition-colors">
              <X size={24} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2 no-scrollbar">
            <button
              onClick={() => setFormTab('personal')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-colors whitespace-nowrap ${
                formTab === 'personal' ? 'bg-orange-600 text-white' : 'bg-stone-100 text-black hover:bg-stone-200'
              } ${hasTabErrors('personal') ? 'ring-2 ring-red-500' : ''}`}
            >
              <User size={18} /> {t.personalInfo}
            </button>
            <button
              onClick={() => setFormTab('contact')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-colors whitespace-nowrap ${
                formTab === 'contact' ? 'bg-orange-600 text-white' : 'bg-stone-100 text-black hover:bg-stone-200'
              } ${hasTabErrors('contact') ? 'ring-2 ring-red-500' : ''}`}
            >
              <Phone size={18} /> {t.contactInfo}
            </button>
            <button
              onClick={() => setFormTab('employment')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-colors whitespace-nowrap ${
                formTab === 'employment' ? 'bg-orange-600 text-white' : 'bg-stone-100 text-black hover:bg-stone-200'
              } ${hasTabErrors('employment') ? 'ring-2 ring-red-500' : ''}`}
            >
              <Briefcase size={18} /> {t.employmentDetails}
            </button>
             <button
              onClick={() => setFormTab('financial')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-colors whitespace-nowrap ${
                formTab === 'financial' ? 'bg-orange-600 text-white' : 'bg-stone-100 text-black hover:bg-stone-200'
              } ${hasTabErrors('financial') ? 'ring-2 ring-red-500' : ''}`}
            >
              <CreditCard size={18} /> {t.financialInfo}
            </button>
            <button
              onClick={() => setFormTab('schedule')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-colors whitespace-nowrap ${
                formTab === 'schedule' ? 'bg-orange-600 text-white' : 'bg-stone-100 text-black hover:bg-stone-200'
              } ${hasTabErrors('schedule') ? 'ring-2 ring-red-500' : ''}`}
            >
              <Clock size={18} /> {t.weeklySchedule}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-6 pb-20">
            
            {/* Section 1: Personal Information */}
            {formTab === 'personal' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center gap-4 mb-4">
                 <div className="w-24 h-24 rounded-full bg-white  flex items-center justify-center overflow-hidden border border-orange-100  relative group">
                    {uploadedPhotoUrl ? (
                      <img src={uploadedPhotoUrl} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <User size={40} className="text-black" />
                    )}
                    <label className="absolute inset-0 bg-white/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      <Upload size={20} className="text-white" />
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                    </label>
                    {uploading && <div className="absolute inset-0 bg-white/50 flex items-center justify-center"><Loader2 size={20} className="text-white animate-spin" /></div>}
                 </div>
                 <div>
                    <h3 className="text-lg font-bold flex items-center gap-2 text-black"><User size={20} /> {t.personalInfo}</h3>
                    <p className="text-sm text-black">{t.uploadProfilePic}</p>
                 </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t.firstNameEn}*</label>
                  <input {...register('first_name_en')} className="w-full p-2 rounded-lg bg-white text-black border-none" />
                  {errors.first_name_en && <span className="text-red-500 text-xs">{errors.first_name_en.message}</span>}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t.lastNameEn}*</label>
                  <input {...register('last_name_en')} className="w-full p-2 rounded-lg bg-white text-black border-none" />
                  {errors.last_name_en && <span className="text-red-500 text-xs">{errors.last_name_en.message}</span>}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t.firstNameAr}</label>
                  <input {...register('first_name_ar')} className="w-full p-2 rounded-lg bg-white text-black border-none text-right" dir="rtl" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t.lastNameAr}</label>
                  <input {...register('last_name_ar')} className="w-full p-2 rounded-lg bg-white text-black border-none text-right" dir="rtl" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t.nationality}</label>
                  <input {...register('nationality')} className="w-full p-2 rounded-lg bg-white text-black border-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t.gender}</label>
                  <select {...register('gender')} className="w-full p-2 rounded-lg bg-white text-black border-none">
                    <option value="">{t.selectOption}</option>
                    <option value="Male">{t.male}</option>
                    <option value="Female">{t.female}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t.dob} {watch('dob') && <span className="text-black font-normal">({calculateAge(watch('dob'))} years old)</span>}</label>
                  <input type="date" {...register('dob')} className="w-full p-2 rounded-lg bg-white text-black border-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t.maritalStatus}</label>
                  <select {...register('marital_status')} className="w-full p-2 rounded-lg bg-white text-black border-none">
                    <option value="">{t.selectOption}</option>
                    <option value="Single">{t.single}</option>
                    <option value="Married">{t.married}</option>
                    <option value="Divorced">{t.divorced}</option>
                    <option value="Widowed">{t.widowed}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t.nationalIdHomeCountry}</label>
                  <input {...register('national_id')} className="w-full p-2 rounded-lg bg-white text-black border-none" />
                </div>
              </div>
            </div>
            )}

            {/* Section 2: Contact Information */}
            {formTab === 'contact' && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-lg font-bold flex items-center gap-2 text-black"><Phone size={20} /> {t.contactInfo}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t.phone}*</label>
                  <input {...register('phone')} className="w-full p-2 rounded-lg bg-white text-black border-none" placeholder="+974..." />
                  {errors.phone && <span className="text-red-500 text-xs">{errors.phone.message}</span>}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t.emailLabel}*</label>
                  <input {...register('email')} className="w-full p-2 rounded-lg bg-white text-black border-none" />
                  {errors.email && <span className="text-red-500 text-xs">{errors.email.message}</span>}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t.emergencyContact} ({t.name})</label>
                  <input {...register('emergency_contact_name')} className="w-full p-2 rounded-lg bg-white text-black border-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t.emergencyContact} ({t.phone})</label>
                  <input {...register('emergency_contact_phone')} className="w-full p-2 rounded-lg bg-white text-black border-none" />
                </div>
              </div>
            </div>
            )}

            {/* Section 3: Employment Details */}
            {formTab === 'employment' && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-lg font-bold flex items-center gap-2 text-black"><Briefcase size={20} /> {t.employmentDetails}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t.joinDate}*</label>
                  <input type="date" {...register('hire_date')} className="w-full p-2 rounded-lg bg-white text-black border-none" />
                  {errors.hire_date && <span className="text-red-500 text-xs">{errors.hire_date.message}</span>}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t.departmentLabel}</label>
                  <input {...register('department')} className="w-full p-2 rounded-lg bg-white text-black border-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t.role}</label>
                  <input {...register('position')} className="w-full p-2 rounded-lg bg-white text-black border-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t.reportingManager}</label>
                  <select {...register('manager_id')} className="w-full p-2 rounded-lg bg-white text-black border-none">
                    <option value="">{t.none}</option>
                    {employees
                      .filter(e => !editingEmployee || e.id !== editingEmployee.id)
                      .map(mgr => (
                        <option key={mgr.id} value={mgr.id}>
                          {mgr.first_name_en} {mgr.last_name_en}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t.systemRole}*</label>
                  <select {...register('role')} className="w-full p-2 rounded-lg bg-white text-black border-none">
                    {Object.values(UserRole).map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t.workLocation}</label>
                  <select {...register('location_id')} className="w-full p-2 rounded-lg bg-white text-black border-none">
                    <option value="">{t.branchLabel}</option>
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t.contractType}</label>
                  <select {...register('employment_type')} className="w-full p-2 rounded-lg bg-white text-black border-none">
                    <option value="Full-time">{t.fullTime}</option>
                    <option value="Part-time">{t.partTime}</option>
                    <option value="Contract">{t.contract}</option>
                    <option value="Intern">{t.intern}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t.shiftTemplate}</label>
                  <select
                    {...shiftTemplateRegister}
                    onChange={(e) => {
                      shiftTemplateRegister.onChange(e);
                      const template = SHIFT_TEMPLATES[e.target.value as ShiftTemplate];
                      if (template) {
                        setValue('shift_start_time', template.start);
                        setValue('shift_end_time', template.end);
                      }
                    }}
                    className="w-full p-2 rounded-lg bg-white text-black border-none"
                  >
                    <option value="">{t.custom}</option>
                    <option value="Morning">{t.morningShift}</option>
                    <option value="Evening">{t.eveningShift}</option>
                    <option value="Night">{t.nightShift}</option>
                    <option value="Split">{t.splitShift}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t.shiftStart}</label>
                  <input type="time" {...register('shift_start_time')} className="w-full p-2 rounded-lg bg-white text-black border-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t.shiftEnd}</label>
                  <input type="time" {...register('shift_end_time')} className="w-full p-2 rounded-lg bg-white text-black border-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t.breakTime}</label>
                  <input
                    type="number"
                    min={0}
                    {...register('shift_break_minutes', { valueAsNumber: true })}
                    className="w-full p-2 rounded-lg bg-white text-black border-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t.gracePeriod}</label>
                  <input
                    type="number"
                    min={0}
                    {...register('shift_grace_minutes', { valueAsNumber: true })}
                    className="w-full p-2 rounded-lg bg-white text-black border-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t.pinCode}</label>
                  <input type="password" {...register('employee_pin')} className="w-full p-2 rounded-lg bg-white text-black border-none" />
                </div>
                <div className="flex items-center gap-2 mt-6">
                  <input type="checkbox" {...register('is_on_leave')} className="h-4 w-4" />
                  <span className="text-sm font-medium">{t.onLeave}</span>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t.employmentStatus}</label>
                  <select {...register('employment_status')} className="w-full p-2 rounded-lg bg-white text-black border-none">
                    <option value="Active">{t.active}</option>
                    <option value="Probation">{t.probation}</option>
                    <option value="Suspended">{t.suspended}</option>
                    <option value="Terminated">{t.terminated}</option>
                    <option value="Resigned">{t.resigned}</option>
                  </select>
                </div>
              </div>
            </div>
            )}

            {formTab === 'schedule' && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-lg font-bold flex items-center gap-2 text-black"><Clock size={20} /> {t.weeklySchedule}</h3>
              {!editingEmployee ? (
                <div className="text-sm text-black">{t.saveEmployeeFirst}</div>
              ) : weeklyScheduleLoading ? (
                <div className="text-sm text-black">{t.loadingSchedule}</div>
              ) : (
                <div className="space-y-3">
                  {weeklySchedule.map((day, index) => (
                    <div key={day.day_of_week} className="grid grid-cols-1 md:grid-cols-5 gap-2 items-center">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={day.is_working}
                          onChange={(e) => updateWeeklySchedule(index, { is_working: e.target.checked })}
                          className="h-4 w-4"
                        />
                        <span className="text-sm font-medium">{weekDayLabels[day.day_of_week]}</span>
                      </div>
                      <input
                        type="time"
                        value={day.start_time}
                        disabled={!day.is_working}
                        onChange={(e) => updateWeeklySchedule(index, { start_time: e.target.value })}
                        className="w-full p-2 rounded-lg bg-white text-black border-none disabled:opacity-50"
                      />
                      <input
                        type="time"
                        value={day.end_time}
                        disabled={!day.is_working}
                        onChange={(e) => updateWeeklySchedule(index, { end_time: e.target.value })}
                        className="w-full p-2 rounded-lg bg-white text-black border-none disabled:opacity-50"
                      />
                      <input
                        type="number"
                        min={0}
                        value={day.break_minutes}
                        disabled={!day.is_working}
                        onChange={(e) => updateWeeklySchedule(index, { break_minutes: Number(e.target.value) })}
                        className="w-full p-2 rounded-lg bg-white text-black border-none disabled:opacity-50"
                        placeholder={t.breakPlaceholder}
                      />
                      <input
                        type="number"
                        min={0}
                        value={day.grace_minutes}
                        disabled={!day.is_working}
                        onChange={(e) => updateWeeklySchedule(index, { grace_minutes: Number(e.target.value) })}
                        className="w-full p-2 rounded-lg bg-white text-black border-none disabled:opacity-50"
                        placeholder={t.gracePlaceholder}
                      />
                    </div>
                  ))}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={saveWeeklySchedule}
                      disabled={weeklyScheduleSaving}
                      className="bg-orange-600 text-white  px-4 py-2 rounded-xl font-bold hover:opacity-90 disabled:opacity-50"
                    >
                      {weeklyScheduleSaving ? t.saving : t.saveSchedule}
                    </button>
                  </div>
                </div>
              )}
            </div>
            )}

            {/* Section 4: Qatar Specifics */}
            {formTab === 'employment' && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-lg font-bold flex items-center gap-2 text-black"><MapPin size={20} /> {t.qatarLegal}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t.qid} {t.qidDigitsLabel}</label>
                  <input {...register('qid')} className="w-full p-2 rounded-lg bg-white text-black border-none" placeholder="299..." />
                  {errors.qid && <span className="text-red-500 text-xs">{errors.qid.message}</span>}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t.visaStatus}</label>
                  <select {...register('visa_status')} className="w-full p-2 rounded-lg bg-white text-black border-none">
                    <option value="">{t.selectOption}</option>
                    <option value="Work Visa">{t.workVisa}</option>
                    <option value="Family Visit">{t.familyVisitVisa}</option>
                    <option value="Business">{t.businessVisa}</option>
                    <option value="Resident">{t.residentVisa}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t.expiryDate}</label>
                  <input type="date" {...register('visa_expiry')} className="w-full p-2 rounded-lg bg-white text-black border-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t.healthCardExpiry}</label>
                  <input type="date" {...register('health_card_expiry')} className="w-full p-2 rounded-lg bg-white text-black border-none" />
                </div>
              </div>
            </div>
            )}

            {/* Section 5: Financials */}
            {formTab === 'financial' && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-lg font-bold flex items-center gap-2 text-black"><CreditCard size={20} /> {t.financialInfo}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t.baseSalary} ({t.currency})</label>
                  <input type="number" {...register('salary_base', { valueAsNumber: true })} className="w-full p-2 rounded-lg bg-white text-black border-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t.allowances} ({t.currency})</label>
                  <input type="number" {...register('salary_allowances', { valueAsNumber: true })} className="w-full p-2 rounded-lg bg-white text-black border-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t.monthlyGrossSalary} ({t.currency})</label>
                  <div className="w-full p-2 rounded-lg bg-white text-black border-none font-mono text-black ">
                    {formatCurrency(calculateMonthlyGrossSalary(watch('salary_base'), watch('salary_allowances')))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t.bankName}</label>
                  <input {...register('bank_name')} className="w-full p-2 rounded-lg bg-white text-black border-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t.iban}</label>
                  <input {...register('iban')} className="w-full p-2 rounded-lg bg-white text-black border-none" placeholder="QA..." />
                </div>
              </div>
              {!editingEmployee ? (
                <div className="text-sm text-black">{t.saveEmployeeAdvance}</div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-white/60 rounded-2xl p-4 border border-orange-100  space-y-3">
                      <div className="font-semibold">{t.newSalaryAdvance}</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium mb-1 text-black">{t.amount} ({t.currency})</label>
                          <input
                            type="number"
                            value={salaryAdvanceForm.amount}
                            onChange={(e) => setSalaryAdvanceForm({ ...salaryAdvanceForm, amount: e.target.value })}
                            className="w-full p-2 rounded-lg bg-white text-black border-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1 text-black">{t.monthlyDeduction} ({t.currency})</label>
                          <input
                            type="number"
                            value={salaryAdvanceForm.monthly_deduction}
                            onChange={(e) => setSalaryAdvanceForm({ ...salaryAdvanceForm, monthly_deduction: e.target.value })}
                            className="w-full p-2 rounded-lg bg-white text-black border-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1 text-black">{t.requestedDate}</label>
                          <input
                            type="date"
                            value={salaryAdvanceForm.requested_at}
                            onChange={(e) => setSalaryAdvanceForm({ ...salaryAdvanceForm, requested_at: e.target.value })}
                            className="w-full p-2 rounded-lg bg-white text-black border-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1 text-black">{t.reason}</label>
                          <input
                            type="text"
                            value={salaryAdvanceForm.reason}
                            onChange={(e) => setSalaryAdvanceForm({ ...salaryAdvanceForm, reason: e.target.value })}
                            className="w-full p-2 rounded-lg bg-white text-black border-none"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={handleCreateSalaryAdvance}
                          disabled={salaryAdvanceSaving || !salaryAdvanceForm.amount}
                          className="bg-orange-600 text-white  px-4 py-2 rounded-xl font-bold hover:opacity-90 disabled:opacity-50"
                        >
                          {salaryAdvanceSaving ? t.saving : t.createAdvance}
                        </button>
                      </div>
                    </div>
                    <div className="bg-white/60 rounded-2xl p-4 border border-orange-100  space-y-3">
                      <div className="font-semibold">{t.recordRepayment}</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium mb-1 text-black">{t.salaryAdvance}</label>
                          <select
                            value={salaryAdvancePaymentForm.advance_id}
                            onChange={(e) => setSalaryAdvancePaymentForm({ ...salaryAdvancePaymentForm, advance_id: e.target.value })}
                            className="w-full p-2 rounded-lg bg-white text-black border-none"
                          >
                            <option value="">{t.selectAdvance}</option>
                            {salaryAdvances.map(advance => (
                              <option key={advance.id} value={advance.id}>
                                {advance.requested_at} • {formatCurrency(Number(advance.amount))} {t.currency}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1 text-black">{t.amount} ({t.currency})</label>
                          <input
                            type="number"
                            value={salaryAdvancePaymentForm.amount}
                            onChange={(e) => setSalaryAdvancePaymentForm({ ...salaryAdvancePaymentForm, amount: e.target.value })}
                            className="w-full p-2 rounded-lg bg-white text-black border-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1 text-black">{t.paidDate}</label>
                          <input
                            type="date"
                            value={salaryAdvancePaymentForm.paid_at}
                            onChange={(e) => setSalaryAdvancePaymentForm({ ...salaryAdvancePaymentForm, paid_at: e.target.value })}
                            className="w-full p-2 rounded-lg bg-white text-black border-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1 text-black">{t.notes}</label>
                          <input
                            type="text"
                            value={salaryAdvancePaymentForm.notes}
                            onChange={(e) => setSalaryAdvancePaymentForm({ ...salaryAdvancePaymentForm, notes: e.target.value })}
                            className="w-full p-2 rounded-lg bg-white text-black border-none"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={handleCreateSalaryAdvancePayment}
                          disabled={salaryAdvancePaymentSaving || !salaryAdvancePaymentForm.amount || !salaryAdvancePaymentForm.advance_id}
                          className="bg-orange-600 text-white  px-4 py-2 rounded-xl font-bold hover:opacity-90 disabled:opacity-50"
                        >
                          {salaryAdvancePaymentSaving ? t.saving : t.recordPayment}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white/60 rounded-2xl p-4 border border-orange-100 ">
                    <div className="font-semibold mb-3">{t.advancesOverview}</div>
                    {salaryAdvances.length === 0 ? (
                      <div className="text-sm text-black">{t.noAdvances}</div>
                    ) : (
                      <div className="space-y-3 text-sm">
                        {salaryAdvances.map(advance => {
                          const paid = salaryAdvancePaidMap[advance.id] || 0;
                          const remaining = Math.max(0, Number(advance.amount) - paid);
                          const status = remaining <= 0 ? 'closed' : advance.status;
                          return (
                            <div key={advance.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 bg-white  rounded-xl p-3 border border-orange-100 ">
                              <div>
                                <div className="font-semibold">{advance.requested_at}</div>
                                <div className="text-xs text-black">{advance.reason || t.noNotes}</div>
                              </div>
                              <div className="flex flex-wrap gap-3 text-xs">
                                <div>
                                  <div className="text-black">{t.amount}</div>
                                  <div className="font-semibold">{formatCurrency(Number(advance.amount))} {t.currency}</div>
                                </div>
                                <div>
                                  <div className="text-black">{t.paid}</div>
                                  <div className="font-semibold">{formatCurrency(paid)} {t.currency}</div>
                                </div>
                                <div>
                                  <div className="text-black">{t.remaining}</div>
                                  <div className="font-semibold">{formatCurrency(remaining)} {t.currency}</div>
                                </div>
                                <div>
                                  <div className="text-black">{t.monthlyDeduction}</div>
                                  <div className="font-semibold">{formatCurrency(Number(advance.monthly_deduction || 0))} {t.currency}</div>
                                </div>
                                <div>
                                  <div className="text-black">{t.status}</div>
                                  <div className={`font-semibold ${status === 'closed' ? 'text-green-600' : status === 'cancelled' ? 'text-red-600' : 'text-yellow-600'}`}>
                                    {status}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="bg-white/60 rounded-2xl p-4 border border-orange-100 ">
                    <div className="font-semibold mb-3">{t.repaymentHistory}</div>
                    {salaryAdvancePayments.length === 0 ? (
                      <div className="text-sm text-black">{t.noRepayments}</div>
                    ) : (
                      <div className="space-y-2 text-sm">
                        {salaryAdvancePayments.map(payment => (
                          <div key={payment.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 bg-white  rounded-xl p-3 border border-orange-100 ">
                            <div>
                              <div className="font-semibold">{payment.paid_at}</div>
                              <div className="text-xs text-black">{payment.notes || t.noNotes}</div>
                            </div>
                            <div className="font-semibold">{formatCurrency(Number(payment.amount))} {t.currency}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            )}

            <div className="sticky bottom-0 bg-white pt-4 pb-4 border-t border-orange-100 flex justify-end gap-4 z-10">
              <button 
                type="button" 
                onClick={() => setShowForm(false)}
                className="px-6 py-2 rounded-xl text-black bg-stone-100 hover:bg-stone-200 font-medium transition-colors"
              >
                {t.cancel}
              </button>
              <button 
                type="submit" 
                disabled={loading}
                className="bg-orange-600 text-white px-8 py-2 rounded-xl font-bold hover:bg-orange-700 disabled:opacity-50 transition-colors shadow-lg shadow-orange-200"
              >
                {loading ? t.saving : t.saveProfile}
              </button>
            </div>

          </form>
          </div>
        </div>
      )}
    </div>
  );
}
