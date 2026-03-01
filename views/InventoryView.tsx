
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
import { useLanguage } from '../App';
import { GreenBean, Location, InventoryItem, ProductDefinition, UserRole } from '../types';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';

type TransferStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'IN_TRANSIT' | 'RECEIVED' | 'COMPLETED' | 'CANCELLED';
type AdjustmentReason = 'DAMAGE' | 'THEFT' | 'COUNTING_ERROR' | 'GIFT' | 'SAMPLE' | 'EXPIRY' | 'ROASTING_WASTE' | 'QC_REJECTED' | 'OTHER';
type AdjustmentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type PurchaseStatus = 'DRAFT' | 'ORDERED' | 'RECEIVED' | 'PARTIALLY_RECEIVED' | 'REJECTED' | 'CANCELLED';
type CountFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ANNUAL';

const TRANSFER_APPROVAL_THRESHOLD = 5000;
const ADJUSTMENT_APPROVAL_THRESHOLD = 1000;
const DEFAULT_OPERATING_HOURS = {
  mon: { open: '09:00', close: '22:00', closed: false },
  tue: { open: '09:00', close: '22:00', closed: false },
  wed: { open: '09:00', close: '22:00', closed: false },
  thu: { open: '09:00', close: '22:00', closed: false },
  fri: { open: '09:00', close: '22:00', closed: false },
  sat: { open: '09:00', close: '22:00', closed: false },
  sun: { open: '09:00', close: '22:00', closed: false }
};

