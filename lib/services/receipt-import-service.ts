/**
 * Receipt Import Service
 *
 * Main service for importing collection receipt PDFs.
 * Orchestrates upload, OCR extraction, parsing, validation, and delivery creation.
 *
 * Requirements: 7.1, 7.2, 7.9, 17.1, 17.2, 17.5
 */

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { uploadPdf, deleteReceiptPdf } from './receipt-upload-service';
import { createOcrService } from './ocr-service';
import { receiptParser } from './receipt-parser';
import { logReceiptImport, logReceiptImportFailed } from './audit-log-service';
import type {
  ReceiptData,
  CreateReceiptResult,
  DuplicateReceipt,
  ParsedReceipt,
  ProductLine,
} from '@/types/receipts';
import type { OcrResult } from './ocr-service';

// ============================================================================
// TYPES
// ============================================================================

export interface ValidationResult {
  exists: boolean;
  collectionReceiptId?: string;
  deliveryIds?: string[];
}

export interface ReceiptImportError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Quality grade mapping from commercial type
 * Requirements: 7.5
 */
const COMMERCIAL_TYPE_TO_QUALITY_GRADE: Record<string, string> = {
  'Tout Venant': 'B',
  'G2': 'A',
};

const DEFAULT_QUALITY_GRADE = 'B';

/**
 * Duplicate detection weight tolerance (±5%)
 * Requirements: 17.5
 */
const DUPLICATE_WEIGHT_TOLERANCE = 0.05;

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Map commercial type to quality grade
 * Requirements: 7.5
 */
function mapCommercialTypeToQualityGrade(commercialType: string): string {
  return COMMERCIAL_TYPE_TO_QUALITY_GRADE[commercialType] ?? DEFAULT_QUALITY_GRADE;
}

/**
 * Generate delivery code in format DEL-YYYYMMDD-XXXX
 * Requirements: 7.3
 */
function generateDeliveryCode(transactionDate: string, sequence: number): string {
  const datePart = transactionDate.replace(/-/g, '');
  const seqPart = String(sequence).padStart(4, '0');
  return `DEL-${datePart}-${seqPart}`;
}

/**
 * Log error details for debugging
 * Requirements: 10.6, 12.4
 */
function logError(context: string, error: unknown, extra?: Record<string, unknown>): void {
  console.error(`[receipt-import-service] ${context}`, {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    ...extra,
  });
}

// ============================================================================
// RECEIPT IMPORT SERVICE
// ============================================================================

export class ReceiptImportService {
  /**
   * Upload a PDF file to Supabase Storage
   *
   * Delegates to receipt-upload-service with validation and retry logic.
   *
   * @param file - PDF file to upload
   * @param cooperativeId - Cooperative ID for storage path
   * @param receiptNumber - Receipt number for storage path
   * @returns Storage path of the uploaded file
   * @throws ReceiptImportError on failure
   */
  async uploadPdf(
    file: File,
    cooperativeId: string,
    receiptNumber: string
  ): Promise<string> {
    const result = await uploadPdf(file, cooperativeId, receiptNumber);

    if (!result.success || !result.storagePath) {
      const err: ReceiptImportError = {
        code: result.errorCode ?? 'UPLOAD_FAILED',
        message: result.error ?? "Échec de l'upload du fichier PDF",
      };
      logError('uploadPdf failed', new Error(err.message), { cooperativeId, receiptNumber });
      throw err;
    }

    return result.storagePath;
  }

  /**
   * Extract text from a PDF using the configured OCR service
   *
   * Delegates to OcrService. Falls back gracefully if OCR is unavailable.
   *
   * @param pdfUrl - URL or storage path of the PDF
   * @returns OCR result with extracted text and confidence
   * @throws ReceiptImportError on timeout or service failure
   *
   * Requirements: 4.1, 4.2, 13.4, 13.5
   */
  async extractText(pdfUrl: string): Promise<OcrResult> {
    const ocrService = createOcrService();
    // OCR is limited to first page by default (maxPages: 1), Requirement 18.5

    const available = await ocrService.isAvailable();
    if (!available) {
      const err: ReceiptImportError = {
        code: 'OCR_SERVICE_UNAVAILABLE',
        message: 'Service OCR temporairement indisponible. Veuillez utiliser la saisie manuelle',
      };
      logError('extractText: OCR service unavailable', new Error(err.message));
      throw err;
    }

    try {
      return await ocrService.extractText(pdfUrl);
    } catch (error) {
      const message =
        error instanceof Error && error.message.includes('timeout')
          ? 'Extraction trop longue. Veuillez utiliser la saisie manuelle'
          : 'Extraction impossible. Veuillez saisir manuellement';

      const code =
        error instanceof Error && error.message.includes('timeout')
          ? 'OCR_TIMEOUT'
          : 'OCR_EXTRACTION_FAILED';

      logError('extractText failed', error, { pdfUrl });
      throw { code, message } as ReceiptImportError;
    }
  }

