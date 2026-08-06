'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { factoryApi } from '@/lib/api/factory';
import {
  useFactoryStocks,
  useFactoryProductionLines,
  useInvalidateFactory,
} from '@/lib/hooks/useFactory';
import { TRANSFORMATION_TYPE_LABELS, PRIMARY_PROCESSING_TYPES } from '@/types/factory';
import type { TransformationType } from '@/types/factory';

export default function NewFactoryOrderPage() {
  const router = useRouter();
  const invalidate = useInvalidateFactory();
  const { data: stocks } = useFactoryStocks({ raw: true });
  const { data: lines } = useFactoryProductionLines();
  const [selectedStocks, setSelectedStocks] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    transformation_type: 'cleaning' as TransformationType,
    production_line_id: '',
    planned_date: new Date().toISOString().slice(0, 10),
    theoretical_yield_rate: '98',
    notes: '',
  });

  const toggleStock = (id: string) => {
    setSelectedStocks((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const order = await factoryApi.createOrder({
        transformation_type: form.transformation_type,
        production_line_id: form.production_line_id || null,
        planned_date: form.planned_date,
        theoretical_yield_rate: parseFloat(form.theoretical_yield_rate),
        notes: form.notes || null,
        stock_item_ids: selectedStocks,
      });
      await factoryApi.updateOrderStatus(order.id, 'in_progress');
      invalidate();
      router.push(`/factory/orders/${order.id}/production`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const availableStocks = ((stocks as Array<Record<string, unknown>>) ?? []).filter(
    (s) => s.status === 'available' || s.status === 'quarantine'
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/factory/orders" className="text-sm text-[#8B6914] hover:underline">← Ordres</Link>
      <h1 className="text-2xl font-bold text-[#5C4033]">Nouvel ordre de transformation</h1>

      {error && <div className="rounded-lg bg-red-50 p-3 text-red-700">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-[#d4c4b0] bg-white p-6">
        <label className="block text-sm">
          Type d&apos;usinage
          <select className="mt-1 w-full rounded border px-3 py-2" value={form.transformation_type} onChange={(e) => setForm({ ...form, transformation_type: e.target.value as TransformationType })}>
            <optgroup label="Usinage primaire">
              {PRIMARY_PROCESSING_TYPES.map((k) => (
                <option key={k} value={k}>{TRANSFORMATION_TYPE_LABELS[k]}</option>
              ))}
            </optgroup>
            <optgroup label="Autres">
              {(Object.keys(TRANSFORMATION_TYPE_LABELS) as TransformationType[])
                .filter((k) => !PRIMARY_PROCESSING_TYPES.includes(k))
                .map((k) => (
                  <option key={k} value={k}>{TRANSFORMATION_TYPE_LABELS[k]}</option>
                ))}
            </optgroup>
          </select>
        </label>
        <label className="block text-sm">
          Ligne de production
          <select className="mt-1 w-full rounded border px-3 py-2" value={form.production_line_id} onChange={(e) => setForm({ ...form, production_line_id: e.target.value })}>
            <option value="">-</option>
            {((lines as Array<{ id: string; name: string }>) ?? []).map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            Date prévue
            <input type="date" className="mt-1 w-full rounded border px-3 py-2" value={form.planned_date} onChange={(e) => setForm({ ...form, planned_date: e.target.value })} />
          </label>
          <label className="block text-sm">
            Rendement théorique (%)
            <input type="number" step="0.1" className="mt-1 w-full rounded border px-3 py-2" value={form.theoretical_yield_rate} onChange={(e) => setForm({ ...form, theoretical_yield_rate: e.target.value })} />
          </label>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Lots de fèves à utiliser</p>
          {availableStocks.length === 0 ? (
            <p className="text-sm text-gray-500">Aucun lot disponible · effectuez d&apos;abord une réception et un contrôle qualité.</p>
          ) : (
            <ul className="max-h-48 space-y-1 overflow-y-auto">
              {availableStocks.map((s) => (
                <li key={s.id as string}>
                  <label className="flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-sm hover:bg-[#faf6f1]">
                    <input type="checkbox" checked={selectedStocks.includes(s.id as string)} onChange={() => toggleStock(s.id as string)} />
                    {s.lot_reference as string} · {Number(s.quantity_kg).toFixed(0)} kg
                    {s.status === 'quarantine' && <span className="text-xs text-orange-600">(sous réserve)</span>}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button type="submit" disabled={saving || selectedStocks.length === 0} className="w-full rounded-lg bg-[#5C4033] py-3 text-white disabled:opacity-50">
          {saving ? 'Création…' : 'Créer et saisir la production'}
        </button>
      </form>
    </div>
  );
}
