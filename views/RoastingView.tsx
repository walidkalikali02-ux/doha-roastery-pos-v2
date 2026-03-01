
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Plus, Flame, Scale, History, Save, Calculator, AlertCircle, 
  CheckCircle2, X, Clock, Play, Check, User, Coffee, Box,
  FileText, Search, RotateCcw, Package2, Printer, Link as LinkIcon,
  Layers, QrCode, Hash, Loader2, CheckCircle, Database, LayoutList,
  ArrowRight, Calendar as CalendarIcon, Info, Trash2, AlertTriangle,
  Settings as SettingsIcon, ExternalLink, MapPin
} from 'lucide-react';
import { RoastingLevel, BatchStatus, RoastingBatch, PackagingUnit, PackageTemplate, ProductDefinition } from '../types';
import { useLanguage } from '../App';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';

interface PackagingLine {
  tempId: string;
  productId: string;
  quantity: string;
}

const RoastingView: React.FC<{ onDetailOpen?: (id: string | null) => void }> = ({ onDetailOpen }) => {
  const { lang, t } = useLanguage();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [beans, setBeans] = useState<any[]>([]);
  const [products, setProducts] = useState<ProductDefinition[]>([]);
  const [templates, setTemplates] = useState<PackageTemplate[]>([]);
  const [completedBatches, setCompletedBatches] = useState<RoastingBatch[]>([]);
  const [activeBatches, setActiveBatches] = useState<RoastingBatch[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [monthlyConsumption, setMonthlyConsumption] = useState<Array<{ month: string; variety: string; totalKg: number }>>([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLevel, setFilterLevel] = useState<string>('ALL');
  const [showOnlyReady, setShowOnlyReady] = useState(false);
  
  const [showNewBatchModal, setShowNewBatchModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState<RoastingBatch | null>(null);
  const [showProductionModal, setShowProductionModal] = useState<RoastingBatch | null>(null);
  const [showPrintLabelModal, setShowPrintLabelModal] = useState<PackagingUnit | null>(null);
  
  // State for Batch Packaging
  const [packagingLines, setPackagingLines] = useState<PackagingLine[]>([
    { tempId: crypto.randomUUID(), productId: '', quantity: '1' }
  ]);
  const [productionDates, setProductionDates] = useState({
    productionDate: '',
    packagingDate: new Date().toISOString().split('T')[0],
    targetLocationId: ''
  });
  
  const [finishingBatchId, setFinishingBatchId] = useState<string | null>(null);
  const [postWeightInput, setPostWeightInput] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const [newBatchData, setNewBatchData] = useState({ 
    beanId: '', level: RoastingLevel.MEDIUM, preWeight: '', notes: '' 
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: gbData } = await supabase.from('green_beans').select('*');
      const { data: batchData } = await supabase.from('roasting_batches').select('*').neq('status', 'DELETED').order('roast_date', { ascending: false });
      const { data: prodData } = await supabase.from('product_definitions').select('*');
      const { data: tempData } = await supabase.from('package_templates').select('*');
      const { data: locData } = await supabase.from('locations').select('*').eq('is_active', true);
      const { data: movementData } = await supabase
        .from('green_bean_movements')
        .select('quantity,movement_at,green_beans(origin,variety)')
        .eq('movement_type', 'ROASTING_CONSUMPTION')
        .order('movement_at', { ascending: false });

      if (gbData) setBeans(gbData.map(b => ({ id: b.id, label: `${b.origin} - ${b.variety}`, quantity: b.quantity || 0, cost_per_kg: b.cost_per_kg || 0, supplier: b.supplier })));
      if (prodData) setProducts(prodData.map(p => ({ 
        ...p, 
        basePrice: p.base_price, 
        roastLevel: p.roast_level, 
        templateId: p.template_id, 
        isActive: p.product_status ? p.product_status === 'ACTIVE' : p.is_active, 
        productStatus: p.product_status || (p.is_active === false ? 'DISABLED' : 'ACTIVE')
      } as any)));
      if (tempData) setTemplates(tempData.map(tm => ({ ...tm, sizeLabel: tm.size_label, weightInKg: tm.weight_in_kg, unitCost: tm.unit_cost, shelf_life_days: tm.shelf_life_days, skuPrefix: tm.sku_prefix, isActive: tm.is_active } as any)));
      if (locData) {
        setLocations(locData);
        if (locData.length > 0) setProductionDates(prev => ({ ...prev, targetLocationId: locData.find(l => l.is_roastery)?.id || locData[0].id }));
      }
      if (movementData) {
        const monthlyMap = new Map<string, { month: string; variety: string; totalKg: number }>();
        movementData.forEach((row: any) => {
          const movementAt = row.movement_at ? new Date(row.movement_at) : null;
          if (!movementAt) return;
          const month = `${movementAt.getFullYear()}-${String(movementAt.getMonth() + 1).padStart(2, '0')}`;
          const beanInfo = row.green_beans;
          const variety = beanInfo ? `${beanInfo.origin} - ${beanInfo.variety}` : t.unknown;
          const key = `${month}|${variety}`;
          const current = monthlyMap.get(key) || { month, variety, totalKg: 0 };
          current.totalKg += Number(row.quantity || 0);
          monthlyMap.set(key, current);
        });
        const rows = Array.from(monthlyMap.values());
        rows.sort((a, b) => {
          if (a.month === b.month) return a.variety.localeCompare(b.variety);
          return a.month.localeCompare(b.month);
        });
        setMonthlyConsumption(rows);
      } else {
        setMonthlyConsumption([]);
      }
      
      if (batchData) {
        const mapped = batchData.map(mapBatchFromDB);
        setActiveBatches(mapped.filter(b => b.status === BatchStatus.IN_PROGRESS));
        setCompletedBatches(mapped.filter(b => b.status !== BatchStatus.IN_PROGRESS));
      }
    } catch (err) { console.error('Fetch error:', err); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const mapBatchFromDB = (item: any): RoastingBatch => ({
    id: item.id, beanId: item.bean_id, roastDate: item.roast_date, roastTime: item.roast_time,
    level: item.level as RoastingLevel, preWeight: item.pre_weight, postWeight: item.post_weight || 0,
    wastePercentage: item.waste_percentage || 0, status: item.status as BatchStatus, operator: item.operator,
    notes: item.notes || '', history: item.history || [], costPerKg: item.cost_per_kg || 0, 
    packagingUnits: item.packaging_units || []
  });

  const getBatchWeightStats = (batch: RoastingBatch | null) => {
    if (!batch) return { packaged: 0, remaining: 0 };
    const packaged = batch.packagingUnits.reduce((acc, u) => {
      const tpl = templates.find(t => t.id === u.templateId);
      return acc + (u.quantity * (tpl?.weightInKg || 0));
    }, 0);
    return { packaged, remaining: batch.postWeight - packaged };
  };

  const totalBatchPackagingWeightNeeded = useMemo(() => {
    return packagingLines.reduce((acc, line) => {
      const product = products.find(p => p.id === line.productId);
      const template = templates.find(t => t.id === product?.templateId);
      if (!template) return acc;
      return acc + (parseInt(line.quantity || '0') * template.weightInKg);
    }, 0);
  }, [packagingLines, products, templates]);

  const handleOpenProduction = (batch: RoastingBatch) => {
    setPackagingLines([{ tempId: crypto.randomUUID(), productId: '', quantity: '1' }]);
    setProductionDates(prev => ({
      ...prev,
      productionDate: batch.roastDate,
      packagingDate: new Date().toISOString().split('T')[0]
    }));
    setShowProductionModal(batch);
  };

  const addPackagingLine = () => {
    setPackagingLines([...packagingLines, { tempId: crypto.randomUUID(), productId: '', quantity: '1' }]);
  };

  const removePackagingLine = (tempId: string) => {
    if (packagingLines.length > 1) {
      setPackagingLines(packagingLines.filter(l => l.tempId !== tempId));
    }
  };

  const updatePackagingLine = (tempId: string, field: keyof PackagingLine, value: string) => {
    setPackagingLines(packagingLines.map(l => l.tempId === tempId ? { ...l, [field]: value } : l));
  };

  const handleCreateProduction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showProductionModal || isSaving) return;
    
    const { remaining } = getBatchWeightStats(showProductionModal);
    
    if (totalBatchPackagingWeightNeeded > remaining + 0.001) {
       alert(t.insufficientBatchWeight);
       return;
    }

    setIsSaving(true);
    const now = new Date();
    
    try {
      const newUnits: PackagingUnit[] = [];
      const inventoryItemsToInsert: any[] = [];

      for (const line of packagingLines) {
        if (!line.productId || !line.quantity) continue;
        
        const product = products.find(p => p.id === line.productId);
        const template = templates.find(tm => tm.id === product?.templateId);
        const qty = parseInt(line.quantity);
        
        const expDate = new Date(productionDates.productionDate);
        expDate.setDate(expDate.getDate() + (template?.shelf_life_days || 180));
        const expiry = expDate.toISOString().split('T')[0];

        const unit: PackagingUnit = {
          id: crypto.randomUUID(),
          timestamp: now.toISOString(),
          templateId: template!.id,
          productId: product!.id,
          size: template!.sizeLabel,
          quantity: qty,
          operator: user?.name || 'System',
          packagingCostTotal: qty * template!.unitCost,
          productionDate: productionDates.productionDate,
          expiryDate: expiry,
          packagingDate: productionDates.packagingDate,
          sku: `${template!.skuPrefix}-${showProductionModal.id.split('-').pop()}-${Math.floor(1000 + Math.random() * 9000)}`
        };

        newUnits.push(unit);

        inventoryItemsToInsert.push({
          name: product!.name, 
          category: product!.category, 
          type: 'PACKAGED_COFFEE', 
          size: template!.sizeLabel,
          price: product!.basePrice, 
          stock: qty, 
          batch_id: showProductionModal.id, 
          product_id: product!.id,
          sku_prefix: template!.skuPrefix, 
          image: product!.image || 'https://picsum.photos/seed/coffee/200/200',
          location_id: productionDates.targetLocationId,
          expiry_date: expiry
        });
      }

      await supabase.from('roasting_batches').update({
        packaging_units: [...showProductionModal.packagingUnits, ...newUnits],
        history: [...showProductionModal.history, { 
          timestamp: now.toLocaleString(), 
          action: 'BATCH_PRODUCTION', 
          operator: user?.name || 'System', 
          details: `Batch Packaged: ${newUnits.length} items. Total Weight: ${totalBatchPackagingWeightNeeded.toFixed(2)}kg.` 
        }]
      }).eq('id', showProductionModal.id);

      if (inventoryItemsToInsert.length > 0) {
        await supabase.from('inventory_items').insert(inventoryItemsToInsert);
        
        // --- Thermal Receipt Integration ---
        // Prepare production data for the thermal receipt module
        const productionData = {
          store_name: t.appName || 'Doha Roastery',
          invoice_no: `PROD-${showProductionModal.id.split('-').pop()}`,
          date: new Date().toLocaleString(),
          items: inventoryItemsToInsert.map(item => ({
            name: item.name,
            quantity: item.stock,
            price: item.price,
            size: item.size
          })),
          footer_msg: t.productionCompleted,
          is_reprint: false
        };

        // Note: In a production environment with a backend, we would call the Python module via API.
        // For this local simulation, we log the intent and the data structure.
        console.log("Generating Production Receipt:", productionData);
      }

      fetchData();
      setShowProductionModal(null);
      setShowSuccess(true);
      setSuccessMsg(t.saveSuccess);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch(err) { 
      console.error(err);
      alert(t.productionSyncFailed);
    } finally { 
      setIsSaving(false); 
    }
  };

  const handleStartBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    const pre = parseFloat(newBatchData.preWeight);
    const selectedBean = beans.find(b => b.id === newBatchData.beanId);
    if (!selectedBean || isNaN(pre) || pre <= 0 || pre > selectedBean.quantity) {
      alert(t.insufficientStock);
      return;
    }
    setIsSaving(true);
    const now = new Date();
    const batchCode = `B-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}-${Math.floor(1000 + Math.random() * 9000)}`;
    const payload = {
      id: batchCode, bean_id: selectedBean.id, roast_date: now.toISOString().split('T')[0],
      roast_time: now.toTimeString().split(' ')[0], level: newBatchData.level, pre_weight: pre,
      status: BatchStatus.IN_PROGRESS, operator: user?.name || 'Roaster', notes: newBatchData.notes,
      cost_per_kg: selectedBean.cost_per_kg, history: [{ 
        timestamp: now.toLocaleString(), action: 'CREATE', operator: user?.name || 'System',
        details: `Batch created with ${pre}kg of ${selectedBean.label}`
      }]
    };
    try {
      const { data: freshBean, error: beanError } = await supabase
        .from('green_beans')
        .select('quantity')
        .eq('id', selectedBean.id)
        .single();
      if (beanError || !freshBean || pre > (freshBean.quantity || 0)) {
        alert(t.insufficientStock);
        return;
      }
      const { error: batchInsertError } = await supabase.from('roasting_batches').insert([payload]);
      if (batchInsertError) throw batchInsertError;
      const { error: beanUpdateError } = await supabase
        .from('green_beans')
        .update({ quantity: (freshBean.quantity || 0) - pre })
        .eq('id', selectedBean.id);
      if (beanUpdateError) throw beanUpdateError;
      const { error: movementError } = await supabase.from('green_bean_movements').insert({
        bean_id: selectedBean.id,
        batch_reference: batchCode,
        movement_type: 'ROASTING_CONSUMPTION',
        quantity: pre,
        unit: 'kg',
        movement_at: now.toISOString(),
        created_by: user?.id || null,
        created_by_name: user?.name || 'System',
        notes: `Batch ${batchCode} consumption`
      });
      if (movementError) throw movementError;
      fetchData();
      setShowNewBatchModal(false);
      setShowSuccess(true);
      setSuccessMsg(t.saveSuccess);
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (err) {
      console.error(err);
      alert(t.actionFailed || 'Operation failed');
    }
    finally { setIsSaving(false); }
  };

  const handleFinishBatch = async (batchId: string) => {
    if (isSaving) return;
    const post = parseFloat(postWeightInput);
    const batch = activeBatches.find(b => b.id === batchId);
    if (!batch || isNaN(post) || post <= 0) return;
    setIsSaving(true);
    const waste = ((batch.preWeight - post) / batch.preWeight * 100);
    const historyEntry = { 
      timestamp: new Date().toLocaleString(), action: 'UPDATE', operator: user?.name || 'Roaster', 
      details: t.batchOutputRecorded.replace('{weight}', post.toString()).replace('{waste}', waste.toFixed(2)) 
    };
    try {
      const { error: finishError } = await supabase.from('roasting_batches').update({
        post_weight: post, waste_percentage: parseFloat(waste.toFixed(2)), status: BatchStatus.COMPLETED,
        history: [...batch.history, historyEntry]
      }).eq('id', batchId);
      if (finishError) throw finishError;
      fetchData();
      setFinishingBatchId(null);
      setPostWeightInput('');
      setShowSuccess(true);
      setSuccessMsg(t.roastCompleted);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      alert(t.actionFailed || 'Operation failed');
    } finally { setIsSaving(false); }
  };

  const handleCancelBatch = async (batch: RoastingBatch) => {
    if (isSaving) return;
    if (!confirm(t.confirmCancelBatch)) return;
    const isUnstarted = !batch.postWeight || batch.postWeight <= 0;
    if (!isUnstarted) {
      alert(t.batchAlreadyStarted);
      return;
    }
    setIsSaving(true);
    try {
      const { data: freshBean, error: beanError } = await supabase
        .from('green_beans')
        .select('quantity')
        .eq('id', batch.beanId)
        .single();
      if (beanError || !freshBean) throw beanError;
      const { error: beanRestoreError } = await supabase.from('green_beans')
        .update({ quantity: (freshBean.quantity || 0) + batch.preWeight })
        .eq('id', batch.beanId);
      if (beanRestoreError) throw beanRestoreError;
      const { error: movementDeleteError } = await supabase.from('green_bean_movements')
        .delete()
        .eq('batch_reference', batch.id);
      if (movementDeleteError) throw movementDeleteError;
      const historyEntry = {
        timestamp: new Date().toLocaleString(),
        action: 'DELETE',
        operator: user?.name || 'System',
        details: `Batch cancelled. Restored ${batch.preWeight}kg to green beans`
      };
      const { error: batchCancelError } = await supabase.from('roasting_batches').update({
        status: BatchStatus.DELETED,
        history: [...batch.history, historyEntry]
      }).eq('id', batch.id);
      if (batchCancelError) throw batchCancelError;
      fetchData();
      setShowSuccess(true);
      setSuccessMsg(t.batchCancelled);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      alert(t.actionFailed || 'Operation failed');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredHistory = useMemo(() => {
    return completedBatches.filter(batch => {
      const matchesSearch = batch.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesLevel = filterLevel === 'ALL' || batch.level === filterLevel;
      const { remaining } = getBatchWeightStats(batch);
      const isReady = remaining > 0.1;
      return matchesSearch && matchesLevel && (!showOnlyReady || isReady);
    });
  }, [completedBatches, searchTerm, filterLevel, showOnlyReady, templates]);

  const hasProducts = products.length > 0;

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-20">
      {showSuccess && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-white  text-black  px-8 py-3 rounded-full font-bold flex items-center gap-3 animate-in slide-in-from-top-4 shadow-xl z-[150] border border-orange-600">
          <CheckCircle2 size={24} /> {successMsg}
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-black  flex items-center gap-3">
             <Database className="text-black " /> {t.productionManagement}
          </h2>
          <p className="text-black">{t.trackBatches}</p>
        </div>
        <button onClick={() => setShowNewBatchModal(true)} className="w-full sm:w-auto bg-orange-600 text-white px-6 py-3 rounded-xl shadow-lg  font-bold flex items-center justify-center gap-2 transition-all active:scale-95">
          <Plus size={20} /> {t.startNewBatch}
        </button>
      </div>

      {activeBatches.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold flex items-center gap-2"><Clock className="text-black " /> {t.activeBatches}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeBatches.map(batch => (
              <div key={batch.id} className="bg-white  rounded-[32px] p-6 shadow-sm border border-orange-50  transition-all hover:shadow-md">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-[10px] font-bold text-black uppercase tracking-tighter">{batch.id}</span>
                    <h4 className="font-bold text-lg leading-tight">{beans.find(b => b.id === batch.beanId)?.label}</h4>
                  </div>
                  <span className="px-3 py-1 bg-orange-600 text-white rounded-full text-[10px] font-bold animate-pulse uppercase tracking-widest">{t.inProgress}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-6 text-sm">
                   <div className="bg-white  p-3 rounded-2xl"><span className="text-[10px] block text-black font-bold uppercase">{t.preWeight}</span><span className="font-bold font-mono">{batch.preWeight}kg</span></div>
                   <div className="bg-white  p-3 rounded-2xl"><span className="text-[10px] block text-black font-bold uppercase">{t.roastLevel}</span><span className="font-bold">{batch.level}</span></div>
                </div>
                {finishingBatchId === batch.id ? (
                  <div className="space-y-4">
                    <input type="number" step="0.01" autoFocus value={postWeightInput} onChange={e => setPostWeightInput(e.target.value)} className="w-full bg-white  border-none rounded-xl px-4 py-3 font-mono font-bold outline-none focus:ring-2 focus:ring-orange-600" placeholder="Output kg" />
                    <button onClick={() => handleFinishBatch(batch.id)} className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold flex justify-center gap-2 items-center  transition-colors">
                       {isSaving ? <Loader2 className="animate-spin" /> : <Check />} {t.finishRoasting}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <button onClick={() => setFinishingBatchId(batch.id)} className="w-full py-4 bg-orange-600 text-white rounded-2xl font-bold shadow-lg flex items-center justify-center gap-2 transition-all hover:scale-[1.02] hover">
                      <Scale size={18} /> {t.finishRoasting}
                    </button>
                    {(!batch.postWeight || batch.postWeight <= 0) && (
                      <button onClick={() => handleCancelBatch(batch)} className="w-full py-3 border border-orange-600 text-black rounded-2xl font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.02]">
                        <X size={16} /> {t.cancelBatch}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white  rounded-[40px] shadow-sm border border-orange-100  overflow-hidden">
        <div className="p-6 border-b border-orange-50  flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white">
          <div>
            <h3 className="font-bold flex items-center gap-2"><LayoutList size={18} className="text-black " /> {t.monthlyConsumptionTitle}</h3>
            <p className="text-black text-sm">{t.monthlyConsumptionSubtitle}</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className={`w-full ${t.dir === 'rtl' ? 'text-right' : 'text-left'} text-sm`}>
            <thead className="bg-white  text-black uppercase tracking-widest text-[10px] font-bold border-b border-orange-50 ">
              <tr>
                <th className="px-8 py-5">{t.month}</th>
                <th className="px-8 py-5">{t.variety}</th>
                <th className="px-8 py-5">{t.totalConsumption}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-orange-50 ">
              {monthlyConsumption.length === 0 ? (
                <tr>
                  <td className="px-8 py-6 text-black" colSpan={3}>{t.noConsumptionData}</td>
                </tr>
              ) : (
                monthlyConsumption.map(row => (
                  <tr key={`${row.month}-${row.variety}`}>
                    <td className="px-8 py-5 font-mono font-bold text-black">{row.month}</td>
                    <td className="px-8 py-5 text-black">{row.variety}</td>
                    <td className="px-8 py-5 font-mono font-bold text-black">{row.totalKg.toFixed(2)} kg</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white  rounded-[40px] shadow-sm border border-orange-100  overflow-hidden">
        <div className="p-6 border-b border-orange-50  flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white">
          <div>
            <h3 className="font-bold flex items-center gap-2"><History size={18} className="text-black " /> {t.roastingLogAvailable}</h3>
          </div>
          <div className="flex flex-wrap gap-3">
             <button onClick={() => setShowOnlyReady(!showOnlyReady)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${showOnlyReady ? 'bg-orange-600 text-white shadow-lg' : 'bg-white  border border-orange-100  text-black '}`}>
                <Package2 size={14} /> {t.readyOnly}
             </button>
             <input type="text" placeholder={t.searchProduct} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="bg-white  border border-orange-100  rounded-xl px-4 py-2 text-xs outline-none focus:ring-1 focus:ring-orange-600" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className={`w-full ${t.dir === 'rtl' ? 'text-right' : 'text-left'} text-sm`}>
            <thead className="bg-white  text-black uppercase tracking-widest text-[10px] font-bold border-b border-orange-50 ">
              <tr>
                <th className="px-8 py-5">{t.batchId}</th>
                <th className="px-8 py-5">{t.roastDateTime}</th>
                <th className="px-8 py-5">{t.postWeight}</th>
                <th className="px-8 py-5 text-black ">{t.weightRemaining}</th>
                <th className="px-8 py-5">{t.status}</th>
                <th className="px-8 py-5">{t.action}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-orange-50 ">
              {filteredHistory.map(batch => {
                const { remaining } = getBatchWeightStats(batch);
                const isReady = remaining > 0.1;
                return (
                  <tr key={batch.id} className=" /40 cursor-pointer group transition-colors" onClick={() => setShowDetailsModal(batch)}>
                    <td className="px-8 py-5 font-mono font-bold text-black group-hover:text-black ">{batch.id}</td>
                    <td className="px-8 py-5 text-black ">{batch.roastDate}</td>
                    <td className="px-8 py-5 font-mono font-bold">{batch.postWeight}kg</td>
                    <td className="px-8 py-5 font-black font-mono">
                       <span className={remaining < 1 ? 'text-black' : 'text-black '}>
                         {remaining.toFixed(2)}kg
                       </span>
                    </td>
                    <td className="px-8 py-5">
                       <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${isReady ? 'bg-orange-600 text-white  ' : 'border border-orange-600 text-black  '}`}>
                          {isReady ? t.ready : t.completed}
                       </span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2">
                         {isReady && <button onClick={(e) => { e.stopPropagation(); handleOpenProduction(batch); }} className="bg-orange-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-md  active:scale-95 transition-all flex items-center gap-2"><Package2 size={14} /> {t.package}</button>}
                         <div className="p-1.5 rounded-full bg-white  text-black group-hover:text-black  transition-colors"><ArrowRight size={14} className={t.dir === 'rtl' ? 'rotate-180' : ''} /></div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showProductionModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-white/60 backdrop-blur-md">
           <div className="bg-white  rounded-[40px] max-w-4xl w-full p-8 shadow-2xl animate-in zoom-in-95 overflow-y-auto max-h-[90vh] custom-scrollbar" dir={t.dir}>
              <div className="flex justify-between items-center mb-6">
                 <div>
                  <h3 className="text-2xl font-bold flex items-center gap-3"><Package2 className="text-black " /> {t.batchPackagingAllocation}</h3>
                 </div>
                 <button onClick={() => setShowProductionModal(null)} className="text-black  transition-colors"><X size={28} /></button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div className="bg-white  p-5 rounded-3xl border border-orange-100 ">
                   <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] uppercase font-black text-black">{t.weightRemaining}</span>
                      <span className="text-xs font-bold text-black ">{(getBatchWeightStats(showProductionModal).remaining - totalBatchPackagingWeightNeeded).toFixed(2)} kg</span>
                   </div>
                   <span className="text-2xl font-black font-mono text-black  block mt-2">
                     {getBatchWeightStats(showProductionModal).remaining.toFixed(2)} kg
                   </span>
                </div>
                <div className={`p-5 rounded-3xl border transition-all ${totalBatchPackagingWeightNeeded > getBatchWeightStats(showProductionModal).remaining ? 'bg-white border-orange-600  ' : 'bg-white border-orange-100  '}`}>
                   <span className="text-[10px] uppercase font-black text-black block mb-1">{t.weightNeeded}</span>
                   <span className={`text-2xl font-black font-mono ${totalBatchPackagingWeightNeeded > getBatchWeightStats(showProductionModal).remaining ? 'text-black  underline decoration-2' : 'text-black '}`}>
                     {totalBatchPackagingWeightNeeded.toFixed(2)} kg
                   </span>
                </div>
              </div>

              <form onSubmit={handleCreateProduction} className={`space-y-8 ${!hasProducts ? 'opacity-30 pointer-events-none grayscale' : ''}`}>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div className="space-y-1">
                       <label className="text-xs font-bold text-black uppercase flex items-center gap-1"><CalendarIcon size={12} /> {t.productionDate}</label>
                       <input type="date" required value={productionDates.productionDate} onChange={e => setProductionDates({...productionDates, productionDate: e.target.value})} className="w-full bg-white  border-none rounded-2xl px-4 py-4 font-bold outline-none focus:ring-2 focus:ring-orange-600" />
                    </div>
                    <div className="space-y-1">
                       <label className="text-xs font-bold text-black uppercase flex items-center gap-1"><CalendarIcon size={12} /> {t.packagingDate}</label>
                       <input type="date" required value={productionDates.packagingDate} onChange={e => setProductionDates({...productionDates, packagingDate: e.target.value})} className="w-full bg-white  border-none rounded-2xl px-4 py-4 font-bold outline-none focus:ring-2 focus:ring-orange-600" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-black uppercase flex items-center gap-1"><MapPin size={12} /> {t.destinationLocation}</label>
                       <select required value={productionDates.targetLocationId} onChange={e => setProductionDates({...productionDates, targetLocationId: e.target.value})} className="w-full bg-white  border-none rounded-2xl px-4 py-4 font-bold outline-none focus:ring-2 focus:ring-orange-600">
                          {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                       </select>
                    </div>
                 </div>

                 <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="text-sm font-bold uppercase text-black">{t.packagingLines}</h4>
                      <button type="button" onClick={addPackagingLine} className="text-black   font-bold text-xs flex items-center gap-1"><Plus size={14} /> {t.addProductLine}</button>
                    </div>
                    
                    <div className="space-y-3">
                       {packagingLines.map((line, index) => {
                          const selectedProd = products.find(p => p.id === line.productId);
                          const template = templates.find(t => t.id === selectedProd?.templateId);
                          const lineWeight = template ? parseInt(line.quantity || '0') * template.weightInKg : 0;

                          return (
                             <div key={line.tempId} className={`flex flex-col md:flex-row gap-4 p-4 rounded-2xl border transition-all animate-in slide-in-from-top-2 duration-300 bg-white/50 border-orange-100 `}>
                                <div className="flex-1 space-y-1">
                                   <select required value={line.productId} onChange={e => updatePackagingLine(line.tempId, 'productId', e.target.value)} className={`w-full bg-white  border-none rounded-xl px-3 py-3 font-bold outline-none focus:ring-2 focus:ring-orange-600`}>
                                      <option value="">-- {t.selectProduct} --</option>
                                      {products.filter(p => p.productStatus === 'ACTIVE').map(p => {
                                        const tpl = templates.find(t => t.id === p.templateId);
                                        return <option key={p.id} value={p.id}>{p.name} ({tpl?.sizeLabel})</option>;
                                      })}
                                   </select>
                                </div>
                                <div className="w-full md:w-28 space-y-1">
                                   <input type="number" required value={line.quantity} onChange={e => updatePackagingLine(line.tempId, 'quantity', e.target.value)} className="w-full bg-white  border-none rounded-xl px-3 py-3 font-mono font-bold outline-none focus:ring-2 focus:ring-orange-600" min="1" />
                                </div>
                                <div className="w-full md:w-28 space-y-1">
                                   <div className="bg-white/50 /50 px-3 py-3 rounded-xl font-mono font-bold text-black text-center border border-orange-50 ">
                                      {lineWeight.toFixed(2)} kg
                                   </div>
                                </div>
                                <button type="button" onClick={() => removePackagingLine(line.tempId)} disabled={packagingLines.length === 1} className="p-3 text-black hover:text-black  disabled:opacity-30 transition-colors"><Trash2 size={20} /></button>
                             </div>
                          );
                       })}
                    </div>
                 </div>

                 <div className="flex gap-4 pt-6">
                    <button type="button" onClick={() => setShowProductionModal(null)} className="flex-1 font-bold text-black  transition-colors">{t.cancel}</button>
                    <button type="submit" disabled={isSaving || totalBatchPackagingWeightNeeded <= 0 || totalBatchPackagingWeightNeeded > getBatchWeightStats(showProductionModal).remaining} className="flex-[2] py-4 bg-orange-600 text-white rounded-2xl font-bold shadow-xl flex items-center justify-center gap-2  active:scale-95 transition-all disabled:opacity-50">
                      {isSaving ? <Loader2 className="animate-spin" /> : <Save size={20} />} {t.confirmPackaging}
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {showDetailsModal && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-white/60 backdrop-blur-md animate-in fade-in duration-300 overflow-y-auto">
           <div className="bg-white  rounded-[40px] max-w-4xl w-full shadow-2xl overflow-hidden relative my-8" dir={t.dir}>
              <div className="p-8 border-b border-orange-50  flex justify-between items-center bg-white/50 /40">
                 <div className="flex items-center gap-5">
                    <div className="p-4 bg-orange-600 text-white rounded-3xl shadow-lg"><Coffee size={32} /></div>
                    <div><h3 className="text-2xl font-bold">{t.batchDetails}</h3><span className="text-black font-mono text-sm">{showDetailsModal.id}</span></div>
                 </div>
                 <button onClick={() => setShowDetailsModal(null)} className="p-3 text-black  rounded-full transition-all"><X size={32} /></button>
              </div>
              <div className="p-8 space-y-10">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white  p-6 rounded-[32px] border border-orange-50 "><span className="text-[10px] font-black uppercase text-black block mb-2">{t.preWeight}</span><span className="text-2xl font-black font-mono">{showDetailsModal.preWeight}kg</span></div>
                    <div className="bg-white  p-6 rounded-[32px] border border-orange-50 "><span className="text-[10px] font-black uppercase text-black block mb-2">{t.postWeight}</span><span className="text-2xl font-black font-mono">{showDetailsModal.postWeight}kg</span></div>
                    <div className="bg-white  p-6 rounded-[32px] border border-orange-50 "><span className="text-[10px] font-black uppercase text-black  block mb-2">{t.wasteRatio}</span><span className="text-2xl font-black font-mono text-black ">{showDetailsModal.wastePercentage}%</span></div>
                 </div>
                 <div className="space-y-4">
                    <h4 className="text-sm font-bold flex items-center gap-2 text-black "><Layers size={18} /> {t.packagingUnits}</h4>
                    {showDetailsModal.packagingUnits.length > 0 ? (
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {showDetailsModal.packagingUnits.map((unit) => (
                             <div key={unit.id} className="bg-white  border border-orange-100  rounded-2xl p-5 group flex items-center gap-4">
                                <div className="p-3 bg-white  rounded-xl"><QrCode className="text-black group-hover:text-black  transition-colors" size={24} /></div>
                                <div className="flex-1 min-w-0">
                                   <div className="flex justify-between mb-1">
                                      <h5 className="font-bold text-xs truncate">{products.find(p => p.id === unit.productId)?.name || unit.size}</h5>
                                      <span className="text-[10px] font-mono text-black">{unit.sku}</span>
                                   </div>
                                   <div className="flex gap-2 text-[10px] text-black">
                                      <span className="font-bold">{unit.quantity} {t.units}</span>
                                     <span>• {t.expShort} {unit.expiryDate}</span>
                                   </div>
                                </div>
                                <button onClick={() => setShowPrintLabelModal(unit)} className="p-3 bg-white  text-black hover:text-black  rounded-xl transition-all"><Printer size={20} /></button>
                             </div>
                          ))}
                       </div>
                   ) : (<div className="p-8 text-center text-black bg-white/40 rounded-3xl border-2 border-dashed border-orange-50 ">{t.noPackagingUnits}</div>)}
                 </div>
              </div>
           </div>
        </div>
      )}

      {showPrintLabelModal && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-white/60 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white  rounded-[40px] max-w-md w-full p-8 shadow-2xl relative" dir={t.dir}>
              <div className="flex justify-between items-center mb-8 border-b border-orange-50  pb-4">
                 <h3 className="text-xl font-bold flex items-center gap-2"><Printer className="text-black " /> {t.printPreview}</h3>
                 <button onClick={() => setShowPrintLabelModal(null)} className="text-black hover"><X size={24} /></button>
              </div>
              <div id="label-to-print" className="bg-white border-2 border-orange-200 rounded-lg p-6 flex flex-col items-center text-black shadow-inner mb-8">
                 <div className="w-full flex justify-between items-start mb-4">
                    <div className="bg-orange-600 text-white p-1 rounded font-black text-[8px] tracking-tighter uppercase">Doha Roastery</div>
                    <div className="text-[8px] font-mono font-bold">{showPrintLabelModal.sku}</div>
                 </div>
                 <div className="bg-white p-2 rounded-lg border border-orange-50 mb-4">
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${showPrintLabelModal.sku}`} alt="QR Code" className="w-32 h-32" />
                 </div>
                 <div className="w-full text-center space-y-1">
                    <h4 className="font-bold text-sm leading-tight">{products.find(p => p.id === showPrintLabelModal.productId)?.name || showPrintLabelModal.size}</h4>
                    <div className="text-[10px] text-black font-bold uppercase">{showPrintLabelModal.size}</div>
                 </div>
                 <div className="w-full grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-orange-50 text-[8px] font-bold uppercase text-black">
                    <div><span className="block text-[6px] opacity-60">{t.productionDate}</span>{showPrintLabelModal.productionDate}</div>
                    <div className="text-right"><span className="block text-[6px] opacity-60">{t.expiryDate}</span>{showPrintLabelModal.expiryDate}</div>
                 </div>
              </div>
              <div className="flex gap-4">
                 <button onClick={() => setShowPrintLabelModal(null)} className="flex-1 py-3 font-bold text-black  transition-colors">{t.cancel}</button>
                 <button onClick={() => { window.print(); setShowPrintLabelModal(null); }} className="flex-[2] py-4 bg-orange-600 text-white rounded-2xl font-bold shadow-xl flex items-center justify-center gap-2  active:scale-95 transition-all"><Printer size={20} /> {t.printNow}</button>
              </div>
           </div>
        </div>
      )}

      {showNewBatchModal && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-white/60 backdrop-blur-md">
          <div className="bg-white  rounded-[40px] max-w-xl w-full p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-bold flex items-center gap-3"><Flame className="text-black " /> {t.startNewBatch}</h3>
              <button onClick={() => setShowNewBatchModal(false)} className="text-black"><X size={28} /></button>
            </div>
            <form onSubmit={handleStartBatch} className="space-y-6" dir={t.dir}>
              <div className="space-y-1">
                <label className="text-xs font-bold text-black uppercase">{t.greenBeanSource}</label>
                <select required value={newBatchData.beanId} onChange={e => setNewBatchData({...newBatchData, beanId: e.target.value})} className="w-full bg-white  border-none rounded-2xl px-4 py-4 font-bold outline-none focus:ring-2 focus:ring-orange-600">
                  <option value="">-- {t.selectBean} --</option>
                  {beans.map(b => <option key={b.id} value={b.id}>{b.label} ({b.quantity}kg)</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-black uppercase">{t.roastLevel}</label>
                  <select value={newBatchData.level} onChange={e => setNewBatchData({...newBatchData, level: e.target.value as RoastingLevel})} className="w-full bg-white  border-none rounded-2xl px-4 py-4 font-bold">
                    <option value={RoastingLevel.LIGHT}>{t.light}</option>
                    <option value={RoastingLevel.MEDIUM}>{t.medium}</option>
                    <option value={RoastingLevel.DARK}>{t.dark}</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-black uppercase">{t.preWeight}</label>
                  <input type="number" step="0.1" required value={newBatchData.preWeight} onChange={e => setNewBatchData({...newBatchData, preWeight: e.target.value})} placeholder="0.0 kg" className="w-full bg-white  border-none rounded-2xl px-4 py-4 font-mono font-bold" />
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowNewBatchModal(false)} className="flex-1 font-bold text-black">{t.cancel}</button>
                <button type="submit" disabled={isSaving} className="flex-[2] py-4 bg-orange-600 text-white rounded-2xl font-bold shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all hover">
                   {isSaving ? <Loader2 className="animate-spin" /> : <Play />} {t.startRoasting}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoastingView;
