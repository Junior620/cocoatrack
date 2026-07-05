import { NextRequest, NextResponse } from 'next/server';
import { requireFactoryAuth } from '@/lib/services/factory/api-auth';
import { getDashboardMetrics } from '@/lib/services/factory/dashboard-service';

export async function GET() {
  const auth = await requireFactoryAuth();
  if ('error' in auth) return auth.error;

  try {
    const metrics = await getDashboardMetrics(auth.supabase as never, auth.user.id);
    return NextResponse.json(metrics);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
