// Export utilities — Excel (SheetJS) + PDF (expo-print + expo-sharing)
// Matches web's EXD() pattern and PDF generation approach
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as XLSX from 'xlsx';
import { Alert } from 'react-native';

// ─── Excel Export (SheetJS) ────────────────────────────────────────────────────
// Usage: exportToExcel(data, columns, 'contracts_2025')
// columns: [{ key: 'invoice', label: 'Invoice #' }, ...]
export const exportToExcel = async (data, columns, filename = 'export') => {
  try {
    // Build header row
    const header = columns.map(c => c.label);

    // Build data rows
    const rows = data.map(item =>
      columns.map(c => {
        const val = item[c.key];
        if (val === null || val === undefined) return '';
        return typeof val === 'object' ? JSON.stringify(val) : val;
      })
    );

    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);

    // Auto-width columns
    const colWidths = columns.map((c, i) => ({
      wch: Math.max(
        c.label.length,
        ...rows.map(r => String(r[i] || '').length)
      ) + 2,
    }));
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');

    const xlsxData = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

    // Use expo-sharing to share the file
    const fileUri = `${FileSystem.documentDirectory || ''}${filename}.xlsx`;

    // Write to temp file
    await FileSystem.writeAsStringAsync(fileUri, xlsxData, {
      encoding: FileSystem.EncodingType.Base64,
    });

    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: `Export ${filename}`,
      UTI: 'com.microsoft.excel.xlsx',
    });

    return true;
  } catch (e) {
    console.error('exportToExcel:', e);
    Alert.alert('Export Error', 'Failed to export Excel file. Please try again.');
    return false;
  }
};

// ─── PDF Export (expo-print) ───────────────────────────────────────────────────
// Usage: exportToPDF(htmlString, 'contract_001')
export const exportToPDF = async (html, filename = 'document') => {
  try {
    const { uri } = await Print.printToFileAsync({ html, base64: false });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Share ${filename}`,
        UTI: 'com.adobe.pdf',
      });
    } else {
      await Print.printAsync({ uri });
    }

    return true;
  } catch (e) {
    console.error('exportToPDF:', e);
    Alert.alert('Export Error', 'Failed to generate PDF. Please try again.');
    return false;
  }
};

// ─── Pre-built column configs (matching web's EXD column structures) ──────────

export const CONTRACT_COLUMNS = [
  { key: 'order', label: 'PO#' },
  { key: 'date', label: 'Date' },
  { key: 'supplier', label: 'Supplier' },
  { key: 'origin', label: 'Origin' },
  { key: 'pol', label: 'POL' },
  { key: 'pod', label: 'POD' },
  { key: 'packing', label: 'Packing' },
  { key: 'size', label: 'Size' },
  { key: 'qty', label: 'QTY' },
  { key: 'cur', label: 'Currency' },
  { key: 'price', label: 'Price' },
  { key: 'shipmentType', label: 'Shipment Type' },
  { key: 'deliveryTerms', label: 'Delivery Terms' },
  { key: 'status', label: 'Status' },
];

export const INVOICE_COLUMNS = [
  { key: 'invoice', label: 'Invoice#' },
  { key: 'date', label: 'Date' },
  { key: 'client', label: 'Client' },
  { key: 'totalAmount', label: 'Amount' },
  { key: 'cur', label: 'Currency' },
  { key: 'invType', label: 'Type' },
  { key: 'status', label: 'Status' },
  { key: 'prepayment', label: 'Prepayment %' },
  { key: 'balanceDue', label: 'Balance Due' },
  { key: 'etd', label: 'ETD' },
  { key: 'eta', label: 'ETA' },
];

export const EXPENSE_COLUMNS = [
  { key: 'expense', label: 'EXP#' },
  { key: 'date', label: 'Date' },
  { key: 'supplier', label: 'Supplier' },
  { key: 'amount', label: 'Amount' },
  { key: 'cur', label: 'Currency' },
  { key: 'expType', label: 'Type' },
  { key: 'paid', label: 'Paid' },
  { key: 'salesInv', label: 'Sales Inv' },
  { key: 'comments', label: 'Comments' },
];

export const ACCOUNTING_COLUMNS = [
  { key: 'saleInvoice', label: 'Invoice' },
  { key: 'dateInv', label: 'Inv Date' },
  { key: 'clientInvName', label: 'Client' },
  { key: 'amountInv', label: 'Invoice Amt' },
  { key: 'curINV', label: 'Inv Cur' },
  { key: 'invType', label: 'Type' },
  { key: 'expInvoice', label: 'Expense' },
  { key: 'dateExp', label: 'Exp Date' },
  { key: 'clientExpName', label: 'Supplier' },
  { key: 'amountExp', label: 'Expense Amt' },
  { key: 'curEX', label: 'Exp Cur' },
  { key: 'expType', label: 'Exp Type' },
];

export const SHIPMENT_COLUMNS = [
  { key: 'order', label: 'PO#' },
  { key: 'date', label: 'Date' },
  { key: 'supplier', label: 'Supplier' },
  { key: 'pol', label: 'POL' },
  { key: 'pod', label: 'POD' },
  { key: 'shipmentStatus', label: 'Status' },
  { key: 'qty', label: 'QTY' },
  { key: 'packing', label: 'Packing' },
  { key: 'notes', label: 'Notes' },
];

export const MARGIN_COLUMNS = [
  { key: 'date', label: 'Date' },
  { key: 'supplier', label: 'Supplier' },
  { key: 'client', label: 'Client' },
  { key: 'description', label: 'Description' },
  { key: 'totalMargin', label: 'Total Margin' },
  { key: 'marginPct', label: 'Margin %' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'remaining', label: 'Remaining' },
];

// ─── HTML PDF template generator ──────────────────────────────────────────────
export const buildTablePDF = (title, columns, data, summary = '') => {
  const headers = columns.map(c => `<th>${c.label}</th>`).join('');
  const rows = data.map(item => {
    const cells = columns.map(c => `<td>${item[c.key] ?? ''}</td>`).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8"/>
      <style>
        body { font-family: Arial, sans-serif; font-size: 10px; margin: 20px; color: #1a1a2e; }
        h1 { font-size: 16px; color: #0366ae; border-bottom: 2px solid #0366ae; padding-bottom: 6px; }
        .summary { background: #f0f8ff; border: 1px solid #b8ddf8; border-radius: 6px; padding: 8px; margin-bottom: 12px; font-size: 11px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th { background: #0366ae; color: #fff; padding: 6px 8px; text-align: left; font-size: 9px; }
        td { padding: 5px 8px; border-bottom: 1px solid #e3f0fb; font-size: 9px; }
        tr:nth-child(even) { background: #f7fbff; }
        .footer { margin-top: 20px; font-size: 8px; color: #9fb8d4; text-align: center; }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      ${summary ? `<div class="summary">${summary}</div>` : ''}
      <table>
        <thead><tr>${headers}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="footer">Generated by IMS Mobile &bull; ${new Date().toLocaleDateString()}</div>
    </body>
    </html>
  `;
};
