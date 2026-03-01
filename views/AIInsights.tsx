
import React, { useState, useEffect } from 'react';
import { Sparkles, BrainCircuit, TrendingUp, AlertCircle, RefreshCw, Lightbulb, Loader2 } from 'lucide-react';
import { useLanguage } from '../App';
import { supabase } from '../supabaseClient';

const AIInsights: React.FC = () => {
  const { t, lang } = useLanguage();
  const [reportAr, setReportAr] = useState<string>('');
  const [reportEn, setReportEn] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [stats, setStats] = useState<any>(null);

  const replaceParams = (template: string, params: Record<string, string | number>) =>
    Object.entries(params).reduce((result, [key, value]) => result.replace(`{${key}}`, String(value)), template);

  const toDateKey = (value: string | Date) => {
    const d = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const safeNumber = (v: any) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const avg = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

  const quantile = (values: number[], q: number) => {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const pos = (sorted.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (sorted[base + 1] === undefined) return sorted[base];
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  };

  const secondsBetween = (start?: string | null, end?: string | null) => {
    if (!start || !end) return null;
    const a = new Date(start).getTime();
    const b = new Date(end).getTime();
    if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
    return Math.round((b - a) / 1000);
  };

  const computeForecastNext7Days = (salesRows: any[]) => {
    const now = new Date();
    const daily = new Map<string, number>();
    salesRows.forEach((row: any) => {
      const item = row.inventory_items;
      const productId = item?.product_id;
      const locationId = row.location_id;
      if (!productId || !locationId) return;
      const dateKey = toDateKey(row.created_at);
      if (!dateKey) return;
      const key = `${locationId}|${productId}|${dateKey}`;
      daily.set(key, (daily.get(key) || 0) + Math.abs(safeNumber(row.quantity)));
    });

    const byDow = new Map<string, number[]>();
    daily.forEach((qty, key) => {
      const [, , dateKey] = key.split('|');
      const d = new Date(dateKey);
      const dow = d.getDay();
      const baseKey = key.split('|').slice(0, 2).join('|');
      const dowKey = `${baseKey}|${dow}`;
      const list = byDow.get(dowKey) || [];
      list.push(qty);
      byDow.set(dowKey, list);
    });

    const next7 = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() + i + 1);
      return d;
    });

    const totals = new Map<string, number>();
    next7.forEach(d => {
      const dow = d.getDay();
      const seenBase = new Set<string>();
      byDow.forEach((vals, dowKey) => {
        const parts = dowKey.split('|');
        const baseKey = parts.slice(0, 2).join('|');
        if (seenBase.has(baseKey)) return;
        seenBase.add(baseKey);
      });

      const bases = new Set<string>();
      byDow.forEach((_vals, dowKey) => {
        const parts = dowKey.split('|');
        const baseKey = parts.slice(0, 2).join('|');
        bases.add(baseKey);
      });

      bases.forEach(baseKey => {
        const vals = byDow.get(`${baseKey}|${dow}`) || [];
        const predicted = avg(vals);
        totals.set(baseKey, (totals.get(baseKey) || 0) + predicted);
      });
    });

    return Array.from(totals.entries())
      .map(([key, qty]) => {
        const [locationId, productId] = key.split('|');
        return { locationId, productId, predictedQty: Math.round(qty * 100) / 100 };
      })
      .sort((a, b) => b.predictedQty - a.predictedQty);
  };

  const computeWasteInsights = (batches: any[], beansById: Map<string, any>) => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const recent = batches.filter(b => {
      const d = new Date(b.roast_date);
      return Number.isFinite(d.getTime()) && d >= monthStart;
    });

    const byKey = new Map<string, { count: number; waste: number; qcTotal: number; qcPass: number }>();
    recent.forEach(b => {
      const bean = beansById.get(b.bean_id);
      const origin = bean?.origin || 'UNKNOWN';
      const variety = bean?.variety || 'UNKNOWN';
      const level = b.level || 'UNKNOWN';
      const key = `${origin} • ${variety} • ${level}`;
      const cur = byKey.get(key) || { count: 0, waste: 0, qcTotal: 0, qcPass: 0 };
      const w = safeNumber(b.waste_percentage);
      cur.count += 1;
      cur.waste += w;
      if (b.qc_status === 'PASSED' || b.qc_status === 'FAILED') {
        cur.qcTotal += 1;
        if (b.qc_status === 'PASSED') cur.qcPass += 1;
      }
      byKey.set(key, cur);
    });

    const rows = Array.from(byKey.entries()).map(([key, v]) => ({
      key,
      count: v.count,
      avgWaste: v.count ? v.waste / v.count : 0,
      qcPassRate: v.qcTotal ? (v.qcPass / v.qcTotal) * 100 : null
    }));

    rows.sort((a, b) => b.avgWaste - a.avgWaste);
    return {
      topWaste: rows.slice(0, 5),
      lowWaste: [...rows].reverse().slice(0, 5),
      monthAvgWaste: avg(rows.map(r => r.avgWaste))
    };
  };

  const computeRoastParameterSuggestions = (batches: any[]) => {
    const usable = batches
      .map(b => {
        const waste = safeNumber(b.waste_percentage);
        const roastingSeconds = secondsBetween(b.roasting_started_at, b.roasting_ended_at);
        const charge = b.roast_temp_charge !== null && b.roast_temp_charge !== undefined ? safeNumber(b.roast_temp_charge) : null;
        return { waste, roastingSeconds, charge };
      })
      .filter(r => r.waste > 0);

    const suggestions: Array<{ ar: string; en: string }> = [];
    const overallWaste = avg(usable.map(u => u.waste));

    const suggestForNumeric = (labelAr: string, labelEn: string, values: Array<{ x: number; waste: number }>, unitAr: string, unitEn: string) => {
      const xs = values.map(v => v.x);
      const q33 = quantile(xs, 0.33);
      const q66 = quantile(xs, 0.66);
      if (q33 === null || q66 === null) return;
      const low = values.filter(v => v.x <= q33).map(v => v.waste);
      const mid = values.filter(v => v.x > q33 && v.x <= q66).map(v => v.waste);
      const high = values.filter(v => v.x > q66).map(v => v.waste);
      const aLow = avg(low);
      const aMid = avg(mid);
      const aHigh = avg(high);
      const best = Math.min(aLow || Infinity, aMid || Infinity, aHigh || Infinity);
      if (!Number.isFinite(best) || best >= overallWaste - 0.5) return;
      const bestBucket = best === aLow ? 'low' : best === aMid ? 'mid' : 'high';
      const range = bestBucket === 'low'
        ? `≤ ${Math.round(q33)} ${unitEn}`
        : bestBucket === 'mid'
          ? `${Math.round(q33)}–${Math.round(q66)} ${unitEn}`
          : `≥ ${Math.round(q66)} ${unitEn}`;
      const rangeAr = bestBucket === 'low'
        ? `≤ ${Math.round(q33)} ${unitAr}`
        : bestBucket === 'mid'
          ? `${Math.round(q33)}–${Math.round(q66)} ${unitAr}`
          : `≥ ${Math.round(q66)} ${unitAr}`;
      suggestions.push({
        ar: `أفضل نطاق لـ ${labelAr} هذا الشهر كان ${rangeAr} بمتوسط هدر ${best.toFixed(2)}% (مقابل ${overallWaste.toFixed(2)}% إجمالي).`,
        en: `Best ${labelEn} band this month was ${range} with avg waste ${best.toFixed(2)}% (overall ${overallWaste.toFixed(2)}%).`
      });
    };

    const roastingValues = usable
      .filter(u => u.roastingSeconds !== null)
      .map(u => ({ x: u.roastingSeconds as number, waste: u.waste }));
    suggestForNumeric('زمن التحميص', 'Roasting time', roastingValues, 'ث', 's');

    const chargeValues = usable
      .filter(u => u.charge !== null)
      .map(u => ({ x: u.charge as number, waste: u.waste }));
    suggestForNumeric('حرارة الشحن (Charge)', 'Charge temperature', chargeValues, '°C', '°C');

    if (!suggestions.length && Number.isFinite(overallWaste)) {
      suggestions.push({
        ar: `لا توجد فروقات واضحة كفاية لاقتراح تعديل حرارة/وقت بناءً على بيانات الشهر الحالي. زد حجم العينة (أو ثبّت ملف تحميص واحد) للحصول على استنتاج أدق.`,
        en: `No strong temperature/time signal detected in this month's data. Increase sample size (or standardize a roast profile) for clearer guidance.`
      });
    }

    return { overallWaste, suggestions };
  };

  const convertAmountToInventoryUnit = (amount: number, recipeUnit: string, invUnit: string) => {
    if (!recipeUnit || !invUnit) return amount;
    const ru = recipeUnit.toLowerCase();
    const iu = invUnit.toLowerCase();
    if (ru === iu) return amount;
    if (ru === 'g' && iu === 'kg') return amount / 1000;
    if (ru === 'kg' && iu === 'g') return amount * 1000;
    if (ru === 'ml' && iu === 'liter') return amount / 1000;
    if (ru === 'liter' && iu === 'ml') return amount * 1000;
    return amount;
  };

  const computeRecipeSuggestions = (products: any[], ingredients: any[]) => {
    const ingById = new Map<string, any>();
    const ingByName = new Map<string, any>();
    ingredients.forEach((i: any) => {
      if (i.id) ingById.set(i.id, i);
      if (i.name) ingByName.set(i.name, i);
    });

    const rows: Array<{ name: string; marginPct: number; suggestedPrice: number; cost: number; topIngredient?: string }> = [];
    products
      .filter(p => p.type === 'BEVERAGE')
      .forEach(p => {
        const selling = p.selling_price ?? p.base_price ?? 0;
        const recipe = p.recipe;
        const ingredientsList = recipe?.ingredients || [];
        if (!Array.isArray(ingredientsList) || ingredientsList.length === 0) return;
        let cost = 0;
        let topCost = 0;
        let topName = '';
        ingredientsList.forEach((ing: any) => {
          const inv = ing.ingredient_id ? ingById.get(ing.ingredient_id) : ingByName.get(ing.name);
          if (!inv) return;
          const unitCost = safeNumber(inv.cost_per_unit);
          const invUnit = inv.unit || '';
          const qty = convertAmountToInventoryUnit(safeNumber(ing.amount), ing.unit || invUnit, invUnit);
          const lineCost = qty * unitCost;
          cost += lineCost;
          if (lineCost > topCost) {
            topCost = lineCost;
            topName = inv.name;
          }
        });
        if (selling <= 0) return;
        const marginPct = ((selling - cost) / selling) * 100;
        const target = safeNumber(p.profit_margin) || 60;
        if (marginPct >= target - 5) return;
        const suggestedPrice = cost / (1 - target / 100);
        rows.push({ name: p.name, marginPct: Math.round(marginPct * 10) / 10, suggestedPrice: Math.round(suggestedPrice * 100) / 100, cost: Math.round(cost * 100) / 100, topIngredient: topName || undefined });
      });

    rows.sort((a, b) => a.marginPct - b.marginPct);
    return rows.slice(0, 8);
  };

  const fetchRealDataAndAnalyze = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const since90 = new Date(now);
      since90.setDate(since90.getDate() - 90);
      const since60 = new Date(now);
      since60.setDate(since60.getDate() - 56);
      const since30 = new Date(now);
      since30.setDate(since30.getDate() - 30);

      const [
        salesRes,
        inventoryRes,
        batchesRes,
        beansRes,
        movementsRes,
        locationsRes,
        productsRes,
        ingredientsRes,
        profitabilityRes
      ] = await Promise.all([
        supabase.from('transactions').select('total,created_at').gte('created_at', since30.toISOString()),
        supabase.from('inventory_items').select('name, stock').limit(5000),
        supabase.from('roasting_batches').select('id,bean_id,roast_profile_id,roast_date,level,pre_weight,post_weight,waste_percentage,qc_status,roast_temp_charge,roasting_started_at,roasting_ended_at').gte('roast_date', since90.toISOString().split('T')[0]),
        supabase.from('green_beans').select('id,origin,variety'),
        supabase
          .from('inventory_movements')
          .select('location_id,created_at,quantity,inventory_items!inner(product_id,name,type,size,batch_id)')
          .eq('movement_type', 'SALE')
          .gte('created_at', since60.toISOString()),
        supabase.from('locations').select('id,name,type,is_roastery').eq('is_active', true),
        supabase.from('product_definitions').select('id,name,type,selling_price,base_price,profit_margin,recipe'),
        supabase.from('inventory_items').select('id,name,unit,cost_per_unit,type').eq('type', 'INGREDIENT').limit(5000),
        supabase.from('product_profitability_report').select('total_revenue,total_cost,gross_profit,period_month').gte('period_month', new Date(now.getFullYear(), now.getMonth(), 1).toISOString()).lt('period_month', new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString())
      ]);

      const sales = salesRes.data || [];
      const inventory = inventoryRes.data || [];
      const batches = batchesRes.data || [];
      const beans = beansRes.data || [];
      const movements = movementsRes.data || [];
      const locations = locationsRes.data || [];
      const products = productsRes.data || [];
      const ingredients = ingredientsRes.data || [];
      const profitability = profitabilityRes.data || [];

      const totalRecentSales = sales.reduce((acc: number, curr: any) => acc + safeNumber(curr.total), 0);
      const lowStockCount = inventory.filter((i: any) => safeNumber(i.stock) < 10).length;

      const beansById = new Map<string, any>(beans.map((b: any) => [b.id, b]));
      const wasteInsights = computeWasteInsights(batches, beansById);
      const roastParam = computeRoastParameterSuggestions(batches);

      const forecastRows = computeForecastNext7Days(movements);
      const locById = new Map<string, any>(locations.map((l: any) => [l.id, l]));
      const productById = new Map<string, any>(products.map((p: any) => [p.id, p]));
      const forecastTop = forecastRows.slice(0, 10).map(r => ({
        ...r,
        locationName: locById.get(r.locationId)?.name || 'Unknown',
        productName: productById.get(r.productId)?.name || r.productId
      }));
      const forecastTotal = forecastRows.reduce((sum, r) => sum + safeNumber(r.predictedQty), 0);

      const qcEvaluated = batches.filter((b: any) => b.qc_status === 'PASSED' || b.qc_status === 'FAILED');
      const qcPass = qcEvaluated.filter((b: any) => b.qc_status === 'PASSED').length;
      const qcPassRate = qcEvaluated.length ? (qcPass / qcEvaluated.length) * 100 : 0;

      const monthStartDateKey = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const thisMonthBatches = batches.filter((b: any) => (b.roast_date || '') >= monthStartDateKey);
      const totalRoastedKg = thisMonthBatches.reduce((sum: number, b: any) => {
        const post = safeNumber(b.post_weight);
        const pre = safeNumber(b.pre_weight);
        return sum + (post > 0 ? post : pre);
      }, 0);
      const totalRoastingSeconds = thisMonthBatches.reduce((sum: number, b: any) => {
        const secs = secondsBetween(b.roasting_started_at, b.roasting_ended_at);
        return sum + (secs || 0);
      }, 0);
      const roastingKgPerHour = totalRoastingSeconds > 0 ? (totalRoastedKg / (totalRoastingSeconds / 3600)) : 0;

      const profitRevenue = profitability.reduce((sum: number, r: any) => sum + safeNumber(r.total_revenue), 0);
      const profitGross = profitability.reduce((sum: number, r: any) => sum + safeNumber(r.gross_profit), 0);
      const grossMargin = profitRevenue > 0 ? (profitGross / profitRevenue) * 100 : 0;

      const recipeIssues = computeRecipeSuggestions(products, ingredients);

      const arLines: string[] = [];
      arLines.push(`ملخص تحليلي (AR)`);
      arLines.push(`- الهدر (هذا الشهر): متوسط ${wasteInsights.monthAvgWaste.toFixed(2)}%`);
      arLines.push(`- الجودة: معدل النجاح ${qcPassRate.toFixed(1)}%`);
      arLines.push(`- الإنتاجية: ${roastingKgPerHour.toFixed(2)} كجم/ساعة (زمن تحميص فقط)`);
      arLines.push(`- الربحية (منتجات تامة): هامش إجمالي ${grossMargin.toFixed(1)}%`);
      arLines.push(``);
      arLines.push(`1) أنماط الهدر`);
      wasteInsights.topWaste.forEach(r => {
        arLines.push(`- أعلى هدر: ${r.key} | ${r.avgWaste.toFixed(2)}% | ${r.count} دفعات`);
      });
      arLines.push(``);
      arLines.push(`2) توقع الكمية المطلوبة (7 أيام)`);
      forecastTop.forEach(r => {
        arLines.push(`- ${r.locationName}: ${r.productName} ≈ ${r.predictedQty}`);
      });
      arLines.push(``);
      arLines.push(`3) اقتراحات تعديل الوقت/الحرارة لتقليل الهدر`);
      roastParam.suggestions.forEach(s => arLines.push(`- ${s.ar}`));
      arLines.push(``);
      arLines.push(`4) تحسينات على وصفات المشروبات (استهداف هامش 60% أو profit_margin)`);
      if (recipeIssues.length === 0) {
        arLines.push(`- لا توجد وصفات منخفضة الهامش بشكل واضح بناءً على بيانات التكلفة الحالية.`);
      } else {
        recipeIssues.forEach(r => {
          arLines.push(`- ${r.name}: هامش ${r.marginPct}% | تكلفة تقديرية ${r.cost} | سعر مقترح ${r.suggestedPrice}${r.topIngredient ? ` | أعلى تكلفة: ${r.topIngredient}` : ''}`);
        });
      }

      const enLines: string[] = [];
      enLines.push(`Executive Summary (EN)`);
      enLines.push(`- Waste (this month): avg ${wasteInsights.monthAvgWaste.toFixed(2)}%`);
      enLines.push(`- Quality: pass rate ${qcPassRate.toFixed(1)}%`);
      enLines.push(`- Productivity: ${roastingKgPerHour.toFixed(2)} kg/hour (roasting time only)`);
      enLines.push(`- Profitability (finished goods): gross margin ${grossMargin.toFixed(1)}%`);
      enLines.push(``);
      enLines.push(`1) Waste patterns`);
      wasteInsights.topWaste.forEach(r => {
        enLines.push(`- Highest waste: ${r.key} | ${r.avgWaste.toFixed(2)}% | ${r.count} batches`);
      });
      enLines.push(``);
      enLines.push(`2) Demand forecast (next 7 days)`);
      forecastTop.forEach(r => {
        enLines.push(`- ${r.locationName}: ${r.productName} ≈ ${r.predictedQty}`);
      });
      enLines.push(``);
      enLines.push(`3) Roast time/temperature suggestions`);
      roastParam.suggestions.forEach(s => enLines.push(`- ${s.en}`));
      enLines.push(``);
      enLines.push(`4) Beverage recipe optimizations (target margin = 60% or profit_margin)`);
      if (recipeIssues.length === 0) {
        enLines.push(`- No clear low-margin recipes based on current cost data.`);
      } else {
        recipeIssues.forEach(r => {
          enLines.push(`- ${r.name}: margin ${r.marginPct}% | est. cost ${r.cost} | suggested price ${r.suggestedPrice}${r.topIngredient ? ` | top cost: ${r.topIngredient}` : ''}`);
        });
      }

      setReportAr(arLines.join('\n'));
      setReportEn(enLines.join('\n'));
      setStats({
        totalRecentSales,
        avgWaste: wasteInsights.monthAvgWaste,
        lowStockCount,
        forecastTotal,
        qcPassRate,
        grossMargin,
        roastingKgPerHour
      });
    } catch (error) {
      console.error("AI Insight Error:", error);
      setReportAr(t.analysisFetchError);
      setReportEn(t.analysisFetchError);
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
          <h4 className="font-bold text-lg mb-1">{t.forecastNext7DaysTitle}</h4>
          <p className="text-black  text-sm leading-relaxed">
            {stats ? replaceParams(t.forecastNext7DaysDetail, { qty: Math.round(stats.forecastTotal || 0) }) : '...'}
          </p>
        </div>
        <div className="bg-white  border border-orange-100  p-6 rounded-3xl text-black  shadow-xl transform transition-transform hover:-translate-y-1">
          <div className="p-2 bg-white  rounded-lg w-fit mb-4"><AlertCircle size={24} className="text-black " /></div>
          <h4 className="font-bold text-lg mb-1">{t.qcPassRateTitle}</h4>
          <p className="text-black  text-sm leading-relaxed">
            {stats ? replaceParams(t.qcPassRateDetail, { rate: (stats.qcPassRate || 0).toFixed(1) }) : '...'}
          </p>
        </div>
        <div className="bg-white  border border-orange-600 p-6 rounded-3xl text-black  shadow-xl transform transition-transform hover:-translate-y-1">
          <div className="p-2 bg-white  rounded-lg w-fit mb-4"><Lightbulb size={24} /></div>
          <h4 className="font-bold text-lg mb-1">{t.avgWasteTitle}</h4>
          <p className="text-black  text-sm leading-relaxed">
            {stats ? replaceParams(t.avgWasteDetail, { waste: (stats.avgWaste || 0).toFixed(1) }) : '...'}
          </p>
        </div>
      </div>

      <div className="bg-white  p-6 md:p-10 rounded-[32px] md:rounded-[40px] shadow-sm border border-orange-100  relative overflow-hidden min-h-[400px] transition-colors duration-300">
        <div className="absolute top-0 left-0 w-full h-1 bg-orange-600" />
        
        <div className="flex items-center gap-3 mb-8">
          <div className="bg-white  p-2 rounded-xl text-black ">
            <Sparkles size={24} />
          </div>
          <h3 className="text-xl font-bold text-black ">{t.analystReport}</h3>
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
            {lang === 'ar' ? `${reportAr}\n\n${reportEn}` : `${reportEn}\n\n${reportAr}`}
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
