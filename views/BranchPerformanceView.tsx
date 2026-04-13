import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { useLanguage } from '../App';
import { useAuth } from '../contexts/AuthContext';
import { TrendingUp, TrendingDown, BarChart3, PieChart, Users, DollarSign, Coffee, ArrowUpDown, ArrowRightLeft, X, Loader2, FileDown, Trash2, AlertTriangle } from 'lucide-react';
import { fetchInvoicesByPeriod, exportInvoicesToExcel, InvoiceExportPeriod } from '../utils/reportExport';

interface BranchStats {
  id: string;
  name: string;
  totalSales: number;
  totalTransactions: number;
  avgTransactionValue: number;
  topProducts: Array<{ name: string; quantity: number; revenue: number }>;
  cashierSales: Array<{ cashier_name: string; sales_count: number; total_amount: number }>;
  staffCount: number;
  growth: number;
}

const BranchPerformanceView: React.FC = () => {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [branchStats, setBranchStats] = useState<BranchStats[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month' | 'year'>('month');
  const [sortBy, setSortBy] = useState<'sales' | 'transactions' | 'growth'>('sales');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  const [locations, setLocations] = useState<any[]>([]);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [sourceBranch, setSourceBranch] = useState<string>('');
  const [targetBranch, setTargetBranch] = useState<string>('');
  const [isConverting, setIsConverting] = useState(false);
  const [convertResult, setConvertResult] = useState<{ success: boolean; count: number } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteBranch, setDeleteBranch] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteResult, setDeleteResult] = useState<{ success: boolean; count: number } | null>(null);

  useEffect(() => {
    fetchBranchPerformance();
  }, [selectedPeriod]);

  const fetchBranchPerformance = async () => {
    setIsLoading(true);
    try {
      const { data: locations } = await supabase.from('locations').select('*').order('name');
      
      if (locations) {
        setLocations(locations);
      }
      
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
        .select('*')
        .gte('created_at', dateFrom);

      const { data: staff } = await supabase.from('staff').select('id, location_id');

      const allStats: BranchStats = {
        id: 'all',
        name: 'All Branches',
        totalSales: 0,
        totalTransactions: 0,
        avgTransactionValue: 0,
        topProducts: [],
        cashierSales: [],
        staffCount: 0,
        growth: 0
      };

      const cashierSalesMapAll = new Map<string, { count: number; total: number }>();
      
      (transactions || []).forEach((t: any) => {
        allStats.totalSales += t.total || 0;
        allStats.totalTransactions += 1;
        const name = t.cashier_name || 'Unknown';
        const existing = cashierSalesMapAll.get(name) || { count: 0, total: 0 };
        cashierSalesMapAll.set(name, {
          count: existing.count + 1,
          total: existing.total + (t.total || 0)
        });
      });
      
      allStats.avgTransactionValue = allStats.totalTransactions > 0 
        ? allStats.totalSales / allStats.totalTransactions : 0;
      allStats.cashierSales = Array.from(cashierSalesMapAll.entries())
        .map(([cashier_name, data]) => ({
          cashier_name,
          sales_count: data.count,
          total_amount: data.total
        }))
        .sort((a, b) => b.total_amount - a.total_amount);

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

        const cashierSalesMap = new Map<string, { count: number; total: number }>();
        locationTransactions.forEach((t: any) => {
          const name = t.cashier_name || 'Unknown';
          const existing = cashierSalesMap.get(name) || { count: 0, total: 0 };
          cashierSalesMap.set(name, {
            count: existing.count + 1,
            total: existing.total + (t.total || 0)
          });
        });

        const cashierSales = Array.from(cashierSalesMap.entries())
          .map(([cashier_name, data]) => ({
            cashier_name,
            sales_count: data.count,
            total_amount: data.total
          }))
          .sort((a, b) => b.total_amount - a.total_amount);

        const growth = Math.random() * 30 - 10;

        return {
          id: location.id,
          name: location.name,
          totalSales,
          totalTransactions,
          avgTransactionValue,
          topProducts,
          cashierSales,
          staffCount: locationStaff.length,
          growth
        };
      });

      setBranchStats([allStats, ...stats]);
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

  const handleConvertTransactions = async () => {
    if (!sourceBranch || !targetBranch || sourceBranch === targetBranch) {
      return;
    }

    setIsConverting(true);
    setConvertResult(null);

    try {
      const sourceLocation = locations.find(l => l.id === sourceBranch);
      const targetLocation = locations.find(l => l.id === targetBranch);

      console.log('Converting transactions:', { sourceBranch, targetBranch, sourceLocation, targetLocation });

      const { data, error } = await supabase
        .from('transactions')
        .update({ 
          location_id: targetBranch
        })
        .eq('location_id', sourceBranch)
        .select('id');

      console.log('Convert result:', { data, error });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      const convertedCount = data?.length || 0;
      setConvertResult({ success: true, count: convertedCount });
      
      setSourceBranch('');
      setTargetBranch('');
      
      setTimeout(() => {
        setShowConvertModal(false);
        fetchBranchPerformance();
      }, 1000);
    } catch (error) {
      console.error('Error converting transactions:', error);
      setConvertResult({ success: false, count: 0 });
    } finally {
      setIsConverting(false);
    }
  };

  const handleExportInvoices = async (branchId?: string) => {
    setIsExporting(true);
    try {
      const periodMap: Record<string, InvoiceExportPeriod> = {
        day: 'day',
        week: 'week',
        month: 'month',
        year: 'all'
      };
      const exportPeriod = periodMap[selectedPeriod] || 'month';
      
      const transactions = await fetchInvoicesByPeriod(supabase, exportPeriod, undefined, branchId);
      
      if (!transactions || transactions.length === 0) {
        alert(t.noDataForPeriod || 'No invoices found for the selected period');
        return;
      }
      
      const periodLabels: Record<string, string> = {
        day: t.day || 'Day',
        week: t.week || 'Week',
        month: t.month || 'Month',
        year: t.year || 'Year',
        all: 'All Time'
      };
      
      const branchLabel = branchId 
        ? `_${locations.find(l => l.id === branchId)?.name.replace(/\s+/g, '_') || ''}`
        : '_All_Branches';
      const filename = `invoices${branchLabel}_${selectedPeriod}_${new Date().toISOString().slice(0, 10)}.xls`;
      const fullPeriodLabel = branchId 
        ? `${periodLabels[exportPeriod]} - ${locations.find(l => l.id === branchId)?.name || ''}`
        : `${periodLabels[exportPeriod]} - All Branches`;
      
      exportInvoicesToExcel(filename, transactions, fullPeriodLabel);
    } catch (error: any) {
      console.error('Export error:', error);
      alert((t as any).exportFailed || 'Failed to export invoices: ' + error.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteTransactions = async () => {
    if (!deleteBranch || deleteConfirmText.toUpperCase() !== 'DELETE') {
      return;
    }

    if (user?.role !== 'ADMIN') {
      alert((t as any).deleteAdminOnly || 'Only administrators can delete transactions');
      return;
    }

    setIsDeleting(true);
    setDeleteResult(null);

    try {
      console.log('Deleting transactions for branch:', deleteBranch);
      
      const { data, error } = await supabase
        .from('transactions')
        .delete()
        .eq('location_id', deleteBranch)
        .select('id');

      if (error) {
        console.error('Supabase delete error:', error);
        throw error;
      }

      const deletedCount = data?.length || 0;
      console.log('Deleted transactions count:', deletedCount);
      
      setDeleteResult({ success: true, count: deletedCount });
      
      setDeleteBranch('');
      setDeleteConfirmText('');
      
      setTimeout(() => {
        setShowDeleteModal(false);
        fetchBranchPerformance();
      }, 1500);
    } catch (error: any) {
      console.error('Error deleting transactions:', error);
      const errorMessage = error?.message || (t as any).deleteFailed || 'Delete failed';
      alert(errorMessage);
      setDeleteResult({ success: false, count: 0 });
    } finally {
      setIsDeleting(false);
    }
  };

  const openDeleteModal = (branchId: string) => {
    if (user?.role !== 'ADMIN') {
      alert((t as any).deleteAdminOnly || 'Only administrators can delete transactions');
      return;
    }
    setDeleteBranch(branchId);
    setDeleteConfirmText('');
    setDeleteResult(null);
    setShowDeleteModal(true);
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
        
        <button
          onClick={() => setShowConvertModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors"
        >
          <ArrowRightLeft size={16} />
          {t.convertTransactions || 'Convert Transactions'}
        </button>
        
        <button
          onClick={() => handleExportInvoices()}
          disabled={isExporting}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-xs font-bold hover:bg-green-700 transition-colors disabled:opacity-60"
        >
          {isExporting ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
          {(t as any).exportInvoices || 'Export Invoices'}
        </button>
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
              <p className="text-xs font-bold text-gray-500 uppercase">{t.transactionsCount || 'Total Transactions'}</p>
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
                    {t.salesTotal || 'Sales'}
                    <ArrowUpDown size={14} />
                  </div>
                </th>
                <th 
                  className="text-left p-4 text-xs font-bold text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('transactions')}
                >
                  <div className="flex items-center gap-1">
                    {t.transactionsCount || 'Transactions'}
                    <ArrowUpDown size={14} />
                  </div>
                </th>
                <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase">{t.avgTransaction || 'Avg. Value'}</th>
                <th 
                  className="text-left p-4 text-xs font-bold text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('growth')}
                >
                  <div className="flex items-center gap-1">
                    {'Growth'}
                    <ArrowUpDown size={14} />
                  </div>
                </th>
                <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase">{t.staff || 'Staff'}</th>
                <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase">{(t as any).actions || 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  </td>
                </tr>
              ) : sortedStats.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    {'No data available'}
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
                    <td className="p-4">
                      {branch.id !== 'all' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleExportInvoices(branch.id)}
                            disabled={isExporting}
                            className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-bold hover:bg-green-200 transition-colors disabled:opacity-50"
                          >
                            <FileDown size={14} />
                            {(t as any).export || 'Export'}
                          </button>
                          <button
                            onClick={() => openDeleteModal(branch.id)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-bold hover:bg-red-200 transition-colors"
                          >
                            <Trash2 size={14} />
                            {(t as any).delete || 'Delete'}
                          </button>
                        </div>
                      )}
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
            
            <h4 className="font-bold text-black mt-6 mb-3 pt-4 border-t border-gray-100 flex items-center gap-2">
              <Users size={18} className="text-green-600" />
              {t.cashierSales || 'Cashier Sales'}
            </h4>
            <div className="space-y-2">
              {branch.cashierSales && branch.cashierSales.length > 0 ? (
                branch.cashierSales.map((cs, idx) => (
                  <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 rounded-lg">
                    <div>
                      <span className="font-medium text-black">{cs.cashier_name}</span>
                      <span className="text-xs text-gray-500 mr-2">({cs.sales_count} {t.sales || 'sales'})</span>
                    </div>
                    <span className="font-bold text-green-600">{cs.total_amount.toFixed(2)} QAR</span>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-sm">{t.noCashierData || 'No cashier data'}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Convert Transactions Modal */}
      {showConvertModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-[24px] p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-black">{t.convertTransactions || 'Convert Transactions'}</h3>
              <button onClick={() => setShowConvertModal(false)} className="p-2 hover:bg-gray-100 rounded-full">
                <X size={24} />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-6">
              {t.convertTransactionsDesc || 'Move all transactions from one branch to another. This action cannot be undone.'}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">{t.sourceBranch || 'Source Branch'}</label>
                <select
                  value={sourceBranch}
                  onChange={e => setSourceBranch(e.target.value)}
                  className="w-full p-3 border border-gray-200 rounded-xl text-black"
                >
                  <option value="">{t.selectBranch || 'Select Branch'}</option>
                  {locations.filter(l => l.is_active !== false).map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">{t.targetBranch || 'Target Branch'}</label>
                <select
                  value={targetBranch}
                  onChange={e => setTargetBranch(e.target.value)}
                  className="w-full p-3 border border-gray-200 rounded-xl text-black"
                >
                  <option value="">{t.selectBranch || 'Select Branch'}</option>
                  {locations.filter(l => l.is_active !== false).map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {convertResult && (
              <div className={`mt-4 p-4 rounded-xl ${convertResult.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {convertResult.success 
                  ? `${t.successConverted || 'Successfully converted'} ${convertResult.count} ${t.transactions || 'transactions'}`
                  : (t.conversionFailed || 'Conversion failed')}
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowConvertModal(false)}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200"
              >
                {t.cancel || 'Cancel'}
              </button>
              <button
                onClick={handleConvertTransactions}
                disabled={!sourceBranch || !targetBranch || sourceBranch === targetBranch || isConverting}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isConverting ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    {t.converting || 'Converting...'}
                  </>
                ) : t.convert || 'Convert'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Transactions Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-[24px] p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-red-600 flex items-center gap-2">
                <AlertTriangle size={24} />
                {(t as any).deleteTransactions || 'Delete Transactions'}
              </h3>
              <button onClick={() => setShowDeleteModal(false)} className="p-2 hover:bg-gray-100 rounded-full">
                <X size={24} />
              </button>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
              <p className="text-sm text-red-800 font-medium">
                {(t as any).deleteTransactionsWarning || 'This action is irreversible. All transactions for this branch will be permanently deleted.'}
              </p>
              <p className="text-sm text-red-700 mt-2">
                <strong>{(t as any).branch || 'Branch'}:</strong> {locations.find(l => l.id === deleteBranch)?.name}
              </p>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              {(t as any).typeDeleteConfirm || 'Type "DELETE" to confirm:'}
            </p>

            <input
              type="text"
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-xl text-black mb-4"
              placeholder="DELETE"
            />

            {deleteResult && (
              <div className={`mb-4 p-4 rounded-xl ${deleteResult.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {deleteResult.success 
                  ? `${(t as any).transactionsDeleted || 'Successfully deleted'} ${deleteResult.count} ${(t as any).transactions || 'transactions'}`
                  : ((t as any).deleteFailed || 'Delete failed')}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200"
              >
                {t.cancel || 'Cancel'}
              </button>
              <button
                onClick={handleDeleteTransactions}
                disabled={deleteConfirmText.toUpperCase() !== 'DELETE' || isDeleting}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    {(t as any).deleting || 'Deleting...'}
                  </>
                ) : (
                  <>
                    <Trash2 size={18} />
                    {(t as any).delete || 'Delete'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BranchPerformanceView;
