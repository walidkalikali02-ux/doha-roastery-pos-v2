type ExportColumn = { label: string };
type ExportSection = { title: string; columns: ExportColumn[]; rows: Array<Array<string | number | null | undefined>> };

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildHtml = (title: string, sections: ExportSection[]) => {
  const safeTitle = escapeHtml(title);
  const body = sections
    .map((section) => {
      const sectionTitle = escapeHtml(section.title);
      const headerRow = section.columns
        .map((col) => `<th>${escapeHtml(col.label)}</th>`)
        .join('');
      const rows = section.rows
        .map((row) => {
          const cells = row
            .map((cell) => `<td>${escapeHtml(cell === null || cell === undefined ? '' : String(cell))}</td>`)
            .join('');
          return `<tr>${cells}</tr>`;
        })
        .join('');
      return `
        <section>
          <h2>${sectionTitle}</h2>
          <table>
            <thead><tr>${headerRow}</tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </section>
      `;
    })
    .join('');

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${safeTitle}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 24px; color: #1c1917; }
          h1 { font-size: 20px; margin-bottom: 16px; }
          h2 { font-size: 16px; margin: 24px 0 8px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #e7e5e4; padding: 6px 8px; text-align: left; font-size: 12px; }
          th { background: #f5f5f4; font-weight: 700; }
          tr:nth-child(even) td { background: #fafaf9; }
        </style>
      </head>
      <body>
        <h1>${safeTitle}</h1>
        ${body}
      </body>
    </html>
  `;
};

export const exportExcelHtml = (filename: string, title: string, sections: ExportSection[]) => {
  const html = buildHtml(title, sections);
  const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const exportPdfPrint = (title: string, sections: ExportSection[]) => {
  const html = buildHtml(title, sections);
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 250);
};

export type InvoiceExportPeriod = 'day' | 'week' | 'month';

export interface InvoiceExportData {
  invoiceNumber: string;
  date: string;
  time: string;
  cashierName: string;
  customerName: string;
  items: string;
  subtotal: number;
  vatAmount: number;
  discountAmount: number;
  total: number;
  paymentMethod: string;
  branchName: string;
  status: string;
}

const getDateRange = (period: InvoiceExportPeriod, referenceDate?: Date): { start: Date; end: Date } => {
  const now = referenceDate || new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch (period) {
    case 'day':
      return { start: today, end: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1) };
    case 'week': {
      const dayOfWeek = today.getDay();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - dayOfWeek);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);
      return { start: startOfWeek, end: endOfWeek };
    }
    case 'month': {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      endOfMonth.setHours(23, 59, 59, 999);
      return { start: startOfMonth, end: endOfMonth };
    }
  }
};

const formatInvoiceItems = (items: any[]): string => {
  return items.map(item => {
    const qty = item.quantity || 1;
    const name = item.name || 'Unknown';
    const price = (item.price || 0) * qty;
    const customizations = item.selectedCustomizations 
      ? ` (${item.selectedCustomizations.size || ''} ${item.selectedCustomizations.milkType || ''} ${item.selectedCustomizations.sugarLevel || ''})`
      : '';
    return `${qty}x ${name}${customizations} - ${price.toFixed(2)}`;
  }).join(' | ');
};

export const prepareInvoiceExportData = (transactions: any[]): InvoiceExportData[] => {
  return transactions
    .filter(tx => !tx.is_returned)
    .map(tx => ({
      invoiceNumber: tx.id || '-',
      date: tx.timestamp ? new Date(tx.timestamp).toLocaleDateString() : (tx.created_at ? new Date(tx.created_at).toLocaleDateString() : '-'),
      time: tx.timestamp ? new Date(tx.timestamp).toLocaleTimeString() : (tx.created_at ? new Date(tx.created_at).toLocaleTimeString() : '-'),
      cashierName: tx.cashier_name || '-',
      customerName: tx.customer_name || '-',
      items: formatInvoiceItems(tx.items || []),
      subtotal: tx.subtotal || tx.total || 0,
      vatAmount: tx.vat_amount || 0,
      discountAmount: tx.discount_amount || 0,
      total: tx.total || 0,
      paymentMethod: tx.paymentMethod || tx.payment_method || '-',
      branchName: tx.branch_name || '-',
      status: tx.is_returned ? 'Returned' : 'Completed'
    }));
};

export const exportInvoicesToExcel = (
  filename: string,
  transactions: any[],
  periodLabel: string
) => {
  const data = prepareInvoiceExportData(transactions);
  
  const sections: ExportSection[] = [{
    title: `${periodLabel}`,
    columns: [
      { label: 'Invoice #' },
      { label: 'Date' },
      { label: 'Time' },
      { label: 'Cashier' },
      { label: 'Customer' },
      { label: 'Items' },
      { label: 'Subtotal' },
      { label: 'VAT' },
      { label: 'Discount' },
      { label: 'Total' },
      { label: 'Payment' },
      { label: 'Branch' },
      { label: 'Status' }
    ],
    rows: data.map(inv => [
      inv.invoiceNumber,
      inv.date,
      inv.time,
      inv.cashierName,
      inv.customerName,
      inv.items,
      inv.subtotal,
      inv.vatAmount,
      inv.discountAmount,
      inv.total,
      inv.paymentMethod,
      inv.branchName,
      inv.status
    ])
  }];

  const title = `Invoices - ${periodLabel}`;
  const html = buildHtml(title, sections);
  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const fetchInvoicesByPeriod = async (
  supabase: any,
  period: InvoiceExportPeriod,
  referenceDate?: Date,
  locationId?: string
): Promise<any[]> => {
  const { start, end } = getDateRange(period, referenceDate);
  
  let query = supabase
    .from('transactions')
    .select('*')
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())
    .order('created_at', { ascending: false });
  
  if (locationId) {
    query = query.eq('location_id', locationId);
  }
  
  const { data, error } = await query;
  
  if (error) throw error;
  return data || [];
};

export const getPeriodDateRange = getDateRange;
