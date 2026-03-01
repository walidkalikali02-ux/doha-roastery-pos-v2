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
