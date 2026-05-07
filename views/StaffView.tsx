import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Users,
  Plus,
  Search,
  FileText,
  Download,
  Clock,
  Edit,
  X,
  Upload,
  CreditCard,
  Printer,
  MapPin,
  Phone,
  User,
  Briefcase,
  Loader2,
  Filter,
  Grid3X3,
  List,
  MoreVertical,
  Calendar,
  TrendingUp,
  Award,
  Wallet,
  Building,
} from 'lucide-react';
import { useLanguage } from '../App';
import { useErrorToast } from '../hooks/useErrorToast';
import { Employee, UserRole, Location } from '../types';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';

// --- Zod Schema ---
const createEmployeeSchema = (t: Record<string, string>) =>
  z.object({
    first_name_en: z.string().min(2, t.firstNameEnRequired || 'First name is required'),
    last_name_en: z.string().min(2, t.lastNameEnRequired || 'Last name is required'),
    first_name_ar: z.string().optional(),
    last_name_ar: z.string().optional(),
    national_id: z.string().optional(),
    nationality: z.string().optional(),
    dob: z.string().optional(),
    gender: z.enum(['Male', 'Female'] as const).optional(),
    marital_status: z.string().optional(),

    phone: z.string().min(8, t.phoneRequired || 'Phone is required'),
    email: z.string().email(t.invalidEmail || 'Invalid email'),
    emergency_contact_name: z.string().optional(),
    emergency_contact_phone: z.string().optional(),

    hire_date: z.string().min(1, t.hireDateRequired || 'Hire date is required'),
    department: z.string().optional(),
    position: z.string().optional(),
    role: z.nativeEnum(UserRole),
    manager_id: z.string().optional(),
    employment_type: z.enum(['Full-time', 'Part-time', 'Contract', 'Intern'] as const),
    employment_status: z.enum([
      'Active',
      'Probation',
      'Suspended',
      'Terminated',
      'Resigned',
    ] as const),

    qid: z
      .string()
      .regex(/^\d{11}$/, t.qidDigits || 'QID must be 11 digits')
      .optional()
      .or(z.literal('')),
    visa_status: z.string().optional(),
    visa_expiry: z.string().optional(),
    health_card_expiry: z.string().optional(),

    salary_base: z.number().min(0).optional(),
    salary_allowances: z.number().min(0).optional(),
    bank_name: z.string().optional(),
    iban: z.string().optional(),
    location_id: z.string().optional(),
  });

type EmployeeFormValues = z.infer<ReturnType<typeof createEmployeeSchema>>;

// --- Components ---

const StatCard = ({
  title,
  value,
  icon: Icon,
  trend,
  color = 'orange',
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: { value: number; positive: boolean };
  color?: 'orange' | 'blue' | 'green' | 'purple';
}) => {
  const colorClasses = {
    orange: 'bg-gradient-to-br from-orange-500 to-amber-600',
    blue: 'bg-gradient-to-br from-blue-500 to-cyan-600',
    green: 'bg-gradient-to-br from-emerald-500 to-teal-600',
    purple: 'bg-gradient-to-br from-purple-500 to-violet-600',
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100 hover:shadow-md transition-all duration-300 group">
      <div className="flex items-start justify-between">
        <div
          className={`${colorClasses[color]} p-3 rounded-xl text-white shadow-lg shadow-orange-500/20 group-hover:scale-110 transition-transform duration-300`}
        >
          <Icon size={24} />
        </div>
        {trend && (
          <div
            className={`flex items-center gap-1 text-sm font-medium ${trend.positive ? 'text-emerald-600' : 'text-rose-600'}`}
          >
            <span>
              {trend.positive ? '+' : ''}
              {trend.value}%
            </span>
          </div>
        )}
      </div>
      <div className="mt-4">
        <h3 className="text-stone-500 text-sm font-medium">{title}</h3>
        <p className="text-2xl font-bold text-stone-900 mt-1">{value}</p>
      </div>
    </div>
  );
};

