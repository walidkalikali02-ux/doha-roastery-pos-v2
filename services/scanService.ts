import { supabase } from '../supabaseClient';

export type ScanOperationType = 'DISPATCH' | 'RECEIPT' | 'ADJUSTMENT';
export type ReasonCode = 'SALE' | 'TRANSFER' | 'WASTE' | 'DAMAGE' | 'CORRECTION';
export type ProductStatusBadge = 'Available' | 'Low' | 'Out';

export interface ResolvedProductCard {
  productId: string;
  inventoryItemId: string;
  scannedValue: string;
  productName: string;
  sku: string | null;
  barcode: string | null;
  unitOfMeasure: string | null;
  currentQuantity: number;
  minimumThreshold: number;
  statusBadge: ProductStatusBadge;
}

export interface ScanResolveResult {
  found: boolean;
  durationMs: number;
  product?: ResolvedProductCard;
  message: string;
}

export interface QuantityValidationResult {
  isValid: boolean;
  error?: string;
  remainingBalancePreview: number;
}

export interface ExecuteScanOperationInput {
  inventoryItemId: string;
  locationId: string;
  quantity: number;
  operationType?: ScanOperationType;
  reasonCode?: ReasonCode;
  minimumThreshold?: number;
  actorId?: string | null;
  actorName?: string | null;
  referenceId?: string;
  valuationMethod?: string;
}

const DEFAULT_TIMEOUT_MS = 500;
const DEFAULT_OPERATION_TYPE: ScanOperationType = 'DISPATCH';

const normalizeScanValue = (value: string) => value.trim();

const toStatusBadge = (currentQuantity: number, minimumThreshold: number): ProductStatusBadge => {
  if (currentQuantity <= 0) return 'Out';
  if (currentQuantity <= minimumThreshold) return 'Low';
  return 'Available';
};

const normalizePositiveInteger = (value: number) => Number.isInteger(value) && value > 0;

const toDispatchReference = (referenceId: string | undefined, reasonCode: ReasonCode | undefined) => {
  const base = referenceId || `dispatch-${Date.now()}`;
  return reasonCode ? `${base}::${reasonCode}` : base;
};

const loadInventoryProductRows = async (locationId: string) => {
  const { data, error } = await supabase
    .from('inventory_items')
    .select(
      'id,stock,minimum_stock,product_definitions!inner(id,name,sku,barcode,unit,reorder_point,is_active,product_status)'
    )
    .eq('location_id', locationId);

  if (error) throw error;
  return data || [];
};

const readJoinedProduct = (row: any) => {
  if (Array.isArray(row?.product_definitions)) {
    return row.product_definitions[0] || null;
  }
  return row?.product_definitions || null;
};

