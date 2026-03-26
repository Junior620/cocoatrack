import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { receiptImportService } from '@/lib/services/receipt-import-service';
import { logReceiptImportFailed } from '@/lib/services/audit-log-service';
import type { ReceiptData } from '@/types/receipts';

/**
 * POST /api/receipts/create
 *
 * Creates a collection_receipt record, delivery records (one per product line),
 * and links them via receipt_deliveries. Handles transaction rollback on error.
 *
 * Requirements: 7.1-7.9, 8.3, 8.5
 */
export async function POST(request: NextRequest) {
  let userId: string | undefined;
  let requestData: Partial<ReceiptData> | undefined;

  try {
    // Auth check — manager or admin only (Requirement 8.1)
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
      .select('role, cooperative_id')
      .eq('id', user.id)
      .single() as { 
        data: { 
          role: string; 
          cooperative_id: string | null 
        } | null 
      };

    if (!profile || !['manager', 'admin'].includes(profile.role)) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED_ROLE', message: 'Accès refusé' } },
        { status: 403 }
      );
    }

    // Parse body
    let body: Partial<ReceiptData>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_BODY', message: 'Corps de requête invalide' } },
        { status: 400 }
      );
    }

    requestData = body;

    // Validate required fields
    const requiredFields: (keyof ReceiptData)[] = [
      'pdfUrl',
      'pdfFileName',
      'pdfFileSize',
      'planteurId',
      'contractNumber',
      'receiptNumber',
      'campaign',
      'transactionDate',
      'productLines',
      'payment',
      'extractionMethod',
    ];

    for (const field of requiredFields) {
      if (body[field] === undefined || body[field] === null || body[field] === '') {
        return NextResponse.json(
          {
            error: {
              code: 'MISSING_REQUIRED_FIELD',
              message: `Le champ '${field}' est obligatoire`,
              field,
            },
          },
          { status: 400 }
        );
      }
    }

    // chefPlanteurId OR chefPlanteurName is required
    if (!body.chefPlanteurId && !body.chefPlanteurName) {
      return NextResponse.json(
        {
          error: {
            code: 'MISSING_REQUIRED_FIELD',
            message: "Le nom de l'acheteur (collecteur) est obligatoire",
            field: 'chefPlanteurId',
          },
        },
        { status: 400 }
      );
    }

    const data = body as ReceiptData;

    // Validate product lines
    if (!Array.isArray(data.productLines) || data.productLines.length === 0) {
      return NextResponse.json(
        {
          error: {
            code: 'EMPTY_PRODUCT_LINES',
            message: 'Veuillez ajouter au moins une ligne de produit',
          },
        },
        { status: 400 }
      );
    }

    // Validate transaction date is not in the future
    const txDate = new Date(data.transactionDate);
    if (isNaN(txDate.getTime())) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_DATE',
            message: 'Format de date invalide',
            field: 'transactionDate',
          },
        },
        { status: 400 }
      );
    }
    if (txDate > new Date()) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_DATE',
            message: 'La date ne peut pas être dans le futur',
            field: 'transactionDate',
          },
        },
        { status: 400 }
      );
    }

    // Cooperative access check (Requirement 8.3)
    // Managers can only create for their own cooperative; admins can create for any
    if (
      profile.role === 'manager' &&
      profile.cooperative_id &&
      data.cooperativeId &&
      profile.cooperative_id !== data.cooperativeId
    ) {
      return NextResponse.json(
        {
          error: {
            code: 'COOPERATIVE_ACCESS_DENIED',
            message: 'Accès refusé à cette coopérative',
          },
        },
        { status: 403 }
      );
    }

    // Verify cooperative exists (only if provided)
    if (data.cooperativeId) {
      const { data: cooperative, error: coopError } = await supabase
        .from('cooperatives')
        .select('id')
        .eq('id', data.cooperativeId)
        .maybeSingle();

      if (coopError || !cooperative) {
        return NextResponse.json(
          {
            error: {
              code: 'COOPERATIVE_NOT_FOUND',
              message: 'Coopérative introuvable',
            },
          },
          { status: 404 }
        );
      }
    }

    // Verify planteur exists
    const { data: planteur, error: planteurError } = await supabase
      .from('planteurs')
      .select('id')
      .eq('id', data.planteurId)
      .maybeSingle();

    if (planteurError || !planteur) {
      return NextResponse.json(
        {
          error: {
            code: 'PLANTEUR_NOT_FOUND',
            message: 'Planteur introuvable',
          },
        },
        { status: 404 }
      );
    }

    // Verify chef planteur exists (only if ID provided)
    if (data.chefPlanteurId) {
      const { data: chefPlanteur, error: chefError } = await supabase
        .from('chef_planteurs')
        .select('id')
        .eq('id', data.chefPlanteurId)
        .maybeSingle();

      if (chefError || !chefPlanteur) {
        return NextResponse.json(
          {
            error: {
              code: 'CHEF_PLANTEUR_NOT_FOUND',
              message: 'Chef planteur introuvable',
            },
          },
          { status: 404 }
        );
      }
    }

    // Create deliveries from receipt (handles transaction + rollback internally)
    const result = await receiptImportService.createDeliveriesFromReceipt(data, user.id);

    return NextResponse.json(result, { status: 201 });
  } catch (err: unknown) {
    const error = err as { code?: string; message?: string };

    // Log failed import attempt (Requirement 12.4)
    if (userId && requestData?.pdfFileName) {
      await logReceiptImportFailed({
        userId,
        fileName: requestData.pdfFileName,
        fileSize: requestData.pdfFileSize,
        receiptNumber: requestData.receiptNumber,
        extractionMethod: requestData.extractionMethod,
        cooperativeId: requestData.cooperativeId,
        errorCode: error.code ?? 'UNKNOWN_ERROR',
        errorMessage: error.message ?? 'Erreur inconnue',
      });
    }

    if (error.code === 'DUPLICATE_RECEIPT_NUMBER') {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 409 }
      );
    }

    if (error.code === 'DATABASE_ERROR' || error.code === 'TRANSACTION_ROLLBACK') {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 500 }
      );
    }

    console.error('[api/receipts/create] Unexpected error:', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur interne du serveur' } },
      { status: 500 }
    );
  }
}