interface TransferOrder {
  id: string;
  source_location_id: string;
  destination_location_id: string;
  status: TransferStatus;
  created_at: string;
  items_count: number;
  transfer_number?: string;
  approved_at?: string;
  approved_by?: string;
  approved_by_name?: string;
  shipped_at?: string;
  shipped_by?: string;
  shipped_by_name?: string;
  received_at?: string;
  received_by?: string;
  received_by_name?: string;
  notes?: string;
  source_name?: string;
  destination_name?: string;
  manifest?: any[];
  shipped_manifest?: any[];
  received_manifest?: any[];
  discrepancy_manifest?: any[];
  total_value?: number;
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
  const theme = 'light';
  
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
    name: '',
    type: 'BRANCH',
    address: '',
    area: '',
    city: '',
    gps_lat: undefined,
    gps_lng: undefined,
    phone: '',
    email: '',
    fax: '',
    operating_hours: DEFAULT_OPERATING_HOURS,
    branch_type: 'SUB_BRANCH',
    status: 'active',
    opening_date: '',
    closing_date: '',
    area_sqm: undefined,
    seating_capacity: undefined,
    is_hq: false,
    parent_location_id: null,
    commercial_license_number: '',
    commercial_license_expiry: '',
    logo_url: '',
    exterior_photo_url: '',
    interior_photo_url: '',
    contact_person_name: '',
    contact_person_phone: '',
    contact_person_email: '',
    is_active: true,
    is_roastery: false
  });
  const [locationTypeFilter, setLocationTypeFilter] = useState<'ALL' | 'WAREHOUSE' | 'BRANCH' | 'ROASTERY'>('ALL');
  const [branchTypeFilter, setBranchTypeFilter] = useState<'ALL' | 'MAIN' | 'SUB_BRANCH' | 'KIOSK' | 'ONLINE'>('ALL');
  const [branchStatusFilter, setBranchStatusFilter] = useState<'ALL' | 'active' | 'under_construction' | 'temp_closed' | 'permanently_closed'>('ALL');
  const [hqFilter, setHqFilter] = useState<'ALL' | 'HQ' | 'NON_HQ'>('ALL');
  const [branchPhotoUploading, setBranchPhotoUploading] = useState(false);

  // Transfer Management State
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferForm, setTransferForm] = useState({
    sourceId: '', destinationId: '', notes: '', items: [] as { itemId: string, quantity: number, name: string, currentStock: number }[]
  });
  const [selectedTransferItem, setSelectedTransferItem] = useState('');
  const [transferItemQty, setTransferItemQty] = useState('');
  const [isSuggestingTransfer, setIsSuggestingTransfer] = useState(false);
  const [showTransferReceiveModal, setShowTransferReceiveModal] = useState(false);
  const [selectedTransferOrder, setSelectedTransferOrder] = useState<TransferOrder | null>(null);
  const [transferReceiveLines, setTransferReceiveLines] = useState<Array<{ itemId: string; name: string; shippedQty: number; receivedQty: number }>>([]);
  const [transferStatusFilter, setTransferStatusFilter] = useState<'ALL' | TransferStatus>('ALL');
  const [traceBatchId, setTraceBatchId] = useState<string | null>(null);
  const [traceItems, setTraceItems] = useState<Array<{ id: string; name: string; location_id?: string; sku_prefix?: string }>>([]);
  const [traceMovements, setTraceMovements] = useState<Array<{ created_at: string; movement_type: string; quantity: number; location_id?: string; reference_id?: string; actor_name?: string; inventory_item_id?: string }>>([]);
  const [isLoadingTrace, setIsLoadingTrace] = useState(false);

  const [showProductionOrderModal, setShowProductionOrderModal] = useState(false);
  const [productionOrderForm, setProductionOrderForm] = useState({
    destinationId: '',
    notes: '',
    items: [] as { product_id: string; size: string; quantity: number; name: string }[]
  });
  const [selectedProductionOrderItem, setSelectedProductionOrderItem] = useState('');
  const [productionOrderQty, setProductionOrderQty] = useState('');

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

  const managerLocationId = user?.role === UserRole.MANAGER ? user.location_id || null : null;
  const managerLocationName = managerLocationId ? locations.find(l => l.id === managerLocationId)?.name || '' : '';
  const branchLowStockItems = useMemo(() => {
    if (!managerLocationId) return [];
    return packagedItems.filter(item => item.location_id === managerLocationId && getStockStatus(item) === 'CRITICAL');
  }, [packagedItems, managerLocationId]);

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

  const productTotals = useMemo(() => {
    const totals = new Map<string, { productKey: string; productName: string; stock: number; available: number; unit?: string }>();
    packagedItems.forEach(item => {
      const productKey = item.productId || item.name;
      const existing = totals.get(productKey);
      const stock = item.stock || 0;
      const available = getAvailableStock(item);
      if (existing) {
        existing.stock += stock;
        existing.available += available;
        if (!existing.unit && item.unit) existing.unit = item.unit;
      } else {
        totals.set(productKey, {
          productKey,
          productName: item.name,
          stock,
          available,
          unit: item.unit
        });
      }
    });
    const rows = Array.from(totals.values());
    rows.sort((a, b) => a.productName.localeCompare(b.productName));
    const term = searchTerm.toLowerCase().trim();
    if (!term) return rows;
    return rows.filter(row => row.productName.toLowerCase().includes(term));
  }, [packagedItems, searchTerm]);

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
    const headers = ['Name', 'SKU', 'Batch', 'Location', 'Stock', 'Unit', 'Cost', 'Value', 'Status'];
    const csvContent = [
        headers.join(','),
        ...packagedItems.map(item => {
            const status = getStockStatus(item);
            const batchRef = item.batchId || '';
            return [
                `"${item.name}"`,
                item.skuPrefix || '',
                batchRef,
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

  const openTransferReceiveModal = (order: TransferOrder) => {
    const shipped = (order.shipped_manifest || order.manifest || []) as any[];
    const lines = shipped.map((it: any) => ({
      itemId: it.itemId,
      name: it.name || '',
      shippedQty: Number(it.quantity || 0),
      receivedQty: Number(it.quantity || 0)
    })).filter(l => l.itemId && l.shippedQty > 0);
    setSelectedTransferOrder(order);
    setTransferReceiveLines(lines);
    setShowTransferReceiveModal(true);
  };

  const approveTransfer = async (order: TransferOrder) => {
    if (!user || user.role !== UserRole.WAREHOUSE_STAFF) return;
    if (!confirm(t.confirmUpdateTransfer)) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.rpc('approve_stock_transfer', {
        p_transfer_id: order.id,
        p_user_id: user?.id || null,
        p_user_name: user?.name || null
      });
      if (error) throw error;
      setSuccessMsg(t.transferUpdated);
      setShowSuccess(true);
      fetchData();
      setTimeout(() => setShowSuccess(false), 2500);
    } catch (err) {
      console.error(err);
      alert(t.actionFailed);
    } finally {
      setIsSaving(false);
    }
  };

  const shipTransfer = async (order: TransferOrder) => {
    if (!user || user.role !== UserRole.WAREHOUSE_STAFF) return;
    if (!confirm(t.confirmUpdateTransfer)) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.rpc('ship_stock_transfer', {
        p_transfer_id: order.id,
        p_user_id: user?.id || null,
        p_user_name: user?.name || null
      });
      if (error) throw error;
      setSuccessMsg(t.transferUpdated);
      setShowSuccess(true);
      fetchData();
      setTimeout(() => setShowSuccess(false), 2500);
    } catch (err) {
      console.error(err);
      alert(t.actionFailed);
    } finally {
      setIsSaving(false);
    }
  };

  const confirmReceiveTransfer = async () => {
    if (!user || user.role !== UserRole.WAREHOUSE_STAFF) return;
    if (!selectedTransferOrder) return;
    if (!confirm(t.confirmUpdateTransfer)) return;
    setIsSaving(true);
    try {
      const received_manifest = transferReceiveLines.map(l => ({
        itemId: l.itemId,
        receivedQty: Math.max(0, Number(l.receivedQty) || 0)
      }));
      const { error } = await supabase.rpc('receive_stock_transfer', {
        p_transfer_id: selectedTransferOrder.id,
        p_received_manifest: received_manifest,
        p_user_id: user?.id || null,
        p_user_name: user?.name || null
      });
      if (error) throw error;
      setShowTransferReceiveModal(false);
      setSelectedTransferOrder(null);
      setTransferReceiveLines([]);
      setSuccessMsg(t.transferUpdated);
      setShowSuccess(true);
      fetchData();
      setTimeout(() => setShowSuccess(false), 2500);
    } catch (err) {
      console.error(err);
      alert(t.actionFailed);
    } finally {
      setIsSaving(false);
    }
  };

  const printTransferVoucher = (order: TransferOrder, mode: 'send' | 'receive') => {
    const sourceName = locations.find(l => l.id === order.source_location_id)?.name || '';
    const destName = locations.find(l => l.id === order.destination_location_id)?.name || '';
    const title = mode === 'send' ? (t.transferSendVoucher || 'Transfer Voucher (Send)') : (t.transferReceiveVoucher || 'Transfer Voucher (Receive)');
    const manifest = (mode === 'send' ? (order.shipped_manifest || order.manifest) : (order.received_manifest || order.shipped_manifest || order.manifest) || []) as any[];
    const disc = (order.discrepancy_manifest || []) as any[];
    const rows = manifest.map((it: any) => {
      const shippedQty = Number(it.quantity || it.shippedQty || 0);
      const receivedQty = Number(it.receivedQty ?? it.quantity ?? shippedQty);
      const variance = receivedQty - shippedQty;
      const d = disc.find((x: any) => x.itemId === it.itemId);
      const v = d ? Number(d.variance || 0) : variance;
      return `<tr><td>${String(it.name || '').replaceAll('<','&lt;').replaceAll('>','&gt;')}</td><td>${shippedQty}</td><td>${mode === 'receive' ? receivedQty : ''}</td><td>${mode === 'receive' ? v : ''}</td></tr>`;
    }).join('');
    const html = `
<html>
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 16px; }
      .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 12px 0; font-size: 12px; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      th, td { border: 1px solid #ddd; padding: 6px; font-size: 12px; text-align: left; }
      th { background: #f8f8f8; }
      h2 { margin: 0; }
    </style>
  </head>
  <body>
    <h2>${title}</h2>
    <div class="meta">
      <div><b>${t.transferNumber || 'Transfer #'}</b> ${(order.transfer_number || order.id)}</div>
      <div><b>${t.status || 'Status'}</b> ${order.status}</div>
      <div><b>${t.fromSource || 'Source'}</b> ${sourceName}</div>
      <div><b>${t.toDestination || 'Destination'}</b> ${destName}</div>
      <div><b>${t.date || 'Date'}</b> ${(order.created_at ? new Date(order.created_at).toLocaleString() : '')}</div>
      <div><b>${t.items || 'Items'}</b> ${order.items_count || manifest.length}</div>
    </div>
    <table>
      <thead>
        <tr>
          <th>${t.product || 'Item'}</th>
          <th>${t.shippedQty || 'Shipped'}</th>
          <th>${mode === 'receive' ? (t.receivedQty || 'Received') : ''}</th>
          <th>${mode === 'receive' ? (t.variance || 'Variance') : ''}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </body>
</html>
`.trim();
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  };

  const filteredTransferOrders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return transferOrders.filter(order => {
      if (transferStatusFilter !== 'ALL' && order.status !== transferStatusFilter) return false;
      if (!term) return true;
      const sourceName = locations.find(l => l.id === order.source_location_id)?.name || '';
      const destName = locations.find(l => l.id === order.destination_location_id)?.name || '';
      const hay = [
        order.transfer_number,
        order.status,
        sourceName,
        destName
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(term);
    });
  }, [transferOrders, transferStatusFilter, searchTerm, locations]);

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

  const coerceNumber = (value: any) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const trimmed = String(value).trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  };

  const coerceInt = (value: any) => {
    const n = coerceNumber(value);
    if (n === null) return null;
    return Math.trunc(n);
  };

  const coerceDate = (value: any) => {
    const trimmed = String(value ?? '').trim();
    return trimmed ? trimmed : null;
  };

  const normalizeOperatingHours = (value: any) => {
    if (!value || typeof value !== 'object') return DEFAULT_OPERATING_HOURS;
    return {
      ...DEFAULT_OPERATING_HOURS,
      ...(value as any)
    };
  };

  const buildLocationPayload = () => {
    const status = (locationForm.status || 'active') as any;
    const isActive = status === 'active';
    const type = (locationForm.type || 'BRANCH') as any;
    const isRoastery = type === 'ROASTERY' ? true : !!locationForm.is_roastery;
    const isHq = !!locationForm.is_hq;

    const payload: any = {
      id: locationForm.id,
      name: String(locationForm.name || '').trim(),
      type,
      address: String(locationForm.address || '').trim() || null,
      area: String(locationForm.area || '').trim() || null,
      city: String(locationForm.city || '').trim() || null,
      gps_lat: coerceNumber(locationForm.gps_lat),
      gps_lng: coerceNumber(locationForm.gps_lng),
      phone: String(locationForm.phone || '').trim() || null,
      email: String(locationForm.email || '').trim() || null,
      fax: String(locationForm.fax || '').trim() || null,
      operating_hours: normalizeOperatingHours(locationForm.operating_hours),
      branch_type: type === 'BRANCH' ? (locationForm.branch_type || 'SUB_BRANCH') : null,
      status,
      opening_date: coerceDate(locationForm.opening_date),
      closing_date: coerceDate(locationForm.closing_date),
      area_sqm: coerceNumber(locationForm.area_sqm),
      seating_capacity: coerceInt(locationForm.seating_capacity),
      is_hq: isHq,
      parent_location_id: isHq ? null : (locationForm.parent_location_id || null),
      commercial_license_number: String(locationForm.commercial_license_number || '').trim() || null,
      commercial_license_expiry: coerceDate(locationForm.commercial_license_expiry),
      logo_url: String(locationForm.logo_url || '').trim() || null,
      exterior_photo_url: String(locationForm.exterior_photo_url || '').trim() || null,
      interior_photo_url: String(locationForm.interior_photo_url || '').trim() || null,
      contact_person_name: String(locationForm.contact_person_name || '').trim() || null,
      contact_person_phone: String(locationForm.contact_person_phone || '').trim() || null,
      contact_person_email: String(locationForm.contact_person_email || '').trim() || null,
      is_active: isActive,
      is_roastery: isRoastery
    };

    const code = String((locationForm as any).code || '').trim();
    if (code) payload.code = code;

    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
    return payload;
  };

  const handleBranchPhotoUpload = async (kind: 'logo_url' | 'exterior_photo_url' | 'interior_photo_url', event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setBranchPhotoUploading(true);
      if (!event.target.files || event.target.files.length === 0) return;
      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${kind}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('branch-photos')
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('branch-photos')
        .getPublicUrl(filePath);

      setLocationForm(prev => ({ ...prev, [kind]: publicUrl } as any));
    } catch (error) {
      console.error('Error uploading branch photo:', error);
      alert(t.actionFailed);
    } finally {
      setBranchPhotoUploading(false);
    }
  };

  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = buildLocationPayload();
      if (!payload.name) {
        alert(t.fieldRequired);
        return;
      }
      const { data, error } = await supabase.from('locations').upsert(payload).select();
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
      alert(t.actionFailed);
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
        status: 'PENDING_APPROVAL',
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

  const addItemToProductionOrder = () => {
    if (!selectedProductionOrderItem || !productionOrderQty) return;
    const qty = Number(productionOrderQty);
    if (!Number.isFinite(qty) || qty <= 0) return;

    const item = packagedItems.find(i => i.id === selectedProductionOrderItem);
    const productId = (item as any)?.product_id;
    if (!item || !productId) return;

    setProductionOrderForm(prev => ({
      ...prev,
      items: [...prev.items, { product_id: productId, size: item.size || '', quantity: qty, name: item.name }]
    }));
    setSelectedProductionOrderItem('');
    setProductionOrderQty('');
  };

  const handleSaveProductionOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productionOrderForm.destinationId || productionOrderForm.items.length === 0) return;
    setIsSaving(true);
    try {
      const payloadItems = productionOrderForm.items.map(i => ({ product_id: i.product_id, size: i.size, quantity: i.quantity }));
      const { error } = await supabase.rpc('create_production_order', {
        p_destination_location_id: productionOrderForm.destinationId,
        p_items: payloadItems,
        p_notes: productionOrderForm.notes || null,
        p_created_by: user?.id || null,
        p_created_by_name: user?.name || null
      });
      if (error) throw error;
      setShowProductionOrderModal(false);
      setProductionOrderForm({ destinationId: '', notes: '', items: [] });
      setSuccessMsg(t.requestCreated);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error(error);
      alert(t.actionFailed);
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

  const suggestTransferDistribution = async () => {
    if (!transferForm.sourceId || !transferForm.destinationId) return;
    setIsSuggestingTransfer(true);
    try {
      const sourceItems = packagedItems
        .filter(i => i.location_id === transferForm.sourceId)
        .filter(i => i.batchId)
        .filter(i => getAvailableStock(i) > 0)
        .filter(i => i.productId);

      if (sourceItems.length === 0) {
        alert(t.noItemsFound);
        return;
      }

      const productIds = Array.from(new Set(sourceItems.map(i => i.productId).filter(Boolean))) as string[];
      const branchIds = locations.filter(l => !l.is_roastery).map(l => l.id);
      const branchCount = Math.max(1, branchIds.length);
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const sinceIso = since.toISOString();

      const { data: salesRows, error: salesError } = await supabase
        .from('inventory_movements')
        .select('location_id, quantity, inventory_item_id, inventory_items!inner(product_id)')
        .eq('movement_type', 'SALE')
        .gte('created_at', sinceIso)
        .in('location_id', branchIds)
        .in('inventory_items.product_id', productIds);

      if (salesError) throw salesError;

      const totalByProduct = new Map<string, number>();
      const destByProduct = new Map<string, number>();

      (salesRows || []).forEach((row: any) => {
        const productId = row.inventory_items?.product_id;
        if (!productId) return;
        const qty = Math.abs(Number(row.quantity || 0));
        totalByProduct.set(productId, (totalByProduct.get(productId) || 0) + qty);
        if (row.location_id === transferForm.destinationId) {
          destByProduct.set(productId, (destByProduct.get(productId) || 0) + qty);
        }
      });

      const suggested = sourceItems.map(item => {
        const productId = item.productId as string;
        const total = totalByProduct.get(productId) || 0;
        const dest = destByProduct.get(productId) || 0;
        const share = total > 0 ? (dest / total) : (1 / branchCount);
        const available = getAvailableStock(item);
        const qty = Math.max(0, Math.round(available * share));
        return qty <= 0 ? null : {
          itemId: item.id,
          quantity: qty,
          name: item.name,
          currentStock: item.stock
        };
      }).filter(Boolean) as { itemId: string; quantity: number; name: string; currentStock: number }[];

      setTransferForm(prev => ({
        ...prev,
        items: suggested
      }));
    } catch (err) {
      console.error(err);
      alert(t.actionFailed);
    } finally {
      setIsSuggestingTransfer(false);
    }
  };

  const openTraceabilityForBatch = async (batchId: string) => {
    setTraceBatchId(batchId);
    setIsLoadingTrace(true);
    setTraceItems([]);
    setTraceMovements([]);
    try {
      const { data: itemsData, error: itemsError } = await supabase
        .from('inventory_items')
        .select('id,name,location_id,sku_prefix')
        .eq('batch_id', batchId);
      if (itemsError) throw itemsError;
      const ids = (itemsData || []).map(i => i.id);
      setTraceItems(itemsData || []);
      if (ids.length === 0) return;
      const { data: mvData, error: mvError } = await supabase
        .from('inventory_movements')
        .select('created_at,movement_type,quantity,location_id,reference_id,actor_name,inventory_item_id')
        .in('inventory_item_id', ids)
        .order('created_at', { ascending: true });
      if (mvError) throw mvError;
      setTraceMovements((mvData || []) as any);
    } catch (err) {
      console.error(err);
      alert(t.actionFailed);
    } finally {
      setIsLoadingTrace(false);
    }
  };

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
    const [invRes, locRes, adjRes, transRes, poRes, countRes, countEntryRes] = await Promise.all([
        supabase.from('inventory_items').select('id,name,stock,reserved_stock,damaged_stock,min_stock,max_stock,unit,type,batch_id,location_id,expiry_date,roast_date,last_movement_at,cost_per_unit,sku_prefix,price,product_id,image'),
        supabase.from('locations').select('id,code,name,type,address,area,city,gps_lat,gps_lng,phone,email,fax,operating_hours,branch_type,status,opening_date,closing_date,area_sqm,seating_capacity,is_hq,parent_location_id,commercial_license_number,commercial_license_expiry,logo_url,exterior_photo_url,interior_photo_url,contact_person_name,contact_person_phone,contact_person_email,is_active,is_roastery').order('name', { ascending: true }),
        activeTab === 'adjustments'
          ? supabase.from('stock_adjustments').select('id,item_id,location_id,quantity,reason,notes,status,created_at,user_name,item_name,location_name,value').order('created_at', { ascending: false })
          : Promise.resolve({ data: null }),
        activeTab === 'transfers'
          ? supabase.from('stock_transfers').select('id,transfer_number,source_location_id,destination_location_id,status,created_at,received_at,items_count,manifest,shipped_manifest,received_manifest,discrepancy_manifest,approved_at,approved_by_name,shipped_at,shipped_by_name,received_by_name').order('created_at', { ascending: false })
          : Promise.resolve({ data: null }),
        activeTab === 'purchases'
          ? supabase.from('purchase_orders').select('id,supplier_name,location_id,status,created_at,received_at,items_count,total_value,manifest,received_manifest').order('created_at', { ascending: false })
          : Promise.resolve({ data: null }),
        activeTab === 'counts'
          ? supabase.from('inventory_count_tasks').select('id,name,location_id,frequency,start_date,next_run_date,last_run_date,status,created_at').order('created_at', { ascending: false })
          : Promise.resolve({ data: null }),
        activeTab === 'counts'
          ? supabase.from('inventory_count_entries').select('id,count_task_id,inventory_item_id,location_id,counted_qty,system_qty,variance,variance_percent,variance_value,status,counted_at,counted_by_name,approved_by_name').order('counted_at', { ascending: false })
          : Promise.resolve({ data: null })
      ]);

      if (invRes.data) setPackagedItems(invRes.data.map(item => ({
        ...item,
        batchId: item.batch_id || undefined,
        productId: item.product_id || undefined,
        skuPrefix: item.sku_prefix || undefined,
        image: item.image || ''
      })));
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
  }, [activeTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (activeTab !== 'transfers') return;
    const channel = supabase
      .channel('stock_transfers_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_transfers' }, () => {
        fetchData();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTab, fetchData]);

  const handleSaveCountTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || user.role !== UserRole.WAREHOUSE_STAFF) return;
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
        created_by: user?.id || null,
        updated_by: user?.id || null
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
    if (!user || user.role !== UserRole.WAREHOUSE_STAFF) return;
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
    if (!user || user.role !== UserRole.WAREHOUSE_STAFF) return;
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
    if (!user || user.role !== UserRole.WAREHOUSE_STAFF) return;
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
        user_id: user?.id || null,
        item_name: item?.name,
        location_name: locations.find(l => l.id === adjustmentForm.locationId)?.name,
        value: adjValue
      };

      const { error: adjError } = await supabase.from('stock_adjustments').insert([payload]);
      if (adjError) throw adjError;

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
    if (!user || user.role !== UserRole.WAREHOUSE_STAFF) return;
    
    setIsSaving(true);
    try {
      const { error: adjError } = await supabase.from('stock_adjustments').update({ status: newStatus }).eq('id', adj.id);
      if (adjError) throw adjError;

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
    ROASTING_WASTE: t.roastingWaste,
    QC_REJECTED: t.qcRejected,
    OTHER: t.other
  };

  const isWarehouseStaff = user?.role === UserRole.WAREHOUSE_STAFF;
  const openNewLocation = () => {
    setLocationForm({
      name: '',
      type: 'BRANCH',
      address: '',
      area: '',
      city: '',
      gps_lat: undefined,
      gps_lng: undefined,
      phone: '',
      email: '',
      fax: '',
      operating_hours: DEFAULT_OPERATING_HOURS,
      branch_type: 'SUB_BRANCH',
      status: 'active',
      opening_date: '',
      closing_date: '',
      area_sqm: undefined,
      seating_capacity: undefined,
      is_hq: false,
      parent_location_id: null,
      commercial_license_number: '',
      commercial_license_expiry: '',
      logo_url: '',
      exterior_photo_url: '',
      interior_photo_url: '',
      contact_person_name: '',
      contact_person_phone: '',
      contact_person_email: '',
      is_active: true,
      is_roastery: false
    });
    setShowLocationModal(true);
  };

  const openEditLocation = (loc: Location) => {
    setLocationForm({
      ...loc,
      operating_hours: (loc.operating_hours && typeof loc.operating_hours === 'object') ? loc.operating_hours : DEFAULT_OPERATING_HOURS,
      opening_date: (loc.opening_date as any) ? String(loc.opening_date).slice(0, 10) : '',
      closing_date: (loc.closing_date as any) ? String(loc.closing_date).slice(0, 10) : '',
      commercial_license_expiry: (loc.commercial_license_expiry as any) ? String(loc.commercial_license_expiry).slice(0, 10) : ''
    });
    setShowLocationModal(true);
  };

  const handleDeleteLocation = async (loc: Location) => {
    if (!confirm(t.confirmDeleteLocation || 'Delete this branch?')) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('locations').delete().eq('id', loc.id);
      if (error) throw error;
      setLocations(prev => prev.filter(l => l.id !== loc.id));
      setSuccessMsg(t.locationDeleted || 'Location deleted');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2500);
    } catch (err: any) {
      console.error(err);
      alert(t.actionFailed);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredLocations = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return locations
      .filter(loc => {
        if (locationTypeFilter !== 'ALL' && loc.type !== locationTypeFilter) return false;
        if (branchStatusFilter !== 'ALL' && (loc.status || 'active') !== branchStatusFilter) return false;
        if (branchTypeFilter !== 'ALL' && (loc.branch_type || 'SUB_BRANCH') !== branchTypeFilter) return false;
        if (hqFilter === 'HQ' && !loc.is_hq) return false;
        if (hqFilter === 'NON_HQ' && !!loc.is_hq) return false;
        if (!q) return true;
        const hay = [
          loc.code,
          loc.name,
          loc.address,
          loc.area,
          loc.city,
          loc.phone,
          loc.email
        ].filter(Boolean).join(' ').toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [locations, searchTerm, locationTypeFilter, branchStatusFilter, branchTypeFilter, hqFilter]);

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
            <button onClick={openNewLocation} className="bg-orange-600 text-white px-6 py-4 rounded-2xl font-bold shadow-lg  flex items-center gap-2 w-full md:w-auto justify-center transition-all active:scale-95">
               <Plus size={20} /> <span>{t.newLocation}</span>
            </button>
          )}
          {activeTab === 'transfers' && (
            <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
              <button onClick={() => setShowTransferModal(true)} className="bg-orange-600 text-white px-6 py-4 rounded-2xl font-bold shadow-lg  flex items-center gap-2 w-full md:w-auto justify-center transition-all active:scale-95">
                 <ArrowRightLeft size={20} /> <span>{t.newTransfer}</span>
              </button>
              <button
                onClick={() => {
                  setProductionOrderForm(prev => ({ ...prev, destinationId: managerLocationId || prev.destinationId }));
                  setShowProductionOrderModal(true);
                }}
                disabled={!managerLocationId}
                className="bg-white  text-black  px-6 py-4 rounded-2xl font-bold shadow-sm flex items-center gap-2 w-full md:w-auto justify-center transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
              >
                 <Send size={20} /> <span>{t.requestRoasting}</span>
              </button>
            </div>
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

        {activeTab === 'locations' && (
          <div className="px-6 pb-6 border-b border-orange-50 bg-white">
            <div className="flex flex-col lg:flex-row gap-3">
              <select value={locationTypeFilter} onChange={e => setLocationTypeFilter(e.target.value as any)} className="bg-white border border-orange-100 rounded-xl px-4 py-3 font-bold text-sm outline-none focus:ring-2 focus:ring-orange-600">
                <option value="ALL">{t.allTypes || 'All types'}</option>
                <option value="BRANCH">{t.branch}</option>
                <option value="WAREHOUSE">{t.warehouse}</option>
                <option value="ROASTERY">{t.roastery}</option>
              </select>
              <select value={branchTypeFilter} onChange={e => setBranchTypeFilter(e.target.value as any)} className="bg-white border border-orange-100 rounded-xl px-4 py-3 font-bold text-sm outline-none focus:ring-2 focus:ring-orange-600">
                <option value="ALL">{t.allTypes || 'All types'}</option>
                <option value="MAIN">{t.mainBranch || 'Main'}</option>
                <option value="SUB_BRANCH">{t.subBranch || 'Sub-branch'}</option>
                <option value="KIOSK">{t.kiosk || 'Kiosk'}</option>
                <option value="ONLINE">{t.online || 'Online'}</option>
              </select>
              <select value={branchStatusFilter} onChange={e => setBranchStatusFilter(e.target.value as any)} className="bg-white border border-orange-100 rounded-xl px-4 py-3 font-bold text-sm outline-none focus:ring-2 focus:ring-orange-600">
                <option value="ALL">{t.allStatus || 'All status'}</option>
                <option value="active">{t.active || 'Active'}</option>
                <option value="under_construction">{t.underConstruction || 'Under construction'}</option>
                <option value="temp_closed">{t.tempClosed || 'Temporarily closed'}</option>
                <option value="permanently_closed">{t.permanentlyClosed || 'Permanently closed'}</option>
              </select>
              <select value={hqFilter} onChange={e => setHqFilter(e.target.value as any)} className="bg-white border border-orange-100 rounded-xl px-4 py-3 font-bold text-sm outline-none focus:ring-2 focus:ring-orange-600">
                <option value="ALL">{t.all || 'All'}</option>
                <option value="HQ">{t.hq || 'HQ'}</option>
                <option value="NON_HQ">{t.nonHq || 'Non-HQ'}</option>
              </select>
            </div>
          </div>
        )}

        {activeTab === 'locations' ? (
          <div className="p-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLocations.map(loc => (
              <div key={loc.id} className="bg-white border border-orange-50 p-8 rounded-[32px] shadow-sm hover:shadow-xl transition-all group relative">
                 <div className="flex justify-between items-start mb-6">
                    <div className="p-4 bg-white text-orange-300 group- group- rounded-2xl transition-colors">
                       {loc.is_roastery ? <Coffee size={24}/> : <Store size={24}/>}
                    </div>
                    <div className="flex gap-2">
                       <button onClick={() => openEditLocation(loc)} className="p-2 rounded-full text-orange-300 hover:text-black transition-colors"><Edit size={16}/></button>
                       <button onClick={() => handleDeleteLocation(loc)} className="p-2 rounded-full text-orange-300 hover:text-red-600 transition-colors"><Trash2 size={16}/></button>
                    </div>
                 </div>
                 <div className="flex items-center justify-between gap-3 mb-2">
                   <h4 className="text-xl font-bold">{loc.name}</h4>
                   <div className="flex items-center gap-2">
                     {loc.is_hq && <span className="text-[10px] font-black uppercase text-orange-900 bg-orange-50 border border-orange-200 px-3 py-1 rounded-full">{t.hq || 'HQ'}</span>}
                     <span className="text-[10px] font-black uppercase text-black bg-white border border-orange-600 px-3 py-1 rounded-full">{loc.type || 'BRANCH'}</span>
                   </div>
                 </div>
                 {loc.code && <div className="text-[10px] font-black uppercase tracking-widest text-stone-500 mb-2">{loc.code}</div>}
                 <p className="text-xs text-black line-clamp-2">{loc.address}</p>
                 {(loc.city || loc.area) && (
                   <div className="mt-3 text-[10px] font-bold text-stone-500">{[loc.city, loc.area].filter(Boolean).join(' • ')}</div>
                 )}
                 <div className="mt-4 pt-4 border-t border-orange-50 flex justify-between items-center">
                    <span className={`text-[10px] font-bold uppercase ${loc.is_active ? 'text-green-600' : 'text-red-600'}`}>{String(loc.status || (loc.is_active ? 'active' : 'inactive')).replaceAll('_', ' ')}</span>
                    <span className="text-[10px] text-black">{packagedItems.filter(i => i.location_id === loc.id).length} Items</span>
                 </div>
              </div>
            ))}
          </div>
        ) : activeTab === 'transfers' ? (
          <div className="overflow-x-auto">
            <div className="p-6 border-b border-orange-50 bg-white">
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <div className="text-xs font-black uppercase tracking-widest text-black">{t.transfers}</div>
                <select value={transferStatusFilter} onChange={e => setTransferStatusFilter(e.target.value as any)} className="bg-white border border-orange-100 rounded-xl px-4 py-3 font-bold text-sm outline-none focus:ring-2 focus:ring-orange-600">
                  <option value="ALL">{t.allStatus || 'All status'}</option>
                  <option value="PENDING_APPROVAL">{t.request || 'Request'}</option>
                  <option value="APPROVED">{t.approved || 'Approved'}</option>
                  <option value="IN_TRANSIT">{t.inTransit || 'In transit'}</option>
                  <option value="RECEIVED">{t.received || 'Received'}</option>
                  <option value="CANCELLED">{t.cancelled || 'Cancelled'}</option>
                </select>
              </div>
            </div>
             <table className={`w-full ${lang === 'ar' ? 'text-right' : 'text-left'} text-sm min-w-[1100px]`}>
               <thead className="bg-white text-black uppercase text-[10px] font-black tracking-widest border-b border-orange-50">
                 <tr>
                    <th className="px-8 py-5">{t.date}</th>
                    <th className="px-8 py-5">{t.transferNumber || 'Transfer #'}</th>
                    <th className="px-8 py-5">{t.fromSource}</th>
                    <th className="px-8 py-5">{t.toDestination}</th>
                    <th className="px-8 py-5">{t.items}</th>
                    <th className="px-8 py-5">{t.status}</th>
                    <th className="px-8 py-5">{t.action}</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-orange-50">
                 {filteredTransferOrders.map(order => (
                   <tr key={order.id} className="hover/50">
                    <td className="px-8 py-5 font-mono text-xs text-black">{new Date(order.created_at).toLocaleDateString()}</td>
                    <td className="px-8 py-5 font-mono text-xs font-black text-black">{order.transfer_number || '-'}</td>
                    <td className="px-8 py-5 font-bold">{locations.find(l => l.id === order.source_location_id)?.name}</td>
                    <td className="px-8 py-5 font-bold">{locations.find(l => l.id === order.destination_location_id)?.name}</td>
                    <td className="px-8 py-5">{order.items_count} {t.items}</td>
                     <td className="px-8 py-5">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase border ${
                          order.status === 'RECEIVED' ? 'bg-white text-green-700 border-green-200' :
                          order.status === 'IN_TRANSIT' ? 'bg-white text-blue-700 border-blue-200' :
                          order.status === 'APPROVED' ? 'bg-white text-orange-700 border-orange-200' :
                          order.status === 'PENDING_APPROVAL' ? 'bg-white text-black border-orange-50' :
                          'bg-white text-red-600 border-red-200'
                        }`}>{order.status}</span>
                     </td>
                     <td className="px-8 py-5">
                        <div className="flex gap-2">
                          {(order.status === 'PENDING_APPROVAL' || order.status === 'DRAFT') && (
                            <button onClick={() => approveTransfer(order)} className="text-[10px] font-bold uppercase bg-white text-orange-600 border border-orange-200 px-3 py-1 rounded-full hover:bg-orange-50 transition-all">
                              {t.approve}
                            </button>
                          )}
                          {order.status === 'APPROVED' && (
                            <button onClick={() => shipTransfer(order)} className="text-[10px] font-bold uppercase bg-white text-blue-600 border border-blue-200 px-3 py-1 rounded-full hover:bg-blue-50 transition-all">
                              {t.ship || 'Ship'}
                            </button>
                          )}
                          {order.status === 'IN_TRANSIT' && (
                            <button onClick={() => openTransferReceiveModal(order)} className="text-[10px] font-bold uppercase bg-white text-green-600 border border-green-200 px-3 py-1 rounded-full hover:bg-green-50 transition-all">
                              {t.receive}
                            </button>
                          )}
                          {(order.status === 'IN_TRANSIT' || order.status === 'RECEIVED') && (
                            <button onClick={() => printTransferVoucher(order, 'send')} className="text-[10px] font-bold uppercase bg-white text-black border border-orange-100 px-3 py-1 rounded-full hover:bg-orange-50 transition-all">
                              {t.printSend || 'Print send'}
                            </button>
                          )}
                          {order.status === 'RECEIVED' && (
                            <button onClick={() => printTransferVoucher(order, 'receive')} className="text-[10px] font-bold uppercase bg-white text-black border border-orange-100 px-3 py-1 rounded-full hover:bg-orange-50 transition-all">
                              {t.printReceive || 'Print receive'}
                            </button>
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
                          {status === 'PENDING' && user?.role === UserRole.WAREHOUSE_STAFF ? (
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
            {managerLocationId && branchLowStockItems.length > 0 && (
              <div className="mx-10 bg-white border border-red-100 rounded-3xl px-6 py-4">
                <div className="text-red-500 text-xs font-black uppercase tracking-widest mb-1">{t.branchLowStockAlert}</div>
                <div className="text-sm font-semibold text-black">
                  {t.branchLowStockDetail
                    .replace('{branch}', managerLocationName || t.locationName)
                    .replace('{count}', branchLowStockItems.length.toString())}
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-black">
                  {branchLowStockItems.slice(0, 6).map(item => (
                    <span key={item.id} className="px-2 py-1 rounded-full bg-white border border-red-100 font-semibold">
                      {item.name}
                    </span>
                  ))}
                  {branchLowStockItems.length > 6 && (
                    <span className="px-2 py-1 rounded-full bg-white border border-red-100 font-semibold">
                      +{branchLowStockItems.length - 6}
                    </span>
                  )}
                </div>
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
              <div className="text-xs font-black uppercase tracking-widest text-black mb-4">{t.totalAcrossLocations}</div>
              <div className="overflow-x-auto">
                <table className={`w-full ${lang === 'ar' ? 'text-right' : 'text-left'} text-sm min-w-[800px]`}>
                  <thead className="bg-white text-black uppercase text-[10px] font-black tracking-widest border-b border-orange-50">
                    <tr>
                      <th className="px-4 py-3">{t.product}</th>
                      <th className="px-4 py-3">{t.totalStock}</th>
                      <th className="px-4 py-3">{t.available}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-orange-50">
                    {productTotals.map(row => (
                      <tr key={row.productKey} className="hover:bg-orange-50">
                        <td className="px-4 py-3 font-bold">{row.productName}</td>
                        <td className="px-4 py-3 font-mono font-black">{row.stock} {row.unit}</td>
                        <td className="px-4 py-3 font-mono font-black">{row.available} {row.unit}</td>
                      </tr>
                    ))}
                    {productTotals.length === 0 && (
                      <tr>
                        <td className="px-4 py-6 text-center text-sm text-black" colSpan={3}>{t.noItemsFound}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

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
                        <div className="text-[10px] text-black font-mono">{t.batchId}: {item.batchId || '-'}</div>
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
                        <div className="flex items-center gap-2">
                          <button onClick={() => { setAdjustmentForm({...adjustmentForm, locationId: item.location_id || '', itemId: item.id}); setShowAdjustmentModal(true); }} className="p-2 text-black hover:text-black  transition-colors"><ArrowRightLeft size={18} /></button>
                          <button onClick={() => { const bid = item.batchId; if (bid) openTraceabilityForBatch(bid); }} disabled={!item.batchId} className="p-2 text-black hover:text-black  transition-colors disabled:opacity-30"><History size={18} /></button>
                        </div>
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
                  {isWarehouseStaff && <th className="px-8 py-5">الإجراء</th>}
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
                    {isWarehouseStaff && (
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
          <div className="bg-white  rounded-[40px] max-w-4xl w-full p-8 md:p-10 shadow-2xl animate-in zoom-in-95 my-8 max-h-[90vh] overflow-y-auto custom-scrollbar" dir={t.dir}>
             <div className="flex justify-between items-center mb-8 border-b border-orange-50  pb-6">
               <h3 className="text-2xl font-bold">{locationForm.id ? t.editLocation : t.newLocation}</h3>
               <button onClick={() => setShowLocationModal(false)}><X size={32} className="text-black" /></button>
             </div>
             <form onSubmit={handleSaveLocation} className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-black">{t.branchCode || 'Code'}</label>
                        <input type="text" value={(locationForm as any).code || ''} placeholder={t.autoGenerated || 'Auto-generated'} readOnly className="w-full bg-white  p-4 rounded-xl font-bold outline-none border border-orange-50" />
                      </div>
                      <div className="md:col-span-2 space-y-2">
                        <label className="text-xs font-bold uppercase text-black">{t.locationName}</label>
                        <input required type="text" value={locationForm.name || ''} onChange={e => setLocationForm({ ...locationForm, name: e.target.value })} className="w-full bg-white  p-4 rounded-xl font-bold outline-none focus:ring-2 focus:ring-orange-600" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-black">{t.type}</label>
                        <select value={locationForm.type} onChange={e => setLocationForm({ ...locationForm, type: e.target.value as any })} className="w-full bg-white  p-4 rounded-xl font-bold outline-none focus:ring-2 focus:ring-orange-600">
                          <option value="WAREHOUSE">{t.warehouse}</option>
                          <option value="BRANCH">{t.branch}</option>
                          <option value="ROASTERY">{t.roastery}</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-black">{t.branchType || 'Branch type'}</label>
                        <select value={locationForm.branch_type || 'SUB_BRANCH'} onChange={e => setLocationForm({ ...locationForm, branch_type: e.target.value as any })} disabled={locationForm.type !== 'BRANCH'} className="w-full bg-white  p-4 rounded-xl font-bold outline-none focus:ring-2 focus:ring-orange-600 disabled:opacity-50">
                          <option value="MAIN">{t.mainBranch || 'Main'}</option>
                          <option value="SUB_BRANCH">{t.subBranch || 'Sub-branch'}</option>
                          <option value="KIOSK">{t.kiosk || 'Kiosk'}</option>
                          <option value="ONLINE">{t.online || 'Online'}</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-black">{t.branchStatus || 'Status'}</label>
                        <select value={locationForm.status || 'active'} onChange={e => setLocationForm({ ...locationForm, status: e.target.value as any })} className="w-full bg-white  p-4 rounded-xl font-bold outline-none focus:ring-2 focus:ring-orange-600">
                          <option value="active">{t.active || 'Active'}</option>
                          <option value="under_construction">{t.underConstruction || 'Under construction'}</option>
                          <option value="temp_closed">{t.tempClosed || 'Temporarily closed'}</option>
                          <option value="permanently_closed">{t.permanentlyClosed || 'Permanently closed'}</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-black">{t.openingDate || 'Opening date'}</label>
                        <input type="date" value={(locationForm.opening_date as any) || ''} onChange={e => setLocationForm({ ...locationForm, opening_date: e.target.value })} className="w-full bg-white  p-4 rounded-xl font-bold outline-none focus:ring-2 focus:ring-orange-600" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-black">{t.closingDate || 'Closing date'}</label>
                        <input type="date" value={(locationForm.closing_date as any) || ''} onChange={e => setLocationForm({ ...locationForm, closing_date: e.target.value })} className="w-full bg-white  p-4 rounded-xl font-bold outline-none focus:ring-2 focus:ring-orange-600" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-black">{t.hq || 'HQ'}</label>
                        <div className="flex items-center gap-3 bg-white border border-orange-100 rounded-xl px-4 py-4">
                          <input type="checkbox" checked={!!locationForm.is_hq} onChange={e => setLocationForm({ ...locationForm, is_hq: e.target.checked, parent_location_id: e.target.checked ? null : locationForm.parent_location_id })} />
                          <span className="text-sm font-bold">{t.setAsHq || 'Set as HQ'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-black">{t.parentBranch || 'Parent branch'}</label>
                        <select value={(locationForm.parent_location_id as any) || ''} onChange={e => setLocationForm({ ...locationForm, parent_location_id: e.target.value || null })} disabled={!!locationForm.is_hq || locationForm.type !== 'BRANCH'} className="w-full bg-white  p-4 rounded-xl font-bold outline-none focus:ring-2 focus:ring-orange-600 disabled:opacity-50">
                          <option value="">{t.none || 'None'}</option>
                          {locations
                            .filter(l => l.id !== locationForm.id)
                            .filter(l => l.type === 'BRANCH')
                            .map(l => (
                              <option key={l.id} value={l.id}>{[l.code, l.name].filter(Boolean).join(' - ')}</option>
                            ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase text-black">{t.areaSqm || 'Area (sqm)'}</label>
                          <input type="number" value={(locationForm.area_sqm as any) ?? ''} onChange={e => setLocationForm({ ...locationForm, area_sqm: e.target.value as any })} className="w-full bg-white  p-4 rounded-xl font-mono font-bold outline-none focus:ring-2 focus:ring-orange-600" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase text-black">{t.seatingCapacity || 'Seating'}</label>
                          <input type="number" value={(locationForm.seating_capacity as any) ?? ''} onChange={e => setLocationForm({ ...locationForm, seating_capacity: e.target.value as any })} className="w-full bg-white  p-4 rounded-xl font-mono font-bold outline-none focus:ring-2 focus:ring-orange-600" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-black">{t.address}</label>
                      <input type="text" value={locationForm.address || ''} onChange={e => setLocationForm({ ...locationForm, address: e.target.value })} className="w-full bg-white  p-4 rounded-xl font-bold outline-none focus:ring-2 focus:ring-orange-600" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-black">{t.city || 'City'}</label>
                        <input type="text" value={locationForm.city || ''} onChange={e => setLocationForm({ ...locationForm, city: e.target.value })} className="w-full bg-white  p-4 rounded-xl font-bold outline-none focus:ring-2 focus:ring-orange-600" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-black">{t.area || 'Area'}</label>
                        <input type="text" value={locationForm.area || ''} onChange={e => setLocationForm({ ...locationForm, area: e.target.value })} className="w-full bg-white  p-4 rounded-xl font-bold outline-none focus:ring-2 focus:ring-orange-600" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-black">{t.gpsLat || 'GPS lat'}</label>
                        <input type="number" value={(locationForm.gps_lat as any) ?? ''} onChange={e => setLocationForm({ ...locationForm, gps_lat: e.target.value as any })} className="w-full bg-white  p-4 rounded-xl font-mono font-bold outline-none focus:ring-2 focus:ring-orange-600" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-black">{t.gpsLng || 'GPS lng'}</label>
                        <input type="number" value={(locationForm.gps_lng as any) ?? ''} onChange={e => setLocationForm({ ...locationForm, gps_lng: e.target.value as any })} className="w-full bg-white  p-4 rounded-xl font-mono font-bold outline-none focus:ring-2 focus:ring-orange-600" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-black">{t.phone || 'Phone'}</label>
                        <input type="text" value={locationForm.phone || ''} onChange={e => setLocationForm({ ...locationForm, phone: e.target.value })} className="w-full bg-white  p-4 rounded-xl font-bold outline-none focus:ring-2 focus:ring-orange-600" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-black">{t.email || 'Email'}</label>
                        <input type="email" value={locationForm.email || ''} onChange={e => setLocationForm({ ...locationForm, email: e.target.value })} className="w-full bg-white  p-4 rounded-xl font-bold outline-none focus:ring-2 focus:ring-orange-600" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-black">{t.fax || 'Fax'}</label>
                        <input type="text" value={locationForm.fax || ''} onChange={e => setLocationForm({ ...locationForm, fax: e.target.value })} className="w-full bg-white  p-4 rounded-xl font-bold outline-none focus:ring-2 focus:ring-orange-600" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-black">{t.contactPerson || 'Contact person'}</label>
                        <input type="text" value={locationForm.contact_person_name || ''} onChange={e => setLocationForm({ ...locationForm, contact_person_name: e.target.value })} className="w-full bg-white  p-4 rounded-xl font-bold outline-none focus:ring-2 focus:ring-orange-600" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-black">{t.contactPhone || 'Contact phone'}</label>
                        <input type="text" value={locationForm.contact_person_phone || ''} onChange={e => setLocationForm({ ...locationForm, contact_person_phone: e.target.value })} className="w-full bg-white  p-4 rounded-xl font-bold outline-none focus:ring-2 focus:ring-orange-600" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-black">{t.contactEmail || 'Contact email'}</label>
                        <input type="email" value={locationForm.contact_person_email || ''} onChange={e => setLocationForm({ ...locationForm, contact_person_email: e.target.value })} className="w-full bg-white  p-4 rounded-xl font-bold outline-none focus:ring-2 focus:ring-orange-600" />
                      </div>
                    </div>

                    <div className="bg-white border border-orange-100 rounded-3xl p-6 space-y-4">
                      <div className="text-sm font-bold">{t.operatingHours || 'Operating hours'}</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const).map(day => {
                          const oh = ((locationForm.operating_hours as any) || DEFAULT_OPERATING_HOURS) as any;
                          const row = oh[day] || { open: '', close: '', closed: false };
                          const label =
                            day === 'mon' ? (t.dayMon || 'Mon') :
                            day === 'tue' ? (t.dayTue || 'Tue') :
                            day === 'wed' ? (t.dayWed || 'Wed') :
                            day === 'thu' ? (t.dayThu || 'Thu') :
                            day === 'fri' ? (t.dayFri || 'Fri') :
                            day === 'sat' ? (t.daySat || 'Sat') :
                            (t.daySun || 'Sun');
                          return (
                            <div key={day} className="flex items-center gap-3 bg-white border border-orange-50 rounded-2xl p-4">
                              <div className="w-16 text-xs font-black uppercase text-stone-600">{label}</div>
                              <label className="flex items-center gap-2 text-xs font-bold text-stone-600">
                                <input type="checkbox" checked={!!row.closed} onChange={e => setLocationForm({ ...locationForm, operating_hours: { ...oh, [day]: { ...row, closed: e.target.checked } } as any })} />
                                {t.closed || 'Closed'}
                              </label>
                              <input type="time" value={row.open || ''} disabled={!!row.closed} onChange={e => setLocationForm({ ...locationForm, operating_hours: { ...oh, [day]: { ...row, open: e.target.value } } as any })} className="flex-1 bg-white border border-orange-100 rounded-xl px-3 py-2 font-mono font-bold outline-none disabled:opacity-40" />
                              <input type="time" value={row.close || ''} disabled={!!row.closed} onChange={e => setLocationForm({ ...locationForm, operating_hours: { ...oh, [day]: { ...row, close: e.target.value } } as any })} className="flex-1 bg-white border border-orange-100 rounded-xl px-3 py-2 font-mono font-bold outline-none disabled:opacity-40" />
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-black">{t.commercialLicenseNumber || 'Commercial license #'}</label>
                        <input type="text" value={locationForm.commercial_license_number || ''} onChange={e => setLocationForm({ ...locationForm, commercial_license_number: e.target.value })} className="w-full bg-white  p-4 rounded-xl font-bold outline-none focus:ring-2 focus:ring-orange-600" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-black">{t.commercialLicenseExpiry || 'Commercial license expiry'}</label>
                        <input type="date" value={(locationForm.commercial_license_expiry as any) || ''} onChange={e => setLocationForm({ ...locationForm, commercial_license_expiry: e.target.value })} className="w-full bg-white  p-4 rounded-xl font-bold outline-none focus:ring-2 focus:ring-orange-600" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-white border border-orange-100 rounded-3xl p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-bold">{t.branchPhotos || 'Photos'}</div>
                        {branchPhotoUploading && <div className="text-xs font-bold text-stone-500">{t.loading}</div>}
                      </div>
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <div className="text-xs font-bold text-stone-600">{t.logo || 'Logo'}</div>
                          {locationForm.logo_url && <img src={locationForm.logo_url as any} className="w-full h-32 object-cover rounded-2xl border border-orange-50" />}
                          <input type="file" accept="image/*" disabled={branchPhotoUploading} onChange={e => handleBranchPhotoUpload('logo_url', e)} className="w-full" />
                        </div>
                        <div className="space-y-2">
                          <div className="text-xs font-bold text-stone-600">{t.exterior || 'Exterior'}</div>
                          {locationForm.exterior_photo_url && <img src={locationForm.exterior_photo_url as any} className="w-full h-32 object-cover rounded-2xl border border-orange-50" />}
                          <input type="file" accept="image/*" disabled={branchPhotoUploading} onChange={e => handleBranchPhotoUpload('exterior_photo_url', e)} className="w-full" />
                        </div>
                        <div className="space-y-2">
                          <div className="text-xs font-bold text-stone-600">{t.interior || 'Interior'}</div>
                          {locationForm.interior_photo_url && <img src={locationForm.interior_photo_url as any} className="w-full h-32 object-cover rounded-2xl border border-orange-50" />}
                          <input type="file" accept="image/*" disabled={branchPhotoUploading} onChange={e => handleBranchPhotoUpload('interior_photo_url', e)} className="w-full" />
                        </div>
                      </div>
                    </div>
                  </div>
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
          <div className="bg-white  rounded-[32px] sm:rounded-[40px] max-w-4xl w-full p-5 sm:p-8 md:p-10 shadow-2xl animate-in zoom-in-95 my-8 max-h-[90vh] overflow-y-auto custom-scrollbar" dir={t.dir}>
             <div className="flex justify-between items-center mb-6 sm:mb-8 border-b border-orange-50  pb-5 sm:pb-6">
               <div>
                 <h3 className="text-xl sm:text-2xl font-bold">{t.newStockTransfer}</h3>
                 <div className="text-xs text-black mt-1">{t.transferOrder}</div>
               </div>
               <button onClick={() => setShowTransferModal(false)}><X size={28} className="text-black" /></button>
             </div>
             <form onSubmit={handleSaveTransfer} className="space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white  border border-orange-100  rounded-3xl p-5">
                      <div className="text-[10px] font-black uppercase tracking-widest text-black mb-2">{t.fromSource}</div>
                      <select required value={transferForm.sourceId} onChange={e => setTransferForm({...transferForm, sourceId: e.target.value})} className="w-full bg-white  border border-orange-100  rounded-2xl px-4 py-4 font-bold outline-none focus:ring-2 focus:ring-orange-600">
                        <option value="">-- {t.fromSource} --</option>
                        {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                    </div>
                    <div className="bg-white  border border-orange-100  rounded-3xl p-5">
                      <div className="text-[10px] font-black uppercase tracking-widest text-black mb-2">{t.toDestination}</div>
                      <select required value={transferForm.destinationId} onChange={e => setTransferForm({...transferForm, destinationId: e.target.value})} className="w-full bg-white  border border-orange-100  rounded-2xl px-4 py-4 font-bold outline-none focus:ring-2 focus:ring-orange-600">
                        <option value="">-- {t.toDestination} --</option>
                        {locations.filter(l => l.id !== transferForm.sourceId).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="bg-white  border border-orange-100  rounded-3xl p-5">
                    <div className="text-[10px] font-black uppercase tracking-widest text-black mb-3">{t.summary}</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white  border border-orange-50  rounded-2xl p-4">
                        <div className="text-[10px] font-black uppercase text-black">{t.items}</div>
                        <div className="text-2xl font-black font-mono text-black mt-1">{transferForm.items.length}</div>
                      </div>
                      <div className="bg-white  border border-orange-50  rounded-2xl p-4">
                        <div className="text-[10px] font-black uppercase text-black">{t.quantity}</div>
                        <div className="text-2xl font-black font-mono text-black mt-1">{transferForm.items.reduce((acc, it) => acc + Number(it.quantity || 0), 0)}</div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Items Section */}
                <div className="bg-white  border border-orange-100  rounded-3xl p-6 space-y-5">
                   <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                     <div>
                       <h4 className="text-lg font-bold">{t.itemsToTransfer}</h4>
                       <div className="text-xs text-black">{t.itemsHeader}</div>
                     </div>
                     <button type="button" onClick={suggestTransferDistribution} disabled={!transferForm.sourceId || !transferForm.destinationId || isSuggestingTransfer} className="px-4 py-2.5 rounded-2xl text-xs font-bold bg-orange-600 text-white shadow-md disabled:opacity-40">
                       {isSuggestingTransfer ? t.loading : t.suggestSmartDistribution}
                     </button>
                   </div>
                   <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                     <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                       <div className="sm:col-span-2">
                         <select disabled={!transferForm.sourceId} value={selectedTransferItem} onChange={e => setSelectedTransferItem(e.target.value)} className="w-full bg-white  border border-orange-100  rounded-2xl px-4 py-4 font-bold outline-none focus:ring-2 focus:ring-orange-600">
                           <option value="">{t.itemLabel}</option>
                           {packagedItems.filter(i => i.location_id === transferForm.sourceId).map(i => <option key={i.id} value={i.id}>{i.name} ({t.stock}: {i.stock})</option>)}
                         </select>
                       </div>
                       <div className="flex gap-3">
                         <input type="number" placeholder={t.quantity} value={transferItemQty} onChange={e => setTransferItemQty(e.target.value)} className="flex-1 bg-white  border border-orange-100  rounded-2xl px-4 py-4 font-mono font-bold outline-none focus:ring-2 focus:ring-orange-600" />
                         <button type="button" onClick={addItemToTransfer} className="px-4 rounded-2xl bg-orange-600 text-white shadow-md active:scale-95 transition-all flex items-center justify-center"><Plus size={20}/></button>
                       </div>
                     </div>
                     <div className="bg-white  border border-orange-50  rounded-2xl p-4">
                       <div className="text-[10px] font-black uppercase tracking-widest text-black mb-2">{t.stock}</div>
                       <div className="text-sm text-black">
                         {selectedTransferItem
                           ? (() => {
                               const it = packagedItems.find(p => p.id === selectedTransferItem);
                               if (!it) return '-';
                               return `${it.stock} / ${getAvailableStock(it)} ${it.unit || ''}`;
                             })()
                           : '-'}
                       </div>
                     </div>
                   </div>
                   <div className="space-y-2">
                      {transferForm.items.map((item, idx) => (
                        <div key={idx} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white  border border-orange-50  p-4 rounded-2xl">
                           <div className="min-w-0">
                             <div className="font-bold truncate">{item.name}</div>
                             <div className="text-[10px] text-black">{t.available}: {item.currentStock}</div>
                           </div>
                           <div className="flex items-center justify-between sm:justify-end gap-4">
                             <div className="px-3 py-1.5 rounded-full bg-orange-50 text-black font-mono font-black text-xs">{item.quantity}</div>
                             <button type="button" onClick={() => setTransferForm(prev => ({...prev, items: prev.items.filter((_, i) => i !== idx)}))} className="p-2 rounded-xl bg-white border border-orange-100 text-red-600 hover:text-red-600"><Trash2 size={16}/></button>
                           </div>
                        </div>
                      ))}
                     {transferForm.items.length === 0 && <div className="p-6 text-center text-black bg-white/40 rounded-3xl border-2 border-dashed border-orange-50 ">{t.addItemsPrompt}</div>}
                   </div>
                </div>

                <div className="space-y-2">
                   <label className="text-xs font-bold uppercase text-black">{t.notes}</label>
                   <textarea value={transferForm.notes} onChange={e => setTransferForm({...transferForm, notes: e.target.value})} className="w-full bg-white  border border-orange-100  rounded-2xl px-4 py-4 font-bold h-24 outline-none focus:ring-2 focus:ring-orange-600 resize-none" />
                </div>
                
                <div className="sticky bottom-0 -mx-5 sm:-mx-8 md:-mx-10 px-5 sm:px-8 md:px-10 pt-5 pb-4 bg-white border-t border-orange-50">
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                    <button type="button" onClick={() => setShowTransferModal(false)} className="w-full sm:flex-1 py-4 font-bold text-black border border-orange-100 rounded-2xl">{t.cancel}</button>
                    <button type="submit" disabled={isSaving || transferForm.items.length === 0} className="w-full sm:flex-[2] bg-orange-600 text-white py-4 rounded-2xl font-bold shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2  disabled:opacity-50 disabled:pointer-events-none">
                      {isSaving ? <Loader2 className="animate-spin" /> : <Send size={18} />} {t.createTransfer}
                    </button>
                  </div>
                </div>
             </form>
          </div>
        </div>
      )}

      {showTransferReceiveModal && (
        <div className="fixed inset-0 z-[170] flex items-center justify-center p-4 bg-white/60 backdrop-blur-md overflow-y-auto">
          <div className="bg-white rounded-[32px] sm:rounded-[40px] max-w-3xl w-full p-5 sm:p-8 md:p-10 shadow-2xl animate-in zoom-in-95 my-8 max-h-[90vh] overflow-y-auto custom-scrollbar" dir={t.dir}>
            <div className="flex justify-between items-center mb-6 sm:mb-8 border-b border-orange-50  pb-5 sm:pb-6">
              <div>
                <h3 className="text-xl sm:text-2xl font-bold">{t.receive || 'Receive'}</h3>
                <div className="text-xs text-black mt-1">{t.transferNumber || 'Transfer #'}: {selectedTransferOrder?.transfer_number || selectedTransferOrder?.id}</div>
              </div>
              <button onClick={() => { setShowTransferReceiveModal(false); setSelectedTransferOrder(null); setTransferReceiveLines([]); }}><X size={28} className="text-black" /></button>
            </div>

            <div className="space-y-6">
              <div className="overflow-x-auto">
                <table className={`w-full ${lang === 'ar' ? 'text-right' : 'text-left'} text-sm min-w-[700px]`}>
                  <thead className="bg-white text-black uppercase text-[10px] font-black tracking-widest border-b border-orange-50">
                    <tr>
                      <th className="px-4 py-3">{t.product}</th>
                      <th className="px-4 py-3">{t.shippedQty || 'Shipped'}</th>
                      <th className="px-4 py-3">{t.receivedQty || 'Received'}</th>
                      <th className="px-4 py-3">{t.variance || 'Variance'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-orange-50">
                    {transferReceiveLines.map((line, idx) => (
                      <tr key={line.itemId}>
                        <td className="px-4 py-4 font-bold">{line.name || '-'}</td>
                        <td className="px-4 py-4 font-mono font-black">{line.shippedQty}</td>
                        <td className="px-4 py-4">
                          <input
                            type="number"
                            min="0"
                            value={line.receivedQty}
                            onChange={e => setTransferReceiveLines(prev => prev.map((l, i) => i === idx ? { ...l, receivedQty: Number(e.target.value || 0) } : l))}
                            className="w-32 bg-white border border-orange-100 rounded-xl px-3 py-2 font-mono font-black outline-none focus:ring-2 focus:ring-orange-600"
                          />
                        </td>
                        <td className="px-4 py-4 font-mono font-black">{Number(line.receivedQty || 0) - Number(line.shippedQty || 0)}</td>
                      </tr>
                    ))}
                    {transferReceiveLines.length === 0 && (
                      <tr>
                        <td className="px-4 py-6 text-center text-sm text-black" colSpan={4}>{t.noItemsFound}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <button type="button" onClick={() => { setShowTransferReceiveModal(false); setSelectedTransferOrder(null); setTransferReceiveLines([]); }} className="w-full sm:flex-1 py-4 font-bold text-black border border-orange-100 rounded-2xl">{t.cancel}</button>
                <button type="button" onClick={confirmReceiveTransfer} disabled={isSaving || transferReceiveLines.length === 0} className="w-full sm:flex-[2] bg-orange-600 text-white py-4 rounded-2xl font-bold shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2  disabled:opacity-50 disabled:pointer-events-none">
                  {isSaving ? <Loader2 className="animate-spin" /> : (t.confirmReceipt || 'Confirm receipt')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showProductionOrderModal && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-white/60 backdrop-blur-md overflow-y-auto">
          <div className="bg-white  rounded-[32px] sm:rounded-[40px] max-w-3xl w-full p-5 sm:p-8 md:p-10 shadow-2xl animate-in zoom-in-95 my-8 max-h-[90vh] overflow-y-auto custom-scrollbar" dir={t.dir}>
            <div className="flex justify-between items-center mb-6 sm:mb-8 border-b border-orange-50  pb-5 sm:pb-6">
              <div>
                <h3 className="text-xl sm:text-2xl font-bold">{t.requestRoasting}</h3>
                <div className="text-xs text-black mt-1">{t.branchRequestHint}</div>
              </div>
              <button onClick={() => setShowProductionOrderModal(false)}><X size={28} className="text-black" /></button>
            </div>
            <form onSubmit={handleSaveProductionOrder} className="space-y-6">
              <div className="bg-white  border border-orange-100  rounded-3xl p-5">
                <div className="text-[10px] font-black uppercase tracking-widest text-black mb-2">{t.toDestination}</div>
                <select
                  required
                  value={productionOrderForm.destinationId}
                  onChange={e => setProductionOrderForm(prev => ({ ...prev, destinationId: e.target.value }))}
                  className="w-full bg-white  border border-orange-100  rounded-2xl px-4 py-4 font-bold outline-none focus:ring-2 focus:ring-orange-600"
                >
                  <option value="">{t.selectOption}</option>
                  {locations.filter(l => l.type === 'BRANCH').map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>

              <div className="bg-white  border border-orange-100  rounded-3xl p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h4 className="text-lg font-bold">{t.itemsHeader}</h4>
                    <div className="text-xs text-black">{t.requestedQuantities}</div>
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <select
                        value={selectedProductionOrderItem}
                        onChange={e => setSelectedProductionOrderItem(e.target.value)}
                        className="w-full bg-white  border border-orange-100  rounded-2xl px-4 py-4 font-bold outline-none focus:ring-2 focus:ring-orange-600"
                      >
                        <option value="">{t.itemLabel}</option>
                        {packagedItems
                          .filter(i => !productionOrderForm.destinationId || i.location_id === productionOrderForm.destinationId)
                          .filter(i => i.type === 'PACKAGED_COFFEE')
                          .filter(i => (i as any).product_id)
                          .map(i => <option key={i.id} value={i.id}>{i.name}{i.size ? ` (${i.size})` : ''}</option>)}
                      </select>
                    </div>
                    <div className="flex gap-3">
                      <input type="number" placeholder={t.quantity} value={productionOrderQty} onChange={e => setProductionOrderQty(e.target.value)} className="flex-1 bg-white  border border-orange-100  rounded-2xl px-4 py-4 font-mono font-bold outline-none focus:ring-2 focus:ring-orange-600" />
                      <button type="button" onClick={addItemToProductionOrder} className="px-4 rounded-2xl bg-orange-600 text-white shadow-md active:scale-95 transition-all flex items-center justify-center"><Plus size={20}/></button>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  {productionOrderForm.items.map((item, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white  border border-orange-50  p-4 rounded-2xl">
                      <div className="min-w-0">
                        <div className="font-bold truncate">{item.name}</div>
                        <div className="text-[10px] text-black">{item.size || '-'}</div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-4">
                        <div className="px-3 py-1.5 rounded-full bg-orange-50 text-black font-mono font-black text-xs">{item.quantity}</div>
                        <button type="button" onClick={() => setProductionOrderForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }))} className="p-2 rounded-xl bg-white border border-orange-100 text-red-600 hover:text-red-600"><Trash2 size={16}/></button>
                      </div>
                    </div>
                  ))}
                  {productionOrderForm.items.length === 0 && <div className="p-6 text-center text-black bg-white/40 rounded-3xl border-2 border-dashed border-orange-50 ">{t.addItemsPrompt}</div>}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-black">{t.notes}</label>
                <textarea value={productionOrderForm.notes} onChange={e => setProductionOrderForm(prev => ({ ...prev, notes: e.target.value }))} className="w-full bg-white  border border-orange-100  rounded-2xl px-4 py-4 font-bold h-24 outline-none focus:ring-2 focus:ring-orange-600 resize-none" />
              </div>

              <div className="sticky bottom-0 -mx-5 sm:-mx-8 md:-mx-10 px-5 sm:px-8 md:px-10 pt-5 pb-4 bg-white border-t border-orange-50">
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                  <button type="button" onClick={() => setShowProductionOrderModal(false)} className="w-full sm:flex-1 py-4 font-bold text-black border border-orange-100 rounded-2xl">{t.cancel}</button>
                  <button type="submit" disabled={isSaving || productionOrderForm.items.length === 0 || !productionOrderForm.destinationId} className="w-full sm:flex-[2] bg-orange-600 text-white py-4 rounded-2xl font-bold shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2  disabled:opacity-50 disabled:pointer-events-none">
                    {isSaving ? <Loader2 className="animate-spin" /> : <Send size={18} />} {t.createRequest}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {traceBatchId && (
        <div className="fixed inset-0 z-[170] flex items-center justify-center p-4 bg-white/60 backdrop-blur-md overflow-y-auto">
          <div className="bg-white  rounded-[32px] sm:rounded-[40px] max-w-5xl w-full p-5 sm:p-8 md:p-10 shadow-2xl my-8 max-h-[90vh] overflow-y-auto custom-scrollbar" dir={t.dir}>
            <div className="flex justify-between items-center mb-6 sm:mb-8 border-b border-orange-50  pb-5 sm:pb-6">
              <div>
                <h3 className="text-xl sm:text-2xl font-bold flex items-center gap-2"><History size={22} /> {t.traceabilityChain}</h3>
                <div className="text-xs text-black font-mono mt-1">{t.batchId}: {traceBatchId}</div>
              </div>
              <button onClick={() => setTraceBatchId(null)}><X size={28} className="text-black" /></button>
            </div>

            {isLoadingTrace ? (
              <div className="py-12 flex items-center justify-center gap-3 text-black font-bold">
                <Loader2 className="animate-spin" /> {t.loading}
              </div>
            ) : (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white  border border-orange-100  rounded-3xl p-5">
                    <div className="text-[10px] font-black uppercase tracking-widest text-black mb-2">{t.items}</div>
                    <div className="text-3xl font-black font-mono text-black">{traceItems.length}</div>
                  </div>
                  <div className="bg-white  border border-orange-100  rounded-3xl p-5">
                    <div className="text-[10px] font-black uppercase tracking-widest text-black mb-2">{t.locations}</div>
                    <div className="text-3xl font-black font-mono text-black">{Array.from(new Set(traceItems.map(i => i.location_id).filter(Boolean))).length}</div>
                  </div>
                  <div className="bg-white  border border-orange-100  rounded-3xl p-5">
                    <div className="text-[10px] font-black uppercase tracking-widest text-black mb-2">{t.lastUpdated}</div>
                    <div className="text-sm font-mono font-black text-black">
                      {traceMovements.length > 0 ? new Date(traceMovements[traceMovements.length - 1].created_at).toLocaleString() : '-'}
                    </div>
                  </div>
                </div>

                <div className="bg-white  border border-orange-100  rounded-3xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-xs font-black uppercase tracking-widest text-black">{t.itemsHeader}</div>
                      <div className="text-xs text-black mt-1">{t.finalPackages}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {traceItems.map(it => (
                      <div key={it.id} className="p-4 rounded-2xl border border-orange-50 bg-white/50">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-bold truncate">{it.name}</div>
                            <div className="text-[10px] font-mono text-black">{it.sku_prefix || 'N/A'}</div>
                          </div>
                          <div className="text-[10px] text-black whitespace-nowrap">
                            {locations.find(l => l.id === it.location_id)?.name || '-'}
                          </div>
                        </div>
                      </div>
                    ))}
                    {traceItems.length === 0 && (
                      <div className="p-6 text-center text-black bg-white/40 rounded-3xl border-2 border-dashed border-orange-50 ">{t.noItemsFound}</div>
                    )}
                  </div>
                </div>

                <div className="bg-white  border border-orange-100  rounded-3xl p-6">
                  <div className="text-xs font-black uppercase tracking-widest text-black mb-4">{t.history}</div>

                  <div className="space-y-3 md:hidden">
                    {traceMovements.map((m, idx) => {
                      const typeClass = m.movement_type === 'SALE'
                        ? 'bg-green-600 text-white'
                        : (m.movement_type?.includes('TRANSFER') ? 'bg-orange-600 text-white' : 'bg-white border border-orange-100 text-black');
                      return (
                        <div key={`${m.created_at}-${idx}`} className="p-4 rounded-2xl border border-orange-50 bg-white/50">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-xs font-mono font-black text-black">{new Date(m.created_at).toLocaleString()}</div>
                              <div className="text-xs text-black">{locations.find(l => l.id === m.location_id)?.name || '-'}</div>
                              <div className="text-[10px] text-black mt-1">{m.reference_id || '-'}</div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <div className={`px-3 py-1 rounded-full text-[10px] font-black ${typeClass}`}>{m.movement_type}</div>
                              <div className="font-mono font-black text-black">{Math.abs(Number(m.quantity || 0))}</div>
                            </div>
                          </div>
                          <div className="text-[10px] text-black mt-2">{m.actor_name || '-'}</div>
                        </div>
                      );
                    })}
                    {traceMovements.length === 0 && (
                      <div className="p-6 text-center text-black bg-white/40 rounded-3xl border-2 border-dashed border-orange-50 ">{t.noItemsFound}</div>
                    )}
                  </div>

                  <div className="hidden md:block overflow-x-auto">
                    <table className={`w-full ${lang === 'ar' ? 'text-right' : 'text-left'} text-sm min-w-[900px]`}>
                      <thead className="bg-white text-black uppercase text-[10px] font-black tracking-widest border-b border-orange-50">
                        <tr>
                          <th className="px-4 py-3">{t.date}</th>
                          <th className="px-4 py-3">{t.locationName}</th>
                          <th className="px-4 py-3">{t.type}</th>
                          <th className="px-4 py-3">{t.quantity}</th>
                          <th className="px-4 py-3">{t.invoiceNo}</th>
                          <th className="px-4 py-3">{t.user}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-orange-50">
                        {traceMovements.map((m, idx) => (
                          <tr key={`${m.created_at}-${idx}`} className="hover:bg-orange-50">
                            <td className="px-4 py-3 font-mono text-xs">{new Date(m.created_at).toLocaleString()}</td>
                            <td className="px-4 py-3">{locations.find(l => l.id === m.location_id)?.name || '-'}</td>
                            <td className="px-4 py-3">
                              <span className={`px-3 py-1 rounded-full text-[10px] font-black ${
                                m.movement_type === 'SALE'
                                  ? 'bg-green-600 text-white'
                                  : (m.movement_type?.includes('TRANSFER') ? 'bg-orange-600 text-white' : 'bg-white border border-orange-100 text-black')
                              }`}>{m.movement_type}</span>
                            </td>
                            <td className="px-4 py-3 font-mono font-black">{Math.abs(Number(m.quantity || 0))}</td>
                            <td className="px-4 py-3 font-mono text-xs">{m.reference_id || '-'}</td>
                            <td className="px-4 py-3 text-xs">{m.actor_name || '-'}</td>
                          </tr>
                        ))}
                        {traceMovements.length === 0 && (
                          <tr>
                            <td className="px-4 py-6 text-center text-sm text-black" colSpan={6}>{t.noItemsFound}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
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