const EmployeeCard = ({
  employee,
  onEdit,
  t,
  lang,
}: {
  employee: Employee;
  onEdit: (emp: Employee) => void;
  t: Record<string, string>;
  lang: string;
}) => {
  const statusColors = {
    Active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    Probation: 'bg-amber-100 text-amber-700 border-amber-200',
    Suspended: 'bg-rose-100 text-rose-700 border-rose-200',
    Terminated: 'bg-stone-100 text-stone-700 border-stone-200',
    Resigned: 'bg-stone-100 text-stone-700 border-stone-200',
  };

  const roleColors = {
    ADMIN: 'bg-purple-100 text-purple-700',
    MANAGER: 'bg-blue-100 text-blue-700',
    HR: 'bg-pink-100 text-pink-700',
    ROASTER: 'bg-amber-100 text-amber-700',
    CASHIER: 'bg-emerald-100 text-emerald-700',
    WAREHOUSE_STAFF: 'bg-cyan-100 text-cyan-700',
  };

  const displayName =
    lang === 'ar' && employee.first_name_ar
      ? `${employee.first_name_ar} ${employee.last_name_ar || ''}`
      : `${employee.first_name_en} ${employee.last_name_en}`;

  return (
    <div
      className="bg-white rounded-2xl p-5 shadow-sm border border-stone-100 hover:shadow-lg hover:border-orange-200 transition-all duration-300 cursor-pointer group"
      onClick={() => onEdit(employee)}
    >
      <div className="flex items-start gap-4">
        <div className="relative">
          {employee.photo_url ? (
            <img
              src={employee.photo_url}
              alt={displayName}
              className="w-16 h-16 rounded-2xl object-cover border-2 border-stone-100 group-hover:border-orange-300 transition-colors"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center border-2 border-stone-100 group-hover:border-orange-300 transition-colors">
              <User className="text-orange-600" size={28} />
            </div>
          )}
          <div
            className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white ${
              employee.employment_status === 'Active' ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-bold text-stone-900 truncate group-hover:text-orange-600 transition-colors">
                {displayName}
              </h3>
              <p className="text-sm text-stone-500 mt-0.5">
                {employee.position || t.noPosition || 'No Position'}
              </p>
            </div>
            <button
              className="p-2 hover:bg-stone-100 rounded-xl transition-colors opacity-0 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(employee);
              }}
            >
              <Edit size={16} className="text-stone-400" />
            </button>
          </div>

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${roleColors[employee.role] || 'bg-stone-100 text-stone-600'}`}
            >
              {t[employee.role.toLowerCase()] || employee.role}
            </span>
            <span
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${statusColors[employee.employment_status] || statusColors.Active}`}
            >
              {t[employee.employment_status.toLowerCase()] || employee.employment_status}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-stone-100">
        <div className="flex items-center gap-2 text-sm text-stone-600">
          <Briefcase size={14} className="text-stone-400" />
          <span className="truncate">
            {employee.department || t.noDepartment || 'No Department'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-stone-600">
          <Phone size={14} className="text-stone-400" />
          <span className="truncate">{employee.phone}</span>
        </div>
      </div>
    </div>
  );
};

