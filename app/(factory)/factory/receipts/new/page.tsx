'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { factoryApi } from '@/lib/api/factory';
import { useInvalidateFactory } from '@/lib/hooks/useFactory';

export default function NewFactoryReceiptPage() {
  const router = useRouter();
  const invalidate = useInvalidateFactory();
  const [search, setSearch] = useState('');
  const [waybills, setWaybills] = useState<Array<Record<string, unknown>>>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    received_date: new Date().toISOString().slice(0, 10),
    received_weight_kg: '',
    declared_weight_kg: '',
    bag_count: '',
    upstream_lot_number: '',
    supplier_name: '',
    transport_document_number: '',
    vehicle_number: '',
    driver_name: '',
    cooperative_id: '',
    waybill_id: '',
    notes: '',
  });

  const searchWaybills = async () => {
    if (!search.trim()) return;
    const result = await factoryApi.searchUpstream(search);
    setWaybills(result.waybills as Array<Record<string, unknown>>);
  };

  const applyWaybill = (wb: Record<string, unknown>) => {
    const coop = wb.cooperative as { id?: string; name?: string } | null;
    setForm((f) => ({
      ...f,
      waybill_id: wb.id as string,
      upstream_lot_number: (wb.lot_number as string) || '',
      declared_weight_kg: String(wb.total_weight_kg ?? ''),
      received_weight_kg: String(wb.total_weight_kg ?? f.received_weight_kg),
      transport_document_number: wb.code as string,
      vehicle_number: (wb.vehicle_plate as string) || '',
      supplier_name: coop?.name || (wb.carrier_name as string) || '',
      cooperative_id: coop?.id || '',
    }));
    setWaybills([]);
    setSearch('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const receipt = await factoryApi.createReceipt({
        received_date: form.received_date,
        received_weight_kg: parseFloat(form.received_weight_kg),
        declared_weight_kg: form.declared_weight_kg ? parseFloat(form.declared_weight_kg) : null,
        bag_count: form.bag_count ? parseInt(form.bag_count) : null,
        upstream_lot_number: form.upstream_lot_number || null,
        supplier_name: form.supplier_name || null,
        transport_document_number: form.transport_document_number || null,
        vehicle_number: form.vehicle_number || null,
        driver_name: form.driver_name || null,
        cooperative_id: form.cooperative_id || null,
        waybill_id: form.waybill_id || null,
        notes: form.notes || null,
      });
      invalidate();
      router.push(`/factory/receipts/${receipt.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/factory/receipts" className="text-sm text-[#8B6914] hover:underline">← Réceptions</Link>
      <h1 className="text-2xl font-bold text-[#5C4033]">Nouvelle réception</h1>

      <div className="rounded-xl border border-[#d4c4b0] bg-white p-4">
        <p className="mb-2 text-sm font-medium text-[#5C4033]">Lien amont (lettre de voiture)</p>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Code LV, lot, immatriculation…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="button" onClick={searchWaybills} className="rounded-lg bg-[#8B6914] px-4 py-2 text-sm text-white">
            Rechercher
          </button>
        </div>
        {waybills.length > 0 && (
          <ul className="mt-2 space-y-1">
            {waybills.map((wb) => (
              <li key={wb.id as string}>
                <button
                  type="button"
                  onClick={() => applyWaybill(wb)}
                  className="w-full rounded border border-[#d4c4b0] px-3 py-2 text-left text-sm hover:bg-[#faf6f1]"
                >
                  {(wb.code as string)} · Lot {(wb.lot_number as string) || '-'} · {Number(wb.total_weight_kg || 0).toFixed(0)} kg
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-[#d4c4b0] bg-white p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date réception" type="date" value={form.received_date} onChange={(v) => setForm({ ...form, received_date: v })} required />
          <Field label="Poids reçu (kg)" type="number" step="0.01" value={form.received_weight_kg} onChange={(v) => setForm({ ...form, received_weight_kg: v })} required />
          <Field label="Poids annoncé (kg)" type="number" step="0.01" value={form.declared_weight_kg} onChange={(v) => setForm({ ...form, declared_weight_kg: v })} />
          <Field label="Nombre de sacs" type="number" value={form.bag_count} onChange={(v) => setForm({ ...form, bag_count: v })} />
          <Field label="Lot amont" value={form.upstream_lot_number} onChange={(v) => setForm({ ...form, upstream_lot_number: v })} />
          <Field label="Fournisseur / Coop" value={form.supplier_name} onChange={(v) => setForm({ ...form, supplier_name: v })} />
          <Field label="N° lettre de voiture" value={form.transport_document_number} onChange={(v) => setForm({ ...form, transport_document_number: v })} />
          <Field label="Immatriculation" value={form.vehicle_number} onChange={(v) => setForm({ ...form, vehicle_number: v })} />
          <Field label="Chauffeur" value={form.driver_name} onChange={(v) => setForm({ ...form, driver_name: v })} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Notes</label>
          <textarea className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        <button type="submit" disabled={saving} className="w-full rounded-lg bg-[#5C4033] py-3 font-medium text-white hover:bg-[#4a3329] disabled:opacity-50">
          {saving ? 'Enregistrement…' : 'Enregistrer la réception'}
        </button>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', step, required }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; step?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <input type={type} step={step} required={required} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
