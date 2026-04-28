import { supabase } from '../supabaseClient';
import { alertService } from './alertService';
import { UserRole } from '../types';

export type MovementOperation = 'DISPATCH' | 'RECEIPT';
export type MovementReasonCode = 'SALE' | 'TRANSFER' | 'WASTE' | 'DAMAGE' | 'CORRECTION';

export interface MovementLineInput {
  inventoryItemId: string;
  quantity: number;
}

export interface ProcessCheckoutInput {
  items: Array<{ product_id: string; quantity: number; unit_price: number }>;
  paymentMethod: string;
  total: number;
  cashierId?: string | null;
  shiftId?: string | null;
  locationId: string;
}

export interface CheckoutStockIssue {
  productId: string;
  productName: string;
  requestedQty: number;
  availableQty: number;
}

export interface AtomicMovementInput {
  locationId: string;
  lines: MovementLineInput[];
  operation: MovementOperation;
  referenceId?: string;
  reasonCode?: MovementReasonCode;
  actorId?: string | null;
  actorName?: string | null;
  valuationMethod?: string;
  allowOverdraftForAdmin?: boolean;
  isAdmin?: boolean;
}

export interface TransferLineInput {
  itemId: string;
  quantity: number;
  name?: string;
}

type AllowedActorRole = UserRole.ADMIN | UserRole.MANAGER | UserRole.CASHIER | UserRole.WAREHOUSE_STAFF;

