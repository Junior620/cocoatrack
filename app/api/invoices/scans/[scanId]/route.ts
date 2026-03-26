// CocoaTrack V2 - Scanned Invoice Delete API Route
// DELETE /api/invoices/scans/[scanId] - Delete a scanned invoice (admin only)

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { applyRateLimit, addSecurityHeaders } from '@/lib/security/middleware';
import { deleteScannedInvoiceFile } from '@/lib/services/scanned-invoice-storage';
import {
  logScannedInvoiceDelete,
  getClientIP,
} from '@/lib/services/scanned-invoice-audit';
import { logDeleteError } from '@/lib/errors/scanned-invoice-errors';

/**
 * DELETE /api/invoices/scans/[scanId]
 * 
 * Delete a scanned invoice file (admin only).
 * Deletes both the storage file and the database record.
 * 
 * Requirements: 6.1, 6.3, 6.4
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ scanId: string }> }
) {
  // Apply rate limiting
  const { allowed, response: rateLimitResponse } = applyRateLimit(request, 'api');
  if (!allowed && rateLimitResponse) {
    return rateLimitResponse;
  }

  const clientIP = getClientIP(request);

  try {
    const { scanId } = await params;

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

    // Fetch scanned invoice to get storage path and metadata
    const { data: scannedInvoice, error: fetchError } = await supabase
      .from('scanned_invoices')
      .select('id, invoice_id, storage_path, original_filename')
      .eq('id', scanId)
      .single() as { 
        data: { 
          id: string; 
          invoice_id: string; 
          storage_path: string; 
          original_filename: string 
        } | null; 
        error: unknown 
      };

    if (fetchError || !scannedInvoice) {
      // Log not found error
      logDeleteError((fetchError as Error) || new Error('Scanned invoice not found'), {
        user_id: user.id,
        scanned_invoice_id: scanId,
        ip_address: clientIP,
      });

      const response = NextResponse.json(
        { error: 'Fichier scanné non trouvé' },
        { status: 404 }
      );
      addSecurityHeaders(response);
      return response;
    }

    // Delete from storage first
    const deleteStorageResult = await deleteScannedInvoiceFile(scannedInvoice.storage_path);

    if (!deleteStorageResult.success) {
      console.error('[DELETE /api/invoices/scans/[scanId]] Storage deletion failed:', deleteStorageResult.error);
      
      // Log storage deletion error
      logDeleteError(new Error(deleteStorageResult.error || 'Storage deletion failed'), {
        user_id: user.id,
        scanned_invoice_id: scanId,
        storage_path: scannedInvoice.storage_path,
        ip_address: clientIP,
      });

      // Continue with database deletion even if storage deletion fails
      // The file will be cleaned up by a periodic cleanup job
    }

    // Delete from database
    const { error: dbDeleteError } = await supabase
      .from('scanned_invoices')
      .delete()
      .eq('id', scanId);

    if (dbDeleteError) {
      console.error('[DELETE /api/invoices/scans/[scanId]] Database deletion failed:', dbDeleteError);
      
      // Log database deletion error
      logDeleteError(dbDeleteError, {
        user_id: user.id,
        scanned_invoice_id: scanId,
        storage_path: scannedInvoice.storage_path,
        ip_address: clientIP,
      });

      const response = NextResponse.json(
        { error: 'Échec de la suppression de l\'enregistrement' },
        { status: 500 }
      );
      addSecurityHeaders(response);
      return response;
    }

    // Log deletion to audit logs
    await logScannedInvoiceDelete(
      user.id,
      {
        operation: 'scanned_invoice_delete',
        invoice_id: scannedInvoice.invoice_id,
        scanned_invoice_id: scannedInvoice.id,
        storage_path: scannedInvoice.storage_path,
        original_filename: scannedInvoice.original_filename,
      },
      clientIP
    );

    // Return 204 No Content
    const response = new NextResponse(null, { status: 204 });
    addSecurityHeaders(response);
    return response;
  } catch (error) {
    console.error('[DELETE /api/invoices/scans/[scanId]] Unexpected error:', error);
    
    // Log unexpected error
    const { scanId } = await params;
    logDeleteError(error as Error, {
      scanned_invoice_id: scanId,
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
