import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  WAYBILL_DOCUMENTS_BUCKET,
  WAYBILL_MAX_FILE_SIZE,
  WAYBILL_ALLOWED_MIME_TYPES,
  generateWaybillStoragePath,
} from '@/types/waybills';

export function validateWaybillFile(file: { type: string; size: number }): string | null {
  if (!WAYBILL_ALLOWED_MIME_TYPES.includes(file.type as (typeof WAYBILL_ALLOWED_MIME_TYPES)[number])) {
    return 'Format non supporté. Utilisez PDF, JPEG, PNG ou WEBP.';
  }
  if (file.size <= 0 || file.size > WAYBILL_MAX_FILE_SIZE) {
    return 'Fichier trop volumineux (max 10 Mo).';
  }
  return null;
}

export async function uploadWaybillDocument(
  file: File,
  cooperativeId: string | null | undefined,
  waybillId: string
): Promise<{ success: boolean; storagePath?: string; error?: string }> {
  const validationError = validateWaybillFile(file);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const supabase = await createServerSupabaseClient();
  const uuid = crypto.randomUUID();
  const storagePath = generateWaybillStoragePath(
    cooperativeId,
    waybillId,
    uuid,
    file.name
  );

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await supabase.storage
    .from(WAYBILL_DOCUMENTS_BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, storagePath };
}

export async function deleteWaybillDocument(storagePath: string): Promise<void> {
  const supabase = await createServerSupabaseClient();
  await supabase.storage.from(WAYBILL_DOCUMENTS_BUCKET).remove([storagePath]);
}

export async function getWaybillDocumentSignedUrl(
  storagePath: string,
  expiresIn = 3600
): Promise<string | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.storage
    .from(WAYBILL_DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, expiresIn);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
