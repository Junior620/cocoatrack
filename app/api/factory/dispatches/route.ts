import { NextRequest, NextResponse } from 'next/server';
import { requireFactoryAuth } from '@/lib/services/factory/api-auth';
import {
  listDispatches,
  getDispatch,
  createDispatch,
  addLotToDispatch,
  updateDispatchChecklist,
  shipDispatch,
} from '@/lib/services/factory/dispatch-service';

export async function GET(request: NextRequest) {
  const auth = await requireFactoryAuth();
  if ('error' in auth) return auth.error;

  const id = request.nextUrl.searchParams.get('id');
  try {
    if (id) {
      const dispatch = await getDispatch(auth.supabase as never, id);
      if (!dispatch) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
      return NextResponse.json(dispatch);
    }
    const data = await listDispatches(auth.supabase as never, auth.user.id);
    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireFactoryAuth();
  if ('error' in auth) return auth.error;

  try {
    const body = await request.json();
    const action = (body.action as string) || 'create';

    if (action === 'create') {
      const dispatch = await createDispatch(auth.supabase as never, auth.user.id, body);
      return NextResponse.json(dispatch, { status: 201 });
    }
    if (action === 'add_lot') {
      const row = await addLotToDispatch(auth.supabase as never, auth.user.id, body.dispatch_id, body);
      return NextResponse.json(row, { status: 201 });
    }
    if (action === 'checklist') {
      const dispatch = await updateDispatchChecklist(auth.supabase as never, body.dispatch_id, body.checklist);
      return NextResponse.json(dispatch);
    }
    if (action === 'ship') {
      const dispatch = await shipDispatch(auth.supabase as never, auth.user.id, body.dispatch_id);
      return NextResponse.json(dispatch);
    }
    return NextResponse.json({ error: 'action inconnue' }, { status: 400 });
  } catch (e) {
    const status =
      e instanceof Error && (e.message.includes('non opérable') || e.message.includes('Checklist'))
        ? 409
        : 500;
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status });
  }
}
