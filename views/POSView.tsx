
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search, Plus, Minus, CreditCard, Banknote,
  Coffee, X, Box, Loader2, CheckCircle2, AlertTriangle,
  LayoutGrid, ShoppingCart, Check, Smartphone,
  Receipt, Printer, Scissors, PlusCircle,
  Clock, User as UserIcon, History, ChevronDown,
  SearchX, RefreshCw
} from 'lucide-react';
import { InventoryItem, CartItem, AddOn, PaymentMethod, PaymentBreakdown, SystemSettings, Shift, Location, ReturnRequest, BeverageCustomization } from '../types';
import { useLanguage } from '../App';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { shiftService } from '../services/shiftService';
import { crmService } from '../services/crmService';
import { Customer } from '../types';

interface TransactionData {
  id: string;
  created_at: string;
  total: number;
  payment_method: string;
  cashier_name?: string;
  items: CartItem[];
}

interface ReturnItemData {
  id: string;
  cartId: string;
  productId?: string;
  name: string;
  quantity: number;
  price: number;
  return_reason: string;
}

const SIZE_MULTIPLIERS = { S: 0.75, M: 1.0, L: 1.5 };
const MILK_PRICES = { 'Full Fat': 0, 'Low Fat': 0, 'Oat': 5, 'Almond': 5 };
const toNumber = (value: unknown, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const POSView: React.FC = () => {
  const { lang, t } = useLanguage();
  const { user } = useAuth();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeTab, setActiveTab] = useState<'ALL' | 'PACKAGED' | 'DRINKS' | 'HISTORY' | 'RETURNS'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [returnInvoiceSearch, setReturnInvoiceSearch] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [pastTransactions, setPastTransactions] = useState<TransactionData[]>([]);
  const [returnRequests, setReturnRequests] = useState<ReturnRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [customerSearchResults, setCustomerSearchResults] = useState<Customer[]>([]);

  // Return Processing State
  const [searchingInvoice, setSearchingInvoice] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<TransactionData | null>(null);
  const [itemsToReturn, setItemsToReturn] = useState<ReturnItemData[]>([]);
  const [showReturnSuccess, setShowReturnSuccess] = useState(false);
  const [showManagerApprovalModal, setShowManagerApprovalModal] = useState(false);
  const [pendingReturnRequest, setPendingReturnRequest] = useState<ReturnRequest | null>(null);
  const [settings, setSettings] = useState<SystemSettings>({
    id: '',
    printer_width: '80mm',
    store_name: 'Doha Roastery',
    store_address: '',
    store_phone: '',
    vat_rate: 0,
    currency: 'QAR',
    late_penalty_type: 'per_minute',
    late_penalty_amount: 0,
    inventory_valuation_method: 'WEIGHTED_AVG'
  });

  // Location Management State
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');

  // Checkout & Results State
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<any>(null);
  const [lastReturnRequest, setLastReturnRequest] = useState<any>(null);
  const [isReprint, setIsReprint] = useState(false);
  const [reprintTime, setReprintTime] = useState<string | null>(null);

  // Customization State
  const [customizingItem, setCustomizingItem] = useState<InventoryItem | null>(null);
  const [tempCustoms, setTempCustoms] = useState({
    size: 'M' as 'S' | 'M' | 'L',
    milkType: 'Full Fat' as 'Full Fat' | 'Low Fat' | 'Oat' | 'Almond',
    sugarLevel: 'Normal' as 'None' | 'Half' | 'Normal' | 'Extra',
    selectedAddOns: [] as AddOn[]
  });

  // Payment Modals State
  const [showCashModal, setShowCashModal] = useState(false);
  const [cashReceived, setCashReceived] = useState<string>('');
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [splitBreakdown, setSplitBreakdown] = useState<PaymentBreakdown>({ cash: 0, card: 0, mobile: 0, card_reference: '' });
  const [cardReference, setCardReference] = useState(''); // REQ-003: State for card reference
  const [showCardInput, setShowCardInput] = useState(false); // UI state for single card payment reference input

  // Shift Management State
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [showStartShiftModal, setShowStartShiftModal] = useState(false);
  const [startCash, setStartCash] = useState('');
  const [showShiftDetails, setShowShiftDetails] = useState(false);
  const [shiftTotals, setShiftTotals] = useState({ sales: 0, returns: 0, cashIn: 0, cashOut: 0, expected: 0 });

  // Cash In/Out State
  const [showCashMovementModal, setShowCashMovementModal] = useState(false);
  const [cashMovementType, setCashMovementType] = useState<'IN' | 'OUT'>('IN');
  const [cashMovementAmount, setCashMovementAmount] = useState('');
  const [cashMovementReason, setCashMovementReason] = useState('');

  // Close Shift State
  const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
  const [actualCash, setActualCash] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [shiftReport, setShiftReport] = useState<any>(null);

  const checkShift = useCallback(async () => {
    // Allow demo-user to use shift features for testing
    if (!user) return;
    try {
      const shift = await shiftService.getOpenShift(user.id);
      if (shift) {
        setCurrentShift(shift);
        const totals = await shiftService.getShiftTotals(shift);
        setShiftTotals(totals);
      } else {
        // Only prompt to start shift if not demo-user to avoid annoyance, 
        // or just let them click the button.
        // setShowStartShiftModal(true); 
      }
    } catch (e) {
      console.error("Shift check failed", e);
    }
  }, [user]);

  useEffect(() => {
    checkShift();
  }, [checkShift]);

  useEffect(() => {
    if (!showCustomerSearch) return;
    const query = customerSearchQuery.trim();
    if (query.length < 2) {
      setCustomerSearchResults([]);
      return;
    }
    const timeoutId = setTimeout(async () => {
      setIsSearchingCustomer(true);
      try {
        const { data } = await crmService.getCustomers(1, 20, query);
        setCustomerSearchResults(data);
      } catch (err) {
        console.error('Customer search failed', err);
      } finally {
        setIsSearchingCustomer(false);
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [customerSearchQuery, showCustomerSearch]);

  const handleStartShift = async () => {
    if (!startCash || isNaN(parseFloat(startCash))) return;
    setIsProcessing(true);
    try {
      const shift = await shiftService.startShift(user?.id || '', user?.name || 'Cashier', parseFloat(startCash));
      setCurrentShift(shift);
      setShiftTotals({ sales: 0, returns: 0, cashIn: 0, cashOut: 0, expected: parseFloat(startCash) });
      setShowStartShiftModal(false);
    } catch (error: any) {
      console.error(error);
      if (error?.message?.includes('violates row-level security')) {
        alert("Permission Denied: Please sign in with an authorized account.");
      } else {
        alert("Failed to start shift: " + (error?.message || "Unknown error"));
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCashMovement = async () => {
    if (!currentShift || !cashMovementAmount || !cashMovementReason) return;
    setIsProcessing(true);
    try {
      await shiftService.addCashMovement(
        currentShift.id,
        cashMovementType,
        parseFloat(cashMovementAmount),
        cashMovementReason,
        user?.id || '',
        user?.name || 'Cashier'
      );

      const totals = await shiftService.getShiftTotals(currentShift);
      setShiftTotals(totals);
      setShowCashMovementModal(false);
      setCashMovementAmount('');
      setCashMovementReason('');
    } catch (error: any) {
      console.error(error);
      if (error?.message?.includes('relation "cash_movements" does not exist') || error?.code === '42P01') {
        alert("System Update Required: Please ask administrator to run the database setup script (enable_cash_features.sql).");
      } else {
        alert("Failed to record cash movement");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCloseShiftCheck = async () => {
    if (!actualCash) return;
    const actual = parseFloat(actualCash);
    const discrepancy = actual - shiftTotals.expected;

    setShiftReport({
      expected: shiftTotals.expected,
      actual: actual,
      discrepancy: discrepancy,
      sales: shiftTotals.sales,
      cashIn: shiftTotals.cashIn,
      cashOut: shiftTotals.cashOut,
      initial: currentShift?.initial_cash
    });
  };

  const confirmCloseShift = async () => {
    if (!currentShift || !shiftReport) return;
    setIsProcessing(true);
    try {
      await shiftService.closeShift(
        currentShift.id,
        shiftReport.actual,
        shiftReport.sales,
        0, // returns
        closingNotes
      );
      setCurrentShift(null);
      setShiftReport(null);
      setShowCloseShiftModal(false);
      setShowShiftDetails(false);
      setActualCash('');
      setClosingNotes('');
      // Optionally redirect or show start shift again
      setShowStartShiftModal(true);
    } catch (error: any) {
      console.error(error);
      if (error?.message?.includes('column') || error?.code === '42703') {
        alert("System Update Required: Database schema out of date. Run 'enable_cash_features.sql'.");
      } else {
        alert("Failed to close shift");
      }
    } finally {
      setIsProcessing(false);
    }
  };


  const fetchLocations = useCallback(async () => {
    try {
      const { data } = await supabase.from('locations').select('*').eq('is_active', true);
      if (data) {
        setLocations(data);
        // Default to first branch if not set
        if (!selectedLocationId && data.length > 0) {
          const branch = data.find(l => l.type === 'BRANCH') || data[0];
          setSelectedLocationId(branch.id);
        }
      }
    } catch (err) { console.error(err); }
  }, [selectedLocationId]);

  useEffect(() => { fetchLocations(); }, [fetchLocations]);

  const fetchInventory = useCallback(async () => {
    setIsLoading(true);
    try {
      const inventoryQuery = selectedLocationId
        ? supabase.from('inventory_items').select('*').eq('location_id', selectedLocationId)
        : supabase.from('inventory_items').select('*');

      const [prodRes, invRes, settingsRes] = await Promise.all([
        supabase.from('product_definitions').select('*'),
        inventoryQuery,
        supabase.from('system_settings').select('*').single()
      ]);

      if (settingsRes.data) setSettings(settingsRes.data);

      const productMap = new Map<string, any>();
      if (prodRes.data) {
        prodRes.data.forEach(p => productMap.set(p.id, p));
      }
      const getProductStatus = (product: any) => product?.product_status || (product?.is_active === false ? 'DISABLED' : 'ACTIVE');

      const allItems: InventoryItem[] = [];
      const invItems = invRes.data || [];
      const getAvailableStock = (item: any) => {
        const reserved = item.reserved_stock || 0;
        const damaged = item.damaged_stock || 0;
        return Math.max(0, (item.stock || 0) - reserved - damaged);
      };
      const invByProductId = new Map<string, any[]>();
      invItems.forEach((item: any) => {
        const pid = item.product_id || item.productId;
        if (!pid) return;
        if (!invByProductId.has(pid)) invByProductId.set(pid, []);
        invByProductId.get(pid)!.push(item);
      });

      if (prodRes.data) {
        prodRes.data
          .filter(p => getProductStatus(p) === 'ACTIVE')
          .forEach(p => {
            const linkedInv = invByProductId.get(p.id) || [];
            const stock = linkedInv.length > 0
              ? linkedInv.reduce((sum: number, row: any) => sum + toNumber(row.stock), 0)
              : (p.type === 'BEVERAGE' ? 999 : 0);
            const reserved = linkedInv.reduce((sum: number, row: any) => sum + toNumber(row.reserved_stock), 0);
            const damaged = linkedInv.reduce((sum: number, row: any) => sum + toNumber(row.damaged_stock), 0);
            const firstInv = linkedInv[0];
            const variantText = [p.variant_label, p.variant_size, p.variant_flavor].filter(Boolean).join(' • ');

            allItems.push({
              id: p.id,
              productId: p.id,
              name: variantText ? `${p.name} (${variantText})` : p.name,
              description: p.description,
              category: p.type === 'PACKAGED_COFFEE' ? 'PACKAGED' : (p.type === 'BEVERAGE' ? 'DRINKS' : 'OTHER'),
              type: p.type,
              price: toNumber(p.selling_price ?? p.base_price),
              stock: toNumber(stock),
              reserved_stock: toNumber(reserved),
              damaged_stock: toNumber(damaged),
              image: p.image || firstInv?.image || 'https://images.unsplash.com/photo-1541167760496-162955ed8a9f?q=80&w=300&h=300&auto=format&fit=crop',
              recipe: p.recipe,
              bom: p.bom || [],
              add_ons: p.add_ons || [],
              roast_date: firstInv?.roast_date || null,
              bean_origin: firstInv?.bean_origin || null,
              bean_variety: firstInv?.bean_variety || null,
              roast_level: firstInv?.roast_level || p.roast_level || null
            } as any);
          });
      }
      setInventoryItems(allItems);
    } catch (error) { console.error(error); } finally { setIsLoading(false); }
  }, [selectedLocationId]);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      const normalized = (data || []).map((tx: any) => ({
        ...tx,
        total: toNumber(tx.total),
        items: (tx.items || []).map((item: any) => ({
          ...item,
          price: toNumber(item.price),
          quantity: toNumber(item.quantity, 1)
        }))
      }));
      setPastTransactions(normalized);
    } catch (error) { console.error(error); } finally { setIsLoading(false); }
  }, []);

  const fetchReturnRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('return_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;

      // Filter by selected location if set
      const normalized = (data || []).map((req: any) => ({
        ...req,
        total_refund_amount: toNumber(req.total_refund_amount),
        items: (req.items || []).map((item: any) => ({
          ...item,
          price: toNumber(item.price),
          quantity: toNumber(item.quantity, 1)
        }))
      }));

      const filtered = selectedLocationId
        ? normalized.filter((req: any) =>
          // Check if any item belongs to the selected location
          req.items?.some((item: any) => item.locationId === selectedLocationId)
        )
        : normalized;

      setReturnRequests(filtered);
    } catch (error) { console.error(error); } finally { setIsLoading(false); }
  }, [selectedLocationId]);

  useEffect(() => {
    if (activeTab === 'HISTORY') {
      fetchHistory();
    } else if (activeTab === 'RETURNS') {
      fetchReturnRequests();
    } else {
      fetchInventory();
    }
  }, [lang, activeTab, fetchInventory, fetchHistory, fetchReturnRequests]);

  const generateInvoiceNumber = (sequence: number = 1) => {
    // REQ-005: Generate sequential invoice numbers
    const date = new Date();
    const prefix = "INV";
    const dateStr = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
    return `${prefix}-${dateStr}-${sequence.toString().padStart(4, '0')}`;
  };

  const openCustomization = (item: InventoryItem) => {
    if (item.type === 'BEVERAGE') {
      setCustomizingItem(item);
      setTempCustoms({ size: 'M', milkType: 'Full Fat', sugarLevel: 'Normal', selectedAddOns: [] });
    } else { addToCart(item); }
  };

  const toggleAddOn = (addOn: AddOn) => {
    const isSelected = tempCustoms.selectedAddOns?.some(ao => ao.id === addOn.id);
    if (isSelected) {
      setTempCustoms({ ...tempCustoms, selectedAddOns: tempCustoms.selectedAddOns?.filter(ao => ao.id !== addOn.id) });
    } else {
      setTempCustoms({ ...tempCustoms, selectedAddOns: [...(tempCustoms.selectedAddOns || []), addOn] });
    }
  };

  const getAvailableStock = (item: InventoryItem) => {
    const reserved = item.reserved_stock || 0;
    const damaged = item.damaged_stock || 0;
    return Math.max(0, item.stock - reserved - damaged);
  };

  const warnIfLowStock = (item: InventoryItem, nextQty: number) => {
    if (item.type === 'BEVERAGE') return;
    const available = getAvailableStock(item);
    const remaining = available - nextQty;
    if (remaining >= 0 && remaining <= 5) {
      alert(t.lastPiecesWarning.replace('{count}', remaining.toString()).replace('{item}', item.name));
    }
  };

  const addToCart = (item: InventoryItem, customs?: BeverageCustomization) => {
    const milkExtra = MILK_PRICES[customs?.milkType as keyof typeof MILK_PRICES] || 0;

    // REQ-001: The system shall support beverage add-ons with additional pricing
    const addOnsExtra = customs?.selectedAddOns?.reduce((sum: number, ao: AddOn) => sum + ao.price, 0) || 0;

    const sizeMultiplier = customs ? SIZE_MULTIPLIERS[customs.size as keyof typeof SIZE_MULTIPLIERS] : 1.0;

    const finalPrice = (item.price * sizeMultiplier) + milkExtra + addOnsExtra;

    setCart(prev => {
      const addOnsIds = customs?.selectedAddOns?.map((ao: AddOn) => ao.id).sort().join(',') || '';
      const cartItemId = customs ? `${item.id}-${customs.size}-${customs.milkType}-${customs.sugarLevel}-${addOnsIds}` : item.id;
      const existing = prev.find(i => i.cartId === cartItemId);
      const existingTotal = prev.filter(i => i.id === item.id).reduce((sum, i) => sum + i.quantity, 0);

      if (existing) {
        const nextQty = existingTotal + 1;
        warnIfLowStock(item, nextQty);
        return prev.map(i => i.cartId === cartItemId ? { ...i, quantity: i.quantity + 1 } : i);
      }
      warnIfLowStock(item, existingTotal + 1);
      return [...prev, {
        ...item, price: finalPrice, quantity: 1, cartId: cartItemId, selectedCustomizations: customs, recipe: item.recipe
      } as CartItem];
    });
    setCustomizingItem(null);
  };

  const updateQuantity = (cartId: string, delta: number) => {
    setCart(prev => {
      const target = prev.find(item => item.cartId === cartId);
      if (!target) return prev;
      if (delta > 0) {
        const baseItem = inventoryItems.find(inv => inv.id === target.id);
        const existingTotal = prev.filter(i => i.id === target.id).reduce((sum, i) => sum + i.quantity, 0);
        if (baseItem) {
          warnIfLowStock(baseItem, existingTotal + 1);
        }
      }
      return prev.map(item =>
        item.cartId === cartId ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item
      );
    });
  };

  const applyInventoryDeductions = async (
    locationId: string,
    deductions: Map<string, number>,
    valuationMethod: string,
    transactionId: string,
    userId: string | null | undefined,
    userName: string
  ) => {
    if (!locationId || deductions.size === 0) return;

    const payload = Array.from(deductions.entries()).map(([item_id, quantity]) => ({ item_id, quantity }));
    const { error: deductError } = await supabase.rpc('deduct_inventory_with_cost', {
      p_location_id: locationId,
      p_items: payload,
      p_method: valuationMethod || 'WEIGHTED_AVG',
      p_transaction_id: transactionId,
      p_user_id: userId || null,
      p_user_name: userName
    });

    if (!deductError) return;

    const msg = `${deductError.message || ''} ${deductError.details || ''}`;
    const missingFunction = deductError.code === '42883' || /does not exist|function/i.test(msg);
    if (!missingFunction) throw deductError;

    console.warn('deduct_inventory_with_cost not available; using direct stock updates fallback');
    const itemIds = Array.from(deductions.keys());
    const { data: currentRows, error: fetchErr } = await supabase
      .from('inventory_items')
      .select('id, stock')
      .eq('location_id', locationId)
      .in('id', itemIds);
    if (fetchErr) throw fetchErr;

    const currentMap = new Map((currentRows || []).map((row: any) => [row.id, Number(row.stock) || 0]));
    const now = new Date().toISOString();
    const updates = payload.map(({ item_id, quantity }) => {
      const currentStock = currentMap.get(item_id) ?? 0;
      const nextStock = Math.max(0, currentStock - quantity);
      return supabase
        .from('inventory_items')
        .update({ stock: nextStock, last_movement_at: now })
        .eq('location_id', locationId)
        .eq('id', item_id);
    });

    const results = await Promise.all(updates);
    const failed = results.find(r => r.error);
    if (failed?.error) throw failed.error;
  };

  const applyInventoryAdditions = async (
    locationId: string,
    additions: Map<string, number>,
    referenceId: string
  ) => {
    if (!locationId || additions.size === 0) return;

    const payload = Array.from(additions.entries()).map(([item_id, quantity]) => ({ item_id, quantity }));
    const { error: addError } = await supabase.rpc('add_inventory_atomic', {
      p_location_id: locationId,
      p_items: payload,
      p_reference_id: referenceId,
      p_user_id: user?.id || null,
      p_user_name: user?.name || null,
      p_movement_type: 'RETURN'
    });

    if (!addError) return;

    const msg = `${addError.message || ''} ${addError.details || ''}`;
    const missingFunction = addError.code === '42883' || /does not exist|function/i.test(msg);
    if (!missingFunction) throw addError;

    console.warn('add_inventory_atomic not available; using direct stock updates fallback');
    const itemIds = Array.from(additions.keys());
    const { data: currentRows, error: fetchErr } = await supabase
      .from('inventory_items')
      .select('id, stock')
      .eq('location_id', locationId)
      .in('id', itemIds);
    if (fetchErr) throw fetchErr;

    const currentMap = new Map((currentRows || []).map((row: any) => [row.id, Number(row.stock) || 0]));
    const now = new Date().toISOString();
    const updates = payload.map(({ item_id, quantity }) => {
      const currentStock = currentMap.get(item_id) ?? 0;
      const nextStock = currentStock + quantity;
      return supabase
        .from('inventory_items')
        .update({ stock: nextStock, last_movement_at: now })
        .eq('location_id', locationId)
        .eq('id', item_id);
    });

    const results = await Promise.all(updates);
    const failed = results.find(r => r.error);
    if (failed?.error) throw failed.error;
  };

  // Removed unused removeFromCart function

  const totals = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const vat = subtotal * settings.vat_rate;
    const total = subtotal + vat;
    return { subtotal, vat, total };
  }, [cart, settings.vat_rate]);

  const handleCheckout = async (paymentMethod: PaymentMethod, breakdown?: PaymentBreakdown, receivedAmount?: number) => {
    if (cart.length === 0 || isProcessing) return;
    setIsProcessing(true);

    try {
      // REQ-005: Generate sequential invoice numbers by counting today's transactions
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString());

      const sequence = (count || 0) + 1;
      const invoiceNo = generateInvoiceNumber(sequence);

      // REQ-001: Calculate and display change for cash payments
      const change = receivedAmount ? Math.max(0, receivedAmount - totals.total) : 0;
      const validUserId = user?.id === 'demo-user' ? null : user?.id;
      const now = new Date();

      const enrichedItems = cart.map(item => {
        const baseItem = inventoryItems.find(inv => inv.id === item.id);
        return {
          ...item,
          batch_id: (item as any).batch_id || (item as any).batchId || (baseItem as any)?.batch_id || (baseItem as any)?.batchId || null,
          roast_date: (item as any).roast_date || (baseItem as any)?.roast_date || null,
          bean_origin: (item as any).bean_origin || (baseItem as any)?.bean_origin || null,
          bean_variety: (item as any).bean_variety || (baseItem as any)?.bean_variety || null,
          roast_level: (item as any).roast_level || (baseItem as any)?.roast_level || null
        };
      });

      const transactionData = {
        id: invoiceNo,
        items: enrichedItems,
        subtotal: totals.subtotal,
        vat_amount: totals.vat,
        total: totals.total,
        location_id: selectedLocationId || null,
        payment_method: paymentMethod,
        payment_breakdown: breakdown || null,
        // REQ-003: Record payment reference for card transactions
        card_reference: paymentMethod === 'CARD' ? cardReference : (breakdown?.card_reference || null),
        user_id: validUserId,
        cashier_name: user?.name || 'Cashier',
        received_amount: receivedAmount || totals.total,
        change_amount: change,
        created_at: now.toISOString(),
        timestamp: now.toISOString()
      };

      const { error: txInsertError } = await supabase.from('transactions').insert([transactionData]);
      if (txInsertError) throw txInsertError;

      const { data: allInv } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('location_id', selectedLocationId);
      const invById = new Map((allInv || []).map(inv => [inv.id, inv]));
      const invByProductId = new Map((allInv || []).map((inv: any) => [inv.product_id || inv.productId, inv]));
      const invByName = new Map((allInv || []).map(inv => [inv.name, inv]));
      const deductions = new Map<string, number>();
      const addDeduction = (itemId: string | undefined, qty: number) => {
        if (!itemId || qty <= 0) return;
        deductions.set(itemId, (deductions.get(itemId) || 0) + qty);
      };
      const findInventoryItem = (id?: string, name?: string) => {
        if (id && invById.has(id)) return invById.get(id);
        if (id && invByProductId.has(id)) return invByProductId.get(id);
        if (name && invByName.has(name)) return invByName.get(name);
        return undefined;
      };
      for (const item of cart) {
        if (item.type === 'BEVERAGE') {
          if (item.recipe) {
            const multiplier = SIZE_MULTIPLIERS[item.selectedCustomizations?.size || 'M'];
            for (const ing of item.recipe.ingredients) {
              const dbIng = findInventoryItem(ing.ingredient_id, ing.name);
              if (dbIng) {
                addDeduction(dbIng.id, ing.amount * multiplier * item.quantity);
              }
            }
          }
          if (item.selectedCustomizations?.selectedAddOns) {
            for (const addOn of item.selectedCustomizations.selectedAddOns) {
              if (addOn.ingredient_id) {
                const dbIng = findInventoryItem(addOn.ingredient_id);
                if (dbIng) addDeduction(dbIng.id, item.quantity);
              }
            }
          }
        } else {
          if (item.bom && item.bom.length > 0) {
            for (const component of item.bom) {
              const dbIng = findInventoryItem(component.ingredient_id, component.name);
              if (dbIng) {
                addDeduction(dbIng.id, component.amount * item.quantity);
              }
            }
          } else {
            const dbItem = findInventoryItem(item.id, item.name);
            if (dbItem) {
              addDeduction(dbItem.id, item.quantity);
            }
          }
        }
      }
      if (deductions.size > 0) {
        await applyInventoryDeductions(
          selectedLocationId,
          deductions,
          settings.inventory_valuation_method || 'WEIGHTED_AVG',
          invoiceNo,
          validUserId,
          user?.name || 'Cashier'
        );
      }

      if (selectedCustomer) {
        try {
          await supabase.rpc('record_customer_transaction', {
            p_customer_id: selectedCustomer.id,
            p_spent_amount: totals.total
          });
        } catch (err) {
          console.error("Failed to update loyalty:", err);
        }
      }

      setLastTransaction(transactionData);
      setIsReprint(false);
      setShowSuccess(true);

      // Automatically trigger print
      setTimeout(() => {
        window.print();
      }, 300);

      setCart([]);
      setSelectedCustomer(null);
      setShowSplitModal(false);
      setShowCashModal(false);
      setShowCardInput(false);
      setCashReceived('');
      setCardReference('');
      fetchInventory();
      checkShift(); // Update shift totals
    } catch (error) {
      console.error(error);
      alert("Checkout failed");
    } finally { setIsProcessing(false); }
  };

  const handlePrint = async (transaction?: TransactionData) => {
    if (transaction) {
      // Authorization Check: Only ADMIN or MANAGER can reprint
      if (user?.role !== 'ADMIN' && user?.role !== 'MANAGER') {
        alert(t.reprintAuthRequired);
        return;
      }

      setLastReturnRequest(null);
      setLastTransaction(transaction);
      setIsReprint(true);
      const now = new Date().toISOString();
      setReprintTime(now);

      // Log the reprint action
      try {
        await supabase.from('reprint_logs').insert([{
          transaction_id: transaction.id,
          user_id: user?.id === 'demo-user' ? null : user?.id,
          cashier_name: user?.name || 'Unknown',
          reprinted_at: now,
          reason: t.customerRequest
        }]);
      } catch (err) {
        console.error("Failed to log reprint:", err);
      }

      setTimeout(() => window.print(), 200);
    } else if (lastTransaction) {
      setLastReturnRequest(null);
      setIsReprint(false);
      setReprintTime(null);
      window.print();
    }
  };

  const handlePrintReturn = (request: ReturnRequest) => {
    setLastTransaction(null);
    setLastReturnRequest(request);
    setTimeout(() => window.print(), 200);
  };

  const searchInvoice = async () => {
    if (!returnInvoiceSearch.trim()) return;
    setSearchingInvoice(true);
    setSelectedInvoice(null);
    setItemsToReturn([]);

    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', returnInvoiceSearch.trim())
        .single();

      if (error || !data) {
        alert(t.invoiceNotFound);
        return;
      }

      if (data.is_returned) {
        alert(t.invoiceAlreadyReturned);
        return;
      }

      setSelectedInvoice({
        ...data,
        total: toNumber(data.total),
        items: (data.items || []).map((item: any) => ({
          ...item,
          price: toNumber(item.price),
          quantity: toNumber(item.quantity, 1)
        }))
      });
    } catch (error) {
      console.error(error);
    } finally {
      setSearchingInvoice(false);
    }
  };

  const toggleReturnItem = (item: CartItem) => {
    setItemsToReturn(prev => {
      const cartId = item.cartId ?? item.id;
      const exists = prev.find(i => i.cartId === cartId);
      if (exists) return prev.filter(i => i.cartId !== cartId);
      return [...prev, { ...item, cartId, return_reason: '', is_inventory_updated: false }];
    });
  };

  const updateReturnReason = (cartId: string, reason: string) => {
    setItemsToReturn(prev => prev.map(i => i.cartId === cartId ? { ...i, return_reason: reason } : i));
  };

  const updateReturnQuantity = (cartId: string, delta: number, max: number) => {
    setItemsToReturn(prev => prev.map(i => {
      if (i.cartId === cartId) {
        const newQty = Math.min(Math.max(1, i.quantity + delta), max);
        return { ...i, quantity: newQty };
      }
      return i;
    }));
  };

  const submitReturnRequest = async () => {
    if (itemsToReturn.length === 0 || !selectedInvoice) return;
    if (itemsToReturn.some(i => !i.return_reason)) {
      alert(t.returnReasonRequired);
      return;
    }

    setIsProcessing(true);
    try {
      const refundAmount = itemsToReturn.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const isFullRefund = itemsToReturn.length === selectedInvoice.items.length;

      const returnData = {
        invoice_number: selectedInvoice.id,
        items: itemsToReturn.map(item => ({ ...item, locationId: selectedLocationId })),
        total_refund_amount: refundAmount,
        refund_type: isFullRefund ? 'FULL' : 'PARTIAL',
        status: 'PENDING_APPROVAL',
        requested_by_id: user?.id === 'demo-user' ? null : user?.id,
        requested_by_name: user?.name || 'Cashier',
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('return_requests')
        .insert([returnData])
        .select()
        .single();

      if (error) throw error;

      setReturnInvoiceSearch('');
      setPendingReturnRequest({
        ...data,
        total_refund_amount: toNumber(data.total_refund_amount),
        items: (data.items || []).map((item: any) => ({
          ...item,
          price: toNumber(item.price),
          quantity: toNumber(item.quantity, 1)
        }))
      });
      setShowManagerApprovalModal(true);

      // REQ-007: Log initial request status
      console.log(`[LOG] Return request submitted: ${data.id} for invoice ${selectedInvoice.id}`);
    } catch (error) {
      console.error(error);
      alert(t.actionFailed);
    } finally {
      setIsProcessing(false);
    }
  };

  const approveRefund = async (requestId: string, approved: boolean) => {
    if (user?.role !== 'ADMIN' && user?.role !== 'MANAGER') {
      alert(t.notAuthorizedApproveReturns);
      return;
    }

    setIsProcessing(true);
    try {
      const status = approved ? 'APPROVED' : 'REJECTED';

      const { data: request, error: reqError } = await supabase
        .from('return_requests')
        .update({
          status,
          manager_id: user?.id === 'demo-user' ? null : user?.id,
          manager_name: user?.name,
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId)
        .select()
        .single();

      if (reqError) throw reqError;

      // REQ-007: Log approval/rejection action
      console.log(`[LOG] Return ${status}: ${requestId} by ${user?.name || 'Manager'}`);

      if (approved) {
        const returnLocationId = request.items[0]?.locationId || selectedLocationId;
        const { data: locInv } = await supabase
          .from('inventory_items')
          .select('*')
          .eq('location_id', returnLocationId);
        const invById = new Map((locInv || []).map(inv => [inv.id, inv]));
        const invByProductId = new Map((locInv || []).map(inv => [inv.productId, inv]));
        const invByName = new Map((locInv || []).map(inv => [inv.name, inv]));
        const additions = new Map<string, number>();
        const addRestock = (itemId: string | undefined, qty: number) => {
          if (!itemId || qty <= 0) return;
          additions.set(itemId, (additions.get(itemId) || 0) + qty);
        };

        for (const item of request.items) {
          if (item.type !== 'BEVERAGE') {
            const qty = Math.max(0, Number(item.quantity) || 0);
            let dbItem = item.productId ? invByProductId.get(item.productId) : undefined;

            if (!dbItem) {
              dbItem = invById.get(item.id);
              if (!dbItem) dbItem = invByName.get(item.name);
            }

            if (dbItem) {
              addRestock(dbItem.id, qty);
            } else {
              const { data: sourceItem } = await supabase
                .from('inventory_items')
                .select('*')
                .eq('id', item.id)
                .single();

              if (sourceItem) {
                const newItem = {
                  ...sourceItem,
                  id: undefined,
                  location_id: returnLocationId,
                  stock: qty,
                  created_at: new Date().toISOString(),
                  last_movement_at: new Date().toISOString()
                };
                delete newItem.id;

                const { error: createError } = await supabase
                  .from('inventory_items')
                  .insert([newItem]);

                if (createError) console.error(`Failed to create item in location ${returnLocationId}: ${item.name}`, createError);
              } else {
                console.warn(`[WARN] Original item not found, cannot create in new location: ${item.name}`);
              }
            }
          }
        }
        if (additions.size > 0) {
          await applyInventoryAdditions(returnLocationId, additions, requestId);
        }

        // Update original transaction status
        const { error: txError } = await supabase
          .from('transactions')
          .update({ is_returned: true, return_id: requestId })
          .eq('id', request.invoice_number);

        if (txError) console.error(`Failed to update original transaction ${request.invoice_number}`, txError);
      }

      setShowManagerApprovalModal(false);
      setPendingReturnRequest(null);
      setSelectedInvoice(null);
      setItemsToReturn([]);
      setShowReturnSuccess(approved);
      fetchReturnRequests();
      fetchInventory();
    } catch (error) {
      console.error(error);
      alert(t.actionFailed);
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredItems = useMemo(() => {
    return inventoryItems.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTab = activeTab === 'ALL' || (activeTab === 'PACKAGED' && item.category === 'PACKAGED') || (activeTab === 'DRINKS' && item.type === 'BEVERAGE');
      return matchesSearch && matchesTab;
    });
  }, [inventoryItems, searchTerm, activeTab]);

  const filteredHistory = useMemo(() => {
    return pastTransactions.filter(tx => {
      const matchesSearch = tx.id.toLowerCase().includes(historySearch.toLowerCase()) ||
        tx.cashier_name?.toLowerCase().includes(historySearch.toLowerCase());

      const txDate = new Date(tx.created_at);
      const matchesStart = !dateRange.start || txDate >= new Date(dateRange.start);
      const matchesEnd = !dateRange.end || txDate <= new Date(dateRange.end + 'T23:59:59');

      return matchesSearch && matchesStart && matchesEnd;
    });
  }, [pastTransactions, historySearch, dateRange]);

  const splitRemaining = totals.total - (splitBreakdown.cash + splitBreakdown.card + splitBreakdown.mobile);

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-140px)] gap-6 animate-in fade-in duration-500 relative" dir={t.dir}>

      {/* Thermal Receipt Styling */}
      <style>
        {`
          @media print {
            @page {
              margin: 0;
              size: ${settings.printer_width} auto;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              height: auto !important;
              overflow: visible !important;
            }
            body * { visibility: hidden; }
            #thermal-receipt, #thermal-receipt * { 
              visibility: visible;
              font-family: 'Courier New', Courier, monospace !important;
            }
            #thermal-receipt {
              display: block !important;
              position: absolute;
              left: 0;
              top: 0;
              width: ${settings.printer_width};
              margin: 0;
              padding: ${settings.printer_width === '58mm' ? '8px' : '12px'};
              background: white;
              color: black;
            }
            /* Hide UI elements during print */
            .no-print { display: none !important; }
          }
        `}
      </style>

      {/* Hidden Thermal Receipt Div */}
      <div id="thermal-receipt" className="hidden bg-white text-black p-4 font-mono leading-normal" style={{ width: settings.printer_width, fontSize: settings.printer_width === '58mm' ? '11px' : '13px' }}>
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <div className={`${settings.printer_width === '58mm' ? 'w-12 h-12' : 'w-16 h-16'} bg-orange-600 rounded-full flex items-center justify-center text-white`}>
              <Coffee size={settings.printer_width === '58mm' ? 24 : 32} />
            </div>
          </div>
          <div className={`${settings.printer_width === '58mm' ? 'text-lg' : 'text-xl'} font-black uppercase mb-1`}>{settings.store_name || t.appName}</div>
          <div className="text-[10px] opacity-80">{settings.store_address || t.storeAddress}</div>
          <div className="text-[10px] opacity-80">{t.storeCity} | {settings.store_phone || t.storePhone}</div>

          {lastReturnRequest && (
            <div className="mt-2 py-1 bg-orange-600 text-white text-[10px] font-black uppercase tracking-widest">
              {t.returnReceipt}
            </div>
          )}

          {isReprint && (
            <div className="mt-2 py-1 bg-orange-600 text-white text-[10px] font-black uppercase tracking-widest">
              {t.reprintedReceipt}
              {reprintTime && (
                <div className="text-[7px] opacity-70 mt-0.5">
                  {new Date(reprintTime).toLocaleString(lang === 'ar' ? 'ar-QA' : 'en-US')}
                </div>
              )}
            </div>
          )}
          <div className="mt-2 border-b border-dashed border-orange-600"></div>
        </div>

        {lastReturnRequest ? (
          /* Return Receipt Layout */
          <>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between">
                <span className="opacity-70">{t.returnId}:</span>
                <span className="font-bold">{lastReturnRequest.id.slice(0, 8)}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-70">{t.invoiceNo}:</span>
                <span className="font-bold">{lastReturnRequest.invoice_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-70">{t.date}:</span>
                <span>{new Date(lastReturnRequest.created_at).toLocaleString(lang === 'ar' ? 'ar-QA' : 'en-US')}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-70">{t.requestedBy}:</span>
                <span>{lastReturnRequest.requested_by_name}</span>
              </div>
              {lastReturnRequest.manager_name && (
                <div className="flex justify-between">
                  <span className="opacity-70">{t.approvedBy}:</span>
                  <span>{lastReturnRequest.manager_name}</span>
                </div>
              )}
            </div>

            <div className="border-b-2 border-dashed border-orange-600 mb-3"></div>

            <table className="w-full mb-4 border-collapse">
              <thead>
                <tr className="border-b border-orange-600">
                  <th className="text-left py-2 font-black uppercase text-[10px]">{t.returnedItem}</th>
                  <th className="text-right py-2 font-black uppercase text-[10px]">{t.amount}</th>
                </tr>
              </thead>
              <tbody>
                {lastReturnRequest.items.map((item: any, i: number) => (
                  <tr key={i} className="align-top border-b border-dotted border-orange-100">
                    <td className="py-3 pr-2">
                      <div className="font-black text-[12px]">{item.name}</div>
                      <div className="text-[10px] opacity-80 mt-0.5">
                        {item.quantity} x {item.price.toFixed(2)}
                      </div>
                      <div className="text-[9px] italic opacity-70 mt-1 bg-white p-1 rounded">
                        {t.reason}: {item.return_reason}
                      </div>
                    </td>
                    <td className="text-right py-3 font-black text-[12px]">
                      {(item.price * item.quantity).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="border-t-2 border-orange-600 pt-4 mb-6">
              <div className="flex justify-between text-lg font-black">
                <span>{t.totalRefund}</span>
                <span>{lastReturnRequest.total_refund_amount.toFixed(2)} {t.currency}</span>
              </div>
              <div className="text-[10px] font-bold text-center mt-2 opacity-60">
                {t.refundIssued}
              </div>
            </div>
          </>
        ) : (
          /* Normal Transaction Layout */
          <>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between">
                <span className="opacity-70">{t.invoiceNo}:</span>
                <span className="font-bold">{lastTransaction?.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-70">{t.date}:</span>
                <span>{lastTransaction ? new Date(lastTransaction.created_at).toLocaleString(lang === 'ar' ? 'ar-QA' : 'en-US') : ''}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-70">{t.cashierLabel}:</span>
                <span>{lastTransaction?.cashier_name}</span>
              </div>
            </div>

            <div className="border-b-2 border-dashed border-orange-600 mb-3"></div>

            <table className="w-full mb-4 border-collapse">
              <thead>
                <tr className="border-b border-orange-600">
                  <th className="text-left py-2 font-black uppercase text-[10px]">{t.itemLabel}</th>
                  <th className="text-right py-2 font-black uppercase text-[10px]">{t.total}</th>
                </tr>
              </thead>
              <tbody>
                {lastTransaction?.items.map((item: any, i: number) => (
                  <tr key={i} className="align-top border-b border-dotted border-orange-100">
                    <td className="py-3 pr-2">
                      <div className="font-black text-[12px]">{item.name}</div>
                      <div className="text-[10px] opacity-80 mt-0.5">
                        {item.quantity} x {item.price.toFixed(2)} {t.currency}
                      </div>
                      {item.selectedCustomizations && (
                        <div className="text-[9px] italic opacity-70 mt-0.5">
                          {item.selectedCustomizations.size}
                          {item.selectedCustomizations.milkType !== 'Full Fat' ? `, ${item.selectedCustomizations.milkType}` : ''}
                          {item.selectedCustomizations.selectedAddOns?.length > 0 ? `, +${item.selectedCustomizations.selectedAddOns.length} ${t.extras}` : ''}
                        </div>
                      )}
                    </td>
                    <td className="text-right py-3 font-black text-[12px]">
                      {(item.price * item.quantity).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="border-b border-dashed border-orange-600 my-2"></div>

            <div className="space-y-2 text-[11px] mb-4">
              <div className="flex justify-between">
                <span className="opacity-70">{t.subtotal}</span>
                <span className="font-bold">{lastTransaction?.subtotal?.toFixed(2) || lastTransaction?.total.toFixed(2)} {t.currency}</span>
              </div>
              {(lastTransaction?.vat_amount > 0 || settings.vat_rate > 0) && (
                <div className="flex justify-between">
                  <span className="opacity-70">{t.tax} ({(settings.vat_rate * 100).toFixed(0)}%)</span>
                  <span className="font-bold">{lastTransaction?.vat_amount?.toFixed(2) || (lastTransaction?.total * settings.vat_rate).toFixed(2)} {t.currency}</span>
                </div>
              )}
              {lastTransaction?.discount_amount > 0 && (
                <div className="flex justify-between text-black">
                  <span className="opacity-70">{t.discount}</span>
                  <span className="font-bold">-{lastTransaction.discount_amount.toFixed(2)} {t.currency}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-black pt-2 border-t-2 border-orange-600 mt-2">
                <span>{t.total}</span>
                <span>{lastTransaction?.total.toFixed(2)} {t.currency}</span>
              </div>
            </div>

            <div className="border-b-2 border-dashed border-orange-600 mb-4"></div>

            <div className="space-y-2 text-[10px] mb-6">
              <div className="flex justify-between">
                <span className="opacity-70">{t.payment}:</span>
                <span className="font-black uppercase">{lastTransaction?.payment_method}</span>
              </div>
              {lastTransaction?.payment_breakdown && (
                <div className="pl-4 space-y-1 border-l-2 border-orange-50 ml-1">
                  {lastTransaction.payment_breakdown.cash > 0 && (
                    <div className="flex justify-between">
                      <span className="opacity-60">{t.cash}</span>
                      <span>{lastTransaction.payment_breakdown.cash.toFixed(2)}</span>
                    </div>
                  )}
                  {lastTransaction.payment_breakdown.card > 0 && (
                    <div className="flex justify-between">
                      <span className="opacity-60">{t.card}</span>
                      <span>{lastTransaction.payment_breakdown.card.toFixed(2)}</span>
                    </div>
                  )}
                  {lastTransaction.payment_breakdown.mobile > 0 && (
                    <div className="flex justify-between">
                      <span className="opacity-60">{t.mobile}</span>
                      <span>{lastTransaction.payment_breakdown.mobile.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-dotted border-orange-100">
                <span className="opacity-70">{t.amountReceived}:</span>
                <span className="font-bold">{lastTransaction?.received_amount?.toFixed(2) || lastTransaction?.total.toFixed(2)}</span>
              </div>
              {lastTransaction?.change_amount > 0 && (
                <div className="flex justify-between">
                  <span className="opacity-70 font-bold">{t.change}:</span>
                  <span className="font-black text-black">{lastTransaction.change_amount.toFixed(2)}</span>
                </div>
              )}
            </div>
          </>
        )}

        <div className="text-center mt-10">
          <div className="text-[12px] font-black uppercase mb-2 tracking-widest">{t.thankYou}</div>
          {settings.vat_number && (
            <div className="text-[10px] font-bold opacity-80 mb-4">
              {t.vatNumber}: {settings.vat_number}
            </div>
          )}

          <div className="flex justify-center mb-6">
            <div className="p-2 bg-white border-2 border-orange-600 rounded-xl">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${lastTransaction?.id}`}
                className="w-24 h-24 grayscale"
                alt="QR"
              />
            </div>
          </div>

          <div className="text-[9px] font-black opacity-40 uppercase tracking-[0.2em] mb-2">www.doharoastery.com</div>
          <div className="text-[8px] opacity-30 mb-4 font-mono">ID: {lastTransaction?.id}</div>

          <div className="border-t border-orange-100 pt-4 text-[8px] opacity-40 uppercase italic font-bold">
            {t.poweredBy}
          </div>
        </div>
      </div>

      {/* Payment Modals (Cash/Split) */}
      {showCardInput && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-xl z-[250] flex items-center justify-center p-4">
          <div className="bg-white  rounded-[48px] max-w-md w-full p-10 shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-white border-2 border-orange-600 text-black rounded-3xl"><CreditCard size={28} /></div>
                <h3 className="text-2xl font-black">{t.card}</h3>
              </div>
              <button onClick={() => setShowCardInput(false)} className="p-2  rounded-full transition-colors"><X size={32} /></button>
            </div>
            <div className="bg-white  p-6 rounded-[32px] mb-8 border border-orange-50 ">
              <div className="text-[10px] font-black uppercase text-black mb-2">{t.total}</div>
              <div className="text-4xl font-black text-black ">
                {totals.total.toFixed(2)} <span className="text-sm opacity-50 uppercase">{t.currency}</span>
              </div>
            </div>
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase text-black block">{t.transactionReferenceOptional}</label>
              <input
                type="text"
                autoFocus
                value={cardReference}
                onChange={e => setCardReference(e.target.value)}
                className="w-full bg-white  border-none rounded-2xl px-6 py-5 font-mono font-black text-2xl text-black outline-none focus:ring-2 focus:ring-orange-600 text-center"
                placeholder="REF-0000"
              />
            </div>
            <button
              onClick={() => handleCheckout('CARD')}
              disabled={isProcessing}
              className="w-full mt-10 py-5 bg-orange-600 text-white rounded-[24px] font-black text-xl shadow-xl active:scale-95 transition-all disabled:opacity-30 flex items-center justify-center gap-3 border-2 border-orange-600 hover"
            >
              {isProcessing ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} {t.completePayment}
            </button>
          </div>
        </div>
      )}

      {showCashModal && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-xl z-[250] flex items-center justify-center p-4">
          <div className="bg-white  rounded-[48px] max-w-md w-full p-10 shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-white border-2 border-orange-600 text-black rounded-3xl"><Banknote size={28} /></div>
                <h3 className="text-2xl font-black">{t.cash}</h3>
              </div>
              <button onClick={() => setShowCashModal(false)} className="p-2  rounded-full transition-colors"><X size={32} /></button>
            </div>
            <div className="bg-white  p-6 rounded-[32px] mb-8 border border-orange-50 ">
              <div className="text-[10px] font-black uppercase text-black mb-2">{t.total}</div>
              <div className="text-4xl font-black text-black ">
                {totals.total.toFixed(2)} <span className="text-sm opacity-50 uppercase">{t.currency}</span>
              </div>
            </div>
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase text-black block">{t.amountReceived}</label>
              <input type="number" autoFocus value={cashReceived} onChange={e => setCashReceived(e.target.value)} className="w-full bg-white  border-none rounded-2xl px-6 py-5 font-mono font-black text-4xl text-black outline-none focus:ring-2 focus:ring-orange-600 text-center" placeholder="0.00" />

              {parseFloat(cashReceived) >= totals.total && (
                <div className="bg-white border-2 border-orange-600 p-4 rounded-2xl flex justify-between items-center animate-in fade-in slide-in-from-top-2">
                  <span className="text-[10px] font-black uppercase text-black">{t.change}</span>
                  <span className="text-2xl font-black text-orange-600 font-mono">{(parseFloat(cashReceived) - totals.total).toFixed(2)} {t.currency}</span>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                {[10, 20, 50, 100, 200, 500].map(val => (
                  <button key={val} onClick={() => setCashReceived(val.toString())} className="py-4 bg-white  rounded-2xl font-black text-sm  transition-colors">{val}</button>
                ))}
              </div>
            </div>
            <button
              onClick={() => handleCheckout('CASH', undefined, parseFloat(cashReceived))}
              disabled={parseFloat(cashReceived) < totals.total || isProcessing}
              className="w-full mt-10 py-5 bg-orange-600 text-white rounded-[24px] font-black text-xl shadow-xl active:scale-95 transition-all disabled:opacity-30 flex items-center justify-center gap-3 border-2 border-orange-600 hover"
            >
              {isProcessing ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} {t.completePayment}
            </button>
          </div>
        </div>
      )}

      {showSplitModal && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-xl z-[250] flex items-center justify-center p-4">
          <div className="bg-white  rounded-[48px] max-w-lg w-full p-10 shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-white  text-black  rounded-3xl"><Scissors size={28} /></div>
                <h3 className="text-2xl font-black">{t.splitPayment}</h3>
              </div>
              <button onClick={() => setShowSplitModal(false)} className="p-2  rounded-full transition-colors"><X size={32} /></button>
            </div>
            <div className="bg-white  p-6 rounded-[32px] mb-8 border border-orange-50 ">
              <div className="flex justify-between text-[10px] font-black uppercase text-black mb-2">
                <span>{t.total}</span>
                <span>{t.remaining}</span>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-xl font-bold">{totals.total.toFixed(2)} {t.currency}</span>
                <span className={`text-3xl font-black font-mono ${splitRemaining > 0 ? 'text-black' : 'text-green-600'}`}>{splitRemaining.toFixed(2)}</span>
              </div>
            </div>
            <div className="space-y-6">
              {([{ id: 'cash', icon: Banknote, color: 'black' }, { id: 'card', icon: CreditCard, color: 'black' }, { id: 'mobile', icon: Smartphone, color: 'black' }] as any).map((method: any) => (
                <div key={method.id} className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-black flex items-center gap-2">
                    <method.icon size={14} className="text-orange-600" /> {t[method.id as keyof typeof t] || method.id}
                  </label>
                  <input type="number" value={(splitBreakdown as any)[method.id] || ''} onChange={e => setSplitBreakdown({ ...splitBreakdown, [method.id]: parseFloat(e.target.value) || 0 })} className="w-full bg-white  border-none rounded-2xl px-6 py-4 font-mono font-bold text-lg outline-none focus:ring-2 focus:ring-stone-500" placeholder="0.00" />

                  {method.id === 'card' && splitBreakdown.card > 0 && (
                    <div className="mt-2 animate-in fade-in slide-in-from-top-2">
                      <input
                        type="text"
                        placeholder={t.cardReference}
                        value={splitBreakdown.card_reference || ''}
                        onChange={e => setSplitBreakdown({ ...splitBreakdown, card_reference: e.target.value })}
                        className="w-full bg-white/50 border-none rounded-xl px-4 py-2 text-xs font-bold outline-none focus:ring-1 focus:ring-orange-600"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={() => handleCheckout('SPLIT', splitBreakdown)}
              disabled={Math.abs(splitRemaining) > 0.01 || isProcessing}
              className="w-full mt-8 py-5 bg-orange-600 text-white rounded-[24px] font-black text-xl shadow-xl active:scale-95 transition-all disabled:opacity-30 flex items-center justify-center gap-3 border-2 border-orange-600 hover"
            >
              {t.completeSplit}
            </button>
          </div>
        </div>
      )}

      {/* Item Customization Modal */}
      {customizingItem && (
        <div className="fixed inset-0 bg-white/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white  rounded-[40px] max-w-2xl w-full p-8 shadow-2xl animate-in zoom-in-95 overflow-y-auto max-h-[90vh] custom-scrollbar">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-white border-2 border-orange-600 text-black rounded-2xl"><Coffee size={32} /></div>
                <h3 className="text-2xl font-black">{customizingItem.name}</h3>
              </div>
              <button onClick={() => setCustomizingItem(null)} className="p-2  rounded-full transition-colors text-black"><X size={32} /></button>
            </div>
            <div className="space-y-8 pb-4">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.size}</label>
                <div className="grid grid-cols-3 gap-3">
                  {(['S', 'M', 'L'] as const).map(s => (
                    <button key={s} onClick={() => setTempCustoms({ ...tempCustoms, size: s })} className={`py-5 rounded-3xl font-black transition-all border-2 ${tempCustoms.size === s ? 'bg-orange-600 text-white border-orange-600 shadow-lg' : 'bg-white  border-transparent text-black'}`}>{s}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-black uppercase tracking-widest">{t.milk}</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Object.keys(MILK_PRICES).map(m => (
                    <button key={m} onClick={() => setTempCustoms({ ...tempCustoms, milkType: m as any })} className={`px-2 py-4 rounded-2xl font-bold text-[10px] transition-all border-2 ${tempCustoms.milkType === m ? 'bg-orange-600 text-white border-orange-600' : 'bg-white  border-transparent text-black'}`}>
                      {m}
                      {MILK_PRICES[m as keyof typeof MILK_PRICES] > 0 && <span className="block mt-1 opacity-60">+{MILK_PRICES[m as keyof typeof MILK_PRICES]} {t.currency}</span>}
                    </button>
                  ))}
                </div>
              </div>
              {(customizingItem as any).add_ons?.length > 0 && (
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-black uppercase tracking-widest flex items-center gap-2"><PlusCircle size={14} /> {t.extras}</label>
                  <div className="grid grid-cols-2 gap-3">
                    {(customizingItem as any).add_ons.map((ao: AddOn) => {
                      const isSelected = tempCustoms.selectedAddOns?.some(s => s.id === ao.id);
                      return (
                        <button key={ao.id} onClick={() => toggleAddOn(ao)} className={`flex justify-between items-center px-4 py-4 rounded-3xl border-2 transition-all ${isSelected ? 'bg-white border-orange-600 text-black shadow-sm' : 'bg-white  border-transparent text-black'}`}>
                          <span className="text-xs font-bold">{ao.name}</span>
                          <span className="font-mono font-black text-[10px]">+{ao.price} {isSelected && <Check size={12} className="inline ml-1" />}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <button onClick={() => {
                if (!customizingItem) return;
                const milkExtra = MILK_PRICES[tempCustoms.milkType as keyof typeof MILK_PRICES] || 0;
                const addOnsExtra = tempCustoms.selectedAddOns?.reduce((sum: number, ao: AddOn) => sum + ao.price, 0) || 0;
                addToCart(customizingItem, { ...tempCustoms, extraPrice: milkExtra + addOnsExtra });
              }} className="w-full py-5 bg-orange-600 text-white rounded-[32px] font-black text-xl shadow-xl active:scale-95 transition-all mt-4 border-2 border-orange-600 hover">
                {t.addToOrder}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Catalog or History View */}
      <div className="flex-1 flex flex-col gap-4 overflow-hidden h-full">
        {/* Top Bar: Search & Categories */}
        <div className="bg-white  p-4 rounded-[32px] border border-orange-100  shadow-sm flex flex-col gap-4 shrink-0">
          <div className="flex items-center gap-4">
            {/* Location Selector */}
            <div className="relative">
              <select
                value={selectedLocationId}
                onChange={e => setSelectedLocationId(e.target.value)}
                className="appearance-none p-4 pr-10 bg-white rounded-2xl font-bold text-xs flex items-center gap-2 border border-orange-100 outline-none focus:border-orange-600 transition-all min-w-[160px]"
              >
                <option value="" disabled>-- {t.locationName || 'Location'} --</option>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name} {loc.type === 'BRANCH' ? '(Branch)' : ''}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" size={16} />
            </div>

            <button
              onClick={() => {
                if (!currentShift) {
                  setShowStartShiftModal(true);
                } else {
                  setShowShiftDetails(true);
                }
              }}
              className="p-4 bg-white  rounded-2xl font-bold text-xs flex items-center gap-2   transition-all shrink-0"
            >
              <Banknote size={20} />
              <span className="hidden sm:inline">{t.drawer}</span>
            </button>
            <div className="relative flex-1">
              <Search className={`absolute ${t.dir === 'rtl' ? 'right-5' : 'left-5'} top-1/2 -translate-y-1/2 text-black`} size={20} />
              <input
                type="text"
                placeholder={activeTab === 'HISTORY' ? t.history : t.searchProduct}
                value={activeTab === 'HISTORY' ? historySearch : searchTerm}
                onChange={e => activeTab === 'HISTORY' ? setHistorySearch(e.target.value) : setSearchTerm(e.target.value)}
                className="w-full bg-white  border-none rounded-2xl px-12 py-4 font-bold outline-none focus:ring-2 focus:ring-orange-600 text-base transition-all text-black  placeholder-stone-400"
              />
            </div>

            {activeTab === 'HISTORY' && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 bg-white  px-4 py-3 rounded-2xl border border-orange-50 ">
                  <input
                    type="date"
                    className="bg-transparent border-none outline-none text-xs font-bold text-black "
                    value={dateRange.start}
                    onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  />
                  <span className="text-black">→</span>
                  <input
                    type="date"
                    className="bg-transparent border-none outline-none text-xs font-bold text-black "
                    value={dateRange.end}
                    onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  />
                  {(dateRange.start || dateRange.end) && (
                    <button onClick={() => setDateRange({ start: '', end: '' })} className="text-black hover"><X size={14} /></button>
                  )}
                </div>
                <button onClick={fetchHistory} className="p-3 bg-orange-600 text-white rounded-xl  transition-all border-2 border-orange-600"><RefreshCw size={20} /></button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {[
              { id: 'ALL', label: t.all, icon: LayoutGrid },
              { id: 'DRINKS', label: t.drinks, icon: Coffee },
              { id: 'PACKAGED', label: t.packaged, icon: Box },
              { id: 'HISTORY', label: t.history, icon: History },
              { id: 'RETURNS', label: t.returns, icon: RefreshCw }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black transition-all whitespace-nowrap ${activeTab === tab.id
                  ? 'bg-orange-600 text-white shadow-lg'
                  : 'bg-white  text-black  '
                  }`}
              >
                <tab.icon size={16} /> {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-1 pb-20">
          {activeTab === 'HISTORY' ? (
            <div className="space-y-3 animate-in slide-in-from-bottom-4">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 opacity-30">
                  <Loader2 size={48} className="animate-spin mb-4" />
                  <span className="font-bold">{t.loading}</span>
                </div>
              ) : filteredHistory.length > 0 ? filteredHistory.map(tx => (
                <div key={tx.id} className="bg-white  p-4 rounded-2xl border border-orange-100  shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row justify-between items-center gap-4 group">
                  <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="p-3 bg-white  text-black rounded-xl group- group- transition-colors"><Receipt size={20} /></div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm">{tx.id}</h4>
                        <span className="px-2 py-0.5 bg-white  rounded text-[10px] font-black uppercase">{tx.payment_method}</span>
                      </div>
                      <div className="flex items-center gap-3 text-black text-[10px] mt-1 font-bold">
                        <span className="flex items-center gap-1"><Clock size={10} /> {new Date(tx.created_at).toLocaleString()}</span>
                        <span className="flex items-center gap-1"><UserIcon size={10} /> {tx.cashier_name}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                    <div className="text-right">
                      <span className="block text-[10px] font-black text-black uppercase">{t.total}</span>
                      <span className="text-lg font-black text-black  font-mono">{tx.total.toFixed(2)} <span className="text-[10px] opacity-50">{t.currency}</span></span>
                    </div>
                    <button
                      onClick={() => handlePrint(tx)}
                      className="p-3 bg-white  text-black  rounded-xl border-2 border-orange-600 transition-all active:scale-95 flex items-center gap-2"
                    >
                      <Printer size={16} />
                      <span className="text-xs font-black hidden sm:inline">{t.reprint}</span>
                    </button>
                  </div>
                </div>
              )) : (
                <div className="flex flex-col items-center justify-center py-20 opacity-30">
                  <SearchX size={64} className="mb-4" />
                  <p className="font-bold">{t.emptyCart}</p>
                </div>
              )}
            </div>
          ) : activeTab === 'RETURNS' ? (
            <div className="space-y-8 animate-in slide-in-from-bottom-4 pb-20">
              {/* Return Search Area */}
              <div className="bg-white  p-8 rounded-[40px] border border-orange-100  shadow-sm">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 bg-white  border-2 border-orange-600 text-black  rounded-2xl">
                    <RefreshCw size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black">{t.processReturn}</h3>
                    <p className="text-xs text-black font-bold uppercase tracking-widest">{t.searchInvoicePrompt}</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="relative flex-1">
                    <Search className={`absolute ${t.dir === 'rtl' ? 'right-6' : 'left-6'} top-1/2 -translate-y-1/2 text-black`} size={20} />
                    <input
                      type="text"
                      placeholder={t.invoiceNumberPlaceholder}
                      value={returnInvoiceSearch}
                      onChange={e => setReturnInvoiceSearch(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && searchInvoice()}
                      className="w-full bg-white border-2 border-orange-600 rounded-[24px] px-14 py-4 font-bold outline-none focus:ring-2 focus:ring-orange-600 shadow-inner text-black placeholder-gray-500"
                    />
                  </div>
                  <button
                    onClick={searchInvoice}
                    disabled={searchingInvoice || !returnInvoiceSearch.trim()}
                    className="px-8 bg-orange-600 text-white rounded-[24px] font-bold  transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 border-2 border-orange-600"
                  >
                    {searchingInvoice ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
                    {t.searchLabel}
                  </button>
                </div>
              </div>

              {/* Selected Invoice Details */}
              {selectedInvoice && (
                <div className="bg-white  rounded-[40px] border border-orange-100  shadow-xl overflow-hidden animate-in zoom-in-95">
                  <div className="bg-orange-600 text-white p-6 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <Receipt size={24} className="text-orange-600" />
                      <div>
                        <h4 className="font-black text-lg">{selectedInvoice.id}</h4>
                        <span className="text-[10px] opacity-60 font-black uppercase">{new Date(selectedInvoice.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="block text-[10px] opacity-60 font-black uppercase">{t.total}</span>
                      <span className="text-xl font-black text-black font-mono">{selectedInvoice.total.toFixed(2)} {t.currency}</span>
                    </div>
                  </div>

                  <div className="p-8">
                    <h5 className="text-[10px] font-black text-black uppercase tracking-widest mb-4">{t.selectItemsToReturn}</h5>
                    <div className="space-y-4">
                      {selectedInvoice.items.map((item: any) => {
                        const isSelected = itemsToReturn.some(i => i.cartId === item.cartId);
                        const returnItem = itemsToReturn.find(i => i.cartId === item.cartId);

                        return (
                          <div key={item.cartId} className={`p-5 rounded-[28px] border-2 transition-all ${isSelected ? 'border-orange-600 bg-white/30 /10' : 'border-orange-50 '}`}>
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-4 flex-1">
                                <button
                                  onClick={() => toggleReturnItem(item)}
                                  className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${isSelected ? 'bg-orange-600 text-white' : 'bg-white  text-black'}`}
                                >
                                  {isSelected ? <Check size={18} strokeWidth={3} /> : <Plus size={18} strokeWidth={3} />}
                                </button>
                                <div>
                                  <p className="font-bold text-sm">{item.name}</p>
                                  <p className="text-[10px] text-black font-black">{item.quantity} x {item.price.toFixed(2)} {t.currency}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-black text-black font-mono">{(item.price * item.quantity).toFixed(2)}</p>
                              </div>
                            </div>

                            {isSelected && (
                              <div className="mt-4 pt-4 border-t border-orange-600/50 /30 animate-in slide-in-from-top-2 space-y-3">
                                <div className="flex items-center justify-between gap-4">
                                  <div className="flex-1">
                                    <label className="text-[10px] font-black text-black uppercase mb-1 block">{t.quantity}</label>
                                    <div className="flex items-center gap-2 bg-white  rounded-xl p-1 w-fit">
                                      <button
                                        onClick={() => updateReturnQuantity(item.cartId, -1, item.quantity)}
                                        className="w-8 h-8 flex items-center justify-center  rounded-lg transition-colors"
                                      >
                                        <Minus size={14} strokeWidth={3} />
                                      </button>
                                      <span className="w-8 text-center font-black text-sm">{returnItem?.quantity}</span>
                                      <button
                                        onClick={() => updateReturnQuantity(item.cartId, 1, item.quantity)}
                                        className="w-8 h-8 flex items-center justify-center  rounded-lg transition-colors"
                                        disabled={returnItem?.quantity === item.quantity}
                                      >
                                        <Plus size={14} strokeWidth={3} />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex-1">
                                    <label className="text-[10px] font-black text-black uppercase mb-1 block">{t.returnReason}</label>
                                    <select
                                      value={returnItem?.return_reason || ''}
                                      onChange={(e) => updateReturnReason(item.cartId, e.target.value)}
                                      className="w-full bg-white  border-2 border-orange-600 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-orange-600"
                                    >
                                      <option value="">{t.selectReason}</option>
                                      <option value="Customer Dissatisfaction">{t.customerDissatisfaction}</option>
                                      <option value="Wrong Item">{t.wrongItem}</option>
                                      <option value="Quality Issue">{t.qualityIssue}</option>
                                      <option value="Order Cancelled">{t.orderCancelled}</option>
                                      <option value="Other">{t.other}</option>
                                    </select>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {itemsToReturn.length > 0 && (
                      <div className="mt-8 pt-8 border-t border-orange-50 ">
                        <div className="flex justify-between items-center mb-6">
                          <div>
                            <span className="text-[10px] font-black text-black uppercase">{t.totalRefundAmount}</span>
                            <h4 className="text-3xl font-black text-black  font-mono">
                              {itemsToReturn.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)}
                              <span className="text-xs ml-2 opacity-50 uppercase">{t.currency}</span>
                            </h4>
                          </div>
                          <button
                            onClick={submitReturnRequest}
                            disabled={isProcessing}
                            className="px-10 py-5 bg-orange-600 text-white rounded-[24px] font-black text-lg shadow-xl shadow-black/20  active:scale-95 transition-all flex items-center gap-3 border-2 border-orange-600"
                          >
                            {isProcessing ? <Loader2 size={24} className="animate-spin" /> : <RefreshCw size={24} />}
                            {t.submitRefundRequest}
                          </button>
                        </div>
                        <p className="text-[10px] text-black font-bold text-center bg-white border border-orange-600 py-2 rounded-lg">
                          {t.managerApprovalNote}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Recent Return Requests */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-4">
                  <h4 className="text-sm font-black text-black uppercase tracking-widest">{t.recentReturns}</h4>
                  <button onClick={fetchReturnRequests} className="text-black  transition-colors"><RefreshCw size={18} /></button>
                </div>

                {isLoading && returnRequests.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 opacity-30">
                    <Loader2 size={32} className="animate-spin" />
                  </div>
                ) : returnRequests.length > 0 ? (
                  returnRequests.map(req => (
                    <div key={req.id} className="bg-white  p-6 rounded-[32px] border border-orange-100  shadow-sm flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-2xl ${req.status === 'APPROVED' ? 'bg-white text-black border border-orange-600' :
                          req.status === 'REJECTED' ? 'bg-orange-600 text-white' :
                            'bg-white text-black border border-orange-600'
                          }`}>
                          {req.status === 'APPROVED' ? <CheckCircle2 size={24} /> :
                            req.status === 'REJECTED' ? <X size={24} /> :
                              <Clock size={24} />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h5 className="font-black text-sm">{req.invoice_number}</h5>
                            <span className={`px-2 py-0.5 rounded-[6px] text-[8px] font-black uppercase ${req.status === 'APPROVED' ? 'bg-white text-black border border-orange-600' :
                              req.status === 'REJECTED' ? 'bg-orange-600 text-white' :
                                'bg-white text-black border border-orange-600'
                              }`}>{req.status}</span>
                          </div>
                          <p className="text-[10px] text-black font-bold mt-1">
                            {new Date(req.created_at).toLocaleString()} • {req.items.length} {t.items}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="block text-[8px] font-black text-black uppercase">{t.amount}</span>
                          <span className="text-lg font-black text-black font-mono">{req.total_refund_amount.toFixed(2)}</span>
                        </div>

                        {req.status === 'PENDING_APPROVAL' && (user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => approveRefund(req.id, true)}
                              className="p-3 bg-orange-600 text-white rounded-xl  transition-all active:scale-95 shadow-md border-2 border-orange-600"
                              title={t.approve}
                            >
                              <CheckCircle2 size={18} />
                            </button>
                            <button
                              onClick={() => approveRefund(req.id, false)}
                              className="p-3 bg-white text-black rounded-xl  transition-all active:scale-95 border-2 border-orange-600"
                              title={t.reject}
                            >
                              <X size={18} />
                            </button>
                          </div>
                        )}

                        {req.status === 'APPROVED' && (
                          <button
                            onClick={() => handlePrintReturn(req)}
                            className="p-3 bg-white  text-black  rounded-xl  transition-all active:scale-95"
                            title={t.printReceipt}
                          >
                            <Printer size={18} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="bg-white/50 border-2 border-dashed border-orange-100  rounded-[32px] p-10 text-center opacity-30">
                    <History size={48} className="mx-auto mb-4" />
                    <p className="font-bold text-sm">{t.noReturnRequests}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 animate-in fade-in duration-500">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="bg-white  rounded-[32px] aspect-[4/5] animate-pulse"></div>
                ))
              ) : filteredItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => openCustomization(item)}
                  className="group bg-white  p-3 rounded-[32px] border border-orange-100  shadow-sm hover:shadow-xl hover/10 transition-all flex flex-col h-full active:scale-95 relative overflow-hidden"
                >
                  <div className="aspect-square rounded-[24px] overflow-hidden mb-3 bg-white relative">
                    <img src={item.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={item.name} />
                    <div className="absolute inset-0 bg-white/0 group-hover/5 transition-colors" />
                  </div>
                  <div className="flex-1 flex flex-col px-1">
                    <h4 className="font-bold text-black  text-sm line-clamp-2 mb-2 leading-tight text-center h-10">{item.name}</h4>
                    {(item.type === 'PACKAGED_COFFEE' || item.category === 'PACKAGED') && (
                      <div className="text-[10px] font-bold text-black/60 text-center leading-tight mb-2 line-clamp-2">
                        {[item.bean_origin, item.roast_level, item.roast_date].filter(Boolean).join(' • ')}
                      </div>
                    )}
                    <div className="mt-auto flex justify-between items-center bg-white  p-2 rounded-2xl group- group- transition-colors">
                      <span className="font-black text-lg font-mono px-2">{item.price}<span className="text-[10px] ml-1 opacity-60 font-sans">{t.currency}</span></span>
                      <div className="w-8 h-8 bg-white  text-black  rounded-xl flex items-center justify-center shadow-sm"><Plus size={16} strokeWidth={3} /></div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cart Sidebar */}
      <aside className={`fixed inset-y-0 ${t.dir === 'rtl' ? 'left-0' : 'right-0'} z-[100] w-full sm:w-[450px] lg:w-[400px] transform transition-all duration-500 ease-in-out lg:static lg:translate-x-0 ${showMobileCart ? 'translate-x-0' : (t.dir === 'rtl' ? '-translate-x-full' : 'translate-x-full')} flex flex-col bg-white  border-l border-orange-100  shadow-2xl lg:shadow-none h-full`}>
        {/* Header */}
        <div className="p-6 border-b border-orange-50  flex justify-between items-center bg-white  z-10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-600 text-white rounded-xl flex items-center justify-center shadow-md"><ShoppingCart size={20} /></div>
            <div>
              <h3 className="text-lg font-black">{t.bill}</h3>
              <span className="text-[10px] font-bold text-black uppercase tracking-widest">{cart.length} {t.items}</span>
            </div>
          </div>
          <button onClick={() => setShowMobileCart(false)} className="lg:hidden p-2  rounded-full"><X size={24} /></button>
        </div>

        {/* Customer Selection */}
        <div className="p-4 border-b border-orange-50 bg-orange-50/30">
          {!selectedCustomer ? (
            <button
              onClick={() => setShowCustomerSearch(true)}
              className="w-full py-3 px-4 bg-white border border-orange-200 rounded-xl flex items-center justify-between text-gray-700 hover:border-orange-400 hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                  <UserIcon size={16} />
                </div>
                <span className="font-medium text-sm">{t.selectCustomerBtn || 'Add Customer'}</span>
              </div>
              <Plus size={18} className="text-gray-400 group-hover:text-orange-600" />
            </button>
          ) : (
            <div className="w-full p-3 bg-white border-2 border-orange-500 rounded-xl flex items-center justify-between shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-12 h-12 bg-orange-500/10 rounded-bl-full -z-10"></div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600">
                  <UserIcon size={20} />
                </div>
                <div>
                  <p className="font-bold text-sm text-gray-900 leading-tight">{selectedCustomer.full_name}</p>
                  {selectedCustomer.loyalty_points > 0 && (
                    <p className="text-[10px] font-bold text-orange-600 uppercase tracking-wide">
                      {selectedCustomer.loyalty_points} {t.loyaltyPoints || 'Points'}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-white/30">
          {cart.length > 0 ? cart.map(item => (
            <div key={(item as any).cartId} className="bg-white  p-3 rounded-2xl border border-orange-50  shadow-sm flex gap-3 group animate-in slide-in-from-bottom-2">
              <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-white"><img src={item.image} className="w-full h-full object-cover" /></div>
              <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                <div className="flex justify-between items-start gap-2">
                  <h5 className="font-bold text-sm leading-tight line-clamp-2">{item.name}</h5>
                  <span className="font-black font-mono text-sm">{(item.price * item.quantity).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-end">
                  <div className="flex flex-wrap gap-1">
                    {item.selectedCustomizations && (
                      <span className="px-1.5 py-0.5 bg-white  rounded text-[9px] font-bold text-black uppercase">{item.selectedCustomizations.size}</span>
                    )}
                    {item.selectedCustomizations?.selectedAddOns?.map((ao: AddOn) => (
                      <span key={ao.id} className="px-1.5 py-0.5 bg-white  rounded text-[9px] font-bold text-black uppercase">+{ao.name}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 bg-white  p-1 rounded-lg">
                    <button onClick={() => updateQuantity((item as any).cartId, -1)} className="w-6 h-6 flex items-center justify-center rounded-md transition-colors"><Minus size={12} strokeWidth={3} /></button>
                    <span className="w-6 text-center font-black font-mono text-xs">{item.quantity}</span>
                    <button onClick={() => updateQuantity((item as any).cartId, 1)} className="w-6 h-6 flex items-center justify-center rounded-md transition-colors"><Plus size={12} strokeWidth={3} /></button>
                  </div>
                </div>
              </div>
            </div>
          )) : (
            <div className="h-full flex flex-col items-center justify-center opacity-20">
              <ShoppingCart size={48} className="mb-4" />
              <p className="font-bold text-xs uppercase tracking-widest">{t.emptyCart}</p>
            </div>
          )}
        </div>

        {/* Footer / Totals */}
        <div className="p-6 bg-white  border-t border-orange-100  z-10 shrink-0 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
          <div className="space-y-2 mb-6">
            <div className="flex justify-between text-xs font-bold text-black">
              <span>{t.subtotal}</span>
              <span>{totals.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-dashed border-orange-100 ">
              <span className="text-sm font-black uppercase">{t.total}</span>
              <span className="text-3xl font-black font-mono">{totals.total.toFixed(2)} <span className="text-xs font-bold opacity-50">{t.currency}</span></span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setShowCashModal(true)} disabled={cart.length === 0 || isProcessing} className="py-4 rounded-xl bg-white  text-black  font-black text-xs uppercase flex items-center justify-center gap-2 disabled:opacity-50 transition-colors">
              <Banknote size={18} /> {t.cash}
            </button>
            <button onClick={() => setShowCardInput(true)} disabled={cart.length === 0 || isProcessing} className="py-4 rounded-xl bg-white  text-black  font-black text-xs uppercase flex items-center justify-center gap-2 disabled:opacity-50 transition-colors">
              <CreditCard size={18} /> {t.card}
            </button>
            <button onClick={() => handleCheckout('MOBILE')} disabled={cart.length === 0 || isProcessing} className="py-4 rounded-xl bg-white  text-black  font-black text-xs uppercase flex items-center justify-center gap-2 disabled:opacity-50 transition-colors">
              <Smartphone size={18} /> {t.mobile}
            </button>
            <button onClick={() => setShowSplitModal(true)} disabled={cart.length === 0 || isProcessing} className="py-4 rounded-xl bg-orange-600 text-white  font-black text-xs uppercase flex items-center justify-center gap-2 disabled:opacity-50 transition-colors shadow-lg">
              <Scissors size={18} /> {t.split}
            </button>
          </div>
        </div>
      </aside>

      {/* Success Modal with Print Button */}
      {showSuccess && lastTransaction && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-2xl z-[300] flex flex-col items-center justify-center animate-in zoom-in-95">
          <div className="bg-white  p-8 md:p-12 rounded-[64px] text-center shadow-2xl border border-white/20 relative overflow-hidden max-w-lg w-full mx-4">
            <div className="absolute top-0 left-0 w-full h-3 bg-orange-600"></div>
            <div className="bg-white border-2 border-orange-600 p-6 rounded-full inline-block mb-6 animate-bounce-slow">
              <CheckCircle2 size={64} className="text-orange-600" />
            </div>
            <h2 className="text-3xl font-black mb-2 text-black ">{t.orderConfirmed}</h2>
            <div className="bg-white/50 p-5 rounded-[28px] mb-6 space-y-3 text-xs font-bold text-black ">
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2 opacity-60"><Receipt size={14} /> {t.invoiceNo}</span>
                <span className="font-mono">{lastTransaction.id}</span>
              </div>
              <div className="flex justify-between items-center border-t border-orange-100  pt-3">
                <span className="opacity-60">{t.total}</span>
                <span className="text-lg font-black text-black ">{lastTransaction.total.toFixed(2)} {t.currency}</span>
              </div>

              {lastTransaction.change_amount > 0 && (
                <div className="flex justify-between items-center border-t border-dashed border-orange-100  pt-3 text-black ">
                  <span className="opacity-60">{t.change}</span>
                  <span className="text-lg font-black">{lastTransaction.change_amount.toFixed(2)} {t.currency}</span>
                </div>
              )}

              <div className="flex justify-between items-center border-t border-orange-100  pt-3">
                <span className="opacity-60">{t.payment}</span>
                <span className="font-black uppercase">{lastTransaction.payment_method}</span>
              </div>

              {lastTransaction.card_reference && (
                <div className="flex justify-between items-center border-t border-dashed border-orange-100  pt-3 text-black ">
                  <span className="opacity-60">{t.reference}</span>
                  <span className="font-mono">{lastTransaction.card_reference}</span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handlePrint()}
                className="py-4 bg-white  text-black  rounded-2xl font-bold flex items-center justify-center gap-2  transition-all active:scale-95"
              >
                <Printer size={20} /> {t.printLabel}
              </button>
              <button
                onClick={() => { setShowSuccess(false); setLastTransaction(null); }}
                className="py-4 bg-orange-600 text-white rounded-2xl font-bold shadow-lg  transition-all active:scale-95 border-2 border-orange-600"
              >
                {t.newOrder}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Return Success Modal */}
      {showReturnSuccess && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-2xl z-[300] flex flex-col items-center justify-center animate-in zoom-in-95">
          <div className="bg-white  p-12 rounded-[64px] text-center shadow-2xl border border-white/20 relative overflow-hidden max-w-lg w-full">
            <div className="absolute top-0 left-0 w-full h-3 bg-orange-600"></div>
            <div className="bg-white border-2 border-orange-600 p-6 rounded-full inline-block mb-6 animate-bounce-slow">
              <CheckCircle2 size={64} className="text-orange-600" />
            </div>
            <h2 className="text-3xl font-black mb-2 text-black ">{t.returnApproved}</h2>
            <p className="text-black mb-8 font-bold">{t.refundProcessed}</p>
            <button
              onClick={() => setShowReturnSuccess(false)}
              className="w-full py-4 bg-orange-600 text-white rounded-2xl font-bold shadow-lg  transition-all active:scale-95 border-2 border-orange-600"
            >
              {t.close}
            </button>
          </div>
        </div>
      )}

      {/* Manager Approval Modal for Returns */}
      {showManagerApprovalModal && pendingReturnRequest && (
        <div className="fixed inset-0 bg-white/90 backdrop-blur-xl z-[400] flex items-center justify-center p-4">
          <div className="bg-white  rounded-[48px] max-w-md w-full p-10 shadow-2xl animate-in zoom-in-95 border border-orange-100  relative">
            <button
              onClick={() => setShowManagerApprovalModal(false)}
              className="absolute top-6 right-6 p-2 rounded-full transition-colors text-black hover"
            >
              <X size={24} />
            </button>
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-white border-2 border-orange-600 text-orange-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <UserIcon size={40} />
              </div>
              <h3 className="text-2xl font-black mb-2">{t.managerApprovalRequired}</h3>
              <p className="text-xs text-black font-bold uppercase tracking-widest">{t.managerApprovalPrompt}</p>
            </div>

            <div className="bg-white  p-6 rounded-[32px] mb-8 border border-orange-50 ">
              <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] font-black text-black uppercase">{t.refundAmount}</span>
                <span className="text-2xl font-black text-orange-600 font-mono">{pendingReturnRequest.total_refund_amount.toFixed(2)} {t.currency}</span>
              </div>
              <div className="space-y-2">
                {pendingReturnRequest.items.map((item: any) => (
                  <div key={item.cartId} className="flex justify-between text-[10px] font-bold">
                    <span className="text-black">{item.name} x {item.quantity}</span>
                    <span className="text-black ">{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => approveRefund(pendingReturnRequest.id, false)}
                disabled={isProcessing}
                className="py-4 bg-white border-2 border-orange-600 text-black rounded-2xl font-bold  transition-all active:scale-95 disabled:opacity-50"
              >
                {t.reject}
              </button>
              <button
                onClick={() => approveRefund(pendingReturnRequest.id, true)}
                disabled={isProcessing}
                className="py-4 bg-orange-600 text-white rounded-2xl font-black shadow-xl  transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 border-2 border-orange-600"
              >
                {isProcessing ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle2 size={20} />}
                {t.approve}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Start Shift Modal */}
      {showStartShiftModal && (
        <div className="fixed inset-0 bg-white/90 backdrop-blur-xl z-[500] flex items-center justify-center p-4">
          <div className="bg-white  rounded-[48px] max-w-md w-full p-10 shadow-2xl animate-in zoom-in-95 border border-orange-100 ">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-white border-2 border-orange-600 text-black rounded-3xl flex items-center justify-center mx-auto mb-6">
                <Banknote size={40} />
              </div>
              <h3 className="text-2xl font-black mb-2">{t.startShift}</h3>
              <p className="text-xs text-black font-bold uppercase tracking-widest">{t.enterInitialFloat}</p>
            </div>

            <div className="space-y-4 mb-8">
              <input
                type="number"
                autoFocus
                value={startCash}
                onChange={e => setStartCash(e.target.value)}
                className="w-full bg-white  border-none rounded-2xl px-6 py-5 font-mono font-black text-4xl text-black outline-none focus:ring-2 focus:ring-orange-600 text-center"
                placeholder="0.00"
              />
            </div>

            <button
              onClick={handleStartShift}
              disabled={!startCash || isProcessing}
              className="w-full py-5 bg-orange-600 text-white rounded-[24px] font-black text-xl shadow-xl active:scale-95 transition-all disabled:opacity-30 flex items-center justify-center gap-3 border-2 border-orange-600 hover"
            >
              {isProcessing ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} {t.openDrawer}
            </button>
          </div>
        </div>
      )}

      {/* Shift Details Modal */}
      {showShiftDetails && currentShift && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-xl z-[500] flex items-center justify-center p-4">
          <div className="bg-white  rounded-[48px] max-w-md w-full p-10 shadow-2xl animate-in zoom-in-95 relative">
            <button onClick={() => setShowShiftDetails(false)} className="absolute top-6 right-6 p-2  rounded-full transition-colors"><X size={24} /></button>

            <div className="flex items-center gap-4 mb-8">
              <div className="p-4 bg-white border-2 border-orange-600 text-black rounded-3xl"><History size={28} /></div>
              <div>
                <h3 className="text-2xl font-black">{t.shiftDetails}</h3>
                <p className="text-[10px] text-black font-bold uppercase tracking-widest">{new Date(currentShift.start_time).toLocaleString()}</p>
              </div>
            </div>

            <div className="bg-white  p-6 rounded-[32px] mb-8 border border-orange-50  space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-black uppercase">{t.initialFloat}</span>
                <span className="text-xl font-mono font-bold">{currentShift.initial_cash.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-black uppercase">{t.cashSales}</span>
                <span className="text-xl font-mono font-bold text-green-600">+{shiftTotals.sales.toFixed(2)}</span>
              </div>
              {shiftTotals.cashIn > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-black uppercase">{t.cashIn}</span>
                  <span className="text-xl font-mono font-bold text-blue-600">+{shiftTotals.cashIn.toFixed(2)}</span>
                </div>
              )}
              {shiftTotals.cashOut > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-black uppercase">{t.cashOut}</span>
                  <span className="text-xl font-mono font-bold text-red-600">-{shiftTotals.cashOut.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t border-dashed border-orange-100  my-2"></div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-black uppercase">{t.expectedCash}</span>
                <span className="text-3xl font-mono font-black">{shiftTotals.expected.toFixed(2)} <span className="text-xs opacity-50">{t.currency}</span></span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <button
                onClick={() => { setCashMovementType('IN'); setShowCashMovementModal(true); }}
                className="py-4 bg-white text-blue-600 border border-blue-200 rounded-2xl font-bold  transition-all"
              >
                {t.cashIn}
              </button>
              <button
                onClick={() => { setCashMovementType('OUT'); setShowCashMovementModal(true); }}
                className="py-4 bg-white text-red-600 border border-red-200 rounded-2xl font-bold  transition-all"
              >
                {t.cashOut}
              </button>
            </div>

            <button
              onClick={() => setShowCloseShiftModal(true)}
              className="w-full py-4 bg-orange-600 text-white rounded-2xl font-bold  transition-all active:scale-95 shadow-lg mb-3"
            >
              {t.closeShift}
            </button>

            <button
              onClick={() => setShowShiftDetails(false)}
              className="w-full py-4 bg-white  text-black  rounded-2xl font-bold  transition-all active:scale-95"
            >
              {t.close}
            </button>
          </div>
        </div>
      )}

      {/* Cash Movement Modal */}
      {showCashMovementModal && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-xl z-[510] flex items-center justify-center p-4">
          <div className="bg-white  rounded-[40px] max-w-sm w-full p-8 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-xl font-black mb-6">
              {cashMovementType === 'IN' ? t.cashIn : t.cashOut}
            </h3>
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-xs font-bold text-black uppercase mb-2 block">{t.amount}</label>
                <input
                  type="number"
                  autoFocus
                  value={cashMovementAmount}
                  onChange={e => setCashMovementAmount(e.target.value)}
                  className="w-full bg-white  border-none rounded-2xl px-4 py-3 font-mono font-bold text-xl outline-none focus:ring-2 focus:ring-orange-600"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-black uppercase mb-2 block">{t.reason}</label>
                <input
                  type="text"
                  value={cashMovementReason}
                  onChange={e => setCashMovementReason(e.target.value)}
                  className="w-full bg-white  border-none rounded-2xl px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-orange-600"
                  placeholder={t.cashMovementReasonPlaceholder}
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCashMovementModal(false)}
                className="flex-1 py-3 bg-white text-black rounded-xl font-bold hover"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleCashMovement}
                disabled={!cashMovementAmount || !cashMovementReason || isProcessing}
                className={`flex-1 py-3 text-white rounded-xl font-bold shadow-lg disabled:opacity-50 ${cashMovementType === 'IN' ? 'bg-white text-blue-600 border-2 border-blue-600 hover:bg-blue-50' : 'bg-white text-red-600 border-2 border-red-600 hover:bg-red-50'}`}
              >
                {t.confirm}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Shift Modal */}
      {showCloseShiftModal && (
        <div className="fixed inset-0 bg-white/90 backdrop-blur-xl z-[520] flex items-center justify-center p-4">
          <div className="bg-white  rounded-[48px] max-w-md w-full p-10 shadow-2xl animate-in zoom-in-95 border border-orange-100 ">
            {!shiftReport ? (
              <>
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-black mb-2">{t.closeShift}</h3>
                  <p className="text-xs text-black font-bold uppercase tracking-widest">{t.countActualCash}</p>
                </div>

                <div className="space-y-4 mb-8">
                  <div>
                    <label className="text-xs font-bold text-black uppercase mb-2 block">{t.actualCashCount}</label>
                    <input
                      type="number"
                      autoFocus
                      value={actualCash}
                      onChange={e => setActualCash(e.target.value)}
                      className="w-full bg-white  border-none rounded-2xl px-6 py-5 font-mono font-black text-4xl text-black outline-none focus:ring-2 focus:ring-orange-600 text-center"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-black uppercase mb-2 block">{t.notes}</label>
                    <textarea
                      value={closingNotes}
                      onChange={e => setClosingNotes(e.target.value)}
                      className="w-full bg-white  border-none rounded-2xl px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-orange-600 h-24 resize-none"
                      placeholder={t.notesPlaceholder}
                    />
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => setShowCloseShiftModal(false)}
                    className="flex-1 py-4 bg-white text-black rounded-2xl font-bold  transition-all"
                  >
                    {t.cancel}
                  </button>
                  <button
                    onClick={handleCloseShiftCheck}
                    disabled={!actualCash}
                    className="flex-[2] py-4 bg-orange-600 text-white rounded-2xl font-bold shadow-xl  transition-all disabled:opacity-50"
                  >
                    {t.next}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-center mb-6">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border ${Math.abs(shiftReport.discrepancy) < 0.5 ? 'bg-white text-green-600 border-green-200' : 'bg-white text-red-600 border-red-200'}`}>
                    {Math.abs(shiftReport.discrepancy) < 0.5 ? <CheckCircle2 size={32} /> : <AlertTriangle size={32} />}
                  </div>
                  <h3 className="text-xl font-black">{t.shiftSummary}</h3>
                </div>

                <div className="bg-white  p-6 rounded-[32px] mb-8 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-xs font-bold text-black uppercase">{t.expectedBalance}</span>
                    <span className="font-mono font-bold">{shiftReport.expected.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs font-bold text-black uppercase">{t.actualCount}</span>
                    <span className="font-mono font-bold">{shiftReport.actual.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-dashed border-orange-100 my-2"></div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-black uppercase">{t.discrepancy}</span>
                    <span className={`text-2xl font-mono font-black ${Math.abs(shiftReport.discrepancy) > 0.5 ? 'text-red-600' : 'text-green-600'}`}>
                      {shiftReport.discrepancy > 0 ? '+' : ''}{shiftReport.discrepancy.toFixed(2)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={confirmCloseShift}
                  className={`w-full py-4 rounded-2xl font-bold shadow-xl transition-all ${Math.abs(shiftReport.discrepancy) > 0.5 ? 'bg-white text-red-600 border-2 border-red-600 hover:bg-red-50' : 'bg-orange-600 text-white hover'}`}
                >
                  {t.confirmCloseShift}
                </button>
                <button
                  onClick={() => setShiftReport(null)}
                  className="w-full mt-3 py-3 text-black font-bold text-sm hover"
                >
                  {t.back}
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {/* Customer Search / Quick Add Modal */}
      {showCustomerSearch && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[32px] w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-white/20">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-orange-50/50">
              <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
                <UserIcon className="text-orange-600" />
                {t.searchCustomers || 'Select Customer'}
              </h3>
              <button onClick={() => { setShowCustomerSearch(false); setCustomerSearchQuery(''); }} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-white rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder={t.searchByPhone || "Search by phone or name..."}
                  value={customerSearchQuery}
                  onChange={(e) => setCustomerSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-orange-600 focus:bg-white transition-all text-lg font-medium"
                  autoFocus
                />
                {isSearchingCustomer && (
                  <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 text-orange-600 animate-spin" size={20} />
                )}
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-2">
                {customerSearchResults.map(customer => (
                  <button
                    key={customer.id}
                    onClick={() => {
                      setSelectedCustomer(customer);
                      setShowCustomerSearch(false);
                      setCustomerSearchQuery('');
                    }}
                    className="w-full text-left p-4 rounded-xl border border-gray-100 hover:border-orange-300 hover:bg-orange-50/30 transition-all flex items-center justify-between group"
                  >
                    <div>
                      <p className="font-bold text-gray-900 group-hover:text-orange-700 transition-colors">{customer.full_name}</p>
                      <p className="text-sm text-gray-500 font-mono mt-1">{customer.phone}</p>
                    </div>
                    <ChevronDown className="text-gray-300 group-hover:text-orange-500 -rotate-90 transition-transform" />
                  </button>
                ))}

                {customerSearchQuery.length >= 3 && customerSearchResults.length === 0 && !isSearchingCustomer && (
                  <div className="text-center py-8">
                    <UserIcon size={48} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500 font-medium mb-4">No customers found</p>
                    <button
                      onClick={async () => {
                        setIsSearchingCustomer(true);
                        try {
                          // Quick creating customer with just phone
                          const isPhone = /^\d+$/.test(customerSearchQuery);
                          const newCustomer = await crmService.createCustomer({
                            full_name: isPhone ? 'New Customer' : customerSearchQuery,
                            phone: isPhone ? customerSearchQuery : '0000000000',
                          });
                          setSelectedCustomer(newCustomer);
                          setShowCustomerSearch(false);
                          setCustomerSearchQuery('');
                        } catch (err: any) {
                          if (err.code === '23505') alert('Phone already exists.');
                          else alert('Failed to create an empty profile.');
                        } finally {
                          setIsSearchingCustomer(false);
                        }
                      }}
                      className="px-6 py-2 bg-orange-100 text-orange-700 font-bold rounded-xl hover:bg-orange-200 transition-colors"
                    >
                      {t.quickAddCustomer || 'Quick Add as New'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default POSView;
