// CocoaTrack V2 - Export Service
// Client-side service for exporting data to PDF and Excel

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export interface ExportColumn {
  header: string;
  key: string;
  width?: number;
  format?: (value: any) => string;
}

export interface ExportOptions {
  title: string;
  subtitle?: string;
  filename: string;
  columns: ExportColumn[];
  data: any[];
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    search?: string;
  };
  totals?: Record<string, number | string>;
}

/**
 * Format a date for display
 */
function formatDate(date: string | undefined): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('fr-FR');
}

/**
 * Export data to PDF
 */
export function exportToPDF(options: ExportOptions): void {
  const { title, subtitle, filename, columns, data, filters, totals } = options;
  
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header
  doc.setFontSize(18);
  doc.setTextColor(35, 77, 30); // CocoaTrack green
  doc.text(title, pageWidth / 2, 20, { align: 'center' });
  
  if (subtitle) {
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(subtitle, pageWidth / 2, 28, { align: 'center' });
  }
  
  // Filters info
  let yPos = subtitle ? 35 : 30;
  if (filters && (filters.dateFrom || filters.dateTo || filters.search)) {
    doc.setFontSize(10);
    doc.setTextColor(80);
    
    const filterParts: string[] = [];
    if (filters.dateFrom) filterParts.push(`Du: ${formatDate(filters.dateFrom)}`);
    if (filters.dateTo) filterParts.push(`Au: ${formatDate(filters.dateTo)}`);
    if (filters.search) filterParts.push(`Recherche: ${filters.search}`);
    
    doc.text(`Filtres: ${filterParts.join(' | ')}`, 14, yPos);
    yPos += 8;
  }
  
  // Generation date
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, 14, yPos);
  yPos += 10;
  
  // Table
  const tableColumns = columns.map(col => col.header);
  const tableData = data.map(row => 
    columns.map(col => {
      const value = row[col.key];
      return col.format ? col.format(value) : (value ?? '-');
    })
  );
  
  autoTable(doc, {
    head: [tableColumns],
    body: tableData,
    startY: yPos,
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [35, 77, 30], // CocoaTrack green
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [245, 247, 245],
    },
    margin: { left: 14, right: 14 },
  });
  
  // Totals
  if (totals) {
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'bold');
    
    let totalText = 'Totaux: ';
    const totalParts = Object.entries(totals).map(([key, value]) => `${key}: ${value}`);
    totalText += totalParts.join(' | ');
    
    doc.text(totalText, 14, finalY);
  }
  
  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `CocoaTrack - Page ${i}/${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }
  
  doc.save(`${filename}.pdf`);
}

/**
 * Export data to Excel
 */
export function exportToExcel(options: ExportOptions): void {
  const { title, filename, columns, data, filters, totals } = options;
  
  // Prepare header rows
  const headerRows: any[][] = [];
  
  // Title
  headerRows.push([title]);
  headerRows.push([]);
  
  // Filters
  if (filters && (filters.dateFrom || filters.dateTo || filters.search)) {
    const filterParts: string[] = [];
    if (filters.dateFrom) filterParts.push(`Du: ${formatDate(filters.dateFrom)}`);
    if (filters.dateTo) filterParts.push(`Au: ${formatDate(filters.dateTo)}`);
    if (filters.search) filterParts.push(`Recherche: ${filters.search}`);
    headerRows.push([`Filtres: ${filterParts.join(' | ')}`]);
  }
  
  // Generation date
  headerRows.push([`Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`]);
  headerRows.push([]);
  
  // Column headers
  headerRows.push(columns.map(col => col.header));
  
  // Data rows
  const dataRows = data.map(row => 
    columns.map(col => {
      const value = row[col.key];
      return col.format ? col.format(value) : (value ?? '');
    })
  );
  
  // Totals row
  if (totals) {
    dataRows.push([]);
    const totalRow = columns.map((col, index) => {
      if (index === 0) return 'TOTAUX';
      const totalKey = Object.keys(totals).find(k => 
        col.header.toLowerCase().includes(k.toLowerCase()) ||
        col.key.toLowerCase().includes(k.toLowerCase())
      );
      return totalKey ? totals[totalKey] : '';
    });
    dataRows.push(totalRow);
  }
  
  // Combine all rows
  const allRows = [...headerRows, ...dataRows];
  
  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(allRows);
  
  // Set column widths
  const colWidths = columns.map(col => ({ wch: col.width || 15 }));
  ws['!cols'] = colWidths;
  
  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Données');
  
  // Save file
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/**
 * Format weight for export
 */
export function formatWeight(kg: number | null | undefined): string {
  if (kg === null || kg === undefined) return '-';
  return `${kg.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} kg`;
}

/**
 * Format percentage for export
 */
export function formatPercentage(pct: number | null | undefined): string {
  if (pct === null || pct === undefined) return '-';
  return `${pct.toFixed(1)}%`;
}
