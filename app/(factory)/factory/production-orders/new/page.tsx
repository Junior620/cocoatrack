'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { factoryApi } from '@/lib/api/factory';
import { useFactoryRecipes, useInvalidateFactory } from '@/lib/hooks/useFactory';
import type { ProductionRecipe } from '@/types/mes';

export default function NewProductionOrderPage() {
  const router = useRouter();
  const invalidate = useInvalidateFactory();
  const { data: recipesData } = useFactoryRecipes();
  const recipes = (recipesData?.data ?? []) as ProductionRecipe[];

  const activeOptions = useMemo(() => {
    const opts: Array<{ recipe: ProductionRecipe; versionId: string; version: number }> = [];
    for (const r of recipes) {
      const active = r.versions?.find((v) => v.status === 'active');
      if (active) opts.push({ recipe: r, versionId: active.id, version: active.version });
    }
    return opts;
  }, [recipes]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    recipe_version_id: '',
    planned_quantity_kg: '1000',
    product_label: '',
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.recipe_version_id) {
      setError('Sélectionnez une recette active');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const order = (await factoryApi.createProductionOrder({
        recipe_version_id: form.recipe_version_id,
        planned_quantity_kg: parseFloat(form.planned_quantity_kg),
        product_label: form.product_label || null,
        notes: form.notes || null,
      })) as { id: string };
      invalidate();
      router.push(`/factory/production-orders/${order.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Link href="/factory/production-orders" className="text-sm text-[#8B6914] hover:underline">
        ← OF
      </Link>
      <h1 className="text-2xl font-bold text-[#5C4033]">Nouvel ordre de fabrication</h1>

      {activeOptions.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Aucune recette active.{' '}
          <Link href="/factory/recipes" className="underline">
            Créer / activer une recette
          </Link>{' '}
          d’abord.
        </div>
      )}

      {error && <div className="rounded-lg bg-red-50 p-3 text-red-700">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-[#d4c4b0] bg-white p-6">
        <label className="block text-sm">
          Recette (version active)
          <select
            className="mt-1 w-full rounded border px-3 py-2"
            value={form.recipe_version_id}
            onChange={(e) => {
              const opt = activeOptions.find((o) => o.versionId === e.target.value);
              setForm({
                ...form,
                recipe_version_id: e.target.value,
                product_label: opt?.recipe.name ?? form.product_label,
              });
            }}
            required
          >
            <option value="">— Choisir —</option>
            {activeOptions.map((o) => (
              <option key={o.versionId} value={o.versionId}>
                {o.recipe.code} — {o.recipe.name} (v{o.version})
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Quantité planifiée (kg)
          <input
            type="number"
            min="1"
            step="0.1"
            className="mt-1 w-full rounded border px-3 py-2"
            value={form.planned_quantity_kg}
            onChange={(e) => setForm({ ...form, planned_quantity_kg: e.target.value })}
            required
          />
        </label>
        <label className="block text-sm">
          Libellé produit
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            value={form.product_label}
            onChange={(e) => setForm({ ...form, product_label: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          Notes
          <textarea
            className="mt-1 w-full rounded border px-3 py-2"
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </label>
        <button
          type="submit"
          disabled={saving || activeOptions.length === 0}
          className="rounded-lg bg-[#5C4033] px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {saving ? 'Création…' : 'Créer le brouillon'}
        </button>
      </form>
    </div>
  );
}