const assertPositiveQuantity = (value: number, field = 'quantity') => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${field} must be a positive number`);
  }
};

const sanitizeReference = (value?: string) => (value || '').trim();
const toSafeNumber = (value: unknown, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const toDbAdjustmentReason = (reasonCode: MovementReasonCode): string => {
  if (reasonCode === 'DAMAGE') return 'DAMAGE';
  return 'OTHER';
};

const normalizeLines = (lines: MovementLineInput[]) => {
  const merged = new Map<string, number>();
  for (const line of lines) {
    assertPositiveQuantity(line.quantity);
    merged.set(line.inventoryItemId, (merged.get(line.inventoryItemId) || 0) + line.quantity);
  }
  return Array.from(merged.entries()).map(([inventoryItemId, quantity]) => ({
    inventoryItemId,
    quantity,
  }));
};

const fetchInventoryStocks = async (locationId: string, itemIds: string[]) => {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('id,stock')
    .eq('location_id', locationId)
    .in('id', itemIds);
  if (error) throw error;
  return new Map((data || []).map((row) => [row.id as string, Number(row.stock) || 0]));
};

const validateDispatchPolicy = async (
  locationId: string,
  lines: MovementLineInput[],
  options: {
    allowAdminBypass: boolean;
    reasonCode?: MovementReasonCode;
  }
) => {
  const itemIds = lines.map((line) => line.inventoryItemId);
  const stockMap = await fetchInventoryStocks(locationId, itemIds);
  const { data: itemRows, error: itemErr } = await supabase
    .from('inventory_items')
    .select('id,product_id,product_definitions(overdraft_enabled)')
    .eq('location_id', locationId)
    .in('id', itemIds);
  if (itemErr) throw itemErr;
  const overdraftMap = new Map<string, boolean>();
  for (const row of itemRows || []) {
    const pd = Array.isArray((row as any).product_definitions)
      ? (row as any).product_definitions[0]
      : (row as any).product_definitions;
    overdraftMap.set((row as any).id, Boolean(pd?.overdraft_enabled));
  }

  for (const line of lines) {
    const current = stockMap.get(line.inventoryItemId);
    if (current === undefined) {
      throw new Error(`Inventory item not found: ${line.inventoryItemId}`);
    }
    const wouldBeNegative = current - line.quantity < 0;
    if (!wouldBeNegative) continue;
    if (options.allowAdminBypass) continue;

    const productOverdraftEnabled = Boolean(overdraftMap.get(line.inventoryItemId));
    if (!productOverdraftEnabled) {
      throw new Error(`Negative stock prevented for item ${line.inventoryItemId}`);
    }
    if (!options.reasonCode) {
      throw new Error('Reason code is mandatory when overdraft mode is used');
    }
  }
};

const ensureReasonCodeActive = async (reasonCode?: MovementReasonCode) => {
  if (!reasonCode) return;
  const { data, error } = await supabase
    .from('dispatch_reason_codes')
    .select('code,is_active')
    .eq('code', reasonCode)
    .eq('is_active', true)
    .limit(1);
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error(`Reason code is not active: ${reasonCode}`);
  }
};

const getRoleByUserId = async (userId?: string | null): Promise<UserRole | null> => {
  if (!userId) return null;
  const { data, error } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
  if (error) throw error;
  return (data?.role as UserRole) || null;
};

const requireRole = (
  role: UserRole | null,
  allowed: UserRole[],
  message = 'User role is not allowed for this operation'
) => {
  if (!role || !allowed.includes(role)) {
    throw new Error(message);
  }
};

const getAdjustmentApprovalThreshold = async () => {
  const { data, error } = await supabase
    .from('system_settings')
    .select('adjustment_approval_threshold')
    .limit(1)
    .maybeSingle();
  if (error) return 0;
  return Math.max(0, Number((data as any)?.adjustment_approval_threshold || 0));
};

export const movementService = {
  async validateCheckoutStock(input: {
    locationId: string;
    items: Array<{ product_id: string; quantity: number }>;
  }): Promise<{ ok: boolean; issues: CheckoutStockIssue[] }> {
    const requestedByProduct = new Map<string, number>();
    for (const item of input.items || []) {
      if (!item?.product_id) continue;
      const qty = toSafeNumber(item.quantity);
      if (qty <= 0) continue;
      requestedByProduct.set(item.product_id, (requestedByProduct.get(item.product_id) || 0) + qty);
    }

    const productIds = Array.from(requestedByProduct.keys());
    if (productIds.length === 0) {
      return { ok: true, issues: [] };
    }

    const [{ data: products, error: productError }, { data: inventoryRows, error: inventoryError }] =
      await Promise.all([
        supabase.from('product_definitions').select('id,name,type').in('id', productIds),
        supabase
          .from('inventory_items')
          .select('product_id,stock,reserved_stock,damaged_stock')
          .eq('location_id', input.locationId)
          .in('product_id', productIds),
      ]);

    if (productError) throw productError;
    if (inventoryError) throw inventoryError;

    const productMap = new Map<string, { name: string; type: string }>();
    for (const product of products || []) {
      productMap.set((product as any).id, {
        name: (product as any).name || 'Item',
        type: (product as any).type || '',
      });
    }

    const availableByProduct = new Map<string, number>();
    for (const row of inventoryRows || []) {
      const productId = (row as any).product_id;
      if (!productId) continue;
      const stock = toSafeNumber((row as any).stock);
      const reserved = toSafeNumber((row as any).reserved_stock);
      const damaged = toSafeNumber((row as any).damaged_stock);
      const available = Math.max(0, stock - reserved - damaged);
      availableByProduct.set(productId, (availableByProduct.get(productId) || 0) + available);
    }

    const issues: CheckoutStockIssue[] = [];
    for (const [productId, requestedQty] of requestedByProduct.entries()) {
      const product = productMap.get(productId);
      if (product?.type === 'BEVERAGE') continue;
      const availableQty = availableByProduct.get(productId) || 0;
      if (requestedQty > availableQty) {
        issues.push({
          productId,
          productName: product?.name || productId,
          requestedQty,
          availableQty,
        });
      }
    }

    return { ok: issues.length === 0, issues };
  },

  // MOV-001 + MOV-008 + MOV-009
  async executeAtomicStockUpdate(input: AtomicMovementInput) {
    const lines = normalizeLines(input.lines);
    if (lines.length === 0) {
      throw new Error('At least one movement line is required');
    }

    const allowAdminBypass = Boolean(input.allowOverdraftForAdmin && input.isAdmin);
    if (input.operation === 'DISPATCH') {
      await ensureReasonCodeActive(input.reasonCode);
      await validateDispatchPolicy(input.locationId, lines, {
        allowAdminBypass,
        reasonCode: input.reasonCode,
      });
    }

    const touchedIds = lines.map((line) => line.inventoryItemId);

    if (input.operation === 'DISPATCH') {
      const { error } = await supabase.rpc('deduct_inventory_with_cost', {
        p_location_id: input.locationId,
        p_items: lines.map((line) => ({ item_id: line.inventoryItemId, quantity: line.quantity })),
        p_method: input.valuationMethod || 'WEIGHTED_AVG',
        p_transaction_id:
          sanitizeReference(input.referenceId) ||
          `dispatch-${Date.now()}${input.reasonCode ? `::${input.reasonCode}` : ''}`,
        p_user_id: input.actorId || null,
        p_user_name: input.actorName || null,
      });
      if (error) throw error;
      await alertService.evaluateAlertsAfterMovement({
        locationId: input.locationId,
        inventoryItemIds: touchedIds,
      });
      return { success: true, message: 'Dispatch completed atomically.' };
    }

    const { error } = await supabase.rpc('add_inventory_atomic', {
      p_location_id: input.locationId,
      p_items: lines.map((line) => ({ item_id: line.inventoryItemId, quantity: line.quantity })),
      p_reference_id:
        sanitizeReference(input.referenceId) ||
        `receipt-${Date.now()}${input.reasonCode ? `::${input.reasonCode}` : ''}`,
      p_user_id: input.actorId || null,
      p_user_name: input.actorName || null,
      p_movement_type: 'PURCHASE_RECEIPT',
    });
    if (error) throw error;
    await alertService.evaluateAlertsAfterMovement({
      locationId: input.locationId,
      inventoryItemIds: touchedIds,
    });
    return { success: true, message: 'Receipt completed atomically.' };
  },

  // MOV-002
  async processCheckoutWithAutoDispatch(input: ProcessCheckoutInput) {
    const { data, error } = await supabase.rpc('process_checkout', {
      p_items: input.items,
      p_payment_method: input.paymentMethod,
      p_total: input.total,
      p_cashier_id: input.cashierId || null,
      p_shift_id: input.shiftId || null,
      p_location_id: input.locationId,
    });
    if (error) throw error;

    const productIds = Array.from(new Set(input.items.map((item) => item.product_id).filter(Boolean)));
    if (productIds.length > 0) {
      const { data: rows, error: rowError } = await supabase
        .from('inventory_items')
        .select('id')
        .eq('location_id', input.locationId)
        .in('product_id', productIds);
      if (!rowError) {
        await alertService.evaluateAlertsAfterMovement({
          locationId: input.locationId,
          inventoryItemIds: (rows || []).map((row) => row.id),
        });
      }
    }

    return data;
  },

  // MOV-003
  async manualDispatch(input: {
    locationId: string;
    lines: MovementLineInput[];
    reasonCode: MovementReasonCode;
    notes?: string;
    actorId?: string | null;
    actorName?: string | null;
    actorRole?: AllowedActorRole | null;
    allowOverdraftForAdmin?: boolean;
    isAdmin?: boolean;
  }) {
    const role = input.actorRole || (await getRoleByUserId(input.actorId));
    requireRole(role, [UserRole.ADMIN, UserRole.MANAGER, UserRole.WAREHOUSE_STAFF]);

    return this.executeAtomicStockUpdate({
      locationId: input.locationId,
      lines: input.lines,
      operation: 'DISPATCH',
      reasonCode: input.reasonCode,
      referenceId: `manual-dispatch-${Date.now()}${input.notes ? `::${input.notes}` : ''}`,
      actorId: input.actorId,
      actorName: input.actorName,
      allowOverdraftForAdmin: input.allowOverdraftForAdmin,
      isAdmin: input.isAdmin,
    });
  },

  // MOV-004
  async recordStockReceipt(input: {
    locationId: string;
    lines: MovementLineInput[];
    supplierReference: string;
    expiryDate?: string;
    actorId?: string | null;
    actorName?: string | null;
    actorRole?: AllowedActorRole | null;
  }) {
    const role = input.actorRole || (await getRoleByUserId(input.actorId));
    requireRole(role, [UserRole.ADMIN, UserRole.MANAGER, UserRole.WAREHOUSE_STAFF]);

    if (!input.supplierReference?.trim()) {
      throw new Error('supplierReference is required');
    }

    const reference = input.expiryDate
      ? `${input.supplierReference.trim()}::expiry=${input.expiryDate}`
      : input.supplierReference.trim();

    return this.executeAtomicStockUpdate({
      locationId: input.locationId,
      lines: input.lines,
      operation: 'RECEIPT',
      referenceId: reference,
      actorId: input.actorId,
      actorName: input.actorName,
    });
  },

  // MOV-005
  async adjustStockAbsolute(input: {
    inventoryItemId: string;
    locationId: string;
    absoluteQuantity: number;
    reasonCode: MovementReasonCode;
    notes?: string;
    authorizingUserId?: string | null;
    authorizingUserName?: string | null;
    authorizingUserRole?: AllowedActorRole | null;
    secondApproverUserId?: string | null;
    secondApproverUserRole?: AllowedActorRole | null;
  }) {
    if (!Number.isFinite(input.absoluteQuantity) || input.absoluteQuantity < 0) {
      throw new Error('absoluteQuantity must be a non-negative number');
    }

    const actorRole = input.authorizingUserRole || (await getRoleByUserId(input.authorizingUserId));
    requireRole(actorRole, [UserRole.ADMIN, UserRole.MANAGER, UserRole.WAREHOUSE_STAFF]);

    const { data: row, error: rowError } = await supabase
      .from('inventory_items')
      .select('id,name,stock')
      .eq('id', input.inventoryItemId)
      .eq('location_id', input.locationId)
      .single();
    if (rowError) throw rowError;

    const currentStock = Number(row.stock) || 0;
    const delta = input.absoluteQuantity - currentStock;
    if (delta === 0) {
      return { success: true, message: 'No adjustment required', delta: 0 };
    }

    const approvalThreshold = await getAdjustmentApprovalThreshold();
    const exceedsThreshold = Math.abs(delta) > approvalThreshold && approvalThreshold > 0;

    if (exceedsThreshold) {
      const approverRole =
        input.secondApproverUserRole || (await getRoleByUserId(input.secondApproverUserId));
      if (!input.secondApproverUserId || !approverRole) {
        const { data: pending, error: pendingError } = await supabase
          .from('stock_adjustments')
          .insert([
            {
              item_id: input.inventoryItemId,
              location_id: input.locationId,
              quantity: delta,
              reason: toDbAdjustmentReason(input.reasonCode),
              notes:
                input.notes ||
                `Pending second approval; absolute adjustment to ${input.absoluteQuantity}; code=${input.reasonCode}`,
              status: 'PENDING',
              user_id: input.authorizingUserId || null,
              user_name: input.authorizingUserName || null,
              item_name: row.name || null,
              created_at: new Date().toISOString(),
            },
          ])
          .select()
          .single();
        if (pendingError) throw pendingError;
        return {
          success: false,
          requiresSecondApproval: true,
          threshold: approvalThreshold,
          pendingAdjustment: pending,
        };
      }

      requireRole(approverRole, [UserRole.ADMIN, UserRole.MANAGER], 'Second approver must be Manager or Admin');
      if (input.secondApproverUserId === input.authorizingUserId) {
        throw new Error('Second approver must be a different user');
      }
    }

    const payload = {
      item_id: input.inventoryItemId,
      location_id: input.locationId,
      quantity: delta,
      reason: toDbAdjustmentReason(input.reasonCode),
      notes: input.notes || `Absolute adjustment to ${input.absoluteQuantity}; code=${input.reasonCode}`,
      status: 'APPROVED',
      user_id: input.authorizingUserId || null,
      user_name: input.authorizingUserName || null,
      item_name: row.name || null,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from('stock_adjustments').insert([payload]).select().single();
    if (error) throw error;
    return { success: true, delta, adjustment: data };
  },

  // MOV-006
  async interBranchTransfer(input: {
    sourceLocationId: string;
    destinationLocationId: string;
    lines: TransferLineInput[];
    notes?: string;
    actorId?: string | null;
    actorName?: string | null;
    actorRole?: AllowedActorRole | null;
  }) {
    const role = input.actorRole || (await getRoleByUserId(input.actorId));
    requireRole(role, [UserRole.ADMIN, UserRole.MANAGER]);

    if (input.sourceLocationId === input.destinationLocationId) {
      throw new Error('Source and destination locations must be different');
    }
    if (!input.lines.length) {
      throw new Error('At least one transfer line is required');
    }

    const manifest = input.lines.map((line) => {
      assertPositiveQuantity(line.quantity);
      return { itemId: line.itemId, quantity: line.quantity, name: line.name || null };
    });

    const { data: transfer, error: insertError } = await supabase
      .from('stock_transfers')
      .insert({
        source_location_id: input.sourceLocationId,
        destination_location_id: input.destinationLocationId,
        status: 'APPROVED',
        notes: input.notes || null,
        created_by: input.actorId || null,
        manifest,
      })
      .select('id')
      .single();
    if (insertError) throw insertError;

    const { error: completeError } = await supabase.rpc('complete_stock_transfer', {
      p_transfer_id: transfer.id,
      p_user_id: input.actorId || null,
      p_user_name: input.actorName || null,
    });
    if (completeError) {
      await supabase.from('stock_transfers').delete().eq('id', transfer.id);
      throw completeError;
    }

    return { success: true, transferId: transfer.id };
  },

  // MOV-007
  async returnToInventory(input: {
    locationId: string;
    lines: MovementLineInput[];
    originalTransactionId: string;
    actorId?: string | null;
    actorName?: string | null;
  }) {
    if (!input.originalTransactionId?.trim()) {
      throw new Error('originalTransactionId is required');
    }
    return this.executeAtomicStockUpdate({
      locationId: input.locationId,
      lines: input.lines,
      operation: 'RECEIPT',
      referenceId: input.originalTransactionId.trim(),
      reasonCode: 'CORRECTION',
      actorId: input.actorId,
      actorName: input.actorName,
    });
  },

  // MOV-009
  async batchVoucher(input: {
    locationId: string;
    operation: MovementOperation;
    lines: MovementLineInput[];
    referenceId?: string;
    reasonCode?: MovementReasonCode;
    actorId?: string | null;
    actorName?: string | null;
    actorRole?: AllowedActorRole | null;
    allowOverdraftForAdmin?: boolean;
    isAdmin?: boolean;
  }) {
    const role = input.actorRole || (await getRoleByUserId(input.actorId));
    requireRole(role, [UserRole.ADMIN, UserRole.MANAGER, UserRole.WAREHOUSE_STAFF]);

    return this.executeAtomicStockUpdate({
      locationId: input.locationId,
      operation: input.operation,
      lines: input.lines,
      referenceId: input.referenceId,
      reasonCode: input.reasonCode,
      actorId: input.actorId,
      actorName: input.actorName,
      allowOverdraftForAdmin: input.allowOverdraftForAdmin,
      isAdmin: input.isAdmin,
    });
  },
};
