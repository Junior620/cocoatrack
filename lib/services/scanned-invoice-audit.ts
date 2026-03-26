// CocoaTrack V2 - Scanned Invoice Audit Logging Service
// Logs all operations on scanned invoices for compliance and security

import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database.gen';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Audit action types for scanned invoices
 */
export type ScannedInvoiceAuditAction = 'INSERT' | 'UPDATE' | 'DELETE' | 'SELECT';

/**
 * Metadata for upload audit log
 */
export interface UploadAuditMetadata {
  operation: 'scanned_invoice_upload';
  invoice_id: string;
  scanned_invoice_id: string;
  storage_path: string;
  original_filename: string;
  file_size_bytes: number;
  mime_type: string;
  cooperative_id?: string;
}

/**
 * Metadata for download audit log
 */
export interface DownloadAuditMetadata {
  operation: 'scanned_invoice_download';
  invoice_id: string;
  scanned_invoice_id: string;
  storage_path: string;
  original_filename: string;
}

/**
 * Metadata for delete audit log
 */
export interface DeleteAuditMetadata {
  operation: 'scanned_invoice_delete';
  invoice_id: string;
  scanned_invoice_id: string;
  storage_path: string;
  original_filename: string;
  reason?: string;
}

/**
 * Metadata for bulk delete audit log
 */
export interface BulkDeleteAuditMetadata {
  operation: 'scanned_invoice_bulk_delete';
  deleted_count: number;
  failed_count: number;
  scanned_invoice_ids: string[];
  reason?: string;
}

/**
 * Union type for all audit metadata
 */
export type ScannedInvoiceAuditMetadata =
  | UploadAuditMetadata
  | DownloadAuditMetadata
  | DeleteAuditMetadata
  | BulkDeleteAuditMetadata;

/**
 * Result of audit log creation
 */
export interface AuditLogResult {
  success: boolean;
  error?: string;
}

// ============================================================================
// AUDIT LOG CREATION
// ============================================================================

/**
 * Create an audit log entry for scanned invoice operations
 * 
 * This function logs all operations on scanned invoices to the audit_logs table.
 * It does not throw errors to prevent audit logging failures from breaking
 * the main operation.
 * 
 * @param action - The audit action (INSERT, UPDATE, DELETE, SELECT)
 * @param userId - The user performing the action
 * @param metadata - Operation-specific metadata
 * @param ipAddress - Optional IP address of the user
 * @returns Audit log result
 */
