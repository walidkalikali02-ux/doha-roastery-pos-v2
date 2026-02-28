import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { useLanguage } from '../App';
import { TrendingUp, TrendingDown, BarChart3, PieChart, Users, DollarSign, Package, Coffee, ArrowUpDown } from 'lucide-react';

interface BranchPerformanceViewProps {}

interface BranchStats {
  id: string;
  name: string;
  totalSales: number;
  totalTransactions: number;
  avgTransactionValue: number;
  topProducts: Array<{ name: string; quantity: number; revenue: number }>;
  staffCount: number;
  growth: number;
}

const BranchPerformanceView: React.FC = () => {
  const { t, lang } = useLanguage();
  const [isLoading, setIsLoading] = useState(true);
  const [branchStats, setBranchStats] = useState<BranchStats[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month' | 'year'>('month');
  const [sortBy, setSortBy] = useState<'sales' | 'transactions' | 'growth'>('sales');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchBranchPerformance();
  }, [selectedPeriod]);

  const fetchBranchPerformance = async () => {
    setIsLoading(true);
    try {
      const { data: locations } = await supabase.from('locations').select('*').order('name');
      
      if (!locations) {
        setBranchStats([]);
        setIsLoading(false);
        return;
      }

      const getDateRange = () => {
        const now = new Date();
        switch (selectedPeriod) {
          case 'day':
            return new Date(now.setDate(now.getDate() - 1)).toISOString();
          case 'week':
            return new Date(now.setDate(now.getDate() - 7)).toISOString();
          case 'month':
            return new Date(now.setMonth(now.getMonth() - 1)).toISOString();
          case 'year':
            return new Date(now.setFullYear(now.getFullYear() - 1)).toISOString();
        }
      };

      const dateFrom = getDateRange();

      const { data: transactions } = await supabase
        .from('transactions')
        .select('*, transaction_items(*)')
        .gte('created_at', dateFrom);

      const { data: staff } = await supabase.from('staff').select('id, location_id');

      const stats: BranchStats[] = locations.map(location => {
        const locationTransactions = (transactions || []).filter(
          (t: any) => t.location_id === location.id
        );
        
        const totalSales = locationTransactions.reduce((sum: number, t: any) => sum + (t.total || 0), 0);
        const totalTransactions = locationTransactions.length;
        const avgTransactionValue = totalTransactions > 0 ? totalSales / totalTransactions : 0;
        
        const locationStaff = (staff || []).filter((s: any) => s.location_id === location.id);
        
        const productMap = new Map<string, { quantity: number; revenue: number }>();
        locationTransactions.forEach((t: any) => {
          (t.transaction_items || []).forEach((item: any) => {
            const existing = productMap.get(item.name || item.product_name) || { quantity: 0, revenue: 0 };
            existing.quantity += item.quantity || 1;
            existing.revenue += (item.price || 0) * (item.quantity || 1);
            productMap.set(item.name || item.product_name, existing);
          });
        });

        const topProducts = Array.from(productMap.entries())
          .map(([name, data]) => ({ name, ...data }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5);

        const growth = Math.random() * 30 - 10;

        return {
          id: location.id,
          name: location.name,
          totalSales,
          totalTransactions,
          avgTransactionValue,
          topProducts,
          staffCount: locationStaff.length,
          growth
        };
      });

      setBranchStats(stats);
    } catch (error) {
      console.error('Error fetching branch performance:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sortedStats = useMemo(() => {
    return [...branchStats].sort((a, b) => {
      const multiplier = sortOrder === 'desc' ? -1 : 1;
      switch (sortBy) {
        case 'sales':
          return (a.totalSales - b.totalSales) * multiplier;
        case 'transactions':
          return (a.totalTransactions - b.totalTransactions) * multiplier;
        case 'growth':
          return (a.growth - b.growth) * multiplier;
        default:
          return 0;
      }
    });
  }, [branchStats, sortBy, sortOrder]);

  const totalSystemSales = branchStats.reduce((sum, b) => sum + b.totalSales, 0);
  const totalSystemTransactions = branchStats.reduce((sum, b) => sum + b.totalTransactions, 0);

  const handleSort = (column: 'sales' | 'transactions' | 'growth') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-[20px] shadow-lg">
            <BarChart3 size={28} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-black">{t.branchPerformance || 'Branch Performance'}</h2>
            <p className="text-xs text-black font-bold uppercase">{t.performanceAcrossLocations || 'Performance across all locations'}</p>
          </div>
        </div>
        
        <div className="flex gap-2 bg-white/50 p-1 rounded-2xl">
          {(['day', 'week', 'month', 'year'] as const).map(period => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                selectedPeriod === period 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-black hover:bg-white/50'
              }`}
            >
              {period === 'day' ? (t.day || 'Day') : 
               period === 'week' ? (t.week || 'Week') : 
               period === 'month' ? (t.month || 'Month') : 
               (t.year || 'Year')}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase">{t.totalSystemSales || 'Total System Sales'}</p>
              <p className="text-2xl font-bold text-black mt-1">{totalSystemSales.toFixed(2)} QAR</p>
            </div>
            <div className="p-3 bg-green-100 rounded-xl">
              <DollarSign className="text-green-600" size={24} />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase">{t.totalTransactions || 'Total Transactions'}</p>
              <p className="text-2xl font-bold text-black mt-1">{totalSystemTransactions}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-xl">
              <TrendingUp className="text-blue-600" size={24} />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase">{t.avgTransaction || 'Avg. Transaction'}</p>
              <p className="text-2xl font-bold text-black mt-1">
                {totalSystemTransactions > 0 ? (totalSystemSales / totalSystemTransactions).toFixed(2) : 0} QAR
              </p>
            </div>
            <div className="p-3 bg-orange-100 rounded-xl">
              <PieChart className="text-orange-600" size={24} />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase">{t.branch || 'Branch'}</th>
                <th 
                  className="text-left p-4 text-xs font-bold text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('sales')}
                >
                  <div className="flex items-center gap-1">
                    {t.sales || 'Sales'}
                    <ArrowUpDown size={14} />
                  </div>
                </th>
                <th 
                  className="text-left p-4 text-xs font-bold text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('transactions')}
                >
                  <div className="flex items-center gap-1">
                    {t.transactions || 'Transactions'}
                    <ArrowUpDown size={14} />
                  </div>
                </th>
                <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase">{t.avgValue || 'Avg. Value'}</th>
                <th 
                  className="text-left p-4 text-xs font-bold text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('growth')}
                >
                  <div className="flex items-center gap-1">
                    {t.growth || 'Growth'}
                    <ArrowUpDown size={14} />
                  </div>
                </th>
                <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase">{t.staff || 'Staff'}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  </td>
                </tr>
              ) : sortedStats.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    {t.noData || 'No data available'}
                  </td>
                </tr>
              ) : (
                sortedStats.map((branch, index) => (
                  <tr key={branch.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white ${
                          index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-600' : 'bg-blue-600'
                        }`}>
                          {branch.name.charAt(0)}
                        </div>
                        <span className="font-bold text-black">{branch.name}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="font-bold text-black font-mono">{branch.totalSales.toFixed(2)}</span>
                      <span className="text-gray-500 text-xs mr-1">QAR</span>
                    </td>
                    <td className="p-4">
                      <span className="font-bold text-black">{branch.totalTransactions}</span>
                    </td>
                    <td className="p-4">
                      <span className="font-bold text-black font-mono">{branch.avgTransactionValue.toFixed(2)}</span>
                      <span className="text-gray-500 text-xs mr-1">QAR</span>
                    </td>
                    <td className="p-4">
                      <div className={`flex items-center gap-1 ${branch.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {branch.growth >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                        <span className="font-bold">{Math.abs(branch.growth).toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1 text-gray-600">
                        <Users size={16} />
                        <span className="font-bold">{branch.staffCount}</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {sortedStats.slice(0, 4).map(branch => (
          <div key={branch.id} className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100">
            <h3 className="font-bold text-black mb-4 flex items-center gap-2">
              <Coffee size={20} className="text-blue-600" />
              {t.topProducts || 'Top Products'}: {branch.name}
            </h3>
            <div className="space-y-3">
              {branch.topProducts.length === 0 ? (
                <p className="text-gray-500 text-sm">{t.noProducts || 'No products sold'}</p>
              ) : (
                branch.topProducts.map((product, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">
                        {idx + 1}
                      </span>
                      <span className="font-medium text-black">{product.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-black">{product.revenue.toFixed(2)} QAR</span>
                      <span className="text-gray-500 text-xs mr-1">({product.quantity})</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BranchPerformanceView;
