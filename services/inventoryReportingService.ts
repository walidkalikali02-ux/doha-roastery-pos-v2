import { exportExcelHtml, exportPdfPrint } from '../utils/reportExport';
import { supabase } from '../supabaseClient';

type GroupBy = 'product' | 'operation';

export interface DateRangeInput {
  from: string;
  to: string;
}

const toNumber = (value: unknown, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const normDate = (value?: string) => {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
};

const unique = <T,>(items: T[]) => Array.from(new Set(items));

const movementSign = (movementType: string) => {
  if (['SALE', 'TRANSFER_OUT', 'ADJUSTMENT', 'RETURN_TO_SUPPLIER'].includes(movementType)) return -1;
  if (['RETURN', 'PURCHASE_RECEIPT', 'TRANSFER_IN', 'COUNT_APPROVAL', 'MANUAL_UPDATE'].includes(movementType))
    return 1;
  return 0;
};

export const inventoryReportingService = {
  // RPT-001
  async getInventorySummaryDashboard() {
    const [{ data: products, error: productsError }, { data: items, error: itemsError }] =
      await Promise.all([
        supabase.from('product_definitions').select('id,cost_price,reorder_point').eq('is_active', true),
        supabase.from('inventory_items').select('product_id,stock,minimum_stock'),
      ]);

    if (productsError) throw productsError;
    if (itemsError) throw itemsError;

    const costByProduct = new Map<string, number>();
    const thresholdByProduct = new Map<string, number>();
    for (const p of products || []) {
      costByProduct.set(p.id, toNumber((p as any).cost_price, 0));
      thresholdByProduct.set(p.id, toNumber((p as any).reorder_point, 0));
    }

    const totalSkus = unique((items || []).map((i) => i.product_id)).length;
    let totalUnits = 0;
    let totalValueCost = 0;
    const stockByProduct = new Map<string, number>();

    for (const row of items || []) {
      const qty = toNumber(row.stock, 0);
      totalUnits += qty;
      totalValueCost += qty * toNumber(costByProduct.get(row.product_id), 0);
      stockByProduct.set(row.product_id, (stockByProduct.get(row.product_id) || 0) + qty);
    }

    let lowStockCount = 0;
    let outOfStockCount = 0;
    for (const [productId, qty] of stockByProduct.entries()) {
      const threshold = toNumber(thresholdByProduct.get(productId), 0);
      if (qty <= 0) outOfStockCount += 1;
      else if (qty <= threshold) lowStockCount += 1;
    }

    return {
      totalSkus,
      totalUnitsInStock: totalUnits,
      totalValueCost,
      lowStockCount,
      outOfStockCount,
      generatedAtUtc: new Date().toISOString(),
    };
  },

  // RPT-002
  async getStockMovementReport(input: DateRangeInput & { groupBy?: GroupBy }) {
    const from = normDate(input.from);
    const to = normDate(input.to);
    const groupBy: GroupBy = input.groupBy || 'product';

    let query = supabase
      .from('inventory_movements')
      .select(
        'id,inventory_item_id,movement_type,quantity,before_stock,after_stock,reference_id,actor_id,actor_name,created_at,location_id,inventory_items!inner(product_id,name),locations(name)'
      )
      .order('created_at', { ascending: false });

    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data || []).map((row: any) => ({
      movementId: row.id,
      productId: row.inventory_items?.product_id || null,
      productName: row.inventory_items?.name || 'Unknown',
      operationType: row.movement_type,
      quantity: toNumber(row.quantity, 0),
      quantityBefore: row.before_stock,
      quantityAfter: row.after_stock,
      referenceId: row.reference_id || null,
      actorId: row.actor_id || null,
      actorName: row.actor_name || null,
      occurredAt: row.created_at,
      locationId: row.location_id || null,
      locationName: row.locations?.name || null,
    }));

    const grouped = new Map<string, { key: string; movementCount: number; netQuantity: number }>();
    for (const row of rows) {
      const key = groupBy === 'operation' ? row.operationType : row.productName;
      const current = grouped.get(key) || { key, movementCount: 0, netQuantity: 0 };
      current.movementCount += 1;
      current.netQuantity += row.quantity;
      grouped.set(key, current);
    }

    const subtotals = Array.from(grouped.values()).sort((a, b) => b.netQuantity - a.netQuantity);
    return { rows, groupedBy: groupBy, subtotals };
  },

  // RPT-003
  async getValuationReportAsOfDate(asOfDateIso: string) {
    const asOf = normDate(asOfDateIso);
    const [{ data: items, error: itemsError }, { data: products, error: productsError }] =
      await Promise.all([
        supabase.from('inventory_items').select('id,product_id,stock'),
        supabase.from('product_definitions').select('id,name,category,cost_price'),
      ]);
    if (itemsError) throw itemsError;
    if (productsError) throw productsError;

    const itemIds = (items || []).map((i) => i.id);
    const movementDeltaAfter = new Map<string, number>();
    if (itemIds.length && asOf) {
      const { data: moves, error: moveError } = await supabase
        .from('inventory_movements')
        .select('inventory_item_id,quantity,created_at')
        .in('inventory_item_id', itemIds)
        .gt('created_at', asOf);
      if (moveError) throw moveError;
      for (const mv of moves || []) {
        movementDeltaAfter.set(
          mv.inventory_item_id,
          (movementDeltaAfter.get(mv.inventory_item_id) || 0) + toNumber(mv.quantity, 0)
        );
      }
    }

    const productMeta = new Map<string, { name: string; category: string; unitCost: number }>();
    for (const p of products || []) {
      productMeta.set(p.id, {
        name: (p as any).name || 'Unknown',
        category: (p as any).category || 'Uncategorized',
        unitCost: toNumber((p as any).cost_price, 0),
      });
    }

    const byProduct = new Map<
      string,
      { productId: string; name: string; category: string; quantity: number; unitCost: number; value: number }
    >();
    for (const item of items || []) {
      const meta = productMeta.get(item.product_id);
      if (!meta) continue;
      const qtyAsOf = toNumber(item.stock, 0) - toNumber(movementDeltaAfter.get(item.id), 0);
      const entry = byProduct.get(item.product_id) || {
        productId: item.product_id,
        name: meta.name,
        category: meta.category,
        quantity: 0,
        unitCost: meta.unitCost,
        value: 0,
      };
      entry.quantity += qtyAsOf;
      entry.value += qtyAsOf * meta.unitCost;
      byProduct.set(item.product_id, entry);
    }

    const perProduct = Array.from(byProduct.values()).sort((a, b) => b.value - a.value);
    const categoryMap = new Map<string, { category: string; quantity: number; value: number }>();
    for (const p of perProduct) {
      const cat = categoryMap.get(p.category) || { category: p.category, quantity: 0, value: 0 };
      cat.quantity += p.quantity;
      cat.value += p.value;
      categoryMap.set(p.category, cat);
    }
    const perCategory = Array.from(categoryMap.values()).sort((a, b) => b.value - a.value);

    return {
      asOfUtc: asOf || new Date().toISOString(),
      perProduct,
      perCategory,
      totalValue: perProduct.reduce((sum, row) => sum + row.value, 0),
    };
  },

  // RPT-004
  async getConsumptionReport(input: DateRangeInput) {
    const from = normDate(input.from);
    const to = normDate(input.to);

    let query = supabase
      .from('inventory_movements')
      .select('movement_type,quantity,inventory_items!inner(product_id,name)')
      .eq('movement_type', 'SALE');
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);

    const { data, error } = await query;
    if (error) throw error;

    const byProduct = new Map<string, { productId: string; productName: string; consumedUnits: number }>();
    for (const row of data || []) {
      const pid = (row as any).inventory_items?.product_id || 'unknown';
      const name = (row as any).inventory_items?.name || 'Unknown';
      const qty = Math.abs(toNumber((row as any).quantity, 0));
      const current = byProduct.get(pid) || { productId: pid, productName: name, consumedUnits: 0 };
      current.consumedUnits += qty;
      byProduct.set(pid, current);
    }

    return Array.from(byProduct.values()).sort((a, b) => b.consumedUnits - a.consumedUnits);
  },

  // RPT-005
  async getDeadStockReport(daysWithoutMovement: number) {
    const days = Math.max(1, Math.floor(daysWithoutMovement));
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceIso = since.toISOString();

    const [{ data: items, error: itemError }, { data: recentMoves, error: moveError }] = await Promise.all([
      supabase
        .from('inventory_items')
        .select('id,product_id,stock,location_id,inventory_items!inner(product_id)'),
      supabase
        .from('inventory_movements')
        .select('inventory_item_id')
        .gte('created_at', sinceIso),
    ]);
    if (itemError) throw itemError;
    if (moveError) throw moveError;

    const movedIds = new Set((recentMoves || []).map((m) => m.inventory_item_id));
    const productIds = unique((items || []).map((i: any) => i.product_id).filter(Boolean));
    const { data: products, error: productError } = await supabase
      .from('product_definitions')
      .select('id,name,sku,category')
      .in('id', productIds);
    if (productError) throw productError;
    const productMap = new Map((products || []).map((p: any) => [p.id, p]));

    const deadRows = (items || [])
      .filter((item: any) => !movedIds.has(item.id))
      .map((item: any) => {
        const p = productMap.get(item.product_id);
        return {
          inventoryItemId: item.id,
          productId: item.product_id,
          productName: p?.name || 'Unknown',
          sku: p?.sku || null,
          category: p?.category || 'Uncategorized',
          locationId: item.location_id,
          quantity: toNumber(item.stock, 0),
          lastMovementWithinDays: false,
        };
      })
      .sort((a, b) => b.quantity - a.quantity);

    return deadRows;
  },

  // RPT-006
  async getBranchComparisonReport(input: DateRangeInput) {
    const from = normDate(input.from);
    const to = normDate(input.to);

    const [{ data: locations, error: locError }, { data: items, error: itemError }] = await Promise.all([
      supabase.from('locations').select('id,name,is_roastery').eq('is_active', true),
      supabase.from('inventory_items').select('location_id,stock'),
    ]);
    if (locError) throw locError;
    if (itemError) throw itemError;

    let moveQuery = supabase.from('inventory_movements').select('location_id,movement_type,quantity');
    if (from) moveQuery = moveQuery.gte('created_at', from);
    if (to) moveQuery = moveQuery.lte('created_at', to);
    const { data: moves, error: moveError } = await moveQuery;
    if (moveError) throw moveError;

    const stockByLocation = new Map<string, number>();
    for (const row of items || []) {
      stockByLocation.set(row.location_id, (stockByLocation.get(row.location_id) || 0) + toNumber(row.stock, 0));
    }

    const moveVolumeByLocation = new Map<string, number>();
    for (const mv of moves || []) {
      const signed = movementSign((mv as any).movement_type) * Math.abs(toNumber((mv as any).quantity, 0));
      moveVolumeByLocation.set(
        (mv as any).location_id,
        (moveVolumeByLocation.get((mv as any).location_id) || 0) + signed
      );
    }

    return (locations || []).map((loc: any) => ({
      locationId: loc.id,
      locationName: loc.name,
      isRoastery: Boolean(loc.is_roastery),
      stockUnits: stockByLocation.get(loc.id) || 0,
      movementNetVolume: moveVolumeByLocation.get(loc.id) || 0,
    }));
  },

  // RPT-007
  exportReportExcel(filename: string, title: string, columns: string[], rows: Array<Array<string | number>>) {
    exportExcelHtml(filename, title, [
      {
        title,
        columns: columns.map((label) => ({ label })),
        rows,
      },
    ]);
  },

  // RPT-007
  exportReportPdf(title: string, columns: string[], rows: Array<Array<string | number>>) {
    exportPdfPrint(title, [
      {
        title,
        columns: columns.map((label) => ({ label })),
        rows,
      },
    ]);
  },
};