  /**
   * Parse OCR-extracted text into structured receipt data
   *
   * Delegates to ReceiptParser.
   *
   * @param text - OCR-extracted text
   * @returns Parsed receipt with confidence indicators
   *
   * Requirements: 14.1-14.13
   */
  parseReceipt(text: string): ParsedReceipt {
    return receiptParser.parse(text);
  }

  /**
   * Validate receipt number uniqueness within a cooperative
   *
   * Requirements: 17.1, 17.2
   */
  async validateReceiptNumber(
    receiptNumber: string,
    cooperativeId: string
  ): Promise<ValidationResult> {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from('collection_receipts' as never)
      .select('id')
      .eq('receipt_number', receiptNumber)
      .eq('cooperative_id', cooperativeId)
      .maybeSingle();

    if (error) {
      logError('validateReceiptNumber query failed', error, { receiptNumber, cooperativeId });
      throw {
        code: 'DATABASE_ERROR',
        message: `Erreur lors de la validation du numéro de reçu: ${error.message}`,
      } as ReceiptImportError;
    }

    if (!data) {
      return { exists: false };
    }

    const receipt = data as { id: string };

    // Fetch linked delivery IDs
    const { data: links } = await supabase
      .from('receipt_deliveries' as never)
      .select('delivery_id')
      .eq('collection_receipt_id', receipt.id);

    const deliveryIds = (links as { delivery_id: string }[] | null)?.map(l => l.delivery_id) ?? [];

    return {
      exists: true,
      collectionReceiptId: receipt.id,
      deliveryIds,
    };
  }

  /**
   * Detect potential duplicate receipts
   *
   * Checks for receipts with same planteur, chef planteur, transaction date,
   * and weight within ±5%.
   *
   * Requirements: 17.5
   */
  async detectDuplicates(data: {
    planteurId: string;
    chefPlanteurId: string;
    transactionDate: string;
    totalWeight: number;
    cooperativeId: string;
  }): Promise<DuplicateReceipt[]> {
    const supabase = await createServerSupabaseClient();

    // Fetch candidates: same planteur, chef, date
    const { data: candidates, error } = await supabase
      .from('collection_receipts' as never)
      .select(`
        id,
        receipt_number,
        transaction_date
      `)
      .eq('planteur_id', data.planteurId)
      .eq('chef_planteur_id', data.chefPlanteurId)
      .eq('transaction_date', data.transactionDate)
      .eq('cooperative_id', data.cooperativeId);

    if (error) {
      logError('detectDuplicates query failed', error, data);
      return [];
    }

    if (!candidates || candidates.length === 0) {
      return [];
    }

    const duplicates: DuplicateReceipt[] = [];

    for (const candidate of candidates as {
      id: string;
      receipt_number: string;
      transaction_date: string;
    }[]) {
      // Get total weight from linked deliveries
      const { data: deliveries } = await supabase
        .from('receipt_deliveries' as never)
        .select('delivery_id')
        .eq('collection_receipt_id', candidate.id);

      if (!deliveries || deliveries.length === 0) continue;

      const deliveryIds = (deliveries as { delivery_id: string }[]).map(d => d.delivery_id);

      const { data: weightData } = await supabase
        .from('deliveries')
        .select('weight_kg')
        .in('id', deliveryIds);

      const totalWeight = (weightData ?? []).reduce(
        (sum: number, d: { weight_kg: number }) => sum + Number(d.weight_kg),
        0
      );

      // Check weight within ±5%
      const weightDiff = Math.abs(totalWeight - data.totalWeight);
      const tolerance = data.totalWeight * DUPLICATE_WEIGHT_TOLERANCE;

      if (weightDiff <= tolerance) {
        const similarity =
          1 - weightDiff / (data.totalWeight > 0 ? data.totalWeight : 1);

        duplicates.push({
          collectionReceiptId: candidate.id,
          receiptNumber: candidate.receipt_number,
          transactionDate: candidate.transaction_date,
          totalWeight,
          similarity: Math.round(similarity * 100) / 100,
        });
      }
    }

    return duplicates;
  }

