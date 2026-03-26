/**
 * Audit Log Service for Receipt Imports
 *
 * Provides structured audit logging for receipt import operations.
 * Uses the existing audit_logs table schema.
 *
 * Requirements: 12.1, 12.2, 12.3, 12.4, 13.6
 */

import { createServerSupabaseClient } from '@/lib/supabase/server';

// ============================================================================
// Types
// ============================================================================

export interface ReceiptImportLogParams {
  userId: string;
  collectionReceiptId: string;
  deliveryIds: string[];
  receiptNumber: string;
  fileName: string;
  fileSize: number;
  extractionMethod: 'manual' | 'ocr';
  cooperativeId: string;
  deliveryCount: number;
}

export interface ReceiptImportFailedLogParams {
  userId: string;
  fileName: string;
  fileSize?: number;
  receiptNumber?: string;
  extractionMethod?: 'manual' | 'ocr';
  cooperativeId?: string;
  errorCode: string;
  errorMessage: string;
}

export interface OcrPerformanceLogParams {
  userId: string;
  pdfUrl: string;
  extractionTimeMs: number;
  confidenceScore: number;
  success: boolean;
  errorCode?: string;
}

export interface UploadLogParams {
  userId: string;
  fileName: string;
  fileSize: number;
  cooperativeId: string | null;
  storagePath: string;
}

// ============================================================================
// Service
// ============================================================================

/**
 * Log a successful receipt import.
 * Creates an audit log entry with action "receipt_imported".
 * Requirements: 12.1, 12.2
 */
export async function logReceiptImport(params: ReceiptImportLogParams): Promise<void> {
  try {
    const supabase = await createServerSupabaseClient();
    await supabase.from('audit_logs').insert({
      actor_id: params.userId,
      actor_type: 'user',
      action: 'receipt_imported',
      table_name: 'collection_receipts',
      row_id: params.collectionReceiptId,
      old_data: null,
      new_data: {
        collection_receipt_id: params.collectionReceiptId,
        delivery_ids: params.deliveryIds,
        delivery_count: params.deliveryCount,
        receipt_number: params.receiptNumber,
        file_name: params.fileName,
        file_size: params.fileSize,
        extraction_method: params.extractionMethod,
        cooperative_id: params.cooperativeId,
      },
    } as any);
  } catch (err) {
    // Audit log failure must not break the main flow
    console.error('[audit-log-service] logReceiptImport failed:', err, params);
  }
}

/**
 * Log a failed receipt import attempt.
 * Creates an audit log entry with action "receipt_import_failed".
 * Requirements: 12.4
 */
export async function logReceiptImportFailed(params: ReceiptImportFailedLogParams): Promise<void> {
  try {
    const supabase = await createServerSupabaseClient();
    await supabase.from('audit_logs').insert({
      actor_id: params.userId,
      actor_type: 'user',
      action: 'receipt_import_failed',
      table_name: 'collection_receipts',
      row_id: params.receiptNumber ?? 'unknown',
      old_data: null,
      new_data: {
        file_name: params.fileName,
        file_size: params.fileSize ?? null,
        receipt_number: params.receiptNumber ?? null,
        extraction_method: params.extractionMethod ?? null,
        cooperative_id: params.cooperativeId ?? null,
        error_code: params.errorCode,
        error_message: params.errorMessage,
      },
    } as any);
  } catch (err) {
    console.error('[audit-log-service] logReceiptImportFailed failed:', err, params);
  }
}

/**
 * Log OCR performance metrics.
 * Creates an audit log entry with action "ocr_extraction".
 * Requirements: 13.6
 */
export async function logOcrPerformance(params: OcrPerformanceLogParams): Promise<void> {
  try {
    const supabase = await createServerSupabaseClient();
    await supabase.from('audit_logs').insert({
      actor_id: params.userId,
      actor_type: 'user',
      action: 'ocr_extraction',
      table_name: 'collection_receipts',
      row_id: params.pdfUrl,
      old_data: null,
      new_data: {
        pdf_url: params.pdfUrl,
        extraction_time_ms: params.extractionTimeMs,
        confidence_score: params.confidenceScore,
        success: params.success,
        error_code: params.errorCode ?? null,
      },
    } as any);
  } catch (err) {
    console.error('[audit-log-service] logOcrPerformance failed:', err, params);
  }
}

/**
 * Log a PDF upload event.
 * Requirements: 12.1
 */
export async function logReceiptUpload(params: UploadLogParams): Promise<void> {
  try {
    const supabase = await createServerSupabaseClient();
    await supabase.from('audit_logs').insert({
      actor_id: params.userId,
      actor_type: 'user',
      action: 'INSERT',
      table_name: 'collection_receipts',
      row_id: params.storagePath,
      old_data: null,
      new_data: {
        file_name: params.fileName,
        file_size: params.fileSize,
        cooperative_id: params.cooperativeId,
        storage_path: params.storagePath,
      },
    } as any);
  } catch (err) {
    console.error('[audit-log-service] logReceiptUpload failed:', err, params);
  }
}
