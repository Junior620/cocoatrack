// CocoaTrack V2 - Scanned Invoices API Routes
// POST /api/invoices/[id]/scans - Upload a scanned invoice file
// GET /api/invoices/[id]/scans - List scanned invoices for an invoice

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { applyRateLimit, addSecurityHeaders } from '@/lib/security/middleware';
import {
  validateScannedInvoiceFile,
  validateAttachmentLimit,
} from '@/lib/services/scanned-invoice-validation';
import {
  uploadScannedInvoiceFile,
  deleteScannedInvoiceFile,
} from '@/lib/services/scanned-invoice-storage';
import {
  logScannedInvoiceUpload,
  getClientIP,
} from '@/lib/services/scanned-invoice-audit';
import {
  logUploadError,
  formatErrorResponse,
  getErrorStatusCode,
} from '@/lib/errors/scanned-invoice-errors';
import {
  generatePdfThumbnail,
  isPdfFile,
  generateThumbnailPath,
} from '@/lib/services/thumbnail-service';
import type {
  ScannedInvoice,
  ScannedInvoiceWithUser,
  ScannedInvoiceListResponse,
} from '@/types/scanned-invoices';

/**
 * POST /api/invoices/[id]/scans
 * 
 * Upload a scanned invoice file (PDF or image) and attach it to an invoice.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 5.1, 7.7
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Apply rate limiting
  const { allowed, response: rateLimitResponse } = applyRateLimit(request, 'api');
  if (!allowed && rateLimitResponse) {
    return rateLimitResponse;
  }

  const clientIP = getClientIP(request);
  let uploadedStoragePath: string | undefined;
  let uploadedThumbnailPath: string | undefined;

  try {
    const { id: invoiceId } = await params;

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
        { error: 'Permissions insuffisantes. Seuls les managers et admins peuvent uploader des fichiers.' },
        { status: 403 }
      );
      addSecurityHeaders(response);
      return response;
    }

    // Verify invoice exists and user has access to it
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('id, cooperative_id')
      .eq('id', invoiceId)
      .single() as unknown as { data: { id: string; cooperative_id: string | null } | null; error: unknown };

    if (invoiceError || !invoice) {
      const response = NextResponse.json(
        { error: 'Facture non trouvée' },
        { status: 404 }
      );
      addSecurityHeaders(response);
      return response;
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      const response = NextResponse.json(
        { error: 'Aucun fichier fourni' },
        { status: 400 }
      );
      addSecurityHeaders(response);
      return response;
    }

    // Check current attachment count
    const { count: currentCount, error: countError } = await supabase
      .from('scanned_invoices')
      .select('*', { count: 'exact', head: true })
      .eq('invoice_id', invoiceId);

    if (countError) {
      console.error('[POST /api/invoices/[id]/scans] Error counting attachments:', countError);
      
      // Log error with full context
      logUploadError(countError, {
        user_id: user.id,
        invoice_id: invoiceId,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        ip_address: clientIP,
      });

      const response = NextResponse.json(
        { error: 'Erreur lors de la vérification de la limite' },
        { status: 500 }
      );
      addSecurityHeaders(response);
      return response;
    }

    // Validate file (MIME type, size, attachment limit)
    const validationResult = validateScannedInvoiceFile(
      { type: file.type, size: file.size },
      currentCount || 0
    );

    if (!validationResult.valid) {
      // Log validation error
      const validationError = new Error(validationResult.error || 'Validation failed');
      logUploadError(validationError, {
        user_id: user.id,
        invoice_id: invoiceId,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        ip_address: clientIP,
      });

      const response = NextResponse.json(
        { error: validationResult.error, error_code: validationResult.errorCode },
        { status: 400 }
      );
      addSecurityHeaders(response);
      return response;
    }

    // Upload file to Supabase Storage
    const uploadResult = await uploadScannedInvoiceFile(
      file,
      invoice.cooperative_id ?? undefined,
      invoiceId,
      file.name
    );

    if (!uploadResult.success || !uploadResult.storagePath) {
      console.error('[POST /api/invoices/[id]/scans] Upload failed:', uploadResult.error);
      
      // Log upload error
      const uploadError = new Error(uploadResult.error || 'Upload failed');
      logUploadError(uploadError, {
        user_id: user.id,
        invoice_id: invoiceId,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        ip_address: clientIP,
      });

      const response = NextResponse.json(
        { error: uploadResult.error || 'Échec de l\'upload', error_code: uploadResult.errorCode },
        { status: 500 }
      );
      addSecurityHeaders(response);
      return response;
    }

    // Store the uploaded path for cleanup if DB insert fails
    uploadedStoragePath = uploadResult.storagePath;

    // Generate thumbnail for PDF files (optional, non-blocking)
    let thumbnailPath: string | null = null;
    if (isPdfFile(file.type)) {
      try {
        console.log('[POST /api/invoices/[id]/scans] Generating thumbnail for PDF');
        
        // Read file buffer
        const fileBuffer = Buffer.from(await file.arrayBuffer());
        
        // Generate thumbnail
        const thumbnailResult = await generatePdfThumbnail(fileBuffer);
        
        if (thumbnailResult.success && thumbnailResult.thumbnailBuffer) {
          // Extract UUID from storage path for thumbnail naming
          const pathParts = uploadResult.storagePath.split('/');
          const filename = pathParts[pathParts.length - 1];
          const uuid = filename.split('_')[0];
          
          // Generate thumbnail storage path
          thumbnailPath = generateThumbnailPath(
            invoice.cooperative_id,
            invoiceId,
            uuid
          );
          
          // Upload thumbnail to storage
          const { error: thumbnailUploadError } = await supabase.storage
            .from('invoice-scans')
            .upload(thumbnailPath, thumbnailResult.thumbnailBuffer, {
              contentType: 'image/jpeg',
              upsert: false,
            });
          
          if (thumbnailUploadError) {
            console.error('[POST /api/invoices/[id]/scans] Thumbnail upload failed:', thumbnailUploadError);
            // Don't fail the entire upload if thumbnail fails
            thumbnailPath = null;
          } else {
            console.log('[POST /api/invoices/[id]/scans] Thumbnail generated successfully:', thumbnailPath);
            // Store for cleanup if needed
            uploadedThumbnailPath = thumbnailPath;
          }
        } else {
          console.warn('[POST /api/invoices/[id]/scans] Thumbnail generation failed:', thumbnailResult.error);
        }
      } catch (thumbnailError) {
        console.error('[POST /api/invoices/[id]/scans] Thumbnail generation error:', thumbnailError);
        // Don't fail the entire upload if thumbnail generation fails
        thumbnailPath = null;
      }
    }

    // Create database record
    const { data: scannedInvoice, error: dbError } = await (supabase
      .from('scanned_invoices' as never)
      .insert({
        invoice_id: invoiceId,
        storage_path: uploadResult.storagePath,
        original_filename: file.name,
        file_size_bytes: file.size,
        mime_type: file.type,
        thumbnail_path: thumbnailPath,
        created_by: user.id,
      } as never)
      .select()
      .single() as unknown as Promise<{ data: Record<string, unknown> | null; error: unknown }>);

    if (dbError || !scannedInvoice) {
      console.error('[POST /api/invoices/[id]/scans] Database insert failed:', dbError);
      
      // Log database error
      logUploadError((dbError as Error | null) || new Error('Database insert failed'), {
        user_id: user.id,
        invoice_id: invoiceId,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        ip_address: clientIP,
      });

      // CRITICAL: Cleanup uploaded file from storage since DB insert failed
      // This prevents orphaned files in storage
      console.log('[POST /api/invoices/[id]/scans] Cleaning up uploaded file due to DB error:', uploadResult.storagePath);
      
      try {
        const cleanupResult = await deleteScannedInvoiceFile(uploadResult.storagePath);
        if (cleanupResult.success) {
          console.log('[POST /api/invoices/[id]/scans] Cleanup successful');
        } else {
          console.error('[POST /api/invoices/[id]/scans] Cleanup failed:', cleanupResult.error);
          // Log cleanup failure for manual intervention
          logUploadError(new Error(`Cleanup failed: ${cleanupResult.error}`), {
            user_id: user.id,
            invoice_id: invoiceId,
            file_name: file.name,
            ip_address: clientIP,
          });
        }
        
        // Also cleanup thumbnail if it was uploaded
        if (thumbnailPath) {
          console.log('[POST /api/invoices/[id]/scans] Cleaning up thumbnail:', thumbnailPath);
          await deleteScannedInvoiceFile(thumbnailPath);
        }
      } catch (cleanupError) {
        console.error('[POST /api/invoices/[id]/scans] Cleanup exception:', cleanupError);
        // Log cleanup exception
        logUploadError(cleanupError as Error, {
          user_id: user.id,
          invoice_id: invoiceId,
          file_name: file.name,
          ip_address: clientIP,
        });
      }

      const response = NextResponse.json(
        { error: 'Échec de la création de l\'enregistrement' },
        { status: 500 }
      );
      addSecurityHeaders(response);
      return response;
    }

    // Log upload to audit logs
    const scannedInvoiceRecord = scannedInvoice as Record<string, unknown>;
    await logScannedInvoiceUpload(
      user.id,
      {
        operation: 'scanned_invoice_upload',
        invoice_id: invoiceId,
        scanned_invoice_id: scannedInvoiceRecord.id as string,
        storage_path: uploadResult.storagePath,
        original_filename: file.name,
        file_size_bytes: file.size,
        mime_type: file.type,
        cooperative_id: invoice.cooperative_id ?? undefined,
      },
      clientIP
    );

    // Return created scanned invoice
    const response = NextResponse.json(scannedInvoice as unknown as ScannedInvoice, { status: 201 });
    addSecurityHeaders(response);
    return response;
  } catch (error) {
    console.error('[POST /api/invoices/[id]/scans] Unexpected error:', error);
    
    // Log unexpected error
    const { id: invoiceId } = await params;
    logUploadError(error as Error, {
      invoice_id: invoiceId,
      ip_address: clientIP,
    });

    // If we uploaded a file but hit an unexpected error, try to clean it up
    if (uploadedStoragePath) {
      console.log('[POST /api/invoices/[id]/scans] Cleaning up uploaded file due to unexpected error:', uploadedStoragePath);
      try {
        await deleteScannedInvoiceFile(uploadedStoragePath);
      } catch (cleanupError) {
        console.error('[POST /api/invoices/[id]/scans] Cleanup exception:', cleanupError);
      }
    }
    
    // Also cleanup thumbnail if it was uploaded
    if (uploadedThumbnailPath) {
      console.log('[POST /api/invoices/[id]/scans] Cleaning up thumbnail due to unexpected error:', uploadedThumbnailPath);
      try {
        await deleteScannedInvoiceFile(uploadedThumbnailPath);
      } catch (cleanupError) {
        console.error('[POST /api/invoices/[id]/scans] Thumbnail cleanup exception:', cleanupError);
      }
    }

    const response = NextResponse.json(
      { error: 'Erreur inattendue lors de l\'upload' },
      { status: 500 }
    );
    addSecurityHeaders(response);
    return response;
  }
}

/**
 * GET /api/invoices/[id]/scans
 * 
 * List all scanned invoices for a specific invoice.
 * Includes user information (created_by_name) via join.
 * 
 * Requirements: 3.1, 3.3, 5.2
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Apply rate limiting
  const { allowed, response: rateLimitResponse } = applyRateLimit(request, 'api');
  if (!allowed && rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const { id: invoiceId } = await params;

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

    // Verify invoice exists and user has access to it (RLS will handle this)
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('id')
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      const response = NextResponse.json(
        { error: 'Facture non trouvée' },
        { status: 404 }
      );
      addSecurityHeaders(response);
      return response;
    }

    // Fetch scanned invoices with user information
    const { data: scannedInvoices, error: fetchError } = await supabase
      .from('scanned_invoices')
      .select(`
        *,
        profiles!scanned_invoices_created_by_fkey (
          full_name
        )
      `)
      .eq('invoice_id', invoiceId)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('[GET /api/invoices/[id]/scans] Fetch error:', fetchError);
      const response = NextResponse.json(
        { error: 'Erreur lors de la récupération des fichiers' },
        { status: 500 }
      );
      addSecurityHeaders(response);
      return response;
    }

    // Transform data to include created_by_name
    const transformedData: ScannedInvoiceWithUser[] = (scannedInvoices || []).map((scan: any) => ({
      id: scan.id,
      invoice_id: scan.invoice_id,
      storage_path: scan.storage_path,
      original_filename: scan.original_filename,
      file_size_bytes: scan.file_size_bytes,
      mime_type: scan.mime_type,
      thumbnail_path: scan.thumbnail_path,
      created_by: scan.created_by,
      created_by_name: scan.profiles?.full_name || 'Utilisateur inconnu',
      created_at: scan.created_at,
    }));

    // Build response
    const responseData: ScannedInvoiceListResponse = {
      data: transformedData,
      total: transformedData.length,
    };

    const response = NextResponse.json(responseData);
    addSecurityHeaders(response);
    return response;
  } catch (error) {
    console.error('[GET /api/invoices/[id]/scans] Unexpected error:', error);
    const response = NextResponse.json(
      { error: 'Erreur inattendue' },
      { status: 500 }
    );
    addSecurityHeaders(response);
    return response;
  }
}