export const scanService = {
  defaultOperationType: DEFAULT_OPERATION_TYPE,

  // SCN-001 + SCN-002
  async scanAndResolve(codeOrManualEntry: string, locationId: string): Promise<ScanResolveResult> {
    const startedAt = performance.now();
    const scannedValue = normalizeScanValue(codeOrManualEntry);
    if (!scannedValue) {
      return {
        found: false,
        durationMs: Math.round(performance.now() - startedAt),
        message: `Product not found: "${scannedValue}"`,
      };
    }

    const rows = await loadInventoryProductRows(locationId);
    const lower = scannedValue.toLowerCase();
    const exact = rows.find((row: any) => {
      const product = readJoinedProduct(row);
      return (
        (product?.barcode || '').toLowerCase() === lower ||
        (product?.sku || '').toLowerCase() === lower ||
        (product?.name || '').toLowerCase() === lower
      );
    });

    const match = exact || null;
    if (!match) {
      return {
        found: false,
        durationMs: Math.round(performance.now() - startedAt),
        message: `Product not found: "${scannedValue}"`,
      };
    }

    const product = readJoinedProduct(match);
    const currentQuantity = Number(match.stock) || 0;
    const minimumThreshold = Number(match.minimum_stock ?? product?.reorder_point ?? 0) || 0;

    const card: ResolvedProductCard = {
      productId: product.id,
      inventoryItemId: match.id,
      scannedValue,
      productName: product.name || 'Unknown Product',
      sku: product.sku || null,
      barcode: product.barcode || null,
      unitOfMeasure: product.unit || null,
      currentQuantity,
      minimumThreshold,
      statusBadge: toStatusBadge(currentQuantity, minimumThreshold),
    };

    const durationMs = Math.round(performance.now() - startedAt);
    const exceededSla = durationMs > DEFAULT_TIMEOUT_MS;
    return {
      found: true,
      durationMs,
      product: card,
      message: exceededSla
        ? `Resolved in ${durationMs}ms (above ${DEFAULT_TIMEOUT_MS}ms target)`
        : `Resolved in ${durationMs}ms`,
    };
  },

  // SCN-004
  validateQuantity(params: {
    operationType?: ScanOperationType;
    quantity: number;
    currentQuantity: number;
  }): QuantityValidationResult {
    const operationType = params.operationType || DEFAULT_OPERATION_TYPE;
    if (!normalizePositiveInteger(params.quantity)) {
      return {
        isValid: false,
        error: 'Quantity must be a positive integer.',
        remainingBalancePreview: params.currentQuantity,
      };
    }

    if (operationType === 'DISPATCH' && params.quantity > params.currentQuantity) {
      return {
        isValid: false,
        error: 'Dispatch quantity cannot exceed current stock.',
        remainingBalancePreview: params.currentQuantity,
      };
    }

    const remainingBalancePreview =
      operationType === 'RECEIPT'
        ? params.currentQuantity + params.quantity
        : Math.max(0, params.currentQuantity - params.quantity);

    return {
      isValid: true,
      remainingBalancePreview,
    };
  },

  // SCN-007
  requiresReasonCode(params: {
    operationType?: ScanOperationType;
    quantity: number;
    minimumThreshold: number;
  }) {
    const operationType = params.operationType || DEFAULT_OPERATION_TYPE;
    if (operationType === 'ADJUSTMENT') return true;
    if (operationType === 'DISPATCH' && params.quantity > params.minimumThreshold) return true;
    return false;
  },

  // SCN-005
  async executeOperationAtomically(input: ExecuteScanOperationInput) {
    const operationType = input.operationType || DEFAULT_OPERATION_TYPE;
    const { data: row, error: rowError } = await supabase
      .from('inventory_items')
      .select('stock,minimum_stock')
      .eq('id', input.inventoryItemId)
      .eq('location_id', input.locationId)
      .single();
    if (rowError) {
      return { success: false, message: rowError.message || 'Inventory item not found.' };
    }

    const currentStock = Number(row.stock) || 0;
    const minimumThreshold = Number(input.minimumThreshold ?? row.minimum_stock ?? 0) || 0;
    const validation = this.validateQuantity({
      operationType,
      quantity: input.quantity,
      currentQuantity: currentStock,
    });
    if (!validation.isValid) {
      return { success: false, message: validation.error || 'Invalid quantity' };
    }

    const needsReason = this.requiresReasonCode({
      operationType,
      quantity: input.quantity,
      minimumThreshold,
    });
    if (needsReason && !input.reasonCode) {
      return { success: false, message: 'Reason code is required for this operation.' };
    }

    if (operationType === 'RECEIPT') {
      const { error } = await supabase.rpc('add_inventory_atomic', {
        p_location_id: input.locationId,
        p_items: [{ item_id: input.inventoryItemId, quantity: input.quantity }],
        p_reference_id: input.referenceId || `receipt-${Date.now()}`,
        p_user_id: input.actorId || null,
        p_user_name: input.actorName || null,
        p_movement_type: 'PURCHASE_RECEIPT',
      });
      if (error) {
        return { success: false, message: error.message || 'Operation failed' };
      }
      return { success: true, message: 'Receipt completed successfully.' };
    }

    const { error } = await supabase.rpc('deduct_inventory_with_cost', {
      p_location_id: input.locationId,
      p_items: [{ item_id: input.inventoryItemId, quantity: input.quantity }],
      p_method: input.valuationMethod || 'WEIGHTED_AVG',
      p_transaction_id: toDispatchReference(input.referenceId, input.reasonCode),
      p_user_id: input.actorId || null,
      p_user_name: input.actorName || null,
    });
    if (error) {
      return { success: false, message: error.message || 'Operation failed' };
    }
    return { success: true, message: 'Dispatch completed successfully.' };
  },

  // SCN-008
  async getPartialMatches(query: string, locationId: string, limit = 10) {
    const q = normalizeScanValue(query).toLowerCase();
    if (!q) return [];

    const rows = await loadInventoryProductRows(locationId);
    const matches = rows
      .filter((row: any) => {
        const product = readJoinedProduct(row);
        return (
          (product?.barcode || '').toLowerCase().includes(q) ||
          (product?.sku || '').toLowerCase().includes(q) ||
          (product?.name || '').toLowerCase().includes(q)
        );
      })
      .slice(0, Math.max(1, Math.min(limit, 10)))
      .map((row: any) => {
        const product = readJoinedProduct(row);
        const currentQuantity = Number(row.stock) || 0;
        const minimumThreshold = Number(row.minimum_stock ?? product?.reorder_point ?? 0) || 0;
        return {
          productId: product.id,
          inventoryItemId: row.id,
          name: product.name,
          sku: product.sku,
          barcode: product.barcode,
          currentQuantity,
          minimumThreshold,
          statusBadge: toStatusBadge(currentQuantity, minimumThreshold),
          unitOfMeasure: product.unit || null,
        };
      });

    return matches;
  },

  // SCN-006 (UI helper)
  prepareForNextScan(inputEl?: HTMLInputElement | null) {
    if (!inputEl) return;
    inputEl.value = '';
    inputEl.focus();
    inputEl.select();
  },
};
