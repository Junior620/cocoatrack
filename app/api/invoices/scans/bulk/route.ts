// CocoaTrack V2 - Scanned Invoice Bulk Delete API Route
// DELETE /api/invoices/scans/bulk - Bulk delete scanned invoices (admin only)

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { applyRateLimit, addSecurityHeaders } from '@/lib/security/middleware';
import { deleteMultipleScannedInvoiceFiles } from '@/lib/services/scanned-invoice-storage';
import {
  logScannedInvoiceBulkDelete,
  getClientIP,
} from '@/lib/services/scanned-invoice-audit';
import { bulkDeleteScannedInvoicesSchema } from '@/lib/validations/scanned-invoice';
import { logDeleteError } from '@/lib/errors/scanned-invoice-errors';
import type { BulkDeleteScannedInvoicesResponse } from '@/types/scanned-invoices';

/**
 * DELETE /api/invoices/scans/bulk
 * 
 * Bulk delete scanned invoice files (admin only).
 * Handles partial failures gracefully - returns count of successful deletions
 * and list of failed deletions with error messages.
 * 
 * Requirements: 6.2
 */
export async function DELETE(request: NextRequest) {
  // Apply rate limiting
  const { allowed, response: rateLimitResponse } = applyRateLimit(request, 'api');
  if (!allowed && rateLimitResponse) {
    return rateLimitResponse;
  }

  const clientIP = getClientIP(request);

  try {
    // Create Supabase client
    const supabase = await createServerSupabaseClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      const response = NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
      addSecurityHeaders(response);
      return response;
    }

    // Check if user is admin (only admins can delete)
    const { data: isAdmin } = await supabase.rpc('is_admin');
    
    if (!isAdmin) {
      const response = NextResponse.json(
        { error: 'Permissions insuffisantes. Seuls les admins peuvent supprimer des fichiers.' },
        { status: 403 }
      );
      addSecurityHeaders(response);
      return response;
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch (parseError) {
      // Log parse error
      logDeleteError(parseError as Error, {
        user_id: user.id,
        ip_address: clientIP,
      });

      const response = NextResponse.json(
        { error: 'Corps de requête invalide' },
        { status: 400 }
      );
      addSecurityHeaders(response);
      return response;
    }

    const parseResult = bulkDeleteScannedInvoicesSchema.safeParse(body);
    
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0];
      
      // Log validation error
      logDeleteError(new Error(`Validation error: ${firstError.message}`), {
        user_id: user.id,
        ip_address: clientIP,
      });

      const response = NextResponse.json(
        { error: firstError.message },
        { status: 400 }
      );
      addSecurityHeaders(response);
      return response;
    }

    const { scan_ids } = parseResult.data;

    // Fetch all scanned invoices to get storage paths
    const { data: scannedInvoices, error: fetchError } = await supabase
      .from('scanned_invoices')
      .select('id, invoice_id, storage_path, original_filename')
      .in('id', scan_ids) as { 
        data: Array<{ 
          id: string; 
          invoice_id: string; 
          storage_path: string; 
          original_filename: string 
        }> | null; 
        error: unknown 
      };

    if (fetchError) {
      console.error('[DELETE /api/invoices/scans/bulk] Fetch error:', fetchError);
      
      // Log fetch error
      logDeleteError((fetchError as Error), {
        user_id: user.id,
        ip_address: clientIP,
      });

      const response = NextResponse.json(
        { error: 'Erreur lors de la récupération des fichiers' },
        { status: 500 }
      );
      addSecurityHeaders(response);
      return response;
    }

    if (!scannedInvoices || scannedInvoices.length === 0) {
      const response = NextResponse.json(
        { error: 'Aucun fichier trouvé' },
        { status: 404 }
      );
      addSecurityHeaders(response);
      return response;
    }

    // Track results
    let deletedCount = 0;
    const failed: Array<{ id: string; error: string }> = [];

    // Delete each scanned invoice
    for (const scan of scannedInvoices) {
      try {
        // Delete from storage
        const deleteStorageResult = await deleteMultipleScannedInvoiceFiles([scan.storage_path]);

        if (!deleteStorageResult.success) {
          console.error(`[DELETE /api/invoices/scans/bulk] Storage deletion failed for ${scan.id}:`, deleteStorageResult.error);
          
          // Log storage deletion error
          logDeleteError(new Error(deleteStorageResult.error || 'Storage deletion failed'), {
            user_id: user.id,
            scanned_invoice_id: scan.id,
            storage_path: scan.storage_path,
            ip_address: clientIP,
          });

          // Continue with database deletion even if storage deletion fails
        }

        // Delete from database
        const { error: dbDeleteError } = await supabase
          .from('scanned_invoices')
          .delete()
          .eq('id', scan.id);

        if (dbDeleteError) {
          console.error(`[DELETE /api/invoices/scans/bulk] Database deletion failed for ${scan.id}:`, dbDeleteError);
          
          // Log database deletion error
          logDeleteError(dbDeleteError, {
            user_id: user.id,
            scanned_invoice_id: scan.id,
            storage_path: scan.storage_path,
            ip_address: clientIP,
          });

          failed.push({
            id: scan.id,
            error: 'Échec de la suppression de l\'enregistrement',
          });
        } else {
          deletedCount++;
        }
      } catch (error) {
        console.error(`[DELETE /api/invoices/scans/bulk] Unexpected error for ${scan.id}:`, error);
        
        // Log unexpected error
        logDeleteError(error as Error, {
          user_id: user.id,
          scanned_invoice_id: scan.id,
          storage_path: scan.storage_path,
          ip_address: clientIP,
        });

        failed.push({
          id: scan.id,
          error: 'Erreur inattendue',
        });
      }
    }

    // Log bulk deletion to audit logs
    await logScannedInvoiceBulkDelete(
      user.id,
      {
        operation: 'scanned_invoice_bulk_delete',
        deleted_count: deletedCount,
        failed_count: failed.length,
        scanned_invoice_ids: scan_ids,
      },
      clientIP
    );

    // Build response
    const responseData: BulkDeleteScannedInvoicesResponse = {
      deleted: deletedCount,
      failed,
    };

    const response = NextResponse.json(responseData);
    addSecurityHeaders(response);
    return response;
  } catch (error) {
    console.error('[DELETE /api/invoices/scans/bulk] Unexpected error:', error);
    
    // Log unexpected error
    logDeleteError(error as Error, {
      ip_address: clientIP,
    });

    const response = NextResponse.json(
      { error: 'Erreur inattendue' },
      { status: 500 }
    );
    addSecurityHeaders(response);
    return response;
  }
}
