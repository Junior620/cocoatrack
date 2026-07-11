import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { receiptParser } from '@/lib/services/receipt-parser';

/**
 * POST /api/receipts/parse
 *
 * Parses OCR-extracted text using ReceiptParser.
 * Returns structured data with confidence indicators per field.
 *
 * Requirements: 14.1-14.13
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check, manager or admin only
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

    // Parse body
    let body: { text?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_BODY', message: 'Corps de requête invalide' } },
        { status: 400 }
      );
    }

    const { text } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: { code: 'MISSING_TEXT', message: 'text est requis' } },
        { status: 400 }
      );
    }

    // Parse the OCR text
    const parsed = receiptParser.parse(text);

    return NextResponse.json(parsed);
  } catch (err) {
    console.error('[api/receipts/parse] Unexpected error:', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur interne du serveur' } },
      { status: 500 }
    );
  }
}
