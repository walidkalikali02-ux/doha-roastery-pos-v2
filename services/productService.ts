import { supabase } from '../supabaseClient';

export type ProductPriority = 'P0' | 'P1' | 'P2' | 'P3';
export type ProductStatusFilter = 'all' | 'active' | 'inactive';
export type StockLevelFilter = 'all' | 'low' | 'out';

export interface CreateProductInput {
  name: string;
  sku: string;
  category: string;
  unitOfMeasure: string;
  minimumThreshold: number;
  initialQuantity: number;
  locationId: string;
  price?: number;
  barcode?: string;
  aliasBarcodes?: string[];
}

export interface EditProductInput {
  name?: string;
  category?: string;
  unitOfMeasure?: string;
  minimumThreshold?: number;
  isActive?: boolean;
  price?: number;
}

export interface ProductSearchFilters {
  query?: string;
  category?: string;
  status?: ProductStatusFilter;
  stockLevel?: StockLevelFilter;
  stockThreshold?: number;
  page?: number;
  pageSize?: number;
}

export interface ProductImportRow {
  name: string;
  sku: string;
  category: string;
  unitOfMeasure: string;
  minimumThreshold: number;
  initialQuantity: number;
  locationId: string;
  price?: number;
  barcode?: string;
}

export interface ProductImportError {
  row: number;
  field: string;
  message: string;
}

const CODE_128_SAFE = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const normalizeBarcode = (value?: string | null) => (value || '').trim().toUpperCase();
const normalizeSku = (value: string) => value.trim().toUpperCase();

const getDefaultBarcodeFormat = async (): Promise<'CODE128' | 'EAN13'> => {
  const { data, error } = await supabase
    .from('system_settings')
    .select('default_barcode_format')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const fmt = String((data as any)?.default_barcode_format || 'CODE128').toUpperCase();
  return fmt === 'EAN13' ? 'EAN13' : 'CODE128';
};

const randomCode = (length = 14) => {
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += CODE_128_SAFE[Math.floor(Math.random() * CODE_128_SAFE.length)];
  }
  return result;
};

