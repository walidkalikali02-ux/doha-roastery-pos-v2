import { exportPdfPrint } from '../utils/reportExport';
import { supabase } from '../supabaseClient';

export interface AuditLogFilters {
  dateFrom?: string;
  dateTo?: string;
  productId?: string;
  productSearch?: string;
  userId?: string;
  operationType?: string;
  locationId?: string;
  page?: number;
  pageSize?: number;
}

export interface InventoryAuditLogEntry {
  movement_id: string;
  product_id: string | null;
  product_sku: string | null;
  barcode_scanned: string | null;
  operation_type: string;
  quantity: number;
  quantity_before: number | null;
  quantity_after: number | null;
  user_id: string | null;
  user_role: string | null;
  reason_code: string | null;
  reference_id: string | null;
  occurred_at: string;
  location_id: string | null;
  location_name: string | null;
  pos_transaction_id: string | null;
  transaction_link: string | null;
}

const toNumber = (value: unknown, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const toCsvCell = (value: unknown) => {
  const raw = value === null || value === undefined ? '' : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
};

const toExportRows = (items: InventoryAuditLogEntry[]) =>
  items.map((item) => [
    item.movement_id,
    item.product_sku || '',
    item.barcode_scanned || '',
    item.operation_type,
    item.quantity,
    item.quantity_before ?? '',
    item.quantity_after ?? '',
    item.user_id || '',
    item.user_role || '',
    item.reason_code || '',
    item.reference_id || '',
    item.occurred_at,
    item.location_name || item.location_id || '',
    item.transaction_link || '',
  ]);

export const auditLogService = {
  // AUD-003 + AUD-005
  async getInventoryAuditLog(filters: AuditLogFilters = {}) {
    const page = Math.max(filters.page || 1, 1);
    const pageSize = Math.max(filters.pageSize || 50, 1);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('inventory_movement_audit_logs')
      .select('*', { count: 'exact' })
      .order('occurred_at', { ascending: false })
      .range(from, to);

    if (filters.dateFrom) query = query.gte('occurred_at', filters.dateFrom);
    if (filters.dateTo) query = query.lte('occurred_at', filters.dateTo);
    if (filters.productId) query = query.eq('product_id', filters.productId);
    if (filters.userId) query = query.eq('user_id', filters.userId);
    if (filters.operationType) query = query.eq('operation_type', filters.operationType);
    if (filters.locationId) query = query.eq('location_id', filters.locationId);
    if (filters.productSearch) {
      const safe = filters.productSearch.replace(/,/g, ' ');
      query = query.ilike('product_sku', `%${safe}%`);
    }

    const { data, count, error } = await query;
    if (error) throw error;

    const items: InventoryAuditLogEntry[] = (data || []).map((row: any) => ({
      movement_id: row.movement_id,
      product_id: row.product_id || null,
      product_sku: row.product_sku || null,
      barcode_scanned: row.barcode_scanned || null,
      operation_type: row.operation_type,
      quantity: toNumber(row.quantity, 0),
      quantity_before: row.quantity_before === null ? null : toNumber(row.quantity_before, 0),
      quantity_after: row.quantity_after === null ? null : toNumber(row.quantity_after, 0),
      user_id: row.user_id || null,
      user_role: row.user_role || null,
      reason_code: row.reason_code || null,
      reference_id: row.reference_id || null,
      occurred_at: row.occurred_at,
      location_id: row.location_id || null,
      location_name: row.location_name || null,
      pos_transaction_id: row.pos_transaction_id || null,
      transaction_link: row.pos_transaction_id ? `/pos?transactionId=${row.pos_transaction_id}` : null,
    }));

    return { data: items, totalCount: count || 0 };
  },

  // AUD-004
  exportAuditLogCsv(filename: string, items: InventoryAuditLogEntry[]) {
    const header = [
      'movement_id',
      'product_sku',
      'barcode_scanned',
      'operation_type',
      'quantity',
      'quantity_before',
      'quantity_after',
      'user_id',
      'user_role',
      'reason_code',
      'reference_id',
      'occurred_at_utc',
      'location',
      'transaction_link',
    ];

    const lines = [header.map(toCsvCell).join(',')];
    for (const row of toExportRows(items)) {
      lines.push(row.map(toCsvCell).join(','));
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },

  // AUD-004
  exportAuditLogPdf(title: string, items: InventoryAuditLogEntry[]) {
    exportPdfPrint(title, [
      {
        title,
        columns: [
          { label: 'Movement ID' },
          { label: 'SKU' },
          { label: 'Barcode' },
          { label: 'Operation' },
          { label: 'Qty' },
          { label: 'Before' },
          { label: 'After' },
          { label: 'User ID' },
          { label: 'Role' },
          { label: 'Reason' },
          { label: 'Reference' },
          { label: 'Occurred (UTC)' },
          { label: 'Location' },
          { label: 'POS Link' },
        ],
        rows: toExportRows(items),
      },
    ]);
  },
};