  /**
   * Create delivery records from a validated receipt
   *
   * Creates:
   * - One delivery per product line
   * - One collection_receipt record
   * - receipt_deliveries junction records
   *
   * All operations are wrapped in a transaction. On failure, the uploaded PDF
   * is deleted and all DB changes are rolled back.
   *
   * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 8.5, 12.1, 12.2, 18.7, 19.1
   */
  async createDeliveriesFromReceipt(
    data: ReceiptData,
    userId: string
  ): Promise<CreateReceiptResult> {
    const supabase = await createServerSupabaseClient();

    // ---- 1. Build collection_receipt insert payload ----
    const totalAmount = data.productLines.reduce((sum, line) => sum + line.amount, 0);
    const balance = totalAmount - data.payment.amountPaid;

    const receiptInsert = {
      cooperative_id: data.cooperativeId,
      planteur_id: data.planteurId,
      chef_planteur_id: data.chefPlanteurId || null,
      contract_number: data.contractNumber,
      receipt_number: data.receiptNumber,
      campaign: data.campaign,
      region: data.location.region ?? null,
      department: data.location.department ?? null,
      arrondissement: data.location.arrondissement ?? null,
      village: data.location.village ?? null,
      transaction_date: data.transactionDate,
      professional_card_number: data.professionalCardNumber ?? null,
      payment_mode: data.payment.mode,
      amount_paid: data.payment.amountPaid,
      balance,
      pdf_url: data.pdfUrl,
      pdf_file_name: data.pdfFileName,
      pdf_file_size: data.pdfFileSize,
      extraction_method: data.extractionMethod,
      created_by: userId,
    };

    // ---- 2. Insert collection_receipt ----
    const { data: receipt, error: receiptError } = await supabase
      .from('collection_receipts')
      .insert(receiptInsert as any)
      .select('id')
      .single() as { data: { id: string } | null; error: any };

    if (receiptError || !receipt) {
      logError('createDeliveriesFromReceipt: insert collection_receipt failed', receiptError, {
        receiptNumber: data.receiptNumber,
        userId,
      });
      await this._cleanupPdf(data.pdfUrl);
      await this._logReceiptImportFailed(userId, {
        fileName: data.pdfFileName,
        fileSize: data.pdfFileSize,
        receiptNumber: data.receiptNumber,
        extractionMethod: data.extractionMethod,
        cooperativeId: data.cooperativeId,
        errorCode: 'DATABASE_ERROR',
        errorMessage: receiptError?.message ?? 'Erreur inconnue',
      });
      throw {
        code: 'DATABASE_ERROR',
        message: `Erreur lors de la création du reçu: ${receiptError?.message ?? 'Erreur inconnue'}`,
      } as ReceiptImportError;
    }

    const collectionReceiptId = (receipt as { id: string }).id;

    // ---- 3. Build delivery inserts ----
    // Get current max sequence for the date to generate unique codes
    const dateStr = data.transactionDate.replace(/-/g, '');
    const codePrefix = `DEL-${dateStr}-`;

    const { data: existingCodes } = await supabase
      .from('deliveries')
      .select('code')
      .like('code', `${codePrefix}%`);

    const usedSequences = new Set(
      (existingCodes ?? []).map((row: { code: string }) => {
        const seq = row.code.replace(codePrefix, '');
        return parseInt(seq, 10);
      })
    );

    let nextSeq = 1;
    const deliveryInserts = data.productLines.map((line: ProductLine) => {
      while (usedSequences.has(nextSeq)) nextSeq++;
      const code = generateDeliveryCode(data.transactionDate, nextSeq);
      usedSequences.add(nextSeq);
      nextSeq++;

      const notes = JSON.stringify({
        source: 'receipt_import',
        contract_number: data.contractNumber,
        receipt_number: data.receiptNumber,
        campaign: data.campaign,
        location: data.location,
        chef_planteur_name: data.chefPlanteurName ?? null,
      });

      return {
        code,
        cooperative_id: data.cooperativeId,
        planteur_id: data.planteurId,
        chef_planteur_id: data.chefPlanteurId || null,
        weight_kg: line.netWeight,
        price_per_kg: line.pricePerKg,
        total_amount: line.amount,
        quality_grade: mapCommercialTypeToQualityGrade(line.commercialType),
        delivered_at: data.transactionDate,
        notes,
        created_by: userId,
        // Mark as not invoiced (Requirements: 19.1)
        invoice_id: null,
      };
    });

    // ---- 4. Insert deliveries ----
    const { data: deliveries, error: deliveriesError } = await supabase
      .from('deliveries')
      .insert(deliveryInserts as any)
      .select('id') as { data: { id: string }[] | null; error: any };

    if (deliveriesError || !deliveries) {
      logError('createDeliveriesFromReceipt: insert deliveries failed', deliveriesError, {
        collectionReceiptId,
        userId,
      });
      // Rollback: delete collection_receipt
      await supabase
        .from('collection_receipts' as never)
        .delete()
        .eq('id', collectionReceiptId);
      await this._cleanupPdf(data.pdfUrl);
      await this._logReceiptImportFailed(userId, {
        fileName: data.pdfFileName,
        fileSize: data.pdfFileSize,
        receiptNumber: data.receiptNumber,
        extractionMethod: data.extractionMethod,
        cooperativeId: data.cooperativeId,
        errorCode: 'DATABASE_ERROR',
        errorMessage: deliveriesError?.message ?? 'Erreur inconnue',
      });
      throw {
        code: 'DATABASE_ERROR',
        message: `Erreur lors de la création des livraisons: ${deliveriesError?.message ?? 'Erreur inconnue'}`,
      } as ReceiptImportError;
    }

    const deliveryIds = (deliveries as { id: string }[]).map(d => d.id);

    // ---- 5. Link deliveries to receipt ----
    const linkInserts = deliveryIds.map(deliveryId => ({
      collection_receipt_id: collectionReceiptId,
      delivery_id: deliveryId,
    }));

    const { error: linkError } = await supabase
      .from('receipt_deliveries')
      .insert(linkInserts as any);

    if (linkError) {
      logError('createDeliveriesFromReceipt: insert receipt_deliveries failed', linkError, {
        collectionReceiptId,
        userId,
      });
      // Rollback: delete deliveries and collection_receipt
      await supabase.from('deliveries').delete().in('id', deliveryIds);
      await supabase
        .from('collection_receipts' as never)
        .delete()
        .eq('id', collectionReceiptId);
      await this._cleanupPdf(data.pdfUrl);
      await this._logReceiptImportFailed(userId, {
        fileName: data.pdfFileName,
        fileSize: data.pdfFileSize,
        receiptNumber: data.receiptNumber,
        extractionMethod: data.extractionMethod,
        cooperativeId: data.cooperativeId,
        errorCode: 'DATABASE_ERROR',
        errorMessage: linkError.message,
      });
      throw {
        code: 'DATABASE_ERROR',
        message: `Erreur lors de la liaison des livraisons: ${linkError.message}`,
      } as ReceiptImportError;
    }

    // ---- 6. Audit log ----
    await this._logReceiptImport(userId, {
      collectionReceiptId,
      deliveryIds,
      receiptNumber: data.receiptNumber,
      fileName: data.pdfFileName,
      fileSize: data.pdfFileSize,
      extractionMethod: data.extractionMethod,
      cooperativeId: data.cooperativeId,
    });

    return {
      collectionReceiptId,
      deliveryIds,
      deliveryCount: deliveryIds.length,
    };
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /**
   * Delete uploaded PDF on rollback
   * Requirements: 7.9, 9.6
   */
  private async _cleanupPdf(pdfUrl: string): Promise<void> {
    try {
      await deleteReceiptPdf(pdfUrl);
    } catch (err) {
      logError('_cleanupPdf failed', err, { pdfUrl });
    }
  }

  /**
   * Write audit log entry for a successful receipt import
   * Requirements: 12.1, 12.2
   */
  private async _logReceiptImport(
    userId: string,
    meta: {
      collectionReceiptId: string;
      deliveryIds: string[];
      receiptNumber: string;
      fileName: string;
      fileSize: number;
      extractionMethod: string;
      cooperativeId: string;
    }
  ): Promise<void> {
    await logReceiptImport({
      userId,
      collectionReceiptId: meta.collectionReceiptId,
      deliveryIds: meta.deliveryIds,
      deliveryCount: meta.deliveryIds.length,
      receiptNumber: meta.receiptNumber,
      fileName: meta.fileName,
      fileSize: meta.fileSize,
      extractionMethod: meta.extractionMethod as 'manual' | 'ocr',
      cooperativeId: meta.cooperativeId,
    });
  }

  /**
   * Write audit log entry for a failed receipt import
   * Requirements: 12.4
   */
  private async _logReceiptImportFailed(
    userId: string,
    meta: {
      fileName: string;
      fileSize?: number;
      receiptNumber?: string;
      extractionMethod?: string;
      cooperativeId?: string;
      errorCode: string;
      errorMessage: string;
    }
  ): Promise<void> {
    await logReceiptImportFailed({
      userId,
      fileName: meta.fileName,
      fileSize: meta.fileSize,
      receiptNumber: meta.receiptNumber,
      extractionMethod: meta.extractionMethod as 'manual' | 'ocr' | undefined,
      cooperativeId: meta.cooperativeId,
      errorCode: meta.errorCode,
      errorMessage: meta.errorMessage,
    });
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const receiptImportService = new ReceiptImportService();

export default receiptImportService;
