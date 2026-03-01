
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Settings, Plus, Trash2, Save, Scale,
  Coffee, Loader2, Shield, X, Database, Copy, CheckCircle2,
  Tag, Power, PowerOff, AlertCircle, AlertTriangle, ArrowRight,
  RefreshCw, ImageIcon, DollarSign, PieChart, Info, TrendingUp,
  ExternalLink, Layers, Search, FlaskConical, Milk, Droplets, Utensils,
  Edit3, Beaker, Archive, HardDrive, Trash, Code2, ClipboardCheck,
  CheckCircle, DatabaseZap, Activity, Terminal, XCircle, FileText, ToggleLeft, ToggleRight,
  PlusCircle, MinusCircle, Calculator
} from 'lucide-react';
import { useLanguage, useTheme } from '../App';
import { PackageTemplate, ProductDefinition, RoastingLevel, UserRole, Recipe, RecipeIngredient, AddOn, InventoryItem, SystemSettings, Location, RoastProfile } from '../types';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';

const FULL_SCHEMA_COLUMNS = [
  'id', 'name', 'description', 'category', 'roast_level', 'template_id',
  'base_price', 'selling_price', 'cost_price', 'profit_margin', 'is_active', 'type', 'recipe', 'image', 'sku', 'main_category', 'sub_category', 'variant_of', 'variant_label', 'variant_size', 'variant_flavor', 'unit',
  'labor_cost', 'roasting_overhead', 'estimated_green_bean_cost', 'add_ons', 'is_perishable', 'expiry_date', 'bom', 'product_status', 'supplier', 'bean_id'
];

interface GreenBeanRecord {
  id: string;
  bean_name?: string;
  origin?: string;
  variety?: string;
  quantity?: number | string;
  unit?: string;
  cost_per_kg?: number | string;
  supplier?: string;
  processing_method?: string;
  elevation?: string;
  notes?: string;
  created_at?: string;
}

interface GreenBeanMovementRecord {
  id: string;
  bean_id?: string;
  movement_type: string;
  quantity?: number | string;
  quantity_in?: number | string;
  quantity_out?: number | string;
  balance_after?: number | string;
  reason?: string;
  notes?: string;
  created_by_name?: string;
  movement_at?: string;
  created_at?: string;
  green_beans?: { origin?: string; variety?: string } | null;
}

