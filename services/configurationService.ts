import { supabase } from '../supabaseClient';

export type BarcodeFormat = 'CODE128' | 'EAN13';

const toNumber = (value: unknown, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export const configurationService = {
  // CFG-001
  async getBarcodeFormat(): Promise<BarcodeFormat> {
    const { data, error } = await supabase
      .from('system_settings')
      .select('default_barcode_format')
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    const value = String((data as any)?.default_barcode_format || 'CODE128').toUpperCase();
    return value === 'EAN13' ? 'EAN13' : 'CODE128';
  },

  async setBarcodeFormat(format: BarcodeFormat) {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('system_settings')
      .upsert({ id: 'default', default_barcode_format: format, updated_at: now })
      .select('*');
    if (error) throw error;
    return data;
  },

  // CFG-002
  async listReasonCodes(activeOnly = false) {
    let query = supabase
      .from('dispatch_reason_codes')
      .select('*')
      .order('display_name', { ascending: true });
    if (activeOnly) query = query.eq('is_active', true);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async addReasonCode(code: string, displayName: string) {
    const normalized = code.trim().toUpperCase();
    if (!normalized) throw new Error('code is required');
    if (!displayName.trim()) throw new Error('displayName is required');
    const { data, error } = await supabase
      .from('dispatch_reason_codes')
      .insert({
        code: normalized,
        display_name: displayName.trim(),
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async renameReasonCode(id: string, displayName: string) {
    if (!displayName.trim()) throw new Error('displayName is required');
    const { data, error } = await supabase
      .from('dispatch_reason_codes')
      .update({ display_name: displayName.trim(), updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async setReasonCodeActive(id: string, isActive: boolean) {
    const { data, error } = await supabase
      .from('dispatch_reason_codes')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  // CFG-003
  async setProductOverdraft(productId: string, overdraftEnabled: boolean) {
    const { data, error } = await supabase
      .from('product_definitions')
      .update({ overdraft_enabled: overdraftEnabled, updated_at: new Date().toISOString() })
      .eq('id', productId)
      .select('id,name,sku,overdraft_enabled')
      .single();
    if (error) throw error;
    return data;
  },

  // CFG-004
  async listNotificationTargets() {
    const { data, error } = await supabase
      .from('alert_notification_targets')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async upsertNotificationTarget(input: {
    channel: 'EMAIL' | 'WEBHOOK';
    target: string;
    severity?: 'P0' | 'P1' | 'P2' | 'P3';
    isActive?: boolean;
  }) {
    if (!input.target.trim()) throw new Error('target is required');
    const { data, error } = await supabase
      .from('alert_notification_targets')
      .upsert(
        {
          channel: input.channel,
          target: input.target.trim(),
          severity: input.severity || 'P0',
          is_active: input.isActive ?? true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'channel,target' }
      )
      .select('*');
    if (error) throw error;
    return data || [];
  },

  // CFG-005 + CFG-006
  async getRuntimeSettings() {
    const { data, error } = await supabase
      .from('system_settings')
      .select('session_timeout_minutes,adjustment_approval_threshold,default_barcode_format')
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return {
      sessionTimeoutMinutes: Math.min(480, Math.max(5, toNumber((data as any)?.session_timeout_minutes, 30))),
      adjustmentApprovalThreshold: Math.max(0, toNumber((data as any)?.adjustment_approval_threshold, 50)),
      defaultBarcodeFormat:
        String((data as any)?.default_barcode_format || 'CODE128').toUpperCase() === 'EAN13'
          ? 'EAN13'
          : 'CODE128',
    };
  },

  async setSessionTimeoutMinutes(minutes: number) {
    const safe = Math.min(480, Math.max(5, Math.floor(minutes)));
    const { data, error } = await supabase
      .from('system_settings')
      .upsert({ id: 'default', session_timeout_minutes: safe, updated_at: new Date().toISOString() })
      .select('*');
    if (error) throw error;
    return data;
  },

  async setApprovalThreshold(quantity: number) {
    const safe = Math.max(0, toNumber(quantity, 0));
    const { data, error } = await supabase
      .from('system_settings')
      .upsert({ id: 'default', adjustment_approval_threshold: safe, updated_at: new Date().toISOString() })
      .select('*');
    if (error) throw error;
    return data;
  },
};
