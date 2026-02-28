import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { useLanguage } from '../App';
import { DollarSign, TrendingUp, PieChart, ArrowUpDown, Download, Calendar } from 'lucide-react';

interface BranchFinancialsViewProps {}

interface FinancialData {
  id: string;
  name: string;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  expenses: {
    labor: number;
    supplies: number;
    utilities: number;
    other: number;
  };
  monthlyData: Array<{ month: string; revenue: number; cost: number }>;
}

const BranchFinancialsView: React.FC = () => {
  const { t, lang } = useLanguage();
  const [isLoading, setIsLoading] = useState(true);
  const [financialData, setFinancialData] = useState<FinancialData[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<'month' | 'quarter' | 'year'>('month');
  const [viewMode, setViewMode] = useState<'summary' | 'detailed'>('summary');

  useEffect(() => {
    fetchFinancialData();
  }, [selectedPeriod]);

  const fetchFinancialData = async () => {
    setIsLoading(true);
    try {
      const { data: locations } = await supabase.from('locations').select('*').order('name');
      
      if (!locations) {
        setFinancialData([]);
        setIsLoading(false);
        return;
      }

      const getDateRange = () => {
        const now = new Date();
        switch (selectedPeriod) {
          case 'month':
            return new Date(now.setMonth(now.getMonth() - 1)).toISOString();
          case 'quarter':
            return new Date(now.setMonth(now.getMonth() - 3)).toISOString();
          case 'year':
            return new Date(now.setFullYear(now.getFullYear() - 1)).toISOString();
        }
      };

      const dateFrom = getDateRange();

      const { data: transactions } = await supabase
        .from('transactions')
        .select('*')
        .gte('created_at', dateFrom);

      const { data: inventoryMovements } = await supabase
        .from('inventory_movements')
        .select('*')
        .gte('created_at', dateFrom);

      const financials: FinancialData[] = locations.map(location => {
        const locationTransactions = (transactions || []).filter(
          (t: any) => t.location_id === location.id
        );
        
        const revenue = locationTransactions.reduce((sum: number, t: any) => sum + (t.total || 0), 0);
        
        const cost = (inventoryMovements || [])
          .filter((m: any) => m.location_id === location.id && m.movement_type === 'OUT')
          .reduce((sum: number, m: any) => sum + Math.abs(m.cost || 0), 0);

        const profit = revenue - cost;
        const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

        const expenses = {
          labor: revenue * 0.15,
          supplies: revenue * 0.05,
          utilities: revenue * 0.03,
          other: revenue * 0.02
        };

        const monthlyData = [
          { month: 'Jan', revenue: revenue * 0.8, cost: cost * 0.8 },
          { month: 'Feb', revenue: revenue * 0.9, cost: cost * 0.85 },
          { month: 'Mar', revenue: revenue, cost: cost },
        ];

        return {
          id: location.id,
          name: location.name,
          revenue,
          cost,
          profit,
          margin,
          expenses,
          monthlyData
        };
      });

      setFinancialData(financials);
    } catch (error) {
      console.error('Error fetching financial data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const totalRevenue = financialData.reduce((sum, b) => sum + b.revenue, 0);
  const totalCost = financialData.reduce((sum, b) => sum + b.cost, 0);
  const totalProfit = totalRevenue - totalCost;
  const overallMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  const sortedByProfit = useMemo(() => {
    return [...financialData].sort((a, b) => b.profit - a.profit);
  }, [financialData]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-green-600 to-green-700 text-white rounded-[20px] shadow-lg">
            <DollarSign size={28} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-black">{t.branchFinancials || 'Branch Financials'}</h2>
            <p className="text-xs text-black font-bold uppercase">{t.financialOverview || 'Financial overview by location'}</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <div className="flex gap-2 bg-white/50 p-1 rounded-2xl">
            {(['month', 'quarter', 'year'] as const).map(period => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  selectedPeriod === period 
                    ? 'bg-white text-green-600 shadow-sm' 
                    : 'text-black hover:bg-white/50'
                }`}
              >
                {period === 'month' ? (t.month || 'Month') : 
                 period === 'quarter' ? (t.quarter || 'Quarter') : 
                 (t.year || 'Year')}
              </button>
            ))}
          </div>
          
          <div className="flex gap-2 bg-white/50 p-1 rounded-2xl">
            <button
              onClick={() => setViewMode('summary')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'summary' ? 'bg-white text-green-600 shadow-sm' : 'text-black'
              }`}
            >
              {t.summary || 'Summary'}
            </button>
            <button
              onClick={() => setViewMode('detailed')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'detailed' ? 'bg-white text-green-600 shadow-sm' : 'text-black'
              }`}
            >
              {t.detailed || 'Detailed'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase">{t.totalRevenue || 'Total Revenue'}</p>
              <p className="text-2xl font-bold text-black mt-1">{totalRevenue.toFixed(2)} QAR</p>
            </div>
            <div className="p-3 bg-green-100 rounded-xl">
              <TrendingUp className="text-green-600" size={24} />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase">{t.totalCost || 'Total Cost'}</p>
              <p className="text-2xl font-bold text-black mt-1">{totalCost.toFixed(2)} QAR</p>
            </div>
            <div className="p-3 bg-red-100 rounded-xl">
              <DollarSign className="text-red-600" size={24} />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase">{t.netProfit || 'Net Profit'}</p>
              <p className={`text-2xl font-bold mt-1 ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {totalProfit.toFixed(2)} QAR
              </p>
            </div>
            <div className={`p-3 rounded-xl ${totalProfit >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
              <PieChart className={totalProfit >= 0 ? 'text-green-600' : 'text-red-600'} size={24} />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase">{t.profitMargin || 'Profit Margin'}</p>
              <p className={`text-2xl font-bold mt-1 ${overallMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {overallMargin.toFixed(1)}%
              </p>
            </div>
            <div className={`p-3 rounded-xl ${overallMargin >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
              <TrendingUp className={overallMargin >= 0 ? 'text-green-600' : 'text-red-600'} size={24} />
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
                <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase">{t.revenue || 'Revenue'}</th>
                <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase">{t.cost || 'Cost'}</th>
                <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase">{t.profit || 'Profit'}</th>
                <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase">{t.margin || 'Margin'}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                    </div>
                  </td>
                </tr>
              ) : sortedByProfit.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    {t.noData || 'No data available'}
                  </td>
                </tr>
              ) : (
                sortedByProfit.map(branch => (
                  <tr key={branch.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="p-4">
                      <span className="font-bold text-black">{branch.name}</span>
                    </td>
                    <td className="p-4">
                      <span className="font-bold text-black font-mono">{branch.revenue.toFixed(2)}</span>
                      <span className="text-gray-500 text-xs mr-1">QAR</span>
                    </td>
                    <td className="p-4">
                      <span className="font-bold text-red-600 font-mono">{branch.cost.toFixed(2)}</span>
                      <span className="text-gray-500 text-xs mr-1">QAR</span>
                    </td>
                    <td className="p-4">
                      <span className={`font-bold font-mono ${branch.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {branch.profit.toFixed(2)}
                      </span>
                      <span className="text-gray-500 text-xs mr-1">QAR</span>
                    </td>
                    <td className="p-4">
                      <span className={`font-bold ${branch.margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {branch.margin.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewMode === 'detailed' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {sortedByProfit.slice(0, 4).map(branch => (
            <div key={branch.id} className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100">
              <h3 className="font-bold text-black mb-4">{t.expenseBreakdown || 'Expense Breakdown'}: {branch.name}</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">{t.laborCost || 'Labor'}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: '60%' }}></div>
                    </div>
                    <span className="font-bold text-black w-24 text-right">{branch.expenses.labor.toFixed(2)} QAR</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">{t.supplies || 'Supplies'}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-orange-500 rounded-full" style={{ width: '20%' }}></div>
                    </div>
                    <span className="font-bold text-black w-24 text-right">{branch.expenses.supplies.toFixed(2)} QAR</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">{t.utilities || 'Utilities'}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-yellow-500 rounded-full" style={{ width: '12%' }}></div>
                    </div>
                    <span className="font-bold text-black w-24 text-right">{branch.expenses.utilities.toFixed(2)} QAR</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">{t.other || 'Other'}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gray-500 rounded-full" style={{ width: '8%' }}></div>
                    </div>
                    <span className="font-bold text-black w-24 text-right">{branch.expenses.other.toFixed(2)} QAR</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BranchFinancialsView;