const ConfigurationView: React.FC = () => {
  const { lang, t } = useLanguage();
  const { user } = useAuth();
  const { theme } = useTheme();

  const [activeSubTab, setActiveSubTab] = useState<'catalog' | 'templates' | 'roastProfiles' | 'greenBeans' | 'database' | 'profile' | 'settings'>('catalog');
  const [searchTerm, setSearchTerm] = useState('');
  const [skuFilter, setSkuFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ProductDefinition['productStatus']>('ALL');

  const [templates, setTemplates] = useState<PackageTemplate[]>([]);
  const [products, setProducts] = useState<ProductDefinition[]>([]);
  const [roastProfiles, setRoastProfiles] = useState<RoastProfile[]>([]);
  const [greenBeans, setGreenBeans] = useState<{ id: string; label: string }[]>([]);
  const [allIngredients, setAllIngredients] = useState<InventoryItem[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [productLocationStock, setProductLocationStock] = useState<Record<string, Record<string, number>>>({});
  const [settings, setSettings] = useState<SystemSettings>({
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
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [copyingSql, setCopyingSql] = useState(false);
  const [isImportingCatalog, setIsImportingCatalog] = useState(false);
  const catalogImportRef = useRef<HTMLInputElement | null>(null);

  const [missingCols, setMissingCols] = useState<Set<string>>(new Set());
  const [dbStatus, setDbStatus] = useState<'checking' | 'ready' | 'needs_update'>('checking');

  const [showProductModal, setShowProductModal] = useState(false);
  const [greenBeanRecords, setGreenBeanRecords] = useState<GreenBeanRecord[]>([]);
  const [greenBeanMovements, setGreenBeanMovements] = useState<GreenBeanMovementRecord[]>([]);
  const [showGreenBeanModal, setShowGreenBeanModal] = useState(false);
  const [editingGreenBeanId, setEditingGreenBeanId] = useState<string | null>(null);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [selectedBeanForAdjustment, setSelectedBeanForAdjustment] = useState<GreenBeanRecord | null>(null);
  const [greenBeanSearch, setGreenBeanSearch] = useState('');
  const [greenBeanForm, setGreenBeanForm] = useState({
    bean_name: '',
    origin: '',
    variety: '',
    quantity: '',
    unit: 'kg',
    cost_per_kg: '',
    supplier: '',
    processing_method: '',
    elevation: '',
    notes: ''
  });
  const [adjustmentForm, setAdjustmentForm] = useState({
    mode: 'OUT' as 'IN' | 'OUT',
    quantity: '',
    reason: 'COUNT_CORRECTION',
    note: ''
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingRoastProfileId, setEditingRoastProfileId] = useState<string | null>(null);
  const [forkedFromId, setForkedFromId] = useState<string | null>(null);
  const [roastProfileForm, setRoastProfileForm] = useState({
    name: '',
    description: '',
    beanIds: [] as string[],
    chargeTemperature: '',
    targetCurve: '',
    preparationDuration: '',
    roastingDuration: '',
    coolingDuration: '',
    inspectionDuration: '',
    packagingDuration: '',
    profileJson: '',
    isActive: true
  });

  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    category: 'Coffee',
    mainCategory: '',
    subCategory: '',
    variantOf: '',
    variantLabel: '',
    variantSize: '',
    variantFlavor: '',
    unit: 'piece' as 'piece' | 'kg' | 'g' | 'liter' | 'box',
    roastLevel: RoastingLevel.MEDIUM,
    templateId: '',
    basePrice: '',
    image: '',
    sku: '',
    supplier: '',
    isActive: true,
    productStatus: 'ACTIVE' as 'ACTIVE' | 'DISABLED' | 'DISCONTINUED',
    isPerishable: false,
    expiryDate: '',
    type: 'PACKAGED_COFFEE' as 'BEVERAGE' | 'PACKAGED_COFFEE' | 'ACCESSORY' | 'RAW_MATERIAL',
    beanId: '',
    laborCost: '0',
    roastingOverhead: '0',
    estimatedGreenBeanCost: '0'
  });
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredient[]>([]);
  const [bomComponents, setBomComponents] = useState<RecipeIngredient[]>([]);
  const [productAddOns, setProductAddOns] = useState<AddOn[]>([]);
  const [newIngredientName, setNewIngredientName] = useState('');
  const [newIngredientUnit, setNewIngredientUnit] = useState('g');
  const [newIngredientCost, setNewIngredientCost] = useState('');
  const [isAddingIngredient, setIsAddingIngredient] = useState(false);

  const checkSchemaIntegrity = useCallback(async () => {
    const missing = new Set<string>();
    for (const col of FULL_SCHEMA_COLUMNS) {
      if (['id', 'name', 'category', 'base_price'].includes(col)) continue;
      const { error } = await supabase.from('product_definitions').select(col).limit(1);
      if (error && (error.code === 'PGRST204' || error.message.includes('column'))) {
        missing.add(col);
      }
    }
    setMissingCols(missing);
    setDbStatus(missing.size === 0 ? 'ready' : 'needs_update');
    return missing;
  }, []);

  const toNumber = (value: unknown, fallback = 0) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  };

  const mapGreenBeanRecord = (item: any): GreenBeanRecord => ({
    ...item,
    quantity: toNumber(item?.quantity),
    cost_per_kg: toNumber(item?.cost_per_kg),
    unit: item?.unit || 'kg'
  });

  const mapGreenBeanMovementRecord = (item: any): GreenBeanMovementRecord => ({
    ...item,
    quantity: item?.quantity !== undefined ? toNumber(item?.quantity) : undefined,
    quantity_in: item?.quantity_in !== undefined ? toNumber(item?.quantity_in) : undefined,
    quantity_out: item?.quantity_out !== undefined ? toNumber(item?.quantity_out) : undefined,
    balance_after: item?.balance_after !== undefined ? toNumber(item?.balance_after) : undefined
  });

  const fetchGreenBeansData = useCallback(async () => {
    const [beansRes, movementRes] = await Promise.all([
      supabase.from('green_beans').select('*').order('created_at', { ascending: false }),
      supabase.from('green_bean_movements')
        .select('*, green_beans(origin,variety)')
        .order('movement_at', { ascending: false })
        .limit(200)
    ]);

    if (beansRes.data) {
      const mappedBeans = beansRes.data.map(mapGreenBeanRecord);
      setGreenBeanRecords(mappedBeans);
      setGreenBeans(mappedBeans.map((bean: any) => ({ id: bean.id, label: `${bean.origin || '-'} - ${bean.variety || '-'}` })));
    }
    if (movementRes.data) setGreenBeanMovements(movementRes.data.map(mapGreenBeanMovementRecord));
  }, []);

  const logGreenBeanMovement = useCallback(async (params: {
    beanId: string;
    movementType: 'OPENING_BALANCE' | 'ROASTING' | 'ROASTING_CONSUMPTION' | 'ADJUSTMENT' | 'PURCHASE';
    quantityIn?: number;
    quantityOut?: number;
    balanceAfter?: number;
    reason?: string;
    note?: string;
  }) => {
    const quantityIn = toNumber(params.quantityIn);
    const quantityOut = toNumber(params.quantityOut);
    const legacyQuantity = Math.abs(quantityIn - quantityOut);
    const nowIso = new Date().toISOString();
    const payloadV2: any = {
      bean_id: params.beanId,
      movement_type: params.movementType,
      quantity_in: quantityIn,
      quantity_out: quantityOut,
      balance_after: params.balanceAfter ?? null,
      reason: params.reason || null,
      notes: params.note || null,
      unit: 'kg',
      movement_at: nowIso,
      created_by: user?.id || null,
      created_by_name: user?.name || 'System'
    };

    const { error: v2Error } = await supabase.from('green_bean_movements').insert([payloadV2]);
    if (!v2Error) return;

    const isColumnMismatch = v2Error.code === 'PGRST204' || /column/i.test(v2Error.message || '');
    if (!isColumnMismatch) throw v2Error;

    const payloadLegacy = {
      bean_id: params.beanId,
      movement_type: params.movementType === 'ROASTING' ? 'ROASTING_CONSUMPTION' : params.movementType,
      quantity: legacyQuantity,
      notes: params.reason ? `${params.reason}${params.note ? ` - ${params.note}` : ''}` : (params.note || null),
      unit: 'kg',
      movement_at: nowIso,
      created_by: user?.id || null,
      created_by_name: user?.name || 'System'
    };

    const { error: legacyError } = await supabase.from('green_bean_movements').insert([payloadLegacy]);
    if (legacyError) throw legacyError;
  }, [user]);

  const fetchInitialData = useCallback(async () => {
    setIsLoadingData(true);
    const missing = await checkSchemaIntegrity();

    try {
      const [tplRes, prodRes, ingRes, settingsRes, locRes, stockRes, roastRes] = await Promise.all([
        supabase.from('package_templates').select('*').order('created_at', { ascending: false }),
        supabase.from('product_definitions').select(FULL_SCHEMA_COLUMNS.filter(c => !missing.has(c)).join(',')).order('created_at', { ascending: false }),
        supabase.from('inventory_items').select('*').eq('type', 'INGREDIENT'),
        supabase.from('system_settings').select('*').single(),
        supabase.from('locations').select('*').order('name', { ascending: true }),
        supabase.from('inventory_items').select('product_id, location_id, stock').not('product_id', 'is', null),
        supabase.from('roast_profiles').select('*').order('created_at', { ascending: false })
      ]);

      if (tplRes.data) setTemplates(tplRes.data.map(mapTemplateFromDB));
      if (prodRes.data) setProducts(prodRes.data.map(mapProductFromDB));
      if (ingRes.data) setAllIngredients(ingRes.data);
      if (settingsRes.data) setSettings(settingsRes.data);
      if (roastRes.data) setRoastProfiles(roastRes.data);
      if (locRes.data) setLocations(locRes.data);
      if (stockRes.data) {
        const stockMap: Record<string, Record<string, number>> = {};
        stockRes.data.forEach((row: any) => {
          if (!row.product_id || !row.location_id) return;
          if (!stockMap[row.product_id]) stockMap[row.product_id] = {};
          stockMap[row.product_id][row.location_id] = (stockMap[row.product_id][row.location_id] || 0) + (row.stock || 0);
        });
        setProductLocationStock(stockMap);
      }

      await fetchGreenBeansData();

    } catch (err) {
      console.error("Data Load Error:", err);
    } finally {
      setIsLoadingData(false);
    }
  }, [checkSchemaIntegrity, fetchGreenBeansData]);

  useEffect(() => { fetchInitialData(); }, [fetchInitialData]);

  const mapTemplateFromDB = (item: any): PackageTemplate => ({
    id: item.id, sizeLabel: item.size_label, weightInKg: item.weight_in_kg, unitCost: item.unit_cost || 0,
    isActive: item.is_active, shelf_life_days: item.shelf_life_days || 180, skuPrefix: item.sku_prefix
  });

  const mapProductFromDB = (item: any): ProductDefinition => ({
    id: item.id,
    name: item.name,
    description: item.description,
    category: item.category,
    mainCategory: item.main_category,
    subCategory: item.sub_category,
    variantOf: item.variant_of,
    variantLabel: item.variant_label,
    variantSize: item.variant_size,
    variantFlavor: item.variant_flavor,
    unit: item.unit,
    roastLevel: item.roast_level,
    templateId: item.template_id,
    basePrice: item.selling_price ?? item.base_price,
    sellingPrice: item.selling_price ?? item.base_price,
    costPrice: item.cost_price ?? 0,
    profitMargin: item.profit_margin ?? 0,
    isActive: item.product_status ? item.product_status === 'ACTIVE' : item.is_active,
    productStatus: item.product_status || (item.is_active === false ? 'DISABLED' : 'ACTIVE'),
    isPerishable: item.is_perishable,
    expiryDate: item.expiry_date,
    image: item.image,
    sku: item.sku,
    supplier: item.supplier,
    beanId: item.bean_id,
    type: item.type || 'PACKAGED_COFFEE',
    recipe: item.recipe,
    bom: item.bom || [],
    laborCost: item.labor_cost,
    roastingOverhead: item.roasting_overhead,
    estimatedGreenBeanCost: item.estimated_green_bean_cost,
    add_ons: item.add_ons || []
  });

  const resetRoastProfileForm = () => {
    setEditingRoastProfileId(null);
    setForkedFromId(null);
    setRoastProfileForm({
      name: '',
      description: '',
      beanIds: [],
      chargeTemperature: '',
      targetCurve: '',
      preparationDuration: '',
      roastingDuration: '',
      coolingDuration: '',
      inspectionDuration: '',
      packagingDuration: '',
      profileJson: '',
      isActive: true
    });
  };

  const parseProfileJson = (value: string) => {
    if (!value.trim()) return {};
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  };

  const handleSaveRoastProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    if (
      !roastProfileForm.name.trim() ||
      !roastProfileForm.chargeTemperature ||
      !roastProfileForm.targetCurve.trim() ||
      !roastProfileForm.preparationDuration ||
      !roastProfileForm.roastingDuration ||
      !roastProfileForm.coolingDuration ||
      !roastProfileForm.inspectionDuration ||
      !roastProfileForm.packagingDuration
    ) {
      alert(t.fieldRequired);
      return;
    }
    const parseNumber = (value: string) => {
      const num = parseFloat(value);
      return Number.isNaN(num) ? null : num;
    };
    const chargeTemperature = parseNumber(roastProfileForm.chargeTemperature);
    const preparationDuration = parseNumber(roastProfileForm.preparationDuration);
    const roastingDuration = parseNumber(roastProfileForm.roastingDuration);
    const coolingDuration = parseNumber(roastProfileForm.coolingDuration);
    const inspectionDuration = parseNumber(roastProfileForm.inspectionDuration);
    const packagingDuration = parseNumber(roastProfileForm.packagingDuration);
    if (
      chargeTemperature === null ||
      preparationDuration === null ||
      roastingDuration === null ||
      coolingDuration === null ||
      inspectionDuration === null ||
      packagingDuration === null
    ) {
      alert(t.invalidNumber);
      return;
    }
    const parsedProfile = parseProfileJson(roastProfileForm.profileJson);
    if (parsedProfile === null) {
      alert(t.invalidJson);
      return;
    }
    setIsSaving(true);
    try {
      const baseProfile = {
        chargeTemperature,
        targetCurve: roastProfileForm.targetCurve.trim(),
        stageDurations: {
          preparation: preparationDuration,
          roasting: roastingDuration,
          cooling: coolingDuration,
          inspection: inspectionDuration,
          packaging: packagingDuration
        }
      };
      const mergedProfile = { ...parsedProfile, ...baseProfile };
      const payload = {
        name: roastProfileForm.name.trim(),
        description: roastProfileForm.description.trim() || null,
        profile: mergedProfile,
        bean_ids: roastProfileForm.beanIds,
        parent_profile_id: forkedFromId,
        is_active: roastProfileForm.isActive
      };
      if (editingRoastProfileId) {
        await supabase.from('roast_profiles').update(payload).eq('id', editingRoastProfileId);
      } else {
        await supabase.from('roast_profiles').insert([payload]);
      }
      await fetchInitialData();
      resetRoastProfileForm();
      setShowSuccess(true);
      setSuccessMsg(t.saveSuccess);
      setTimeout(() => setShowSuccess(false), 2000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditRoastProfile = (profile: RoastProfile) => {
    const profileData = (profile.profile || {}) as any;
    const stageDurations = profileData.stageDurations || {};
    const { chargeTemperature, targetCurve, stageDurations: _, ...extraProfile } = profileData;
    const extraJson = Object.keys(extraProfile).length > 0 ? JSON.stringify(extraProfile, null, 2) : '';
    setEditingRoastProfileId(profile.id);
    setForkedFromId(profile.parent_profile_id || null);
    setRoastProfileForm({
      name: profile.name || '',
      description: profile.description || '',
      beanIds: profile.bean_ids || [],
      chargeTemperature: chargeTemperature !== undefined ? String(chargeTemperature) : '',
      targetCurve: targetCurve || '',
      preparationDuration: stageDurations.preparation !== undefined ? String(stageDurations.preparation) : '',
      roastingDuration: stageDurations.roasting !== undefined ? String(stageDurations.roasting) : '',
      coolingDuration: stageDurations.cooling !== undefined ? String(stageDurations.cooling) : '',
      inspectionDuration: stageDurations.inspection !== undefined ? String(stageDurations.inspection) : '',
      packagingDuration: stageDurations.packaging !== undefined ? String(stageDurations.packaging) : '',
      profileJson: extraJson,
      isActive: profile.is_active !== false
    });
  };

  const handleForkRoastProfile = (profile: RoastProfile) => {
    const profileData = (profile.profile || {}) as any;
    const stageDurations = profileData.stageDurations || {};
    const { chargeTemperature, targetCurve, stageDurations: _, ...extraProfile } = profileData;
    const extraJson = Object.keys(extraProfile).length > 0 ? JSON.stringify(extraProfile, null, 2) : '';
    setEditingRoastProfileId(null);
    setForkedFromId(profile.id);
    setRoastProfileForm({
      name: `${profile.name || ''} ${t.forkSuffix}`.trim(),
      description: profile.description || '',
      beanIds: profile.bean_ids || [],
      chargeTemperature: chargeTemperature !== undefined ? String(chargeTemperature) : '',
      targetCurve: targetCurve || '',
      preparationDuration: stageDurations.preparation !== undefined ? String(stageDurations.preparation) : '',
      roastingDuration: stageDurations.roasting !== undefined ? String(stageDurations.roasting) : '',
      coolingDuration: stageDurations.cooling !== undefined ? String(stageDurations.cooling) : '',
      inspectionDuration: stageDurations.inspection !== undefined ? String(stageDurations.inspection) : '',
      packagingDuration: stageDurations.packaging !== undefined ? String(stageDurations.packaging) : '',
      profileJson: extraJson,
      isActive: profile.is_active !== false
    });
  };

  const toggleRoastProfileBean = (beanId: string) => {
    setRoastProfileForm(prev => {
      if (prev.beanIds.includes(beanId)) {
        return { ...prev, beanIds: prev.beanIds.filter(id => id !== beanId) };
      }
      return { ...prev, beanIds: [...prev.beanIds, beanId] };
    });
  };

  const handleToggleRoastProfile = async (profile: RoastProfile) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const nextActive = !(profile.is_active ?? true);
      await supabase.from('roast_profiles').update({ is_active: nextActive }).eq('id', profile.id);
      setRoastProfiles(prev => prev.map(item => item.id === profile.id ? { ...item, is_active: nextActive } : item));
    } finally {
      setIsSaving(false);
    }
  };

  const sqlFixScript = `
-- سكريبت تحديث قاعدة بيانات محمصة الدوحة

-- Create system_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    printer_width TEXT DEFAULT '80mm',
    store_name TEXT DEFAULT 'Doha Roastery',
    store_address TEXT,
    store_phone TEXT,
    vat_rate DECIMAL DEFAULT 0,
    inventory_valuation_method TEXT DEFAULT 'WEIGHTED_AVG',
    currency TEXT DEFAULT 'QAR',
    late_penalty_type TEXT DEFAULT 'per_minute',
    late_penalty_amount NUMERIC DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Insert default settings if not exists
 INSERT INTO public.system_settings (printer_width, store_name, currency)
 SELECT '80mm', 'Doha Roastery', 'QAR'
 WHERE NOT EXISTS (SELECT 1 FROM public.system_settings);
 
ALTER TABLE public.system_settings
ADD COLUMN IF NOT EXISTS late_penalty_type TEXT DEFAULT 'per_minute';

ALTER TABLE public.system_settings
ADD COLUMN IF NOT EXISTS late_penalty_amount NUMERIC DEFAULT 0;

ALTER TABLE public.system_settings
ADD COLUMN IF NOT EXISTS inventory_valuation_method TEXT DEFAULT 'WEIGHTED_AVG';

UPDATE public.system_settings
SET late_penalty_type = COALESCE(late_penalty_type, 'per_minute'),
    late_penalty_amount = COALESCE(late_penalty_amount, 0);
 
 -- Create reprint_logs table
 CREATE TABLE IF NOT EXISTS public.reprint_logs (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     transaction_id TEXT NOT NULL REFERENCES public.transactions(id),
     user_id UUID REFERENCES auth.users(id),
     cashier_name TEXT,
     reprinted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
     reason TEXT
 );
 
 -- Update existing product_definitions table
ALTER TABLE IF EXISTS public.product_definitions 
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'PACKAGED_COFFEE',
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS recipe JSONB DEFAULT '{"ingredients": []}',
ADD COLUMN IF NOT EXISTS bom JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS add_ons JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS image TEXT,
ADD COLUMN IF NOT EXISTS sku TEXT,
ADD COLUMN IF NOT EXISTS main_category TEXT,
ADD COLUMN IF NOT EXISTS sub_category TEXT,
ADD COLUMN IF NOT EXISTS variant_of UUID REFERENCES public.product_definitions(id),
ADD COLUMN IF NOT EXISTS variant_label TEXT,
ADD COLUMN IF NOT EXISTS variant_size TEXT,
ADD COLUMN IF NOT EXISTS variant_flavor TEXT,
ADD COLUMN IF NOT EXISTS unit TEXT,
ADD COLUMN IF NOT EXISTS selling_price NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS cost_price NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS profit_margin NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS labor_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS roasting_overhead NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS estimated_green_bean_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_perishable BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS expiry_date DATE,
ADD COLUMN IF NOT EXISTS product_status TEXT DEFAULT 'ACTIVE',
ADD COLUMN IF NOT EXISTS supplier TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS product_definitions_sku_unique
ON public.product_definitions(sku)
WHERE sku IS NOT NULL;

ALTER TABLE IF EXISTS public.inventory_items 
ADD COLUMN IF NOT EXISTS cost_per_unit NUMERIC DEFAULT 0;

ALTER TABLE IF EXISTS public.roast_profiles
ADD COLUMN IF NOT EXISTS bean_ids UUID[] DEFAULT '{}'::UUID[];

ALTER TABLE IF EXISTS public.roast_profiles
ADD COLUMN IF NOT EXISTS parent_profile_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'roast_profiles_parent_profile_id_fkey'
  ) THEN
    ALTER TABLE public.roast_profiles
      ADD CONSTRAINT roast_profiles_parent_profile_id_fkey
      FOREIGN KEY (parent_profile_id) REFERENCES public.roast_profiles(id) ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS roast_profiles_bean_ids_idx
ON public.roast_profiles USING GIN (bean_ids);

CREATE INDEX IF NOT EXISTS roast_profiles_parent_profile_id_idx
ON public.roast_profiles(parent_profile_id);

CREATE TABLE IF NOT EXISTS public.roast_profile_usages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  roast_profile_id UUID REFERENCES public.roast_profiles(id) ON DELETE SET NULL,
  batch_id TEXT REFERENCES public.roasting_batches(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ DEFAULT now(),
  pre_weight NUMERIC,
  post_weight NUMERIC,
  waste_percentage NUMERIC,
  roast_level TEXT,
  roast_temp_charge NUMERIC,
  roast_temp_turning_point NUMERIC,
  roast_temp_first_crack NUMERIC,
  roast_temp_second_crack NUMERIC,
  preparation_seconds NUMERIC,
  roasting_seconds NUMERIC,
  cooling_seconds NUMERIC,
  inspection_seconds NUMERIC,
  packaging_seconds NUMERIC,
  operator TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS roast_profile_usages_profile_idx
ON public.roast_profile_usages(roast_profile_id);

CREATE INDEX IF NOT EXISTS roast_profile_usages_used_at_idx
ON public.roast_profile_usages(used_at);

CREATE INDEX IF NOT EXISTS roast_profile_usages_batch_idx
ON public.roast_profile_usages(batch_id);

ALTER TABLE public.roast_profile_usages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth all roast profile usages" ON public.roast_profile_usages;
CREATE POLICY "Auth all roast profile usages"
  ON public.roast_profile_usages
  FOR ALL
  USING (auth.role() = 'authenticated');

ALTER TABLE IF EXISTS public.roasting_batches
ADD COLUMN IF NOT EXISTS operator_id UUID,
ADD COLUMN IF NOT EXISTS green_qc_moisture NUMERIC,
ADD COLUMN IF NOT EXISTS green_qc_defects NUMERIC,
ADD COLUMN IF NOT EXISTS green_qc_color TEXT,
ADD COLUMN IF NOT EXISTS post_qc_color TEXT,
ADD COLUMN IF NOT EXISTS post_qc_aroma TEXT,
ADD COLUMN IF NOT EXISTS post_qc_cupping TEXT,
ADD COLUMN IF NOT EXISTS post_qc_defects TEXT,
ADD COLUMN IF NOT EXISTS post_qc_acidity NUMERIC,
ADD COLUMN IF NOT EXISTS post_qc_body NUMERIC,
ADD COLUMN IF NOT EXISTS post_qc_sweetness NUMERIC,
ADD COLUMN IF NOT EXISTS post_qc_cleanliness NUMERIC,
ADD COLUMN IF NOT EXISTS post_qc_balance NUMERIC,
ADD COLUMN IF NOT EXISTS quality_score INTEGER,
ADD COLUMN IF NOT EXISTS qc_status TEXT,
ADD COLUMN IF NOT EXISTS qc_reject_reason TEXT,
ADD COLUMN IF NOT EXISTS qc_checked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS qc_checked_by UUID,
ADD COLUMN IF NOT EXISTS qc_checked_by_name TEXT;

CREATE TABLE IF NOT EXISTS public.roast_quality_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id TEXT REFERENCES public.roasting_batches(id) ON DELETE SET NULL,
  bean_id UUID REFERENCES public.green_beans(id) ON DELETE SET NULL,
  roast_profile_id UUID REFERENCES public.roast_profiles(id) ON DELETE SET NULL,
  roaster_id UUID,
  roaster_name TEXT,
  qc_status TEXT,
  qc_score INTEGER,
  qc_reject_reason TEXT,
  green_qc_moisture NUMERIC,
  green_qc_defects NUMERIC,
  green_qc_color TEXT,
  post_qc_color TEXT,
  post_qc_aroma TEXT,
  post_qc_cupping TEXT,
  post_qc_defects TEXT,
  post_qc_acidity NUMERIC,
  post_qc_body NUMERIC,
  post_qc_sweetness NUMERIC,
  post_qc_cleanliness NUMERIC,
  post_qc_balance NUMERIC,
  qc_checked_at TIMESTAMPTZ,
  qc_checked_by UUID,
  qc_checked_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS roast_quality_history_batch_idx
ON public.roast_quality_history(batch_id);
CREATE INDEX IF NOT EXISTS roast_quality_history_bean_idx
ON public.roast_quality_history(bean_id);
CREATE INDEX IF NOT EXISTS roast_quality_history_profile_idx
ON public.roast_quality_history(roast_profile_id);
CREATE INDEX IF NOT EXISTS roast_quality_history_roaster_idx
ON public.roast_quality_history(roaster_id);
CREATE INDEX IF NOT EXISTS roast_quality_history_status_idx
ON public.roast_quality_history(qc_status);
CREATE INDEX IF NOT EXISTS roast_quality_history_checked_at_idx
ON public.roast_quality_history(qc_checked_at);

ALTER TABLE public.roast_quality_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth all roast quality history" ON public.roast_quality_history;
CREATE POLICY "Auth all roast quality history"
  ON public.roast_quality_history
  FOR ALL
  USING (auth.role() = 'authenticated');

ALTER TABLE IF EXISTS public.inventory_items
ADD COLUMN IF NOT EXISTS batch_id TEXT;

ALTER TABLE IF EXISTS public.inventory_items
ADD COLUMN IF NOT EXISTS bean_origin TEXT,
ADD COLUMN IF NOT EXISTS bean_variety TEXT,
ADD COLUMN IF NOT EXISTS roast_level TEXT;

ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS employee_id UUID;

ALTER TABLE IF EXISTS public.roasting_batches
ADD COLUMN IF NOT EXISTS production_order_id UUID;

ALTER TABLE IF EXISTS public.green_beans
ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'kg',
ADD COLUMN IF NOT EXISTS processing_method TEXT,
ADD COLUMN IF NOT EXISTS elevation TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE IF EXISTS public.green_bean_movements
ADD COLUMN IF NOT EXISTS quantity_in NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS quantity_out NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS balance_after NUMERIC,
ADD COLUMN IF NOT EXISTS reason TEXT;

ALTER TABLE public.green_bean_movements DROP CONSTRAINT IF EXISTS green_bean_movements_movement_type_check;
ALTER TABLE public.green_bean_movements
  ADD CONSTRAINT green_bean_movements_movement_type_check
  CHECK (movement_type IN ('OPENING_BALANCE', 'ROASTING', 'ROASTING_CONSUMPTION', 'ADJUSTMENT', 'PURCHASE'));

DO $$
BEGIN
  IF to_regclass('public.accounting_entries') IS NOT NULL THEN
    ALTER TABLE public.accounting_entries
      ADD COLUMN IF NOT EXISTS debit_account TEXT;
    ALTER TABLE public.accounting_entries
      ADD COLUMN IF NOT EXISTS credit_account TEXT;
    ALTER TABLE public.accounting_entries
      ADD COLUMN IF NOT EXISTS batch_id TEXT;
    ALTER TABLE public.accounting_entries DROP CONSTRAINT IF EXISTS accounting_entries_entry_type_check;
    ALTER TABLE public.accounting_entries
      ADD CONSTRAINT accounting_entries_entry_type_check
      CHECK (entry_type IN ('PURCHASE', 'ADJUSTMENT', 'LOSS', 'COGS', 'WIP', 'FINISHED_GOODS', 'WASTE', 'SALE_REVENUE'));
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.create_roasting_batch_atomic(
  p_batch_id TEXT,
  p_bean_id UUID,
  p_roast_profile_id UUID,
  p_roast_date DATE,
  p_roast_time TIME,
  p_level TEXT,
  p_pre_weight NUMERIC,
  p_operator TEXT,
  p_operator_id UUID,
  p_notes TEXT
)
RETURNS VOID AS $$
DECLARE
  v_quantity NUMERIC;
  v_cost_per_kg NUMERIC;
  v_now TIMESTAMPTZ := now();
  v_employee_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'ROASTER'
  ) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  SELECT employee_id INTO v_employee_id
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_employee_id IS NOT NULL AND to_regclass('public.employee_time_logs') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.employee_time_logs
      WHERE employee_id = v_employee_id
        AND clock_out_at IS NULL
        AND DATE(clock_in_at) = CURRENT_DATE
    ) THEN
      RAISE EXCEPTION 'ROASTER_NOT_CLOCKED_IN';
    END IF;
  END IF;

  IF p_pre_weight IS NULL OR p_pre_weight <= 0 THEN
    RAISE EXCEPTION 'INVALID_WEIGHT';
  END IF;

  SELECT quantity, cost_per_kg
  INTO v_quantity, v_cost_per_kg
  FROM public.green_beans
  WHERE id = p_bean_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BEAN_NOT_FOUND';
  END IF;

  IF COALESCE(v_quantity, 0) < p_pre_weight THEN
    RAISE EXCEPTION 'INSUFFICIENT_STOCK';
  END IF;

  UPDATE public.green_beans
  SET quantity = COALESCE(quantity, 0) - p_pre_weight
  WHERE id = p_bean_id;

  IF to_regclass('public.accounting_entries') IS NOT NULL THEN
    INSERT INTO public.accounting_entries (entry_type, amount, created_by, metadata, debit_account, credit_account, batch_id)
    VALUES (
      'WIP',
      (p_pre_weight * COALESCE(v_cost_per_kg, 0)),
      p_operator_id,
      jsonb_build_object('batch_id', p_batch_id, 'bean_id', p_bean_id, 'user_name', COALESCE(p_operator, 'System'), 'type', 'GREEN_BEAN_CONSUMPTION'),
      'WIP',
      'GREEN_BEAN_INVENTORY',
      p_batch_id
    );
  END IF;

  INSERT INTO public.roasting_batches (
    id,
    bean_id,
    roast_profile_id,
    roast_date,
    roast_time,
    level,
    pre_weight,
    status,
    operator,
    operator_id,
    notes,
    preparation_started_at,
    cost_per_kg,
    history
  ) VALUES (
    p_batch_id,
    p_bean_id,
    p_roast_profile_id,
    p_roast_date,
    p_roast_time,
    p_level,
    p_pre_weight,
    'Preparation',
    COALESCE(p_operator, 'System'),
    p_operator_id,
    p_notes,
    v_now,
    COALESCE(v_cost_per_kg, 0),
    jsonb_build_array(jsonb_build_object(
      'timestamp', to_char(v_now, 'YYYY-MM-DD HH24:MI:SS'),
      'action', 'CREATE',
      'operator', COALESCE(p_operator, 'System'),
      'details', format('Batch created with %s kg', p_pre_weight)
    ))
  );

  INSERT INTO public.green_bean_movements (
    bean_id,
    batch_reference,
    movement_type,
    quantity,
    quantity_in,
    quantity_out,
    balance_after,
    reason,
    unit,
    movement_at,
    created_by,
    created_by_name,
    notes
  ) VALUES (
    p_bean_id,
    p_batch_id,
    'ROASTING_CONSUMPTION',
    p_pre_weight,
    0,
    p_pre_weight,
    GREATEST(COALESCE(v_quantity, 0) - p_pre_weight, 0),
    'ROASTING_BATCH',
    'kg',
    v_now,
    p_operator_id,
    COALESCE(p_operator, 'System'),
    format('Batch %s consumption', p_batch_id)
  );
END;
$$ LANGUAGE plpgsql;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_items_batch_location_product_size_idx
ON public.inventory_items(batch_id, location_id, product_id, size);

CREATE OR REPLACE FUNCTION public.upsert_packaged_inventory(p_items JSONB)
RETURNS VOID AS $$
DECLARE
  item JSONB;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    INSERT INTO public.inventory_items (
      name,
      category,
      type,
      size,
      price,
      stock,
      batch_id,
      bean_origin,
      bean_variety,
      roast_level,
      product_id,
      sku_prefix,
      image,
      location_id,
      expiry_date,
      roast_date,
      cost_per_unit
    ) VALUES (
      item->>'name',
      item->>'category',
      item->>'type',
      item->>'size',
      COALESCE((item->>'price')::numeric, 0),
      COALESCE((item->>'stock')::numeric, 0),
      item->>'batch_id',
      item->>'bean_origin',
      item->>'bean_variety',
      item->>'roast_level',
      NULLIF(item->>'product_id', '')::uuid,
      item->>'sku_prefix',
      item->>'image',
      NULLIF(item->>'location_id', '')::uuid,
      NULLIF(item->>'expiry_date', '')::date,
      NULLIF(item->>'roast_date', '')::date,
      COALESCE((item->>'cost_per_unit')::numeric, 0)
    )
    ON CONFLICT (batch_id, location_id, product_id, size) DO UPDATE
    SET
      stock = COALESCE(public.inventory_items.stock, 0) + EXCLUDED.stock,
      price = EXCLUDED.price,
      cost_per_unit = EXCLUDED.cost_per_unit,
      expiry_date = EXCLUDED.expiry_date,
      roast_date = EXCLUDED.roast_date,
      sku_prefix = EXCLUDED.sku_prefix,
      image = EXCLUDED.image,
      name = EXCLUDED.name,
      category = EXCLUDED.category,
      bean_origin = EXCLUDED.bean_origin,
      bean_variety = EXCLUDED.bean_variety,
      roast_level = EXCLUDED.roast_level;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.post_roasting_packaging_entries(p_batch_id TEXT, p_location_id UUID, p_finished_goods_value NUMERIC, p_overhead_value NUMERIC, p_items JSONB, p_user_id UUID, p_user_name TEXT)
RETURNS VOID AS $$
BEGIN
  IF to_regclass('public.accounting_entries') IS NULL THEN
    RETURN;
  END IF;

  IF COALESCE(p_overhead_value, 0) > 0 THEN
    INSERT INTO public.accounting_entries (entry_type, amount, created_by, metadata, debit_account, credit_account, batch_id)
    VALUES (
      'WIP',
      p_overhead_value,
      p_user_id,
      jsonb_build_object('batch_id', p_batch_id, 'location_id', p_location_id, 'user_name', p_user_name, 'type', 'OVERHEAD_APPLIED'),
      'WIP',
      'PRODUCTION_OVERHEAD',
      p_batch_id
    );
  END IF;

  IF COALESCE(p_finished_goods_value, 0) > 0 THEN
    INSERT INTO public.accounting_entries (entry_type, amount, created_by, metadata, debit_account, credit_account, batch_id)
    VALUES (
      'FINISHED_GOODS',
      p_finished_goods_value,
      p_user_id,
      jsonb_build_object('batch_id', p_batch_id, 'location_id', p_location_id, 'user_name', p_user_name, 'items', COALESCE(p_items, '[]'::jsonb)),
      'FINISHED_GOODS_INVENTORY',
      'WIP',
      p_batch_id
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE VIEW public.packaged_sales_last_30_days AS
SELECT
  m.location_id,
  l.name AS location_name,
  i.product_id,
  i.name AS product_name,
  i.bean_origin,
  i.roast_level,
  max(i.roast_date) AS last_roast_date,
  sum(abs(m.quantity)) AS quantity_sold
FROM public.inventory_movements m
JOIN public.inventory_items i ON i.id = m.inventory_item_id
LEFT JOIN public.locations l ON l.id = m.location_id
WHERE m.movement_type = 'SALE'
  AND m.created_at >= now() - interval '30 days'
  AND i.type = 'PACKAGED_COFFEE'
GROUP BY m.location_id, l.name, i.product_id, i.name, i.bean_origin, i.roast_level;

CREATE OR REPLACE VIEW public.daily_production_report AS
WITH b AS (
  SELECT *
  FROM public.roasting_batches
  WHERE status <> 'DELETED'
)
SELECT
  roast_date AS day,
  count(*) AS batch_count,
  sum(coalesce(pre_weight, 0)) AS total_input_kg,
  sum(coalesce(nullif(post_weight, 0), pre_weight, 0)) AS total_output_kg,
  sum(
    CASE
      WHEN coalesce(post_weight, 0) > 0 THEN greatest(coalesce(pre_weight, 0) - coalesce(post_weight, 0), 0)
      ELSE 0
    END
  ) AS waste_kg,
  CASE
    WHEN sum(CASE WHEN coalesce(post_weight, 0) > 0 THEN coalesce(pre_weight, 0) ELSE 0 END) > 0
      THEN
        (
          sum(
            CASE
              WHEN coalesce(post_weight, 0) > 0 THEN greatest(coalesce(pre_weight, 0) - coalesce(post_weight, 0), 0)
              ELSE 0
            END
          )
          / sum(CASE WHEN coalesce(post_weight, 0) > 0 THEN coalesce(pre_weight, 0) ELSE 0 END)
        ) * 100
    ELSE NULL
  END AS waste_percent
FROM b
GROUP BY roast_date;

CREATE OR REPLACE VIEW public.monthly_production_report AS
WITH agg AS (
  SELECT
    date_trunc('month', roast_date)::date AS month,
    count(*) AS batch_count,
    sum(coalesce(pre_weight, 0)) AS total_input_kg,
    sum(coalesce(nullif(post_weight, 0), pre_weight, 0)) AS total_output_kg,
    sum(
      CASE
        WHEN coalesce(post_weight, 0) > 0 THEN greatest(coalesce(pre_weight, 0) - coalesce(post_weight, 0), 0)
        ELSE 0
      END
    ) AS waste_kg,
    CASE
      WHEN sum(CASE WHEN coalesce(post_weight, 0) > 0 THEN coalesce(pre_weight, 0) ELSE 0 END) > 0
        THEN
          (
            sum(
              CASE
                WHEN coalesce(post_weight, 0) > 0 THEN greatest(coalesce(pre_weight, 0) - coalesce(post_weight, 0), 0)
                ELSE 0
              END
            )
            / sum(CASE WHEN coalesce(post_weight, 0) > 0 THEN coalesce(pre_weight, 0) ELSE 0 END)
          ) * 100
      ELSE NULL
    END AS waste_percent
  FROM public.roasting_batches
  WHERE status <> 'DELETED'
  GROUP BY date_trunc('month', roast_date)::date
)
SELECT
  agg.*,
  lag(batch_count) over (order by month) AS prev_batch_count,
  (batch_count - lag(batch_count) over (order by month)) AS batch_count_delta,
  lag(total_input_kg) over (order by month) AS prev_total_input_kg,
  (total_input_kg - lag(total_input_kg) over (order by month)) AS total_input_kg_delta,
  lag(waste_percent) over (order by month) AS prev_waste_percent,
  (waste_percent - lag(waste_percent) over (order by month)) AS waste_percent_delta
FROM agg;

CREATE OR REPLACE VIEW public.waste_by_roast_profile_report AS
SELECT
  date_trunc('month', b.roast_date)::date AS month,
  b.roast_profile_id,
  rp.name AS roast_profile_name,
  count(*) AS batch_count,
  sum(coalesce(b.pre_weight, 0)) AS total_input_kg,
  sum(
    CASE
      WHEN coalesce(b.post_weight, 0) > 0 THEN greatest(coalesce(b.pre_weight, 0) - coalesce(b.post_weight, 0), 0)
      ELSE 0
    END
  ) AS waste_kg,
  CASE
    WHEN sum(CASE WHEN coalesce(b.post_weight, 0) > 0 THEN coalesce(b.pre_weight, 0) ELSE 0 END) > 0
      THEN
        (
          sum(
            CASE
              WHEN coalesce(b.post_weight, 0) > 0 THEN greatest(coalesce(b.pre_weight, 0) - coalesce(b.post_weight, 0), 0)
              ELSE 0
            END
          )
          / sum(CASE WHEN coalesce(b.post_weight, 0) > 0 THEN coalesce(b.pre_weight, 0) ELSE 0 END)
        ) * 100
    ELSE NULL
  END AS waste_percent
FROM public.roasting_batches b
LEFT JOIN public.roast_profiles rp ON rp.id = b.roast_profile_id
WHERE b.status <> 'DELETED'
GROUP BY date_trunc('month', b.roast_date)::date, b.roast_profile_id, rp.name;

CREATE OR REPLACE VIEW public.waste_by_roaster_report AS
SELECT
  date_trunc('month', b.roast_date)::date AS month,
  b.operator_id AS roaster_id,
  b.operator AS roaster_name,
  count(*) AS batch_count,
  sum(coalesce(b.pre_weight, 0)) AS total_input_kg,
  sum(
    CASE
      WHEN coalesce(b.post_weight, 0) > 0 THEN greatest(coalesce(b.pre_weight, 0) - coalesce(b.post_weight, 0), 0)
      ELSE 0
    END
  ) AS waste_kg,
  CASE
    WHEN sum(CASE WHEN coalesce(b.post_weight, 0) > 0 THEN coalesce(b.pre_weight, 0) ELSE 0 END) > 0
      THEN
        (
          sum(
            CASE
              WHEN coalesce(b.post_weight, 0) > 0 THEN greatest(coalesce(b.pre_weight, 0) - coalesce(b.post_weight, 0), 0)
              ELSE 0
            END
          )
          / sum(CASE WHEN coalesce(b.post_weight, 0) > 0 THEN coalesce(b.pre_weight, 0) ELSE 0 END)
        ) * 100
    ELSE NULL
  END AS waste_percent
FROM public.roasting_batches b
WHERE b.status <> 'DELETED'
GROUP BY date_trunc('month', b.roast_date)::date, b.operator_id, b.operator;

CREATE OR REPLACE VIEW public.waste_by_bean_report AS
SELECT
  date_trunc('month', b.roast_date)::date AS month,
  b.bean_id,
  gb.origin,
  gb.variety,
  count(*) AS batch_count,
  sum(coalesce(b.pre_weight, 0)) AS total_input_kg,
  sum(
    CASE
      WHEN coalesce(b.post_weight, 0) > 0 THEN greatest(coalesce(b.pre_weight, 0) - coalesce(b.post_weight, 0), 0)
      ELSE 0
    END
  ) AS waste_kg,
  CASE
    WHEN sum(CASE WHEN coalesce(b.post_weight, 0) > 0 THEN coalesce(b.pre_weight, 0) ELSE 0 END) > 0
      THEN
        (
          sum(
            CASE
              WHEN coalesce(b.post_weight, 0) > 0 THEN greatest(coalesce(b.pre_weight, 0) - coalesce(b.post_weight, 0), 0)
              ELSE 0
            END
          )
          / sum(CASE WHEN coalesce(b.post_weight, 0) > 0 THEN coalesce(b.pre_weight, 0) ELSE 0 END)
        ) * 100
    ELSE NULL
  END AS waste_percent
FROM public.roasting_batches b
LEFT JOIN public.green_beans gb ON gb.id = b.bean_id
WHERE b.status <> 'DELETED'
GROUP BY date_trunc('month', b.roast_date)::date, b.bean_id, gb.origin, gb.variety;

CREATE OR REPLACE VIEW public.qc_daily_report AS
SELECT
  (h.qc_checked_at::date) AS day,
  count(*) FILTER (WHERE h.qc_status IN ('PASSED', 'FAILED')) AS evaluated_count,
  count(*) FILTER (WHERE h.qc_status = 'PASSED') AS passed_count,
  CASE
    WHEN count(*) FILTER (WHERE h.qc_status IN ('PASSED', 'FAILED')) > 0
      THEN (count(*) FILTER (WHERE h.qc_status = 'PASSED')::numeric / (count(*) FILTER (WHERE h.qc_status IN ('PASSED', 'FAILED'))::numeric)) * 100
    ELSE NULL
  END AS pass_rate_percent,
  avg(h.qc_score) FILTER (WHERE h.qc_score IS NOT NULL) AS avg_score
FROM public.roast_quality_history h
WHERE h.qc_checked_at IS NOT NULL
GROUP BY (h.qc_checked_at::date);

CREATE OR REPLACE VIEW public.qc_monthly_report AS
SELECT
  date_trunc('month', h.qc_checked_at)::date AS month,
  count(*) FILTER (WHERE h.qc_status IN ('PASSED', 'FAILED')) AS evaluated_count,
  count(*) FILTER (WHERE h.qc_status = 'PASSED') AS passed_count,
  CASE
    WHEN count(*) FILTER (WHERE h.qc_status IN ('PASSED', 'FAILED')) > 0
      THEN (count(*) FILTER (WHERE h.qc_status = 'PASSED')::numeric / (count(*) FILTER (WHERE h.qc_status IN ('PASSED', 'FAILED'))::numeric)) * 100
    ELSE NULL
  END AS pass_rate_percent,
  avg(h.qc_score) FILTER (WHERE h.qc_score IS NOT NULL) AS avg_score
FROM public.roast_quality_history h
WHERE h.qc_checked_at IS NOT NULL
GROUP BY date_trunc('month', h.qc_checked_at)::date;

CREATE OR REPLACE VIEW public.roaster_performance_monthly_report AS
WITH prod AS (
  SELECT
    date_trunc('month', b.roast_date)::date AS month,
    b.operator_id AS roaster_id,
    b.operator AS roaster_name,
    count(*) AS batch_count,
    sum(coalesce(b.pre_weight, 0)) AS total_input_kg,
    sum(coalesce(nullif(b.post_weight, 0), b.pre_weight, 0)) AS total_output_kg,
    sum(
      CASE
        WHEN coalesce(b.post_weight, 0) > 0 THEN greatest(coalesce(b.pre_weight, 0) - coalesce(b.post_weight, 0), 0)
        ELSE 0
      END
    ) AS waste_kg,
    CASE
      WHEN sum(CASE WHEN coalesce(b.post_weight, 0) > 0 THEN coalesce(b.pre_weight, 0) ELSE 0 END) > 0
        THEN
          (
            sum(
              CASE
                WHEN coalesce(b.post_weight, 0) > 0 THEN greatest(coalesce(b.pre_weight, 0) - coalesce(b.post_weight, 0), 0)
                ELSE 0
              END
            )
            / sum(CASE WHEN coalesce(b.post_weight, 0) > 0 THEN coalesce(b.pre_weight, 0) ELSE 0 END)
          ) * 100
      ELSE NULL
    END AS waste_percent
  FROM public.roasting_batches b
  WHERE b.status <> 'DELETED'
  GROUP BY date_trunc('month', b.roast_date)::date, b.operator_id, b.operator
),
qc AS (
  SELECT
    date_trunc('month', h.qc_checked_at)::date AS month,
    h.roaster_id,
    h.roaster_name,
    count(*) FILTER (WHERE h.qc_status IN ('PASSED', 'FAILED')) AS evaluated_count,
    count(*) FILTER (WHERE h.qc_status = 'PASSED') AS passed_count,
    CASE
      WHEN count(*) FILTER (WHERE h.qc_status IN ('PASSED', 'FAILED')) > 0
        THEN (count(*) FILTER (WHERE h.qc_status = 'PASSED')::numeric / (count(*) FILTER (WHERE h.qc_status IN ('PASSED', 'FAILED'))::numeric)) * 100
      ELSE NULL
    END AS pass_rate_percent,
    avg(h.qc_score) FILTER (WHERE h.qc_score IS NOT NULL) AS avg_score
  FROM public.roast_quality_history h
  WHERE h.qc_checked_at IS NOT NULL
  GROUP BY date_trunc('month', h.qc_checked_at)::date, h.roaster_id, h.roaster_name
)
SELECT
  coalesce(prod.month, qc.month) AS month,
  coalesce(prod.roaster_id, qc.roaster_id) AS roaster_id,
  coalesce(prod.roaster_name, qc.roaster_name) AS roaster_name,
  prod.batch_count,
  prod.total_input_kg,
  prod.total_output_kg,
  prod.waste_kg,
  prod.waste_percent,
  qc.evaluated_count,
  qc.passed_count,
  qc.pass_rate_percent,
  qc.avg_score
FROM prod
FULL JOIN qc
  ON qc.month = prod.month
  AND qc.roaster_id = prod.roaster_id;

CREATE TABLE IF NOT EXISTS public.roasting_audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name text NOT NULL,
  record_id text,
  batch_id text,
  changed_by uuid REFERENCES auth.users(id),
  change_type text NOT NULL,
  old_data jsonb,
  new_data jsonb,
  changed_at timestamptz DEFAULT now()
);

ALTER TABLE public.roasting_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins and Managers can view roasting audit logs" ON public.roasting_audit_logs;
CREATE POLICY "Admins and Managers can view roasting audit logs"
ON public.roasting_audit_logs FOR SELECT
USING (
  auth.uid() IN (
    SELECT id FROM public.profiles WHERE role IN ('ADMIN', 'OWNER', 'MANAGER')
  )
);

CREATE OR REPLACE FUNCTION public.log_roasting_batches_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.roasting_audit_logs (table_name, record_id, batch_id, changed_by, change_type, new_data)
    VALUES ('roasting_batches', NEW.id, NEW.id, auth.uid(), 'INSERT', row_to_json(NEW));
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO public.roasting_audit_logs (table_name, record_id, batch_id, changed_by, change_type, old_data, new_data)
    VALUES ('roasting_batches', NEW.id, NEW.id, auth.uid(), 'UPDATE', row_to_json(OLD), row_to_json(NEW));
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO public.roasting_audit_logs (table_name, record_id, batch_id, changed_by, change_type, old_data)
    VALUES ('roasting_batches', OLD.id, OLD.id, auth.uid(), 'DELETE', row_to_json(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_roasting_batches_changes ON public.roasting_batches;
CREATE TRIGGER trigger_log_roasting_batches_changes
AFTER INSERT OR UPDATE OR DELETE ON public.roasting_batches
FOR EACH ROW EXECUTE FUNCTION public.log_roasting_batches_changes();

CREATE OR REPLACE FUNCTION public.log_roast_profile_usages_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.roasting_audit_logs (table_name, record_id, batch_id, changed_by, change_type, new_data)
    VALUES ('roast_profile_usages', NEW.id::text, NEW.batch_id, auth.uid(), 'INSERT', row_to_json(NEW));
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO public.roasting_audit_logs (table_name, record_id, batch_id, changed_by, change_type, old_data, new_data)
    VALUES ('roast_profile_usages', NEW.id::text, NEW.batch_id, auth.uid(), 'UPDATE', row_to_json(OLD), row_to_json(NEW));
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO public.roasting_audit_logs (table_name, record_id, batch_id, changed_by, change_type, old_data)
    VALUES ('roast_profile_usages', OLD.id::text, OLD.batch_id, auth.uid(), 'DELETE', row_to_json(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_roast_profile_usages_changes ON public.roast_profile_usages;
CREATE TRIGGER trigger_log_roast_profile_usages_changes
AFTER INSERT OR UPDATE OR DELETE ON public.roast_profile_usages
FOR EACH ROW EXECUTE FUNCTION public.log_roast_profile_usages_changes();

CREATE OR REPLACE FUNCTION public.log_green_bean_movements_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.roasting_audit_logs (table_name, record_id, batch_id, changed_by, change_type, new_data)
    VALUES ('green_bean_movements', NEW.id::text, NEW.batch_reference, auth.uid(), 'INSERT', row_to_json(NEW));
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO public.roasting_audit_logs (table_name, record_id, batch_id, changed_by, change_type, old_data, new_data)
    VALUES ('green_bean_movements', NEW.id::text, NEW.batch_reference, auth.uid(), 'UPDATE', row_to_json(OLD), row_to_json(NEW));
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO public.roasting_audit_logs (table_name, record_id, batch_id, changed_by, change_type, old_data)
    VALUES ('green_bean_movements', OLD.id::text, OLD.batch_reference, auth.uid(), 'DELETE', row_to_json(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_green_bean_movements_changes ON public.green_bean_movements;
CREATE TRIGGER trigger_log_green_bean_movements_changes
AFTER INSERT OR UPDATE OR DELETE ON public.green_bean_movements
FOR EACH ROW EXECUTE FUNCTION public.log_green_bean_movements_changes();

CREATE OR REPLACE FUNCTION public.log_roast_quality_history_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.roasting_audit_logs (table_name, record_id, batch_id, changed_by, change_type, new_data)
    VALUES ('roast_quality_history', NEW.id::text, NEW.batch_id, auth.uid(), 'INSERT', row_to_json(NEW));
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO public.roasting_audit_logs (table_name, record_id, batch_id, changed_by, change_type, old_data, new_data)
    VALUES ('roast_quality_history', NEW.id::text, NEW.batch_id, auth.uid(), 'UPDATE', row_to_json(OLD), row_to_json(NEW));
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO public.roasting_audit_logs (table_name, record_id, batch_id, changed_by, change_type, old_data)
    VALUES ('roast_quality_history', OLD.id::text, OLD.batch_id, auth.uid(), 'DELETE', row_to_json(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_roast_quality_history_changes ON public.roast_quality_history;
CREATE TRIGGER trigger_log_roast_quality_history_changes
AFTER INSERT OR UPDATE OR DELETE ON public.roast_quality_history
FOR EACH ROW EXECUTE FUNCTION public.log_roast_quality_history_changes();

CREATE TABLE IF NOT EXISTS public.roast_curve_points (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id text REFERENCES public.roasting_batches(id) ON DELETE CASCADE,
  t_seconds integer,
  temp_c numeric,
  bean_temp_c numeric,
  recorded_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS roast_curve_points_batch_recorded_idx ON public.roast_curve_points(batch_id, recorded_at);
CREATE INDEX IF NOT EXISTS roast_curve_points_batch_t_idx ON public.roast_curve_points(batch_id, t_seconds);

ALTER TABLE public.roast_curve_points ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth all roast curve points" ON public.roast_curve_points;
CREATE POLICY "Auth all roast curve points" ON public.roast_curve_points FOR ALL USING (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS roasting_batches_roast_date_idx ON public.roasting_batches(roast_date);
CREATE INDEX IF NOT EXISTS roasting_batches_operator_date_idx ON public.roasting_batches(operator_id, roast_date);
CREATE INDEX IF NOT EXISTS roast_quality_history_checked_at_idx ON public.roast_quality_history(qc_checked_at);
CREATE INDEX IF NOT EXISTS green_bean_movements_movement_at_idx ON public.green_bean_movements(movement_at);
CREATE INDEX IF NOT EXISTS green_bean_movements_bean_movement_idx ON public.green_bean_movements(bean_id, movement_at);
CREATE INDEX IF NOT EXISTS roast_profile_usages_profile_used_at_idx ON public.roast_profile_usages(roast_profile_id, used_at);

CREATE OR REPLACE VIEW public.green_bean_consumption_daily_report AS
SELECT
  (m.movement_at::date) AS day,
  m.bean_id,
  gb.origin,
  gb.variety,
  sum(abs(m.quantity)) AS quantity_kg,
  avg(gb.cost_per_kg) AS cost_per_kg,
  sum(abs(m.quantity) * coalesce(gb.cost_per_kg, 0)) AS estimated_cost
FROM public.green_bean_movements m
LEFT JOIN public.green_beans gb ON gb.id = m.bean_id
WHERE m.movement_type IN ('ROASTING_CONSUMPTION', 'ROASTING')
GROUP BY (m.movement_at::date), m.bean_id, gb.origin, gb.variety;

CREATE OR REPLACE VIEW public.green_bean_consumption_monthly_report AS
SELECT
  date_trunc('month', m.movement_at)::date AS month,
  m.bean_id,
  gb.origin,
  gb.variety,
  sum(abs(m.quantity)) AS quantity_kg,
  avg(gb.cost_per_kg) AS cost_per_kg,
  sum(abs(m.quantity) * coalesce(gb.cost_per_kg, 0)) AS estimated_cost
FROM public.green_bean_movements m
LEFT JOIN public.green_beans gb ON gb.id = m.bean_id
WHERE m.movement_type IN ('ROASTING_CONSUMPTION', 'ROASTING')
GROUP BY date_trunc('month', m.movement_at)::date, m.bean_id, gb.origin, gb.variety;

CREATE OR REPLACE VIEW public.roast_profile_consistency_report AS
WITH w AS (
  SELECT
    date_trunc('month', used_at)::date AS month,
    roast_profile_id,
    waste_percentage,
    roast_temp_charge,
    roasting_seconds
  FROM public.roast_profile_usages
  WHERE roast_profile_id IS NOT NULL
),
stats AS (
  SELECT
    month,
    roast_profile_id,
    count(*) AS usage_count,
    avg(waste_percentage) AS avg_waste_percentage,
    stddev_samp(waste_percentage) AS stddev_waste_percentage,
    avg(roast_temp_charge) AS avg_roast_temp_charge,
    stddev_samp(roast_temp_charge) AS stddev_roast_temp_charge,
    avg(roasting_seconds) AS avg_roasting_seconds,
    stddev_samp(roasting_seconds) AS stddev_roasting_seconds
  FROM w
  GROUP BY month, roast_profile_id
)
SELECT
  stats.month,
  stats.roast_profile_id,
  rp.name AS roast_profile_name,
  stats.usage_count,
  stats.avg_waste_percentage,
  stats.stddev_waste_percentage,
  CASE WHEN coalesce(stats.avg_waste_percentage, 0) = 0 THEN NULL ELSE (stats.stddev_waste_percentage / nullif(stats.avg_waste_percentage, 0)) * 100 END AS waste_cv_percent,
  avg(CASE WHEN w.waste_percentage IS NOT NULL AND stats.avg_waste_percentage IS NOT NULL AND abs(w.waste_percentage - stats.avg_waste_percentage) <= 1 THEN 1 ELSE 0 END) * 100 AS waste_within_1pct_rate,
  stats.avg_roast_temp_charge,
  stats.stddev_roast_temp_charge,
  CASE WHEN coalesce(stats.avg_roast_temp_charge, 0) = 0 THEN NULL ELSE (stats.stddev_roast_temp_charge / nullif(stats.avg_roast_temp_charge, 0)) * 100 END AS charge_cv_percent,
  avg(CASE WHEN w.roast_temp_charge IS NOT NULL AND stats.avg_roast_temp_charge IS NOT NULL AND abs(w.roast_temp_charge - stats.avg_roast_temp_charge) <= 5 THEN 1 ELSE 0 END) * 100 AS charge_within_5c_rate,
  stats.avg_roasting_seconds,
  stats.stddev_roasting_seconds,
  CASE WHEN coalesce(stats.avg_roasting_seconds, 0) = 0 THEN NULL ELSE (stats.stddev_roasting_seconds / nullif(stats.avg_roasting_seconds, 0)) * 100 END AS roasting_seconds_cv_percent,
  avg(CASE WHEN w.roasting_seconds IS NOT NULL AND stats.avg_roasting_seconds IS NOT NULL AND abs(w.roasting_seconds - stats.avg_roasting_seconds) <= 30 THEN 1 ELSE 0 END) * 100 AS roast_time_within_30s_rate
FROM stats
JOIN w ON w.month = stats.month AND w.roast_profile_id = stats.roast_profile_id
LEFT JOIN public.roast_profiles rp ON rp.id = stats.roast_profile_id
GROUP BY
  stats.month,
  stats.roast_profile_id,
  rp.name,
  stats.usage_count,
  stats.avg_waste_percentage,
  stats.stddev_waste_percentage,
  stats.avg_roast_temp_charge,
  stats.stddev_roast_temp_charge,
  stats.avg_roasting_seconds,
  stats.stddev_roasting_seconds;

DO $$
BEGIN
  IF to_regclass('public.accounting_entries') IS NOT NULL AND to_regclass('public.inventory_items') IS NOT NULL THEN
    EXECUTE $v$
      CREATE OR REPLACE VIEW public.production_cost_report AS
      WITH costs AS (
        SELECT
          batch_id,
          sum(CASE WHEN entry_type = 'WIP' AND (metadata->>'type') = 'GREEN_BEAN_CONSUMPTION' THEN amount ELSE 0 END) AS green_bean_cost,
          sum(CASE WHEN entry_type = 'WIP' AND (metadata->>'type') = 'OVERHEAD_APPLIED' THEN amount ELSE 0 END) AS overhead_cost,
          sum(CASE WHEN entry_type = 'FINISHED_GOODS' THEN amount ELSE 0 END) AS finished_goods_value
        FROM public.accounting_entries
        WHERE batch_id IS NOT NULL
        GROUP BY batch_id
      ),
      units AS (
        SELECT
          batch_id,
          sum(coalesce(stock, 0)) AS packaged_units
        FROM public.inventory_items
        WHERE batch_id IS NOT NULL
          AND type = 'PACKAGED_COFFEE'
        GROUP BY batch_id
      )
      SELECT
        b.id AS batch_id,
        b.roast_date,
        b.roast_time,
        b.status,
        b.bean_id,
        gb.origin AS bean_origin,
        gb.variety AS bean_variety,
        b.roast_profile_id,
        rp.name AS roast_profile_name,
        b.operator_id AS roaster_id,
        b.operator AS roaster_name,
        b.pre_weight,
        b.post_weight,
        coalesce(c.green_bean_cost, 0) AS green_bean_cost,
        coalesce(c.overhead_cost, 0) AS overhead_cost,
        coalesce(c.green_bean_cost, 0) + coalesce(c.overhead_cost, 0) AS total_batch_cost,
        coalesce(c.finished_goods_value, 0) AS finished_goods_value,
        coalesce(u.packaged_units, 0) AS packaged_units,
        CASE
          WHEN coalesce(nullif(b.post_weight, 0), 0) > 0
            THEN (coalesce(c.green_bean_cost, 0) + coalesce(c.overhead_cost, 0)) / nullif(b.post_weight, 0)
          ELSE NULL
        END AS cost_per_roasted_kg,
        CASE
          WHEN coalesce(u.packaged_units, 0) > 0
            THEN (coalesce(c.green_bean_cost, 0) + coalesce(c.overhead_cost, 0)) / nullif(u.packaged_units, 0)
          ELSE NULL
        END AS cost_per_packaged_unit
      FROM public.roasting_batches b
      LEFT JOIN public.green_beans gb ON gb.id = b.bean_id
      LEFT JOIN public.roast_profiles rp ON rp.id = b.roast_profile_id
      LEFT JOIN costs c ON c.batch_id = b.id
      LEFT JOIN units u ON u.batch_id = b.id
      WHERE b.status <> 'DELETED';
    $v$;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
  `.trim();

  const generateSku = (name: string) => {
    const base = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
    const suffix = Date.now().toString().slice(-6);
    return [base || 'SKU', suffix].join('-');
  };
  const normalizeSku = (value: string) => value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  const parseDelimited = (text: string, delimiter: string) => {
    const rows: string[][] = [];
    let row: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const next = text[i + 1];
      if (char === '"') {
        if (inQuotes && next === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (char === '\r') continue;
      if (char === '\n' && !inQuotes) {
        row.push(current);
        rows.push(row);
        row = [];
        current = '';
        continue;
      }
      if (char === delimiter && !inQuotes) {
        row.push(current);
        current = '';
        continue;
      }
      current += char;
    }
    row.push(current);
    rows.push(row);
    return rows.filter(r => r.some(cell => cell.trim() !== ''));
  };
  const parseBoolean = (value: string) => ['true', '1', 'yes', 'y'].includes(value.trim().toLowerCase());
  const parseJsonValue = (value: string) => {
    if (!value.trim()) return null;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  };
  const escapeCsvValue = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const productCatalogHeaders = [
    'name',
    'description',
    'category',
    'main_category',
    'sub_category',
    'type',
    'base_price',
    'selling_price',
    'cost_price',
    'profit_margin',
    'sku',
    'supplier',
    'unit',
    'product_status',
    'is_perishable',
    'expiry_date',
    'image',
    'variant_of',
    'variant_label',
    'variant_size',
    'variant_flavor',
    'roast_level',
    'template_id',
    'add_ons',
    'recipe',
    'bom'
  ];
  const buildCatalogRow = (product: ProductDefinition) => [
    product.name || '',
    product.description || '',
    product.category || '',
    product.mainCategory || '',
    product.subCategory || '',
    product.type || '',
    String(product.basePrice ?? ''),
    String(product.sellingPrice ?? ''),
    String(product.costPrice ?? ''),
    String(product.profitMargin ?? ''),
    product.sku || '',
    product.supplier || '',
    product.unit || '',
    product.productStatus || '',
    String(product.isPerishable ?? false),
    product.expiryDate || '',
    product.image || '',
    product.variantOf || '',
    product.variantLabel || '',
    product.variantSize || '',
    product.variantFlavor || '',
    product.roastLevel || '',
    product.templateId || '',
    JSON.stringify(product.add_ons || []),
    JSON.stringify(product.recipe || null),
    JSON.stringify(product.bom || [])
  ];
  const downloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };
  const handleExportCatalogCsv = (items: ProductDefinition[]) => {
    const rows = items.map(buildCatalogRow);
    const csvContent = [productCatalogHeaders, ...rows]
      .map(row => row.map(cell => escapeCsvValue(String(cell ?? ''))).join(','))
      .join('\n');
    downloadFile(csvContent, `product_catalog_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8;');
  };
  const handleExportCatalogExcel = (items: ProductDefinition[]) => {
    const rows = items.map(buildCatalogRow);
    const tsvContent = [productCatalogHeaders, ...rows]
      .map(row => row.map(cell => String(cell ?? '')).join('\t'))
      .join('\n');
    downloadFile(tsvContent, `product_catalog_${new Date().toISOString().slice(0, 10)}.xls`, 'application/vnd.ms-excel;charset=utf-8;');
  };
  const handleDownloadCatalogTemplate = () => {
    const csvContent = productCatalogHeaders.join(',');
    downloadFile(csvContent, 'product_catalog_template.csv', 'text/csv;charset=utf-8;');
  };
  const handleImportCatalog = async (file: File) => {
    setIsImportingCatalog(true);
    try {
      const text = await file.text();
      const firstLine = text.split(/\r?\n/)[0] || '';
      const delimiter = firstLine.split('\t').length > firstLine.split(',').length ? '\t' : ',';
      const rows = parseDelimited(text, delimiter);
      if (rows.length < 2) throw new Error('empty');
      const headers = rows[0].map(h => h.trim().toLowerCase());
      const getValue = (row: string[], key: string) => {
        const idx = headers.indexOf(key);
        return idx >= 0 ? row[idx] ?? '' : '';
      };
      const payloads = rows.slice(1).map(row => {
        const name = getValue(row, 'name').trim();
        if (!name) return null;
        const rawSku = getValue(row, 'sku').trim();
        const normalizedSku = normalizeSku(rawSku);
        const finalSku = normalizedSku || generateSku(name);
        const statusRaw = getValue(row, 'product_status').trim().toUpperCase();
        const productStatus = ['ACTIVE', 'DISABLED', 'DISCONTINUED'].includes(statusRaw) ? statusRaw : 'ACTIVE';
        const typeRaw = getValue(row, 'type').trim().toUpperCase();
        const type = ['BEVERAGE', 'PACKAGED_COFFEE', 'ACCESSORY', 'RAW_MATERIAL'].includes(typeRaw) ? typeRaw : 'PACKAGED_COFFEE';
        const basePriceValue = getValue(row, 'base_price') || getValue(row, 'selling_price');
        const basePrice = parseFloat(basePriceValue || '0');
        const sellingPrice = parseFloat(getValue(row, 'selling_price') || basePrice.toString());
        const costPrice = parseFloat(getValue(row, 'cost_price') || '0');
        const profitMargin = parseFloat(getValue(row, 'profit_margin') || '0');
        const payload: any = {
          name,
          category: getValue(row, 'sub_category') || getValue(row, 'category') || getValue(row, 'main_category') || 'Coffee',
          base_price: Number.isNaN(basePrice) ? 0 : basePrice,
          is_active: productStatus === 'ACTIVE',
          sku: finalSku
        };
        const id = getValue(row, 'id').trim();
        if (id) payload.id = id;
        if (!missingCols.has('description')) payload.description = getValue(row, 'description') || null;
        if (!missingCols.has('type')) payload.type = type;
        if (!missingCols.has('image')) payload.image = getValue(row, 'image') || null;
        if (!missingCols.has('main_category')) payload.main_category = getValue(row, 'main_category') || null;
        if (!missingCols.has('sub_category')) payload.sub_category = getValue(row, 'sub_category') || null;
        if (!missingCols.has('variant_of')) payload.variant_of = getValue(row, 'variant_of') || null;
        if (!missingCols.has('variant_label')) payload.variant_label = getValue(row, 'variant_label') || null;
        if (!missingCols.has('variant_size')) payload.variant_size = getValue(row, 'variant_size') || null;
        if (!missingCols.has('variant_flavor')) payload.variant_flavor = getValue(row, 'variant_flavor') || null;
        if (!missingCols.has('unit')) payload.unit = getValue(row, 'unit') || null;
        if (!missingCols.has('selling_price')) payload.selling_price = Number.isNaN(sellingPrice) ? payload.base_price : sellingPrice;
        if (!missingCols.has('cost_price')) payload.cost_price = Number.isNaN(costPrice) ? 0 : costPrice;
        if (!missingCols.has('profit_margin')) payload.profit_margin = Number.isNaN(profitMargin) ? 0 : profitMargin;
        if (!missingCols.has('is_perishable')) payload.is_perishable = parseBoolean(getValue(row, 'is_perishable') || 'false');
        if (!missingCols.has('expiry_date')) payload.expiry_date = getValue(row, 'expiry_date') || null;
        if (!missingCols.has('product_status')) payload.product_status = productStatus;
        if (!missingCols.has('supplier')) payload.supplier = getValue(row, 'supplier') || null;
        if (!missingCols.has('add_ons')) {
          const addOns = parseJsonValue(getValue(row, 'add_ons'));
          payload.add_ons = Array.isArray(addOns) ? addOns : [];
        }
        if (!missingCols.has('bom')) {
          const bom = parseJsonValue(getValue(row, 'bom'));
          payload.bom = Array.isArray(bom) ? bom : [];
        }
        if (!missingCols.has('recipe')) {
          const recipe = parseJsonValue(getValue(row, 'recipe'));
          payload.recipe = recipe && typeof recipe === 'object' ? recipe : null;
        }
        if (!missingCols.has('roast_level')) payload.roast_level = getValue(row, 'roast_level') || null;
        if (!missingCols.has('template_id')) payload.template_id = getValue(row, 'template_id') || null;
        return payload;
      }).filter(Boolean) as any[];
      if (!payloads.length) throw new Error('empty');
      const { error } = await supabase
        .from('product_definitions')
        .upsert(payloads, { onConflict: 'sku' });
      if (error) throw error;
      await fetchInitialData();
      setSuccessMsg(t.importSuccess.replace('{count}', String(payloads.length)));
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch {
      alert(t.importError);
    } finally {
      setIsImportingCatalog(false);
      if (catalogImportRef.current) catalogImportRef.current.value = '';
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const desiredSku = normalizeSku(productForm.sku || '');
    const finalSku = desiredSku || generateSku(productForm.name);
    const skuTaken = products.some(p => (p.sku || '').toUpperCase() === finalSku.toUpperCase() && p.id !== editingId);
    if (skuTaken) {
      alert(t.skuAlreadyExists);
      setIsSaving(false);
      return;
    }

    const sellingPrice = parseFloat(productForm.basePrice);
    const laborCost = parseFloat(productForm.laborCost || '0');
    const roastingOverhead = parseFloat(productForm.roastingOverhead || '0');
    const estimatedGreenBeanCost = parseFloat(productForm.estimatedGreenBeanCost || '0');
    const costPrice = productForm.type === 'BEVERAGE'
      ? calculatedBeverageCost + laborCost + roastingOverhead
      : productForm.type === 'PACKAGED_COFFEE'
        ? estimatedGreenBeanCost + laborCost + roastingOverhead
        : 0;
    const profitMargin = sellingPrice > 0 ? ((sellingPrice - costPrice) / sellingPrice) * 100 : 0;

    const payload: any = {
      name: productForm.name,
      category: productForm.subCategory || productForm.category,
      base_price: sellingPrice,
      is_active: productForm.productStatus === 'ACTIVE',
      sku: finalSku
    };

    if (editingId) payload.id = editingId;
    if (!missingCols.has('description')) payload.description = productForm.description;
    if (!missingCols.has('type')) payload.type = productForm.type;
    if (!missingCols.has('image')) payload.image = productForm.image;
    if (!missingCols.has('add_ons')) payload.add_ons = productAddOns;
    if (!missingCols.has('main_category')) payload.main_category = productForm.mainCategory || null;
    if (!missingCols.has('sub_category')) payload.sub_category = productForm.subCategory || null;
    if (!missingCols.has('variant_of')) payload.variant_of = productForm.variantOf || null;
    if (!missingCols.has('variant_label')) payload.variant_label = productForm.variantLabel || null;
    if (!missingCols.has('variant_size')) payload.variant_size = productForm.variantSize || null;
    if (!missingCols.has('variant_flavor')) payload.variant_flavor = productForm.variantFlavor || null;
    if (!missingCols.has('unit')) payload.unit = productForm.unit || null;
    if (!missingCols.has('selling_price')) payload.selling_price = sellingPrice;
    if (!missingCols.has('cost_price')) payload.cost_price = costPrice;
    if (!missingCols.has('profit_margin')) payload.profit_margin = profitMargin;
    if (!missingCols.has('labor_cost')) payload.labor_cost = laborCost;
    if (!missingCols.has('roasting_overhead')) payload.roasting_overhead = roastingOverhead;
    if (!missingCols.has('estimated_green_bean_cost')) payload.estimated_green_bean_cost = estimatedGreenBeanCost;
    if (!missingCols.has('is_perishable')) payload.is_perishable = productForm.isPerishable;
    if (!missingCols.has('expiry_date')) payload.expiry_date = productForm.isPerishable ? (productForm.expiryDate || null) : null;
    if (!missingCols.has('bom')) payload.bom = bomComponents;
    if (!missingCols.has('product_status')) payload.product_status = productForm.productStatus;
    if (!missingCols.has('supplier')) payload.supplier = productForm.supplier || null;

    if (productForm.type === 'PACKAGED_COFFEE') {
      payload.roast_level = productForm.roastLevel;
      payload.template_id = productForm.templateId || null;
      if (!missingCols.has('bean_id')) payload.bean_id = productForm.beanId || null;
      payload.recipe = null;
    } else if (productForm.type === 'BEVERAGE') {
      if (!missingCols.has('recipe')) {
        payload.recipe = { ingredients: recipeIngredients };
      }
      payload.roast_level = null;
      payload.template_id = null;
    } else {
      payload.recipe = null;
      payload.roast_level = null;
      payload.template_id = null;
    }

    try {
      const { error } = await supabase.from('product_definitions').upsert([payload]);
      if (error) throw error;
      await fetchInitialData();
      setShowProductModal(false);
      resetProductForm();
      setSuccessMsg(t.saveSuccess);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message);
    } finally { setIsSaving(false); }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .upsert({
          ...settings,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      if (data) setSettings(data);

      setSuccessMsg(t.settingsSaved);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      console.error("Settings Save Error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const resetProductForm = () => {
    setEditingId(null);
    setProductForm({
      name: '', description: '', category: 'Coffee', roastLevel: RoastingLevel.MEDIUM,
      mainCategory: '', subCategory: '', variantOf: '', variantLabel: '', variantSize: '', variantFlavor: '', unit: 'piece', templateId: '', basePrice: '', image: '', sku: '', supplier: '', isActive: true, productStatus: 'ACTIVE', isPerishable: false, expiryDate: '', type: 'PACKAGED_COFFEE',
      beanId: '',
      laborCost: '0', roastingOverhead: '0', estimatedGreenBeanCost: '0'
    });
    setRecipeIngredients([]);
    setBomComponents([]);
    setProductAddOns([]);
  };

  const addIngredient = () => setRecipeIngredients([...recipeIngredients, { ingredient_id: '', name: '', amount: 0, unit: 'g' }]);
  const updateIngredient = (idx: number, field: string, value: any) => {
    const newIng = [...recipeIngredients];
    if (field === 'ingredient_id') {
      const selected = allIngredients.find(i => i.id === value);
      newIng[idx] = { ...newIng[idx], ingredient_id: value, name: selected?.name || '', unit: selected?.unit || 'g' };
    } else {
      newIng[idx] = { ...newIng[idx], [field]: value } as any;
    }
    setRecipeIngredients(newIng);
  };

  const addBomComponent = () => setBomComponents([...bomComponents, { ingredient_id: '', name: '', amount: 0, unit: 'g' }]);
  const updateBomComponent = (idx: number, field: string, value: any) => {
    const newItems = [...bomComponents];
    if (field === 'ingredient_id') {
      const selected = allIngredients.find(i => i.id === value);
      newItems[idx] = { ...newItems[idx], ingredient_id: value, name: selected?.name || '', unit: selected?.unit || 'g' };
    } else {
      newItems[idx] = { ...newItems[idx], [field]: value } as any;
    }
    setBomComponents(newItems);
  };

  const handleAddIngredientToInventory = async () => {
    if (!newIngredientName.trim()) return;
    const cost = parseFloat(newIngredientCost || '0');
    if (Number.isNaN(cost) || cost < 0) return;
    setIsAddingIngredient(true);
    try {
      const payload: any = {
        name: newIngredientName.trim(),
        category: 'Ingredient',
        type: 'INGREDIENT',
        unit: newIngredientUnit,
        cost_per_unit: cost,
        stock: 0,
        price: 0
      };
      const { data, error } = await supabase.from('inventory_items').insert(payload).select().single();
      if (error) throw error;
      if (data) {
        setAllIngredients(prev => [data as InventoryItem, ...prev]);
        setNewIngredientName('');
        setNewIngredientCost('');
      }
    } catch (err) {
      console.error(err);
      alert(t.failedToAddIngredient);
    } finally {
      setIsAddingIngredient(false);
    }
  };

  const addAddOn = () => setProductAddOns([...productAddOns, { id: crypto.randomUUID(), name: '', price: 0 }]);
  const updateAddOn = (idx: number, field: string, value: any) => {
    const newAddOns = [...productAddOns];
    newAddOns[idx] = { ...newAddOns[idx], [field]: value } as any;
    setProductAddOns(newAddOns);
  };

  const calculatedBeverageCost = useMemo(() => {
    if (productForm.type !== 'BEVERAGE') return 0;
    // REQ-002: Calculate beverage cost based on recipe ingredients
    return recipeIngredients.reduce((sum, ing) => {
      const dbIng = allIngredients.find(i => i.id === ing.ingredient_id);
      return sum + (ing.amount * (dbIng?.cost_per_unit || 0));
    }, 0);
  }, [productForm.type, recipeIngredients, allIngredients]);

  const calculatedAddOnsPrice = useMemo(() => {
    // REQ-001: Support beverage add-ons with additional pricing
    return productAddOns.reduce((sum, ao) => sum + ao.price, 0);
  }, [productAddOns]);
  const getProductTypeLabel = (type: ProductDefinition['type']) => {
    if (type === 'BEVERAGE') return t.beverage;
    if (type === 'ACCESSORY') return t.accessories;
    if (type === 'RAW_MATERIAL') return t.rawMaterials;
    return t.packaged;
  };
  const getProductCategoryLabel = (product: ProductDefinition) => {
    if (product.mainCategory && product.subCategory) return `${product.mainCategory} / ${product.subCategory}`;
    return product.mainCategory || product.subCategory || product.category;
  };
  const getProductStatusLabel = (status: ProductDefinition['productStatus']) => {
    if (status === 'DISABLED') return t.statusDisabled;
    if (status === 'DISCONTINUED') return t.statusDiscontinued;
    return t.statusActive;
  };
  const categoryOptions = useMemo(() => {
    const unique = new Set<string>();
    products.forEach(product => {
      const label = getProductCategoryLabel(product);
      if (label) unique.add(label);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [products]);
  const filteredProducts = useMemo(() => {
    const nameTerm = searchTerm.toLowerCase().trim();
    const skuTerm = skuFilter.toLowerCase().trim();
    const supplierTerm = supplierFilter.toLowerCase().trim();
    return products.filter(product => {
      const categoryLabel = getProductCategoryLabel(product);
      const matchesName = !nameTerm || product.name.toLowerCase().includes(nameTerm);
      const matchesSku = !skuTerm || (product.sku || '').toLowerCase().includes(skuTerm);
      const matchesCategory = !categoryFilter || categoryLabel === categoryFilter;
      const matchesSupplier = !supplierTerm || (product.supplier || '').toLowerCase().includes(supplierTerm);
      const matchesStatus = statusFilter === 'ALL' || product.productStatus === statusFilter;
      return matchesName && matchesSku && matchesCategory && matchesSupplier && matchesStatus;
    });
  }, [products, searchTerm, skuFilter, categoryFilter, supplierFilter, statusFilter]);

  const resetGreenBeanForm = () => {
    setEditingGreenBeanId(null);
    setGreenBeanForm({
      bean_name: '',
      origin: '',
      variety: '',
      quantity: '',
      unit: 'kg',
      cost_per_kg: '',
      supplier: '',
      processing_method: '',
      elevation: '',
      notes: ''
    });
  };

  const openCreateGreenBean = () => {
    resetGreenBeanForm();
    setShowGreenBeanModal(true);
  };

  const openEditGreenBean = (bean: GreenBeanRecord) => {
    setEditingGreenBeanId(bean.id);
    setGreenBeanForm({
      bean_name: bean.bean_name || '',
      origin: bean.origin || '',
      variety: bean.variety || '',
      quantity: String(toNumber(bean.quantity)),
      unit: bean.unit || 'kg',
      cost_per_kg: String(toNumber(bean.cost_per_kg)),
      supplier: bean.supplier || '',
      processing_method: bean.processing_method || '',
      elevation: bean.elevation || '',
      notes: bean.notes || ''
    });
    setShowGreenBeanModal(true);
  };

  const handleSaveGreenBean = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    const quantity = toNumber(greenBeanForm.quantity);
    const costPerKg = toNumber(greenBeanForm.cost_per_kg);

    if (!greenBeanForm.origin.trim() || !greenBeanForm.variety.trim()) {
      alert(t.fieldRequired);
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        bean_name: greenBeanForm.bean_name.trim() || `${greenBeanForm.origin.trim()} ${greenBeanForm.variety.trim()}`,
        origin: greenBeanForm.origin.trim(),
        variety: greenBeanForm.variety.trim(),
        quantity,
        unit: greenBeanForm.unit || 'kg',
        cost_per_kg: costPerKg,
        supplier: greenBeanForm.supplier.trim() || null,
        processing_method: greenBeanForm.processing_method.trim() || null,
        elevation: greenBeanForm.elevation.trim() || null,
        notes: greenBeanForm.notes.trim() || null
      };

      if (editingGreenBeanId) {
        const prevBean = greenBeanRecords.find(b => b.id === editingGreenBeanId);
        const prevQty = toNumber(prevBean?.quantity);
        const { data: updated, error } = await supabase
          .from('green_beans')
          .update(payload)
          .eq('id', editingGreenBeanId)
          .select('*')
          .single();
        if (error) throw error;

        if (quantity !== prevQty) {
          await logGreenBeanMovement({
            beanId: editingGreenBeanId,
            movementType: 'ADJUSTMENT',
            quantityIn: quantity > prevQty ? quantity - prevQty : 0,
            quantityOut: quantity < prevQty ? prevQty - quantity : 0,
            balanceAfter: toNumber(updated?.quantity, quantity),
            reason: 'COUNT_CORRECTION',
            note: 'Adjusted from edit form'
          });
        }
      } else {
        const { data: inserted, error } = await supabase
          .from('green_beans')
          .insert([payload])
          .select('*')
          .single();
        if (error) throw error;

        if (quantity > 0 && inserted?.id) {
          await logGreenBeanMovement({
            beanId: inserted.id,
            movementType: 'OPENING_BALANCE',
            quantityIn: quantity,
            quantityOut: 0,
            balanceAfter: toNumber(inserted.quantity, quantity),
            reason: 'OPENING_STOCK',
            note: 'Initial opening stock'
          });
        }
      }

      await fetchGreenBeansData();
      setShowGreenBeanModal(false);
      resetGreenBeanForm();
      setShowSuccess(true);
      setSuccessMsg(t.saveSuccess);
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (error: any) {
      console.error('Error saving green bean:', error);
      alert(error?.message || t.actionFailed);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteGreenBean = async (bean: GreenBeanRecord) => {
    if (!confirm(t.confirmDelete || 'Are you sure?')) return;
    try {
      const { error } = await supabase.from('green_beans').delete().eq('id', bean.id);
      if (error) throw error;
      await fetchGreenBeansData();
    } catch (error: any) {
      console.error('Error deleting green bean:', error);
      alert(error?.message || t.actionFailed);
    }
  };

  const openQuickAdjustment = (bean: GreenBeanRecord) => {
    setSelectedBeanForAdjustment(bean);
    setAdjustmentForm({
      mode: 'OUT',
      quantity: '',
      reason: 'COUNT_CORRECTION',
      note: ''
    });
    setShowAdjustmentModal(true);
  };

  const handleQuickAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBeanForAdjustment) return;
    const qty = toNumber(adjustmentForm.quantity);
    if (qty <= 0) {
      alert(t.invalidNumber);
      return;
    }

    const currentQty = toNumber(selectedBeanForAdjustment.quantity);
    const nextQty = adjustmentForm.mode === 'IN' ? currentQty + qty : currentQty - qty;
    if (nextQty < 0) {
      alert(t.insufficientStock || 'Insufficient stock');
      return;
    }

    setIsSaving(true);
    try {
      const { data: updated, error } = await supabase
        .from('green_beans')
        .update({ quantity: nextQty })
        .eq('id', selectedBeanForAdjustment.id)
        .select('*')
        .single();
      if (error) throw error;

      await logGreenBeanMovement({
        beanId: selectedBeanForAdjustment.id,
        movementType: 'ADJUSTMENT',
        quantityIn: adjustmentForm.mode === 'IN' ? qty : 0,
        quantityOut: adjustmentForm.mode === 'OUT' ? qty : 0,
        balanceAfter: toNumber(updated?.quantity, nextQty),
        reason: adjustmentForm.reason,
        note: adjustmentForm.note
      });

      await fetchGreenBeansData();
      setShowAdjustmentModal(false);
      setSelectedBeanForAdjustment(null);
      setShowSuccess(true);
      setSuccessMsg(t.saveSuccess);
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (error: any) {
      console.error('Error updating green bean stock:', error);
      alert(error?.message || t.actionFailed);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredGreenBeans = useMemo(() => {
    const q = greenBeanSearch.trim().toLowerCase();
    if (!q) return greenBeanRecords;
    return greenBeanRecords.filter(bean => {
      const origin = (bean.origin || '').toLowerCase();
      const variety = (bean.variety || '').toLowerCase();
      const supplier = (bean.supplier || '').toLowerCase();
      return origin.includes(q) || variety.includes(q) || supplier.includes(q);
    });
  }, [greenBeanRecords, greenBeanSearch]);

  const totalGreenBeanStock = useMemo(
    () => greenBeanRecords.reduce((sum, bean) => sum + toNumber(bean.quantity), 0),
    [greenBeanRecords]
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {showSuccess && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-orange-600 text-white px-8 py-3 rounded-full font-bold flex items-center gap-3 shadow-xl z-[150] border border-orange-100 ">
          <CheckCircle2 size={24} /> {successMsg}
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-orange-600 text-white rounded-[20px] shadow-lg"><Settings size={28} /></div>
          <div>
            <h2 className="text-2xl font-bold text-black ">{t.systemSetup}</h2>
            <p className="text-xs text-black font-bold uppercase">{t.ingredientAddonPriceManagement}</p>
          </div>
        </div>
        {activeSubTab === 'catalog' && (
          <button onClick={() => { resetProductForm(); setShowProductModal(true); }} className="w-full md:w-auto bg-orange-600 text-white px-8 py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all hover">
            <Plus size={18} /> {t.addProduct}
          </button>
        )}
        {activeSubTab === 'roastProfiles' && (
          <button onClick={resetRoastProfileForm} className="w-full md:w-auto bg-orange-600 text-white px-8 py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all hover">
            <Plus size={18} /> {t.addRoastProfile}
          </button>
        )}
        {activeSubTab === 'greenBeans' && (
          <button onClick={openCreateGreenBean} className="w-full md:w-auto bg-orange-600 text-white px-8 py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all hover">
            <Plus size={18} /> {t.addGreenBean || 'Add Green Bean'}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-4 bg-white/50 p-2 rounded-2xl w-full md:w-fit mb-10 overflow-x-auto no-scrollbar">
        {['catalog', 'templates', 'roastProfiles', 'greenBeans', 'settings', 'database', 'profile'].map(tab => (
          <button
            key={tab} onClick={() => setActiveSubTab(tab as any)}
            className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${activeSubTab === tab ? 'bg-white  text-black  shadow-sm border border-orange-100 ' : 'text-black hover'}`}
          >
            {tab === 'catalog'
              ? t.productCatalog
              : tab === 'templates'
                ? t.packageTemplates
                : tab === 'roastProfiles'
                  ? t.roastProfiles
                  : tab === 'greenBeans'
                    ? (t.greenBeansTab || 'Green Beans')
                    : tab === 'database'
                      ? 'SQL'
                      : tab === 'settings'
                        ? t.printerSettings
                        : t.profile}
          </button>
        ))}
      </div>

      {activeSubTab === 'catalog' && (
        <div className="space-y-6">
          <div className="bg-white/70 border border-orange-100 rounded-2xl p-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.productName}</label>
                <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-white  border-none rounded-2xl px-4 py-3 text-xs font-bold" placeholder={t.searchProduct} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.sku}</label>
                <input value={skuFilter} onChange={e => setSkuFilter(e.target.value)} className="w-full bg-white  border-none rounded-2xl px-4 py-3 text-xs font-bold" placeholder={t.sku} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.category}</label>
                <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="w-full bg-white  border-none rounded-2xl px-4 py-3 text-xs font-bold">
                  <option value="">{t.all}</option>
                  {categoryOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.supplier}</label>
                <input value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)} className="w-full bg-white  border-none rounded-2xl px-4 py-3 text-xs font-bold" placeholder={t.supplier} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.status}</label>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="w-full bg-white  border-none rounded-2xl px-4 py-3 text-xs font-bold">
                  <option value="ALL">{t.all}</option>
                  <option value="ACTIVE">{t.statusActive}</option>
                  <option value="DISABLED">{t.statusDisabled}</option>
                  <option value="DISCONTINUED">{t.statusDiscontinued}</option>
                </select>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={catalogImportRef}
              type="file"
              accept=".csv,.tsv,.txt,.xls,.xlsx"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleImportCatalog(file);
              }}
            />
            <button onClick={() => handleExportCatalogCsv(filteredProducts)} className="px-4 py-3 rounded-xl font-bold text-xs bg-white  text-black  border border-orange-100 flex items-center gap-2">
              <DatabaseZap size={16} /> {t.exportCsv}
            </button>
            <button onClick={() => handleExportCatalogExcel(filteredProducts)} className="px-4 py-3 rounded-xl font-bold text-xs bg-white  text-black  border border-orange-100 flex items-center gap-2">
              <FileText size={16} /> {t.exportExcel}
            </button>
            <button onClick={handleDownloadCatalogTemplate} className="px-4 py-3 rounded-xl font-bold text-xs bg-white  text-black  border border-orange-100 flex items-center gap-2">
              <FileText size={16} /> {t.downloadTemplate}
            </button>
            <button
              onClick={() => catalogImportRef.current?.click()}
              disabled={isImportingCatalog}
              className="px-4 py-3 rounded-xl font-bold text-xs bg-orange-600 text-white flex items-center gap-2 disabled:opacity-60"
            >
              {isImportingCatalog ? <Loader2 size={16} className="animate-spin" /> : <ClipboardCheck size={16} />}
              {t.bulkImport}
            </button>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 animate-in slide-in-from-bottom-4">
            {filteredProducts.map(product => {
              const variantDetails = [product.variantLabel, product.variantSize, product.variantFlavor].filter(Boolean).join(' • ');
              const parentName = product.variantOf ? products.find(p => p.id === product.variantOf)?.name : '';
              return (
                <div key={product.id} className="bg-white  rounded-[32px] overflow-hidden border border-orange-100  shadow-sm group flex flex-col sm:flex-row h-full">
                  <div className="w-full sm:w-48 h-48 sm:h-auto bg-white  relative shrink-0">
                    <img src={product.image || 'https://picsum.photos/seed/coffee/200/200'} className="w-full h-full object-cover" />
                    <div className="absolute top-4 left-4"><span className="bg-orange-600 text-white text-[8px] font-black uppercase px-2 py-1 rounded-lg shadow-md">{getProductTypeLabel(product.type)}</span></div>
                  </div>
                  <div className="flex-1 p-4 sm:p-6 flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="text-lg font-bold">{product.name}</h4>
                        {variantDetails && <div className="text-[10px] text-black font-bold">{variantDetails}</div>}
                        {parentName && <div className="text-[10px] text-black font-bold">{t.baseProduct}: {parentName}</div>}
                        <span className="text-[10px] text-black font-black uppercase">{getProductCategoryLabel(product)}</span>
                        <span className="inline-flex mt-1 text-[9px] font-black uppercase rounded-full px-2 py-1 bg-orange-50 text-black border border-orange-100">{getProductStatusLabel(product.productStatus)}</span>
                      </div>
                      <span className="text-xl font-black">{product.basePrice}<span className="text-[10px] ml-1 opacity-50">{t.currency}</span></span>
                    </div>
                    {product.type === 'BEVERAGE' && product.add_ons && product.add_ons.length > 0 && (
                      <div className="mb-4">
                        <span className="text-[8px] font-black text-black uppercase block mb-1">{t.availableAddOns}</span>
                        <div className="flex flex-wrap gap-1">
                          {product.add_ons.map(ao => <span key={ao.id} className="text-[9px] bg-white  px-2 py-0.5 rounded-md border border-orange-50 ">{ao.name} (+{ao.price})</span>)}
                        </div>
                      </div>
                    )}
                    <div className="mb-4">
                      <span className="text-[8px] font-black text-black uppercase block mb-2">{t.stockByLocation}</span>
                      <div className="space-y-1">
                        {Object.entries(productLocationStock[product.id] || {}).map(([locationId, qty]) => (
                          <div key={locationId} className="text-[10px] font-bold text-black flex justify-between">
                            <span>{locations.find(l => l.id === locationId)?.name || '-'}</span>
                            <span>{qty}</span>
                          </div>
                        ))}
                        {Object.keys(productLocationStock[product.id] || {}).length === 0 && (
                          <div className="text-[10px] text-black">{t.noLocationStock}</div>
                        )}
                      </div>
                    </div>
                    <div className="mt-auto flex justify-end">
                      <button onClick={() => {
                        setEditingId(product.id);
                        setProductForm({
                          name: product.name, description: product.description || '', category: product.category, mainCategory: product.mainCategory || '', subCategory: product.subCategory || '', variantOf: product.variantOf || '', variantLabel: product.variantLabel || '', variantSize: product.variantSize || '', variantFlavor: product.variantFlavor || '', unit: product.unit || 'piece', roastLevel: product.roastLevel || RoastingLevel.MEDIUM,
                          templateId: product.templateId || '', basePrice: product.basePrice.toString(), image: product.image || '', sku: product.sku || '', supplier: product.supplier || '', isActive: product.productStatus === 'ACTIVE', productStatus: product.productStatus || (product.isActive ? 'ACTIVE' : 'DISABLED'), isPerishable: product.isPerishable || false, expiryDate: product.expiryDate || '', type: product.type || 'PACKAGED_COFFEE',
                          beanId: product.beanId || '',
                          laborCost: (product.laborCost || 0).toString(), roastingOverhead: (product.roastingOverhead || 0).toString(), estimatedGreenBeanCost: (product.estimatedGreenBeanCost || 0).toString()
                        });
                        setRecipeIngredients(product.recipe?.ingredients || []);
                        setBomComponents(product.bom || []);
                        setProductAddOns(product.add_ons || []);
                        setShowProductModal(true);
                      }} className="p-2.5 text-black  rounded-xl transition-all"><Edit3 size={18} /></button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {activeSubTab === 'roastProfiles' && (
        <div className="space-y-6">
          <form onSubmit={handleSaveRoastProfile} className="bg-white  rounded-[32px] p-6 border border-orange-100  shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-50 text-black rounded-2xl"><FlaskConical size={22} /></div>
              <div>
                <h3 className="text-lg font-bold">{t.roastProfiles}</h3>
                <p className="text-xs text-black">{t.manageRoastProfiles}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.roastProfileName}</label>
                <input value={roastProfileForm.name} onChange={e => setRoastProfileForm({ ...roastProfileForm, name: e.target.value })} className="w-full bg-white  border-none rounded-2xl px-6 py-4 font-bold outline-none focus:ring-2 focus:ring-orange-600" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.roastProfileDescription}</label>
                <input value={roastProfileForm.description} onChange={e => setRoastProfileForm({ ...roastProfileForm, description: e.target.value })} className="w-full bg-white  border-none rounded-2xl px-6 py-4 font-bold outline-none focus:ring-2 focus:ring-orange-600" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.linkedBeans}</label>
              <div className="text-[10px] text-black">{t.selectLinkedBeans}</div>
              {greenBeans.length === 0 ? (
                <div className="text-xs text-black">{t.noLinkedBeans}</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {greenBeans.map(bean => {
                    const isSelected = roastProfileForm.beanIds.includes(bean.id);
                    return (
                      <button
                        type="button"
                        key={bean.id}
                        onClick={() => toggleRoastProfileBean(bean.id)}
                        className={`px-3 py-2 rounded-xl text-[10px] font-bold border ${isSelected ? 'bg-orange-600 text-white border-orange-600' : 'bg-white  text-black  border-orange-100'}`}
                      >
                        {bean.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.chargeTemperature}</label>
                <input type="number" step="0.1" value={roastProfileForm.chargeTemperature} onChange={e => setRoastProfileForm({ ...roastProfileForm, chargeTemperature: e.target.value })} className="w-full bg-white  border-none rounded-2xl px-6 py-4 font-mono font-bold outline-none focus:ring-2 focus:ring-orange-600" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.targetRoastCurve}</label>
                <input value={roastProfileForm.targetCurve} onChange={e => setRoastProfileForm({ ...roastProfileForm, targetCurve: e.target.value })} className="w-full bg-white  border-none rounded-2xl px-6 py-4 font-bold outline-none focus:ring-2 focus:ring-orange-600" />
              </div>
            </div>
            <div className="space-y-3">
              <div className="text-[10px] font-black text-black uppercase tracking-widest">{t.stageDurations}</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.preparationDuration}</label>
                  <input type="number" step="0.1" value={roastProfileForm.preparationDuration} onChange={e => setRoastProfileForm({ ...roastProfileForm, preparationDuration: e.target.value })} className="w-full bg-white  border-none rounded-2xl px-6 py-4 font-mono font-bold outline-none focus:ring-2 focus:ring-orange-600" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.roastingDuration}</label>
                  <input type="number" step="0.1" value={roastProfileForm.roastingDuration} onChange={e => setRoastProfileForm({ ...roastProfileForm, roastingDuration: e.target.value })} className="w-full bg-white  border-none rounded-2xl px-6 py-4 font-mono font-bold outline-none focus:ring-2 focus:ring-orange-600" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.coolingDuration}</label>
                  <input type="number" step="0.1" value={roastProfileForm.coolingDuration} onChange={e => setRoastProfileForm({ ...roastProfileForm, coolingDuration: e.target.value })} className="w-full bg-white  border-none rounded-2xl px-6 py-4 font-mono font-bold outline-none focus:ring-2 focus:ring-orange-600" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.inspectionDuration}</label>
                  <input type="number" step="0.1" value={roastProfileForm.inspectionDuration} onChange={e => setRoastProfileForm({ ...roastProfileForm, inspectionDuration: e.target.value })} className="w-full bg-white  border-none rounded-2xl px-6 py-4 font-mono font-bold outline-none focus:ring-2 focus:ring-orange-600" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.packagingDuration}</label>
                  <input type="number" step="0.1" value={roastProfileForm.packagingDuration} onChange={e => setRoastProfileForm({ ...roastProfileForm, packagingDuration: e.target.value })} className="w-full bg-white  border-none rounded-2xl px-6 py-4 font-mono font-bold outline-none focus:ring-2 focus:ring-orange-600" />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.roastProfileDetails}</label>
              <textarea value={roastProfileForm.profileJson} onChange={e => setRoastProfileForm({ ...roastProfileForm, profileJson: e.target.value })} className="w-full bg-white  border-none rounded-2xl px-6 py-4 font-mono text-xs font-bold outline-none focus:ring-2 focus:ring-orange-600 h-32" placeholder={t.roastProfileJsonHint} />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => setRoastProfileForm({ ...roastProfileForm, isActive: !roastProfileForm.isActive })} className="px-4 py-3 rounded-xl font-bold text-xs bg-orange-50 text-black border border-orange-100 flex items-center gap-2">
                {roastProfileForm.isActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />} {roastProfileForm.isActive ? t.statusActive : t.statusDisabled}
              </button>
              <button type="submit" disabled={isSaving} className="px-5 py-3 rounded-xl font-bold text-xs bg-orange-600 text-white flex items-center gap-2 disabled:opacity-60">
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {editingRoastProfileId ? t.saveChanges : t.addRoastProfile}
              </button>
              {editingRoastProfileId && (
                <button type="button" onClick={resetRoastProfileForm} className="px-4 py-3 rounded-xl font-bold text-xs bg-white  text-black  border border-orange-100 flex items-center gap-2">
                  <X size={16} /> {t.cancel}
                </button>
              )}
            </div>
          </form>

          {roastProfiles.length === 0 ? (
            <div className="bg-white  rounded-[32px] p-6 border border-orange-100  text-black text-sm">{t.noRoastProfiles}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {roastProfiles.map(profile => {
                const profileData = (profile.profile || {}) as any;
                const stageDurations = profileData.stageDurations || {};
                const linkedBeans = (profile.bean_ids || []).map(id => greenBeans.find(bean => bean.id === id)?.label || id);
                return (
                  <div key={profile.id} className="bg-white  rounded-[32px] p-6 border border-orange-100  shadow-sm space-y-3">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <h4 className="text-lg font-bold">{profile.name}</h4>
                        {profile.description && <div className="text-xs text-black">{profile.description}</div>}
                        <div className="text-[9px] font-black uppercase mt-2">{(profile.is_active ?? true) ? t.statusActive : t.statusDisabled}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleToggleRoastProfile(profile)} className="p-2 rounded-xl bg-orange-50 text-black border border-orange-100">
                          {(profile.is_active ?? true) ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                        </button>
                        <button onClick={() => handleForkRoastProfile(profile)} title={t.forkProfile} className="p-2 rounded-xl bg-white  text-black  border border-orange-100">
                          <Copy size={16} />
                        </button>
                        <button onClick={() => handleEditRoastProfile(profile)} className="p-2 rounded-xl bg-white  text-black  border border-orange-100">
                          <Edit3 size={16} />
                        </button>
                      </div>
                    </div>
                    {(profileData.chargeTemperature !== undefined || profileData.targetCurve || Object.keys(stageDurations).length > 0) && (
                      <div className="text-[10px] font-bold text-black space-y-1">
                        {linkedBeans.length > 0 && (
                          <div>{t.linkedBeans}: {linkedBeans.join(' • ')}</div>
                        )}
                        {profileData.chargeTemperature !== undefined && (
                          <div>{t.chargeTemperature}: {profileData.chargeTemperature}</div>
                        )}
                        {profileData.targetCurve && (
                          <div>{t.targetRoastCurve}: {profileData.targetCurve}</div>
                        )}
                        {Object.keys(stageDurations).length > 0 && (
                          <div>
                            {t.stageDurations}: {[
                              stageDurations.preparation ? `${t.preparationDuration} ${stageDurations.preparation}` : '',
                              stageDurations.roasting ? `${t.roastingDuration} ${stageDurations.roasting}` : '',
                              stageDurations.cooling ? `${t.coolingDuration} ${stageDurations.cooling}` : '',
                              stageDurations.inspection ? `${t.inspectionDuration} ${stageDurations.inspection}` : '',
                              stageDurations.packaging ? `${t.packagingDuration} ${stageDurations.packaging}` : ''
                            ].filter(Boolean).join(' • ')}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'greenBeans' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-orange-100 p-5">
              <div className="text-[10px] font-black uppercase text-black">{t.greenBeanInventory || 'Green Bean Inventory'}</div>
              <div className="mt-2 text-3xl font-black text-black font-mono">{totalGreenBeanStock.toFixed(2)} kg</div>
            </div>
            <div className="bg-white rounded-2xl border border-orange-100 p-5">
              <div className="text-[10px] font-black uppercase text-black">{t.totalItems || 'Beans'}</div>
              <div className="mt-2 text-3xl font-black text-black font-mono">{greenBeanRecords.length}</div>
            </div>
            <div className="bg-white rounded-2xl border border-orange-100 p-5">
              <div className="text-[10px] font-black uppercase text-black">{t.lowStockWarning || 'Low Stock'}</div>
              <div className="mt-2 text-3xl font-black text-red-600 font-mono">
                {greenBeanRecords.filter(bean => toNumber(bean.quantity) < 100).length}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-orange-100 p-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-black/50" size={18} />
              <input
                value={greenBeanSearch}
                onChange={e => setGreenBeanSearch(e.target.value)}
                placeholder={t.searchGreenBeans || 'Search green beans...'}
                className="w-full bg-white border border-orange-100 rounded-2xl pl-11 pr-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-orange-600"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-orange-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-orange-50">
                    <th className="text-left p-4 text-[10px] font-black uppercase">{t.origin}</th>
                    <th className="text-left p-4 text-[10px] font-black uppercase">{t.variety}</th>
                    <th className="text-left p-4 text-[10px] font-black uppercase">{t.supplier}</th>
                    <th className="text-left p-4 text-[10px] font-black uppercase">{t.quantity}</th>
                    <th className="text-left p-4 text-[10px] font-black uppercase">{t.status}</th>
                    <th className="text-left p-4 text-[10px] font-black uppercase">{t.action}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGreenBeans.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-sm text-black">{t.noItemsFound}</td>
                    </tr>
                  ) : (
                    filteredGreenBeans.map(bean => {
                      const qty = toNumber(bean.quantity);
                      const isLow = qty < 100;
                      return (
                        <tr key={bean.id} className="border-t border-orange-50">
                          <td className="p-4 text-sm font-bold">{bean.origin || '-'}</td>
                          <td className="p-4 text-sm font-bold">{bean.variety || '-'}</td>
                          <td className="p-4 text-sm font-bold">{bean.supplier || '-'}</td>
                          <td className="p-4 text-sm font-mono font-black">{qty.toFixed(2)} {bean.unit || 'kg'}</td>
                          <td className="p-4">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${isLow ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                              {isLow ? (t.low || 'Low') : (t.good || 'Good')}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <button onClick={() => openQuickAdjustment(bean)} className="px-3 py-2 rounded-xl text-[10px] font-black bg-orange-600 text-white">
                                {t.quickStockUpdate || 'Quick Stock Update'}
                              </button>
                              <button onClick={() => openEditGreenBean(bean)} className="p-2 rounded-xl bg-orange-50 text-black border border-orange-100">
                                <Edit3 size={14} />
                              </button>
                              <button onClick={() => handleDeleteGreenBean(bean)} className="p-2 rounded-xl bg-red-50 text-red-700 border border-red-100">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-orange-100 p-5">
            <h4 className="text-sm font-black uppercase mb-4">{t.stockMovements || 'Stock Movements'}</h4>
            <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
              {greenBeanMovements.length === 0 ? (
                <div className="text-sm text-black">{t.noCountEntries || 'No movement records'}</div>
              ) : (
                greenBeanMovements.map(mv => {
                  const qtyIn = toNumber(mv.quantity_in);
                  const qtyOut = toNumber(mv.quantity_out);
                  const legacyQty = toNumber(mv.quantity);
                  const direction = qtyIn > 0 ? `+${qtyIn.toFixed(2)}` : qtyOut > 0 ? `-${qtyOut.toFixed(2)}` : legacyQty.toFixed(2);
                  const beanLabel = mv.green_beans ? `${mv.green_beans.origin || '-'} - ${mv.green_beans.variety || '-'}` : '-';
                  return (
                    <div key={mv.id} className="border border-orange-100 rounded-xl p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                      <div>
                        <div className="text-xs font-black">{beanLabel}</div>
                        <div className="text-[10px] text-black">{mv.movement_type} {mv.reason ? `• ${mv.reason}` : ''}</div>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-black font-mono ${direction.startsWith('-') ? 'text-red-600' : 'text-green-700'}`}>{direction} kg</div>
                        <div className="text-[10px] text-black">
                          {(mv.movement_at || mv.created_at) ? new Date(mv.movement_at || mv.created_at || '').toLocaleString() : '-'}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'database' && (
        <div className="bg-orange-600 rounded-[40px] p-10 text-white shadow-xl">
          <h3 className="text-2xl font-black mb-4 flex items-center gap-3 text-white"><Terminal size={24} /> {t.sqlSchemaUpgrade}</h3>
          <pre className="bg-white p-6 rounded-2xl font-mono text-xs text-black whitespace-pre-wrap mb-6 border border-white/20">{sqlFixScript}</pre>
          <button onClick={() => { navigator.clipboard.writeText(sqlFixScript); setCopyingSql(true); setTimeout(() => setCopyingSql(false), 2000); }} className="bg-white hover:bg-orange-50 px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors text-black">{copyingSql ? <CheckCircle size={18} className="text-orange-600" /> : <Copy size={18} />} {t.copySqlScript}</button>
        </div>
      )}

      {activeSubTab === 'settings' && (
        <div className="max-w-4xl animate-in slide-in-from-bottom-4">
          <form onSubmit={handleSaveSettings} className="bg-white  rounded-[40px] p-10 border border-orange-100  shadow-sm space-y-10">
            <div className="flex items-center gap-4 border-b border-orange-50  pb-8">
              <div className="p-4 bg-white  text-black  rounded-2xl"><Settings size={32} /></div>
              <div>
                <h3 className="text-2xl font-bold">{t.printerSettings}</h3>
                <p className="text-black text-sm">{t.printerSettingsDesc}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.printerWidth}</label>
                  <div className="flex bg-orange-50 p-1 rounded-2xl w-fit">
                    <button type="button" onClick={() => setSettings({ ...settings, printer_width: '58mm' })} className={`px-8 py-3 rounded-xl font-bold text-sm transition-all ${settings.printer_width === '58mm' ? 'bg-white  text-black  shadow-sm' : 'text-black'}`}>{t.width58mm}</button>
                    <button type="button" onClick={() => setSettings({ ...settings, printer_width: '80mm' })} className={`px-8 py-3 rounded-xl font-bold text-sm transition-all ${settings.printer_width === '80mm' ? 'bg-white  text-black  shadow-sm' : 'text-black'}`}>{t.width80mm}</button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.tax} (%)</label>
                  <input type="number" step="0.01" value={settings.vat_rate * 100} onChange={e => setSettings({ ...settings, vat_rate: parseFloat(e.target.value) / 100 })} className="w-full bg-white  border-none rounded-2xl px-6 py-4 font-bold outline-none focus:ring-2 focus:ring-orange-600" />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.vatNumber}</label>
                  <input
                    type="text"
                    value={settings.vat_number || ''}
                    onChange={e => setSettings({ ...settings, vat_number: e.target.value })}
                    className="w-full bg-white  border-none rounded-2xl px-6 py-4 font-bold outline-none focus:ring-2 focus:ring-orange-600"
                    placeholder="e.g. 123456789"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.latePenaltyType}</label>
                  <select
                    value={settings.late_penalty_type || 'per_minute'}
                    onChange={(e) => setSettings({ ...settings, late_penalty_type: e.target.value as 'per_minute' | 'per_occurrence' })}
                    className="w-full bg-white  border-none rounded-2xl px-6 py-4 font-bold outline-none focus:ring-2 focus:ring-orange-600"
                  >
                    <option value="per_minute">{t.latePenaltyPerMinute}</option>
                    <option value="per_occurrence">{t.latePenaltyPerOccurrence}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.latePenaltyAmount.replace('{currency}', t.currency)}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={settings.late_penalty_amount || 0}
                    onChange={(e) => setSettings({ ...settings, late_penalty_amount: parseFloat(e.target.value || '0') })}
                    className="w-full bg-white  border-none rounded-2xl px-6 py-4 font-bold outline-none focus:ring-2 focus:ring-orange-600"
                  />
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.storeNameLabel}</label>
                  <input type="text" value={settings.store_name} onChange={e => setSettings({ ...settings, store_name: e.target.value })} className="w-full bg-white  border-none rounded-2xl px-6 py-4 font-bold outline-none focus:ring-2 focus:ring-orange-600" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.storeAddressLabel}</label>
                  <input type="text" value={settings.store_address} onChange={e => setSettings({ ...settings, store_address: e.target.value })} className="w-full bg-white  border-none rounded-2xl px-6 py-4 font-bold outline-none focus:ring-2 focus:ring-orange-600" />
                </div>
              </div>
            </div>

            <div className="pt-6 flex justify-end">
              <button type="submit" disabled={isSaving} className="bg-orange-600 text-white px-10 py-4 rounded-2xl font-black shadow-xl active:scale-95 transition-all flex items-center gap-3">
                {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />} {t.saveChanges}
              </button>
            </div>
          </form>
        </div>
      )}

      {showGreenBeanModal && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-white/60 backdrop-blur-md">
          <div className="bg-white rounded-[32px] max-w-3xl w-full p-8 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black">{editingGreenBeanId ? (t.edit || 'Edit') : (t.addStock || 'Add')} {t.greenBeanType || 'Green Bean'}</h3>
              <button onClick={() => setShowGreenBeanModal(false)} className="p-2 rounded-full text-black"><X size={22} /></button>
            </div>
            <form onSubmit={handleSaveGreenBean} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase">{t.origin}</label>
                  <input value={greenBeanForm.origin} onChange={e => setGreenBeanForm({ ...greenBeanForm, origin: e.target.value })} className="mt-1 w-full bg-white border border-orange-100 rounded-xl px-4 py-3 font-bold" required />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase">{t.variety}</label>
                  <input value={greenBeanForm.variety} onChange={e => setGreenBeanForm({ ...greenBeanForm, variety: e.target.value })} className="mt-1 w-full bg-white border border-orange-100 rounded-xl px-4 py-3 font-bold" required />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase">{t.processingMethod || 'Processing Method'}</label>
                  <input value={greenBeanForm.processing_method} onChange={e => setGreenBeanForm({ ...greenBeanForm, processing_method: e.target.value })} className="mt-1 w-full bg-white border border-orange-100 rounded-xl px-4 py-3 font-bold" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase">{t.elevation || 'Elevation'}</label>
                  <input value={greenBeanForm.elevation} onChange={e => setGreenBeanForm({ ...greenBeanForm, elevation: e.target.value })} className="mt-1 w-full bg-white border border-orange-100 rounded-xl px-4 py-3 font-bold" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase">{t.quantity} ({t.openingStock || 'Opening Stock'})</label>
                  <input type="number" step="0.01" min="0" value={greenBeanForm.quantity} onChange={e => setGreenBeanForm({ ...greenBeanForm, quantity: e.target.value })} className="mt-1 w-full bg-white border border-orange-100 rounded-xl px-4 py-3 font-mono font-bold" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase">{t.unitOfMeasure || 'Unit'}</label>
                  <select value={greenBeanForm.unit} onChange={e => setGreenBeanForm({ ...greenBeanForm, unit: e.target.value })} className="mt-1 w-full bg-white border border-orange-100 rounded-xl px-4 py-3 font-bold">
                    <option value="kg">kg</option>
                    <option value="lb">lb</option>
                    <option value="g">g</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase">{t.costPerKg || 'Cost per kg'}</label>
                  <input type="number" step="0.01" min="0" value={greenBeanForm.cost_per_kg} onChange={e => setGreenBeanForm({ ...greenBeanForm, cost_per_kg: e.target.value })} className="mt-1 w-full bg-white border border-orange-100 rounded-xl px-4 py-3 font-mono font-bold" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase">{t.supplier}</label>
                  <input value={greenBeanForm.supplier} onChange={e => setGreenBeanForm({ ...greenBeanForm, supplier: e.target.value })} className="mt-1 w-full bg-white border border-orange-100 rounded-xl px-4 py-3 font-bold" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase">{t.notes || 'Notes'}</label>
                <textarea value={greenBeanForm.notes} onChange={e => setGreenBeanForm({ ...greenBeanForm, notes: e.target.value })} className="mt-1 w-full bg-white border border-orange-100 rounded-xl px-4 py-3 font-bold h-20" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowGreenBeanModal(false)} className="px-4 py-2 rounded-xl font-bold border border-orange-100">{t.cancel}</button>
                <button type="submit" disabled={isSaving} className="px-5 py-2 rounded-xl font-bold bg-orange-600 text-white">
                  {isSaving ? <Loader2 size={16} className="inline animate-spin" /> : null} {editingGreenBeanId ? t.saveChanges : (t.addStock || 'Add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAdjustmentModal && selectedBeanForAdjustment && (
        <div className="fixed inset-0 z-[170] flex items-center justify-center p-4 bg-white/60 backdrop-blur-md">
          <div className="bg-white rounded-[28px] max-w-lg w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-black">{t.quickStockUpdate || 'Quick Stock Update'}</h3>
              <button onClick={() => setShowAdjustmentModal(false)} className="p-2 rounded-full text-black"><X size={20} /></button>
            </div>
            <div className="text-xs font-bold text-black mb-4">
              {(selectedBeanForAdjustment.origin || '-')} - {(selectedBeanForAdjustment.variety || '-')} • {toNumber(selectedBeanForAdjustment.quantity).toFixed(2)} kg
            </div>
            <form onSubmit={handleQuickAdjustment} className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase">{t.operationType || 'Operation'}</label>
                <div className="mt-1 flex gap-2">
                  <button type="button" onClick={() => setAdjustmentForm({ ...adjustmentForm, mode: 'IN' })} className={`flex-1 py-2 rounded-xl font-black text-xs ${adjustmentForm.mode === 'IN' ? 'bg-green-600 text-white' : 'bg-white border border-orange-100'}`}>{t.increaseStock || 'Increase'}</button>
                  <button type="button" onClick={() => setAdjustmentForm({ ...adjustmentForm, mode: 'OUT' })} className={`flex-1 py-2 rounded-xl font-black text-xs ${adjustmentForm.mode === 'OUT' ? 'bg-red-600 text-white' : 'bg-white border border-orange-100'}`}>{t.decreaseStock || 'Decrease'}</button>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase">{t.quantity}</label>
                <input type="number" step="0.01" min="0" value={adjustmentForm.quantity} onChange={e => setAdjustmentForm({ ...adjustmentForm, quantity: e.target.value })} className="mt-1 w-full bg-white border border-orange-100 rounded-xl px-4 py-3 font-mono font-bold" required />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase">{t.reason || 'Reason'}</label>
                <select value={adjustmentForm.reason} onChange={e => setAdjustmentForm({ ...adjustmentForm, reason: e.target.value })} className="mt-1 w-full bg-white border border-orange-100 rounded-xl px-4 py-3 font-bold">
                  <option value="DAMAGE">{t.damage || 'Damage'}</option>
                  <option value="LOSS">{t.loss || 'Loss'}</option>
                  <option value="COUNT_CORRECTION">{t.countCorrection || 'Count Correction'}</option>
                  <option value="TRANSFER">{t.transferOrder || 'Transfer'}</option>
                  <option value="OTHER">{t.other}</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase">{t.notes || 'Notes'}</label>
                <input value={adjustmentForm.note} onChange={e => setAdjustmentForm({ ...adjustmentForm, note: e.target.value })} className="mt-1 w-full bg-white border border-orange-100 rounded-xl px-4 py-3 font-bold" />
              </div>
              <button type="submit" disabled={isSaving} className="w-full py-3 rounded-xl font-black bg-orange-600 text-white">
                {isSaving ? <Loader2 size={16} className="inline animate-spin" /> : null} {t.saveChanges}
              </button>
            </form>
          </div>
        </div>
      )}

      {showProductModal && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-white/60 backdrop-blur-md">
          <div className="bg-white  rounded-[40px] max-w-5xl w-full p-6 sm:p-8 md:p-12 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto custom-scrollbar" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8 sm:mb-10 border-b border-orange-50 pb-6 sm:pb-8">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-white  text-black  rounded-2xl"><Tag size={32} /></div>
                <h3 className="text-xl sm:text-2xl font-bold">{editingId ? t.editProduct : t.newProduct}</h3>
              </div>
              <button onClick={() => setShowProductModal(false)} className="p-2  rounded-full transition-colors text-black"><X size={36} /></button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-10">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12">
                <div className="space-y-8">
                  <div className="flex flex-wrap bg-orange-50 p-1 rounded-2xl w-full sm:w-fit gap-2 overflow-x-auto no-scrollbar">
                    <button type="button" onClick={() => setProductForm({ ...productForm, type: 'PACKAGED_COFFEE' })} className={`px-6 py-3 rounded-xl font-bold text-xs transition-all ${productForm.type === 'PACKAGED_COFFEE' ? 'bg-white  text-black  shadow-sm' : 'text-black'}`}>{t.packaged}</button>
                    <button type="button" onClick={() => setProductForm({ ...productForm, type: 'BEVERAGE' })} className={`px-6 py-3 rounded-xl font-bold text-xs transition-all ${productForm.type === 'BEVERAGE' ? 'bg-white  text-black  shadow-sm' : 'text-black'}`}>{t.beverage}</button>
                    <button type="button" onClick={() => setProductForm({ ...productForm, type: 'ACCESSORY' })} className={`px-6 py-3 rounded-xl font-bold text-xs transition-all ${productForm.type === 'ACCESSORY' ? 'bg-white  text-black  shadow-sm' : 'text-black'}`}>{t.accessories}</button>
                    <button type="button" onClick={() => setProductForm({ ...productForm, type: 'RAW_MATERIAL' })} className={`px-6 py-3 rounded-xl font-bold text-xs transition-all ${productForm.type === 'RAW_MATERIAL' ? 'bg-white  text-black  shadow-sm' : 'text-black'}`}>{t.rawMaterials}</button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.productName}</label>
                    <input type="text" required value={productForm.name} onChange={e => setProductForm({ ...productForm, name: e.target.value })} className="w-full bg-white  border-none rounded-2xl px-6 py-4 font-bold outline-none focus:ring-2 focus:ring-orange-600" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.mainCategory}</label>
                      <input type="text" value={productForm.mainCategory} onChange={e => setProductForm({ ...productForm, mainCategory: e.target.value })} className="w-full bg-white  border-none rounded-2xl px-6 py-4 font-bold" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.subCategory}</label>
                      <input type="text" value={productForm.subCategory} onChange={e => setProductForm({ ...productForm, subCategory: e.target.value })} className="w-full bg-white  border-none rounded-2xl px-6 py-4 font-bold" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.baseProduct}</label>
                      <select value={productForm.variantOf} onChange={e => setProductForm({ ...productForm, variantOf: e.target.value })} className="w-full bg-white  border-none rounded-2xl px-6 py-4 font-bold">
                        <option value="">{t.baseProduct}</option>
                        {products.filter(p => p.id !== editingId).map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.variantLabel}</label>
                      <input type="text" value={productForm.variantLabel} onChange={e => setProductForm({ ...productForm, variantLabel: e.target.value })} className="w-full bg-white  border-none rounded-2xl px-6 py-4 font-bold" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.variantSize}</label>
                      <input type="text" value={productForm.variantSize} onChange={e => setProductForm({ ...productForm, variantSize: e.target.value })} className="w-full bg-white  border-none rounded-2xl px-6 py-4 font-bold" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.variantFlavor}</label>
                      <input type="text" value={productForm.variantFlavor} onChange={e => setProductForm({ ...productForm, variantFlavor: e.target.value })} className="w-full bg-white  border-none rounded-2xl px-6 py-4 font-bold" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.sellingPrice}</label>
                      <input type="number" step="0.01" required value={productForm.basePrice} onChange={e => setProductForm({ ...productForm, basePrice: e.target.value })} className="w-full bg-white  border-none rounded-2xl px-6 py-4 font-mono font-bold text-black " />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.imageUrl}</label>
                      <input type="text" value={productForm.image} onChange={e => setProductForm({ ...productForm, image: e.target.value })} className="w-full bg-white  border-none rounded-2xl px-6 py-4 text-xs font-mono" placeholder="https://..." />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.unitOfMeasure}</label>
                      <select value={productForm.unit} onChange={e => setProductForm({ ...productForm, unit: e.target.value as any })} className="w-full bg-white  border-none rounded-2xl px-6 py-4 font-bold">
                        <option value="piece">{t.unitPiece}</option>
                        <option value="kg">{t.unitKg}</option>
                        <option value="g">{t.unitG}</option>
                        <option value="liter">{t.unitLiter}</option>
                        <option value="box">{t.unitBox}</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.productStatus}</label>
                      <select value={productForm.productStatus} onChange={e => setProductForm({ ...productForm, productStatus: e.target.value as any, isActive: e.target.value === 'ACTIVE' })} className="w-full bg-white  border-none rounded-2xl px-6 py-4 font-bold">
                        <option value="ACTIVE">{t.statusActive}</option>
                        <option value="DISABLED">{t.statusDisabled}</option>
                        <option value="DISCONTINUED">{t.statusDiscontinued}</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.perishableProduct}</label>
                      <div className="w-full bg-white  border-none rounded-2xl px-6 py-4 font-bold flex items-center gap-3">
                        <input type="checkbox" checked={productForm.isPerishable} onChange={e => setProductForm({ ...productForm, isPerishable: e.target.checked })} className="h-5 w-5 accent-orange-600" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.expiryDate}</label>
                      <input type="date" value={productForm.expiryDate} onChange={e => setProductForm({ ...productForm, expiryDate: e.target.value })} disabled={!productForm.isPerishable} className={`w-full bg-white  border-none rounded-2xl px-6 py-4 font-bold ${productForm.isPerishable ? '' : 'opacity-60'}`} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 sm:gap-6">
                    <div className="space-y-2 sm:col-span-2">
                      <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.sku}</label>
                      <input type="text" value={productForm.sku} onChange={e => setProductForm({ ...productForm, sku: e.target.value })} className="w-full bg-white  border-none rounded-2xl px-6 py-4 font-mono text-xs" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.supplier}</label>
                      <input type="text" value={productForm.supplier} onChange={e => setProductForm({ ...productForm, supplier: e.target.value })} className="w-full bg-white  border-none rounded-2xl px-6 py-4 text-xs font-bold" />
                    </div>
                    <div className="space-y-2 flex items-end">
                      <button
                        type="button"
                        onClick={() => setProductForm({ ...productForm, sku: `${productForm.name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'SKU'}-${Date.now().toString().slice(-6)}` })}
                        className="w-full bg-orange-100 text-black  font-bold text-[10px] px-4 py-3 rounded-xl"
                      >
                        {t.generateSku}
                      </button>
                    </div>
                  </div>

                  {productForm.type === 'BEVERAGE' ? (
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center border-b border-orange-50 pb-2">
                          <label className="text-[10px] font-black text-black uppercase tracking-widest flex items-center gap-2"><FlaskConical size={12} /> {t.beverageRecipe}</label>
                          <button type="button" onClick={addIngredient} className="text-black  font-bold text-xs flex items-center gap-1"><PlusCircle size={14} /> {t.addIngredient}</button>
                        </div>
                        {allIngredients.length === 0 && (
                          <div className="bg-orange-50  rounded-2xl p-4 space-y-3">
                            <div className="text-xs font-bold text-black">{t.noIngredientsAvailable}</div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <input type="text" value={newIngredientName} onChange={e => setNewIngredientName(e.target.value)} className="bg-white  border-none rounded-xl px-3 py-2 text-xs font-bold" placeholder={t.ingredientName} />
                              <select value={newIngredientUnit} onChange={e => setNewIngredientUnit(e.target.value)} className="bg-white  border-none rounded-xl px-3 py-2 text-xs font-bold">
                                <option value="g">g</option>
                                <option value="ml">ml</option>
                                <option value="unit">unit</option>
                                <option value="tsp">tsp</option>
                              </select>
                              <input type="number" value={newIngredientCost} onChange={e => setNewIngredientCost(e.target.value)} className="bg-white  border-none rounded-xl px-3 py-2 text-xs font-mono font-bold" placeholder={t.unitCost} />
                            </div>
                            <button type="button" disabled={isAddingIngredient} onClick={handleAddIngredientToInventory} className="bg-orange-600 text-white px-4 py-2 rounded-xl text-xs font-bold">
                              {isAddingIngredient ? t.saving : t.addIngredientToInventory}
                            </button>
                          </div>
                        )}
                        <div className="space-y-3 max-h-48 overflow-y-auto custom-scrollbar">
                          {recipeIngredients.map((ing, idx) => (
                            <div key={idx} className="flex flex-col sm:flex-row gap-2 sm:items-center">
                              <select required value={ing.ingredient_id} onChange={e => updateIngredient(idx, 'ingredient_id', e.target.value)} className="flex-1 bg-white  border-none rounded-xl px-3 py-2 text-xs font-bold">
                                <option value="">{t.selectIngredient}</option>
                                {allIngredients.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                              </select>
                              <div className="flex items-center gap-2">
                                <input type="number" required value={ing.amount} onChange={e => updateIngredient(idx, 'amount', parseFloat(e.target.value))} className="w-full sm:w-20 bg-white  border-none rounded-xl px-3 py-2 text-xs font-mono font-bold" placeholder={t.quantityShort} />
                                <button type="button" onClick={() => setRecipeIngredients(recipeIngredients.filter((_, i) => i !== idx))} className="text-black hover"><MinusCircle size={18} /></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex justify-between items-center border-b border-orange-50 pb-2">
                          <label className="text-[10px] font-black text-black uppercase tracking-widest flex items-center gap-2"><PlusCircle size={12} /> {t.paidAddOns}</label>
                          <button type="button" onClick={addAddOn} className="text-black  font-bold text-xs flex items-center gap-1"><Plus size={14} /> {t.addOption}</button>
                        </div>
                        <div className="space-y-3">
                          {productAddOns.map((ao, idx) => (
                            <div key={ao.id} className="flex gap-2 items-center animate-in slide-in-from-top-1">
                              <input type="text" placeholder={t.addOnName} value={ao.name} onChange={e => updateAddOn(idx, 'name', e.target.value)} className="flex-1 bg-white  border-none rounded-xl px-3 py-2 text-xs font-bold" />
                              <input type="number" placeholder={t.price} value={ao.price} onChange={e => updateAddOn(idx, 'price', parseFloat(e.target.value))} className="w-24 bg-white  border-none rounded-xl px-3 py-2 text-xs font-mono font-bold text-black " />
                              <button type="button" onClick={() => setProductAddOns(productAddOns.filter((_, i) => i !== idx))} className="text-black hover"><Trash2 size={16} /></button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : productForm.type === 'PACKAGED_COFFEE' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.chooseTemplate}</label>
                        <select required value={productForm.templateId} onChange={e => setProductForm({ ...productForm, templateId: e.target.value })} className="w-full bg-white  border-none rounded-2xl px-6 py-4 font-bold">
                          <option value="">-- {t.chooseTemplate} --</option>
                          {templates.map(tpl => <option key={tpl.id} value={tpl.id}>{tpl.sizeLabel}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.roastLevel}</label>
                        <select value={productForm.roastLevel} onChange={e => setProductForm({ ...productForm, roastLevel: e.target.value as RoastingLevel })} className="w-full bg-white  border-none rounded-2xl px-6 py-4 font-bold">
                          <option value={RoastingLevel.LIGHT}>{t.light}</option>
                          <option value={RoastingLevel.MEDIUM}>{t.medium}</option>
                          <option value={RoastingLevel.DARK}>{t.dark}</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.selectBean || 'Bean Type'}</label>
                        <select value={productForm.beanId} onChange={e => setProductForm({ ...productForm, beanId: e.target.value })} className="w-full bg-white  border-none rounded-2xl px-6 py-4 font-bold">
                          <option value="">-- {t.selectBean || 'Select Bean'} --</option>
                          {greenBeans.map(bean => <option key={bean.id} value={bean.id}>{bean.label}</option>)}
                        </select>
                      </div>
                    </div>
                  ) : null}
                  {productForm.type !== 'BEVERAGE' && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center border-b border-orange-50 pb-2">
                        <label className="text-[10px] font-black text-black uppercase tracking-widest flex items-center gap-2"><Layers size={12} /> {t.bomComponents}</label>
                        <button type="button" onClick={addBomComponent} className="text-black  font-bold text-xs flex items-center gap-1"><PlusCircle size={14} /> {t.addComponent}</button>
                      </div>
                      {allIngredients.length === 0 && (
                        <div className="bg-orange-50  rounded-2xl p-4 space-y-3">
                          <div className="text-xs font-bold text-black">{t.noIngredientsAvailable}</div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <input type="text" value={newIngredientName} onChange={e => setNewIngredientName(e.target.value)} className="bg-white  border-none rounded-xl px-3 py-2 text-xs font-bold" placeholder={t.ingredientName} />
                            <select value={newIngredientUnit} onChange={e => setNewIngredientUnit(e.target.value)} className="bg-white  border-none rounded-xl px-3 py-2 text-xs font-bold">
                              <option value="g">g</option>
                              <option value="ml">ml</option>
                              <option value="unit">unit</option>
                              <option value="tsp">tsp</option>
                            </select>
                            <input type="number" value={newIngredientCost} onChange={e => setNewIngredientCost(e.target.value)} className="bg-white  border-none rounded-xl px-3 py-2 text-xs font-mono font-bold" placeholder={t.unitCost} />
                          </div>
                          <button type="button" disabled={isAddingIngredient} onClick={handleAddIngredientToInventory} className="bg-orange-600 text-white px-4 py-2 rounded-xl text-xs font-bold">
                            {isAddingIngredient ? t.saving : t.addIngredientToInventory}
                          </button>
                        </div>
                      )}
                      <div className="space-y-3 max-h-48 overflow-y-auto custom-scrollbar">
                        {bomComponents.map((component, idx) => (
                          <div key={`${component.ingredient_id}-${idx}`} className="flex flex-col sm:flex-row gap-2 sm:items-center">
                            <select value={component.ingredient_id} onChange={e => updateBomComponent(idx, 'ingredient_id', e.target.value)} className="flex-1 bg-white  border-none rounded-xl px-3 py-2 text-xs font-bold">
                              <option value="">{t.selectIngredient}</option>
                              {allIngredients.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                            </select>
                            <div className="flex items-center gap-2">
                              <input type="number" value={component.amount} onChange={e => updateBomComponent(idx, 'amount', parseFloat(e.target.value))} className="w-full sm:w-20 bg-white  border-none rounded-xl px-3 py-2 text-xs font-mono font-bold" placeholder={t.quantityShort} />
                              <button type="button" onClick={() => setBomComponents(bomComponents.filter((_, i) => i !== idx))} className="text-black hover"><MinusCircle size={18} /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-orange-600 rounded-[32px] sm:rounded-[40px] p-6 sm:p-10 text-white space-y-6 sm:space-y-8 shadow-xl border border-white/20 relative overflow-hidden">
                  <h4 className="text-lg sm:text-xl font-black flex items-center gap-3 border-b border-white/20 pb-4 sm:pb-6"><Calculator size={24} className="text-white" /> {t.smartCostAnalysis}</h4>

                  {productForm.type === 'BEVERAGE' ? (
                    <div className="space-y-6">
                      <div className="bg-white p-6 rounded-3xl border border-white/10">
                        <span className="text-[10px] font-black text-black uppercase block mb-3">{t.ingredientCostCalculated}</span>
                        <div className="flex justify-between items-end">
                          <span className="text-4xl font-black font-mono text-black">{calculatedBeverageCost.toFixed(2)}</span>
                          <span className="text-xs font-bold text-black/80 mb-1">{t.currency} / {t.cup}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 bg-white rounded-2xl border border-white/10">
                          <span className="text-[8px] font-black text-black uppercase block mb-1">{t.opsCost}</span>
                          <input type="number" step="0.01" value={productForm.roastingOverhead} onChange={e => setProductForm({ ...productForm, roastingOverhead: e.target.value })} className="w-full bg-transparent border-none p-0 font-bold text-black outline-none" />
                        </div>
                        <div className="p-4 bg-white rounded-2xl border border-white/10">
                          <span className="text-[8px] font-black text-black uppercase block mb-1">{t.laborCost}</span>
                          <input type="number" step="0.01" value={productForm.laborCost} onChange={e => setProductForm({ ...productForm, laborCost: e.target.value })} className="w-full bg-transparent border-none p-0 font-bold text-black outline-none" />
                        </div>
                      </div>
                      <div className="pt-6 border-t border-white/20">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-bold text-white/70 uppercase tracking-widest">{t.expectedMargin}</span>
                          <span className="text-4xl font-black text-white">
                            {parseFloat(productForm.basePrice) > 0
                              ? (((parseFloat(productForm.basePrice) - (calculatedBeverageCost + parseFloat(productForm.laborCost) + parseFloat(productForm.roastingOverhead))) / parseFloat(productForm.basePrice)) * 100).toFixed(0)
                              : '0'}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-white/70 uppercase tracking-widest">{t.greenBeanCost}</label>
                        <input type="number" step="0.01" value={productForm.estimatedGreenBeanCost} onChange={e => setProductForm({ ...productForm, estimatedGreenBeanCost: e.target.value })} className="w-full bg-white border-none rounded-2xl px-6 py-4 font-mono font-bold text-black outline-none focus:ring-2 focus:ring-white/50" />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-white/70 uppercase tracking-widest">{t.laborCost}</label>
                          <input type="number" step="0.01" value={productForm.laborCost} onChange={e => setProductForm({ ...productForm, laborCost: e.target.value })} className="w-full bg-white border-none rounded-2xl px-6 py-4 font-mono font-bold text-black outline-none focus:ring-2 focus:ring-white/50" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-white/70 uppercase tracking-widest">{t.opsCost}</label>
                          <input type="number" step="0.01" value={productForm.roastingOverhead} onChange={e => setProductForm({ ...productForm, roastingOverhead: e.target.value })} className="w-full bg-white border-none rounded-2xl px-6 py-4 font-mono font-bold text-black outline-none focus:ring-2 focus:ring-white/50" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-10 flex flex-col sm:flex-row gap-4 sm:gap-6 border-t border-orange-50 ">
                <button type="button" onClick={() => setShowProductModal(false)} className="flex-1 py-4 sm:py-5 font-black text-black uppercase tracking-widest hover">{t.cancel}</button>
                <button type="submit" disabled={isSaving} className="flex-[3] bg-orange-600 text-white py-4 sm:py-5 rounded-[24px] font-black shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 sm:gap-4 text-lg sm:text-xl">
                  {isSaving ? <Loader2 className="animate-spin" size={24} /> : <Save size={24} />} {editingId ? t.saveChanges : t.addProduct}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfigurationView;
