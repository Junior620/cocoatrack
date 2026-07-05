import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function requireFactoryAuth() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user ?? null;

  if (!user) {
    return { error: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) };
  }

  const { data: isAgentOrAbove } = await supabase.rpc('is_agent_or_above');
  const { data: isAdmin } = await supabase.rpc('is_admin');

  return {
    supabase: supabase as ReturnType<typeof createServerSupabaseClient> extends Promise<infer T> ? T : never,
    user,
    canWrite: !!isAgentOrAbove || !!isAdmin,
  };
}

export type FactoryAuth = Exclude<Awaited<ReturnType<typeof requireFactoryAuth>>, { error: NextResponse }>;
