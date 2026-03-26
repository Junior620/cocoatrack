import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/receipts/signed-url?path=<storage-path>
 *
 * Generates a short-lived signed URL for a file in the collection-receipts bucket.
 * Required because the bucket is private and the browser can't access it directly.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // Accept either a full Supabase URL or just the storage path
    const rawParam = request.nextUrl.searchParams.get('path');
    if (!rawParam) {
      return NextResponse.json({ error: 'path requis' }, { status: 400 });
    }

    // Extract bucket + file path from a full public URL if needed
    // URL format: https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
    let bucket = 'collection-receipts';
    let filePath = rawParam;

    const publicPrefix = '/storage/v1/object/public/';
    const idx = rawParam.indexOf(publicPrefix);
    if (idx !== -1) {
      const rest = rawParam.slice(idx + publicPrefix.length);
      const slashIdx = rest.indexOf('/');
      if (slashIdx !== -1) {
        bucket = rest.slice(0, slashIdx);
        filePath = decodeURIComponent(rest.slice(slashIdx + 1));
      }
    }

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, 300); // 5-minute signed URL

    if (error || !data?.signedUrl) {
      return NextResponse.json(
        { error: `Impossible de générer l'URL signée: ${error?.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ signedUrl: data.signedUrl });
  } catch (err) {
    console.error('[signed-url] Error:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
