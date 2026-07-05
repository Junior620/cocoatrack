'use client';

import { useFactoryProductTypes, useFactoryProductionLines } from '@/lib/hooks/useFactory';

export default function FactorySettingsPage() {
  const { data: types } = useFactoryProductTypes();
  const { data: lines } = useFactoryProductionLines();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#5C4033]">Paramètres usine</h1>
      <p className="text-sm text-gray-500">Référentiels · modification réservée aux administrateurs (via Supabase pour le MVP).</p>

      <section className="rounded-xl border border-[#d4c4b0] bg-white p-4">
        <h2 className="mb-3 font-semibold">Types de produits</h2>
        <ul className="space-y-1 text-sm">
          {((types as Array<{ name: string; category: string; is_raw_material: boolean; is_finished_product: boolean }>) ?? []).map((t, i) => (
            <li key={i} className="flex justify-between border-b border-gray-100 py-1">
              <span>{t.name}</span>
              <span className="text-gray-500">{t.is_raw_material ? 'Matière première' : t.is_finished_product ? 'Produit fini' : t.category}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-[#d4c4b0] bg-white p-4">
        <h2 className="mb-3 font-semibold">Lignes de production</h2>
        <ul className="space-y-1 text-sm">
          {((lines as Array<{ name: string; capacity_kg_per_day: number | null; status: string }>) ?? []).map((l, i) => (
            <li key={i} className="flex justify-between border-b border-gray-100 py-1">
              <span>{l.name}</span>
              <span className="text-gray-500">{l.capacity_kg_per_day ? `${l.capacity_kg_per_day} kg/j` : '-'}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
