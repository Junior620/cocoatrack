import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: waybillId } = await params;

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const { data: isAgentOrAbove } = await supabase.rpc('is_agent_or_above');
    if (!isAgentOrAbove) {
      return NextResponse.json({ error: 'Permissions insuffisantes' }, { status: 403 });
    }

    const body = await request.json();
    const deliveryIds: string[] = body.delivery_ids || [];

    if (!Array.isArray(deliveryIds)) {
      return NextResponse.json({ error: 'delivery_ids invalide' }, { status: 400 });
    }

    const { data: existing } = await supabase
      .from('waybill_deliveries')
      .select('delivery_id, waybill_id')
      .in('delivery_id', deliveryIds.length ? deliveryIds : ['00000000-0000-0000-0000-000000000000']);

    const conflict = (existing || []).find(
      (e: { waybill_id: string; delivery_id: string }) =>
        e.waybill_id !== waybillId && deliveryIds.includes(e.delivery_id)
    );
    if (conflict) {
      return NextResponse.json(
        { error: 'Une livraison est déjà rattachée à une autre lettre de voiture' },
        { status: 409 }
      );
    }

    // Replace links for this waybill
    await supabase.from('waybill_deliveries').delete().eq('waybill_id', waybillId);

    if (deliveryIds.length > 0) {
      const { error: linkError } = await supabase.from('waybill_deliveries').insert(
        deliveryIds.map((delivery_id) => ({ waybill_id: waybillId, delivery_id }))
      );
      if (linkError) {
        return NextResponse.json({ error: linkError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, count: deliveryIds.length });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