const EmployeeModal = ({
  isOpen,
  onClose,
  employee,
  locations,
  t,
  onSubmit,
  loading,
}: {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
  locations: Location[];
  t: Record<string, string>;
  onSubmit: (data: EmployeeFormValues) => void;
  loading: boolean;
}) => {
  const [activeTab, setActiveTab] = useState<'personal' | 'employment' | 'financial'>('personal');
  const employeeSchema = useMemo(() => createEmployeeSchema(t), [t]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      role: UserRole.CASHIER,
      employment_type: 'Full-time',
      employment_status: 'Active',
    },
  });

  useEffect(() => {
    if (employee) {
      reset({
        first_name_en: employee.first_name_en,
        last_name_en: employee.last_name_en,
        first_name_ar: employee.first_name_ar,
        last_name_ar: employee.last_name_ar,
        phone: employee.phone,
        email: employee.email,
        role: employee.role,
        department: employee.department,
        position: employee.position,
        employment_type: employee.employment_type,
        employment_status: employee.employment_status,
        hire_date: employee.hire_date,
        salary_base: employee.salary_base,
        salary_allowances: employee.salary_allowances,
        location_id: employee.location_id,
      });
    } else {
      reset({
        role: UserRole.CASHIER,
        employment_type: 'Full-time',
        employment_status: 'Active',
      });
    }
  }, [employee, reset]);

  if (!isOpen) return null;

  const tabs = [
    { id: 'personal', label: t.personal || 'Personal', icon: User },
    { id: 'employment', label: t.employment || 'Employment', icon: Briefcase },
    { id: 'financial', label: t.financial || 'Financial', icon: Wallet },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-stone-100">
          <div>
            <h2 className="text-xl font-bold text-stone-900">
              {employee ? t.editEmployee || 'Edit Employee' : t.addEmployee || 'Add Employee'}
            </h2>
            <p className="text-sm text-stone-500 mt-1">
              {employee
                ? t.updateDetails || 'Update employee details'
                : t.fillDetails || 'Fill in the employee details'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-xl transition-colors">
            <X size={20} className="text-stone-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-2 bg-stone-50 border-b border-stone-100">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-white text-orange-600 shadow-sm'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="overflow-y-auto max-h-[60vh]">
          <div className="p-6 space-y-4">
            {activeTab === 'personal' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-200">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">
                      {t.firstNameEn || 'First Name (EN)'} *
                    </label>
                    <input
                      {...register('first_name_en')}
                      className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
                      placeholder="John"
                    />
                    {errors.first_name_en && (
                      <p className="text-red-500 text-xs mt-1">{errors.first_name_en.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">
                      {t.lastNameEn || 'Last Name (EN)'} *
                    </label>
                    <input
                      {...register('last_name_en')}
                      className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
                      placeholder="Doe"
                    />
                    {errors.last_name_en && (
                      <p className="text-red-500 text-xs mt-1">{errors.last_name_en.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">
                      {t.firstNameAr || 'First Name (AR)'}
                    </label>
                    <input
                      {...register('first_name_ar')}
                      className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all text-right"
                      placeholder="محمد"
                      dir="rtl"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">
                      {t.lastNameAr || 'Last Name (AR)'}
                    </label>
                    <input
                      {...register('last_name_ar')}
                      className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all text-right"
                      placeholder="عبدالله"
                      dir="rtl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">
                      {t.phone || 'Phone'} *
                    </label>
                    <input
                      {...register('phone')}
                      className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
                      placeholder="+974 1234 5678"
                    />
                    {errors.phone && (
                      <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">
                      {t.email || 'Email'} *
                    </label>
                    <input
                      {...register('email')}
                      type="email"
                      className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
                      placeholder="john@example.com"
                    />
                    {errors.email && (
                      <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'employment' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-200">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">
                      {t.role || 'Role'} *
                    </label>
                    <select
                      {...register('role')}
                      className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all bg-white"
                    >
                      {Object.values(UserRole).map((role) => (
                        <option key={role} value={role}>
                          {t[role.toLowerCase()] || role}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">
                      {t.employmentStatus || 'Status'}
                    </label>
                    <select
                      {...register('employment_status')}
                      className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all bg-white"
                    >
                      {['Active', 'Probation', 'Suspended', 'Terminated', 'Resigned'].map(
                        (status) => (
                          <option key={status} value={status}>
                            {t[status.toLowerCase()] || status}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">
                      {t.department || 'Department'}
                    </label>
                    <input
                      {...register('department')}
                      className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
                      placeholder="Operations"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">
                      {t.position || 'Position'}
                    </label>
                    <input
                      {...register('position')}
                      className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
                      placeholder="Senior Barista"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">
                      {t.employmentType || 'Employment Type'}
                    </label>
                    <select
                      {...register('employment_type')}
                      className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all bg-white"
                    >
                      {['Full-time', 'Part-time', 'Contract', 'Intern'].map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">
                      {t.hireDate || 'Hire Date'} *
                    </label>
                    <input
                      {...register('hire_date')}
                      type="date"
                      className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
                    />
                    {errors.hire_date && (
                      <p className="text-red-500 text-xs mt-1">{errors.hire_date.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
                    {t.location || 'Branch/Location'}
                  </label>
                  <select
                    {...register('location_id')}
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all bg-white"
                  >
                    <option value="">{t.selectLocation || 'Select Location'}</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {activeTab === 'financial' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-200">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">
                      {t.baseSalary || 'Base Salary'} (QAR)
                    </label>
                    <input
                      {...register('salary_base', { valueAsNumber: true })}
                      type="number"
                      className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
                      placeholder="5000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">
                      {t.allowances || 'Allowances'} (QAR)
                    </label>
                    <input
                      {...register('salary_allowances', { valueAsNumber: true })}
                      type="number"
                      className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
                      placeholder="500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">
                      {t.bankName || 'Bank Name'}
                    </label>
                    <input
                      {...register('bank_name')}
                      className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
                      placeholder="Qatar National Bank"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">
                      {t.iban || 'IBAN'}
                    </label>
                    <input
                      {...register('iban')}
                      className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
                      placeholder="QA00XXXXXXXXXXXX"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-stone-100 bg-stone-50">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-stone-600 font-medium hover:text-stone-900 hover:bg-stone-200 rounded-xl transition-all"
            >
              {t.cancel || 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-orange-500 to-amber-600 text-white font-semibold rounded-xl shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <SaveIcon size={18} />}
              {employee ? t.update || 'Update' : t.create || 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Save icon component
const SaveIcon = ({ size = 24 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);

// --- Main Component ---

export default function StaffView() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const { showError } = useErrorToast();

  // State
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Fetch data
  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      const tableName = user?.role === UserRole.MANAGER ? 'employees_for_manager' : 'employees';
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setEmployees(data || []);
    } catch (err) {
      console.error('Error fetching employees:', err);
      showError(t.actionFailed || 'Failed to fetch employees');
    } finally {
      setLoading(false);
    }
  }, [user?.role]);

  const fetchLocations = useCallback(async () => {
    try {
      const { data } = await supabase.from('locations').select('*').eq('is_active', true);
      if (data) setLocations(data);
    } catch (err) {
      console.error('Error fetching locations:', err);
      showError(t.actionFailed || 'Failed to fetch locations');
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
    fetchLocations();
  }, [fetchEmployees, fetchLocations]);

  // Filter employees
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const matchesSearch =
        `${emp.first_name_en} ${emp.last_name_en}`
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        emp.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.phone?.includes(searchTerm);

      const matchesRole = filterRole === 'ALL' || emp.role === filterRole;
      const matchesStatus = filterStatus === 'ALL' || emp.employment_status === filterStatus;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [employees, searchTerm, filterRole, filterStatus]);

  // Stats
  const stats = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((e) => e.employment_status === 'Active').length;
    const onLeave = employees.filter((e) => e.is_on_leave).length;
    const newThisMonth = employees.filter((e) => {
      const hireDate = new Date(e.hire_date);
      const now = new Date();
      return hireDate.getMonth() === now.getMonth() && hireDate.getFullYear() === now.getFullYear();
    }).length;

    return { total, active, onLeave, newThisMonth };
  }, [employees]);

  // Handlers
  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setShowModal(true);
  };

  const handleCreate = () => {
    setEditingEmployee(null);
    setShowModal(true);
  };

  const handleSubmit = async (data: EmployeeFormValues) => {
    try {
      setLoading(true);
      const payload = {
        ...data,
        first_name_en: data.first_name_en.trim(),
        last_name_en: data.last_name_en.trim(),
        phone: data.phone.trim(),
        email: data.email.trim(),
        created_by: user?.id,
      };

      if (editingEmployee) {
        const { error } = await supabase
          .from('employees')
          .update(payload)
          .eq('id', editingEmployee.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('employees').insert([payload]);
        if (error) throw error;
      }

      await fetchEmployees();
      setShowModal(false);
      setEditingEmployee(null);
    } catch (err: any) {
      console.error('Error saving employee:', err);
      showError(err.message || t.actionFailed || 'Failed to save employee');
      alert(err.message || 'Failed to save employee');
    } finally {
      setLoading(false);
    }
  };

  const roles = Object.values(UserRole);
  const statuses = ['Active', 'Probation', 'Suspended', 'Terminated', 'Resigned'];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header & Stats */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-stone-900">
              {t.staff || 'Staff Management'}
            </h1>
            <p className="text-stone-500 mt-1">
              {t.manageTeam || 'Manage your team, track performance, and handle payroll'}
            </p>
          </div>
          <button
            onClick={handleCreate}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-600 text-white font-semibold rounded-2xl shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:scale-105 active:scale-95 transition-all"
          >
            <Plus size={20} />
            {t.addEmployee || 'Add Employee'}
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title={t.totalEmployees || 'Total Employees'}
            value={stats.total}
            icon={Users}
            color="orange"
          />
          <StatCard
            title={t.activeStaff || 'Active Staff'}
            value={stats.active}
            icon={Award}
            color="green"
            trend={{ value: 12, positive: true }}
          />
          <StatCard
            title={t.onLeave || 'On Leave'}
            value={stats.onLeave}
            icon={Calendar}
            color="blue"
          />
          <StatCard
            title={t.newHires || 'New Hires'}
            value={stats.newThisMonth}
            icon={TrendingUp}
            color="purple"
          />
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-100">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t.searchEmployees || 'Search by name, email, or phone...'}
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-stone-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
            />
          </div>

          <div className="flex gap-3">
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-4 py-3 rounded-xl border border-stone-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all bg-white min-w-[140px]"
            >
              <option value="ALL">{t.allRoles || 'All Roles'}</option>
              {roles.map((role) => (
                <option key={role} value={role}>
                  {t[role.toLowerCase()] || role}
                </option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-3 rounded-xl border border-stone-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all bg-white min-w-[140px]"
            >
              <option value="ALL">{t.allStatuses || 'All Statuses'}</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {t[status.toLowerCase()] || status}
                </option>
              ))}
            </select>

            <div className="flex bg-stone-100 rounded-xl p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-orange-600 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
              >
                <Grid3X3 size={20} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-orange-600 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
              >
                <List size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Employee Grid/List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="animate-spin text-orange-600" size={48} />
          <p className="text-stone-500 mt-4 font-medium">{t.loading || 'Loading employees...'}</p>
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-stone-100">
          <div className="w-20 h-20 bg-stone-100 rounded-full flex items-center justify-center mb-4">
            <Users className="text-stone-400" size={32} />
          </div>
          <h3 className="text-lg font-semibold text-stone-900">
            {t.noEmployees || 'No employees found'}
          </h3>
          <p className="text-stone-500 mt-1">
            {t.tryAdjustingFilters || 'Try adjusting your filters or add a new employee'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredEmployees.map((employee) => (
            <EmployeeCard
              key={employee.id}
              employee={employee}
              onEdit={handleEdit}
              t={t}
              lang={lang}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-semibold text-stone-700">
                  {t.employee || 'Employee'}
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-stone-700">
                  {t.role || 'Role'}
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-stone-700">
                  {t.department || 'Department'}
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-stone-700">
                  {t.status || 'Status'}
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-stone-700">
                  {t.contact || 'Contact'}
                </th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-stone-700">
                  {t.actions || 'Actions'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredEmployees.map((employee) => (
                <tr key={employee.id} className="hover:bg-stone-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {employee.photo_url ? (
                        <img
                          src={employee.photo_url}
                          alt=""
                          className="w-10 h-10 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                          <User size={18} className="text-orange-600" />
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-stone-900">
                          {employee.first_name_en} {employee.last_name_en}
                        </p>
                        <p className="text-sm text-stone-500">{employee.position || '-'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 bg-stone-100 text-stone-700 rounded-lg text-xs font-medium">
                      {employee.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-stone-600">{employee.department || '-'}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
                        employee.employment_status === 'Active'
                          ? 'bg-emerald-100 text-emerald-700'
                          : employee.employment_status === 'Probation'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-stone-100 text-stone-700'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          employee.employment_status === 'Active'
                            ? 'bg-emerald-500'
                            : employee.employment_status === 'Probation'
                              ? 'bg-amber-500'
                              : 'bg-stone-500'
                        }`}
                      />
                      {employee.employment_status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-stone-600">{employee.phone}</div>
                    <div className="text-xs text-stone-400">{employee.email}</div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleEdit(employee)}
                      className="p-2 hover:bg-orange-100 text-stone-400 hover:text-orange-600 rounded-xl transition-all"
                    >
                      <Edit size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      <EmployeeModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingEmployee(null);
        }}
        employee={editingEmployee}
        locations={locations}
        t={t}
        onSubmit={handleSubmit}
        loading={loading}
      />
    </div>
  );
}
