'use client';

import { useState } from 'react';
import { factoryApi } from '@/lib/api/factory';
import { useProductReleases, useInvalidateFactory } from '@/lib/hooks/useFactory';
import { PRODUCT_RELEASE_STATUS_LABELS } from '@/types/mes';
import type { ProductRelease, ProductReleaseStatus } from '@/types/mes';

export default function FactoryReleasesPage() {
  const [filter, setFilter] = useState<string>('pending');
  const { data, isLoading, error } = useProductReleases(filter || undefined);
  const invalidate = useInvalidateFactory();
  const releases = (data?.data ?? []) as ProductRelease[];
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);

  const decide = async (id: string, status: Exclude<ProductReleaseStatus, 'pending'>) => {
    setMsg(null);
    try {
      await factoryApi.decideProductRelease(id, status, notes[id]);
      invalidate();
      setMsg(`Décision enregistrée: ${PRODUCT_RELEASE_STATUS_LABELS[status]}`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Erreur');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#5C4033]">Libération qualité</h1>
        <p className="text-sm text-[#8B6914]">
          Lots non libérés non consommables / non expédiables
        </p>
      </div>

      <div className="flex gap-2">
        {['pending', 'released', 'blocked', 'rejected', ''].map((s) => (
          <button
            key={s || 'all'}
            type="button"
            onClick={() => setFilter(s)}
            className={`rounded px-3 py-1.5 text-sm ${
              filter === s ? 'bg-[#5C4033] text-white' : 'border border-[#d4c4b0] text-[#5C4033]'
            }`}
          >
            {s ? PRODUCT_RELEASE_STATUS_LABELS[s as ProductReleaseStatus] : 'Tous'}
          </button>
        ))}
      </div>

      {error && <div className="rounded-lg bg-red-50 p-4 text-red-700">{error.message}</div>}
      {msg && <div className="rounded-lg bg-[#faf6f1] p-3 text-sm text-[#5C4033]">{msg}</div>}

      <div className="space-y-3">
        {isLoading ? (
          <p>Chargement…</p>
        ) : releases.length === 0 ? (
          <p className="text-gray-500">Aucun dossier</p>
        ) : (
          releases.map((r) => (
            <div key={r.id} className="rounded-xl border border-[#d4c4b0] bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-[#5C4033]">
                    {r.cocoa_lot?.lot_number ?? r.cocoa_lot_id}
                  </p>
                  <p className="text-xs text-[#8B6914]">
                    {PRODUCT_RELEASE_STATUS_LABELS[r.status]} ·{' '}
                    {r.cocoa_lot?.net_weight_kg != null
                      ? `${Number(r.cocoa_lot.net_weight_kg).toFixed(0)} kg`
                      : ''}
                  </p>
                </div>
                {r.status === 'pending' && (
                  <div className="flex flex-wrap items-end gap-2">
                    <input
                      className="rounded border px-2 py-1 text-sm"
                      placeholder="Notes décision"
                      value={notes[r.id] ?? ''}
                      onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => decide(r.id, 'released')}
                      className="rounded bg-emerald-700 px-3 py-1.5 text-sm text-white"
                    >
                      Libérer
                    </button>
                    <button
                      type="button"
                      onClick={() => decide(r.id, 'released_with_reserve')}
                      className="rounded border border-emerald-700 px-3 py-1.5 text-sm text-emerald-800"
                    >
                      Avec réserve
                    </button>
                    <button
                      type="button"
                      onClick={() => decide(r.id, 'blocked')}
                      className="rounded border border-amber-600 px-3 py-1.5 text-sm text-amber-800"
                    >
                      Bloquer
                    </button>
                    <button
                      type="button"
                      onClick={() => decide(r.id, 'rejected')}
                      className="rounded border border-red-600 px-3 py-1.5 text-sm text-red-700"
                    >
                      Rejeter
                    </button>
                  </div>
                )}
              </div>
              {r.decision_notes && (
                <p className="mt-2 text-sm text-gray-600">{r.decision_notes}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