async function createAuditLog(
  action: ScannedInvoiceAuditAction,
  userId: string,
  metadata: ScannedInvoiceAuditMetadata,
  ipAddress?: string
): Promise<AuditLogResult> {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Create audit log entry
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('audit_logs') as any).insert({
      actor_id: userId,
      actor_type: 'user',
      action,
      table_name: 'scanned_invoices',
      row_id: 'scanned_invoice_id' in metadata ? metadata.scanned_invoice_id : null,
      metadata: metadata,
      ip_address: ipAddress || null,
    });
    
    if (error) {
      console.error('[scanned-invoice-audit] Failed to create audit log:', error);
      return {
        success: false,
        error: error.message,
      };
    }
    
    return { success: true };
  } catch (error) {
    console.error('[scanned-invoice-audit] Unexpected error creating audit log:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// UPLOAD AUDIT LOGGING
// ============================================================================

/**
 * Log a scanned invoice upload operation
 * 
 * @param userId - The user who uploaded the file
 * @param metadata - Upload metadata
 * @param ipAddress - Optional IP address
 * @returns Audit log result
 * 
 * @see Requirements 10.1
 */
export async function logScannedInvoiceUpload(
  userId: string,
  metadata: UploadAuditMetadata,
  ipAddress?: string
): Promise<AuditLogResult> {
  return createAuditLog('INSERT', userId, metadata, ipAddress);
}

// ============================================================================
// DOWNLOAD AUDIT LOGGING
// ============================================================================

/**
 * Log a scanned invoice download operation
 * 
 * @param userId - The user who downloaded the file
 * @param metadata - Download metadata
 * @param ipAddress - Optional IP address
 * @returns Audit log result
 * 
 * @see Requirements 10.2
 */
export async function logScannedInvoiceDownload(
  userId: string,
  metadata: DownloadAuditMetadata,
  ipAddress?: string
): Promise<AuditLogResult> {
  return createAuditLog('SELECT', userId, metadata, ipAddress);
}

// ============================================================================
// DELETE AUDIT LOGGING
// ============================================================================

/**
 * Log a scanned invoice delete operation
 * 
 * @param userId - The user (admin) who deleted the file
 * @param metadata - Delete metadata
 * @param ipAddress - Optional IP address
 * @returns Audit log result
 * 
 * @see Requirements 10.3
 */
export async function logScannedInvoiceDelete(
  userId: string,
  metadata: DeleteAuditMetadata,
  ipAddress?: string
): Promise<AuditLogResult> {
  return createAuditLog('DELETE', userId, metadata, ipAddress);
}

/**
 * Log a bulk delete operation
 * 
 * @param userId - The user (admin) who performed the bulk delete
 * @param metadata - Bulk delete metadata
 * @param ipAddress - Optional IP address
 * @returns Audit log result
 * 
 * @see Requirements 10.3
 */
export async function logScannedInvoiceBulkDelete(
  userId: string,
  metadata: BulkDeleteAuditMetadata,
  ipAddress?: string
): Promise<AuditLogResult> {
  return createAuditLog('DELETE', userId, metadata, ipAddress);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get client IP address from request headers
 * 
 * @param request - The Next.js request object
 * @returns IP address or undefined
 */
export function getClientIP(request: Request): string | undefined {
  // Try various headers that might contain the client IP
  const headers = [
    'x-forwarded-for',
    'x-real-ip',
    'cf-connecting-ip', // Cloudflare
    'x-client-ip',
  ];
  
  for (const header of headers) {
    const value = request.headers.get(header);
    if (value) {
      // x-forwarded-for can contain multiple IPs, take the first one
      return value.split(',')[0].trim();
    }
  }
  
  return undefined;
}

/**
 * Query audit logs for a specific scanned invoice
 * 
 * @param scannedInvoiceId - The scanned invoice ID
 * @param limit - Maximum number of logs to return
 * @returns Array of audit log entries
 */
export async function getScannedInvoiceAuditLogs(
  scannedInvoiceId: string,
  limit: number = 50
): Promise<Database['public']['Tables']['audit_logs']['Row'][]> {
  try {
    const supabase = await createServerSupabaseClient();
    
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('table_name', 'scanned_invoices')
      .eq('row_id', scannedInvoiceId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('[scanned-invoice-audit] Failed to query audit logs:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('[scanned-invoice-audit] Unexpected error querying audit logs:', error);
    return [];
  }
}

/**
 * Query audit logs for all scanned invoices of an invoice
 * 
 * @param invoiceId - The invoice ID
 * @param limit - Maximum number of logs to return
 * @returns Array of audit log entries
 */
export async function getInvoiceScannedAuditLogs(
  invoiceId: string,
  limit: number = 100
): Promise<Database['public']['Tables']['audit_logs']['Row'][]> {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Query using metadata JSONB field
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('table_name', 'scanned_invoices')
      .contains('metadata', { invoice_id: invoiceId })
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('[scanned-invoice-audit] Failed to query invoice audit logs:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('[scanned-invoice-audit] Unexpected error querying invoice audit logs:', error);
    return [];
  }
}

/**
 * Get audit log statistics for a cooperative
 * 
 * @param cooperativeId - The cooperative ID
 * @returns Statistics object
 */
export async function getCooperativeAuditStats(
  cooperativeId: string
): Promise<{
  total_uploads: number;
  total_downloads: number;
  total_deletes: number;
}> {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Count uploads
    const { count: uploadCount } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('table_name', 'scanned_invoices')
      .eq('action', 'INSERT')
      .contains('metadata', { cooperative_id: cooperativeId });
    
    // Count downloads
    const { count: downloadCount } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('table_name', 'scanned_invoices')
      .eq('action', 'SELECT')
      .contains('metadata', { cooperative_id: cooperativeId });
    
    // Count deletes
    const { count: deleteCount } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('table_name', 'scanned_invoices')
      .eq('action', 'DELETE')
      .contains('metadata', { cooperative_id: cooperativeId });
    
    return {
      total_uploads: uploadCount || 0,
      total_downloads: downloadCount || 0,
      total_deletes: deleteCount || 0,
    };
  } catch (error) {
    console.error('[scanned-invoice-audit] Unexpected error getting audit stats:', error);
    return {
      total_uploads: 0,
      total_downloads: 0,
      total_deletes: 0,
    };
  }
}
