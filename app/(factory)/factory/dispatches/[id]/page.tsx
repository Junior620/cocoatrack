'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ONCC_GRADE_LABELS, type CocoaLot, type OnccGrade } from '@/types/usinage';

const CHECKLIST_KEYS: Array<{ key: string; label: string }> = [
  { key: 'grade_ok', label: 'Grade conforme' },
  { key: 'moisture_ok', label: 'Humidité OK' },
  { key: 'bag_count_ok', label: 'Nombre de sacs OK' },
  { key: 'seals_ok', label: 'Scellés OK' },
  { key: 'documents_ok', label: 'Documents OK' },
  { key: 'photos_ok', label: 'Photos OK' },
  { key: 'eudr_ok', label: 'EUDR OK' },
];

export default function FactoryDispatchDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [dispatch, setDispatch] = useState<Record<string, unknown> | null>(null);
  const [lots, setLots] = useState<CocoaLot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [addLotId, setAddLotId] = useState('');
  const [addWeight, setAddWeight] = useState('');
  const [addBags, setAddBags] = useState('');

  const load = useCallback(async () => {
    const res = await fetch(`/api/factory/dispatches?id=${id}`);
    const body = await res.json();
    if (!res.ok) {
      setError(body.error);
      return;
    }
    setDispatch(body);
  }, [id]);

  useEffect(() => {
    void load();
    fetch('/api/factory/lots?status=stored,packaged,accepted,reserved')
      .then((r) => r.json())
      .then((b) => setLots(b.data ?? []))
      .catch(() => setLots([]));
  }, [load]);

  const post = async (payload: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/factory/dispatches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  const toggleCheck = async (key: string, value: boolean) => {
    await post({
      action: 'checklist',
      dispatch_id: id,
      checklist: { [key]: value },
    });
  };

  if (!dispatch && !error) return <p>Chargement…</p>;
  if (!dispatch) return <div className="text-red-600">{error}</div>;

  const checklist = (dispatch.checklist ?? {}) as Record<string, boolean>;
  const dispatchLots = (dispatch.lots as Array<Record<string, unknown>>) ?? [];
  const status = dispatch.status as string;

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <Link href="/factory/dispatches" className="text-sm text-[#8B6914] hover:underline">
          ← Expéditions
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-[#8B6914]">Bon d&apos;expédition</p>
          <h1 className="text-2xl font-bold text-[#5C4033]">{String(dispatch.dispatch_number)}</h1>
          <p className="text-sm text-gray-600">
            {String(dispatch.destination || '—')} · {status}
            {dispatch.requested_weight_kg != null
              ? ` · ${Number(dispatch.requested_weight_kg).toFixed(0)} kg demandés`
              : ''}
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg border border-[#5C4033] px-4 py-2 text-sm text-[#5C4033]"
          >
            Imprimer bon
          </button>
          {status !== 'shipped' && status !== 'cancelled' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => post({ action: 'ship', dispatch_id: id })}
              className="rounded-lg bg-[#5C4033] px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              Expédier
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 print:hidden">{error}</div>
      )}

      <section className="rounded-xl border border-[#d4c4b0] bg-white p-4">
        <h2 className="mb-3 font-semibold text-[#5C4033]">Checklist départ</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {CHECKLIST_KEYS.map(({ key, label }) => (
            <li key={key}>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!checklist[key]}
                  disabled={busy || status === 'shipped'}
                  onChange={(e) => toggleCheck(key, e.target.checked)}
                  className="print:hidden"
                />
                <span>
                  {label} {checklist[key] ? '✓' : '○'}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-[#d4c4b0] bg-white p-4">
        <h2 className="mb-3 font-semibold text-[#5C4033]">Lots réservés</h2>
        <ul className="mb-4 space-y-1 text-sm">
          {dispatchLots.map((row) => {
            const lot = row.lot as { lot_number?: string; status?: string } | undefined;
            return (
              <li key={String(row.id)} className="flex justify-between border-b border-gray-50 py-1">
                <span>
                  {lot?.lot_number ?? String(row.lot_id)} · {lot?.status ?? ''}
                </span>
                <span>
                  {Number(row.weight_kg).toFixed(1)} kg
                  {row.bag_count != null ? ` · ${row.bag_count} sacs` : ''}
                </span>
              </li>
            );
          })}
          {dispatchLots.length === 0 && (
            <li className="text-gray-500">Aucun lot ajouté</li>
          )}
        </ul>

        {status !== 'shipped' && (
          <div className="flex flex-wrap gap-2 print:hidden">
            <select
              className="min-w-[220px] flex-1 rounded border px-3 py-2 text-sm"
              value={addLotId}
              onChange={(e) => setAddLotId(e.target.value)}
            >
              <option value="">Sélectionner un lot…</option>
              {lots.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.lot_number} · {l.oncc_grade ? ONCC_GRADE_LABELS[l.oncc_grade as OnccGrade] : '—'} ·{' '}
                  {Number(l.net_weight_kg).toFixed(0)} kg
                </option>
              ))}
            </select>
            <input
              className="w-28 rounded border px-3 py-2 text-sm"
              placeholder="Poids kg"
              value={addWeight}
              onChange={(e) => setAddWeight(e.target.value)}
            />
            <input
              className="w-24 rounded border px-3 py-2 text-sm"
              placeholder="Sacs"
              value={addBags}
              onChange={(e) => setAddBags(e.target.value)}
            />
            <button
              type="button"
              disabled={busy || !addLotId || !addWeight}
              onClick={() =>
                post({
                  action: 'add_lot',
                  dispatch_id: id,
                  lot_id: addLotId,
                  weight_kg: Number(addWeight),
                  bag_count: addBags ? Number(addBags) : null,
                }).then(() => {
                  setAddLotId('');
                  setAddWeight('');
                  setAddBags('');
                })
              }
              className="rounded-lg bg-[#5C4033] px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              Ajouter
            </button>
          </div>
        )}
      </section>

      <footer className="hidden border-t pt-4 text-xs text-gray-500 print:block">
        CocoaTrack — Bon d&apos;expédition {String(dispatch.dispatch_number)} —{' '}
        {new Date().toLocaleString('fr-FR')}
      </footer>
    </div>
  );
}
