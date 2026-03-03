import { supabase } from '../supabaseClient';

export type PosInventoryEventType = 'SALE_COMPLETED' | 'SALE_REVERSED' | 'ORDER_MODIFIED';

export interface PosInventoryEventLine {
  product_id: string;
  quantity?: number;
  delta_quantity?: number;
  service_type?: 'ALL' | 'DINE_IN' | 'TAKEAWAY';
}

export async function processPosInventoryEvent(input: {
  branchId: string;
  eventType: PosInventoryEventType;
  referenceId: string;
  lines: PosInventoryEventLine[];
  userId?: string | null;
  userName?: string | null;
}) {
  const { error } = await supabase.rpc('process_pos_inventory_event', {
    p_branch_id: input.branchId,
    p_event_type: input.eventType,
    p_reference_id: input.referenceId,
    p_lines: input.lines,
    p_user_id: input.userId || null,
    p_user_name: input.userName || null
  });

  if (error) throw error;
}

export async function refreshInventoryMetrics(branchId?: string) {
  const { error } = await supabase.rpc('refresh_inventory_metrics', {
    p_branch_id: branchId || null
  });

  if (error) throw error;
}

export async function generateAutoReorderDraftPos(branchId?: string, actorId?: string) {
  const { data, error } = await supabase.rpc('generate_auto_reorder_purchase_orders', {
    p_branch_id: branchId || null,
    p_actor_id: actorId || null
  });

  if (error) throw error;
  return Number(data || 0);
}
