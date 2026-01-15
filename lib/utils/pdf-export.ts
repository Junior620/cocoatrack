/**
 * PDF Export Utility
 * Provides functions to export data to PDF format
 */

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
  
  // Status colors
  success: [111, 175, 61] as [number, number, number],      // Green
  warning: [230, 138, 31] as [number, number, number],      // Orange
  error: [220, 38, 38] as [number, number, number],         // Red
};

// Format date for display
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export interface PdfExportOptions {
  title: string;
  subtitle?: string;
  filename: string;
}

/**
 * Export audit logs to PDF
 */
export async function exportAuditLogsToPdf(
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
  formatChanges: (action: 'INSERT' | 'UPDATE' | 'DELETE', oldData: Record<string, unknown> | null, newData: Record<string, unknown> | null) => string,
  options?: Partial<PdfExportOptions>
): Promise<void> {
  const JsPDF = await getJsPDF();
  const doc = new JsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let y = margin;

  // Table labels
  const tableLabels: Record<string, string> = {
    deliveries: 'Livraisons',
    planteurs: 'Planteurs',
    chef_planteurs: 'Chef Planteurs',
    invoices: 'Factures',
    profiles: 'Utilisateurs',
    warehouses: 'Entrepôts',
    cooperatives: 'Coopératives',
  };

  const actionLabels: Record<string, string> = {
    INSERT: 'Création',
    UPDATE: 'Modification',
    DELETE: 'Suppression',
  };

  // Helper to add new page
  const addNewPage = () => {
    doc.addPage();
    y = margin;
    addHeader();
  };

  // Check page break
  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - margin - 10) {
      addNewPage();
      return true;
    }
    return false;
  };

  // Add header to each page
  const addHeader = () => {
    // Header background gradient effect (green bar)
    doc.setFillColor(...COLORS.greenDark);
    doc.rect(0, 0, pageWidth, 12, 'F');
    
    // Orange accent line
    doc.setFillColor(...COLORS.orange);
    doc.rect(0, 12, pageWidth, 2, 'F');
    
    y = 22;
    
    doc.setFontSize(18);
    doc.setTextColor(...COLORS.greenDark);
    doc.setFont('helvetica', 'bold');
    doc.text(options?.title || 'Journal d\'audit', margin, y);
    
    // CocoaTrack branding on right
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.orange);
    doc.text('CocoaTrack', pageWidth - margin, y, { align: 'right' });
    
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.grayText);
    doc.setFont('helvetica', 'normal');
    doc.text(options?.subtitle || `Exporté le ${formatDateTime(new Date().toISOString())}`, margin, y + 6);
    
    y += 15;

    // Table header with green background
    const colWidths = [35, 45, 35, 25, 25, 95];
    const headers = ['Date/Heure', 'Utilisateur', 'Table', 'Action', 'IP', 'Modifications'];
    
    doc.setFillColor(...COLORS.greenOlive);
    doc.rect(margin, y, pageWidth - 2 * margin, 8, 'F');
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.white);
    
    let x = margin + 2;
    headers.forEach((header, i) => {
      doc.text(header, x, y + 5.5);
      x += colWidths[i];
    });
    
    y += 10;
  };

  // Add initial header
  addHeader();

  // Column widths
  const colWidths = [35, 45, 35, 25, 25, 95];

  // Table rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);

  let rowIndex = 0;
  for (const log of logs) {
    checkPageBreak(12);
    
    // Alternate row background
    if (rowIndex % 2 === 0) {
      doc.setFillColor(...COLORS.grayLight);
      doc.rect(margin, y - 1, pageWidth - 2 * margin, 7, 'F');
    }
    
    let x = margin + 2;
    doc.setTextColor(...COLORS.textPrimary);
    
    // Date/Time
    doc.text(formatDateTime(log.created_at), x, y + 4);
    x += colWidths[0];
    
    // Actor
    const actorText = log.actor_name || 'Système';
    const truncatedActor = actorText.length > 25 ? actorText.substring(0, 22) + '...' : actorText;
    doc.text(truncatedActor, x, y + 4);
    x += colWidths[1];
    
    // Table
    doc.text(tableLabels[log.table_name] || log.table_name, x, y + 4);
    x += colWidths[2];
    
    // Action with CocoaTrack colors
    const actionLabel = actionLabels[log.action] || log.action;
    if (log.action === 'INSERT') {
      doc.setTextColor(...COLORS.greenLight); // Green for creation
    } else if (log.action === 'UPDATE') {
      doc.setTextColor(...COLORS.orange); // Orange for update
    } else if (log.action === 'DELETE') {
      doc.setTextColor(...COLORS.error); // Red for delete
    }
    doc.text(actionLabel, x, y + 4);
    doc.setTextColor(...COLORS.textPrimary);
    x += colWidths[3];
    
    // IP
    doc.setTextColor(...COLORS.grayText);
    doc.text(log.ip_address || '-', x, y + 4);
    x += colWidths[4];
    
    // Changes (truncated)
    doc.setTextColor(...COLORS.textPrimary);
    const changes = formatChanges(log.action as 'INSERT' | 'UPDATE' | 'DELETE', log.old_data, log.new_data);
    const truncatedChanges = changes.length > 60 ? changes.substring(0, 57) + '...' : changes;
    doc.text(truncatedChanges, x, y + 4);
    
    y += 7;
    rowIndex++;
  }

  // Footer with branding
  const footerY = pageHeight - 10;
  
  // Footer line
  doc.setDrawColor(...COLORS.greenOlive);
  doc.setLineWidth(0.5);
  doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
  
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.grayText);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total: ${logs.length} entrées`, margin, footerY);
  
  doc.setTextColor(...COLORS.greenDark);
  doc.setFont('helvetica', 'bold');
  doc.text('CocoaTrack', pageWidth / 2, footerY, { align: 'center' });
  
  doc.setTextColor(...COLORS.grayText);
  doc.setFont('helvetica', 'normal');
  doc.text(formatDate(new Date().toISOString()), pageWidth - margin, footerY, { align: 'right' });

  // Download
  const filename = options?.filename || `audit-logs-${new Date().toISOString().split('T')[0]}`;
  doc.save(`${filename}.pdf`);
}

/**
 * Export deliveries to PDF
 */
export async function exportDeliveriesToPdf(
  deliveries: Array<{
    delivery_number: string;
    delivery_date: string;
    planteur_name: string;
    chef_planteur_name: string;
    quantity_kg: number;
    quality_grade: string;
    status: string;
    warehouse_name: string;
  }>,
  options?: Partial<PdfExportOptions>
): Promise<void> {
  const JsPDF = await getJsPDF();
  const doc = new JsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let y = margin;

  const addHeader = () => {
    // Header background gradient effect (green bar)
    doc.setFillColor(...COLORS.greenDark);
    doc.rect(0, 0, pageWidth, 12, 'F');
    
    // Orange accent line
    doc.setFillColor(...COLORS.orange);
    doc.rect(0, 12, pageWidth, 2, 'F');
    
    y = 22;
    
    doc.setFontSize(18);
    doc.setTextColor(...COLORS.greenDark);
    doc.setFont('helvetica', 'bold');
    doc.text(options?.title || 'Liste des Livraisons', margin, y);
    
    // CocoaTrack branding on right
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.orange);
    doc.text('CocoaTrack', pageWidth - margin, y, { align: 'right' });
    
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.grayText);
    doc.setFont('helvetica', 'normal');
    doc.text(`Exporté le ${formatDateTime(new Date().toISOString())}`, margin, y + 6);
    
    y += 15;

    const colWidths = [30, 25, 50, 50, 25, 20, 25, 35];
    const headers = ['Numéro', 'Date', 'Planteur', 'Chef Planteur', 'Qté (kg)', 'Qualité', 'Statut', 'Entrepôt'];
    
    doc.setFillColor(...COLORS.greenOlive);
    doc.rect(margin, y, pageWidth - 2 * margin, 8, 'F');
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.white);
    
    let x = margin + 2;
    headers.forEach((header, i) => {
      doc.text(header, x, y + 5.5);
      x += colWidths[i];
    });
    
    y += 10;
  };

  const addNewPage = () => {
    doc.addPage();
    y = margin;
    addHeader();
  };

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - margin - 10) {
      addNewPage();
      return true;
    }
    return false;
  };

  addHeader();

  const colWidths = [30, 25, 50, 50, 25, 20, 25, 35];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);

  let rowIndex = 0;
  for (const delivery of deliveries) {
    checkPageBreak(10);
    
    // Alternate row background
    if (rowIndex % 2 === 0) {
      doc.setFillColor(...COLORS.grayLight);
      doc.rect(margin, y - 1, pageWidth - 2 * margin, 7, 'F');
    }
    
    let x = margin + 2;
    doc.setTextColor(...COLORS.textPrimary);
    
    doc.text(delivery.delivery_number || '-', x, y + 4);
    x += colWidths[0];
    
    doc.text(formatDate(delivery.delivery_date), x, y + 4);
    x += colWidths[1];
    
    const planteur = delivery.planteur_name || '-';
    doc.text(planteur.length > 28 ? planteur.substring(0, 25) + '...' : planteur, x, y + 4);
    x += colWidths[2];
    
    const chef = delivery.chef_planteur_name || '-';
    doc.text(chef.length > 28 ? chef.substring(0, 25) + '...' : chef, x, y + 4);
    x += colWidths[3];
    
    // Quantity in orange
    doc.setTextColor(...COLORS.orange);
    doc.text(String(delivery.quantity_kg), x, y + 4);
    doc.setTextColor(...COLORS.textPrimary);
    x += colWidths[4];
    
    // Quality grade with color
    const grade = delivery.quality_grade || '-';
    if (grade === 'A') {
      doc.setTextColor(...COLORS.greenLight);
    } else if (grade === 'B') {
      doc.setTextColor(...COLORS.yellowGold);
    } else {
      doc.setTextColor(...COLORS.orange);
    }
    doc.text(grade, x, y + 4);
    doc.setTextColor(...COLORS.textPrimary);
    x += colWidths[5];
    
    doc.text(delivery.status || '-', x, y + 4);
    x += colWidths[6];
    
    doc.text(delivery.warehouse_name || '-', x, y + 4);
    
    y += 7;
    rowIndex++;
  }

  // Footer with branding
  const footerY = pageHeight - 10;
  
  doc.setDrawColor(...COLORS.greenOlive);
  doc.setLineWidth(0.5);
  doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
  
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.grayText);
  doc.text(`Total: ${deliveries.length} livraisons`, margin, footerY);
  
  doc.setTextColor(...COLORS.greenDark);
  doc.setFont('helvetica', 'bold');
  doc.text('CocoaTrack', pageWidth / 2, footerY, { align: 'center' });

  const filename = options?.filename || `livraisons-${new Date().toISOString().split('T')[0]}`;
  doc.save(`${filename}.pdf`);
}

/**
 * Export planteurs to PDF
 */
export async function exportPlanteursToPdf(
  planteurs: Array<{
    code: string;
    full_name: string;
    phone: string | null;
    village: string | null;
    chef_planteur_name: string | null;
    total_deliveries: number;
    total_quantity_kg: number;
    status: string;
  }>,
  options?: Partial<PdfExportOptions>
): Promise<void> {
  const JsPDF = await getJsPDF();
  const doc = new JsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let y = margin;

  const addHeader = () => {
    // Header background gradient effect (green bar)
    doc.setFillColor(...COLORS.greenDark);
    doc.rect(0, 0, pageWidth, 12, 'F');
    
    // Orange accent line
    doc.setFillColor(...COLORS.orange);
    doc.rect(0, 12, pageWidth, 2, 'F');
    
    y = 22;
    
    doc.setFontSize(18);
    doc.setTextColor(...COLORS.greenDark);
    doc.setFont('helvetica', 'bold');
    doc.text(options?.title || 'Liste des Planteurs', margin, y);
    
    // CocoaTrack branding on right
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.orange);
    doc.text('CocoaTrack', pageWidth - margin, y, { align: 'right' });
    
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.grayText);
    doc.setFont('helvetica', 'normal');
    doc.text(`Exporté le ${formatDateTime(new Date().toISOString())}`, margin, y + 6);
    
    y += 15;

    const colWidths = [25, 55, 30, 35, 50, 25, 25, 20];
    const headers = ['Code', 'Nom', 'Téléphone', 'Village', 'Chef Planteur', 'Livraisons', 'Total (kg)', 'Statut'];
    
    doc.setFillColor(...COLORS.greenOlive);
    doc.rect(margin, y, pageWidth - 2 * margin, 8, 'F');
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.white);
    
    let x = margin + 2;
    headers.forEach((header, i) => {
      doc.text(header, x, y + 5.5);
      x += colWidths[i];
    });
    
    y += 10;
  };

  const addNewPage = () => {
    doc.addPage();
    y = margin;
    addHeader();
  };

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - margin - 10) {
      addNewPage();
      return true;
    }
    return false;
  };

  addHeader();

  const colWidths = [25, 55, 30, 35, 50, 25, 25, 20];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);

  let rowIndex = 0;
  for (const planteur of planteurs) {
    checkPageBreak(10);
    
    // Alternate row background
    if (rowIndex % 2 === 0) {
      doc.setFillColor(...COLORS.grayLight);
      doc.rect(margin, y - 1, pageWidth - 2 * margin, 7, 'F');
    }
    
    let x = margin + 2;
    doc.setTextColor(...COLORS.textPrimary);
    
    // Code in green
    doc.setTextColor(...COLORS.greenDark);
    doc.text(planteur.code || '-', x, y + 4);
    doc.setTextColor(...COLORS.textPrimary);
    x += colWidths[0];
    
    const name = planteur.full_name || '-';
    doc.text(name.length > 30 ? name.substring(0, 27) + '...' : name, x, y + 4);
    x += colWidths[1];
    
    doc.setTextColor(...COLORS.grayText);
    doc.text(planteur.phone || '-', x, y + 4);
    doc.setTextColor(...COLORS.textPrimary);
    x += colWidths[2];
    
    const village = planteur.village || '-';
    doc.text(village.length > 18 ? village.substring(0, 15) + '...' : village, x, y + 4);
    x += colWidths[3];
    
    const chef = planteur.chef_planteur_name || '-';
    doc.text(chef.length > 28 ? chef.substring(0, 25) + '...' : chef, x, y + 4);
    x += colWidths[4];
    
    // Stats in orange
    doc.setTextColor(...COLORS.orange);
    doc.text(String(planteur.total_deliveries), x, y + 4);
    x += colWidths[5];
    
    doc.text(String(planteur.total_quantity_kg), x, y + 4);
    doc.setTextColor(...COLORS.textPrimary);
    x += colWidths[6];
    
    // Status with color
    const status = planteur.status || '-';
    if (status === 'active') {
      doc.setTextColor(...COLORS.greenLight);
    } else {
      doc.setTextColor(...COLORS.grayText);
    }
    doc.text(status, x, y + 4);
    doc.setTextColor(...COLORS.textPrimary);
    
    y += 7;
    rowIndex++;
  }

  // Footer with branding
  const footerY = pageHeight - 10;
  
  doc.setDrawColor(...COLORS.greenOlive);
  doc.setLineWidth(0.5);
  doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
  
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.grayText);
  doc.text(`Total: ${planteurs.length} planteurs`, margin, footerY);
  
  doc.setTextColor(...COLORS.greenDark);
  doc.setFont('helvetica', 'bold');
  doc.text('CocoaTrack', pageWidth / 2, footerY, { align: 'center' });

  const filename = options?.filename || `planteurs-${new Date().toISOString().split('T')[0]}`;
  doc.save(`${filename}.pdf`);
}
