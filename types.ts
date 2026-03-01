
export enum RoastingLevel {
  LIGHT = 'Light',
  MEDIUM = 'Medium',
  MEDIUM_DARK = 'Medium Dark',
  DARK = 'Dark'
}

export enum BatchStatus {
  PREPARATION = 'Preparation',
  ROASTING = 'Roasting',
  COOLING = 'Cooling',
  INSPECTION = 'Inspection',
  PACKAGING = 'Packaging',
  COMPLETED = 'Completed',
  REJECTED = 'QC Rejected',
  DELETED = 'DELETED'
}

export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  HR = 'HR',
  ROASTER = 'ROASTER',
  CASHIER = 'CASHIER',
  WAREHOUSE_STAFF = 'WAREHOUSE_STAFF'
}

export type EmploymentStatus = 'Active' | 'Probation' | 'Suspended' | 'Terminated' | 'Resigned';
export type EmploymentType = 'Full-time' | 'Part-time' | 'Contract' | 'Intern';
export type Gender = 'Male' | 'Female';
export type ShiftTemplate = 'Morning' | 'Evening' | 'Night' | 'Split';

export interface Employee {
  id: string;
  employee_id: string; // DR-XXXX

  // Personal
  first_name_en: string;
  last_name_en: string;
  first_name_ar?: string;
  last_name_ar?: string;
  national_id?: string;
  nationality?: string;
  dob?: string;
  gender?: Gender;
  marital_status?: string;

  // Contact
  phone: string;
  email: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;

  // Employment
  hire_date: string;
  department?: string;
  position?: string;
  role: UserRole;
  manager_id?: string;
  employment_type: EmploymentType;
  employment_status: EmploymentStatus;
  shift_template?: ShiftTemplate;
  shift_start_time?: string;
  shift_end_time?: string;
  shift_break_minutes?: number;
  shift_grace_minutes?: number;
  employee_pin?: string;
  is_on_leave?: boolean;
  location_id?: string;

  // Qatar Specifics
  qid?: string;
  visa_status?: string;
  visa_expiry?: string;
  health_card_expiry?: string;

  // Media
  photo_url?: string;

  // Financials
  salary_base?: number;
  salary_allowances?: number;
  bank_name?: string;
  iban?: string;

  // Audit
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  permissions: string[];
  avatar?: string;
  location_id?: string;
}

export interface Ingredient {
  id: string;
  name: string;
  unit: 'g' | 'ml' | 'unit' | 'tsp';
  quantity: number;
  cost_per_unit: number;
}

export interface RecipeIngredient {
  ingredient_id: string;
  name: string;
  amount: number;
  unit: string;
  cost_per_unit?: number; // Added for REQ-002
}

export interface Recipe {
  id: string;
  product_id: string;
  ingredients: RecipeIngredient[];
}

export interface AddOn {
  id: string;
  name: string;
  price: number;
  ingredient_id?: string;
}

export interface BeverageCustomization {
  size: 'S' | 'M' | 'L';
  milkType: 'Full Fat' | 'Low Fat' | 'Oat' | 'Almond';
  sugarLevel: 'None' | 'Half' | 'Normal' | 'Extra';
  extraPrice: number;
  selectedAddOns?: AddOn[];
}

export type ProductStatus = 'ACTIVE' | 'DISABLED' | 'DISCONTINUED';

export interface ProductDefinition {
  id: string;
  name: string;
  description?: string;
  category: string;
  beanId?: string;
  mainCategory?: string;
  subCategory?: string;
  variantOf?: string;
  variantLabel?: string;
  variantSize?: string;
  variantFlavor?: string;
  unit?: 'piece' | 'kg' | 'g' | 'liter' | 'box';
  roastLevel?: RoastingLevel;
  templateId?: string;
  basePrice: number;
  sellingPrice?: number;
  costPrice?: number;
  profitMargin?: number;
  isActive: boolean;
  productStatus: ProductStatus;
  isPerishable?: boolean;
  expiryDate?: string;
  image?: string;
  sku?: string;
  supplier?: string;
  laborCost?: number;
  roastingOverhead?: number;
  estimatedGreenBeanCost?: number;
  type: 'PACKAGED_COFFEE' | 'BEVERAGE' | 'ACCESSORY' | 'RAW_MATERIAL';
  recipe?: Recipe;
  bom?: RecipeIngredient[];
  add_ons?: AddOn[];
}

export interface InventoryItem {
  id: string;
  name: string;
  description?: string;
  category?: string;
  type: 'PACKAGED_COFFEE' | 'BEVERAGE' | 'INGREDIENT' | 'ACCESSORY' | 'RAW_MATERIAL';
  size?: string;
  price: number;
  stock: number;
  reserved_stock?: number;
  damaged_stock?: number;
  min_stock?: number;
  max_stock?: number;
  unit?: string;
  batchId?: string;
  image: string;
  skuPrefix?: string;
  productId?: string;
  location_id?: string;
  bean_origin?: string;
  roast_level?: string;
  roast_date?: string;
  expiry_date?: string;
  last_movement_at?: string;
  cost_per_unit?: number;
  recipe?: Recipe;
  bom?: RecipeIngredient[];
  add_ons?: AddOn[];
}

