// CocoaTrack V2 - PDF Service
// Generates PDF invoices using jsPDF

import type { InvoiceWithRelations, InvoiceDelivery, InvoiceSummary } from '@/lib/validations/invoice';

// Dynamic import for jsPDF (client-side only)
let jsPDF: typeof import('jspdf').jsPDF | null = null;

async function getJsPDF() {
  if (!jsPDF) {
    const module = await import('jspdf');
    jsPDF = module.jsPDF;
  }
  return jsPDF;
}

// ============================================================================
// CocoaTrack Brand Colors (RGB for jsPDF)
// ============================================================================
const COLORS = {
  // Greens (branding)
  greenDark: [35, 77, 30] as [number, number, number],      // #234D1E
  greenOlive: [74, 107, 31] as [number, number, number],    // #4A6B1F
  greenLight: [111, 175, 61] as [number, number, number],   // #6FAF3D
  
  // Oranges (accents)
  orange: [230, 138, 31] as [number, number, number],       // #E68A1F
  orangeGold: [212, 122, 28] as [number, number, number],   // #D47A1C
  yellowGold: [201, 161, 43] as [number, number, number],   // #C9A12B
  
  // Yellow (logo)
  yellowCacao: [242, 201, 76] as [number, number, number],  // #F2C94C
  
  // Neutrals
  white: [255, 255, 255] as [number, number, number],       // #FFFFFF
  grayLight: [237, 237, 237] as [number, number, number],   // #EDEDED
  grayText: [107, 114, 128] as [number, number, number],    // #6B7280
  textPrimary: [31, 41, 55] as [number, number, number],    // #1F2937
};

// Format currency
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' XAF';
}

// Format date
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export interface GeneratePdfOptions {
  invoice: InvoiceWithRelations;
  deliveries: InvoiceDelivery[];
  summary: InvoiceSummary;
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
}

/**
 * Generate a PDF invoice
 * Returns a Blob that can be downloaded or uploaded
 */
