/**
 * PATCH /api/parcelles/bulk-update
 * Actions en lot sur les parcelles (statut conformité, assignation planteur).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { createServerSupabaseClient } from '@/lib/supabase/server';

const BulkUpdateSchema = z.object({
  parcelle_ids: z.array(z.string().uuid()).min(1).max(100),
  conformity_status: z
    .enum(['conforme', 'non_conforme', 'en_cours', 'informations_manquantes'])
    .optional(),
  planteur_id: z.string().uuid().optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = BulkUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors.map((e) => e.message).join(', ') },
        { status: 400 }
      );
    }

    const { parcelle_ids, conformity_status, planteur_id } = parsed.data;

    if (!conformity_status && !planteur_id) {
      return NextResponse.json(
        { success: false, error: 'conformity_status ou planteur_id requis' },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (conformity_status) updatePayload.conformity_status = conformity_status;
    if (planteur_id) updatePayload.planteur_id = planteur_id;

    const results: { id: string; ok: boolean; error?: string }[] = [];

    for (const id of parcelle_ids) {
      const { error } = await supabase
        .from('parcelles')
        .update(updatePayload)
        .eq('id', id);

      results.push({
        id,
        ok: !error,
        error: error?.message,
      });
    }

    const updated = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok);

    return NextResponse.json({
      success: failed.length === 0,
      data: {
        updated,
        failed: failed.length,
        results,
      },
    });
  } catch (err) {
    console.error('[bulk-update parcelles]', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
