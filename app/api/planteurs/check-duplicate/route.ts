/**
 * GET /api/planteurs/check-duplicate?name=...&cooperative_id=...
 * Vérifie si un planteur avec le même name_norm existe déjà dans la coopérative.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { detectDuplicate } from '@/lib/services/planteur-duplicate-detector';

const QuerySchema = z.object({
  name: z.string().min(2).max(100),
  cooperative_id: z.string().uuid().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = QuerySchema.safeParse({
      name: searchParams.get('name') || '',
      cooperative_id: searchParams.get('cooperative_id') || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Paramètres invalides' },
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

    let cooperativeId = parsed.data.cooperative_id;

    if (!cooperativeId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('cooperative_id')
        .eq('id', user.id)
        .maybeSingle();
      cooperativeId = (profile as { cooperative_id: string | null } | null)?.cooperative_id ?? undefined;
    }

    if (!cooperativeId) {
      return NextResponse.json({
        success: true,
        data: { duplicate: null, message: 'Coopérative non définie — détection impossible' },
      });
    }

    const duplicate = await detectDuplicate(supabase, parsed.data.name, cooperativeId);

    return NextResponse.json({
      success: true,
      data: { duplicate },
    });
  } catch (err) {
    console.error('[check-duplicate]', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
