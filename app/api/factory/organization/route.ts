import { NextRequest, NextResponse } from 'next/server';
import { requireFactoryAuth } from '@/lib/services/factory/api-auth';
import {
  listSiteStaff,
  updateStaffDepartment,
  MVP_FACTORY_DEPARTMENTS,
  FACTORY_DEPARTMENT_LABELS,
  DEPARTMENT_CAPABILITIES,
} from '@/lib/services/factory/department-service';
import { ensureDefaultGradeRule, getActiveGradeRule } from '@/lib/services/factory/grade-service';
import { getFactorySite } from '@/lib/services/factory/factory-context';
import { FACTORY_CDC_GAP_LIST, summarizeGaps } from '@/lib/factory/gap-list';
import { PHASE_D_ROADMAP } from '@/lib/factory/phase-d-roadmap';

export async function GET(request: NextRequest) {
  const auth = await requireFactoryAuth();
  if ('error' in auth) return auth.error;

  const view = request.nextUrl.searchParams.get('view') ?? 'staff';

  try {
    if (view === 'site') {
      const site = await getFactorySite(auth.supabase as never, auth.user.id);
      return NextResponse.json({ site });
    }
    if (view === 'gap') {
      return NextResponse.json({ gaps: FACTORY_CDC_GAP_LIST, summary: summarizeGaps() });
    }
    if (view === 'roadmap') {
      return NextResponse.json({ roadmap: PHASE_D_ROADMAP });
    }
    if (view === 'grade_rules') {
      let rule = await getActiveGradeRule(auth.supabase as never, auth.user.id);
      if (!rule) rule = await ensureDefaultGradeRule(auth.supabase as never, auth.user.id);
      return NextResponse.json({ rule });
    }
    if (view === 'departments') {
      return NextResponse.json({
        mvp: MVP_FACTORY_DEPARTMENTS.map((d) => ({
          id: d,
          label: FACTORY_DEPARTMENT_LABELS[d],
          capabilities: DEPARTMENT_CAPABILITIES[d],
        })),
      });
    }
    const staff = await listSiteStaff(auth.supabase as never, auth.user.id);
    return NextResponse.json({ data: staff });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireFactoryAuth();
  if ('error' in auth) return auth.error;

  try {
    const body = await request.json();
    const updated = await updateStaffDepartment(auth.supabase as never, body.profile_id, {
      factory_department: body.factory_department,
      can_solo_validate_lot: body.can_solo_validate_lot,
    });
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 });
  }
}
