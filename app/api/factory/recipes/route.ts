import { NextRequest, NextResponse } from 'next/server';
import { requireFactoryAuth } from '@/lib/services/factory/api-auth';
import {
  listRecipes,
  getRecipe,
  createRecipe,
  activateRecipeVersion,
  addRecipeSteps,
} from '@/lib/services/factory/recipe-service';

export async function GET(request: NextRequest) {
  const auth = await requireFactoryAuth();
  if ('error' in auth) return auth.error;

  const id = request.nextUrl.searchParams.get('id');
  try {
    if (id) {
      const recipe = await getRecipe(auth.supabase as never, id);
      if (!recipe) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
      return NextResponse.json(recipe);
    }
    const data = await listRecipes(auth.supabase as never, auth.user.id);
    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireFactoryAuth();
  if ('error' in auth) return auth.error;
  if (!auth.canWrite) {
    return NextResponse.json({ error: 'Permissions insuffisantes' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const action = (body.action as string) || 'create';

    if (action === 'create') {
      const recipe = await createRecipe(auth.supabase as never, auth.user.id, body);
      return NextResponse.json(recipe, { status: 201 });
    }
    if (action === 'activate') {
      const recipe = await activateRecipeVersion(
        auth.supabase as never,
        body.recipe_id,
        body.version_id
      );
      return NextResponse.json(recipe);
    }
    if (action === 'add_steps') {
      const version = await addRecipeSteps(auth.supabase as never, body.version_id, body.steps);
      return NextResponse.json(version);
    }
    return NextResponse.json({ error: 'action inconnue' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 });
  }
}
