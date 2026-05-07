
import { supabase } from '../supabaseClient';

export interface InventoryQueryParams {
  searchTerm?: string;
  qualityGrade?: string;
  status?: 'good' | 'low';
  stockThreshold?: number;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
  // Advanced Filter Requirements
  origin?: string;
  supplierFilter?: string;
  isOrganic?: boolean | null;
  harvestDateStart?: string;
  harvestDateEnd?: string;
  purchaseDateStart?: string;
  purchaseDateEnd?: string;
  quantityMin?: number;
  quantityMax?: number;
}

/**
 * Exposes a read-only interface to fetch green bean inventory using Supabase PostgREST parameters.
 * Implements server-side filtering, sorting, and pagination.
 */
export const fetchGreenBeanInventory = async (params: InventoryQueryParams) => {
  const {
    searchTerm = '',
    qualityGrade = 'ALL',
    status = 'ALL',
    stockThreshold = 100,
    sortField = 'purchase_date',
    sortDirection = 'desc',
    page = 1,
    pageSize = 10,
    origin = '',
    supplierFilter = '',
    isOrganic = null,
    harvestDateStart = '',
    harvestDateEnd = '',
    purchaseDateStart = '',
    purchaseDateEnd = '',
    quantityMin = undefined,
    quantityMax = undefined
  } = params;

  let query = supabase
    .from('green_beans')
    .select('*', { count: 'exact' });

  // 1. Search Requirement: Case-insensitive partial match
  if (searchTerm) {
    const searchPattern = `%${searchTerm}%`;
    query = query.or(`bean_name.ilike.${searchPattern},supplier.ilike.${searchPattern},batch_number.ilike.${searchPattern}`);
  }

  // 2. Advanced Filtering
  if (origin) {
    query = query.ilike('origin', `%${origin}%`);
  }
  if (supplierFilter) {
    query = query.ilike('supplier', `%${supplierFilter}%`);
  }
  if (qualityGrade !== 'ALL') {
    query = query.eq('quality_grade', qualityGrade);
  }
  if (isOrganic !== null) {
    query = query.eq('is_organic', isOrganic);
  }
  
  // Harvest Date Range
  if (harvestDateStart) query = query.gte('harvest_date', harvestDateStart);
  if (harvestDateEnd) query = query.lte('harvest_date', harvestDateEnd);

  // Purchase Date Range
  if (purchaseDateStart) query = query.gte('purchase_date', purchaseDateStart);
  if (purchaseDateEnd) query = query.lte('purchase_date', purchaseDateEnd);

  // Quantity Range
  if (quantityMin !== undefined && !isNaN(quantityMin)) {
    query = query.gte('quantity', quantityMin);
  }
  if (quantityMax !== undefined && !isNaN(quantityMax)) {
    query = query.lte('quantity', quantityMax);
  }

  // 3. Derived Status Filter
  if (status === 'low') {
    query = query.lt('quantity', stockThreshold);
  } else if (status === 'good') {
    query = query.gte('quantity', stockThreshold);
  }

  // 4. Sorting
  const dbSortField = sortField === 'purchaseDate' ? 'purchase_date' : 
                     sortField === 'costPerKg' ? 'cost_per_kg' : 
                     sortField === 'qualityGrade' ? 'quality_grade' : 
                     sortField === 'beanName' ? 'bean_name' :
                     sortField === 'batchNumber' ? 'batch_number' :
                     sortField === 'harvestDate' ? 'harvest_date' : sortField;
                     
  query = query.order(dbSortField, { ascending: sortDirection === 'asc' });

  // 5. Pagination
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    console.error('PostgREST retrieval error:', error);
    throw error;
  }

  return {
    data: data || [],
    totalCount: count || 0
  };
};

/**
 * Performs a bulk insert of green bean records into the database.
 */
export const bulkInsertGreenBeans = async (records: any[]) => {
  const { data, error } = await supabase
    .from('green_beans')
    .insert(records)
    .select();
  
  if (error) throw error;
  return data;
};

export type OrderReservationStatus = 'RESERVED' | 'FULFILLED' | 'CANCELLED';

export interface OrderReservationInput {
  inventoryItemId: string;
  locationId?: string;
  quantity: number;
  orderReference?: string;
  status?: OrderReservationStatus;
}

export const createOrderReservation = async (input: OrderReservationInput) => {
  const { data, error } = await supabase
    .from('order_reservations')
    .insert({
      inventory_item_id: input.inventoryItemId,
      location_id: input.locationId || null,
      quantity: input.quantity,
      status: input.status || 'RESERVED',
      order_reference: input.orderReference || null,
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateOrderReservationStatus = async (
  reservationId: string,
  status: OrderReservationStatus
) => {
  const { data, error } = await supabase
    .from('order_reservations')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', reservationId)
    .select()
    .single();

  if (error) throw error;
  return data;
};
