'use client';

import Link from 'next/link';
import { useState } from 'react';
import { factoryApi } from '@/lib/api/factory';
import { useFactoryRecipes, useInvalidateFactory } from '@/lib/hooks/useFactory';
import { RECIPE_STEP_TYPE_LABELS } from '@/types/mes';
import type { ProductionRecipe, RecipeStepType } from '@/types/mes';

export default function FactoryRecipesPage() {
  const { data, isLoading, error } = useFactoryRecipes();
  const invalidate = useInvalidateFactory();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: 'MASSE-PILOTE',
    name: 'Fèves → masse cacao',
    description: 'Chaîne pilote nettoyage → vannage → torréfaction → broyage',
    seed_pilot: true,
  });

  const recipes = (data?.data ?? []) as ProductionRecipe[];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await factoryApi.createRecipe(form);
      invalidate();
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async (recipeId: string, versionId: string) => {
    try {
      await factoryApi.activateRecipeVersion(recipeId, versionId);
      invalidate();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#5C4033]">Recettes de production</h1>
          <p className="text-sm text-[#8B6914]">Versions figées pour les ordres de fabrication</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-[#5C4033] px-4 py-2 text-sm text-white"
        >
          Nouvelle recette
        </button>
      </div>

      {error && <div className="rounded-lg bg-red-50 p-4 text-red-700">{error.message}</div>}

      {showForm && (
        <form onSubmit={handleCreate} className="space-y-3 rounded-xl border border-[#d4c4b0] bg-white p-5">
          {formError && <div className="rounded bg-red-50 p-2 text-sm text-red-700">{formError}</div>}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              Code
              <input
                className="mt-1 w-full rounded border px-3 py-2"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                required
              />
            </label>
            <label className="block text-sm">
              Nom
              <input
                className="mt-1 w-full rounded border px-3 py-2"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </label>
          </div>
          <label className="block text-sm">
            Description
            <textarea
              className="mt-1 w-full rounded border px-3 py-2"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.seed_pilot}
              onChange={(e) => setForm({ ...form, seed_pilot: e.target.checked })}
            />
            Précharger la chaîne pilote (fèves → masse)
          </label>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-[#5C4033] px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {saving ? 'Création…' : 'Créer (version brouillon)'}
          </button>
        </form>
      )}

      <div className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-gray-500">Chargement…</p>
        ) : recipes.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#d4c4b0] bg-white p-8 text-center text-gray-500">
            Aucune recette. Créez la chaîne pilote pour démarrer le MES.
          </p>
        ) : (
          recipes.map((recipe) => {
            const latest = recipe.versions?.[0];
            const active = recipe.versions?.find((v) => v.status === 'active');
            return (
              <div key={recipe.id} className="rounded-xl border border-[#d4c4b0] bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#5C4033]">
                      {recipe.code} — {recipe.name}
                    </p>
                    <p className="text-sm text-[#8B6914]">{recipe.description}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {active
                        ? `Version active v${active.version}`
                        : latest
                          ? `Dernière version v${latest.version} (${latest.status})`
                          : 'Sans version'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {latest && latest.status === 'draft' && (
                      <button
                        type="button"
                        onClick={() => handleActivate(recipe.id, latest.id)}
                        className="rounded border border-[#5C4033] px-3 py-1.5 text-sm text-[#5C4033]"
                      >
                        Activer v{latest.version}
                      </button>
                    )}
                    <Link
                      href={`/factory/recipes/${recipe.id}`}
                      className="rounded bg-[#f5ebe0] px-3 py-1.5 text-sm text-[#5C4033]"
                    >
                      Détail
                    </Link>
                  </div>
                </div>
                {latest?.steps && latest.steps.length > 0 && (
                  <ol className="mt-4 space-y-1 border-t border-[#f0e6da] pt-3 text-sm">
                    {latest.steps.map((s) => (
                      <li key={s.id} className="flex justify-between text-[#3d2b1f]">
                        <span>
                          {s.step_order}. {s.name}{' '}
                          <span className="text-xs text-[#8B6914]">
                            ({RECIPE_STEP_TYPE_LABELS[s.step_type as RecipeStepType] ?? s.step_type})
                          </span>
                        </span>
                        {s.expected_yield_pct != null && (
                          <span className="text-xs text-gray-500">rend. {s.expected_yield_pct}%</span>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
