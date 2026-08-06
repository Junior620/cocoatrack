'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface DispatchRow {
  id: string;
  dispatch_number: string;
  status: string;
  destination: string | null;
  requested_weight_kg: number | null;
  client?: { name: string } | null;
}

export default function FactoryDispatchesPage() {
  const [rows, setRows] = useState<DispatchRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [destination, setDestination] = useState('');
  const [weight, setWeight] = useState('');
  const [creating, setCreating] = useState(false);

  const load = async () => {
    const res = await fetch('/api/factory/dispatches');
    const body = await res.json();
    if (!res.ok) {
      setError(body.error);
      return;
    }
    setRows(body.data ?? []);
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/factory/dispatches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          destination: destination || null,
          requested_weight_kg: weight ? Number(weight) : null,
          product_label: 'Fèves de cacao',
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setDestination('');
      setWeight('');
      await load();
      if (body.id) window.location.href = `/factory/dispatches/${body.id}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#5C4033]">Expéditions</h1>
      <p className="text-sm text-[#8B6914]">Checklist · lots réservés · bon d&apos;expédition</p>

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <section className="rounded-xl border border-[#d4c4b0] bg-white p-4">
        <h2 className="mb-3 font-semibold">Nouvelle expédition</h2>
        <div className="flex flex-wrap gap-2">
          <input
            className="rounded border px-3 py-2 text-sm"
            placeholder="Destination"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          />
          <input
            className="w-32 rounded border px-3 py-2 text-sm"
            placeholder="Poids kg"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
          <button
            type="button"
            disabled={creating}
            onClick={create}
            className="rounded-lg bg-[#5C4033] px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            Créer
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-[#d4c4b0] bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-[#faf6f1] text-left">
            <tr>
              <th className="px-4 py-2">N°</th>
              <th className="px-4 py-2">Client / dest.</th>
              <th className="px-4 py-2">Poids</th>
              <th className="px-4 py-2">Statut</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-gray-100 hover:bg-[#faf6f1]">
                <td className="px-4 py-2 font-medium">
                  <Link href={`/factory/dispatches/${r.id}`} className="text-[#5C4033] hover:underline">
                    {r.dispatch_number}
                  </Link>
                </td>
                <td className="px-4 py-2">{r.client?.name || r.destination || '—'}</td>
                <td className="px-4 py-2">
                  {r.requested_weight_kg != null ? `${Number(r.requested_weight_kg).toFixed(0)} kg` : '—'}
                </td>
                <td className="px-4 py-2">{r.status}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                  Aucune expédition
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