export interface CartItem extends InventoryItem {
  quantity: number;
  recipe?: Recipe;
  selectedCustomizations?: BeverageCustomization;
  cartId?: string;
}

export type PaymentMethod = 'CASH' | 'CARD' | 'MOBILE' | 'SPLIT';

export interface PaymentBreakdown {
  cash: number;
  card: number;
  mobile: number;
  card_reference?: string; // REQ-003: Payment reference for card transactions
}

export interface Transaction {
  id: string;
  items: CartItem[];
  total: number;
  subtotal?: number;
  vat_amount?: number;
  discount_amount?: number;
  timestamp: string;
  paymentMethod: PaymentMethod;
  paymentBreakdown?: PaymentBreakdown;
  card_reference?: string; // REQ-003: Added for single card payments
  user_id?: string;
  cashier_name?: string;
  received_amount?: number;
  change_amount?: number;
  created_at?: string;
  is_returned?: boolean;
  return_id?: string;
  customer_id?: string;
  customer_name?: string;
}

export interface Customer {
  id: string;
  full_name: string;
  phone: string;
  email?: string;
  loyalty_points: number;
  total_spent: number;
  last_visit_date?: string;
  notes?: string;
  metadata?: any;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export type RefundStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
export type RefundType = 'FULL' | 'PARTIAL';

export interface ReturnItem {
  id: string; // Product/Inventory ID
  cartId: string; // cartId from the original transaction items
  productId?: string; // Original product ID (not inventory row ID)
  locationId?: string; // Location where return is processed
  name: string;
  quantity: number;
  price: number;
  type: 'PACKAGED_COFFEE' | 'BEVERAGE' | 'INGREDIENT';
  return_reason: string;
  is_inventory_updated: boolean;
}

export interface ReturnRequest {
  id: string;
  invoice_number: string;
  items: ReturnItem[];
  total_refund_amount: number;
  refund_type: RefundType;
  status: RefundStatus;
  manager_id?: string;
  manager_name?: string;
  requested_by_id: string;
  requested_by_name: string;
  created_at: string;
  updated_at?: string;
}

export interface PackagingUnit {
  id: string;
  timestamp: string;
  templateId: string;
  productId: string;
  size: string;
  quantity: number;
  operator: string;
  packagingCostTotal: number;
  productionDate: string;
  expiryDate: string;
  packagingDate: string;
  sku: string;
}

export interface RoastProfile {
  id: string;
  name: string;
  description?: string;
  profile?: Record<string, unknown>;
  bean_ids?: string[];
  parent_profile_id?: string | null;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface RoastingBatch {
  id: string;
  beanId: string;
  roastProfileId?: string;
  roastDate: string;
  roastTime?: string;
  level: RoastingLevel;
  preWeight: number;
  postWeight: number;
  wastePercentage: number;
  status: BatchStatus;
  operatorId?: string;
  productionOrderId?: string;
  greenQcMoisture?: number;
  greenQcDefects?: number;
  greenQcColor?: string;
  postQcColor?: string;
  postQcAroma?: string;
  postQcCupping?: string;
  postQcDefects?: string;
  postQcAcidity?: number;
  postQcBody?: number;
  postQcSweetness?: number;
  postQcCleanliness?: number;
  postQcBalance?: number;
  qualityScore?: number;
  qcStatus?: 'PASSED' | 'FAILED' | 'PENDING';
  qcRejectReason?: string;
  qcCheckedAt?: string;
  qcCheckedBy?: string;
  qcCheckedByName?: string;
  roastTempCharge?: number;
  roastTempTurningPoint?: number;
  roastTempFirstCrack?: number;
  roastTempSecondCrack?: number;
  preparationStartedAt?: string;
  preparationEndedAt?: string;
  roastingStartedAt?: string;
  roastingEndedAt?: string;
  coolingStartedAt?: string;
  coolingEndedAt?: string;
  inspectionStartedAt?: string;
  inspectionEndedAt?: string;
  packagingStartedAt?: string;
  packagingEndedAt?: string;
  operator: string;
  notes: string;
  history: Array<{ timestamp: string; action: string; userId?: string; details?: string }>;
  costPerKg: number;
  packagingUnits: PackagingUnit[];
}

export interface PackageTemplate {
  id: string;
  sizeLabel: string;
  weightInKg: number;
  unitCost: number;
  shelf_life_days: number;
  skuPrefix: string;
  isActive: boolean;
}

export interface GreenBean {
  id: string;
  origin: string;
  variety: string;
  quantity: number;
  cost_per_kg: number;
  supplier: string;
  purchase_date: string;
  harvest_date?: string;
  quality_grade?: string;
  batch_number?: string;
  is_organic?: boolean;
}

export interface ContactPerson {
  name: string;
  phone: string;
  email: string;
}

export interface Location {
  id: string;
  name: string;
  address: string;
  is_active: boolean;
  is_roastery: boolean;
  type?: 'WAREHOUSE' | 'BRANCH' | 'ROASTERY';
  code?: string;
  area?: string;
  city?: string;
  gps_lat?: number | string | null;
  gps_lng?: number | string | null;
  phone?: string;
  email?: string;
  fax?: string;
  operating_hours?: Record<string, { open: string; close: string; closed?: boolean }>;
  branch_type?: string;
  status?: string;
  opening_date?: string;
  closing_date?: string;
  area_sqm?: number;
  seating_capacity?: number;
  is_hq?: boolean;
  parent_location_id?: string | null;
  commercial_license_number?: string;
  commercial_license_expiry?: string;
  logo_url?: string;
  exterior_photo_url?: string;
  interior_photo_url?: string;
  contact_person_name?: string;
  contact_person_phone?: string;
  contact_person_email?: string;
  contact_person?: ContactPerson;
}

export interface ReprintLog {
  id: string;
  transaction_id: string;
  user_id?: string;
  cashier_name: string;
  reprinted_at: string;
  reason?: string;
}

export interface SystemSettings {
  id: string;
  printer_width: '58mm' | '80mm';
  store_name: string;
  store_address: string;
  store_phone: string;
  store_logo_url?: string;
  vat_rate: number;
  vat_number?: string;
  currency: string;
  late_penalty_type?: 'per_minute' | 'per_occurrence';
  late_penalty_amount?: number;
  inventory_valuation_method?: 'FIFO' | 'LIFO' | 'WEIGHTED_AVG';
}

export interface SalaryAdvance {
  id: string;
  employee_id: string;
  amount: number;
  requested_at: string;
  reason?: string;
  status: 'open' | 'closed' | 'cancelled';
  monthly_deduction?: number;
  created_by?: string;
  created_at: string;
  updated_at?: string;
}

export interface SalaryAdvancePayment {
  id: string;
  advance_id: string;
  employee_id: string;
  amount: number;
  paid_at: string;
  notes?: string;
  created_by?: string;
  created_at: string;
}

export interface PayrollApproval {
  id: string;
  month: string;
  status: 'draft' | 'hr_approved' | 'manager_approved' | 'admin_approved';
  created_by?: string;
  hr_approved_by?: string;
  hr_approved_at?: string;
  manager_approved_by?: string;
  manager_approved_at?: string;
  admin_approved_by?: string;
  admin_approved_at?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface PayrollHistory {
  id: string;
  month: string;
  employee_id: string;
  gross_salary: number;
  overtime_hours: number;
  overtime_pay: number;
  absence_deductions: number;
  late_penalties: number;
  advance_deductions: number;
  net_pay: number;
  present_days: number;
  absent_days: number;
  late_days: number;
  created_by?: string;
  created_at: string;
  updated_at?: string;
}

export interface PerformanceKpi {
  id: string;
  role: UserRole;
  name: string;
  unit?: string;
  target_value?: number;
  source_module?: 'POS' | 'ROASTING';
  source_metric?: string;
  created_by?: string;
  created_at: string;
  updated_at?: string;
}

export interface PerformanceReview {
  id: string;
  employee_id: string;
  period_type: 'monthly' | 'quarterly' | 'annual';
  period_start: string;
  period_end: string;
  overall_score?: number;
  notes?: string;
  manager_feedback?: string;
  improvement_notes?: string;
  bonus_rule_id?: string;
  bonus_type?: 'percentage' | 'fixed';
  bonus_rate?: number;
  bonus_amount?: number;
  status: 'draft' | 'completed';
  created_by?: string;
  reviewed_by?: string;
  created_at: string;
  updated_at?: string;
}

export interface PerformanceReviewKpi {
  id: string;
  review_id: string;
  kpi_id?: string;
  actual_value?: number;
  score?: number;
  created_at: string;
}

export interface PerformanceReviewCategory {
  id: string;
  role: UserRole;
  name: string;
  description?: string;
  created_by?: string;
  created_at: string;
  updated_at?: string;
}

export interface PerformanceReviewRating {
  id: string;
  review_id: string;
  category_id: string;
  rating: number;
  created_at: string;
}

export interface PerformanceBonusRule {
  id: string;
  role: UserRole;
  min_score?: number;
  max_score?: number;
  bonus_type: 'percentage' | 'fixed';
  bonus_rate?: number;
  bonus_amount?: number;
  is_active?: boolean;
  created_by?: string;
  created_at: string;
  updated_at?: string;
}

export interface LoginCredentials {
  identifier: string;
  password: string;
  rememberMe?: boolean;
}

export interface Shift {
  id: string;
  cashier_id: string;
  cashier_name: string;
  start_time: string;
  end_time?: string;
  initial_cash: number;
  total_cash_sales: number;
  total_cash_returns: number;
  expected_cash?: number;
  actual_cash?: number;
  status: 'OPEN' | 'CLOSED';
  notes?: string;
}

export interface ShiftReport {
  expected: number;
  actual: number;
  discrepancy: number;
  sales: number;
  cashIn: number;
  cashOut: number;
  initial?: number;
}

export interface CashMovement {
  id: string;
  shift_id: string;
  type: 'IN' | 'OUT';
  amount: number;
  reason: string;
  created_at: string;
  created_by_id: string;
  created_by_name: string;
}
