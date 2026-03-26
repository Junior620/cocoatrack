import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/planteurs?cooperativeId=<id>&limit=<n>&search=<q>
 *
 * Returns a list of planteurs, optionally filtered by cooperative and search query.
 * Used by useReceiptFormCache and PlanteurAutocomplete.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const cooperativeId = searchParams.get('cooperativeId');
    const search = searchParams.get('search') ?? '';
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 500);

    let query = supabase
      .from('planteurs')
      .select('id, name, code, phone, cooperative_id, cooperative:cooperatives!planteurs_cooperative_id_fkey(name)')
      .eq('is_active', true)
      .limit(limit)
      .order('name', { ascending: true });

    if (cooperativeId && cooperativeId !== 'none') {
      query = query.eq('cooperative_id', cooperativeId);
    }

    if (search.trim()) {
      query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[api/planteurs] Query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error('[api/planteurs] Unexpected error:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
