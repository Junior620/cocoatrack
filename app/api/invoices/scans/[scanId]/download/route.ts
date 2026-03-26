// CocoaTrack V2 - Scanned Invoice Download API Route
// GET /api/invoices/scans/[scanId]/download - Generate signed URL for download

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { applyRateLimit, addSecurityHeaders } from '@/lib/security/middleware';
import { generateDownloadUrl } from '@/lib/services/scanned-invoice-storage';
import {
  logScannedInvoiceDownload,
  getClientIP,
} from '@/lib/services/scanned-invoice-audit';
import { logDownloadError } from '@/lib/errors/scanned-invoice-errors';
import type { ScannedInvoiceDownloadResponse } from '@/types/scanned-invoices';

/**
 * GET /api/invoices/scans/[scanId]/download
 * 
 * Generate a temporary signed URL (valid for 60 seconds) for downloading
 * a scanned invoice file.
 * 
 * Requirements: 4.1, 4.2, 5.2
 */
export async function GET(
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

    // Check if user is manager or admin
    const { data: isManagerOrAbove } = await supabase.rpc('is_manager_or_above');
    
    if (!isManagerOrAbove) {
      const response = NextResponse.json(
        { error: 'Permissions insuffisantes' },
        { status: 403 }
      );
      addSecurityHeaders(response);
      return response;
    }

    // Fetch scanned invoice (RLS will ensure user has access)
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
      logDownloadError((fetchError as Error) || new Error('Scanned invoice not found'), {
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

    // Generate signed URL (valid for 60 seconds)
    const downloadResult = await generateDownloadUrl(scannedInvoice.storage_path);

    if (!downloadResult.success || !downloadResult.url) {
      console.error('[GET /api/invoices/scans/[scanId]/download] URL generation failed:', downloadResult.error);
      
      // Log URL generation error
      logDownloadError(new Error(downloadResult.error || 'URL generation failed'), {
        user_id: user.id,
        scanned_invoice_id: scanId,
        storage_path: scannedInvoice.storage_path,
        ip_address: clientIP,
      });

      const response = NextResponse.json(
        { error: downloadResult.error || 'Impossible de générer l\'URL de téléchargement' },
        { status: 500 }
      );
      addSecurityHeaders(response);
      return response;
    }

    // Log download to audit logs
    await logScannedInvoiceDownload(
      user.id,
      {
        operation: 'scanned_invoice_download',
        invoice_id: scannedInvoice.invoice_id,
        scanned_invoice_id: scannedInvoice.id,
        storage_path: scannedInvoice.storage_path,
        original_filename: scannedInvoice.original_filename,
      },
      clientIP
    );

    // Return signed URL and filename
    const responseData: ScannedInvoiceDownloadResponse = {
      url: downloadResult.url,
      filename: scannedInvoice.original_filename,
    };

    const response = NextResponse.json(responseData);
    addSecurityHeaders(response);
    return response;
  } catch (error) {
    console.error('[GET /api/invoices/scans/[scanId]/download] Unexpected error:', error);
    
    // Log unexpected error
    const { scanId } = await params;
    logDownloadError(error as Error, {
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
