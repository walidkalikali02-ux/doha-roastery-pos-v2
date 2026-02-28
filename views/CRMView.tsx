import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useLanguage } from '../App';
import { Users, Search, Plus, Phone, Mail, Star, ShoppingCart, TrendingUp, Edit, Trash2, X } from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  loyalty_points: number;
  total_spent: number;
  visit_count: number;
  last_visit: string;
  created_at: string;
  notes: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
}

interface CRMViewProps {}

const CRMView: React.FC<CRMViewProps> = () => {
  const { t, lang } = useLanguage();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    notes: '',
    tier: 'bronze' as const
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveCustomer = async () => {
    try {
      if (editingCustomer) {
        const { error } = await supabase
          .from('customers')
          .update({
            name: formData.name,
            phone: formData.phone,
            email: formData.email,
            notes: formData.notes,
            tier: formData.tier
          })
          .eq('id', editingCustomer.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('customers')
          .insert([{
            name: formData.name,
            phone: formData.phone,
            email: formData.email,
            notes: formData.notes,
            tier: formData.tier,
            loyalty_points: 0,
            total_spent: 0,
            visit_count: 0
          }]);
        
        if (error) throw error;
      }

      fetchCustomers();
      setShowAddModal(false);
      setEditingCustomer(null);
      setFormData({ name: '', phone: '', email: '', notes: '', tier: 'bronze' });
    } catch (error) {
      console.error('Error saving customer:', error);
    }
  };

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone || '',
      email: customer.email || '',
      notes: customer.notes || '',
      tier: customer.tier || 'bronze'
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
    const search = searchQuery.toLowerCase();
    return (
      customer.name.toLowerCase().includes(search) ||
      customer.phone?.toLowerCase().includes(search) ||
      customer.email?.toLowerCase().includes(search)
    );
  });

  const totalCustomers = customers.length;
  const totalRevenue = customers.reduce((sum, c) => sum + (c.total_spent || 0), 0);
  const avgSpent = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;

  const tierColors = {
    bronze: 'bg-amber-100 text-amber-700',
    silver: 'bg-gray-100 text-gray-700',
    gold: 'bg-yellow-100 text-yellow-700',
    platinum: 'bg-purple-100 text-purple-700'
  };

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
            setFormData({ name: '', phone: '', email: '', notes: '', tier: 'bronze' });
            setShowAddModal(true);
          }}
          className="bg-purple-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg hover:bg-purple-700 transition-all"
        >
          <Plus size={20} />
          {t.addCustomer || 'Add Customer'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
        
        <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase">{t.totalRevenue || 'Total Revenue'}</p>
              <p className="text-2xl font-bold text-black mt-1">{totalRevenue.toFixed(2)} QAR</p>
            </div>
            <div className="p-3 bg-green-100 rounded-xl">
              <ShoppingCart className="text-green-600" size={24} />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase">{t.avgSpent || 'Avg. Spent'}</p>
              <p className="text-2xl font-bold text-black mt-1">{avgSpent.toFixed(2)} QAR</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-xl">
              <TrendingUp className="text-blue-600" size={24} />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase">{t.loyaltyPoints || 'Loyalty Points'}</p>
              <p className="text-2xl font-bold text-black mt-1">
                {customers.reduce((sum, c) => sum + (c.loyalty_points || 0), 0).toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-orange-100 rounded-xl">
              <Star className="text-orange-600" size={24} />
            </div>
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
                <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase">{t.tier || 'Tier'}</th>
                <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase">{t.loyaltyPoints || 'Points'}</th>
                <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase">{t.totalSpent || 'Total Spent'}</th>
                <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase">{t.visits || 'Visits'}</th>
                <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase">{t.lastVisit || 'Last Visit'}</th>
                <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase">{t.actions || 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                    </div>
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">
                    {t.noCustomers || 'No customers found'}
                  </td>
                </tr>
              ) : (
                filteredCustomers.map(customer => (
                  <tr key={customer.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center font-bold text-purple-600">
                          {customer.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-bold text-black">{customer.name}</span>
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
                      <span className={`px-3 py-1 rounded-full text-xs font-bold capitalize ${tierColors[customer.tier || 'bronze']}`}>
                        {customer.tier || 'bronze'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="font-bold text-orange-600">{customer.loyalty_points || 0}</span>
                    </td>
                    <td className="p-4">
                      <span className="font-bold text-black font-mono">{(customer.total_spent || 0).toFixed(2)}</span>
                      <span className="text-gray-500 text-xs mr-1">QAR</span>
                    </td>
                    <td className="p-4">
                      <span className="font-bold text-black">{customer.visit_count || 0}</span>
                    </td>
                    <td className="p-4">
                      <span className="text-sm text-gray-600">
                        {customer.last_visit ? new Date(customer.last_visit).toLocaleDateString() : '-'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditCustomer(customer)}
                          className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteCustomer(customer.id)}
                          className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                        >
                          <Trash2 size={16} />
                        </button>
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
                <label className="text-xs font-bold text-gray-500 uppercase">{t.tier || 'Tier'}</label>
                <select
                  value={formData.tier}
                  onChange={(e) => setFormData({ ...formData, tier: e.target.value as any })}
                  className="w-full mt-1 px-4 py-3 rounded-2xl bg-gray-50 border-none outline-none focus:ring-2 focus:ring-purple-600"
                >
                  <option value="bronze">Bronze</option>
                  <option value="silver">Silver</option>
                  <option value="gold">Gold</option>
                  <option value="platinum">Platinum</option>
                </select>
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
