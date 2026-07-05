import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  deleteWaybillDocument,
  getWaybillDocumentSignedUrl,
} from '@/lib/services/waybill-storage';

async function fetchWaybillDetail(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  id: string
) {
  const { data, error } = await supabase
    .from('delivery_waybills')
    .select(
      `
      *,
      waybill_deliveries(
        id,
        delivery_id,
        delivery:deliveries(id, code, weight_kg, planteur:planteurs(name, code))
      )
    `
    )
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as Record<string, unknown>;
  const links = (row.waybill_deliveries as Array<Record<string, unknown>>) || [];
  const linkedWeight = links.reduce(
    (sum, l) => sum + (Number((l.delivery as { weight_kg?: number })?.weight_kg) || 0),
    0
  );

  let document_url: string | null = null;
  if (row.document_storage_path) {
    document_url = await getWaybillDocumentSignedUrl(row.document_storage_path as string);
  }

  return {
    ...row,
    deliveries: links.map((l) => ({
      id: l.id,
      waybill_id: id,
      delivery_id: l.delivery_id,
      delivery: l.delivery,
    })),
    delivery_count: links.length,
    linked_weight_kg: linkedWeight,
    document_url,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const detail = await fetchWaybillDetail(supabase, id);
  if (!detail) {
    return NextResponse.json({ error: 'Lettre de voiture introuvable' }, { status: 404 });
  }

  return NextResponse.json(detail);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (!isAdmin) {
    return NextResponse.json({ error: 'Admin uniquement' }, { status: 403 });
  }

  const { data: waybill } = await supabase
    .from('delivery_waybills')
    .select('document_storage_path')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase.from('delivery_waybills').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const path = (waybill as { document_storage_path?: string } | null)?.document_storage_path;
  if (path) {
    try {
      await deleteWaybillDocument(path);
    } catch {
      /* ignore storage cleanup errors */
    }
  }

  return NextResponse.json({ success: true });
}