const assertPositiveNumber = (value: number, field: string) => {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${field} must be a valid non-negative number`);
  }
};

const assertRequired = (value: string, field: string) => {
  if (!value || !value.trim()) {
    throw new Error(`${field} is required`);
  }
};

const ensureSkuIsUnique = async (sku: string, ignoreProductId?: string) => {
  let query = supabase.from('product_definitions').select('id').eq('sku', sku).limit(1);
  if (ignoreProductId) {
    query = query.neq('id', ignoreProductId);
  }
  const { data, error } = await query;
  if (error) throw error;
  if (data && data.length > 0) {
    throw new Error('SKU already exists');
  }
};

const ensureBarcodeIsUnique = async (barcode: string, ignoreProductId?: string) => {
  let query = supabase.from('product_definitions').select('id').eq('barcode', barcode).limit(1);
  if (ignoreProductId) {
    query = query.neq('id', ignoreProductId);
  }
  const { data, error } = await query;
  if (error) throw error;
  if (data && data.length > 0) {
    throw new Error('Barcode already exists');
  }
};

const generateUniqueCode128Barcode = async () => {
  for (let i = 0; i < 6; i += 1) {
    const candidate = randomCode();
    const { data, error } = await supabase
      .from('product_definitions')
      .select('id')
      .eq('barcode', candidate)
      .limit(1);
    if (error) throw error;
    if (!data || data.length === 0) {
      return candidate;
    }
  }
  throw new Error('Unable to generate unique barcode');
};

const computeEan13CheckDigit = (base12: string) => {
  let sum = 0;
  for (let i = 0; i < base12.length; i += 1) {
    const digit = Number(base12[i]) || 0;
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  return String((10 - (sum % 10)) % 10);
};

const randomNumeric = (length: number) => {
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += String(Math.floor(Math.random() * 10));
  }
  return result;
};

const generateUniqueEan13Barcode = async () => {
  for (let i = 0; i < 6; i += 1) {
    const base12 = randomNumeric(12);
    const candidate = `${base12}${computeEan13CheckDigit(base12)}`;
    const { data, error } = await supabase
      .from('product_definitions')
      .select('id')
      .eq('barcode', candidate)
      .limit(1);
    if (error) throw error;
    if (!data || data.length === 0) {
      return candidate;
    }
  }
  throw new Error('Unable to generate unique EAN-13 barcode');
};

const tryPersistAliasBarcodes = async (productId: string, aliasBarcodes: string[]) => {
  // This supports a schema where product_definitions.barcode_aliases (text[]/jsonb) exists.
  const { error } = await supabase
    .from('product_definitions')
    .update({ barcode_aliases: aliasBarcodes as unknown as never, updated_at: new Date().toISOString() })
    .eq('id', productId);

  if (error) {
    throw new Error(
      'Alias barcode storage is not available in current schema. Add product_definitions.barcode_aliases to enable PRD-003.'
    );
  }
};

export const productService = {
  // PRD-001 + PRD-002 + PRD-003
  async createProduct(input: CreateProductInput) {
    assertRequired(input.name, 'name');
    assertRequired(input.sku, 'sku');
    assertRequired(input.category, 'category');
    assertRequired(input.unitOfMeasure, 'unitOfMeasure');
    assertRequired(input.locationId, 'locationId');
    assertPositiveNumber(input.minimumThreshold, 'minimumThreshold');
    assertPositiveNumber(input.initialQuantity, 'initialQuantity');

    const sku = normalizeSku(input.sku);
    await ensureSkuIsUnique(sku);

    let barcode = normalizeBarcode(input.barcode);
    if (!barcode) {
      const format = await getDefaultBarcodeFormat();
      barcode =
        format === 'EAN13'
          ? await generateUniqueEan13Barcode()
          : await generateUniqueCode128Barcode();
    }
    await ensureBarcodeIsUnique(barcode);

    const productPayload = {
      name: input.name.trim(),
      sku,
      category: input.category.trim(),
      barcode,
      price: input.price ?? 0,
      unit: input.unitOfMeasure.trim(),
      reorder_point: input.minimumThreshold,
      is_active: true,
      product_status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: product, error: productError } = await supabase
      .from('product_definitions')
      .insert(productPayload)
      .select('id,name,sku,barcode,category,unit,reorder_point,price')
      .single();
    if (productError) throw productError;

    const { error: inventoryError } = await supabase.from('inventory_items').insert({
      product_id: product.id,
      location_id: input.locationId,
      stock: input.initialQuantity,
      minimum_stock: input.minimumThreshold,
      reserved_stock: 0,
      damaged_stock: 0,
      unit: input.unitOfMeasure.trim(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (inventoryError) throw inventoryError;

    const aliases = Array.from(
      new Set((input.aliasBarcodes || []).map((value) => normalizeBarcode(value)).filter(Boolean))
    ).filter((value) => value !== barcode);
    if (aliases.length > 0) {
      await tryPersistAliasBarcodes(product.id, aliases);
    }

    return product;
  },

  // PRD-003
  async assignBarcodeAliases(productId: string, aliases: string[]) {
    const normalized = Array.from(new Set(aliases.map((value) => normalizeBarcode(value)).filter(Boolean)));
    const { data: product, error: productError } = await supabase
      .from('product_definitions')
      .select('id,barcode')
      .eq('id', productId)
      .single();
    if (productError) throw productError;

    const filtered = normalized.filter((value) => value !== normalizeBarcode(product.barcode));
    await Promise.all(filtered.map((value) => ensureBarcodeIsUnique(value, productId)));
    await tryPersistAliasBarcodes(productId, filtered);
    return filtered;
  },

  // PRD-004
  async getBarcodeLabelData(productId: string) {
    const { data, error } = await supabase
      .from('product_definitions')
      .select('id,name,sku,barcode,unit')
      .eq('id', productId)
      .single();
    if (error) throw error;
    return data;
  },

  // PRD-005
  async editProduct(productId: string, input: EditProductInput) {
    const payload = {
      name: input.name?.trim(),
      category: input.category?.trim(),
      unit: input.unitOfMeasure?.trim(),
      reorder_point: input.minimumThreshold,
      is_active: input.isActive,
      product_status: input.isActive === false ? 'DISABLED' : undefined,
      price: input.price,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('product_definitions')
      .update(payload)
      .eq('id', productId)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  // PRD-006
  async deactivateProduct(productId: string) {
    const { data, error } = await supabase
      .from('product_definitions')
      .update({ is_active: false, product_status: 'DISABLED', updated_at: new Date().toISOString() })
      .eq('id', productId)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  // PRD-007
  async searchProducts(filters: ProductSearchFilters = {}) {
    const page = Math.max(filters.page || 1, 1);
    const pageSize = Math.max(filters.pageSize || 20, 1);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('product_definitions')
      .select('id,name,sku,barcode,category,is_active,reorder_point,product_status', { count: 'exact' })
      .order('name', { ascending: true })
      .range(from, to);

    if (filters.query) {
      const safe = filters.query.replace(/,/g, ' ');
      query = query.or(`name.ilike.%${safe}%,sku.ilike.%${safe}%,barcode.ilike.%${safe}%`);
    }
    if (filters.category) {
      query = query.eq('category', filters.category);
    }
    if (filters.status === 'active') {
      query = query.eq('is_active', true);
    } else if (filters.status === 'inactive') {
      query = query.eq('is_active', false);
    }

    const { data: products, count, error } = await query;
    if (error) throw error;
    if (!products || products.length === 0) {
      return { data: [], totalCount: count || 0 };
    }

    const productIds = products.map((item) => item.id);
    const { data: inventoryRows, error: inventoryError } = await supabase
      .from('inventory_items')
      .select('product_id,stock')
      .in('product_id', productIds);
    if (inventoryError) throw inventoryError;

    const stockByProductId = new Map<string, number>();
    for (const row of inventoryRows || []) {
      stockByProductId.set(row.product_id, (stockByProductId.get(row.product_id) || 0) + (row.stock || 0));
    }

    const thresholdFallback = filters.stockThreshold ?? 0;
    const withStock = products.map((product) => {
      const totalStock = stockByProductId.get(product.id) || 0;
      const threshold = product.reorder_point ?? thresholdFallback;
      return { ...product, total_stock: totalStock, low_stock: totalStock <= threshold };
    });

    const filtered = withStock.filter((product) => {
      if (filters.stockLevel === 'out') return product.total_stock <= 0;
      if (filters.stockLevel === 'low') return product.low_stock;
      return true;
    });

    return { data: filtered, totalCount: count || 0 };
  },

  // PRD-008
  async validateBulkImport(rows: ProductImportRow[]) {
    const errors: ProductImportError[] = [];
    const validRows: ProductImportRow[] = [];
    const fileSeenSku = new Set<string>();

    rows.forEach((row, index) => {
      const rowIndex = index + 1;
      const sku = normalizeSku(row.sku || '');

      if (!row.name?.trim()) errors.push({ row: rowIndex, field: 'name', message: 'Name is required' });
      if (!sku) errors.push({ row: rowIndex, field: 'sku', message: 'SKU is required' });
      if (!row.category?.trim())
        errors.push({ row: rowIndex, field: 'category', message: 'Category is required' });
      if (!row.unitOfMeasure?.trim())
        errors.push({ row: rowIndex, field: 'unitOfMeasure', message: 'Unit of measure is required' });
      if (!row.locationId?.trim())
        errors.push({ row: rowIndex, field: 'locationId', message: 'Location is required' });
      if (!Number.isFinite(row.minimumThreshold) || row.minimumThreshold < 0) {
        errors.push({
          row: rowIndex,
          field: 'minimumThreshold',
          message: 'Minimum threshold must be a non-negative number',
        });
      }
      if (!Number.isFinite(row.initialQuantity) || row.initialQuantity < 0) {
        errors.push({
          row: rowIndex,
          field: 'initialQuantity',
          message: 'Initial quantity must be a non-negative number',
        });
      }

      if (sku) {
        if (fileSeenSku.has(sku)) {
          errors.push({ row: rowIndex, field: 'sku', message: 'Duplicate SKU in file' });
        } else {
          fileSeenSku.add(sku);
        }
      }

      validRows.push({ ...row, sku });
    });

    if (fileSeenSku.size > 0) {
      const { data, error } = await supabase
        .from('product_definitions')
        .select('sku')
        .in('sku', Array.from(fileSeenSku));
      if (error) throw error;
      const existing = new Set((data || []).map((item) => normalizeSku(item.sku || '')));
      validRows.forEach((row, index) => {
        if (existing.has(normalizeSku(row.sku))) {
          errors.push({ row: index + 1, field: 'sku', message: 'SKU already exists' });
        }
      });
    }

    return { errors, validRows };
  },

  async importProducts(rows: ProductImportRow[]) {
    const validation = await this.validateBulkImport(rows);
    if (validation.errors.length > 0) {
      return { inserted: 0, errors: validation.errors };
    }

    let inserted = 0;
    for (const row of validation.validRows) {
      await this.createProduct({
        name: row.name,
        sku: row.sku,
        category: row.category,
        unitOfMeasure: row.unitOfMeasure,
        minimumThreshold: row.minimumThreshold,
        initialQuantity: row.initialQuantity,
        locationId: row.locationId,
        price: row.price,
        barcode: row.barcode,
      });
      inserted += 1;
    }

    return { inserted, errors: [] as ProductImportError[] };
  },

  // PRD-009
  async listProductCategories() {
    const { data, error } = await supabase
      .from('product_definitions')
      .select('category')
      .not('category', 'is', null)
      .order('category', { ascending: true });
    if (error) throw error;
    return Array.from(new Set((data || []).map((item) => item.category).filter(Boolean)));
  },
};
