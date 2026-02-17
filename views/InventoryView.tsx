
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Package, Search, Plus, X, Edit, Trash2, 
  Loader2, CheckCircle2, Save, Database, AlertCircle, CloudOff, Cloud,
  MapPin, Store, Building2, User as UserIcon, Phone, 
  ChevronRight, Box, Coffee, Check, AlertTriangle, Users, Power, PowerOff,
  Activity, ArrowRightLeft, LayoutGrid, List, RefreshCw, Filter, Calendar, Tag, Layers,
  RotateCcw, FileDown, FileSpreadsheet, Printer, DollarSign, Truck, Clock, 
  ChevronDown, ArrowRight, Clipboard, Send, ThumbsUp, PackageCheck, Ban, Scale,
  Minus, FileCheck, ClipboardCheck, Signature, History, ArrowDown, ArrowUp, FileText,
  Settings as SettingsIcon, XCircle
} from 'lucide-react';
import { useLanguage, useTheme } from '../App';
import { GreenBean, Location, InventoryItem, ContactPerson, ProductDefinition, UserRole } from '../types';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';

type TransferStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'IN_TRANSIT' | 'RECEIVED' | 'COMPLETED' | 'CANCELLED';
type AdjustmentReason = 'DAMAGE' | 'THEFT' | 'COUNTING_ERROR' | 'GIFT' | 'SAMPLE' | 'EXPIRY' | 'OTHER';
type AdjustmentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type PurchaseStatus = 'DRAFT' | 'ORDERED' | 'RECEIVED' | 'PARTIALLY_RECEIVED' | 'REJECTED' | 'CANCELLED';
type CountFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ANNUAL';

const TRANSFER_APPROVAL_THRESHOLD = 5000;
const ADJUSTMENT_APPROVAL_THRESHOLD = 1000;

interface TransferOrder {
  id: string;
  source_location_id: string;
  destination_location_id: string;
  status: TransferStatus;
  created_at: string;
  items_count: number;
  notes?: string;
  source_name?: string;
  destination_name?: string;
  manifest?: any[];
  received_manifest?: any[];
  total_value?: number;
  received_at?: string;
}

interface StockAdjustment {
  id: string;
  item_id: string;
  location_id: string;
  quantity: number;
  reason: AdjustmentReason;
  notes: string;
  status: AdjustmentStatus;
  created_at: string;
  user_name: string;
  item_name?: string;
  location_name?: string;
  value?: number;
}

interface PurchaseOrder {
  id: string;
  supplier_name: string;
  location_id: string;
  status: PurchaseStatus;
  created_at: string;
  received_at?: string;
  notes?: string;
  created_by?: string;
  items_count?: number;
  total_value?: number;
  manifest?: any[];
  received_manifest?: any[];
}

interface InventoryCountTask {
  id: string;
  name: string;
  location_id: string;
  frequency: CountFrequency;
  start_date: string;
  next_run_date: string;
  last_run_date?: string | null;
  status: 'ACTIVE' | 'PAUSED';
  notes?: string | null;
  created_at: string;
}

interface InventoryCountEntry {
  id: string;
  count_task_id: string | null;
  inventory_item_id: string;
  location_id: string;
  counted_qty: number;
  system_qty: number | null;
  variance: number | null;
  variance_percent?: number | null;
  variance_value?: number | null;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  counted_at: string;
  counted_by?: string | null;
  counted_by_name?: string | null;
  approved_by?: string | null;
  approved_by_name?: string | null;
  approved_at?: string | null;
  notes?: string | null;
}

