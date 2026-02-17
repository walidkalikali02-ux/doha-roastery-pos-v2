import { supabase } from '../supabaseClient';
import { Shift, Transaction, CashMovement } from '../types';

const DEMO_USER_UUID = '00000000-0000-0000-0000-000000000000';

const resolveUserId = (userId: string) => {
  return userId === 'demo-user' ? DEMO_USER_UUID : userId;
};

export const shiftService = {
  async getOpenShift(userId: string): Promise<Shift | null> {
    const validUserId = resolveUserId(userId);
    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .eq('cashier_id', validUserId)
      .eq('status', 'OPEN')
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 is "Row not found"
      console.error('Error fetching open shift:', error);
      throw error;
    }
    
    return data || null;
  },

  async startShift(userId: string, userName: string, initialCash: number): Promise<Shift> {
    const validUserId = resolveUserId(userId);
    const newShift = {
      cashier_id: validUserId,
      cashier_name: userName,
      start_time: new Date().toISOString(),
      initial_cash: initialCash,
      status: 'OPEN',
      total_cash_sales: 0,
      total_cash_returns: 0
    };

    const { data, error } = await supabase
      .from('shifts')
      .insert([newShift])
      .select()
      .single();

    if (error) {
      console.error('Error starting shift:', error);
      throw error;
    }

    return data;
  },

  async closeShift(shiftId: string, actualCash: number, sales: number, returns: number, notes?: string): Promise<Shift> {
    const { data, error } = await supabase
      .from('shifts')
      .update({
        end_time: new Date().toISOString(),
        status: 'CLOSED',
        actual_cash: actualCash,
        total_cash_sales: sales,
        total_cash_returns: returns,
        notes: notes
      })
      .eq('id', shiftId)
      .select()
      .single();

    if (error) {
      console.error('Error closing shift:', error);
      throw error;
    }

    return data;
  },

  async addCashMovement(
    shiftId: string, 
    type: 'IN' | 'OUT', 
    amount: number, 
    reason: string,
    userId: string,
    userName: string
  ): Promise<CashMovement> {
    const validUserId = resolveUserId(userId);
    const movement = {
      shift_id: shiftId,
      type,
      amount,
      reason,
      created_at: new Date().toISOString(),
      created_by_id: validUserId,
      created_by_name: userName
    };

    const { data, error } = await supabase
      .from('cash_movements')
      .insert([movement])
      .select()
      .single();

    if (error) {
      console.error('Error adding cash movement:', error);
      throw error;
    }

    return data;
  },

  async getShiftTotals(shift: Shift): Promise<{ sales: number; returns: number; cashIn: number; cashOut: number; expected: number }> {
    // 1. Get Cash Sales (Transactions)
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .gte('created_at', shift.start_time)
      // If the shift is closed, we should limit by end_time, but here we assume active shift for tracking
      .order('created_at', { ascending: true });

    if (txError) throw txError;

    // Filter by cashier if needed, but usually we want all transactions in the drawer
    // Assuming 1 drawer per machine, filtering by cashier might be safer if multiple share one machine
    const myTransactions = transactions?.filter(tx => tx.cashier_name === shift.cashier_name) || [];

    let cashSales = 0;
    
    myTransactions.forEach((tx: Transaction) => {
      if (tx.paymentMethod === 'CASH') {
        cashSales += tx.total;
      } else if (tx.paymentMethod === 'SPLIT' && tx.paymentBreakdown) {
        cashSales += tx.paymentBreakdown.cash || 0;
      }
    });

    // 2. Get Cash Movements (In/Out)
    let cashIn = 0;
    let cashOut = 0;

    try {
      const { data: movements, error: movError } = await supabase
        .from('cash_movements')
        .select('*')
        .eq('shift_id', shift.id);

      if (movError) {
        // If table doesn't exist, we'll get an error. We should log it but not crash.
        console.warn('Failed to fetch cash movements (feature might be disabled):', movError);
      } else {
        movements?.forEach((m: CashMovement) => {
          if (m.type === 'IN') cashIn += m.amount;
          else if (m.type === 'OUT') cashOut += m.amount;
        });
      }
    } catch (e) {
      console.warn('Exception fetching cash movements:', e);
    }
    
    // Calculation: Initial + Sales + CashIn - CashOut
    const expected = shift.initial_cash + cashSales + cashIn - cashOut;

    return {
      sales: cashSales,
      returns: 0, 
      cashIn,
      cashOut,
      expected
    };
  }
};
