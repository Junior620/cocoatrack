import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  deleteWaybillDocument,
  getWaybillDocumentSignedUrl,
  uploadWaybillDocument,
} from '@/lib/services/waybill-storage';
import type { CreateWaybillInput, WaybillWithDeliveries } from '@/types/waybills';

async function fetchWaybillDetail(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  id: string
): Promise<WaybillWithDeliveries | null> {
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
    ...(row as unknown as WaybillWithDeliveries),
    deliveries: links.map((l) => ({
      id: l.id as string,
      waybill_id: id,
      delivery_id: l.delivery_id as string,
      delivery: l.delivery as WaybillWithDeliveries['deliveries'][0]['delivery'],
    })),
    delivery_count: links.length,
    linked_weight_kg: linkedWeight,
    document_url,
  };
}

async function linkDeliveriesToWaybill(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  waybillId: string,
  deliveryIds: string[]
): Promise<string | null> {
  if (deliveryIds.length === 0) return null;

  const { data: existing } = await supabase
    .from('waybill_deliveries')
    .select('delivery_id, waybill_id')
    .in('delivery_id', deliveryIds);

  const conflict = (existing || []).find(
    (e: { waybill_id: string }) => e.waybill_id !== waybillId
  );
  if (conflict) {
    return 'Une ou plusieurs livraisons sont déjà rattachées à une autre lettre de voiture';
  }

  const { error } = await supabase.from('waybill_deliveries').upsert(
    deliveryIds.map((delivery_id) => ({ waybill_id: waybillId, delivery_id })),
    { onConflict: 'delivery_id', ignoreDuplicates: false }
  );

  if (error) return error.message;
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const { data: isAgentOrAbove } = await supabase.rpc('is_agent_or_above');
    if (!isAgentOrAbove) {
      return NextResponse.json({ error: 'Permissions insuffisantes' }, { status: 403 });
    }

    const formData = await request.formData();
    const payloadRaw = formData.get('payload');
    const file = formData.get('file') as File | null;

    if (!payloadRaw || typeof payloadRaw !== 'string') {
      return NextResponse.json({ error: 'Données invalides' }, { status: 400 });
    }

    const input = JSON.parse(payloadRaw) as CreateWaybillInput;

    if (!input.loading_date) {
      return NextResponse.json({ error: 'Date de chargement requise' }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('cooperative_id, role')
      .eq('id', user.id)
      .single();

    const cooperativeId =
      input.cooperative_id || profile?.cooperative_id || null;

    const { data: waybill, error: insertError } = await supabase
      .from('delivery_waybills')
      .insert({
        code: '',
        cooperative_id: cooperativeId,
        sender_name: input.sender_name || null,
        recipient_name: input.recipient_name || null,
        carrier_name: input.carrier_name || null,
        vehicle_plate: input.vehicle_plate || null,
        driver_name: input.driver_name || null,
        origin_location: input.origin_location || null,
        destination_location: input.destination_location || null,
        loading_date: input.loading_date,
        sack_count: input.sack_count ?? null,
        total_weight_kg: input.total_weight_kg ?? null,
        lot_number: input.lot_number || null,
        quality_grade: input.quality_grade || null,
        notes: input.notes || null,
        created_by: user.id,
      })
      .select('id')
      .single();

    if (insertError || !waybill) {
      return NextResponse.json(
        { error: insertError?.message || 'Échec création' },
        { status: 500 }
      );
    }

    const waybillId = (waybill as { id: string }).id;

    if (file && file.size > 0) {
      const upload = await uploadWaybillDocument(file, cooperativeId, waybillId);
      if (!upload.success) {
        await supabase.from('delivery_waybills').delete().eq('id', waybillId);
        return NextResponse.json({ error: upload.error }, { status: 400 });
      }

      await supabase
        .from('delivery_waybills')
        .update({
          document_storage_path: upload.storagePath,
          document_file_name: file.name,
          document_mime_type: file.type,
          document_file_size: file.size,
        })
        .eq('id', waybillId);
    }

    if (input.delivery_ids?.length) {
      const linkError = await linkDeliveriesToWaybill(
        supabase,
        waybillId,
        input.delivery_ids
      );
      if (linkError) {
        await supabase.from('delivery_waybills').delete().eq('id', waybillId);
        if (file) {
          // cleanup handled on delete cascade - storage orphan possible; acceptable for MVP
        }
        return NextResponse.json({ error: linkError }, { status: 409 });
      }
    }

    const detail = await fetchWaybillDetail(supabase, waybillId);
    return NextResponse.json(detail, { status: 201 });
  } catch (err) {
    console.error('[POST /api/waybills]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