const InventoryView: React.FC = () => {
  const { lang, t } = useLanguage();
  const { user } = useAuth();
  const { theme } = useTheme();
  
  const [activeTab, setActiveTab] = useState<'locations' | 'packaged' | 'transfers' | 'adjustments' | 'purchases' | 'counts'>('locations');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [stagnantDays, setStagnantDays] = useState('30');
  
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  
  const [packagedItems, setPackagedItems] = useState<InventoryItem[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [transferOrders, setTransferOrders] = useState<TransferOrder[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [countTasks, setCountTasks] = useState<InventoryCountTask[]>([]);
  const [countEntries, setCountEntries] = useState<InventoryCountEntry[]>([]);

  const [adjustmentForm, setAdjustmentForm] = useState({
    locationId: '',
    itemId: '',
    quantity: '',
    reason: 'COUNTING_ERROR' as AdjustmentReason,
    notes: ''
  });

  // Location Management State
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationForm, setLocationForm] = useState<Partial<Location>>({
    name: '', type: 'BRANCH', address: '', contact_person: { name: '', phone: '', email: '' }, is_active: true
  });

  // Transfer Management State
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferForm, setTransferForm] = useState({
    sourceId: '', destinationId: '', notes: '', items: [] as { itemId: string, quantity: number, name: string, currentStock: number }[]
  });
  const [selectedTransferItem, setSelectedTransferItem] = useState('');
  const [transferItemQty, setTransferItemQty] = useState('');

  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [selectedPurchaseOrder, setSelectedPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const [receiptLines, setReceiptLines] = useState<Array<{ itemId: string; name: string; orderedQty: number; receivedQty: number; qualityStatus: 'PASSED' | 'FAILED'; expiryDate?: string }>>([]);
  const [purchaseForm, setPurchaseForm] = useState({
    supplierName: '',
    locationId: '',
    notes: '',
    items: [] as { itemId: string; quantity: number; unitCost: number; name: string }[]
  });
  const [selectedPurchaseItem, setSelectedPurchaseItem] = useState('');
  const [purchaseItemQty, setPurchaseItemQty] = useState('');
  const [purchaseItemCost, setPurchaseItemCost] = useState('');

  const [showCountTaskModal, setShowCountTaskModal] = useState(false);
  const [countTaskForm, setCountTaskForm] = useState({
    name: '',
    locationId: '',
    frequency: 'DAILY' as CountFrequency,
    startDate: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [showCountEntryModal, setShowCountEntryModal] = useState(false);
  const [countEntryLocationId, setCountEntryLocationId] = useState('');
  const [countEntryTaskId, setCountEntryTaskId] = useState('');
  const [countEntryNotes, setCountEntryNotes] = useState('');
  const [countEntryValues, setCountEntryValues] = useState<Record<string, string>>({});

  const getAvailableStock = (item: InventoryItem) => {
    const reserved = item.reserved_stock || 0;
    const damaged = item.damaged_stock || 0;
    return Math.max(0, item.stock - reserved - damaged);
  };

  const getDaysToExpiry = (item: InventoryItem) => {
    if (!item.expiry_date) return null;
    return Math.ceil((new Date(item.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  };

  const getDaysSinceMovement = (item: InventoryItem) => {
    if (!item.last_movement_at) return null;
    return Math.floor((new Date().getTime() - new Date(item.last_movement_at).getTime()) / (1000 * 60 * 60 * 24));
  };

  const getStockStatus = (item: InventoryItem) => {
    const available = getAvailableStock(item);
    if (available <= (item.min_stock || 10)) return 'CRITICAL';
    const daysToExpiry = getDaysToExpiry(item);
    if (daysToExpiry !== null && daysToExpiry <= 30) return 'EXPIRING';
    return 'GOOD';
  };

  const getFrequencyLabel = (frequency: CountFrequency) => {
    if (frequency === 'DAILY') return t.daily;
    if (frequency === 'WEEKLY') return t.weekly;
    if (frequency === 'MONTHLY') return t.monthly;
    return t.annual;
  };

  const stagnantDaysValue = useMemo(() => {
    const parsed = Number(stagnantDays);
    if (!Number.isFinite(parsed) || parsed <= 0) return 30;
    return Math.floor(parsed);
  }, [stagnantDays]);

  const stagnantItems = useMemo(() => {
    const now = new Date().getTime();
    return packagedItems
      .map(item => {
        if (!item.last_movement_at) return null;
        const days = Math.floor((now - new Date(item.last_movement_at).getTime()) / (1000 * 60 * 60 * 24));
        return days >= stagnantDaysValue ? { item, days } : null;
      })
      .filter((entry): entry is { item: InventoryItem; days: number } => Boolean(entry))
      .sort((a, b) => b.days - a.days);
  }, [packagedItems, stagnantDaysValue]);

  const inventorySummary = useMemo(() => {
    const totalItems = packagedItems.length;
    const totalStock = packagedItems.reduce((acc, item) => acc + (item.stock || 0), 0);
    const totalValue = packagedItems.reduce((acc, item) => acc + (getAvailableStock(item) * (item.cost_per_unit || 0)), 0);
    const lowStock = packagedItems.filter(i => getStockStatus(i) === 'CRITICAL').length;
    const highStock = packagedItems.filter(i => typeof i.max_stock === 'number' && i.stock > i.max_stock).length;
    const expiring30 = packagedItems.filter(i => {
      const days = getDaysToExpiry(i);
      return days !== null && days <= 30;
    }).length;
    const expiring14 = packagedItems.filter(i => {
      const days = getDaysToExpiry(i);
      return days !== null && days <= 14;
    }).length;
    const expiring7 = packagedItems.filter(i => {
      const days = getDaysToExpiry(i);
      return days !== null && days <= 7;
    }).length;
    const stagnantCount = stagnantItems.length;
    return { totalItems, totalStock, totalValue, lowStock, highStock, expiring30, expiring14, expiring7, stagnantCount };
  }, [packagedItems, stagnantItems]);

  const productLocationSummary = useMemo(() => {
    const summaryMap = new Map<string, { productKey: string; productName: string; locationId: string | null; locationName: string; stock: number; available: number; unit?: string }>();
    const getLocationName = (id: string | null) => locations.find(l => l.id === id)?.name || 'Central';
    packagedItems.forEach(item => {
      const productKey = item.productId || item.name;
      const locationId = item.location_id || null;
      const key = `${productKey}::${locationId || 'central'}`;
      const existing = summaryMap.get(key);
      const stock = item.stock || 0;
      const available = getAvailableStock(item);
      if (existing) {
        existing.stock += stock;
        existing.available += available;
        if (!existing.unit && item.unit) existing.unit = item.unit;
      } else {
        summaryMap.set(key, {
          productKey,
          productName: item.name,
          locationId,
          locationName: getLocationName(locationId),
          stock,
          available,
          unit: item.unit
        });
      }
    });
    const rows = Array.from(summaryMap.values());
    rows.sort((a, b) => {
      if (a.productName === b.productName) return a.locationName.localeCompare(b.locationName);
      return a.productName.localeCompare(b.productName);
    });
    const term = searchTerm.toLowerCase().trim();
    if (!term) return rows;
    return rows.filter(row => row.productName.toLowerCase().includes(term) || row.locationName.toLowerCase().includes(term));
  }, [packagedItems, locations, searchTerm]);

  const filteredCountTasks = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return countTasks.filter(task => {
      const locationName = locations.find(l => l.id === task.location_id)?.name || '';
      return task.name.toLowerCase().includes(term) || locationName.toLowerCase().includes(term);
    });
  }, [countTasks, locations, searchTerm]);

  const filteredCountEntries = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return countEntries.filter(entry => {
      const itemName = packagedItems.find(i => i.id === entry.inventory_item_id)?.name || '';
      const locationName = locations.find(l => l.id === entry.location_id)?.name || '';
      const statusLabel = (entry.status || 'PENDING').toLowerCase();
      const countedBy = (entry.counted_by_name || '').toLowerCase();
      return itemName.toLowerCase().includes(term)
        || locationName.toLowerCase().includes(term)
        || statusLabel.includes(term)
        || countedBy.includes(term);
    });
  }, [countEntries, packagedItems, locations, searchTerm]);

  const countEntryItems = useMemo(() => {
    if (!countEntryLocationId) return [];
    return packagedItems.filter(item => item.location_id === countEntryLocationId);
  }, [countEntryLocationId, packagedItems]);

  const handleExportInventory = () => {
    const headers = ['Name', 'SKU', 'Location', 'Stock', 'Unit', 'Cost', 'Value', 'Status'];
    const csvContent = [
        headers.join(','),
        ...packagedItems.map(item => {
            const status = getStockStatus(item);
            return [
                `"${item.name}"`,
                item.skuPrefix || '',
                locations.find(l => l.id === item.location_id)?.name || 'Central',
                item.stock,
                item.unit || 'PCS',
                item.cost_per_unit || 0,
                (item.stock * (item.cost_per_unit || 0)).toFixed(2),
                status
            ].join(',');
        })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `inventory_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleUpdateTransferStatus = async (order: TransferOrder, newStatus: TransferStatus) => {
    if (!confirm(t.confirmUpdateTransfer)) return;
    
    setIsSaving(true);
    try {
        // If completing, we need to move stock
        if (newStatus === 'COMPLETED') {
             const items = order.manifest || [];
             
             for (const item of items) {
                 // Decrement Source
                 const sourceItem = packagedItems.find(i => i.id === item.itemId);
                 if (sourceItem) {
                     await supabase.from('inventory_items')
                        .update({ stock: Math.max(0, sourceItem.stock - item.quantity), last_movement_at: new Date().toISOString() })
                        .eq('id', sourceItem.id);
                 }
                 
                 // Increment Destination (Find or Create)
                 const { data: destItems } = await supabase.from('inventory_items')
                    .select('*')
                    .eq('location_id', order.destination_location_id)
                    .eq('name', item.name); 
                 
                 if (destItems && destItems.length > 0) {
                     await supabase.from('inventory_items')
                        .update({ stock: destItems[0].stock + item.quantity, last_movement_at: new Date().toISOString() })
                        .eq('id', destItems[0].id);
                 } else if (sourceItem) {
                     const newItem = {
                         ...sourceItem,
                         id: undefined,
                         location_id: order.destination_location_id,
                         stock: item.quantity,
                         last_movement_at: new Date().toISOString()
                     };
                     delete newItem.id;
                     await supabase.from('inventory_items').insert(newItem);
                 }
             }
        }

        const { error } = await supabase.from('stock_transfers')
            .update({ status: newStatus, received_at: newStatus === 'COMPLETED' ? new Date().toISOString() : null })
            .eq('id', order.id);
            
        if (error) throw error;
        
        setSuccessMsg(t.transferUpdated);
        setShowSuccess(true);
        fetchData();
        setTimeout(() => setShowSuccess(false), 3000);
        
    } catch (err) {
        console.error(err);
        alert('Error updating transfer');
    } finally {
        setIsSaving(false);
    }
  };

  const addItemToPurchase = () => {
    if (!selectedPurchaseItem || !purchaseItemQty) return;
    const item = packagedItems.find(i => i.id === selectedPurchaseItem);
    if (!item) return;
    const qty = Number(purchaseItemQty);
    const unitCost = Number(purchaseItemCost || item.cost_per_unit || 0);
    if (!Number.isFinite(qty) || qty <= 0) return;

    setPurchaseForm(prev => ({
      ...prev,
      items: [...prev.items, { itemId: item.id, quantity: qty, unitCost, name: item.name }]
    }));
    setSelectedPurchaseItem('');
    setPurchaseItemQty('');
    setPurchaseItemCost('');
  };

  const removePurchaseItem = (index: number) => {
    setPurchaseForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const openReceiveModal = (order: PurchaseOrder) => {
    const lines = (order.manifest || []).map((item: any) => ({
      itemId: item.itemId,
      name: item.name,
      orderedQty: item.quantity,
      receivedQty: item.quantity,
      qualityStatus: 'PASSED' as const,
      expiryDate: item.expiryDate || ''
    }));
    setSelectedPurchaseOrder(order);
    setReceiptLines(lines);
    setShowReceiveModal(true);
  };

  const handleSavePurchaseOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (purchaseForm.items.length === 0) return;
    if (!purchaseForm.supplierName || !purchaseForm.locationId) return;
    setIsSaving(true);
    try {
      const totalValue = purchaseForm.items.reduce((acc, item) => acc + (item.quantity * item.unitCost), 0);
      const payload = {
        supplier_name: purchaseForm.supplierName,
        location_id: purchaseForm.locationId,
        status: 'ORDERED',
        notes: purchaseForm.notes,
        created_by: user?.id === 'demo-user' ? null : user?.id,
        items_count: purchaseForm.items.length,
        total_value: totalValue,
        manifest: purchaseForm.items
      };

      const { data, error } = await supabase.from('purchase_orders').insert(payload).select();
      if (error) throw error;
      if (data) {
        setPurchaseOrders(prev => [data[0], ...prev]);
        setShowPurchaseModal(false);
        setPurchaseForm({ supplierName: '', locationId: '', notes: '', items: [] });
        setSuccessMsg(t.purchaseOrderCreated);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      }
    } catch (error) {
      console.error(error);
      alert(t.errorSavingPurchaseOrder);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdatePurchaseStatus = async (order: PurchaseOrder, newStatus: PurchaseStatus) => {
    if (!confirm(t.confirmUpdatePurchase)) return;
    setIsSaving(true);
    try {
      const isReceiptStatus = newStatus === 'RECEIVED' || newStatus === 'PARTIALLY_RECEIVED' || newStatus === 'REJECTED';
      const { error } = await supabase.from('purchase_orders')
        .update({ status: newStatus, received_at: isReceiptStatus ? new Date().toISOString() : null, received_manifest: isReceiptStatus ? order.received_manifest || order.manifest : null })
        .eq('id', order.id);
      if (error) throw error;

      setSuccessMsg(t.purchaseOrderUpdated);
      setShowSuccess(true);
      fetchData();
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (error) {
      console.error(error);
      alert(t.actionFailed);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmReceive = async () => {
    if (!selectedPurchaseOrder) return;
    if (!confirm(t.confirmUpdatePurchase)) return;
    setIsSaving(true);
    try {
      const normalizedLines = receiptLines.map(line => ({
        ...line,
        receivedQty: Math.max(0, Number(line.receivedQty) || 0),
        expiryDate: line.expiryDate || ''
      }));
      const hasAccepted = normalizedLines.some(line => line.qualityStatus === 'PASSED' && line.receivedQty > 0);
      const hasRejected = normalizedLines.some(line => line.qualityStatus === 'FAILED' || line.receivedQty < line.orderedQty);
      const status: PurchaseStatus = !hasAccepted ? 'REJECTED' : hasRejected ? 'PARTIALLY_RECEIVED' : 'RECEIVED';

      if (status !== 'REJECTED') {
        for (const line of normalizedLines) {
          if (line.qualityStatus !== 'PASSED' || line.receivedQty <= 0) continue;
          const currentStock = packagedItems.find(i => i.id === line.itemId)?.stock || 0;
          const { error: invError } = await supabase.from('inventory_items')
            .update({ stock: Math.max(0, currentStock + line.receivedQty), last_movement_at: new Date().toISOString() })
            .eq('id', line.itemId);
          if (invError) throw invError;
        }
      }

      const receivedManifest = normalizedLines.map(line => ({
        itemId: line.itemId,
        name: line.name,
        orderedQty: line.orderedQty,
        receivedQty: line.receivedQty,
        qualityStatus: line.qualityStatus,
        expiryDate: line.expiryDate || null
      }));

      const { error } = await supabase.from('purchase_orders')
        .update({
          status,
          received_at: new Date().toISOString(),
          received_manifest: receivedManifest
        })
        .eq('id', selectedPurchaseOrder.id);
      if (error) throw error;

      setSuccessMsg(t.purchaseOrderUpdated);
      setShowSuccess(true);
      setShowReceiveModal(false);
      setSelectedPurchaseOrder(null);
      setReceiptLines([]);
      fetchData();
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (error) {
      console.error(error);
      alert(t.actionFailed);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRejectReceipt = async () => {
    if (!selectedPurchaseOrder) return;
    if (!confirm(t.confirmUpdatePurchase)) return;
    setIsSaving(true);
    try {
      const receivedManifest = receiptLines.map(line => ({
        itemId: line.itemId,
        name: line.name,
        orderedQty: line.orderedQty,
        receivedQty: 0,
        qualityStatus: 'FAILED',
        expiryDate: line.expiryDate || null
      }));
      const { error } = await supabase.from('purchase_orders')
        .update({
          status: 'REJECTED',
          received_at: new Date().toISOString(),
          received_manifest: receivedManifest
        })
        .eq('id', selectedPurchaseOrder.id);
      if (error) throw error;

      setSuccessMsg(t.purchaseOrderUpdated);
      setShowSuccess(true);
      setShowReceiveModal(false);
      setSelectedPurchaseOrder(null);
      setReceiptLines([]);
      fetchData();
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (error) {
      console.error(error);
      alert(t.actionFailed);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const { data, error } = await supabase.from('locations').upsert(locationForm).select();
      if (error) throw error;
      if (data) {
         setLocations(prev => {
           const exists = prev.find(l => l.id === data[0].id);
           return exists ? prev.map(l => l.id === data[0].id ? data[0] : l) : [...prev, data[0]];
         });
         setShowLocationModal(false);
         setSuccessMsg(t.locationSaved);
         setShowSuccess(true);
         setTimeout(() => setShowSuccess(false), 3000);
      }
    } catch (error) {
      console.error('Error saving location:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (transferForm.items.length === 0) return;
    setIsSaving(true);
    try {
      const transferData = {
        source_location_id: transferForm.sourceId,
        destination_location_id: transferForm.destinationId,
        status: 'DRAFT', // Default to Draft as per requirements
        notes: transferForm.notes,
        created_by: user?.id,
        manifest: transferForm.items,
        items_count: transferForm.items.length
      };

      const { data, error } = await supabase.from('stock_transfers').insert(transferData).select();
      if (error) throw error;
      if (data) {
         setTransferOrders([data[0], ...transferOrders]);
         setShowTransferModal(false);
         setSuccessMsg(t.transferCreated);
         setShowSuccess(true);
         setTimeout(() => setShowSuccess(false), 3000);
      }
    } catch (error) {
      console.error('Error creating transfer:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const addItemToTransfer = () => {
    if (!selectedTransferItem || !transferItemQty) return;
    const item = packagedItems.find(i => i.id === selectedTransferItem);
    if (!item) return;

    if (Number(transferItemQty) > item.stock) {
      alert(t.insufficientStockAvailable);
      return;
    }
    
    setTransferForm(prev => ({
      ...prev,
      items: [...prev.items, { 
        itemId: item.id, 
        quantity: Number(transferItemQty), 
        name: item.name,
        currentStock: item.stock
      }]
    }));
    setSelectedTransferItem('');
    setTransferItemQty('');
  };

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
    const [invRes, locRes, adjRes, transRes, poRes, countRes, countEntryRes] = await Promise.all([
        supabase.from('inventory_items').select('*'),
        supabase.from('locations').select('*').order('name', { ascending: true }),
        supabase.from('stock_adjustments').select('*').order('created_at', { ascending: false }),
        supabase.from('stock_transfers').select('*').order('created_at', { ascending: false }),
        supabase.from('purchase_orders').select('*').order('created_at', { ascending: false }),
      supabase.from('inventory_count_tasks').select('*').order('created_at', { ascending: false }),
      supabase.from('inventory_count_entries').select('*').order('counted_at', { ascending: false })
      ]);

      if (invRes.data) setPackagedItems(invRes.data);
      if (locRes.data) setLocations(locRes.data);
      if (adjRes.data) setAdjustments(adjRes.data);
      if (transRes.data) setTransferOrders(transRes.data);
      if (poRes.data) setPurchaseOrders(poRes.data);
      if (countRes.data) setCountTasks(countRes.data);
    if (countEntryRes.data) setCountEntries(countEntryRes.data);

      setLastUpdated(new Date());
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveCountTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!countTaskForm.name || !countTaskForm.locationId) {
      alert(t.fieldRequired);
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        name: countTaskForm.name,
        location_id: countTaskForm.locationId,
        frequency: countTaskForm.frequency,
        start_date: countTaskForm.startDate,
        next_run_date: countTaskForm.startDate,
        status: 'ACTIVE',
        notes: countTaskForm.notes || null,
        created_by: user?.id || null
      };
      const { error } = await supabase.from('inventory_count_tasks').insert([payload]);
      if (error) throw error;
      setSuccessMsg(t.countTaskCreated);
      setShowSuccess(true);
      setShowCountTaskModal(false);
      setCountTaskForm({
        name: '',
        locationId: '',
        frequency: 'DAILY',
        startDate: new Date().toISOString().split('T')[0],
        notes: ''
      });
      fetchData();
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      alert(t.errorSavingCountTask);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveCountEntries = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!countEntryLocationId) {
      alert(t.fieldRequired);
      return;
    }
    const entries: Array<{
      count_task_id: string | null;
      inventory_item_id: string;
      location_id: string;
      counted_qty: number;
      system_qty: number;
      variance: number;
      counted_at: string;
      counted_by: string | null;
      counted_by_name: string | null;
      status: 'PENDING' | 'APPROVED' | 'REJECTED';
      notes: string | null;
    }> = [];
    countEntryItems.forEach(item => {
      const raw = countEntryValues[item.id];
      if (raw === undefined || raw === '') return;
      const counted = Number(raw);
      if (!Number.isFinite(counted)) return;
      entries.push({
        count_task_id: countEntryTaskId || null,
        inventory_item_id: item.id,
        location_id: countEntryLocationId,
        counted_qty: counted,
        system_qty: item.stock,
        variance: counted - (item.stock || 0),
        counted_at: new Date().toISOString(),
        counted_by: user?.id || null,
        counted_by_name: user?.name || null,
        status: 'PENDING',
        notes: countEntryNotes || null
      });
    });
    if (entries.length === 0) {
      alert(t.fieldRequired);
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase.from('inventory_count_entries').insert(entries);
      if (error) throw error;
      setSuccessMsg(t.countEntrySaved);
      setShowSuccess(true);
      setShowCountEntryModal(false);
      setCountEntryLocationId('');
      setCountEntryTaskId('');
      setCountEntryNotes('');
      setCountEntryValues({});
      fetchData();
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      alert(t.errorSavingCountEntry);
    } finally {
      setIsSaving(false);
    }
  };

  const handleApproveCountEntry = async (entry: InventoryCountEntry, newStatus: 'APPROVED' | 'REJECTED') => {
    if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.MANAGER)) return;
    setIsSaving(true);
    try {
      const { error: updateError } = await supabase
        .from('inventory_count_entries')
        .update({
          status: newStatus,
          approved_by: user.id,
          approved_by_name: user.name,
          approved_at: new Date().toISOString()
        })
        .eq('id', entry.id);
      if (updateError) throw updateError;

      setSuccessMsg(t.countEntryStatusUpdated);
      setShowSuccess(true);
      fetchData();
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (err) {
      console.error(err);
      alert(t.errorUpdatingCountEntry);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustmentForm.notes || adjustmentForm.notes.length < 10) {
      alert(t.justificationRequired);
      return;
    }

    setIsSaving(true);
    try {
      const item = packagedItems.find(i => i.id === adjustmentForm.itemId);
      const qty = parseInt(adjustmentForm.quantity);
      const adjValue = Math.abs(qty * (item?.price || 0));
      const needsApproval = adjValue > ADJUSTMENT_APPROVAL_THRESHOLD;

      const payload = {
        item_id: adjustmentForm.itemId,
        location_id: adjustmentForm.locationId,
        quantity: qty,
        reason: adjustmentForm.reason,
        notes: adjustmentForm.notes,
        status: needsApproval ? 'PENDING' : 'APPROVED',
        user_name: user?.name || 'System',
        item_name: item?.name,
        location_name: locations.find(l => l.id === adjustmentForm.locationId)?.name,
        value: adjValue
      };

      const { error: adjError } = await supabase.from('stock_adjustments').insert([payload]);
      if (adjError) throw adjError;

      // If it doesn't need approval, update stock immediately
      if (!needsApproval && item) {
        const { error: invError } = await supabase.from('inventory_items')
          .update({ stock: Math.max(0, item.stock + qty), last_movement_at: new Date().toISOString() })
          .eq('id', item.id);
        if (invError) throw invError;
      }

      setSuccessMsg(needsApproval 
        ? t.adjustmentPendingApproval
        : t.adjustmentSaved);
      
      setShowSuccess(true);
      setShowAdjustmentModal(false);
      setAdjustmentForm({ locationId: '', itemId: '', quantity: '', reason: 'COUNTING_ERROR', notes: '' });
      fetchData();
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      alert(t.errorSavingAdjustment);
    } finally {
      setIsSaving(false);
    }
  };

  const handleApproveAdjustment = async (adj: StockAdjustment, newStatus: 'APPROVED' | 'REJECTED') => {
    if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.MANAGER)) return;
    
    setIsSaving(true);
    try {
      // 1. Update Adjustment Status
      const { error: adjError } = await supabase.from('stock_adjustments').update({ status: newStatus }).eq('id', adj.id);
      if (adjError) throw adjError;

      // 2. If approved, update inventory
      if (newStatus === 'APPROVED') {
        const item = packagedItems.find(i => i.id === adj.item_id);
        if (item) {
          const { error: invError } = await supabase.from('inventory_items')
            .update({ stock: Math.max(0, item.stock + adj.quantity), last_movement_at: new Date().toISOString() })
            .eq('id', item.id);
          if (invError) throw invError;
        }
      }

      setSuccessMsg(t.adjustmentStatusUpdated);
      setShowSuccess(true);
      fetchData();
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (err) {
      console.error(err);
      alert(t.approvalActionFailed);
    } finally {
      setIsSaving(false);
    }
  };

  const reasonLabels: Record<AdjustmentReason, string> = {
    DAMAGE: t.damage,
    THEFT: t.theft,
    COUNTING_ERROR: t.countingError,
    GIFT: t.gift,
    SAMPLE: t.sample,
    EXPIRY: t.expiry,
    OTHER: t.other
  };

  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.MANAGER;

  return (
    <div className="space-y-6 md:space-y-8 animate-in slide-in-from-right-4 duration-500 pb-20">
      {showSuccess && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-white  text-black  px-8 py-3 rounded-full font-bold flex items-center gap-3 shadow-xl z-[150] border border-orange-600">
          <CheckCircle2 size={24} /> {successMsg}
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex gap-4 items-start">
           <div className="p-3 bg-orange-600 text-white rounded-[20px] shadow-lg shadow-orange-900/10"><Package size={28} /></div>
           <div>
             <h2 className="text-xl md:text-2xl font-bold text-black">{t.stockAndDistribution}</h2>
             <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-black">
               <Activity size={10} className="text-black" /> {t.centralControlSystem}
             </div>
           </div>
        </div>
        <div className="flex bg-orange-50 p-1 rounded-2xl w-full md:w-auto overflow-x-auto no-scrollbar shadow-sm">
           <button onClick={() => setActiveTab('locations')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'locations' ? 'bg-orange-600 text-white shadow-md' : 'text-black hover:text-black'}`}><MapPin size={16} /> {t.locations}</button>
           <button onClick={() => setActiveTab('packaged')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'packaged' ? 'bg-orange-600 text-white shadow-md' : 'text-black hover:text-black'}`}><Box size={16} /> {t.inventoryLog}</button>
           <button onClick={() => setActiveTab('transfers')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'transfers' ? 'bg-orange-600 text-white shadow-md' : 'text-black hover:text-black'}`}><Truck size={16} /> {t.transfers}</button>
           <button onClick={() => setActiveTab('purchases')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'purchases' ? 'bg-orange-600 text-white shadow-md' : 'text-black hover:text-black'}`}><ClipboardCheck size={16} /> {t.purchaseOrders}</button>
           <button onClick={() => setActiveTab('counts')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'counts' ? 'bg-orange-600 text-white shadow-md' : 'text-black hover:text-black'}`}><Clipboard size={16} /> {t.countTasks}</button>
           <button onClick={() => setActiveTab('adjustments')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'adjustments' ? 'bg-orange-600 text-white shadow-md' : 'text-black hover:text-black'}`}><History size={16} /> {t.adjustmentLog}</button>
        </div>
      </div>

      <div className="bg-white rounded-[40px] shadow-sm border border-orange-100 overflow-hidden min-h-[500px]">
        <div className="p-6 border-b border-orange-50 flex flex-col md:flex-row items-center gap-4 bg-white">
          <div className="relative flex-1 w-full">
            <Search className={`absolute ${lang === 'ar' ? 'right-5' : 'left-5'} top-1/2 -translate-y-1/2 text-orange-300`} size={20} />
            <input 
              type="text" 
              placeholder={t.searchPlaceholder} 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full bg-white border-none rounded-2xl ${lang === 'ar' ? 'pr-14 pl-6' : 'pl-14 pr-6'} py-4 text-sm outline-none focus:ring-2 focus:ring-orange-600 shadow-sm transition-all`}
            />
          </div>
          {activeTab === 'locations' && (
            <button onClick={() => { setLocationForm({}); setShowLocationModal(true); }} className="bg-orange-600 text-white px-6 py-4 rounded-2xl font-bold shadow-lg  flex items-center gap-2 w-full md:w-auto justify-center transition-all active:scale-95">
               <Plus size={20} /> <span>{t.newLocation}</span>
            </button>
          )}
          {activeTab === 'transfers' && (
            <button onClick={() => setShowTransferModal(true)} className="bg-orange-600 text-white px-6 py-4 rounded-2xl font-bold shadow-lg  flex items-center gap-2 w-full md:w-auto justify-center transition-all active:scale-95">
               <ArrowRightLeft size={20} /> <span>{t.newTransfer}</span>
            </button>
          )}
          {activeTab === 'purchases' && (
            <button onClick={() => setShowPurchaseModal(true)} className="bg-orange-600 text-white px-6 py-4 rounded-2xl font-bold shadow-lg  flex items-center gap-2 w-full md:w-auto justify-center transition-all active:scale-95">
               <ClipboardCheck size={20} /> <span>{t.newPurchaseOrder}</span>
            </button>
          )}
          {activeTab === 'counts' && (
            <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
              <button onClick={() => setShowCountTaskModal(true)} className="bg-orange-600 text-white px-6 py-4 rounded-2xl font-bold shadow-lg  flex items-center gap-2 w-full md:w-auto justify-center transition-all active:scale-95">
                 <Clipboard size={20} /> <span>{t.newCountTask}</span>
              </button>
              <button onClick={() => { setShowCountEntryModal(true); }} className="bg-white  text-black  px-6 py-4 rounded-2xl font-bold shadow-sm flex items-center gap-2 w-full md:w-auto justify-center transition-all active:scale-95">
                 <ClipboardCheck size={20} /> <span>{t.recordCount}</span>
              </button>
            </div>
          )}
          {activeTab === 'adjustments' && (
            <button onClick={() => setShowAdjustmentModal(true)} className="bg-orange-600 text-white px-6 py-4 rounded-2xl font-bold shadow-lg  flex items-center gap-2 w-full md:w-auto justify-center transition-all active:scale-95">
               <History size={20} /> <span>{t.newAdjustment}</span>
            </button>
          )}
          {activeTab === 'packaged' && (
             <button onClick={handleExportInventory} className="bg-white  text-black  px-6 py-4 rounded-2xl font-bold shadow-sm flex items-center gap-2 w-full md:w-auto justify-center transition-all active:scale-95">
               <FileDown size={20} /> <span>{t.export}</span>
             </button>
          )}
        </div>

        {activeTab === 'locations' ? (
          <div className="p-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {locations.map(loc => (
              <div key={loc.id} className="bg-white border border-orange-50 p-8 rounded-[32px] shadow-sm hover:shadow-xl transition-all group relative">
                 <div className="flex justify-between items-start mb-6">
                    <div className="p-4 bg-white text-orange-300 group- group- rounded-2xl transition-colors">
                       {loc.is_roastery ? <Coffee size={24}/> : <Store size={24}/>}
                    </div>
                    <div className="flex gap-2">
                       <button onClick={() => { setLocationForm(loc); setShowLocationModal(true); }} className="p-2 rounded-full text-orange-300 hover:text-black transition-colors"><Edit size={16}/></button>
                       <span className="text-[10px] font-black uppercase text-black bg-white border border-orange-600 px-3 py-1 rounded-full">{loc.is_roastery ? 'Roastery' : 'Branch'}</span>
                    </div>
                 </div>
                 <h4 className="text-xl font-bold mb-2">{loc.name}</h4>
                 <p className="text-xs text-black line-clamp-2">{loc.address}</p>
                 <div className="mt-4 pt-4 border-t border-orange-50 flex justify-between items-center">
                    <span className={`text-[10px] font-bold uppercase ${loc.is_active ? 'text-green-500' : 'text-red-500'}`}>{loc.is_active ? 'Active' : 'Inactive'}</span>
                    <span className="text-[10px] text-black">{packagedItems.filter(i => i.location_id === loc.id).length} Items</span>
                 </div>
              </div>
            ))}
          </div>
        ) : activeTab === 'transfers' ? (
          <div className="overflow-x-auto">
             <table className={`w-full ${lang === 'ar' ? 'text-right' : 'text-left'} text-sm min-w-[1000px]`}>
               <thead className="bg-white text-black uppercase text-[10px] font-black tracking-widest border-b border-orange-50">
                 <tr>
                    <th className="px-8 py-5">Date</th>
                    <th className="px-8 py-5">Source</th>
                    <th className="px-8 py-5">Destination</th>
                    <th className="px-8 py-5">Items</th>
                    <th className="px-8 py-5">Status</th>
                    <th className="px-8 py-5">Actions</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-orange-50">
                 {transferOrders.map(order => (
                   <tr key={order.id} className="hover/50">
                     <td className="px-8 py-5 font-mono text-xs text-black">{new Date(order.created_at).toLocaleDateString()}</td>
                     <td className="px-8 py-5 font-bold">{locations.find(l => l.id === order.source_location_id)?.name}</td>
                     <td className="px-8 py-5 font-bold">{locations.find(l => l.id === order.destination_location_id)?.name}</td>
                    <td className="px-8 py-5">{order.items_count} {t.items}</td>
                     <td className="px-8 py-5">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase border ${
                          order.status === 'COMPLETED' ? 'bg-white text-green-700 border-green-200' : 
                          order.status === 'DRAFT' ? 'bg-white text-black border-orange-50' : 
                          'bg-white text-blue-700 border-blue-200'
                        }`}>{order.status}</span>
                     </td>
                     <td className="px-8 py-5">
                        <div className="flex gap-2">
                          {order.status === 'DRAFT' && (
                             <button onClick={() => handleUpdateTransferStatus(order, 'APPROVED')} className="text-[10px] font-bold uppercase bg-white text-orange-600 border border-orange-200 px-3 py-1 rounded-full hover:bg-orange-50 transition-all">
                                {t.approve}
                             </button>
                          )}
                          {order.status === 'APPROVED' && (
                             <button onClick={() => handleUpdateTransferStatus(order, 'COMPLETED')} className="text-[10px] font-bold uppercase bg-white text-green-600 border border-green-200 px-3 py-1 rounded-full hover:bg-green-50 transition-all">
                                {t.receive}
                             </button>
                          )}
                          {(order.status === 'COMPLETED' || order.status === 'CANCELLED') && (
                             <button className="text-black hover:text-black"><ChevronRight size={18}/></button>
                          )}
                        </div>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
          </div>
        ) : activeTab === 'purchases' ? (
          <div className="overflow-x-auto">
            <table className={`w-full ${lang === 'ar' ? 'text-right' : 'text-left'} text-sm min-w-[1000px]`}>
              <thead className="bg-white text-black uppercase text-[10px] font-black tracking-widest border-b border-orange-50">
                <tr>
                  <th className="px-8 py-5">{t.date}</th>
                  <th className="px-8 py-5">{t.supplier}</th>
                  <th className="px-8 py-5">{t.locationName}</th>
                  <th className="px-8 py-5">{t.itemsHeader}</th>
                  <th className="px-8 py-5">{t.totalValue}</th>
                  <th className="px-8 py-5">{t.status}</th>
                  <th className="px-8 py-5">{t.action}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-orange-50">
                {purchaseOrders
                  .filter(order => order.supplier_name.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map(order => (
                    <tr key={order.id} className="hover/50">
                      <td className="px-8 py-5 font-mono text-xs text-black">{new Date(order.created_at).toLocaleDateString()}</td>
                      <td className="px-8 py-5 font-bold">{order.supplier_name}</td>
                      <td className="px-8 py-5 font-bold">{locations.find(l => l.id === order.location_id)?.name}</td>
                      <td className="px-8 py-5">{order.items_count || order.manifest?.length || 0} {t.items}</td>
                      <td className="px-8 py-5">{(order.total_value || 0).toLocaleString()}</td>
                      <td className="px-8 py-5">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase border ${
                          order.status === 'RECEIVED' ? 'bg-white text-green-700 border-green-200' :
                          order.status === 'PARTIALLY_RECEIVED' ? 'bg-white text-yellow-700 border-yellow-200' :
                          order.status === 'ORDERED' ? 'bg-white text-blue-700 border-blue-200' :
                          order.status === 'DRAFT' ? 'bg-white text-black border-orange-50' :
                          'bg-white text-red-600 border-red-200'
                        }`}>{order.status}</span>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex gap-2">
                          {order.status === 'DRAFT' && (
                            <button onClick={() => handleUpdatePurchaseStatus(order, 'ORDERED')} className="text-[10px] font-bold uppercase bg-white text-orange-600 border border-orange-200 px-3 py-1 rounded-full hover:bg-orange-50 transition-all">
                              {t.placeOrder}
                            </button>
                          )}
                          {order.status === 'ORDERED' && (
                            <button onClick={() => openReceiveModal(order)} className="text-[10px] font-bold uppercase bg-white text-green-600 border border-green-200 px-3 py-1 rounded-full hover:bg-green-50 transition-all">
                              {t.receive}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : activeTab === 'counts' ? (
          <div className="flex flex-col gap-8">
            <div className="overflow-x-auto">
              <table className={`w-full ${lang === 'ar' ? 'text-right' : 'text-left'} text-sm min-w-[1000px]`}>
                <thead className="bg-white text-black uppercase text-[10px] font-black tracking-widest border-b border-orange-50">
                  <tr>
                    <th className="px-8 py-5">{t.taskName}</th>
                    <th className="px-8 py-5">{t.locationName}</th>
                    <th className="px-8 py-5">{t.frequency}</th>
                    <th className="px-8 py-5">{t.startDate}</th>
                    <th className="px-8 py-5">{t.nextRunDate}</th>
                    <th className="px-8 py-5">{t.status}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-orange-50">
                  {filteredCountTasks.map(task => (
                      <tr key={task.id} className="hover/50">
                        <td className="px-8 py-5 font-bold">{task.name}</td>
                        <td className="px-8 py-5">{locations.find(l => l.id === task.location_id)?.name}</td>
                        <td className="px-8 py-5">{getFrequencyLabel(task.frequency)}</td>
                        <td className="px-8 py-5 font-mono text-xs text-black">{new Date(task.start_date).toLocaleDateString()}</td>
                        <td className="px-8 py-5 font-mono text-xs text-black">{new Date(task.next_run_date).toLocaleDateString()}</td>
                        <td className="px-8 py-5">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase border ${
                            task.status === 'ACTIVE' ? 'bg-white text-green-700 border-green-200' : 'bg-white text-red-600 border-red-200'
                          }`}>{task.status === 'ACTIVE' ? t.active : t.paused}</span>
                        </td>
                      </tr>
                    ))}
                  {filteredCountTasks.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-8 py-10 text-center text-sm text-black italic">{t.noCountTasks}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="overflow-x-auto">
              <div className="px-8 pt-2 text-xs font-black uppercase tracking-widest text-black">{t.countResults}</div>
              <table className={`w-full ${lang === 'ar' ? 'text-right' : 'text-left'} text-sm min-w-[1300px] mt-4`}>
                <thead className="bg-white text-black uppercase text-[10px] font-black tracking-widest border-b border-orange-50">
                  <tr>
                    <th className="px-8 py-5">{t.date}</th>
                    <th className="px-8 py-5">{t.itemsHeader}</th>
                    <th className="px-8 py-5">{t.locationName}</th>
                    <th className="px-8 py-5">{t.taskName}</th>
                    <th className="px-8 py-5">{t.systemQty}</th>
                    <th className="px-8 py-5">{t.countedQty}</th>
                    <th className="px-8 py-5">{t.variance}</th>
                    <th className="px-8 py-5">{t.variancePercent}</th>
                    <th className="px-8 py-5">{t.varianceValue}</th>
                    <th className="px-8 py-5">{t.status}</th>
                    <th className="px-8 py-5">{t.countedBy}</th>
                    <th className="px-8 py-5">{t.approvedBy}</th>
                    <th className="px-8 py-5">{t.action}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-orange-50">
                  {filteredCountEntries.map(entry => {
                    const item = packagedItems.find(i => i.id === entry.inventory_item_id);
                    const systemQty = entry.system_qty ?? item?.stock ?? 0;
                    const variance = entry.variance ?? (entry.counted_qty - systemQty);
                    const variancePercent = entry.variance_percent ?? (systemQty ? (Math.abs(variance) / systemQty) * 100 : null);
                    const varianceValue = entry.variance_value ?? (variance * (item?.cost_per_unit || 0));
                    const isSignificant = (variancePercent !== null && variancePercent > 5) || Math.abs(varianceValue) > 500;
                    const status = entry.status || 'PENDING';
                    return (
                      <tr key={entry.id} className={`hover/50 ${isSignificant ? 'bg-white border-l-4 border-red-400' : ''}`}>
                        <td className="px-8 py-5 font-mono text-xs text-black">{new Date(entry.counted_at).toLocaleDateString()}</td>
                        <td className="px-8 py-5 font-bold">{item?.name || '-'}</td>
                        <td className="px-8 py-5">{locations.find(l => l.id === entry.location_id)?.name}</td>
                        <td className="px-8 py-5">{countTasks.find(tk => tk.id === entry.count_task_id)?.name || t.adHocCount}</td>
                        <td className="px-8 py-5">{systemQty}</td>
                        <td className="px-8 py-5 font-bold">{entry.counted_qty}</td>
                        <td className="px-8 py-5">{variance}</td>
                        <td className="px-8 py-5">{variancePercent === null ? '-' : `${variancePercent.toFixed(1)}%`}</td>
                        <td className="px-8 py-5">{Math.abs(varianceValue).toLocaleString()}</td>
                        <td className="px-8 py-5">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase border ${
                            status === 'APPROVED' ? 'bg-white text-green-700 border-green-200' :
                            status === 'REJECTED' ? 'bg-white text-red-600 border-red-200' :
                            'bg-white text-yellow-700 border-yellow-200'
                          }`}>{status === 'APPROVED' ? t.approved : status === 'REJECTED' ? t.rejected : t.pending}</span>
                        </td>
                        <td className="px-8 py-5">{entry.counted_by_name || '-'}</td>
                        <td className="px-8 py-5">{entry.approved_by_name || '-'}</td>
                        <td className="px-8 py-5">
                          {status === 'PENDING' && (user?.role === UserRole.ADMIN || user?.role === UserRole.MANAGER) ? (
                            <div className="flex gap-2">
                              <button onClick={() => handleApproveCountEntry(entry, 'APPROVED')} className="text-[10px] font-bold uppercase bg-white text-green-600 border border-green-200 px-3 py-1 rounded-full hover:bg-green-50 transition-all">
                                {t.approve}
                              </button>
                              <button onClick={() => handleApproveCountEntry(entry, 'REJECTED')} className="text-[10px] font-bold uppercase bg-white text-red-600 border border-red-200 px-3 py-1 rounded-full hover:bg-red-50 transition-all">
                                {t.reject}
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-black">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredCountEntries.length === 0 && (
                    <tr>
                      <td colSpan={13} className="px-8 py-10 text-center text-sm text-black italic">{t.noCountEntries}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : activeTab === 'packaged' ? (
          <div className="flex flex-col gap-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 px-10 pt-6">
               <div className="bg-white p-6 rounded-3xl border border-orange-50">
                  <div className="text-orange-300 text-xs font-black uppercase tracking-widest mb-2">{t.totalItems}</div>
                  <div className="text-3xl font-black text-black">{inventorySummary.totalItems}</div>
               </div>
               <div className="bg-white p-6 rounded-3xl border border-orange-50">
                  <div className="text-orange-300 text-xs font-black uppercase tracking-widest mb-2">{t.totalStock}</div>
                  <div className="text-3xl font-black text-black">{inventorySummary.totalStock.toLocaleString()}</div>
               </div>
               <div className="bg-white p-6 rounded-3xl border border-orange-50">
                  <div className="text-orange-300 text-xs font-black uppercase tracking-widest mb-2">{t.totalValue}</div>
                  <div className="text-3xl font-black text-black flex items-baseline gap-1">
                    <span className="text-sm text-orange-300">QAR</span>
                    {inventorySummary.totalValue.toLocaleString()}
                  </div>
               </div>
               <div className="bg-white p-6 rounded-3xl border border-red-100">
                  <div className="text-red-400 text-xs font-black uppercase tracking-widest mb-2">{t.lowStockAlert}</div>
                  <div className="text-3xl font-black text-red-600 ">{inventorySummary.lowStock} <span className="text-sm font-bold">{t.itemsHeader}</span></div>
               </div>
            </div>

            {inventorySummary.lowStock > 0 && (
              <div className="mx-10 bg-white border border-red-100 rounded-3xl px-6 py-4">
                <div className="text-red-500 text-xs font-black uppercase tracking-widest mb-1">{t.lowStockAlert}</div>
                <div className="text-sm font-semibold text-black">{t.minimumStockAlert.replace('{count}', inventorySummary.lowStock.toString())}</div>
              </div>
            )}
            {inventorySummary.highStock > 0 && (
              <div className="mx-10 bg-white border border-orange-100 rounded-3xl px-6 py-4">
                <div className="text-orange-500 text-xs font-black uppercase tracking-widest mb-1">{t.highStockAlert}</div>
                <div className="text-sm font-semibold text-black">{t.maximumStockAlert.replace('{count}', inventorySummary.highStock.toString())}</div>
              </div>
            )}
            {inventorySummary.expiring30 > 0 && (
              <div className="mx-10 bg-white border border-orange-100 rounded-3xl px-6 py-4">
                <div className="text-orange-500 text-xs font-black uppercase tracking-widest mb-2">{t.expiryAlert}</div>
                <div className="flex flex-wrap gap-3 text-sm font-semibold text-black">
                  <span>{t.expiringIn30.replace('{count}', inventorySummary.expiring30.toString())}</span>
                  <span>{t.expiringIn14.replace('{count}', inventorySummary.expiring14.toString())}</span>
                  <span>{t.expiringIn7.replace('{count}', inventorySummary.expiring7.toString())}</span>
                </div>
              </div>
            )}
            {inventorySummary.stagnantCount > 0 && (
              <div className="mx-10 bg-white border border-yellow-100 rounded-3xl px-6 py-4">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
                  <div className="text-yellow-500 text-xs font-black uppercase tracking-widest">{t.stagnantAlert}</div>
                  <div className="flex items-center gap-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-black">{t.stagnantDaysLabel}</label>
                    <input
                      type="number"
                      min="1"
                      value={stagnantDays}
                      onChange={e => setStagnantDays(e.target.value)}
                      className="w-20 bg-white border border-yellow-100 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-yellow-400"
                    />
                  </div>
                </div>
                <div className="text-sm font-semibold text-black mb-3">
                  {t.stagnantAlertMessage
                    .replace('{count}', inventorySummary.stagnantCount.toString())
                    .replace('{days}', stagnantDaysValue.toString())}
                </div>
                <div className="divide-y divide-yellow-50">
                  {stagnantItems.map(({ item, days }) => (
                    <div key={item.id} className="flex items-center justify-between py-2 text-sm">
                      <div className="font-semibold text-black">{item.name}</div>
                      <div className="text-[10px] font-black uppercase text-black">{days} {t.daysUnit}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mx-10 bg-white border border-orange-100 rounded-3xl px-6 py-4">
              <div className="text-xs font-black uppercase tracking-widest text-black mb-4">{t.productLocationSummary}</div>
              <div className="overflow-x-auto">
                <table className={`w-full ${lang === 'ar' ? 'text-right' : 'text-left'} text-sm min-w-[800px]`}>
                  <thead className="bg-white text-black uppercase text-[10px] font-black tracking-widest border-b border-orange-50">
                    <tr>
                      <th className="px-4 py-3">{t.product}</th>
                      <th className="px-4 py-3">{t.locationName}</th>
                      <th className="px-4 py-3">{t.stock}</th>
                      <th className="px-4 py-3">{t.available}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-orange-50">
                    {productLocationSummary.map(row => (
                      <tr key={`${row.productKey}-${row.locationId || 'central'}`} className="hover:bg-orange-50">
                        <td className="px-4 py-3 font-bold">{row.productName}</td>
                        <td className="px-4 py-3 text-black">{row.locationName}</td>
                        <td className="px-4 py-3 font-mono font-black">{row.stock} {row.unit}</td>
                        <td className="px-4 py-3 font-mono font-black">{row.available} {row.unit}</td>
                      </tr>
                    ))}
                    {productLocationSummary.length === 0 && (
                      <tr>
                        <td className="px-4 py-6 text-center text-sm text-black" colSpan={4}>{t.noItemsFound}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="overflow-x-auto">
            <table className={`w-full ${lang === 'ar' ? 'text-right' : 'text-left'} text-sm min-w-[1000px]`}>
              <thead className="bg-white text-black uppercase text-[10px] font-black tracking-widest border-b border-orange-50">
                <tr>
                   <th className="px-8 py-5">{t.product}</th>
                   <th className="px-8 py-5">{t.locationName}</th>
                   <th className="px-8 py-5">{t.stock}</th>
                   <th className="px-8 py-5">{t.available}</th>
                   <th className="px-8 py-5">{t.status}</th>
                   <th className="px-8 py-5">{t.expiry}</th>
                   <th className="px-8 py-5">{t.action}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-orange-50">
                 {packagedItems.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase())).map(item => {
                   const status = getStockStatus(item);
                   const available = getAvailableStock(item);
                   return (
                   <tr key={item.id} className="hover:bg-orange-50 border-b border-orange-50 last:border-0">
                     <td className="px-8 py-5 font-bold">
                        {item.name}
                        <div className="text-[10px] text-black font-mono">{item.skuPrefix || 'N/A'}</div>
                     </td>
                     <td className="px-8 py-5 text-black">{locations.find(l => l.id === item.location_id)?.name || 'Central'}</td>
                     <td className={`px-8 py-5 font-mono font-black ${status === 'CRITICAL' ? 'text-red-600' : ''}`}>{item.stock} {item.unit}</td>
                     <td className={`px-8 py-5 font-mono font-black ${status === 'CRITICAL' ? 'text-red-600' : ''}`}>{available} {item.unit}</td>
                     <td className="px-8 py-5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${
                           status === 'CRITICAL' ? 'bg-white text-red-600 border-red-200' : 
                           status === 'EXPIRING' ? 'bg-white text-orange-600 border-orange-200' : 
                           'bg-white text-green-600 border-green-200'
                        }`}>{status}</span>
                     </td>
                     <td className="px-8 py-5 font-mono text-xs">{item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : '-'}</td>
                     <td className="px-8 py-5">
                        <button onClick={() => { setAdjustmentForm({...adjustmentForm, locationId: item.location_id || '', itemId: item.id}); setShowAdjustmentModal(true); }} className="p-2 text-black hover:text-black  transition-colors"><ArrowRightLeft size={18} /></button>
                     </td>
                   </tr>
                 )})}
              </tbody>
            </table>
          </div>
        </div>
        ) : (
          <div className="overflow-x-auto">
             <table className={`w-full ${lang === 'ar' ? 'text-right' : 'text-left'} text-sm min-w-[1000px]`}>
              <thead className="bg-white  text-black uppercase text-[10px] font-black tracking-widest border-b border-orange-50 ">
                <tr>
                   <th className="px-8 py-5">التاريخ</th>
                   <th className="px-8 py-5">الصنف</th>
                   <th className="px-8 py-5">الكمية</th>
                   <th className="px-8 py-5">السبب والمبرر</th>
                   <th className="px-8 py-5">الحالة</th>
                   <th className="px-8 py-5">المستخدم</th>
                   {isAdmin && <th className="px-8 py-5">الإجراء</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-orange-50 ">
                {adjustments.map(adj => (
                  <tr key={adj.id} className="hover/50 transition-colors">
                    <td className="px-8 py-5 text-black font-mono text-xs">{new Date(adj.created_at).toLocaleString()}</td>
                    <td className="px-8 py-5">
                       <div className="font-bold">{adj.item_name}</div>
                       <div className="text-[10px] text-black">{adj.location_name}</div>
                    </td>
                    <td className="px-8 py-5">
                       <span className={`flex items-center gap-1 font-black ${adj.quantity > 0 ? 'text-black ' : 'text-black '}`}>
                          {adj.quantity > 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                          {Math.abs(adj.quantity)}
                       </span>
                    </td>
                    <td className="px-8 py-5 max-w-[300px]">
                       <div className="flex flex-col gap-1">
                          <span className="px-2 py-0.5 bg-white  rounded text-[10px] font-bold uppercase w-fit">{reasonLabels[adj.reason]}</span>
                          <span className="text-xs text-black italic truncate" title={adj.notes}>{adj.notes}</span>
                       </div>
                    </td>
                    <td className="px-8 py-5">
                       <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase border ${
                         adj.status === 'APPROVED' ? 'bg-white  text-black  border-orange-600' : 
                         adj.status === 'PENDING' ? 'bg-white  text-black  border-orange-200  animate-pulse' : 
                         adj.status === 'REJECTED' ? 'bg-white text-red-600 border-red-200' : 
                         'bg-white  text-black  border-orange-300 '
                       }`}>
                          {adj.status}
                       </span>
                    </td>
                    <td className="px-8 py-5 font-medium">{adj.user_name}</td>
                    {isAdmin && (
                      <td className="px-8 py-5">
                         {adj.status === 'PENDING' && (
                           <div className="flex items-center gap-2">
                             <button onClick={() => handleApproveAdjustment(adj, 'APPROVED')} className="p-2 bg-white  text-black  border border-orange-600 rounded-lg   transition-all"><Check size={16}/></button>
                             <button onClick={() => handleApproveAdjustment(adj, 'REJECTED')} className="p-2 bg-white  text-black  border border-orange-200  rounded-lg  hover:text-black  transition-all"><X size={16}/></button>
                           </div>
                         )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
             </table>
          </div>
        )}
      </div>

      {/* Location Modal */}
      {showLocationModal && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-white/60 backdrop-blur-md overflow-y-auto">
          <div className="bg-white  rounded-[40px] max-w-2xl w-full p-8 md:p-10 shadow-2xl animate-in zoom-in-95 my-8" dir={t.dir}>
             <div className="flex justify-between items-center mb-8 border-b border-orange-50  pb-6">
               <h3 className="text-2xl font-bold">{locationForm.id ? t.editLocation : t.newLocation}</h3>
               <button onClick={() => setShowLocationModal(false)}><X size={32} className="text-black" /></button>
             </div>
             <form onSubmit={handleSaveLocation} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-black">{t.locationName}</label>
                      <input required type="text" value={locationForm.name} onChange={e => setLocationForm({...locationForm, name: e.target.value})} className="w-full bg-white  p-4 rounded-xl font-bold outline-none focus:ring-2 focus:ring-orange-600" />
                   </div>
                   <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-black">{t.type}</label>
                      <select value={locationForm.type} onChange={e => setLocationForm({...locationForm, type: e.target.value as any})} className="w-full bg-white  p-4 rounded-xl font-bold outline-none focus:ring-2 focus:ring-orange-600">
                        <option value="WAREHOUSE">{t.warehouse}</option>
                        <option value="BRANCH">{t.branch}</option>
                        <option value="ROASTERY">{t.roastery}</option>
                      </select>
                   </div>
                </div>
                <div className="space-y-2">
                   <label className="text-xs font-bold uppercase text-black">{t.address}</label>
                   <input type="text" value={locationForm.address} onChange={e => setLocationForm({...locationForm, address: e.target.value})} className="w-full bg-white  p-4 rounded-xl font-bold outline-none focus:ring-2 focus:ring-orange-600" />
                </div>
                <div className="pt-6 flex gap-4">
                  <button type="button" onClick={() => setShowLocationModal(false)} className="flex-1 py-4 font-bold text-black uppercase tracking-widest">{t.cancel}</button>
                  <button type="submit" disabled={isSaving} className="flex-[2] bg-orange-600 text-white py-4 rounded-2xl font-bold shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 hover">{isSaving ? <Loader2 className="animate-spin" /> : t.save}</button>
                </div>
             </form>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-white/60 backdrop-blur-md overflow-y-auto">
          <div className="bg-white  rounded-[40px] max-w-4xl w-full p-8 md:p-10 shadow-2xl animate-in zoom-in-95 my-8" dir={t.dir}>
             <div className="flex justify-between items-center mb-8 border-b border-orange-50  pb-6">
               <h3 className="text-2xl font-bold">{t.newStockTransfer}</h3>
               <button onClick={() => setShowTransferModal(false)}><X size={32} className="text-black" /></button>
             </div>
             <form onSubmit={handleSaveTransfer} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-black">{t.fromSource}</label>
                      <select required value={transferForm.sourceId} onChange={e => setTransferForm({...transferForm, sourceId: e.target.value})} className="w-full bg-white  p-4 rounded-xl font-bold outline-none focus:ring-2 focus:ring-orange-600">
                        <option value="">-- {t.fromSource} --</option>
                        {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                   </div>
                   <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-black">{t.toDestination}</label>
                      <select required value={transferForm.destinationId} onChange={e => setTransferForm({...transferForm, destinationId: e.target.value})} className="w-full bg-white  p-4 rounded-xl font-bold outline-none focus:ring-2 focus:ring-orange-600">
                        <option value="">-- {t.toDestination} --</option>
                        {locations.filter(l => l.id !== transferForm.sourceId).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                   </div>
                </div>
                
                {/* Items Section */}
                <div className="bg-white  p-6 rounded-2xl space-y-4">
                   <h4 className="font-bold border-b border-orange-100  pb-2">{t.itemsToTransfer}</h4>
                   <div className="flex gap-4">
                      <select disabled={!transferForm.sourceId} value={selectedTransferItem} onChange={e => setSelectedTransferItem(e.target.value)} className="flex-[3] p-3 rounded-xl border-none outline-none bg-white ">
                         <option value="">{t.itemLabel}</option>
                         {packagedItems.filter(i => i.location_id === transferForm.sourceId).map(i => <option key={i.id} value={i.id}>{i.name} ({t.stock}: {i.stock})</option>)}
                      </select>
                      <input type="number" placeholder={t.quantity} value={transferItemQty} onChange={e => setTransferItemQty(e.target.value)} className="flex-1 p-3 rounded-xl border-none outline-none bg-white " />
                      <button type="button" onClick={addItemToTransfer} className="p-3 bg-orange-600 text-white rounded-xl hover"><Plus size={20}/></button>
                   </div>
                   {/* List of added items */}
                   <div className="space-y-2">
                      {transferForm.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-white  p-3 rounded-xl shadow-sm">
                           <span>{item.name}</span>
                           <div className="flex items-center gap-4">
                             <span className="font-mono font-bold">{item.quantity}</span>
                             <button type="button" onClick={() => setTransferForm(prev => ({...prev, items: prev.items.filter((_, i) => i !== idx)}))} className="text-red-500 hover"><Trash2 size={16}/></button>
                           </div>
                        </div>
                      ))}
                     {transferForm.items.length === 0 && <p className="text-black text-sm text-center italic py-4">{t.addItemsPrompt}</p>}
                   </div>
                </div>

                <div className="space-y-2">
                   <label className="text-xs font-bold uppercase text-black">{t.notes}</label>
                   <textarea value={transferForm.notes} onChange={e => setTransferForm({...transferForm, notes: e.target.value})} className="w-full bg-white  p-4 rounded-xl font-bold h-24 outline-none focus:ring-2 focus:ring-orange-600 resize-none" />
                </div>
                
                <div className="pt-6 flex gap-4">
                  <button type="button" onClick={() => setShowTransferModal(false)} className="flex-1 py-4 font-bold text-black uppercase tracking-widest">{t.cancel}</button>
                  <button type="submit" disabled={isSaving || transferForm.items.length === 0} className="flex-[2] bg-orange-600 text-white py-4 rounded-2xl font-bold shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2  disabled:opacity-50 disabled:pointer-events-none">{isSaving ? <Loader2 className="animate-spin" /> : t.createTransfer}</button>
                </div>
             </form>
          </div>
        </div>
      )}

      {showPurchaseModal && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-white/60 backdrop-blur-md overflow-y-auto">
          <div className="bg-white  rounded-[40px] max-w-4xl w-full p-8 md:p-10 shadow-2xl animate-in zoom-in-95 my-8" dir={t.dir}>
            <div className="flex justify-between items-center mb-8 border-b border-orange-50  pb-6">
              <h3 className="text-2xl font-bold">{t.newPurchaseOrder}</h3>
              <button onClick={() => setShowPurchaseModal(false)}><X size={32} className="text-black" /></button>
            </div>
            <form onSubmit={handleSavePurchaseOrder} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-black">{t.supplier}</label>
                  <input required type="text" value={purchaseForm.supplierName} onChange={e => setPurchaseForm({...purchaseForm, supplierName: e.target.value})} className="w-full bg-white  p-4 rounded-xl font-bold outline-none focus:ring-2 focus:ring-orange-600" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-black">{t.locationName}</label>
                  <select required value={purchaseForm.locationId} onChange={e => setPurchaseForm({...purchaseForm, locationId: e.target.value})} className="w-full bg-white  p-4 rounded-xl font-bold outline-none focus:ring-2 focus:ring-orange-600">
                    <option value="">-- {t.locationName} --</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="bg-white  p-6 rounded-2xl space-y-4">
                <h4 className="font-bold border-b border-orange-100  pb-2">{t.itemsHeader}</h4>
                <div className="flex flex-wrap gap-4">
                  <select disabled={!purchaseForm.locationId} value={selectedPurchaseItem} onChange={e => setSelectedPurchaseItem(e.target.value)} className="flex-[3] min-w-[220px] p-3 rounded-xl border-none outline-none bg-white ">
                    <option value="">{t.itemLabel}</option>
                    {packagedItems.filter(i => !purchaseForm.locationId || i.location_id === purchaseForm.locationId).map(i => (
                      <option key={i.id} value={i.id}>{i.name} ({t.stock}: {i.stock})</option>
                    ))}
                  </select>
                  <input type="number" placeholder={t.quantity} value={purchaseItemQty} onChange={e => setPurchaseItemQty(e.target.value)} className="flex-1 min-w-[120px] p-3 rounded-xl border-none outline-none bg-white " />
                  <input type="number" placeholder={t.unitCost} value={purchaseItemCost} onChange={e => setPurchaseItemCost(e.target.value)} className="flex-1 min-w-[140px] p-3 rounded-xl border-none outline-none bg-white " />
                  <button type="button" onClick={addItemToPurchase} className="p-3 bg-orange-600 text-white rounded-xl hover"><Plus size={20}/></button>
                </div>
                <div className="space-y-2">
                  {purchaseForm.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-white  p-3 rounded-xl shadow-sm">
                      <span>{item.name}</span>
                      <div className="flex items-center gap-4">
                        <span className="font-mono font-bold">{item.quantity}</span>
                        <span className="font-mono text-xs">{item.unitCost.toLocaleString()}</span>
                        <button type="button" onClick={() => removePurchaseItem(idx)} className="text-red-500 hover"><Trash2 size={16}/></button>
                      </div>
                    </div>
                  ))}
                  {purchaseForm.items.length === 0 && <p className="text-black text-sm text-center italic py-4">{t.noNotes}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-black">{t.notes}</label>
                <textarea value={purchaseForm.notes} onChange={e => setPurchaseForm({...purchaseForm, notes: e.target.value})} className="w-full bg-white  p-4 rounded-xl font-bold h-24 outline-none focus:ring-2 focus:ring-orange-600 resize-none" />
              </div>

              <div className="pt-6 flex gap-4">
                <button type="button" onClick={() => setShowPurchaseModal(false)} className="flex-1 py-4 font-bold text-black uppercase tracking-widest">{t.cancel}</button>
                <button type="submit" disabled={isSaving || purchaseForm.items.length === 0} className="flex-[2] bg-orange-600 text-white py-4 rounded-2xl font-bold shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2  disabled:opacity-50 disabled:pointer-events-none">{isSaving ? <Loader2 className="animate-spin" /> : t.createPurchaseOrder}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showReceiveModal && selectedPurchaseOrder && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-white/60 backdrop-blur-md overflow-y-auto">
          <div className="bg-white  rounded-[40px] max-w-4xl w-full p-8 md:p-10 shadow-2xl animate-in zoom-in-95 my-8" dir={t.dir}>
            <div className="flex justify-between items-center mb-8 border-b border-orange-50  pb-6">
              <h3 className="text-2xl font-bold">{t.receivePurchaseOrder}</h3>
              <button onClick={() => { setShowReceiveModal(false); setSelectedPurchaseOrder(null); setReceiptLines([]); }}><X size={32} className="text-black" /></button>
            </div>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-black">{t.supplier}</div>
                  <div className="text-sm font-semibold text-black">{selectedPurchaseOrder.supplier_name}</div>
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-black">{t.locationName}</div>
                  <div className="text-sm font-semibold text-black">{locations.find(l => l.id === selectedPurchaseOrder.location_id)?.name}</div>
                </div>
              </div>

              <div className="bg-white  p-6 rounded-2xl space-y-4">
                <h4 className="font-bold border-b border-orange-100  pb-2">{t.itemsHeader}</h4>
                <div className="space-y-3">
                  {receiptLines.map((line, idx) => (
                    <div key={line.itemId} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center bg-white  p-3 rounded-xl shadow-sm">
                      <div className="font-semibold text-black">{line.name}</div>
                      <div className="text-xs text-black">{t.orderedQty}: <span className="font-bold">{line.orderedQty}</span></div>
                      <input
                        type="date"
                        value={line.expiryDate || ''}
                        onChange={e => setReceiptLines(prev => prev.map((item, i) => i === idx ? { ...item, expiryDate: e.target.value } : item))}
                        className="w-full bg-white  p-3 rounded-xl font-bold outline-none focus:ring-2 focus:ring-orange-600"
                        placeholder={t.expiry}
                      />
                      <input
                        type="number"
                        min="0"
                        value={line.receivedQty}
                        onChange={e => {
                          const value = Number(e.target.value);
                          setReceiptLines(prev => prev.map((item, i) => i === idx ? { ...item, receivedQty: Number.isFinite(value) ? value : 0 } : item));
                        }}
                        className="w-full bg-white  p-3 rounded-xl font-bold outline-none focus:ring-2 focus:ring-orange-600"
                        placeholder={t.receivedQty}
                      />
                      <select
                        value={line.qualityStatus}
                        onChange={e => setReceiptLines(prev => prev.map((item, i) => i === idx ? { ...item, qualityStatus: e.target.value as 'PASSED' | 'FAILED' } : item))}
                        className="w-full bg-white  p-3 rounded-xl font-bold outline-none focus:ring-2 focus:ring-orange-600"
                      >
                        <option value="PASSED">{t.qualityPassed}</option>
                        <option value="FAILED">{t.qualityFailed}</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex gap-4">
                <button type="button" onClick={() => { setShowReceiveModal(false); setSelectedPurchaseOrder(null); setReceiptLines([]); }} className="flex-1 py-4 font-bold text-black uppercase tracking-widest">{t.cancel}</button>
                <button type="button" onClick={handleRejectReceipt} disabled={isSaving} className="flex-1 py-4 font-bold text-red-600 uppercase tracking-widest border border-red-200 rounded-2xl disabled:opacity-50 disabled:pointer-events-none">{t.rejectShipment}</button>
                <button type="button" onClick={handleConfirmReceive} disabled={isSaving || receiptLines.length === 0} className="flex-[2] bg-orange-600 text-white py-4 rounded-2xl font-bold shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2  disabled:opacity-50 disabled:pointer-events-none">{isSaving ? <Loader2 className="animate-spin" /> : t.confirmReceipt}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCountTaskModal && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-white/60 backdrop-blur-md overflow-y-auto">
          <div className="bg-white  rounded-[40px] max-w-2xl w-full p-8 md:p-10 shadow-2xl animate-in zoom-in-95 my-8" dir={t.dir}>
            <div className="flex justify-between items-center mb-8 border-b border-orange-50  pb-6">
              <h3 className="text-2xl font-bold">{t.newCountTask}</h3>
              <button onClick={() => setShowCountTaskModal(false)}><X size={32} className="text-black" /></button>
            </div>
            <form onSubmit={handleSaveCountTask} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-black">{t.taskName}</label>
                <input required type="text" value={countTaskForm.name} onChange={e => setCountTaskForm({ ...countTaskForm, name: e.target.value })} className="w-full bg-white p-4 rounded-xl font-bold outline-none focus:ring-2 focus:ring-orange-600" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-black">{t.locationName}</label>
                <select required value={countTaskForm.locationId} onChange={e => setCountTaskForm({ ...countTaskForm, locationId: e.target.value })} className="w-full bg-white p-4 rounded-xl font-bold outline-none focus:ring-2 focus:ring-orange-600">
                  <option value="">-- {t.locationName} --</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-black">{t.frequency}</label>
                  <select value={countTaskForm.frequency} onChange={e => setCountTaskForm({ ...countTaskForm, frequency: e.target.value as CountFrequency })} className="w-full bg-white p-4 rounded-xl font-bold outline-none focus:ring-2 focus:ring-orange-600">
                    <option value="DAILY">{t.daily}</option>
                    <option value="WEEKLY">{t.weekly}</option>
                    <option value="MONTHLY">{t.monthly}</option>
                    <option value="ANNUAL">{t.annual}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-black">{t.startDate}</label>
                  <input type="date" value={countTaskForm.startDate} onChange={e => setCountTaskForm({ ...countTaskForm, startDate: e.target.value })} className="w-full bg-white p-4 rounded-xl font-bold outline-none focus:ring-2 focus:ring-orange-600" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-black">{t.notes}</label>
                <textarea value={countTaskForm.notes} onChange={e => setCountTaskForm({ ...countTaskForm, notes: e.target.value })} className="w-full bg-white p-4 rounded-xl font-bold h-24 outline-none focus:ring-2 focus:ring-orange-600 resize-none" />
              </div>
              <div className="pt-6 flex gap-4">
                <button type="button" onClick={() => setShowCountTaskModal(false)} className="flex-1 py-4 font-bold text-black uppercase tracking-widest">{t.cancel}</button>
                <button type="submit" disabled={isSaving} className="flex-[2] bg-orange-600 text-white py-4 rounded-2xl font-bold shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2  disabled:opacity-50 disabled:pointer-events-none">{isSaving ? <Loader2 className="animate-spin" /> : t.save}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCountEntryModal && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-white/60 backdrop-blur-md overflow-y-auto">
          <div className="bg-white  rounded-[40px] max-w-4xl w-full p-8 md:p-10 shadow-2xl animate-in zoom-in-95 my-8" dir={t.dir}>
            <div className="flex justify-between items-center mb-8 border-b border-orange-50  pb-6">
              <h3 className="text-2xl font-bold">{t.recordCount}</h3>
              <button onClick={() => { setShowCountEntryModal(false); }}><X size={32} className="text-black" /></button>
            </div>
            <form onSubmit={handleSaveCountEntries} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-black">{t.locationName}</label>
                  <select required value={countEntryLocationId} onChange={e => { setCountEntryLocationId(e.target.value); setCountEntryTaskId(''); setCountEntryValues({}); }} className="w-full bg-white p-4 rounded-xl font-bold outline-none focus:ring-2 focus:ring-orange-600">
                    <option value="">-- {t.locationName} --</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-black">{t.selectTask}</label>
                  <select value={countEntryTaskId} onChange={e => setCountEntryTaskId(e.target.value)} className="w-full bg-white p-4 rounded-xl font-bold outline-none focus:ring-2 focus:ring-orange-600">
                    <option value="">{t.adHocCount}</option>
                    {countTasks.filter(task => !countEntryLocationId || task.location_id === countEntryLocationId).map(task => (
                      <option key={task.id} value={task.id}>{task.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="bg-white  p-6 rounded-2xl space-y-4">
                <h4 className="font-bold border-b border-orange-100  pb-2">{t.itemsHeader}</h4>
                <div className="space-y-3">
                  {countEntryItems.map(item => (
                    <div key={item.id} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center bg-white  p-3 rounded-xl shadow-sm">
                      <div className="font-semibold text-black">{item.name}</div>
                      <div className="text-xs text-black">{t.systemQty}: <span className="font-bold">{item.stock}</span></div>
                      <input
                        type="number"
                        min="0"
                        value={countEntryValues[item.id] || ''}
                        onChange={e => setCountEntryValues(prev => ({ ...prev, [item.id]: e.target.value }))}
                        className="w-full bg-white  p-3 rounded-xl font-bold outline-none focus:ring-2 focus:ring-orange-600"
                        placeholder={t.countedQty}
                      />
                      <div className="text-xs text-black">{t.variance}: <span className="font-bold">{countEntryValues[item.id] === undefined || countEntryValues[item.id] === '' ? '-' : Number(countEntryValues[item.id]) - (item.stock || 0)}</span></div>
                    </div>
                  ))}
                  {countEntryLocationId && countEntryItems.length === 0 && (
                    <div className="text-sm text-black italic text-center py-4">{t.noItemsFound}</div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-black">{t.notes}</label>
                <textarea value={countEntryNotes} onChange={e => setCountEntryNotes(e.target.value)} className="w-full bg-white p-4 rounded-xl font-bold h-24 outline-none focus:ring-2 focus:ring-orange-600 resize-none" />
              </div>
              <div className="pt-6 flex gap-4">
                <button type="button" onClick={() => setShowCountEntryModal(false)} className="flex-1 py-4 font-bold text-black uppercase tracking-widest">{t.cancel}</button>
                <button type="submit" disabled={isSaving} className="flex-[2] bg-orange-600 text-white py-4 rounded-2xl font-bold shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2  disabled:opacity-50 disabled:pointer-events-none">{isSaving ? <Loader2 className="animate-spin" /> : t.save}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {showAdjustmentModal && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-white/60 backdrop-blur-md overflow-y-auto">
          <div className="bg-white  rounded-[40px] max-w-2xl w-full p-8 md:p-10 shadow-2xl animate-in zoom-in-95 my-8" dir={t.dir}>
            <div className="flex justify-between items-center mb-8 border-b border-orange-50  pb-6">
              <div className="flex items-center gap-4">
                 <div className="p-3 bg-orange-600 text-white rounded-2xl shadow-lg"><ArrowRightLeft size={28} /></div>
                 <div>
                    <h3 className="text-2xl font-bold">{t.stockAdjustment}</h3>
                    <p className="text-xs text-black font-medium">{t.manualStockUpdateWarning}</p>
                 </div>
              </div>
              <button onClick={() => setShowAdjustmentModal(false)} className="p-2  rounded-full transition-colors"><X size={32} className="text-black" /></button>
            </div>

            <form onSubmit={handleSaveAdjustment} className="space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-black">{t.locationName}</label>
                    <select required value={adjustmentForm.locationId} onChange={e => setAdjustmentForm({...adjustmentForm, locationId: e.target.value})} className="w-full bg-white p-4 rounded-xl font-bold outline-none focus:ring-2 focus:ring-orange-600">
                       <option value="">-- {t.locationName} --</option>
                       {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                 </div>
                 <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-black">{t.itemLabel}</label>
                    <select required value={adjustmentForm.itemId} onChange={e => setAdjustmentForm({...adjustmentForm, itemId: e.target.value})} className="w-full bg-white p-4 rounded-xl font-bold outline-none focus:ring-2 focus:ring-orange-600">
                       <option value="">-- {t.itemLabel} --</option>
                       {packagedItems.filter(i => !adjustmentForm.locationId || i.location_id === adjustmentForm.locationId).map(i => (
                         <option key={i.id} value={i.id}>{i.name} ({t.stock}: {i.stock})</option>
                       ))}
                    </select>
                 </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-black">{t.quantity} (+/-)</label>
                    <input required type="number" placeholder="+10 or -5" value={adjustmentForm.quantity} onChange={e => setAdjustmentForm({...adjustmentForm, quantity: e.target.value})} className="w-full bg-white p-4 rounded-xl font-bold outline-none focus:ring-2 focus:ring-orange-600" />
                 </div>
                 <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-black">{t.reason}</label>
                    <select value={adjustmentForm.reason} onChange={e => setAdjustmentForm({...adjustmentForm, reason: e.target.value as any})} className="w-full bg-white p-4 rounded-xl font-bold outline-none focus:ring-2 focus:ring-orange-600">
                       {Object.entries(reasonLabels).map(([key, label]) => (
                         <option key={key} value={key}>{label}</option>
                       ))}
                    </select>
                 </div>
               </div>

               <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-black">{t.notes} ({t.fieldRequired})</label>
                  <textarea required value={adjustmentForm.notes} onChange={e => setAdjustmentForm({...adjustmentForm, notes: e.target.value})} className="w-full bg-white p-4 rounded-xl font-bold h-24 outline-none focus:ring-2 focus:ring-orange-600 resize-none" placeholder={t.justificationRequired} />
               </div>

               <div className="pt-6 flex gap-4">
                  <button type="button" onClick={() => setShowAdjustmentModal(false)} className="flex-1 py-4 font-bold text-black uppercase tracking-widest">{t.cancel}</button>
                  <button type="submit" disabled={isSaving} className="flex-[2] bg-orange-600 text-white py-4 rounded-2xl font-bold shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 hover">{isSaving ? <Loader2 className="animate-spin" /> : t.save}</button>
               </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryView;
