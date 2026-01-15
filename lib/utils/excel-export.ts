/**
 * Excel Export Utility
 * Provides functions to export data to Excel format (.xlsx)
 */

import * as XLSX from 'xlsx';

export interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
}

export interface ExcelExportOptions {
  filename: string;
  sheetName?: string;
  columns: ExcelColumn[];
}

/**
 * Export data to Excel file and trigger download
 */
export function exportToExcel<T extends Record<string, unknown>>(
  data: T[],
  options: ExcelExportOptions
): void {
  const { filename, sheetName = 'Data', columns } = options;

  // Transform data to match column headers
  const rows = data.map((item) => {
    const row: Record<string, unknown> = {};
    columns.forEach((col) => {
      row[col.header] = formatCellValue(item[col.key]);
    });
    return row;
  });

  // Create worksheet
  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Set column widths
  const colWidths = columns.map((col) => ({ wch: col.width || 15 }));
  worksheet['!cols'] = colWidths;

  // Create workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Generate file and trigger download
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

/**
 * Format cell value for Excel
 */
function formatCellValue(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) {
    return '';
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return value as string | number | boolean;
}

/**
 * Export audit logs to Excel
 */
export function exportAuditLogsToExcel(
  logs: Array<{
    id: string;
    created_at: string;
    actor_name: string;
    actor_email: string | null;
    actor_type: string;
    table_name: string;
    row_id: string;
    action: string;
    ip_address: string | null;
    old_data: Record<string, unknown> | null;
    new_data: Record<string, unknown> | null;
  }>,
  formatChanges: (action: 'INSERT' | 'UPDATE' | 'DELETE', oldData: Record<string, unknown> | null, newData: Record<string, unknown> | null) => string
): void {
  const data = logs.map((log) => ({
    id: log.id,
    date: new Date(log.created_at).toLocaleString('fr-FR'),
    actor_name: log.actor_name || 'Système',
    actor_email: log.actor_email || '',
    actor_type: log.actor_type,
    table_name: log.table_name,
    row_id: log.row_id,
    action: log.action,
    ip_address: log.ip_address || '',
    changes: formatChanges(log.action as 'INSERT' | 'UPDATE' | 'DELETE', log.old_data, log.new_data),
  }));

  exportToExcel(data, {
    filename: `audit-logs-${new Date().toISOString().split('T')[0]}`,
    sheetName: 'Audit Logs',
    columns: [
      { header: 'ID', key: 'id', width: 36 },
      { header: 'Date/Heure', key: 'date', width: 20 },
      { header: 'Utilisateur', key: 'actor_name', width: 25 },
      { header: 'Email', key: 'actor_email', width: 30 },
      { header: 'Type', key: 'actor_type', width: 12 },
      { header: 'Table', key: 'table_name', width: 15 },
      { header: 'ID Enregistrement', key: 'row_id', width: 36 },
      { header: 'Action', key: 'action', width: 12 },
      { header: 'Adresse IP', key: 'ip_address', width: 15 },
      { header: 'Modifications', key: 'changes', width: 50 },
    ],
  });
}

/**
 * Export deliveries to Excel
 */
export function exportDeliveriesToExcel(
  deliveries: Array<{
    id: string;
    delivery_number: string;
    delivery_date: string;
    planteur_name: string;
    chef_planteur_name: string;
    quantity_kg: number;
    quality_grade: string;
    status: string;
    warehouse_name: string;
  }>
): void {
  exportToExcel(deliveries, {
    filename: `livraisons-${new Date().toISOString().split('T')[0]}`,
    sheetName: 'Livraisons',
    columns: [
      { header: 'Numéro', key: 'delivery_number', width: 15 },
      { header: 'Date', key: 'delivery_date', width: 12 },
      { header: 'Planteur', key: 'planteur_name', width: 25 },
      { header: 'Chef Planteur', key: 'chef_planteur_name', width: 25 },
      { header: 'Quantité (kg)', key: 'quantity_kg', width: 15 },
      { header: 'Qualité', key: 'quality_grade', width: 12 },
      { header: 'Statut', key: 'status', width: 12 },
      { header: 'Entrepôt', key: 'warehouse_name', width: 20 },
    ],
  });
}

/**
 * Export planteurs to Excel
 */
export function exportPlanteursToExcel(
  planteurs: Array<{
    code: string;
    full_name: string;
    phone: string | null;
    village: string | null;
    chef_planteur_name: string | null;
    total_deliveries: number;
    total_quantity_kg: number;
    status: string;
  }>
): void {
  exportToExcel(planteurs, {
    filename: `planteurs-${new Date().toISOString().split('T')[0]}`,
    sheetName: 'Planteurs',
    columns: [
      { header: 'Code', key: 'code', width: 12 },
      { header: 'Nom Complet', key: 'full_name', width: 30 },
      { header: 'Téléphone', key: 'phone', width: 15 },
      { header: 'Village', key: 'village', width: 20 },
      { header: 'Chef Planteur', key: 'chef_planteur_name', width: 25 },
      { header: 'Livraisons', key: 'total_deliveries', width: 12 },
      { header: 'Total (kg)', key: 'total_quantity_kg', width: 12 },
      { header: 'Statut', key: 'status', width: 12 },
    ],
  });
}

/**
 * Export invoices to Excel
 */
export function exportInvoicesToExcel(
  invoices: Array<{
    invoice_number: string;
    invoice_date: string;
    planteur_name: string;
    total_quantity_kg: number;
    price_per_kg: number;
    total_amount: number;
    status: string;
    payment_date: string | null;
  }>
): void {
  exportToExcel(invoices, {
    filename: `factures-${new Date().toISOString().split('T')[0]}`,
    sheetName: 'Factures',
    columns: [
      { header: 'Numéro', key: 'invoice_number', width: 15 },
      { header: 'Date', key: 'invoice_date', width: 12 },
      { header: 'Planteur', key: 'planteur_name', width: 30 },
      { header: 'Quantité (kg)', key: 'total_quantity_kg', width: 15 },
      { header: 'Prix/kg (FCFA)', key: 'price_per_kg', width: 15 },
      { header: 'Montant (FCFA)', key: 'total_amount', width: 18 },
      { header: 'Statut', key: 'status', width: 12 },
      { header: 'Date Paiement', key: 'payment_date', width: 15 },
    ],
  });
}
