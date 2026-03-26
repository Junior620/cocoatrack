import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { receiptImportService } from '@/lib/services/receipt-import-service';

/**
 * GET /api/receipts/validate-number
 *
 * Checks receipt number uniqueness within a cooperative.
 * Returns existing receipt info if found.
 *
 * Query params: receiptNumber, cooperativeId
 *
 * Requirements: 17.1, 17.2
 */
export async function GET(request: NextRequest) {
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

    // Parse query params
    const { searchParams } = new URL(request.url);
    const receiptNumber = searchParams.get('receiptNumber');
    const cooperativeId = searchParams.get('cooperativeId');

    if (!receiptNumber) {
      return NextResponse.json(
        {
          error: {
            code: 'MISSING_RECEIPT_NUMBER',
            message: 'receiptNumber est requis',
            field: 'receiptNumber',
          },
        },
        { status: 400 }
      );
    }

    if (!cooperativeId) {
      return NextResponse.json(
        {
          error: {
            code: 'MISSING_COOPERATIVE_ID',
            message: 'cooperativeId est requis',
            field: 'cooperativeId',
          },
        },
        { status: 400 }
      );
    }

    const result = await receiptImportService.validateReceiptNumber(receiptNumber, cooperativeId);

    return NextResponse.json(result);
  } catch (err: unknown) {
    const error = err as { code?: string; message?: string };

    if (error.code === 'DATABASE_ERROR') {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 500 }
      );
    }

    console.error('[api/receipts/validate-number] Unexpected error:', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur interne du serveur' } },
      { status: 500 }
    );
  }
}
