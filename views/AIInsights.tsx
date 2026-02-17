
import React, { useState, useEffect } from 'react';
import { Sparkles, BrainCircuit, TrendingUp, AlertCircle, RefreshCw, Lightbulb, Loader2 } from 'lucide-react';
import { getRoasteryInsights } from '../services/geminiService';
import { useLanguage } from '../App';
import { supabase } from '../supabaseClient';

const AIInsights: React.FC = () => {
  const { t } = useLanguage();
  const [insight, setInsight] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [stats, setStats] = useState<any>(null);

  const replaceParams = (template: string, params: Record<string, string | number>) =>
    Object.entries(params).reduce((result, [key, value]) => result.replace(`{${key}}`, String(value)), template);

  const fetchRealDataAndAnalyze = async () => {
    setLoading(true);
    try {
      // 1. Fetch current business state
      const { data: sales } = await supabase.from('transactions').select('total').limit(50);
      const { data: inventory } = await supabase.from('inventory_items').select('name, stock, price');
      const { data: batches } = await supabase.from('roasting_batches').select('level, waste_percentage').limit(10);

      const totalRecentSales = (sales || []).reduce((acc, curr) => acc + curr.total, 0);
      const lowStockList = (inventory || []).filter(i => i.stock < 10).map(i => i.name).join(', ');
      const avgWaste = (batches || []).filter(b => b.waste_percentage).reduce((acc, curr) => acc + curr.waste_percentage, 0) / (batches?.length || 1);

      const dataSummary = replaceParams(t.aiDataSummary, {
        sales: totalRecentSales,
        lowStock: lowStockList || t.none,
        avgWaste: avgWaste.toFixed(1)
      });

      const result = await getRoasteryInsights(dataSummary);
      setInsight(result || t.analyticsUnavailable);
      setStats({ totalRecentSales, avgWaste, lowStockCount: (inventory || []).filter(i => i.stock < 10).length });
    } catch (error) {
      console.error("AI Insight Error:", error);
      setInsight(t.analysisFetchError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRealDataAndAnalyze();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-black  flex items-center gap-3">
            <BrainCircuit className="text-black " />
            {t.aiInsights}
          </h2>
          <p className="text-black ">{t.advancedAnalytics}</p>
        </div>
        <button 
          onClick={fetchRealDataAndAnalyze}
          disabled={loading}
          className="flex items-center gap-2 bg-white  border border-orange-100  px-4 py-2 rounded-xl text-black  transition-all disabled:opacity-50 font-bold shadow-sm active:scale-95"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          {t.refreshAnalysis}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white  border border-orange-600 p-6 rounded-3xl text-black  shadow-xl transform transition-transform hover:-translate-y-1">
          <div className="p-2 bg-white  rounded-lg w-fit mb-4"><TrendingUp size={24} /></div>
          <h4 className="font-bold text-lg mb-1">{t.expectedGrowth}</h4>
          <p className="text-black  text-sm leading-relaxed">
            {stats ? replaceParams(t.expectedGrowthDetail, { sales: stats.totalRecentSales }) : '...'}
          </p>
        </div>
        <div className="bg-white  border border-orange-100  p-6 rounded-3xl text-black  shadow-xl transform transition-transform hover:-translate-y-1">
          <div className="p-2 bg-white  rounded-lg w-fit mb-4"><AlertCircle size={24} className="text-black " /></div>
          <h4 className="font-bold text-lg mb-1">{t.stockAlert}</h4>
          <p className="text-black  text-sm leading-relaxed">
            {stats ? replaceParams(t.stockAlertDetail, { count: stats.lowStockCount }) : '...'}
          </p>
        </div>
        <div className="bg-white  border border-orange-600 p-6 rounded-3xl text-black  shadow-xl transform transition-transform hover:-translate-y-1">
          <div className="p-2 bg-white  rounded-lg w-fit mb-4"><Lightbulb size={24} /></div>
          <h4 className="font-bold text-lg mb-1">{t.optimizationOpportunity}</h4>
          <p className="text-black  text-sm leading-relaxed">
            {stats ? replaceParams(t.optimizationDetail, { avgWaste: stats.avgWaste.toFixed(1) }) : '...'}
          </p>
        </div>
      </div>

      <div className="bg-white  p-6 md:p-10 rounded-[32px] md:rounded-[40px] shadow-sm border border-orange-100  relative overflow-hidden min-h-[400px] transition-colors duration-300">
        <div className="absolute top-0 left-0 w-full h-1 bg-orange-600" />
        
        <div className="flex items-center gap-3 mb-8">
          <div className="bg-white  p-2 rounded-xl text-black ">
            <Sparkles size={24} />
          </div>
          <h3 className="text-xl font-bold text-black ">{t.smartAnalyst}</h3>
        </div>

        {loading ? (
          <div className="space-y-6">
            <div className="h-4 bg-white  rounded-full w-3/4 animate-pulse" />
            <div className="h-4 bg-white  rounded-full w-full animate-pulse" />
            <div className="h-4 bg-white  rounded-full w-5/6 animate-pulse" />
            <div className="h-4 bg-white  rounded-full w-2/3 animate-pulse" />
            <div className="flex justify-center py-10">
               <Loader2 className="animate-spin text-black " size={32} />
            </div>
          </div>
        ) : (
          <div className={`prose prose-stone  max-w-none text-black  leading-relaxed text-base md:text-lg whitespace-pre-line ${t.dir === 'rtl' ? 'text-right' : 'text-left'}`}>
            {insight}
          </div>
        )}
        
        {!loading && (
          <div className="mt-12 flex items-center gap-2 text-black  text-sm font-medium border-t border-orange-50  pt-6">
            <BrainCircuit size={16} />
            {t.analysisAttribution}
          </div>
        )}
      </div>
    </div>
  );
};

export default AIInsights;
