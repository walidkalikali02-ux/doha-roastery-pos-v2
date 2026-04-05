import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useLanguage } from '../App';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';
import { Users, Search, Plus, Phone, Mail, Star, ShoppingCart, TrendingUp, Edit, Trash2, X } from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
  is_active?: boolean;
  created_at?: string;
  created_by?: string;
}

interface CRMViewProps {}

const CRMView: React.FC<CRMViewProps> = () => {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const canDelete = user?.role === UserRole.ADMIN || user?.role === UserRole.MANAGER;
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    phone: string;
    email: string;
    notes: string;
  }>({
    name: '',
    phone: '',
    email: '',
    notes: '',
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const normalizeCustomer = (row: any): Customer => ({
    ...row,
    name: row?.full_name || row?.name || '',
    phone: row?.phone || '',
    email: row?.email || '',
    notes: row?.notes || '',
  });

  const fetchCustomers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCustomers((data || []).map(normalizeCustomer));
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveCustomer = async () => {
    try {
      const customerData = {
        name: formData.name,
        phone: formData.phone,
        email: formData.email || null,
        notes: formData.notes || null,
      };

      if (editingCustomer) {
        const { error } = await supabase
          .from('customers')
          .update(customerData)
          .eq('id', editingCustomer.id);
        
        if (error) {
          console.error('Update error details:', error);
          throw error;
        }
      } else {
        const { error } = await supabase
          .from('customers')
          .insert([customerData]);
        
        if (error) {
          console.error('Insert error details:', error);
          throw error;
        }
      }

      fetchCustomers();
      setShowAddModal(false);
      setEditingCustomer(null);
      setFormData({ name: '', phone: '', email: '', notes: '' });
    } catch (error: any) {
      console.error('Error saving customer:', error?.message || error);
      alert(error?.message || 'Failed to save customer. Check console for details.');
    }
  };

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone || '',
      email: customer.email || '',
      notes: customer.notes || '',
    });
    setShowAddModal(true);
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!confirm(t.confirmDelete || 'Are you sure you want to delete this customer?')) return;
    
    try {
      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (error) throw error;
      fetchCustomers();
    } catch (error) {
      console.error('Error deleting customer:', error);
    }
  };

  const filteredCustomers = customers.filter(customer => {
    const search = (searchQuery || '').toLowerCase();
    const name = (customer.name || '').toLowerCase();
    const phone = (customer.phone || '').toLowerCase();
    const email = (customer.email || '').toLowerCase();
    return (
      name.includes(search) ||
      phone.includes(search) ||
      email.includes(search)
    );
  });

  const totalCustomers = customers.length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-purple-600 to-purple-700 text-white rounded-[20px] shadow-lg">
            <Users size={28} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-black">{t.customers || 'Customers'}</h2>
            <p className="text-xs text-black font-bold uppercase">{t.customerRelationship || 'Customer Relationship Management'}</p>
          </div>
        </div>
        
        <button
          onClick={() => {
            setEditingCustomer(null);
            setFormData({ name: '', phone: '', email: '', notes: '' });
            setShowAddModal(true);
          }}
          className="bg-purple-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg hover:bg-purple-700 transition-all"
        >
          <Plus size={20} />
          {t.addCustomer || 'Add Customer'}
        </button>
      </div>

      <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase">{t.totalCustomers || 'Total Customers'}</p>
            <p className="text-2xl font-bold text-black mt-1">{totalCustomers}</p>
          </div>
          <div className="p-3 bg-purple-100 rounded-xl">
            <Users className="text-purple-600" size={24} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[24px] p-4 shadow-sm border border-gray-100">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder={t.searchCustomers || 'Search customers...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-2xl bg-gray-50 border-none outline-none focus:ring-2 focus:ring-purple-600"
          />
        </div>
      </div>

      <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase">{t.customer || 'Customer'}</th>
                <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase">{t.contact || 'Contact'}</th>
                <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase">{t.actions || 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={3} className="p-8 text-center">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                    </div>
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-gray-500">
                    {t.noCustomers || 'No customers found'}
                  </td>
                </tr>
              ) : (
                filteredCustomers.map(customer => (
                  <tr key={customer.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center font-bold text-purple-600">
                          {(customer.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <span className="font-bold text-black">{customer.name || '-'}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="space-y-1">
                        {customer.phone && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Phone size={14} />
                            {customer.phone}
                          </div>
                        )}
                        {customer.email && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Mail size={14} />
                            {customer.email}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditCustomer(customer)}
                          className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200"
                        >
                          <Edit size={16} />
                        </button>
                        {canDelete && (
                          <button
                            onClick={() => handleDeleteCustomer(customer.id)}
                            className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-[32px] max-w-lg w-full p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">
                {editingCustomer ? (t.editCustomer || 'Edit Customer') : (t.addCustomer || 'Add Customer')}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="p-2 rounded-full hover:bg-gray-100">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">{t.name || 'Name'} *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full mt-1 px-4 py-3 rounded-2xl bg-gray-50 border-none outline-none focus:ring-2 focus:ring-purple-600"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">{t.phone || 'Phone'}</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full mt-1 px-4 py-3 rounded-2xl bg-gray-50 border-none outline-none focus:ring-2 focus:ring-purple-600"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">{t.email || 'Email'}</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full mt-1 px-4 py-3 rounded-2xl bg-gray-50 border-none outline-none focus:ring-2 focus:ring-purple-600"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">{t.notes || 'Notes'}</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full mt-1 px-4 py-3 rounded-2xl bg-gray-50 border-none outline-none focus:ring-2 focus:ring-purple-600 h-24 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-4 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-3 rounded-2xl font-bold text-gray-600 hover:bg-gray-100"
              >
                {t.cancel || 'Cancel'}
              </button>
              <button
                onClick={handleSaveCustomer}
                className="flex-1 bg-purple-600 text-white py-3 rounded-2xl font-bold hover:bg-purple-700"
              >
                {t.save || 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CRMView;
