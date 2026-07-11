import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { receiptImportService } from '@/lib/services/receipt-import-service';

/**
 * POST /api/receipts/detect-duplicates
 *
 * Detects similar receipts by: same planteur, same chef planteur, same date,
 * weight within ±5%.
 * Returns duplicate list with similarity scores.
 *
 * Requirements: 17.5
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
    let body: {
      planteurId?: string;
      chefPlanteurId?: string;
      transactionDate?: string;
      totalWeight?: number;
      cooperativeId?: string;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_BODY', message: 'Corps de requête invalide' } },
        { status: 400 }
      );
    }

    const { planteurId, chefPlanteurId, transactionDate, totalWeight, cooperativeId } = body;

    // Validate required fields
    if (!planteurId) {
      return NextResponse.json(
        { error: { code: 'MISSING_FIELD', message: 'planteurId est requis', field: 'planteurId' } },
        { status: 400 }
      );
    }
    if (!chefPlanteurId) {
      return NextResponse.json(
        { error: { code: 'MISSING_FIELD', message: 'chefPlanteurId est requis', field: 'chefPlanteurId' } },
        { status: 400 }
      );
    }
    if (!transactionDate) {
      return NextResponse.json(
        { error: { code: 'MISSING_FIELD', message: 'transactionDate est requis', field: 'transactionDate' } },
        { status: 400 }
      );
    }
    if (totalWeight === undefined || totalWeight === null) {
      return NextResponse.json(
        { error: { code: 'MISSING_FIELD', message: 'totalWeight est requis', field: 'totalWeight' } },
        { status: 400 }
      );
    }
    if (!cooperativeId) {
      return NextResponse.json(
        { error: { code: 'MISSING_FIELD', message: 'cooperativeId est requis', field: 'cooperativeId' } },
        { status: 400 }
      );
    }

    const duplicates = await receiptImportService.detectDuplicates({
      planteurId,
      chefPlanteurId,
      transactionDate,
      totalWeight,
      cooperativeId,
    });

    return NextResponse.json({ duplicates });
  } catch (err) {
    console.error('[api/receipts/detect-duplicates] Unexpected error:', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur interne du serveur' } },
      { status: 500 }
    );
  }
}