export async function generateInvoicePdf(options: GeneratePdfOptions): Promise<Blob> {
  const {
    invoice,
    deliveries,
    summary,
    companyName = 'CocoaTrack',
    companyAddress = 'Cameroun',
    companyPhone = '',
  } = options;

  const JsPDF = await getJsPDF();
  const doc = new JsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let y = margin;

  // Helper to add new page if needed
  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
      return true;
    }
    return false;
  };

  // ============================================================================
  // HEADER with CocoaTrack branding
  // ============================================================================
  
  // Green header bar
  doc.setFillColor(...COLORS.greenDark);
  doc.rect(0, 0, pageWidth, 15, 'F');
  
  // Orange accent line
  doc.setFillColor(...COLORS.orange);
  doc.rect(0, 15, pageWidth, 3, 'F');
  
  y = 28;
  
  // Company name
  doc.setFontSize(24);
  doc.setTextColor(...COLORS.greenDark);
  doc.setFont('helvetica', 'bold');
  doc.text(companyName, margin, y);
  
  // Invoice title
  doc.setFontSize(20);
  doc.setTextColor(...COLORS.orange);
  doc.text('FACTURE', pageWidth - margin, y, { align: 'right' });
  
  y += 10;
  
  // Company info
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.textPrimary);
  doc.setFont('helvetica', 'normal');
  doc.text(companyAddress, margin, y);
  if (companyPhone) {
    y += 5;
    doc.text(`Tél: ${companyPhone}`, margin, y);
  }
  
  // Invoice info (right side)
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.greenDark);
  doc.text(`N° ${invoice.code}`, pageWidth - margin, y - 5, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.grayText);
  doc.text(`Date: ${formatDate(invoice.created_at)}`, pageWidth - margin, y, { align: 'right' });
  
  y += 15;
  
  // Horizontal line
  doc.setDrawColor(...COLORS.greenOlive);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  
  y += 10;

  // ============================================================================
  // COOPERATIVE INFO
  // ============================================================================
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.greenDark);
  doc.text('Coopérative:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.textPrimary);
  doc.text(invoice.cooperative?.name || '-', margin + 30, y);
  
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.greenDark);
  doc.text('Code:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.textPrimary);
  doc.text(invoice.cooperative?.code || '-', margin + 30, y);
  
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.greenDark);
  doc.text('Période:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.textPrimary);
  doc.text(`${formatDate(invoice.period_start)} - ${formatDate(invoice.period_end)}`, margin + 30, y);
  
  y += 15;

  // ============================================================================
  // SUMMARY BOX
  // ============================================================================
  
  const boxHeight = 35;
  const boxWidth = (pageWidth - 2 * margin - 10) / 3;
  
  // Draw summary boxes with CocoaTrack colors
  doc.setFillColor(...COLORS.grayLight);
  doc.roundedRect(margin, y, boxWidth, boxHeight, 3, 3, 'F');
  doc.roundedRect(margin + boxWidth + 5, y, boxWidth, boxHeight, 3, 3, 'F');
  
  // Third box with green accent
  doc.setFillColor(...COLORS.greenDark);
  doc.roundedRect(margin + 2 * (boxWidth + 5), y, boxWidth, boxHeight, 3, 3, 'F');
  
  // Box 1: Deliveries count
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.grayText);
  doc.text('Livraisons', margin + boxWidth / 2, y + 10, { align: 'center' });
  doc.setFontSize(16);
  doc.setTextColor(...COLORS.textPrimary);
  doc.setFont('helvetica', 'bold');
  doc.text(String(summary.total_deliveries), margin + boxWidth / 2, y + 22, { align: 'center' });
  
  // Box 2: Total weight
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.grayText);
  doc.setFont('helvetica', 'normal');
  doc.text('Poids total', margin + boxWidth + 5 + boxWidth / 2, y + 10, { align: 'center' });
  doc.setFontSize(16);
  doc.setTextColor(...COLORS.textPrimary);
  doc.setFont('helvetica', 'bold');
  doc.text(`${summary.total_weight_kg.toFixed(2)} kg`, margin + boxWidth + 5 + boxWidth / 2, y + 22, { align: 'center' });
  
  // Box 3: Total amount (white text on green)
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.white);
  doc.setFont('helvetica', 'normal');
  doc.text('Montant total', margin + 2 * (boxWidth + 5) + boxWidth / 2, y + 10, { align: 'center' });
  doc.setFontSize(16);
  doc.setTextColor(...COLORS.yellowCacao);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(summary.total_amount_xaf), margin + 2 * (boxWidth + 5) + boxWidth / 2, y + 22, { align: 'center' });
  
  y += boxHeight + 15;

  // ============================================================================
  // DELIVERIES TABLE
  // ============================================================================
  
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.greenDark);
  doc.setFont('helvetica', 'bold');
  doc.text('Détail des livraisons', margin, y);
  
  y += 8;
  
  // Table header with green background
  const colWidths = [35, 25, 50, 25, 35];
  const headers = ['Code', 'Date', 'Planteur', 'Poids (kg)', 'Montant'];
  
  doc.setFillColor(...COLORS.greenOlive);
  doc.rect(margin, y, pageWidth - 2 * margin, 8, 'F');
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.white);
  let x = margin + 2;
  headers.forEach((header, i) => {
    doc.text(header, x, y + 5.5);
    x += colWidths[i];
  });
  
  y += 10;
  
  // Table rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  
  let rowIndex = 0;
  for (const item of deliveries) {
    checkPageBreak(8);
    
    const delivery = item.delivery;
    if (!delivery) continue;
    
    // Alternate row background
    if (rowIndex % 2 === 0) {
      doc.setFillColor(...COLORS.grayLight);
      doc.rect(margin, y - 1, pageWidth - 2 * margin, 6, 'F');
    }
    
    x = margin + 2;
    doc.setTextColor(...COLORS.textPrimary);
    
    // Code
    doc.text(delivery.code || '-', x, y + 4);
    x += colWidths[0];
    
    // Date
    doc.text(delivery.delivered_at ? formatDate(delivery.delivered_at) : '-', x, y + 4);
    x += colWidths[1];
    
    // Planteur
    const planteurName = delivery.planteur?.name || '-';
    const truncatedName = planteurName.length > 25 ? planteurName.substring(0, 22) + '...' : planteurName;
    doc.text(truncatedName, x, y + 4);
    x += colWidths[2];
    
    // Weight
    doc.setTextColor(...COLORS.orange);
    doc.text(Number(delivery.weight_kg).toFixed(2), x, y + 4);
    x += colWidths[3];
    
    // Amount
    doc.setTextColor(...COLORS.greenDark);
    doc.text(formatCurrency(Number(delivery.total_amount)), x, y + 4);
    
    y += 6;
    rowIndex++;
  }
  
  y += 10;

  // ============================================================================
  // QUALITY DISTRIBUTION
  // ============================================================================
  
  checkPageBreak(30);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.greenDark);
  doc.text('Répartition par qualité:', margin, y);
  
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.greenLight);
  doc.text(`Grade A: ${summary.deliveries_by_grade.A} livraisons`, margin + 5, y);
  y += 5;
  doc.setTextColor(...COLORS.yellowGold);
  doc.text(`Grade B: ${summary.deliveries_by_grade.B} livraisons`, margin + 5, y);
  y += 5;
  doc.setTextColor(...COLORS.orange);
  doc.text(`Grade C: ${summary.deliveries_by_grade.C} livraisons`, margin + 5, y);
  
  y += 15;

  // ============================================================================
  // TOTALS
  // ============================================================================
  
  checkPageBreak(30);
  
  // Total box with green background
  const totalBoxWidth = 80;
  const totalBoxX = pageWidth - margin - totalBoxWidth;
  
  doc.setFillColor(...COLORS.greenDark);
  doc.roundedRect(totalBoxX, y, totalBoxWidth, 25, 3, 3, 'F');
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.white);
  doc.text('Prix moyen/kg:', totalBoxX + 5, y + 8);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(summary.average_price_per_kg), totalBoxX + totalBoxWidth - 5, y + 8, { align: 'right' });
  
  doc.setFont('helvetica', 'normal');
  doc.text('TOTAL:', totalBoxX + 5, y + 18);
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.yellowCacao);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(summary.total_amount_xaf), totalBoxX + totalBoxWidth - 5, y + 18, { align: 'right' });

  // ============================================================================
  // FOOTER
  // ============================================================================
  
  const footerY = pageHeight - 15;
  
  // Footer line
  doc.setDrawColor(...COLORS.greenOlive);
  doc.setLineWidth(0.5);
  doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
  
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.grayText);
  doc.setFont('helvetica', 'normal');
  doc.text(`Généré le ${formatDate(new Date().toISOString())}`, margin, footerY);
  
  doc.setTextColor(...COLORS.greenDark);
  doc.setFont('helvetica', 'bold');
  doc.text(companyName, pageWidth / 2, footerY, { align: 'center' });
  
  doc.setTextColor(...COLORS.grayText);
  doc.setFont('helvetica', 'normal');
  doc.text(`Page 1`, pageWidth - margin, footerY, { align: 'right' });

  // Return as Blob
  return doc.output('blob');
}

/**
 * Download a PDF invoice
 */
export async function downloadInvoicePdf(options: GeneratePdfOptions): Promise<void> {
  const blob = await generateInvoicePdf(options);
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `${options.invoice.code}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

/**
 * Upload a PDF invoice to Supabase Storage
 */
export async function uploadInvoicePdf(
  options: GeneratePdfOptions,
  supabase: ReturnType<typeof import('@/lib/supabase/client').createClient>
): Promise<string> {
  const blob = await generateInvoicePdf(options);
  
  const fileName = `${options.invoice.cooperative_id}/${options.invoice.id}/${options.invoice.code}.pdf`;
  
  const { data, error } = await supabase.storage
    .from('invoices')
    .upload(fileName, blob, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (error) {
    throw new Error(`Failed to upload PDF: ${error.message}`);
  }

  return data.path;
}
