import type { SupabaseClient } from '@supabase/supabase-js';
import type { CreateRecipeInput, ProductionRecipe, RecipeVersion } from '@/types/mes';
import { PILOT_RECIPE_STEPS } from '@/types/mes';
import { resolveFactorySiteId } from './factory-context';

type UntypedDb = SupabaseClient<any, 'public', any>;

const RECIPE_SELECT = `
  *,
  versions:recipe_versions(
    *,
    steps:recipe_steps(*)
  )
`;

export async function listRecipes(supabase: UntypedDb, userId: string) {
  const siteId = await resolveFactorySiteId(supabase, userId);
  const { data, error } = await supabase
    .from('production_recipes')
    .select(RECIPE_SELECT)
    .eq('factory_site_id', siteId)
    .order('code', { ascending: true });
  if (error) throw new Error(error.message);

  const recipes = (data ?? []) as ProductionRecipe[];
  for (const r of recipes) {
    if (r.versions) {
      r.versions.sort((a, b) => b.version - a.version);
      for (const v of r.versions) {
        if (v.steps) v.steps.sort((a, b) => a.step_order - b.step_order);
      }
    }
  }
  return recipes;
}

export async function getRecipe(supabase: UntypedDb, id: string) {
  const { data, error } = await supabase
    .from('production_recipes')
    .select(RECIPE_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const recipe = data as ProductionRecipe;
  if (recipe.versions) {
    recipe.versions.sort((a, b) => b.version - a.version);
    for (const v of recipe.versions) {
      if (v.steps) v.steps.sort((a, b) => a.step_order - b.step_order);
    }
  }
  return recipe;
}

export async function createRecipe(
  supabase: UntypedDb,
  userId: string,
  input: CreateRecipeInput
) {
  const siteId = await resolveFactorySiteId(supabase, userId);

  const { data: recipe, error } = await supabase
    .from('production_recipes')
    .insert({
      factory_site_id: siteId,
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      description: input.description ?? null,
      product_type_id: input.product_type_id ?? null,
      is_active: true,
      created_by: userId,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);

  const { data: version, error: vErr } = await supabase
    .from('recipe_versions')
    .insert({
      recipe_id: recipe.id,
      version: 1,
      status: 'draft',
      expected_yield_pct: input.expected_yield_pct ?? null,
      mass_balance_tolerance_pct: input.mass_balance_tolerance_pct ?? 2,
      notes: null,
      created_by: userId,
    })
    .select('*')
    .single();

  if (vErr) throw new Error(vErr.message);

  const steps = input.seed_pilot
    ? PILOT_RECIPE_STEPS
    : input.steps?.length
      ? input.steps
      : [];

  if (steps.length) {
    const { error: sErr } = await supabase.from('recipe_steps').insert(
      steps.map((s) => ({
        recipe_version_id: version.id,
        step_order: s.step_order,
        step_type: s.step_type,
        name: s.name,
        description: 'description' in s ? (s.description ?? null) : null,
        parameters_json: s.parameters_json ?? {},
        tolerances_json: s.tolerances_json ?? {},
        expected_yield_pct: s.expected_yield_pct ?? null,
        requires_quality_check: 'requires_quality_check' in s ? !!s.requires_quality_check : false,
        equipment_hint: 'equipment_hint' in s ? (s.equipment_hint ?? null) : null,
      }))
    );
    if (sErr) throw new Error(sErr.message);
  }

  return getRecipe(supabase, recipe.id as string);
}

export async function activateRecipeVersion(
  supabase: UntypedDb,
  recipeId: string,
  versionId: string
) {
  const recipe = await getRecipe(supabase, recipeId);
  if (!recipe) throw new Error('Recette introuvable');

  const version = recipe.versions?.find((v) => v.id === versionId);
  if (!version) throw new Error('Version introuvable');
  if (!version.steps?.length) throw new Error('Impossible d’activer une version sans étapes');

  await supabase
    .from('recipe_versions')
    .update({ status: 'archived' })
    .eq('recipe_id', recipeId)
    .eq('status', 'active');

  const { error } = await supabase
    .from('recipe_versions')
    .update({ status: 'active', activated_at: new Date().toISOString() })
    .eq('id', versionId);

  if (error) throw new Error(error.message);

  await supabase.from('production_recipes').update({ is_active: true }).eq('id', recipeId);

  return getRecipe(supabase, recipeId);
}

export async function addRecipeSteps(
  supabase: UntypedDb,
  versionId: string,
  steps: CreateRecipeInput['steps']
) {
  if (!steps?.length) throw new Error('Aucune étape');
  const { error } = await supabase.from('recipe_steps').insert(
    steps.map((s) => ({
      recipe_version_id: versionId,
      step_order: s.step_order,
      step_type: s.step_type,
      name: s.name,
      description: s.description ?? null,
      parameters_json: s.parameters_json ?? {},
      tolerances_json: s.tolerances_json ?? {},
      expected_yield_pct: s.expected_yield_pct ?? null,
      requires_quality_check: !!s.requires_quality_check,
      equipment_hint: s.equipment_hint ?? null,
    }))
  );
  if (error) throw new Error(error.message);

  const { data } = await supabase
    .from('recipe_versions')
    .select('*, steps:recipe_steps(*)')
    .eq('id', versionId)
    .single();
  return data as RecipeVersion;
}

export async function getActiveRecipeVersion(supabase: UntypedDb, recipeId: string) {
  const { data, error } = await supabase
    .from('recipe_versions')
    .select('*, steps:recipe_steps(*)')
    .eq('recipe_id', recipeId)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data?.steps) {
    (data as RecipeVersion).steps!.sort((a, b) => a.step_order - b.step_order);
  }
  return data as RecipeVersion | null;
}
