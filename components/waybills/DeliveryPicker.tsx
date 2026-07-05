'use client';

import { useEffect, useState } from 'react';
import { deliveriesApi } from '@/lib/api/deliveries';
import type { DeliveryWithRelations } from '@/lib/validations/delivery';

interface DeliveryPickerProps {
  cooperativeId?: string;
  excludedIds: Set<string>;
  selectedIds: Set<string>;
  onChange: (ids: Set<string>) => void;
  loadingDateFrom?: string;
  loadingDateTo?: string;
}

export function DeliveryPicker({
  cooperativeId,
  excludedIds,
  selectedIds,
  onChange,
  loadingDateFrom,
  loadingDateTo,
}: DeliveryPickerProps) {
  const [deliveries, setDeliveries] = useState<DeliveryWithRelations[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const result = await deliveriesApi.list({
          page: 1,
          pageSize: 100,
          cooperative_id: cooperativeId,
          date_from: loadingDateFrom,
          date_to: loadingDateTo,
          sortBy: 'delivered_at',
          sortOrder: 'desc',
        });
        setDeliveries(result.data);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [cooperativeId, loadingDateFrom, loadingDateTo]);

  const toggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  if (loading) {
    return <p className="text-sm text-gray-500">Chargement des livraisons…</p>;
  }

  const available = deliveries.filter((d) => !excludedIds.has(d.id) || selectedIds.has(d.id));

  if (available.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Aucune livraison disponible (non déjà rattachée à une LV).
      </p>
    );
  }

  const selectedWeight = available
    .filter((d) => selectedIds.has(d.id))
    .reduce((s, d) => s + Number(d.weight_kg), 0);

  return (
    <div className="space-y-3">
      <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200 divide-y">
        {available.map((d) => {
          const checked = selectedIds.has(d.id);
          const disabled = excludedIds.has(d.id) && !checked;
          return (
            <label
              key={d.id}
              className={`flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-gray-50 ${disabled ? 'opacity-50' : ''}`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={() => toggle(d.id)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900">{d.code}</div>
                <div className="text-xs text-gray-500">
                  {d.planteur?.name || '—'} · {Number(d.weight_kg).toLocaleString('fr-FR')} kg
                </div>
              </div>
            </label>
          );
        })}
      </div>
      {selectedIds.size > 0 && (
        <p className="text-xs text-gray-600">
          {selectedIds.size} livraison(s) sélectionnée(s) ·{' '}
          {selectedWeight.toLocaleString('fr-FR')} kg
        </p>
      )}
    </div>
  );
}
