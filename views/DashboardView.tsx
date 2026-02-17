
import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { ArrowUpRight, ArrowDownRight, Package, Flame, TrendingUp, AlertTriangle, AlertCircle, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useLanguage, useTheme } from '../App';
import { supabase } from '../supabaseClient';
import { RoastingBatch, Transaction } from '../types';

const StatCard = ({ title, value, change, isPositive, icon: Icon, color }: any) => (
  <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-orange-100 transition-colors duration-300">
    <div className="flex justify-between items-start">
      <div className={`p-2 rounded-xl bg-orange-600 text-white transition-colors`}>
        <Icon size={24} />
      </div>
      {change && (
        <div className={`flex items-center text-xs font-bold text-black`}>
          {change}
          {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
        </div>
      )}
    </div>
    <div className="mt-4">
      <h3 className="text-black text-xs md:text-sm font-medium">{title}</h3>
      <p className="text-xl md:text-2xl font-bold mt-1 truncate text-black transition-colors">{value}</p>
    </div>
  </div>
);

const DashboardView: React.FC = () => {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const [stats, setStats] = useState({
    totalSales: 0,
    roastCount: 0,
    stockWeight: 0,
    avgWaste: 0,
    recentBatches: [] as RoastingBatch[],
    lowStockCount: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // 1. Fetch Today's Sales
      const { data: salesData } = await supabase
        .from('transactions')
        .select('total')
        .gte('created_at', todayStart.toISOString());
      
      const totalSales = (salesData || []).reduce((acc, curr) => acc + curr.total, 0);

      // 2. Fetch Roasting Count (Recent week)
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      const { data: roastData } = await supabase
        .from('roasting_batches')
        .select('*')
        .order('roast_date', { ascending: false });

      const recentBatches = (roastData || []).slice(0, 5);
      const weeklyRoasts = (roastData || []).filter(b => new Date(b.roast_date) >= weekStart).length;

      // 3. Fetch Stock Levels
      const { data: gbData } = await supabase.from('green_beans').select('quantity');
      const totalStock = (gbData || []).reduce((acc, curr) => acc + curr.quantity, 0);
      const lowStockCount = (gbData || []).filter(b => b.quantity < 100).length;

      // 4. Calculate Waste Ratio
      const completedRoasts = (roastData || []).filter(b => b.waste_percentage != null);
      const avgWaste = completedRoasts.length > 0 
        ? completedRoasts.reduce((acc, curr) => acc + curr.waste_percentage, 0) / completedRoasts.length 
        : 0;

      setStats({
        totalSales,
        roastCount: weeklyRoasts,
        stockWeight: totalStock,
        avgWaste,
        recentBatches: recentBatches.map(b => ({
          id: b.id,
          beanId: b.bean_id,
          roastDate: b.roast_date,
          level: b.level,
          preWeight: b.pre_weight,
          postWeight: b.post_weight,
          status: b.status,
          wastePercentage: b.waste_percentage
        } as any)),
        lowStockCount
      });
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const chartData = [
    { name: t.daySat, sales: 4000, roast: 2400 },
    { name: t.daySun, sales: 3000, roast: 1398 },
    { name: t.dayMon, sales: 2000, roast: 9800 },
    { name: t.dayTue, sales: 2780, roast: 3908 },
    { name: t.dayWed, sales: 1890, roast: 4800 },
    { name: t.dayThu, sales: 2390, roast: 3800 },
    { name: t.dayFri, sales: 3490, roast: 4300 },
  ];

  const strokeColor = theme === 'dark' ? '#292524' : '#f5f5f5';
  const textColor = theme === 'dark' ? '#a8a29e' : '#78716c';

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 h-full">
        <Loader2 className="animate-spin text-orange-600" size={48} />
        <p className="font-bold text-black">{t.loading}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
      {stats.lowStockCount > 0 && (
        <div className="bg-white border-2 border-orange-600 p-4 md:p-5 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-4 animate-pulse-once transition-colors">
          <div className="flex items-center gap-4 text-black">
            <div className="bg-orange-600 text-white p-2 rounded-xl">
              <AlertCircle size={24} />
            </div>
            <div>
              <h4 className="font-bold text-sm md:text-base">{t.lowStockWarning}</h4>
              <p className="text-xs opacity-80">
                {t.lowStockDetail.replace('{count}', stats.lowStockCount.toString())}
              </p>
            </div>
          </div>
          <button className="w-full md:w-auto px-6 py-2 bg-orange-600 text-white rounded-xl text-xs font-bold  transition-colors shadow-lg">
            {t.reviewInventory}
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard title={t.totalSales} value={`${stats.totalSales.toLocaleString()} ${t.currency}`} icon={TrendingUp} color="amber" />
        <StatCard title={t.roastingBatches} value={`${stats.roastCount} ${t.roastingBatches}`} icon={Flame} color="orange" />
        <StatCard title={t.availableStock} value={`${stats.stockWeight.toLocaleString()} ${t.kg}`} icon={Package} color="blue" />
        <StatCard title={t.wasteRatio} value={`${stats.avgWaste.toFixed(1)}%`} icon={AlertTriangle} color="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        <div className="bg-white p-4 md:p-8 rounded-2xl shadow-sm border border-orange-100 transition-colors duration-300">
          <h3 className="text-base md:text-lg font-bold mb-4 md:mb-6 text-black">{t.weeklyAnalysis}</h3>
          <div className="h-64 md:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#fed7aa" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} tick={{ fill: "#7c2d12" }} />
                <YAxis axisLine={false} tickLine={false} fontSize={12} tick={{ fill: "#7c2d12" }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderColor: '#fed7aa', borderRadius: '12px' }}
                  itemStyle={{ color: '#7c2d12' }}
                />
                <Bar dataKey="sales" fill="#ea580c" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-4 md:p-8 rounded-2xl shadow-sm border border-orange-100 transition-colors duration-300">
          <h3 className="text-base md:text-lg font-bold mb-4 md:mb-6 text-black">{t.roastingActivity}</h3>
          <div className="h-64 md:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#fed7aa" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} tick={{ fill: "#7c2d12" }} />
                <YAxis axisLine={false} tickLine={false} fontSize={12} tick={{ fill: "#7c2d12" }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderColor: '#fed7aa', borderRadius: '12px' }}
                  itemStyle={{ color: '#7c2d12' }}
                />
                <Line type="monotone" dataKey="roast" stroke="#ea580c" strokeWidth={3} dot={{ r: 4, fill: '#ea580c', strokeWidth: 2, stroke: '#fff' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-orange-100 overflow-hidden transition-colors duration-300">
        <div className="p-4 md:p-6 border-b border-orange-50 flex justify-between items-center bg-white">
          <h3 className="text-base md:text-lg font-bold text-black">{t.recentBatches}</h3>
          <button className="text-black text-sm font-semibold hover:underline">{t.viewAll}</button>
        </div>
        <div className="overflow-x-auto">
          <table className={`w-full ${t.dir === 'rtl' ? 'text-right' : 'text-left'} min-w-[600px]`}>
            <thead>
              <tr className="bg-white text-black text-sm uppercase tracking-wider">
                <th className="px-6 py-4 font-bold">{t.batchId}</th>
                <th className="px-6 py-4 font-bold">{t.roastLevel}</th>
                <th className="px-6 py-4 font-bold">{t.netWeight}</th>
                <th className="px-6 py-4 font-bold">{t.status}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-orange-50">
              {stats.recentBatches.map((batch, idx) => (
                <tr key={idx} className=" transition-colors">
                  <td className="px-6 py-4 font-medium text-sm text-black">{batch.id}</td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-white text-black rounded-full text-xs font-semibold whitespace-nowrap border border-stone-200">
                      {batch.level}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-black text-sm">{batch.postWeight || batch.preWeight} {t.kg}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                      batch.status === 'Ready for Packaging'
                        ? 'bg-orange-600 text-white' 
                        : 'bg-white text-black border border-orange-600'
                    }`}>
                      {batch.status === 'Ready for Packaging' ? t.ready : batch.status === 'Completed' ? t.completed : t.inProgress}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
