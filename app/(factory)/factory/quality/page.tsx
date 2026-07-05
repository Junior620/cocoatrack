'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { factoryApi } from '@/lib/api/factory';
import { usePendingQuality, useInvalidateFactory } from '@/lib/hooks/useFactory';
import type { QualityDecision } from '@/types/factory';
import { FactoryStatusBadge } from '@/components/factory/StatusBadge';

function QualityPageContent() {
  const searchParams = useSearchParams();
  const preselectedReceipt = searchParams.get('receipt');
  const { data: pending, isLoading } = usePendingQuality();
  const invalidate = useInvalidateFactory();
  const router = useRouter();

  const [selectedId, setSelectedId] = useState(preselectedReceipt || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    moisture_rate: '',
    impurity_rate: '',
    mold_rate: '',
    broken_beans_rate: '',
    grade: '',
    decision: 'conforme' as QualityDecision,
    observations: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    setSaving(true);
    setError(null);
    try {
      await factoryApi.createQualityControl({
        receipt_id: selectedId,
        moisture_rate: form.moisture_rate ? parseFloat(form.moisture_rate) : null,
        impurity_rate: form.impurity_rate ? parseFloat(form.impurity_rate) : null,
        mold_rate: form.mold_rate ? parseFloat(form.mold_rate) : null,
        broken_beans_rate: form.broken_beans_rate ? parseFloat(form.broken_beans_rate) : null,
        grade: (form.grade as 'A' | 'B' | 'C') || null,
        decision: form.decision,
        observations: form.observations || null,
      });
      invalidate();
      router.push('/factory/receipts');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#5C4033]">Contrôle qualité</h1>

      <div className="rounded-xl border border-[#d4c4b0] bg-white p-4">
        <h2 className="mb-3 font-semibold text-[#5C4033]">Lots en attente</h2>
        {isLoading ? (
          <p className="text-sm text-gray-500">Chargement…</p>
        ) : (pending ?? []).length === 0 ? (
          <p className="text-sm text-gray-500">Aucun lot en attente de contrôle</p>
        ) : (
          <ul className="space-y-2">
            {(pending ?? []).map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(r.id)}
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${
                    selectedId === r.id ? 'border-[#5C4033] bg-[#faf6f1]' : 'border-gray-200'
                  }`}
                >
                  <span>{r.receipt_number} · {Number(r.received_weight_kg).toFixed(0)} kg</span>
                  <FactoryStatusBadge status={r.status} type="receipt" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedId && (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-[#d4c4b0] bg-white p-6">
          <h2 className="font-semibold text-[#5C4033]">Résultats du contrôle</h2>
          {error && <div className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              Humidité (%)
              <input type="number" step="0.1" className="mt-1 w-full rounded border px-3 py-2" value={form.moisture_rate} onChange={(e) => setForm({ ...form, moisture_rate: e.target.value })} />
            </label>
            <label className="block text-sm">
              Impuretés (%)
              <input type="number" step="0.1" className="mt-1 w-full rounded border px-3 py-2" value={form.impurity_rate} onChange={(e) => setForm({ ...form, impurity_rate: e.target.value })} />
            </label>
            <label className="block text-sm">
              Moisissures (%)
              <input type="number" step="0.1" className="mt-1 w-full rounded border px-3 py-2" value={form.mold_rate} onChange={(e) => setForm({ ...form, mold_rate: e.target.value })} />
            </label>
            <label className="block text-sm">
              Fèves brisées (%)
              <input type="number" step="0.1" className="mt-1 w-full rounded border px-3 py-2" value={form.broken_beans_rate} onChange={(e) => setForm({ ...form, broken_beans_rate: e.target.value })} />
            </label>
            <label className="block text-sm">
              Grade
              <select className="mt-1 w-full rounded border px-3 py-2" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })}>
                <option value="">-</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
              </select>
            </label>
            <label className="block text-sm">
              Décision *
              <select required className="mt-1 w-full rounded border px-3 py-2" value={form.decision} onChange={(e) => setForm({ ...form, decision: e.target.value as QualityDecision })}>
                <option value="conforme">Conforme</option>
                <option value="accepted_with_reserve">Accepté sous réserve</option>
                <option value="a_retraiter">À retraiter</option>
                <option value="non_conforme">Non conforme</option>
                <option value="rejete">Rejeté</option>
              </select>
            </label>
          </div>
          <label className="block text-sm">
            Observations
            <textarea className="mt-1 w-full rounded border px-3 py-2" rows={2} value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} />
          </label>
          <p className="text-xs text-gray-500">
            Un lot conforme ou sous réserve entrera automatiquement en stock fèves.
          </p>
          <button type="submit" disabled={saving} className="rounded-lg bg-[#5C4033] px-6 py-2 text-white disabled:opacity-50">
            {saving ? 'Enregistrement…' : 'Valider le contrôle'}
          </button>
        </form>
      )}
    </div>
  );
}

export default function FactoryQualityPage() {
  return (
    <Suspense fallback={<p>Chargement…</p>}>
      <QualityPageContent />
    </Suspense>
  );
}
