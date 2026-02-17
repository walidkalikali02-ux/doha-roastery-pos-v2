
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
import { PackageTemplate, ProductDefinition, RoastingLevel, UserRole, Recipe, RecipeIngredient, AddOn, InventoryItem, SystemSettings, Location } from '../types';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';

const FULL_SCHEMA_COLUMNS = [
  'id', 'name', 'description', 'category', 'roast_level', 'template_id', 
  'base_price', 'selling_price', 'cost_price', 'profit_margin', 'is_active', 'type', 'recipe', 'image', 'sku', 'main_category', 'sub_category', 'variant_of', 'variant_label', 'variant_size', 'variant_flavor', 'unit',
  'labor_cost', 'roasting_overhead', 'estimated_green_bean_cost', 'add_ons', 'is_perishable', 'expiry_date', 'bom', 'product_status', 'supplier'
];

const ConfigurationView: React.FC = () => {
  const { lang, t } = useLanguage();
  const { user } = useAuth();
  const { theme } = useTheme();
  
  const [activeSubTab, setActiveSubTab] = useState<'catalog' | 'templates' | 'database' | 'profile' | 'settings'>('catalog');
  const [searchTerm, setSearchTerm] = useState('');
  const [skuFilter, setSkuFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ProductDefinition['productStatus']>('ALL');
  
  const [templates, setTemplates] = useState<PackageTemplate[]>([]);
  const [products, setProducts] = useState<ProductDefinition[]>([]);
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
  const [editingId, setEditingId] = useState<string | null>(null);

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

  const fetchInitialData = useCallback(async () => {
    setIsLoadingData(true);
    const missing = await checkSchemaIntegrity();
    
    try {
      const [tplRes, prodRes, ingRes, settingsRes, locRes, stockRes] = await Promise.all([
        supabase.from('package_templates').select('*').order('created_at', { ascending: false }),
        supabase.from('product_definitions').select(FULL_SCHEMA_COLUMNS.filter(c => !missing.has(c)).join(',')).order('created_at', { ascending: false }),
        supabase.from('inventory_items').select('*').eq('type', 'INGREDIENT'),
        supabase.from('system_settings').select('*').single(),
        supabase.from('locations').select('*').order('name', { ascending: true }),
        supabase.from('inventory_items').select('product_id, location_id, stock').not('product_id', 'is', null)
      ]);

      if (tplRes.data) setTemplates(tplRes.data.map(mapTemplateFromDB));
      if (prodRes.data) setProducts(prodRes.data.map(mapProductFromDB));
      if (ingRes.data) setAllIngredients(ingRes.data);
      if (settingsRes.data) setSettings(settingsRes.data);
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
      
    } catch (err) {
      console.error("Data Load Error:", err);
    } finally {
      setIsLoadingData(false);
    }
  }, [checkSchemaIntegrity]);

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
    type: item.type || 'PACKAGED_COFFEE',
    recipe: item.recipe, 
    bom: item.bom || [],
    laborCost: item.labor_cost, 
    roastingOverhead: item.roasting_overhead,
    estimatedGreenBeanCost: item.estimated_green_bean_cost,
    add_ons: item.add_ons || []
  });

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
        <button onClick={() => { resetProductForm(); setShowProductModal(true); }} className="w-full md:w-auto bg-orange-600 text-white px-8 py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all hover">
          <Plus size={18} /> {t.addProduct}
        </button>
      </div>

      <div className="flex flex-wrap gap-4 bg-white/50 p-2 rounded-2xl w-full md:w-fit mb-10 overflow-x-auto no-scrollbar">
        {['catalog', 'templates', 'settings', 'database', 'profile'].map(tab => (
          <button 
            key={tab} onClick={() => setActiveSubTab(tab as any)}
            className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${activeSubTab === tab ? 'bg-white  text-black  shadow-sm border border-orange-100 ' : 'text-black hover'}`}
          >
            {tab === 'catalog' ? t.productCatalog : tab === 'templates' ? t.packageTemplates : tab === 'database' ? 'SQL' : tab === 'settings' ? t.printerSettings : t.profile}
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
            )})}
          </div>
        </div>
      )}

      {activeSubTab === 'database' && (
        <div className="bg-orange-600 rounded-[40px] p-10 text-white shadow-xl">
          <h3 className="text-2xl font-black mb-4 flex items-center gap-3 text-white"><Terminal size={24}/> {t.sqlSchemaUpgrade}</h3>
          <pre className="bg-white p-6 rounded-2xl font-mono text-xs text-black whitespace-pre-wrap mb-6 border border-white/20">{sqlFixScript}</pre>
          <button onClick={() => { navigator.clipboard.writeText(sqlFixScript); setCopyingSql(true); setTimeout(()=>setCopyingSql(false), 2000); }} className="bg-white hover:bg-orange-50 px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors text-black">{copyingSql ? <CheckCircle size={18} className="text-orange-600"/> : <Copy size={18}/>} {t.copySqlScript}</button>
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
                    <button type="button" onClick={() => setSettings({...settings, printer_width: '58mm'})} className={`px-8 py-3 rounded-xl font-bold text-sm transition-all ${settings.printer_width === '58mm' ? 'bg-white  text-black  shadow-sm' : 'text-black'}`}>{t.width58mm}</button>
                    <button type="button" onClick={() => setSettings({...settings, printer_width: '80mm'})} className={`px-8 py-3 rounded-xl font-bold text-sm transition-all ${settings.printer_width === '80mm' ? 'bg-white  text-black  shadow-sm' : 'text-black'}`}>{t.width80mm}</button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.tax} (%)</label>
                  <input type="number" step="0.01" value={settings.vat_rate * 100} onChange={e => setSettings({...settings, vat_rate: parseFloat(e.target.value) / 100})} className="w-full bg-white  border-none rounded-2xl px-6 py-4 font-bold outline-none focus:ring-2 focus:ring-orange-600" />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.vatNumber}</label>
                  <input 
                    type="text" 
                    value={settings.vat_number || ''} 
                    onChange={e => setSettings({...settings, vat_number: e.target.value})} 
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
                  <input type="text" value={settings.store_name} onChange={e => setSettings({...settings, store_name: e.target.value})} className="w-full bg-white  border-none rounded-2xl px-6 py-4 font-bold outline-none focus:ring-2 focus:ring-orange-600" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.storeAddressLabel}</label>
                  <input type="text" value={settings.store_address} onChange={e => setSettings({...settings, store_address: e.target.value})} className="w-full bg-white  border-none rounded-2xl px-6 py-4 font-bold outline-none focus:ring-2 focus:ring-orange-600" />
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
                    <button type="button" onClick={() => setProductForm({...productForm, type: 'PACKAGED_COFFEE'})} className={`px-6 py-3 rounded-xl font-bold text-xs transition-all ${productForm.type === 'PACKAGED_COFFEE' ? 'bg-white  text-black  shadow-sm' : 'text-black'}`}>{t.packaged}</button>
                    <button type="button" onClick={() => setProductForm({...productForm, type: 'BEVERAGE'})} className={`px-6 py-3 rounded-xl font-bold text-xs transition-all ${productForm.type === 'BEVERAGE' ? 'bg-white  text-black  shadow-sm' : 'text-black'}`}>{t.beverage}</button>
                    <button type="button" onClick={() => setProductForm({...productForm, type: 'ACCESSORY'})} className={`px-6 py-3 rounded-xl font-bold text-xs transition-all ${productForm.type === 'ACCESSORY' ? 'bg-white  text-black  shadow-sm' : 'text-black'}`}>{t.accessories}</button>
                    <button type="button" onClick={() => setProductForm({...productForm, type: 'RAW_MATERIAL'})} className={`px-6 py-3 rounded-xl font-bold text-xs transition-all ${productForm.type === 'RAW_MATERIAL' ? 'bg-white  text-black  shadow-sm' : 'text-black'}`}>{t.rawMaterials}</button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.productName}</label>
                    <input type="text" required value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} className="w-full bg-white  border-none rounded-2xl px-6 py-4 font-bold outline-none focus:ring-2 focus:ring-orange-600" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.mainCategory}</label>
                      <input type="text" value={productForm.mainCategory} onChange={e => setProductForm({...productForm, mainCategory: e.target.value})} className="w-full bg-white  border-none rounded-2xl px-6 py-4 font-bold" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.subCategory}</label>
                      <input type="text" value={productForm.subCategory} onChange={e => setProductForm({...productForm, subCategory: e.target.value})} className="w-full bg-white  border-none rounded-2xl px-6 py-4 font-bold" />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.baseProduct}</label>
                      <select value={productForm.variantOf} onChange={e => setProductForm({...productForm, variantOf: e.target.value})} className="w-full bg-white  border-none rounded-2xl px-6 py-4 font-bold">
                        <option value="">{t.baseProduct}</option>
                        {products.filter(p => p.id !== editingId).map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.variantLabel}</label>
                      <input type="text" value={productForm.variantLabel} onChange={e => setProductForm({...productForm, variantLabel: e.target.value})} className="w-full bg-white  border-none rounded-2xl px-6 py-4 font-bold" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.variantSize}</label>
                      <input type="text" value={productForm.variantSize} onChange={e => setProductForm({...productForm, variantSize: e.target.value})} className="w-full bg-white  border-none rounded-2xl px-6 py-4 font-bold" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.variantFlavor}</label>
                      <input type="text" value={productForm.variantFlavor} onChange={e => setProductForm({...productForm, variantFlavor: e.target.value})} className="w-full bg-white  border-none rounded-2xl px-6 py-4 font-bold" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.sellingPrice}</label>
                      <input type="number" step="0.01" required value={productForm.basePrice} onChange={e => setProductForm({...productForm, basePrice: e.target.value})} className="w-full bg-white  border-none rounded-2xl px-6 py-4 font-mono font-bold text-black " />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.imageUrl}</label>
                      <input type="text" value={productForm.image} onChange={e => setProductForm({...productForm, image: e.target.value})} className="w-full bg-white  border-none rounded-2xl px-6 py-4 text-xs font-mono" placeholder="https://..." />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.unitOfMeasure}</label>
                      <select value={productForm.unit} onChange={e => setProductForm({...productForm, unit: e.target.value as any})} className="w-full bg-white  border-none rounded-2xl px-6 py-4 font-bold">
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
                      <input type="text" value={productForm.sku} onChange={e => setProductForm({...productForm, sku: e.target.value})} className="w-full bg-white  border-none rounded-2xl px-6 py-4 font-mono text-xs" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.supplier}</label>
                      <input type="text" value={productForm.supplier} onChange={e => setProductForm({...productForm, supplier: e.target.value})} className="w-full bg-white  border-none rounded-2xl px-6 py-4 text-xs font-bold" />
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
                          <label className="text-[10px] font-black text-black uppercase tracking-widest flex items-center gap-2"><FlaskConical size={12}/> {t.beverageRecipe}</label>
                          <button type="button" onClick={addIngredient} className="text-black  font-bold text-xs flex items-center gap-1"><PlusCircle size={14}/> {t.addIngredient}</button>
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
                                <button type="button" onClick={() => setRecipeIngredients(recipeIngredients.filter((_, i) => i !== idx))} className="text-black hover"><MinusCircle size={18}/></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex justify-between items-center border-b border-orange-50 pb-2">
                          <label className="text-[10px] font-black text-black uppercase tracking-widest flex items-center gap-2"><PlusCircle size={12}/> {t.paidAddOns}</label>
                          <button type="button" onClick={addAddOn} className="text-black  font-bold text-xs flex items-center gap-1"><Plus size={14}/> {t.addOption}</button>
                        </div>
                        <div className="space-y-3">
                          {productAddOns.map((ao, idx) => (
                            <div key={ao.id} className="flex gap-2 items-center animate-in slide-in-from-top-1">
                              <input type="text" placeholder={t.addOnName} value={ao.name} onChange={e => updateAddOn(idx, 'name', e.target.value)} className="flex-1 bg-white  border-none rounded-xl px-3 py-2 text-xs font-bold" />
                              <input type="number" placeholder={t.price} value={ao.price} onChange={e => updateAddOn(idx, 'price', parseFloat(e.target.value))} className="w-24 bg-white  border-none rounded-xl px-3 py-2 text-xs font-mono font-bold text-black " />
                              <button type="button" onClick={() => setProductAddOns(productAddOns.filter((_, i) => i !== idx))} className="text-black hover"><Trash2 size={16}/></button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : productForm.type === 'PACKAGED_COFFEE' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.chooseTemplate}</label>
                        <select required value={productForm.templateId} onChange={e => setProductForm({...productForm, templateId: e.target.value})} className="w-full bg-white  border-none rounded-2xl px-6 py-4 font-bold">
                          <option value="">-- {t.chooseTemplate} --</option>
                          {templates.map(tpl => <option key={tpl.id} value={tpl.id}>{tpl.sizeLabel}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.roastLevel}</label>
                        <select value={productForm.roastLevel} onChange={e => setProductForm({...productForm, roastLevel: e.target.value as RoastingLevel})} className="w-full bg-white  border-none rounded-2xl px-6 py-4 font-bold">
                          <option value={RoastingLevel.LIGHT}>{t.light}</option>
                          <option value={RoastingLevel.MEDIUM}>{t.medium}</option>
                          <option value={RoastingLevel.DARK}>{t.dark}</option>
                        </select>
                      </div>
                    </div>
                  ) : null}
                  {productForm.type !== 'BEVERAGE' && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center border-b border-orange-50 pb-2">
                        <label className="text-[10px] font-black text-black uppercase tracking-widest flex items-center gap-2"><Layers size={12}/> {t.bomComponents}</label>
                        <button type="button" onClick={addBomComponent} className="text-black  font-bold text-xs flex items-center gap-1"><PlusCircle size={14}/> {t.addComponent}</button>
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
                              <button type="button" onClick={() => setBomComponents(bomComponents.filter((_, i) => i !== idx))} className="text-black hover"><MinusCircle size={18}/></button>
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
                              <input type="number" step="0.01" value={productForm.roastingOverhead} onChange={e => setProductForm({...productForm, roastingOverhead: e.target.value})} className="w-full bg-transparent border-none p-0 font-bold text-black outline-none" />
                           </div>
                           <div className="p-4 bg-white rounded-2xl border border-white/10">
                              <span className="text-[8px] font-black text-black uppercase block mb-1">{t.laborCost}</span>
                              <input type="number" step="0.01" value={productForm.laborCost} onChange={e => setProductForm({...productForm, laborCost: e.target.value})} className="w-full bg-transparent border-none p-0 font-bold text-black outline-none" />
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
                           <input type="number" step="0.01" value={productForm.estimatedGreenBeanCost} onChange={e => setProductForm({...productForm, estimatedGreenBeanCost: e.target.value})} className="w-full bg-white border-none rounded-2xl px-6 py-4 font-mono font-bold text-black outline-none focus:ring-2 focus:ring-white/50" />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                           <div className="space-y-2">
                              <label className="text-[10px] font-black text-white/70 uppercase tracking-widest">{t.laborCost}</label>
                              <input type="number" step="0.01" value={productForm.laborCost} onChange={e => setProductForm({...productForm, laborCost: e.target.value})} className="w-full bg-white border-none rounded-2xl px-6 py-4 font-mono font-bold text-black outline-none focus:ring-2 focus:ring-white/50" />
                           </div>
                           <div className="space-y-2">
                              <label className="text-[10px] font-black text-white/70 uppercase tracking-widest">{t.opsCost}</label>
                              <input type="number" step="0.01" value={productForm.roastingOverhead} onChange={e => setProductForm({...productForm, roastingOverhead: e.target.value})} className="w-full bg-white border-none rounded-2xl px-6 py-4 font-mono font-bold text-black outline-none focus:ring-2 focus:ring-white/50" />
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
