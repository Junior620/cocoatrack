'use client';

import { useState } from 'react';
import { factoryApi } from '@/lib/api/factory';
import { useFactoryTanks, useInvalidateFactory } from '@/lib/hooks/useFactory';
import { TANK_STATUS_LABELS } from '@/types/mes';
import type { Tank, TankStatus } from '@/types/mes';

export default function FactoryTanksPage() {
  const { data, isLoading, error } = useFactoryTanks();
  const invalidate = useInvalidateFactory();
  const tanks = (data?.data ?? []) as Tank[];
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    code: 'C-MASSE-01',
    name: 'Cuve masse 1',
    capacity_kg: '5000',
    allowed_product_label: 'masse',
  });
  const [msg, setMsg] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      await factoryApi.createTank({
        ...form,
        capacity_kg: parseFloat(form.capacity_kg),
      });
      invalidate();
      setShowForm(false);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const setStatus = async (tankId: string, status: TankStatus) => {
    try {
      await factoryApi.tankAction('status', { tank_id: tankId, status });
      invalidate();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Erreur');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#5C4033]">Cuves</h1>
          <p className="text-sm text-[#8B6914]">Capacité, contenu, nettoyage, qualité</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-[#5C4033] px-4 py-2 text-sm text-white"
        >
          Nouvelle cuve
        </button>
      </div>

      {error && <div className="rounded-lg bg-red-50 p-4 text-red-700">{error.message}</div>}
      {msg && <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{msg}</div>}

      {showForm && (
        <form onSubmit={handleCreate} className="grid gap-3 rounded-xl border border-[#d4c4b0] bg-white p-5 sm:grid-cols-2">
          <label className="text-sm">
            Code
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              required
            />
          </label>
          <label className="text-sm">
            Nom
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </label>
          <label className="text-sm">
            Capacité (kg)
            <input
              type="number"
              className="mt-1 w-full rounded border px-3 py-2"
              value={form.capacity_kg}
              onChange={(e) => setForm({ ...form, capacity_kg: e.target.value })}
              required
            />
          </label>
          <label className="text-sm">
            Produit autorisé
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={form.allowed_product_label}
              onChange={(e) => setForm({ ...form, allowed_product_label: e.target.value })}
            />
          </label>
          <button type="submit" className="rounded bg-[#5C4033] px-4 py-2 text-sm text-white sm:col-span-2">
            Créer
          </button>
        </form>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {isLoading ? (
          <p>Chargement…</p>
        ) : tanks.length === 0 ? (
          <p className="text-gray-500">Aucune cuve</p>
        ) : (
          tanks.map((t) => {
            const fillPct = (Number(t.current_qty_kg) / Number(t.capacity_kg)) * 100;
            return (
              <div key={t.id} className="rounded-xl border border-[#d4c4b0] bg-white p-4">
                <div className="flex justify-between">
                  <div>
                    <p className="font-semibold text-[#5C4033]">
                      {t.code} — {t.name}
                    </p>
                    <p className="text-xs text-[#8B6914]">
                      {TANK_STATUS_LABELS[t.status]} · qualité {t.quality_status}
                      {t.temperature_c != null ? ` · ${t.temperature_c}°C` : ''}
                    </p>
                  </div>
                  <p className="text-sm">
                    {Number(t.current_qty_kg).toFixed(0)} / {Number(t.capacity_kg).toFixed(0)} kg
                  </p>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded bg-[#f0e6da]">
                  <div
                    className="h-full bg-[#5C4033]"
                    style={{ width: `${Math.min(100, fillPct)}%` }}
                  />
                </div>
                {(t.contents ?? []).length > 0 && (
                  <ul className="mt-3 space-y-1 text-xs text-gray-600">
                    {t.contents!.map((c) => (
                      <li key={c.id}>
                        {c.cocoa_lot?.lot_number ?? c.cocoa_lot_id}: {Number(c.quantity_kg).toFixed(0)} kg
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setStatus(t.id, 'cleaning')}
                    className="rounded border px-2 py-1 text-xs"
                  >
                    Nettoyage
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus(t.id, 'empty')}
                    className="rounded border px-2 py-1 text-xs"
                  >
                    Marquer vide
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus(t.id, 'quarantine')}
                    className="rounded border px-2 py-1 text-xs"
                  >
                    Quarantaine
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
