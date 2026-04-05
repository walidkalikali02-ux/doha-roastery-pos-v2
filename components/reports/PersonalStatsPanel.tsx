import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { ShoppingCart, Calendar, Clock } from 'lucide-react';

interface PersonalStatsPanelProps {
  userId: string;
  userName: string;
  t: Record<string, string>;
}

interface SalesStats {
  todayCount: number;
  todayAmount: number;
  weekCount: number;
  weekAmount: number;
}

interface ShiftRecord {
  id: string;
  start_time: string;
  end_time: string | null;
  initial_cash: number;
  actual_cash: number | null;
  status: string;
}

interface TransactionRecord {
  id: string;
  created_at: string;
  total: number;
  payment_method: string;
  items: any[];
}

export function PersonalStatsPanel({ userId, userName, t }: PersonalStatsPanelProps) {
  const [stats, setStats] = useState<SalesStats | null>(null);
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      if (!userId || !userName) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        weekAgo.setHours(0, 0, 0, 0);

        const todayTransactions = await supabase
          .from('transactions')
          .select('total')
          .eq('cashier_name', userName)
          .gte('created_at', today.toISOString());

        const weekTransactions = await supabase
          .from('transactions')
          .select('total')
          .eq('cashier_name', userName)
          .gte('created_at', weekAgo.toISOString());

        const { data: shiftData, error: shiftError } = await supabase
          .from('shifts')
          .select('*')
          .eq('cashier_id', userId)
          .order('start_time', { ascending: false })
          .limit(10);

        if (shiftError) {
          console.warn('Failed to fetch shifts:', shiftError);
        }

        const { data: txData, error: txError } = await supabase
          .from('transactions')
          .select('*')
          .eq('cashier_name', userName)
          .order('created_at', { ascending: false })
          .limit(50);

        if (txError) {
          console.warn('Failed to fetch transactions:', txError);
        } else {
          setTransactions((txData || []) as TransactionRecord[]);
        }

        const todayData = todayTransactions.data || [];
        const weekData = weekTransactions.data || [];

        setStats({
          todayCount: todayData.length,
          todayAmount: todayData.reduce((sum: number, s: { total: number }) => sum + (s.total || 0), 0),
          weekCount: weekData.length,
          weekAmount: weekData.reduce((sum: number, s: { total: number }) => sum + (s.total || 0), 0),
        });

        setShifts((shiftData || []) as ShiftRecord[]);
      } catch (err) {
        console.error('Error fetching personal stats:', err);
        setError(t.errorLoading || 'Failed to load statistics');
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [userId, userName, t.errorLoading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-6 text-center">
        <p className="text-orange-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-orange-600 text-white rounded-2xl">
          <ShoppingCart size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-stone-900">{t.personalStats || 'My Stats'}</h2>
          <p className="text-sm text-stone-500">{t.totalSalesToday || 'Total Sales Today'}</p>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl p-6 border border-orange-100 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Calendar size={18} className="text-orange-600" />
              <span className="text-sm font-bold text-stone-500 uppercase">{t.totalSalesToday || 'Today'}</span>
            </div>
            <div className="text-3xl font-bold text-stone-900">
              {stats.todayCount}
            </div>
            <div className="text-sm text-stone-500">
              {t.noTransactions || 'transactions'}
            </div>
            <div className="mt-2 text-lg font-semibold text-orange-600">
              {stats.todayAmount.toFixed(2)} {t.currency || 'QAR'}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-orange-100 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Calendar size={18} className="text-orange-600" />
              <span className="text-sm font-bold text-stone-500 uppercase">{t.totalSalesThisWeek || 'This Week'}</span>
            </div>
            <div className="text-3xl font-bold text-stone-900">
              {stats.weekCount}
            </div>
            <div className="text-sm text-stone-500">
              {t.noTransactions || 'transactions'}
            </div>
            <div className="mt-2 text-lg font-semibold text-orange-600">
              {stats.weekAmount.toFixed(2)} {t.currency || 'QAR'}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl p-6 border border-orange-100 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={18} className="text-orange-600" />
          <span className="text-lg font-bold text-stone-900">{t.shiftHistory || 'Shift History'}</span>
        </div>

        {shifts.length === 0 ? (
          <p className="text-stone-500 text-center py-4">{t.noShiftHistory || 'No shift history available'}</p>
        ) : (
          <div className="space-y-3">
            {shifts.slice(0, 5).map(shift => (
              <div key={shift.id} className="flex justify-between items-center p-3 bg-stone-50 rounded-xl">
                <div>
                  <div className="font-semibold text-stone-900">
                    {new Date(shift.start_time).toLocaleDateString()}
                  </div>
                  <div className="text-xs text-stone-500">
                    {shift.status === 'OPEN' ? (t.openShift || 'Open') : (t.closeShift || 'Closed')}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-stone-900">
                    {(shift.actual_cash || shift.initial_cash).toFixed(2)} {t.currency || 'QAR'}
                  </div>
                  <div className="text-xs text-stone-500">
                    {shift.initial_cash.toFixed(2)} {t.currency || 'QAR'} {t.cashDrawerFloat || 'float'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl p-6 border border-orange-100 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <ShoppingCart size={18} className="text-orange-600" />
          <span className="text-lg font-bold text-stone-900">{t.allSales || 'All Sales'}</span>
        </div>

        {transactions.length === 0 ? (
          <p className="text-stone-500 text-center py-4">{t.noSalesRecorded || 'No sales recorded'}</p>
        ) : (
          <div className="space-y-3">
            {transactions.map(tx => (
              <div key={tx.id} className="flex justify-between items-center p-3 bg-stone-50 rounded-xl">
                <div>
                  <div className="font-semibold text-stone-900">
                    {new Date(tx.created_at).toLocaleDateString()} {new Date(tx.created_at).toLocaleTimeString()}
                  </div>
                  <div className="text-xs text-stone-500">
                    {tx.payment_method || 'N/A'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-orange-600">
                    {tx.total.toFixed(2)} {t.currency || 'QAR'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}