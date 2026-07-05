import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getWaybillDocumentSignedUrl } from '@/lib/services/waybill-storage';

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

  const { data: waybill, error } = await supabase
    .from('delivery_waybills')
    .select('document_storage_path, document_mime_type, document_file_name')
    .eq('id', id)
    .maybeSingle();

  if (error || !waybill) {
    return NextResponse.json({ error: 'Document introuvable' }, { status: 404 });
  }

  const path = (waybill as { document_storage_path?: string }).document_storage_path;
  if (!path) {
    return NextResponse.json({ error: 'Aucun document attaché' }, { status: 404 });
  }

  const url = await getWaybillDocumentSignedUrl(path);
  if (!url) {
    return NextResponse.json({ error: 'Impossible de générer l\'URL' }, { status: 500 });
  }

  return NextResponse.json({ url });
}
