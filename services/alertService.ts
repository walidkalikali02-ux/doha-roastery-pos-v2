import { supabase } from '../supabaseClient';

export type AlertType = 'LOW_STOCK' | 'OUT_OF_STOCK';
export type AlertStatus = 'ACTIVE' | 'DISMISSED' | 'RESOLVED';

export interface StockAlert {
  id: string;
  inventory_item_id: string;
  product_id: string;
  location_id: string;
  alert_type: AlertType;
  status: AlertStatus;
  threshold_qty: number;
  current_qty: number;
  last_trigger_stock?: number | null;
  last_triggered_at?: string | null;
  dismissed_at?: string | null;
  dismissed_by?: string | null;
  dismissed_note?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  product_name?: string;
  product_sku?: string | null;
}

const toAlertType = (qty: number, threshold: number): AlertType | null => {
  if (qty <= 0) return 'OUT_OF_STOCK';
  if (qty <= threshold) return 'LOW_STOCK';
  return null;
};

const toNumber = (value: unknown, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const upsertAlert = async (payload: {
  inventory_item_id: string;
  product_id: string;
  location_id: string;
  alert_type: AlertType;
  threshold_qty: number;
  current_qty: number;
}) => {
  const { data: existing, error: readError } = await supabase
    .from('inventory_alerts')
    .select('*')
    .eq('inventory_item_id', payload.inventory_item_id)
    .eq('alert_type', payload.alert_type)
    .maybeSingle();
  if (readError) throw readError;

  const now = new Date().toISOString();
  if (!existing) {
    const { data, error } = await supabase
      .from('inventory_alerts')
      .insert({
        ...payload,
        status: 'ACTIVE',
        last_trigger_stock: payload.current_qty,
        last_triggered_at: now,
        created_at: now,
        updated_at: now,
      })
      .select('*')
      .single();
    if (error) throw error;
    return data as StockAlert;
  }

  const wasDismissed = existing.status === 'DISMISSED';
  const shouldReinstate = wasDismissed && toNumber(existing.last_trigger_stock, Number.MAX_SAFE_INTEGER) > payload.current_qty;
  const nextStatus: AlertStatus = shouldReinstate ? 'ACTIVE' : (existing.status as AlertStatus);

  const { data, error } = await supabase
    .from('inventory_alerts')
    .update({
      product_id: payload.product_id,
      location_id: payload.location_id,
      threshold_qty: payload.threshold_qty,
      current_qty: payload.current_qty,
      status: nextStatus,
      dismissed_at: shouldReinstate ? null : existing.dismissed_at,
      dismissed_by: shouldReinstate ? null : existing.dismissed_by,
      dismissed_note: shouldReinstate ? null : existing.dismissed_note,
      last_trigger_stock: payload.current_qty,
      last_triggered_at: now,
      updated_at: now,
    })
    .eq('id', existing.id)
    .select('*')
    .single();
  if (error) throw error;
  return data as StockAlert;
};

const resolveAlertsForItem = async (inventoryItemId: string) => {
  const { error } = await supabase
    .from('inventory_alerts')
    .update({ status: 'RESOLVED', updated_at: new Date().toISOString() })
    .eq('inventory_item_id', inventoryItemId)
    .in('status', ['ACTIVE', 'DISMISSED']);
  if (error) throw error;
};

const triggerP0Notifications = async (alerts: StockAlert[]) => {
  if (!alerts.length) return;

  const { data: targets, error: targetError } = await supabase
    .from('alert_notification_targets')
    .select('*')
    .eq('is_active', true)
    .eq('severity', 'P0');
  if (targetError) throw targetError;
  if (!targets?.length) return;

  const payload = {
    type: 'P0_STOCK_ALERT',
    alerts: alerts.map((a) => ({
      id: a.id,
      product_id: a.product_id,
      inventory_item_id: a.inventory_item_id,
      location_id: a.location_id,
      alert_type: a.alert_type,
      threshold_qty: a.threshold_qty,
      current_qty: a.current_qty,
    })),
    triggered_at: new Date().toISOString(),
  };

  for (const target of targets) {
    if (target.channel === 'WEBHOOK' && target.target) {
      try {
        await fetch(target.target, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch (error) {
        console.warn('Webhook notification failed', error);
      }
    } else if (target.channel === 'EMAIL') {
      await supabase.from('alert_notification_logs').insert({
        target_id: target.id,
        channel: 'EMAIL',
        payload,
        status: 'QUEUED',
      });
    }
  }
};

export const alertService = {
  // ALT-001 + ALT-002 + ALT-005 + ALT-006
  async evaluateAlertsAfterMovement(input: { locationId: string; inventoryItemIds: string[] }) {
    const itemIds = Array.from(new Set(input.inventoryItemIds.filter(Boolean)));
    if (!itemIds.length) return [];

    const { data, error } = await supabase
      .from('inventory_items')
      .select(
        'id,location_id,stock,minimum_stock,product_id,product_definitions!inner(id,name,sku,reorder_point)'
      )
      .eq('location_id', input.locationId)
      .in('id', itemIds);
    if (error) throw error;

    const triggered: StockAlert[] = [];
    for (const row of data || []) {
      const product = Array.isArray((row as any).product_definitions)
        ? (row as any).product_definitions[0]
        : (row as any).product_definitions;
      const stock = toNumber((row as any).stock, 0);
      const threshold = toNumber((row as any).minimum_stock ?? product?.reorder_point, 0);
      const type = toAlertType(stock, threshold);

      if (!type) {
        await resolveAlertsForItem((row as any).id);
        continue;
      }

      const alert = await upsertAlert({
        inventory_item_id: (row as any).id,
        product_id: (row as any).product_id,
        location_id: (row as any).location_id,
        alert_type: type,
        threshold_qty: threshold,
        current_qty: stock,
      });
      alert.product_name = product?.name || '';
      alert.product_sku = product?.sku || null;
      triggered.push(alert);
    }

    await triggerP0Notifications(
      triggered.filter((a) => a.alert_type === 'LOW_STOCK' || a.alert_type === 'OUT_OF_STOCK')
    );
    return triggered;
  },

  // ALT-003
  async getDashboardAlerts() {
    const { data, error } = await supabase
      .from('inventory_alerts')
      .select(
        'id,inventory_item_id,product_id,location_id,alert_type,status,threshold_qty,current_qty,updated_at,product_definitions(name,sku)'
      )
      .eq('status', 'ACTIVE')
      .in('alert_type', ['LOW_STOCK', 'OUT_OF_STOCK'])
      .order('updated_at', { ascending: false });
    if (error) throw error;

    return (data || []).map((row: any) => ({
      id: row.id,
      inventory_item_id: row.inventory_item_id,
      product_id: row.product_id,
      location_id: row.location_id,
      alert_type: row.alert_type,
      status: row.status,
      threshold_qty: toNumber(row.threshold_qty, 0),
      current_qty: toNumber(row.current_qty, 0),
      product_name: row.product_definitions?.name || 'Unknown Product',
      product_sku: row.product_definitions?.sku || null,
      product_link: `/configuration?productId=${row.product_id}`,
    }));
  },

  // ALT-004
  async setProductThreshold(productId: string, minimumThreshold: number) {
    if (!Number.isFinite(minimumThreshold) || minimumThreshold < 0) {
      throw new Error('minimumThreshold must be a non-negative number');
    }

    const now = new Date().toISOString();
    const { error: productError } = await supabase
      .from('product_definitions')
      .update({ reorder_point: minimumThreshold, updated_at: now })
      .eq('id', productId);
    if (productError) throw productError;

    const { error: itemError } = await supabase
      .from('inventory_items')
      .update({ minimum_stock: minimumThreshold, updated_at: now })
      .eq('product_id', productId);
    if (itemError) throw itemError;

    const { data: itemRows, error: readError } = await supabase
      .from('inventory_items')
      .select('id,location_id')
      .eq('product_id', productId);
    if (readError) throw readError;

    const byLocation = new Map<string, string[]>();
    for (const row of itemRows || []) {
      if (!row.location_id) continue;
      if (!byLocation.has(row.location_id)) byLocation.set(row.location_id, []);
      byLocation.get(row.location_id)?.push(row.id);
    }

    for (const [locationId, ids] of byLocation.entries()) {
      await this.evaluateAlertsAfterMovement({ locationId, inventoryItemIds: ids });
    }

    return { success: true };
  },

  // ALT-005
  async dismissAlert(input: { alertId: string; managerId: string; note?: string }) {
    const { data, error } = await supabase
      .from('inventory_alerts')
      .update({
        status: 'DISMISSED',
        dismissed_by: input.managerId,
        dismissed_note: input.note || null,
        dismissed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.alertId)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  // ALT-006
  async saveNotificationTarget(input: {
    channel: 'EMAIL' | 'WEBHOOK';
    target: string;
    severity?: 'P0' | 'P1' | 'P2';
    isActive?: boolean;
  }) {
    if (!input.target?.trim()) throw new Error('target is required');
    const payload = {
      channel: input.channel,
      target: input.target.trim(),
      severity: input.severity || 'P0',
      is_active: input.isActive ?? true,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('alert_notification_targets')
      .upsert(payload, { onConflict: 'channel,target' })
      .select('*');
    if (error) throw error;
    return data;
  },
};
