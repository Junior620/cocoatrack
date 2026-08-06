'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { factoryApi } from '@/lib/api/factory';
import { useFactoryRecipe, useInvalidateFactory } from '@/lib/hooks/useFactory';
import { RECIPE_STEP_TYPE_LABELS } from '@/types/mes';
import type { ProductionRecipe, RecipeStepType } from '@/types/mes';

export default function FactoryRecipeDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data, isLoading, error } = useFactoryRecipe(id);
  const invalidate = useInvalidateFactory();
  const recipe = data as ProductionRecipe | undefined;

  const handleActivate = async (versionId: string) => {
    try {
      await factoryApi.activateRecipeVersion(id, versionId);
      invalidate();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur');
    }
  };

  if (isLoading) return <p>Chargement…</p>;
  if (error) return <div className="rounded-lg bg-red-50 p-4 text-red-700">{error.message}</div>;
  if (!recipe) return <p>Recette introuvable</p>;

  return (
    <div className="space-y-6">
      <Link href="/factory/recipes" className="text-sm text-[#8B6914] hover:underline">
        ← Recettes
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-[#5C4033]">
          {recipe.code} — {recipe.name}
        </h1>
        <p className="text-sm text-[#8B6914]">{recipe.description}</p>
      </div>

      {(recipe.versions ?? []).map((v) => (
        <div key={v.id} className="rounded-xl border border-[#d4c4b0] bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="font-medium text-[#5C4033]">
                Version {v.version}{' '}
                <span className="text-sm font-normal text-[#8B6914]">({v.status})</span>
              </p>
              <p className="text-xs text-gray-500">
                Tolérance bilan {v.mass_balance_tolerance_pct}%
                {v.expected_yield_pct != null ? ` · rendement cible ${v.expected_yield_pct}%` : ''}
              </p>
            </div>
            {v.status === 'draft' && (
              <button
                type="button"
                onClick={() => handleActivate(v.id)}
                className="rounded bg-[#5C4033] px-3 py-1.5 text-sm text-white"
              >
                Activer
              </button>
            )}
          </div>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-[#8B6914]">
                <th className="py-1">#</th>
                <th className="py-1">Étape</th>
                <th className="py-1">Type</th>
                <th className="py-1 text-right">Rendement</th>
              </tr>
            </thead>
            <tbody>
              {(v.steps ?? []).map((s) => (
                <tr key={s.id} className="border-t border-[#f0e6da]">
                  <td className="py-2">{s.step_order}</td>
                  <td className="py-2">{s.name}</td>
                  <td className="py-2">
                    {RECIPE_STEP_TYPE_LABELS[s.step_type as RecipeStepType] ?? s.step_type}
                  </td>
                  <td className="py-2 text-right">
                    {s.expected_yield_pct != null ? `${s.expected_yield_pct}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
