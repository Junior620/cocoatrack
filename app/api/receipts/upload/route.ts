import { NextRequest, NextResponse } from 'next/server';
import { uploadPdf } from '@/lib/services/receipt-upload-service';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { logReceiptUpload } from '@/lib/services/audit-log-service';

/**
 * POST /api/receipts/upload
 *
 * Uploads a PDF file to Supabase Storage for collection receipts.
 * Logs upload metadata for audit trail (Requirement 12.1).
 *
 * Requirements: 2.2, 2.3, 2.4, 8.1, 8.2, 9.4, 9.5, 12.1
 */
export async function POST(request: NextRequest) {
  try {
    // Authorization check — manager or admin only (Requirement 8.1)
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Non authentifié' } },
        { status: 401 }
      );
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single() as { data: { role: string } | null };

    if (!profile || !['manager', 'admin'].includes(profile.role)) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED_ROLE', message: 'Accès refusé' } },
        { status: 403 }
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file');
    const cooperativeId = formData.get('cooperativeId');
    const receiptNumber = formData.get('receiptNumber') ?? 'temp';

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: { code: 'MISSING_FILE', message: 'Aucun fichier fourni' } },
        { status: 400 }
      );
    }

    // cooperativeId can be "none" for receipts without cooperative
    const coopId = cooperativeId === 'none' || !cooperativeId ? null : String(cooperativeId);

    // Upload via service (handles validation + retry logic)
    const result = await uploadPdf(file, coopId, receiptNumber as string);

    if (!result.success) {
      const status =
        result.errorCode === 'INVALID_FILE_TYPE' || result.errorCode === 'FILE_TOO_LARGE'
          ? 400
          : result.errorCode === 'UNAUTHORIZED_ROLE'
          ? 403
          : 500;

      console.error('[api/receipts/upload] Upload failed:', result.errorCode, result.error);

      return NextResponse.json(
        { error: { code: result.errorCode, message: result.error } },
        { status }
      );
    }

    // Log upload metadata for audit trail (Requirement 12.1)
    await logReceiptUpload({
      userId: user.id,
      fileName: result.fileName!,
      fileSize: result.fileSize!,
      cooperativeId: coopId,
      storagePath: result.storagePath!,
    });

    return NextResponse.json({
      pdfUrl: result.pdfUrl,
      storagePath: result.storagePath,
      fileSize: result.fileSize,
      fileName: result.fileName,
    });
  } catch (err) {
    console.error('[api/receipts/upload] Unexpected error:', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur interne du serveur' } },
      { status: 500 }
    );
  }
}
