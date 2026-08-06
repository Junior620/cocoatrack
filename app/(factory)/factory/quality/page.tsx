'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { factoryApi } from '@/lib/api/factory';
import { usePendingQuality, useInvalidateFactory } from '@/lib/hooks/useFactory';
import type { QualityDecision } from '@/types/factory';
import { FactoryStatusBadge } from '@/components/factory/StatusBadge';
import { evaluateGrade } from '@/lib/services/factory/grade-service';
import { ONCC_GRADE_LABELS, type GradeRule, type OnccGrade } from '@/types/usinage';

function QualityPageContent() {
  const searchParams = useSearchParams();
  const preselectedReceipt = searchParams.get('receipt');
  const { data: pending, isLoading } = usePendingQuality();
  const invalidate = useInvalidateFactory();
  const router = useRouter();

  const [selectedId, setSelectedId] = useState(preselectedReceipt || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rule, setRule] = useState<GradeRule | null>(null);
  const [form, setForm] = useState({
    moisture_rate: '',
    impurity_rate: '',
    mold_rate: '',
    broken_beans_rate: '',
    slate_rate: '',
    insect_rate: '',
    foreign_matter_rate: '',
    sample_id: '',
    seal_number: '',
    smoke_odor: false,
    mold_odor: false,
    chemical_odor: false,
    oncc_grade: '' as OnccGrade | '',
    decision: 'conforme' as QualityDecision,
    observations: '',
  });

  useEffect(() => {
    fetch('/api/factory/organization?view=grade_rules')
      .then((r) => r.json())
      .then((body) => setRule(body.rule ?? null))
      .catch(() => setRule(null));
  }, []);

  const evaluation = useMemo(
    () =>
      evaluateGrade(
        {
          moisture_rate: form.moisture_rate ? parseFloat(form.moisture_rate) : null,
          mold_rate: form.mold_rate ? parseFloat(form.mold_rate) : null,
          slate_rate: form.slate_rate ? parseFloat(form.slate_rate) : null,
          insect_rate: form.insect_rate ? parseFloat(form.insect_rate) : null,
          foreign_matter_rate: form.foreign_matter_rate ? parseFloat(form.foreign_matter_rate) : null,
          smoke_odor: form.smoke_odor,
          mold_odor: form.mold_odor,
          chemical_odor: form.chemical_odor,
        },
        rule
      ),
    [form, rule]
  );

  useEffect(() => {
    if (!form.oncc_grade && evaluation.suggested_grade) {
      setForm((f) => ({ ...f, oncc_grade: evaluation.suggested_grade }));
    }
  }, [evaluation.suggested_grade, form.oncc_grade]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    if (evaluation.block && form.decision === 'conforme') {
      setError(`Décision « conforme » bloquée : ${evaluation.alerts.join('; ')}`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await factoryApi.createQualityControl({
        receipt_id: selectedId,
        moisture_rate: form.moisture_rate ? parseFloat(form.moisture_rate) : null,
        impurity_rate: form.impurity_rate ? parseFloat(form.impurity_rate) : null,
        mold_rate: form.mold_rate ? parseFloat(form.mold_rate) : null,
        broken_beans_rate: form.broken_beans_rate ? parseFloat(form.broken_beans_rate) : null,
        slate_rate: form.slate_rate ? parseFloat(form.slate_rate) : null,
        insect_rate: form.insect_rate ? parseFloat(form.insect_rate) : null,
        foreign_matter_rate: form.foreign_matter_rate ? parseFloat(form.foreign_matter_rate) : null,
        smoke_odor: form.smoke_odor,
        mold_odor: form.mold_odor,
        chemical_odor: form.chemical_odor,
        sample_id: form.sample_id || null,
        seal_number: form.seal_number || null,
        oncc_grade: form.oncc_grade || evaluation.suggested_grade,
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

  const applySuggestion = () => {
    setForm((f) => ({
      ...f,
      oncc_grade: evaluation.suggested_grade,
      decision: evaluation.block ? 'non_conforme' : f.decision === 'conforme' ? 'conforme' : f.decision,
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#5C4033]">Contrôle qualité ONCC</h1>
        <p className="text-sm text-[#8B6914]">
          Cut-test · grades Grade I/II/HS · règles campagne
          {rule ? ` (${rule.name} v${rule.version})` : ''}
        </p>
      </div>

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
                  <span>
                    {r.receipt_number} · {Number(r.received_weight_kg).toFixed(0)} kg
                  </span>
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

          {(evaluation.alerts.length > 0 || evaluation.suggested_grade) && (
            <div
              className={`rounded-lg border p-3 text-sm ${
                evaluation.block
                  ? 'border-red-200 bg-red-50 text-red-900'
                  : 'border-amber-200 bg-amber-50 text-amber-900'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p>
                  Suggestion : <strong>{ONCC_GRADE_LABELS[evaluation.suggested_grade]}</strong>
                  {evaluation.block ? ' · blocage règles' : ''}
                </p>
                <button
                  type="button"
                  onClick={applySuggestion}
                  className="rounded border border-current px-2 py-1 text-xs"
                >
                  Appliquer
                </button>
              </div>
              {evaluation.alerts.length > 0 && (
                <ul className="mt-2 list-disc pl-5">
                  {evaluation.alerts.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field
              label="Humidité (%)"
              value={form.moisture_rate}
              onChange={(v) => setForm({ ...form, moisture_rate: v, oncc_grade: '' })}
            />
            <Field
              label="Impuretés (%)"
              value={form.impurity_rate}
              onChange={(v) => setForm({ ...form, impurity_rate: v })}
            />
            <Field
              label="Moisissures (%)"
              value={form.mold_rate}
              onChange={(v) => setForm({ ...form, mold_rate: v, oncc_grade: '' })}
            />
            <Field
              label="Fèves brisées (%)"
              value={form.broken_beans_rate}
              onChange={(v) => setForm({ ...form, broken_beans_rate: v })}
            />
            <Field
              label="Ardoise (%)"
              value={form.slate_rate}
              onChange={(v) => setForm({ ...form, slate_rate: v, oncc_grade: '' })}
            />
            <Field
              label="Insectes (%)"
              value={form.insect_rate}
              onChange={(v) => setForm({ ...form, insect_rate: v, oncc_grade: '' })}
            />
            <Field
              label="Matières étrangères (%)"
              value={form.foreign_matter_rate}
              onChange={(v) => setForm({ ...form, foreign_matter_rate: v, oncc_grade: '' })}
            />
            <label className="block text-sm">
              N° échantillon
              <input
                className="mt-1 w-full rounded border px-3 py-2"
                value={form.sample_id}
                onChange={(e) => setForm({ ...form, sample_id: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              N° scellé
              <input
                className="mt-1 w-full rounded border px-3 py-2"
                value={form.seal_number}
                onChange={(e) => setForm({ ...form, seal_number: e.target.value })}
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.smoke_odor}
                onChange={(e) => setForm({ ...form, smoke_odor: e.target.checked, oncc_grade: '' })}
              />
              Odeur fumée
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.mold_odor}
                onChange={(e) => setForm({ ...form, mold_odor: e.target.checked, oncc_grade: '' })}
              />
              Odeur moisissure
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.chemical_odor}
                onChange={(e) => setForm({ ...form, chemical_odor: e.target.checked, oncc_grade: '' })}
              />
              Odeur chimique
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              Grade ONCC
              <select
                className="mt-1 w-full rounded border px-3 py-2"
                value={form.oncc_grade}
                onChange={(e) => setForm({ ...form, oncc_grade: e.target.value as OnccGrade })}
              >
                <option value="">—</option>
                {(Object.keys(ONCC_GRADE_LABELS) as OnccGrade[]).map((g) => (
                  <option key={g} value={g}>
                    {ONCC_GRADE_LABELS[g]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Décision *
              <select
                required
                className="mt-1 w-full rounded border px-3 py-2"
                value={form.decision}
                onChange={(e) => setForm({ ...form, decision: e.target.value as QualityDecision })}
              >
                <option value="conforme" disabled={evaluation.block}>
                  Conforme{evaluation.block ? ' (bloqué)' : ''}
                </option>
                <option value="accepted_with_reserve">Accepté sous réserve</option>
                <option value="a_retraiter">À retraiter</option>
                <option value="non_conforme">Non conforme</option>
                <option value="rejete">Rejeté</option>
              </select>
            </label>
          </div>

          <label className="block text-sm">
            Observations
            <textarea
              className="mt-1 w-full rounded border px-3 py-2"
              rows={2}
              value={form.observations}
              onChange={(e) => setForm({ ...form, observations: e.target.value })}
            />
          </label>
          <p className="text-xs text-gray-500">
            Un lot conforme ou sous réserve entrera automatiquement en stock fèves.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#5C4033] px-6 py-2 text-white disabled:opacity-50"
            >
              {saving ? 'Enregistrement…' : 'Valider le contrôle'}
            </button>
            <Link href="/factory/receipts" className="rounded-lg border px-4 py-2 text-sm text-[#5C4033]">
              Annuler
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-sm">
      {label}
      <input
        type="number"
        step="0.1"
        className="mt-1 w-full rounded border px-3 py-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export default function FactoryQualityPage() {
  return (
    <Suspense fallback={<p>Chargement…</p>}>
      <QualityPageContent />
    </Suspense>
  );
}
