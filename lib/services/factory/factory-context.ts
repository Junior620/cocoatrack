import type { SupabaseClient } from '@supabase/supabase-js';
import { DEMO_FACTORY_SITE_ID } from '@/types/factory';

type UntypedDb = SupabaseClient<any, 'public', any>;

export async function resolveFactorySiteId(
  supabase: UntypedDb,
  userId: string,
  explicitSiteId?: string | null
): Promise<string> {
  if (explicitSiteId) return explicitSiteId;

  const { data: profile } = await supabase
    .from('profiles')
    .select('factory_site_id, role')
    .eq('id', userId)
    .single();

  if (profile?.factory_site_id) return profile.factory_site_id as string;

  const { data: site } = await supabase
    .from('factory_sites')
    .select('id')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  return (site?.id as string) || DEMO_FACTORY_SITE_ID;
}

export async function getRawProductTypeId(
  supabase: UntypedDb,
  factorySiteId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('product_types')
    .select('id')
    .eq('factory_site_id', factorySiteId)
    .eq('is_raw_material', true)
    .limit(1)
    .maybeSingle();
  return (data?.id as string) ?? null;
}
