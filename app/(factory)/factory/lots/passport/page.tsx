'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  COCOA_LOT_STATUS_LABELS,
  ONCC_GRADE_LABELS,
  type LotPassport,
  type CocoaLotStatus,
  type OnccGrade,
} from '@/types/usinage';

function LotPassportContent() {
  const searchParams = useSearchParams();
  const initialLot = searchParams.get('lot') || '';
  const initialId = searchParams.get('id') || '';
  const [lotQuery, setLotQuery] = useState(initialLot);
  const [passport, setPassport] = useState<LotPassport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [blockReason, setBlockReason] = useState('');

  const load = async (opts?: { lot?: string; id?: string }) => {
    const lot = opts?.lot ?? lotQuery;
    const id = opts?.id ?? initialId;
    if (!lot.trim() && !id) return;
    setLoading(true);
    setError(null);
    try {
      const qs = id
        ? `id=${encodeURIComponent(id)}`
        : `lot=${encodeURIComponent(lot.trim())}`;
      const res = await fetch(`/api/factory/lots/passport?${qs}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Erreur');
      setPassport(body);
      if (body.lot?.lot_number) setLotQuery(body.lot.lot_number);
    } catch (e) {
      setPassport(null);
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialId) void load({ id: initialId });
    else if (initialLot) void load({ lot: initialLot });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLot, initialId]);

  const changeStatus = async (status: CocoaLotStatus) => {
    if (!passport) return;
    const res = await fetch('/api/factory/lots/passport', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lot_id: passport.lot.id,
        status,
        reason: status === 'blocked' ? blockReason || 'Bloqué manuellement' : undefined,
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error || 'Erreur statut');
      return;
    }
    await load({ lot: passport.lot.lot_number });
  };

  return (
    <div className="mx-auto max-w-[210mm] space-y-6 print:max-w-none print:space-y-3">
      <div className="hidden print:block border-b border-gray-300 pb-3">
        <p className="text-lg font-bold text-[#5C4033]">CocoaTrack — Passeport lot cacao</p>
        <p className="text-xs text-gray-500">Document de traçabilité · {new Date().toLocaleString('fr-FR')}</p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-[#5C4033]">Passeport lot</h1>
          <p className="text-sm text-[#8B6914]">Généalogie · sources · qualité · conditionnement · EUDR</p>
        </div>
        <Link href="/factory/traceability" className="text-sm text-[#5C4033] hover:underline">
          ← Traçabilité
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border border-[#d4c4b0] bg-white p-4 print:hidden">
        <input
          className="min-w-[220px] flex-1 rounded border px-3 py-2 text-sm"
          value={lotQuery}
          onChange={(e) => setLotQuery(e.target.value)}
          placeholder="N° lot cacao"
        />
        <button
          type="button"
          onClick={() => load({ lot: lotQuery })}
          className="rounded-lg bg-[#5C4033] px-4 py-2 text-sm text-white"
        >
          Charger
        </button>
        {passport && (
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg border border-[#5C4033] px-4 py-2 text-sm text-[#5C4033]"
          >
            Imprimer / PDF
          </button>
        )}
      </div>

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 print:hidden">{error}</div>}
      {loading && <p className="text-sm text-gray-500 print:hidden">Chargement…</p>}

      {passport && (
        <div className="space-y-4 print:space-y-3">
          <section className="rounded-xl border border-[#d4c4b0] bg-white p-5 print:rounded-none print:border print:p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-[#8B6914]">Lot cacao</p>
                <h2 className="text-xl font-bold text-[#5C4033]">{passport.lot.lot_number}</h2>
                <p className="mt-1 text-sm">
                  {COCOA_LOT_STATUS_LABELS[passport.lot.status]} ·{' '}
                  {passport.lot.oncc_grade
                    ? ONCC_GRADE_LABELS[passport.lot.oncc_grade as OnccGrade]
                    : 'Grade —'}{' '}
                  · {Number(passport.lot.net_weight_kg).toFixed(1)} kg
                </p>
              </div>
              <div
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  passport.eudr.ready ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'
                }`}
              >
                EUDR {passport.eudr.ready ? 'prêt' : 'incomplet'}
                <div className="text-xs font-normal">{passport.eudr.parcelle_count} parcelle(s)</div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-[#d4c4b0] bg-white p-4 print:rounded-none print:border print:p-3">
            <h3 className="mb-2 font-semibold text-[#5C4033]">Sources</h3>
            {passport.sources.length === 0 ? (
              <p className="text-sm text-gray-500">Aucune source liée</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {passport.sources.map((s) => (
                  <li key={s.id} className="flex justify-between border-b border-gray-50 py-1">
                    <span>
                      {s.planteur?.name ?? '—'} / {s.parcelle?.code ?? 'parcelle ?'}
                    </span>
                    <span>{Number(s.weight_kg).toFixed(1)} kg</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="grid gap-4 md:grid-cols-2 print:grid-cols-2">
            <section className="rounded-xl border border-[#d4c4b0] bg-white p-4 print:rounded-none print:border print:p-3">
              <h3 className="mb-2 font-semibold text-[#5C4033]">Parents</h3>
              {(passport.parents ?? []).length === 0 ? (
                <p className="text-sm text-gray-500">Lot racine</p>
              ) : (
                passport.parents.map((r) => (
                  <p key={r.id} className="text-sm">
                    {(r.parent_lot as { lot_number?: string } | undefined)?.lot_number ?? r.parent_lot_id} ·{' '}
                    {Number(r.weight_kg).toFixed(1)} kg
                  </p>
                ))
              )}
            </section>
            <section className="rounded-xl border border-[#d4c4b0] bg-white p-4 print:rounded-none print:border print:p-3">
              <h3 className="mb-2 font-semibold text-[#5C4033]">Enfants</h3>
              {(passport.children ?? []).length === 0 ? (
                <p className="text-sm text-gray-500">Aucun lot dérivé</p>
              ) : (
                passport.children.map((r) => (
                  <p key={r.id} className="text-sm">
                    {(r.child_lot as { lot_number?: string } | undefined)?.lot_number ?? r.child_lot_id} ·{' '}
                    {Number(r.weight_kg).toFixed(1)} kg
                  </p>
                ))
              )}
            </section>
          </div>

          <section className="rounded-xl border border-[#d4c4b0] bg-white p-4 print:rounded-none print:border print:p-3">
            <h3 className="mb-2 font-semibold text-[#5C4033]">Conditionnement</h3>
            {passport.packaging.length === 0 ? (
              <p className="text-sm text-gray-500">Pas encore conditionné</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {passport.packaging.map((u) => (
                  <li key={u.id} className="flex justify-between">
                    <span>
                      {u.unit_number} {u.qr_code ? `(${u.qr_code})` : ''}
                    </span>
                    <span>{Number(u.net_weight_kg).toFixed(1)} kg</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-[#d4c4b0] bg-white p-4 print:rounded-none print:border print:p-3">
            <h3 className="mb-2 font-semibold text-[#5C4033]">Historique statuts</h3>
            <ol className="space-y-1 text-sm">
              {passport.status_history.map((h, i) => (
                <li key={i}>
                  {h.from_status ? COCOA_LOT_STATUS_LABELS[h.from_status] : '—'} →{' '}
                  {COCOA_LOT_STATUS_LABELS[h.to_status]}{' '}
                  <span className="text-gray-500">
                    ({new Date(h.changed_at).toLocaleString('fr-FR')}
                    {h.reason ? ` · ${h.reason}` : ''})
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section className="rounded-xl border border-red-200 bg-red-50/40 p-4 print:hidden">
            <h3 className="mb-2 font-semibold text-red-900">Garde-fous</h3>
            <div className="flex flex-wrap gap-2">
              <input
                className="rounded border px-2 py-1 text-sm"
                placeholder="Motif de blocage"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
              />
              <button
                type="button"
                onClick={() => changeStatus('blocked')}
                className="rounded bg-red-700 px-3 py-1.5 text-sm text-white"
              >
                Bloquer le lot
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default function LotPassportPage() {
  return (
    <Suspense fallback={<p>Chargement…</p>}>
      <LotPassportContent />
    </Suspense>
  );
}
