'use client';

import { useEffect, useState } from 'react';
import { ONCC_GRADE_LABELS, type CocoaLot, type OnccGrade } from '@/types/usinage';

interface Zone {
  id: string;
  code: string;
  name: string;
  zone_type: string;
}

interface Location {
  id: string;
  code: string;
  aisle: string | null;
  capacity_kg: number | null;
  zone?: Zone;
}

export default function FactoryWmsPage() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [lots, setLots] = useState<CocoaLot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [zoneForm, setZoneForm] = useState({ code: '', name: '', zone_type: 'general' });
  const [locForm, setLocForm] = useState({ zone_id: '', code: '', capacity_kg: '' });
  const [packForm, setPackForm] = useState({
    lot_id: '',
    count: '10',
    net_weight_kg_each: '65',
  });

  const load = async () => {
    const [z, l, lotsRes] = await Promise.all([
      fetch('/api/factory/wms?resource=zones').then((r) => r.json()),
      fetch('/api/factory/wms?resource=locations').then((r) => r.json()),
      fetch('/api/factory/lots?status=stored,packaged,accepted,to_clean,to_dry').then((r) => r.json()),
    ]);
    if (z.error || l.error || lotsRes.error) {
      setError(z.error || l.error || lotsRes.error);
      return;
    }
    setZones(z.data ?? []);
    setLocations(l.data ?? []);
    setLots(lotsRes.data ?? []);
  };

  useEffect(() => {
    void load();
  }, []);

  const createZone = async () => {
    const res = await fetch('/api/factory/wms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_zone', ...zoneForm }),
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error);
      return;
    }
    setZoneForm({ code: '', name: '', zone_type: 'general' });
    await load();
  };

  const createLocation = async () => {
    const res = await fetch('/api/factory/wms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create_location',
        zone_id: locForm.zone_id,
        code: locForm.code,
        capacity_kg: locForm.capacity_kg ? Number(locForm.capacity_kg) : null,
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error);
      return;
    }
    setLocForm({ zone_id: '', code: '', capacity_kg: '' });
    await load();
  };

  const packageLot = async () => {
    const res = await fetch('/api/factory/wms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'package',
        lot_id: packForm.lot_id,
        count: Number(packForm.count),
        net_weight_kg_each: Number(packForm.net_weight_kg_each),
        unit_type: 'bag',
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error);
      return;
    }
    setError(null);
    alert(`${(body.data ?? []).length} sacs créés`);
    await load();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#5C4033]">Magasin & conditionnement</h1>
      <p className="text-sm text-[#8B6914]">Zones → emplacements · sacs / QR</p>

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-[#d4c4b0] bg-white p-4">
          <h2 className="mb-3 font-semibold">Zones</h2>
          <div className="mb-3 flex flex-wrap gap-2">
            <input
              className="rounded border px-2 py-1 text-sm"
              placeholder="Code"
              value={zoneForm.code}
              onChange={(e) => setZoneForm({ ...zoneForm, code: e.target.value })}
            />
            <input
              className="rounded border px-2 py-1 text-sm"
              placeholder="Nom"
              value={zoneForm.name}
              onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })}
            />
            <select
              className="rounded border px-2 py-1 text-sm"
              value={zoneForm.zone_type}
              onChange={(e) => setZoneForm({ ...zoneForm, zone_type: e.target.value })}
            >
              {['reception', 'quarantine', 'drying', 'compliant', 'blocked', 'shipping', 'general'].map(
                (t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                )
              )}
            </select>
            <button type="button" onClick={createZone} className="rounded bg-[#5C4033] px-3 py-1 text-sm text-white">
              Ajouter
            </button>
          </div>
          <ul className="space-y-1 text-sm">
            {zones.map((z) => (
              <li key={z.id} className="flex justify-between border-b py-1">
                <span>
                  {z.code} — {z.name}
                </span>
                <span className="text-gray-500">{z.zone_type}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-[#d4c4b0] bg-white p-4">
          <h2 className="mb-3 font-semibold">Emplacements</h2>
          <div className="mb-3 flex flex-wrap gap-2">
            <select
              className="rounded border px-2 py-1 text-sm"
              value={locForm.zone_id}
              onChange={(e) => setLocForm({ ...locForm, zone_id: e.target.value })}
            >
              <option value="">Zone…</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.code}
                </option>
              ))}
            </select>
            <input
              className="rounded border px-2 py-1 text-sm"
              placeholder="Code emplacement"
              value={locForm.code}
              onChange={(e) => setLocForm({ ...locForm, code: e.target.value })}
            />
            <input
              className="w-24 rounded border px-2 py-1 text-sm"
              placeholder="Cap. kg"
              value={locForm.capacity_kg}
              onChange={(e) => setLocForm({ ...locForm, capacity_kg: e.target.value })}
            />
            <button
              type="button"
              onClick={createLocation}
              className="rounded bg-[#5C4033] px-3 py-1 text-sm text-white"
            >
              Ajouter
            </button>
          </div>
          <ul className="max-h-64 space-y-1 overflow-auto text-sm">
            {locations.map((l) => (
              <li key={l.id} className="flex justify-between border-b py-1">
                <span>
                  {l.zone?.code}/{l.code}
                </span>
                <span className="text-gray-500">{l.capacity_kg ? `${l.capacity_kg} kg` : '—'}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-xl border border-[#d4c4b0] bg-white p-4">
        <h2 className="mb-3 font-semibold">Conditionner un lot (sacs)</h2>
        <div className="flex flex-wrap gap-2">
          <select
            className="min-w-[260px] flex-1 rounded border px-3 py-2 text-sm"
            value={packForm.lot_id}
            onChange={(e) => setPackForm({ ...packForm, lot_id: e.target.value })}
          >
            <option value="">Sélectionner un lot…</option>
            {lots.map((l) => (
              <option key={l.id} value={l.id}>
                {l.lot_number} · {l.oncc_grade ? ONCC_GRADE_LABELS[l.oncc_grade as OnccGrade] : '—'} ·{' '}
                {Number(l.net_weight_kg).toFixed(0)} kg ({l.status})
              </option>
            ))}
          </select>
          <input
            className="w-24 rounded border px-3 py-2 text-sm"
            placeholder="Nb sacs"
            value={packForm.count}
            onChange={(e) => setPackForm({ ...packForm, count: e.target.value })}
          />
          <input
            className="w-28 rounded border px-3 py-2 text-sm"
            placeholder="kg / sac"
            value={packForm.net_weight_kg_each}
            onChange={(e) => setPackForm({ ...packForm, net_weight_kg_each: e.target.value })}
          />
          <button
            type="button"
            disabled={!packForm.lot_id}
            onClick={packageLot}
            className="rounded-lg bg-[#5C4033] px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            Générer sacs + QR
          </button>
        </div>
      </section>
    </div>
  );
}
