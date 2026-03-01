
import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { FileDown, Calendar, DollarSign, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { useLanguage, useTheme } from '../App';
import { supabase } from '../supabaseClient';
import { exportExcelHtml, exportPdfPrint } from '../utils/reportExport';

const COLORS = ['#ea580c', '#57534e', '#a8a29e', '#d6d3d1'];

const ReportsView: React.FC = () => {
  const { t } = useLanguage();
  const { theme } = useTheme();
  
  const [profitabilityRows, setProfitabilityRows] = useState<Array<{ name: string; marginPct: number; trend: 'up' | 'down'; revenue: number; cost: number; profit: number }>>([]);
  const [profitabilityLoading, setProfitabilityLoading] = useState(false);
  const [productionLoading, setProductionLoading] = useState(false);
  const [dailyProduction, setDailyProduction] = useState<any[]>([]);
  const [monthlyProduction, setMonthlyProduction] = useState<any[]>([]);
  const [wasteByProfile, setWasteByProfile] = useState<any[]>([]);
  const [wasteByRoaster, setWasteByRoaster] = useState<any[]>([]);
  const [wasteByBean, setWasteByBean] = useState<any[]>([]);
  const [qcMonthly, setQcMonthly] = useState<any[]>([]);
  const [roasterPerformance, setRoasterPerformance] = useState<any[]>([]);
  const [advancedLoading, setAdvancedLoading] = useState(false);
  const [productionCost, setProductionCost] = useState<any[]>([]);
  const [greenBeanConsumption, setGreenBeanConsumption] = useState<any[]>([]);
  const [recipeConsistency, setRecipeConsistency] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setProfitabilityLoading(true);
      try {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const { data, error } = await supabase
          .from('product_profitability_report')
          .select('product_name,total_revenue,total_cost,gross_profit,period_month')
          .gte('period_month', monthStart.toISOString())
          .lt('period_month', nextMonthStart.toISOString());
        if (error) throw error;

        const anyCostVisible = (data || []).some((row: any) => row.total_cost !== null && row.total_cost !== undefined);
        if (!anyCostVisible) {
          if (!cancelled) setProfitabilityRows([]);
          return;
        }

        const grouped = new Map<string, { revenue: number; cost: number; profit: number }>();
        (data || []).forEach((row: any) => {
          const key = row.product_name || t.unknown;
          const prev = grouped.get(key) || { revenue: 0, cost: 0, profit: 0 };
          const revenue = Number(row.total_revenue || 0);
          const cost = Number(row.total_cost || 0);
          const profit = Number(row.gross_profit || 0);
          grouped.set(key, { revenue: prev.revenue + revenue, cost: prev.cost + cost, profit: prev.profit + profit });
        });

        const rows = Array.from(grouped.entries())
          .map(([name, totals]) => {
            const marginPct = totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0;
            return {
              name,
              marginPct: Math.round(marginPct * 100) / 100,
              trend: marginPct >= 0 ? 'up' as const : 'down' as const,
              revenue: totals.revenue,
              cost: totals.cost,
              profit: totals.profit
            };
          })
          .sort((a, b) => b.marginPct - a.marginPct)
          .slice(0, 8);

        if (!cancelled) setProfitabilityRows(rows);
      } catch {
        if (!cancelled) setProfitabilityRows([]);
      } finally {
        if (!cancelled) setProfitabilityLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [t.unknown]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setProductionLoading(true);
      try {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const since30 = new Date(now);
        since30.setDate(since30.getDate() - 30);
        const since30Key = since30.toISOString().split('T')[0];

        const [
          dailyRes,
          monthlyRes,
          wasteProfileRes,
          wasteRoasterRes,
          wasteBeanRes,
          qcMonthlyRes,
          roasterPerfRes
        ] = await Promise.all([
          supabase.from('daily_production_report').select('*').gte('day', since30Key).order('day', { ascending: false }),
          supabase.from('monthly_production_report').select('*').order('month', { ascending: false }).limit(12),
          supabase.from('waste_by_roast_profile_report').select('*').gte('month', monthStart.toISOString()).lt('month', nextMonthStart.toISOString()).order('waste_percent', { ascending: false }).limit(10),
          supabase.from('waste_by_roaster_report').select('*').gte('month', monthStart.toISOString()).lt('month', nextMonthStart.toISOString()).order('waste_percent', { ascending: false }).limit(10),
          supabase.from('waste_by_bean_report').select('*').gte('month', monthStart.toISOString()).lt('month', nextMonthStart.toISOString()).order('waste_percent', { ascending: false }).limit(10),
          supabase.from('qc_monthly_report').select('*').order('month', { ascending: false }).limit(12),
          supabase.from('roaster_performance_monthly_report').select('*').order('month', { ascending: false }).limit(50)
        ]);

        if (dailyRes.error) throw dailyRes.error;
        if (monthlyRes.error) throw monthlyRes.error;
        if (wasteProfileRes.error) throw wasteProfileRes.error;
        if (wasteRoasterRes.error) throw wasteRoasterRes.error;
        if (wasteBeanRes.error) throw wasteBeanRes.error;
        if (qcMonthlyRes.error) throw qcMonthlyRes.error;
        if (roasterPerfRes.error) throw roasterPerfRes.error;

        if (!cancelled) {
          setDailyProduction(dailyRes.data || []);
          setMonthlyProduction(monthlyRes.data || []);
          setWasteByProfile(wasteProfileRes.data || []);
          setWasteByRoaster(wasteRoasterRes.data || []);
          setWasteByBean(wasteBeanRes.data || []);
          setQcMonthly(qcMonthlyRes.data || []);
          setRoasterPerformance(roasterPerfRes.data || []);
        }
      } catch {
        if (!cancelled) {
          setDailyProduction([]);
          setMonthlyProduction([]);
          setWasteByProfile([]);
          setWasteByRoaster([]);
          setWasteByBean([]);
          setQcMonthly([]);
          setRoasterPerformance([]);
        }
      } finally {
        if (!cancelled) setProductionLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setAdvancedLoading(true);
      try {
        const now = new Date();
        const since30 = new Date(now);
        since30.setDate(since30.getDate() - 30);
        const since30Key = since30.toISOString().split('T')[0];

        const [costRes, consumptionRes, consistencyRes] = await Promise.allSettled([
          supabase.from('production_cost_report').select('*').gte('roast_date', since30Key).order('roast_date', { ascending: false }).limit(50),
          supabase.from('green_bean_consumption_monthly_report').select('*').order('month', { ascending: false }).limit(120),
          supabase.from('roast_profile_consistency_report').select('*').order('month', { ascending: false }).limit(120)
        ]);

        const nextCost = costRes.status === 'fulfilled' && !costRes.value.error ? (costRes.value.data || []) : [];
        const nextConsumption = consumptionRes.status === 'fulfilled' && !consumptionRes.value.error ? (consumptionRes.value.data || []) : [];
        const nextConsistency = consistencyRes.status === 'fulfilled' && !consistencyRes.value.error ? (consistencyRes.value.data || []) : [];

        if (!cancelled) {
          setProductionCost(nextCost);
          setGreenBeanConsumption(nextConsumption);
          setRecipeConsistency(nextConsistency);
        }
      } finally {
        if (!cancelled) setAdvancedLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const pieData = profitabilityRows.slice(0, 4).map(row => ({ name: row.name, value: Math.max(0, Math.round(row.revenue)) }));
  const latestDaily = dailyProduction[0] || null;
  const latestMonthly = monthlyProduction[0] || null;
  const latestQcMonthly = qcMonthly[0] || null;
  const roasterPerfThisMonth = latestMonthly?.month
    ? roasterPerformance.filter((r: any) => String(r.month).startsWith(String(latestMonthly.month).slice(0, 7)))
    : roasterPerformance.slice(0, 10);
  const latestConsumptionMonth = greenBeanConsumption[0]?.month ? String(greenBeanConsumption[0].month).slice(0, 7) : null;
  const consumptionThisMonth = latestConsumptionMonth
    ? greenBeanConsumption.filter((r: any) => String(r.month).startsWith(latestConsumptionMonth))
    : greenBeanConsumption;
  const latestConsistencyMonth = recipeConsistency[0]?.month ? String(recipeConsistency[0].month).slice(0, 7) : null;
  const consistencyThisMonth = latestConsistencyMonth
    ? recipeConsistency.filter((r: any) => String(r.month).startsWith(latestConsistencyMonth))
    : recipeConsistency;

  const buildExportSections = () => {
    const sections: Array<{ title: string; columns: Array<{ label: string }>; rows: Array<Array<any>> }> = [];

    sections.push({
      title: t.profitability,
      columns: [{ label: t.product }, { label: t.revenue }, { label: t.totalCost }, { label: t.grossProfit }, { label: t.marginLabel }],
      rows: profitabilityRows.map(r => [
        r.name,
        r.revenue?.toFixed ? r.revenue.toFixed(2) : r.revenue,
        r.cost?.toFixed ? r.cost.toFixed(2) : r.cost,
        r.profit?.toFixed ? r.profit.toFixed(2) : r.profit,
        `${Number(r.marginPct || 0).toFixed(2)}%`
      ])
    });

    sections.push({
      title: t.productionReports,
      columns: [{ label: t.date }, { label: t.batchCount }, { label: t.totalWeightKg }, { label: t.wastePercent }],
      rows: dailyProduction.slice(0, 60).map((r: any) => [
        String(r.day).slice(0, 10),
        r.batch_count,
        Number(r.total_output_kg || 0).toFixed(2),
        r.waste_percent !== null && r.waste_percent !== undefined ? `${Number(r.waste_percent).toFixed(2)}%` : ''
      ])
    });

    if (productionCost.length > 0) {
      sections.push({
        title: t.productionCostReport,
        columns: [{ label: t.date }, { label: t.batchId }, { label: t.roastProfile }, { label: t.roaster }, { label: t.batchCost }, { label: t.unitCost }],
        rows: productionCost.slice(0, 60).map((r: any) => [
          String(r.roast_date).slice(0, 10),
          r.batch_id,
          r.roast_profile_name,
          r.roaster_name,
          r.total_batch_cost !== null && r.total_batch_cost !== undefined ? Number(r.total_batch_cost).toFixed(2) : '',
          r.cost_per_packaged_unit !== null && r.cost_per_packaged_unit !== undefined ? Number(r.cost_per_packaged_unit).toFixed(4) : ''
        ])
      });
    }

    if (consumptionThisMonth.length > 0) {
      sections.push({
        title: t.greenBeanConsumptionReport,
        columns: [{ label: t.month }, { label: t.bean }, { label: t.quantityKg }, { label: t.estimatedCost }],
        rows: consumptionThisMonth.slice(0, 60).map((r: any) => [
          String(r.month).slice(0, 7),
          [r.origin, r.variety].filter(Boolean).join(' - '),
          Number(r.quantity_kg || 0).toFixed(2),
          Number(r.estimated_cost || 0).toFixed(2)
        ])
      });
    }

    if (consistencyThisMonth.length > 0) {
      sections.push({
        title: t.recipeConsistencyReport,
        columns: [{ label: t.month }, { label: t.roastProfile }, { label: t.usageCount }, { label: t.wasteCvPercent }, { label: t.chargeCvPercent }, { label: t.roastTimeWithin30s }],
        rows: consistencyThisMonth.slice(0, 60).map((r: any) => [
          String(r.month).slice(0, 7),
          r.roast_profile_name,
          r.usage_count,
          r.waste_cv_percent !== null && r.waste_cv_percent !== undefined ? Number(r.waste_cv_percent).toFixed(2) : '',
          r.charge_cv_percent !== null && r.charge_cv_percent !== undefined ? Number(r.charge_cv_percent).toFixed(2) : '',
          r.roast_time_within_30s_rate !== null && r.roast_time_within_30s_rate !== undefined ? `${Number(r.roast_time_within_30s_rate).toFixed(1)}%` : ''
        ])
      });
    }

    return sections;
  };

  const handleExportExcel = () => {
    const filename = `reports_${new Date().toISOString().slice(0, 10)}.xls`;
    exportExcelHtml(filename, t.reports, buildExportSections());
  };

  const handleExportPdf = () => {
    exportPdfPrint(t.reports, buildExportSections());
  };

  return (
    <div className="space-y-6 md:space-y-8 animate-in zoom-in-95 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-orange-900 transition-colors">{t.reports}</h2>
          <p className="text-sm md:text-base text-stone-500">{t.reportsTitle}</p>
        </div>
        <div className="flex flex-wrap gap-2 md:gap-3 w-full md:w-auto">
          <div className="flex-1 md:flex-none flex bg-white border border-orange-100 rounded-xl px-4 py-2 md:py-3 items-center gap-3 shadow-sm transition-colors">
            <Calendar size={18} className="text-orange-400" />
            <span className="text-xs md:text-sm font-bold whitespace-nowrap text-orange-900">{t.last30Days}</span>
          </div>
          <button onClick={handleExportExcel} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white border border-orange-100 text-orange-900 px-4 md:px-6 py-2 md:py-3 rounded-xl font-bold shadow-sm text-xs md:text-sm whitespace-nowrap active:scale-95 transition-all">
            <FileDown size={18} />
            {t.exportExcel}
          </button>
          <button onClick={handleExportPdf} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-orange-600 text-white px-4 md:px-6 py-2 md:py-3 rounded-xl font-bold shadow-lg  text-xs md:text-sm whitespace-nowrap active:scale-95 transition-all">
            <FileDown size={18} />
            {t.exportPdf}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        <div className="bg-white  p-5 md:p-8 rounded-2xl shadow-sm border border-stone-200  transition-colors">
          <h3 className="text-base md:text-lg font-bold mb-6 text-stone-800 ">{t.salesDistribution}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                   contentStyle={{ backgroundColor: theme === 'dark' ? '#1c1917' : '#fff', borderColor: theme === 'dark' ? '#292524' : '#e7e5e4', borderRadius: '12px' }}
                   itemStyle={{ color: theme === 'dark' ? '#f5f5f4' : '#1c1917' }}
                />
                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px', color: theme === 'dark' ? '#a8a29e' : '#78716c' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white  p-5 md:p-8 rounded-2xl shadow-sm border border-stone-200  transition-colors">
          <h3 className="text-base md:text-lg font-bold mb-6 text-stone-800 ">{t.profitability}</h3>
          <div className="space-y-5">
            {profitabilityLoading ? (
              <div className="text-sm text-stone-500">{t.loading}</div>
            ) : profitabilityRows.length === 0 ? (
              <div className="text-sm text-stone-500">{t.noItemsFound}</div>
            ) : profitabilityRows.map((product, idx) => (
              <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 group">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-white  flex items-center justify-center font-bold text-stone-500  text-xs md:text-sm shrink-0 transition-colors">
                    {idx + 1}
                  </div>
                  <span className="font-bold text-stone-700  text-xs md:text-sm line-clamp-1">{product.name}</span>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-4 md:gap-8 grow">
                  <div className={`text-${t.dir === 'rtl' ? 'right' : 'left'} shrink-0`}>
                    <span className="block text-[10px] text-stone-400  font-bold uppercase">{t.marginLabel}</span>
                    <span className={`text-xs md:text-sm font-bold ${product.trend === 'up' ? 'text-black ' : 'text-stone-500 '}`}>
                      {Math.round(product.marginPct)}%
                    </span>
                  </div>
                  <div className="w-24 md:w-32 bg-white  h-1.5 md:h-2 rounded-full overflow-hidden shrink-0 transition-colors">
                    <div 
                      className="bg-orange-600 h-full rounded-full transition-all duration-1000" 
                      style={{ width: `${Math.min(100, Math.max(0, product.marginPct))}%` }} 
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cash Management Report Section */}
      <div className="bg-white  p-5 md:p-8 rounded-2xl shadow-sm border border-stone-200  transition-colors">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h3 className="text-base md:text-lg font-bold text-stone-800 ">{t.cashManagementReport}</h3>
            <p className="text-xs md:text-sm text-stone-500 ">{t.cashReportDesc}</p>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign size={18} className="text-stone-400 " />
            <span className="text-xs font-bold text-stone-600 ">{t.endOfDay}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {/* Cash Summary Card */}
          <div className="bg-white  p-4 md:p-6 rounded-xl border border-stone-100 ">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold text-stone-700 ">{t.cashSummary}</h4>
              <TrendingUp size={16} className="text-green-600" />
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-stone-500 ">{t.openingBalance}</span>
                <span className="text-sm font-mono font-bold">1,000.00</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-stone-500 ">{t.cashSales}</span>
                <span className="text-sm font-mono font-bold text-green-600">+2,450.00</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-stone-500 ">{t.cashIn}</span>
                <span className="text-sm font-mono font-bold text-blue-600">+500.00</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-stone-500 ">{t.cashOut}</span>
                <span className="text-sm font-mono font-bold text-red-600">-200.00</span>
              </div>
              <div className="border-t border-dashed border-orange-200 my-2"></div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-black uppercase text-orange-900">{t.expectedBalance}</span>
                <span className="text-lg font-mono font-black text-orange-600">3,750.00</span>
              </div>
            </div>
          </div>

          {/* Reconciliation Status Card */}
          <div className="bg-white p-4 md:p-6 rounded-xl border border-orange-100">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold text-orange-900">{t.reconciliationStatus}</h4>
              <AlertTriangle size={16} className="text-amber-600" />
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-stone-500 ">{t.actualCount}</span>
                <span className="text-sm font-mono font-bold">3,745.00</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-stone-500 ">{t.discrepancy}</span>
                <span className="text-sm font-mono font-bold text-red-600">-5.00</span>
              </div>
              <div className="bg-white border border-amber-200  rounded-lg p-3 mt-4">
                <p className="text-xs text-amber-700 ">
                  {t.minorDiscrepancy}
                </p>
              </div>
            </div>
          </div>

          {/* Recent Movements Card */}
          <div className="bg-white p-4 md:p-6 rounded-xl border border-orange-100">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold text-orange-900">{t.recentMovements}</h4>
              <TrendingDown size={16} className="text-orange-400" />
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-orange-50">
                <div>
                  <p className="text-xs font-bold text-orange-900">{t.milkPurchase}</p>
                  <p className="text-xs text-stone-500">2:30 PM</p>
                </div>
                <span className="text-sm font-mono font-bold text-red-600">-120.00</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-orange-50">
                <div>
                  <p className="text-xs font-bold text-orange-900">{t.cashDeposit}</p>
                  <p className="text-xs text-stone-500">11:45 AM</p>
                </div>
                <span className="text-sm font-mono font-bold text-blue-600">+500.00</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <div>
                  <p className="text-xs font-bold text-orange-900">{t.pettyCash}</p>
                  <p className="text-xs text-stone-500">9:15 AM</p>
                </div>
                <span className="text-sm font-mono font-bold text-red-600">-80.00</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button className="flex items-center gap-2 bg-orange-600 text-white px-4 md:px-6 py-2 md:py-3 rounded-xl font-bold shadow-lg  text-xs md:text-sm whitespace-nowrap active:scale-95 transition-all">
            <FileDown size={16} />
            {t.exportCashReport}
          </button>
        </div>
      </div>

      <div className="bg-white  p-5 md:p-8 rounded-2xl shadow-sm border border-stone-200  transition-colors">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h3 className="text-base md:text-lg font-bold text-stone-800 ">{t.productionReports}</h3>
            <p className="text-xs md:text-sm text-stone-500 ">{t.productionReportsDesc}</p>
          </div>
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-stone-400 " />
            <span className="text-xs font-bold text-stone-600 ">{t.last30Days}</span>
          </div>
        </div>

        {productionLoading ? (
          <div className="text-sm text-stone-500">{t.loading}</div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              <div className="bg-white  p-4 md:p-6 rounded-xl border border-stone-100 ">
                <div className="text-[10px] font-black uppercase text-stone-500">{t.dailyProduction}</div>
                <div className="mt-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-stone-500">{t.date}</span>
                    <span className="text-sm font-mono font-bold">{latestDaily ? new Date(latestDaily.day).toLocaleDateString() : '-'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-stone-500">{t.batchCount}</span>
                    <span className="text-sm font-mono font-bold">{latestDaily ? Number(latestDaily.batch_count || 0) : '-'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-stone-500">{t.totalWeightKg}</span>
                    <span className="text-sm font-mono font-bold">{latestDaily ? Number(latestDaily.total_output_kg || 0).toFixed(2) : '-'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-stone-500">{t.wastePercent}</span>
                    <span className="text-sm font-mono font-bold">{latestDaily && latestDaily.waste_percent !== null ? `${Number(latestDaily.waste_percent).toFixed(2)}%` : '-'}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 md:p-6 rounded-xl border border-stone-100">
                <div className="text-[10px] font-black uppercase text-stone-500">{t.monthlyProduction}</div>
                <div className="mt-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-stone-500">{t.month}</span>
                    <span className="text-sm font-mono font-bold">{latestMonthly ? String(latestMonthly.month).slice(0, 7) : '-'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-stone-500">{t.batchCount}</span>
                    <span className="text-sm font-mono font-bold">{latestMonthly ? Number(latestMonthly.batch_count || 0) : '-'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-stone-500">{t.totalWeightKg}</span>
                    <span className="text-sm font-mono font-bold">{latestMonthly ? Number(latestMonthly.total_output_kg || 0).toFixed(2) : '-'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-stone-500">{t.wastePercentDelta}</span>
                    <span className="text-sm font-mono font-bold">{latestMonthly && latestMonthly.waste_percent_delta !== null ? `${Number(latestMonthly.waste_percent_delta).toFixed(2)}%` : '-'}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 md:p-6 rounded-xl border border-stone-100">
                <div className="text-[10px] font-black uppercase text-stone-500">{t.qualityReport}</div>
                <div className="mt-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-stone-500">{t.month}</span>
                    <span className="text-sm font-mono font-bold">{latestQcMonthly ? String(latestQcMonthly.month).slice(0, 7) : '-'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-stone-500">{t.passRate}</span>
                    <span className="text-sm font-mono font-bold">{latestQcMonthly && latestQcMonthly.pass_rate_percent !== null ? `${Number(latestQcMonthly.pass_rate_percent).toFixed(1)}%` : '-'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-stone-500">{t.avgScore}</span>
                    <span className="text-sm font-mono font-bold">{latestQcMonthly && latestQcMonthly.avg_score !== null ? Number(latestQcMonthly.avg_score).toFixed(1) : '-'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
              <div className="bg-white  p-4 md:p-6 rounded-xl border border-stone-100 ">
                <h4 className="text-sm font-bold text-stone-700 mb-3">{t.wasteByRecipe}</h4>
                <div className="space-y-2">
                  {wasteByProfile.length === 0 ? (
                    <div className="text-sm text-stone-500">{t.noItemsFound}</div>
                  ) : wasteByProfile.map((row: any) => (
                    <div key={`${row.roast_profile_id || 'none'}-${row.month}`} className="flex justify-between items-center">
                      <span className="text-xs font-bold text-stone-700 line-clamp-1">{row.roast_profile_name || t.unknown}</span>
                      <span className="text-xs font-mono font-bold">{row.waste_percent !== null ? `${Number(row.waste_percent).toFixed(2)}%` : '-'}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white  p-4 md:p-6 rounded-xl border border-stone-100 ">
                <h4 className="text-sm font-bold text-stone-700 mb-3">{t.wasteByRoaster}</h4>
                <div className="space-y-2">
                  {wasteByRoaster.length === 0 ? (
                    <div className="text-sm text-stone-500">{t.noItemsFound}</div>
                  ) : wasteByRoaster.map((row: any) => (
                    <div key={`${row.roaster_id || 'none'}-${row.month}`} className="flex justify-between items-center">
                      <span className="text-xs font-bold text-stone-700 line-clamp-1">{row.roaster_name || t.unknown}</span>
                      <span className="text-xs font-mono font-bold">{row.waste_percent !== null ? `${Number(row.waste_percent).toFixed(2)}%` : '-'}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white  p-4 md:p-6 rounded-xl border border-stone-100 ">
                <h4 className="text-sm font-bold text-stone-700 mb-3">{t.wasteByBean}</h4>
                <div className="space-y-2">
                  {wasteByBean.length === 0 ? (
                    <div className="text-sm text-stone-500">{t.noItemsFound}</div>
                  ) : wasteByBean.map((row: any) => (
                    <div key={`${row.bean_id || 'none'}-${row.month}`} className="flex justify-between items-center">
                      <span className="text-xs font-bold text-stone-700 line-clamp-1">{[row.origin, row.variety].filter(Boolean).join(' - ') || t.unknown}</span>
                      <span className="text-xs font-mono font-bold">{row.waste_percent !== null ? `${Number(row.waste_percent).toFixed(2)}%` : '-'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white  p-4 md:p-6 rounded-xl border border-stone-100 ">
              <h4 className="text-sm font-bold text-stone-700 mb-4">{t.roasterPerformance}</h4>
              {roasterPerfThisMonth.length === 0 ? (
                <div className="text-sm text-stone-500">{t.noItemsFound}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className={`w-full ${t.dir === 'rtl' ? 'text-right' : 'text-left'} text-sm min-w-[700px]`}>
                    <thead className="text-[10px] font-black uppercase tracking-widest text-stone-500 border-b border-stone-200">
                      <tr>
                        <th className="py-3">{t.roaster}</th>
                        <th className="py-3">{t.batchCount}</th>
                        <th className="py-3">{t.wastePercent}</th>
                        <th className="py-3">{t.passRate}</th>
                        <th className="py-3">{t.avgScore}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {roasterPerfThisMonth.slice(0, 12).map((row: any) => (
                        <tr key={`${row.month}-${row.roaster_id || row.roaster_name}`}>
                          <td className="py-3 font-bold text-stone-700">{row.roaster_name || t.unknown}</td>
                          <td className="py-3 font-mono font-bold">{Number(row.batch_count || 0)}</td>
                          <td className="py-3 font-mono font-bold">{row.waste_percent !== null ? `${Number(row.waste_percent).toFixed(2)}%` : '-'}</td>
                          <td className="py-3 font-mono font-bold">{row.pass_rate_percent !== null ? `${Number(row.pass_rate_percent).toFixed(1)}%` : '-'}</td>
                          <td className="py-3 font-mono font-bold">{row.avg_score !== null ? Number(row.avg_score).toFixed(1) : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white  p-5 md:p-8 rounded-2xl shadow-sm border border-stone-200  transition-colors">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h3 className="text-base md:text-lg font-bold text-stone-800 ">{t.advancedReports}</h3>
            <p className="text-xs md:text-sm text-stone-500 ">{t.advancedReportsDesc}</p>
          </div>
        </div>

        {advancedLoading ? (
          <div className="text-sm text-stone-500">{t.loading}</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
            <div className="bg-white  p-4 md:p-6 rounded-xl border border-stone-100 ">
              <h4 className="text-sm font-bold text-stone-700 mb-4">{t.productionCostReport}</h4>
              {productionCost.length === 0 ? (
                <div className="text-sm text-stone-500">{t.noItemsFound}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className={`w-full ${t.dir === 'rtl' ? 'text-right' : 'text-left'} text-sm min-w-[520px]`}>
                    <thead className="text-[10px] font-black uppercase tracking-widest text-stone-500 border-b border-stone-200">
                      <tr>
                        <th className="py-3">{t.date}</th>
                        <th className="py-3">{t.batchCost}</th>
                        <th className="py-3">{t.unitCost}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {productionCost.slice(0, 12).map((row: any) => (
                        <tr key={row.batch_id}>
                          <td className="py-3 font-mono font-bold">{String(row.roast_date).slice(0, 10)}</td>
                          <td className="py-3 font-mono font-bold">{row.total_batch_cost !== null && row.total_batch_cost !== undefined ? Number(row.total_batch_cost).toFixed(2) : '-'}</td>
                          <td className="py-3 font-mono font-bold">{row.cost_per_packaged_unit !== null && row.cost_per_packaged_unit !== undefined ? Number(row.cost_per_packaged_unit).toFixed(4) : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-white  p-4 md:p-6 rounded-xl border border-stone-100 ">
              <h4 className="text-sm font-bold text-stone-700 mb-4">{t.greenBeanConsumptionReport}</h4>
              {consumptionThisMonth.length === 0 ? (
                <div className="text-sm text-stone-500">{t.noItemsFound}</div>
              ) : (
                <div className="space-y-2">
                  {consumptionThisMonth
                    .slice()
                    .sort((a: any, b: any) => Number(b.quantity_kg || 0) - Number(a.quantity_kg || 0))
                    .slice(0, 12)
                    .map((row: any) => (
                      <div key={`${row.bean_id}-${row.month}`} className="flex justify-between items-center">
                        <span className="text-xs font-bold text-stone-700 line-clamp-1">{[row.origin, row.variety].filter(Boolean).join(' - ') || t.unknown}</span>
                        <span className="text-xs font-mono font-bold">{Number(row.quantity_kg || 0).toFixed(2)} {t.kg}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="bg-white  p-4 md:p-6 rounded-xl border border-stone-100 ">
              <h4 className="text-sm font-bold text-stone-700 mb-4">{t.recipeConsistencyReport}</h4>
              {consistencyThisMonth.length === 0 ? (
                <div className="text-sm text-stone-500">{t.noItemsFound}</div>
              ) : (
                <div className="space-y-2">
                  {consistencyThisMonth
                    .slice()
                    .sort((a: any, b: any) => Number(a.waste_cv_percent ?? 0) - Number(b.waste_cv_percent ?? 0))
                    .slice(0, 12)
                    .map((row: any) => (
                      <div key={`${row.roast_profile_id}-${row.month}`} className="flex justify-between items-center gap-4">
                        <span className="text-xs font-bold text-stone-700 line-clamp-1">{row.roast_profile_name || t.unknown}</span>
                        <span className="text-xs font-mono font-bold whitespace-nowrap">{row.waste_cv_percent !== null && row.waste_cv_percent !== undefined ? `${Number(row.waste_cv_percent).toFixed(2)}%` : '-'}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportsView;
