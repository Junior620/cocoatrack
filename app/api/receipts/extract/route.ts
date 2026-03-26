import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { receiptImportService } from '@/lib/services/receipt-import-service';
import { logOcrPerformance } from '@/lib/services/audit-log-service';

/**
 * POST /api/receipts/extract
 *
 * Calls the OCR service to extract text from a PDF.
 * Handles 30-second timeout.
 * Logs OCR performance metrics for monitoring (Requirement 13.6).
 *
 * Requirements: 4.1, 4.2, 13.4, 13.6
 */
export async function POST(request: NextRequest) {
  let userId: string | undefined;
  let pdfUrl: string | undefined;
  const startTime = Date.now();

  try {
    // Auth check — manager or admin only
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

    userId = user.id;

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

    // Parse body
    let body: { pdfUrl?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_BODY', message: 'Corps de requête invalide' } },
        { status: 400 }
      );
    }

    pdfUrl = body.pdfUrl;

    if (!pdfUrl || typeof pdfUrl !== 'string') {
      return NextResponse.json(
        { error: { code: 'MISSING_PDF_URL', message: 'pdfUrl est requis' } },
        { status: 400 }
      );
    }

    // Extract text via OCR service (handles timeout internally)
    const result = await receiptImportService.extractText(pdfUrl);

    // Log OCR performance metrics (Requirement 13.6)
    await logOcrPerformance({
      userId: user.id,
      pdfUrl,
      extractionTimeMs: result.extractionTime,
      confidenceScore: result.confidence,
      success: true,
    });

    return NextResponse.json({
      text: result.text,
      confidence: result.confidence,
      extractionTime: result.extractionTime,
    });
  } catch (err: unknown) {
    const error = err as { code?: string; message?: string };

    // Log OCR failure metrics if we have enough context (Requirement 13.6)
    if (userId && pdfUrl) {
      await logOcrPerformance({
        userId,
        pdfUrl,
        extractionTimeMs: Date.now() - startTime,
        confidenceScore: 0,
        success: false,
        errorCode: error.code ?? 'UNKNOWN_ERROR',
      });
    }

    if (error.code === 'OCR_SERVICE_UNAVAILABLE') {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 503 }
      );
    }

    if (error.code === 'OCR_TIMEOUT') {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 504 }
      );
    }

    if (error.code === 'OCR_EXTRACTION_FAILED') {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 422 }
      );
    }

    console.error('[api/receipts/extract] Unexpected error:', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur interne du serveur' } },
      { status: 500 }
    );
  }
}
