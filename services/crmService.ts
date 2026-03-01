import { supabase } from '../supabaseClient';
import { Customer } from '../types';

export const crmService = {
  async getCustomers(page = 1, limit = 50, searchQuery = ''): Promise<{ data: Customer[]; count: number }> {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('customers')
      .select('*', { count: 'exact' })
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .range(from, to);

    const normalizedSearch = searchQuery.trim();
    if (normalizedSearch) {
      query = query.or(`phone.ilike.%${normalizedSearch}%,full_name.ilike.%${normalizedSearch}%`);
    }

    const { data, count, error } = await query;

    if (error) {
      console.error('Error fetching customers:', error);
      throw error;
    }

    return { data: data as Customer[], count: count || 0 };
  },

  async createCustomer(customerData: Partial<Customer>): Promise<Customer> {
    const { data, error } = await supabase
      .from('customers')
      .insert([{
        full_name: customerData.full_name,
        phone: customerData.phone,
        email: customerData.email,
        notes: customerData.notes,
        created_by: (await supabase.auth.getUser()).data.user?.id
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating customer:', error);
      throw error;
    }

    return data as Customer;
  },

  async updateCustomer(id: string, customerData: Partial<Customer>): Promise<Customer> {
    const { data, error } = await supabase
      .from('customers')
      .update({
        full_name: customerData.full_name,
        phone: customerData.phone,
        email: customerData.email,
        notes: customerData.notes,
        is_active: customerData.is_active
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating customer:', error);
      throw error;
    }

    return data as Customer;
  },

  async deleteCustomer(id: string): Promise<void> {
    const { error } = await supabase
      .from('customers')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      console.error('Error deleting customer:', error);
      throw error;
    }
  },

  async getCustomerByPhone(phone: string): Promise<Customer | null> {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('phone', phone)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('Error fetching customer by phone:', error);
      throw error;
    }

    return data as Customer | null;
  }
};
