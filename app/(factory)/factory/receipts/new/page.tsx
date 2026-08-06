'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { factoryApi } from '@/lib/api/factory';
import { useInvalidateFactory } from '@/lib/hooks/useFactory';
import { createClient } from '@/lib/supabase/client';

interface ParcelleOption {
  id: string;
  code: string;
  label: string | null;
}

interface ShareRow {
  parcelle_id: string;
  weight_kg: string;
}

export default function NewFactoryReceiptPage() {
  const router = useRouter();
  const invalidate = useInvalidateFactory();
  const [search, setSearch] = useState('');
  const [waybills, setWaybills] = useState<Array<Record<string, unknown>>>([]);
  const [deliveries, setDeliveries] = useState<Array<Record<string, unknown>>>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parcelles, setParcelles] = useState<ParcelleOption[]>([]);
  const [shares, setShares] = useState<ShareRow[]>([]);
  const [photoUrlsText, setPhotoUrlsText] = useState('');

  const [form, setForm] = useState({
    received_date: new Date().toISOString().slice(0, 10),
    received_weight_kg: '',
    declared_weight_kg: '',
    tare_kg: '',
    gross_weight_kg: '',
    bag_count: '',
    upstream_lot_number: '',
    supplier_name: '',
    transport_document_number: '',
    vehicle_number: '',
    driver_name: '',
    cooperative_id: '',
    waybill_id: '',
    delivery_id: '',
    planteur_id: '',
    notes: '',
  });

  const netFromGrossTare = useMemo(() => {
    const gross = form.gross_weight_kg ? parseFloat(form.gross_weight_kg) : NaN;
    const tare = form.tare_kg ? parseFloat(form.tare_kg) : NaN;
    if (!Number.isNaN(gross) && !Number.isNaN(tare)) return Math.max(0, gross - tare);
    return null;
  }, [form.gross_weight_kg, form.tare_kg]);

  useEffect(() => {
    if (netFromGrossTare != null && !Number.isNaN(netFromGrossTare)) {
      setForm((f) => ({ ...f, received_weight_kg: String(netFromGrossTare.toFixed(2)) }));
    }
  }, [netFromGrossTare]);

  useEffect(() => {
    if (!form.planteur_id) {
      setParcelles([]);
      return;
    }
    const supabase = createClient();
    void supabase
      .from('parcelles')
      .select('id, code, label')
      .eq('planteur_id', form.planteur_id)
      .eq('is_active', true)
      .order('code')
      .then(({ data }) => setParcelles((data as ParcelleOption[]) ?? []));
  }, [form.planteur_id]);

  const searchWaybills = async () => {
    if (!search.trim()) return;
    const result = await factoryApi.searchUpstream(search);
    setWaybills(result.waybills as Array<Record<string, unknown>>);
    setDeliveries(((result as { deliveries?: unknown[] }).deliveries ?? []) as Array<Record<string, unknown>>);
  };

  const applyWaybill = (wb: Record<string, unknown>) => {
    const coop = wb.cooperative as { id?: string; name?: string } | null;
    const links = (wb.waybill_deliveries as Array<{
      delivery_id: string;
      delivery?: { id: string; code: string; weight_kg: number; planteur_id: string; planteur?: { name: string } };
    }>) ?? [];
    const first = links[0]?.delivery;
    setForm((f) => ({
      ...f,
      waybill_id: wb.id as string,
      delivery_id: first?.id || links[0]?.delivery_id || '',
      planteur_id: first?.planteur_id || '',
      upstream_lot_number: (wb.lot_number as string) || '',
      declared_weight_kg: String(wb.total_weight_kg ?? ''),
      received_weight_kg: String(wb.total_weight_kg ?? f.received_weight_kg),
      transport_document_number: wb.code as string,
      vehicle_number: (wb.vehicle_plate as string) || '',
      supplier_name: coop?.name || (wb.carrier_name as string) || '',
      cooperative_id: coop?.id || '',
    }));
    setShares([]);
    setWaybills([]);
    setDeliveries([]);
    setSearch('');
  };

  const applyDelivery = (d: Record<string, unknown>) => {
    const planteur = d.planteur as { id?: string; name?: string } | null;
    setForm((f) => ({
      ...f,
      delivery_id: d.id as string,
      planteur_id: (d.planteur_id as string) || '',
      declared_weight_kg: String(d.weight_kg ?? ''),
      received_weight_kg: String(d.weight_kg ?? f.received_weight_kg),
      supplier_name: planteur?.name || f.supplier_name,
      upstream_lot_number: (d.code as string) || f.upstream_lot_number,
    }));
    setShares([]);
    setWaybills([]);
    setDeliveries([]);
    setSearch('');
  };

  const addShare = () => {
    if (!parcelles.length) return;
    setShares((s) => [...s, { parcelle_id: parcelles[0].id, weight_kg: '' }]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (form.delivery_id && shares.length > 0) {
        const payload = shares
          .filter((s) => s.parcelle_id && s.weight_kg)
          .map((s) => ({ parcelle_id: s.parcelle_id, weight_kg: parseFloat(s.weight_kg) }));
        if (payload.length) {
          await factoryApi.setDeliveryParcelleShares(form.delivery_id, payload);
        }
      }

      const photo_urls = photoUrlsText
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);

      const receipt = await factoryApi.createReceipt({
        received_date: form.received_date,
        received_weight_kg: parseFloat(form.received_weight_kg),
        declared_weight_kg: form.declared_weight_kg ? parseFloat(form.declared_weight_kg) : null,
        tare_kg: form.tare_kg ? parseFloat(form.tare_kg) : null,
        gross_weight_kg: form.gross_weight_kg ? parseFloat(form.gross_weight_kg) : null,
        bag_count: form.bag_count ? parseInt(form.bag_count, 10) : null,
        upstream_lot_number: form.upstream_lot_number || null,
        supplier_name: form.supplier_name || null,
        transport_document_number: form.transport_document_number || null,
        vehicle_number: form.vehicle_number || null,
        driver_name: form.driver_name || null,
        cooperative_id: form.cooperative_id || null,
        waybill_id: form.waybill_id || null,
        delivery_id: form.delivery_id || null,
        notes: form.notes || null,
        photo_urls,
        campaign_year: new Date(form.received_date).getFullYear(),
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
      <Link href="/factory/receipts" className="text-sm text-[#8B6914] hover:underline">
        ← Réceptions
      </Link>
      <h1 className="text-2xl font-bold text-[#5C4033]">Nouvelle réception</h1>

      <div className="rounded-xl border border-[#d4c4b0] bg-white p-4">
        <p className="mb-2 text-sm font-medium text-[#5C4033]">Lien amont (LV / livraison)</p>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Code LV, lot, immatriculation, livraison…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            type="button"
            onClick={searchWaybills}
            className="rounded-lg bg-[#8B6914] px-4 py-2 text-sm text-white"
          >
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
                  LV {(wb.code as string)} · Lot {(wb.lot_number as string) || '-'} ·{' '}
                  {Number(wb.total_weight_kg || 0).toFixed(0)} kg
                </button>
              </li>
            ))}
          </ul>
        )}
        {deliveries.length > 0 && (
          <ul className="mt-2 space-y-1">
            {deliveries.map((d) => (
              <li key={d.id as string}>
                <button
                  type="button"
                  onClick={() => applyDelivery(d)}
                  className="w-full rounded border border-[#d4c4b0] px-3 py-2 text-left text-sm hover:bg-[#faf6f1]"
                >
                  Livraison {(d.code as string)} · {Number(d.weight_kg || 0).toFixed(0)} kg
                  {(d.planteur as { name?: string } | null)?.name
                    ? ` · ${(d.planteur as { name: string }).name}`
                    : ''}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-[#d4c4b0] bg-white p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Date réception"
            type="date"
            value={form.received_date}
            onChange={(v) => setForm({ ...form, received_date: v })}
            required
          />
          <Field
            label="Poids brut (kg)"
            type="number"
            step="0.01"
            value={form.gross_weight_kg}
            onChange={(v) => setForm({ ...form, gross_weight_kg: v })}
          />
          <Field
            label="Tare (kg)"
            type="number"
            step="0.01"
            value={form.tare_kg}
            onChange={(v) => setForm({ ...form, tare_kg: v })}
          />
          <Field
            label="Poids net reçu (kg)"
            type="number"
            step="0.01"
            value={form.received_weight_kg}
            onChange={(v) => setForm({ ...form, received_weight_kg: v })}
            required
          />
          <Field
            label="Poids annoncé (kg)"
            type="number"
            step="0.01"
            value={form.declared_weight_kg}
            onChange={(v) => setForm({ ...form, declared_weight_kg: v })}
          />
          <Field
            label="Nombre de sacs"
            type="number"
            value={form.bag_count}
            onChange={(v) => setForm({ ...form, bag_count: v })}
          />
          <Field
            label="Lot amont"
            value={form.upstream_lot_number}
            onChange={(v) => setForm({ ...form, upstream_lot_number: v })}
          />
          <Field
            label="Fournisseur / Coop"
            value={form.supplier_name}
            onChange={(v) => setForm({ ...form, supplier_name: v })}
          />
          <Field
            label="N° lettre de voiture"
            value={form.transport_document_number}
            onChange={(v) => setForm({ ...form, transport_document_number: v })}
          />
          <Field
            label="Immatriculation"
            value={form.vehicle_number}
            onChange={(v) => setForm({ ...form, vehicle_number: v })}
          />
          <Field
            label="Chauffeur"
            value={form.driver_name}
            onChange={(v) => setForm({ ...form, driver_name: v })}
          />
        </div>

        {form.delivery_id && (
          <div className="rounded-lg border border-[#d4c4b0] bg-[#faf6f1] p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#5C4033]">Répartition parcelles (EUDR)</h3>
              <button
                type="button"
                onClick={addShare}
                disabled={!parcelles.length}
                className="text-xs text-[#5C4033] underline disabled:opacity-40"
              >
                + parcelle
              </button>
            </div>
            {!parcelles.length ? (
              <p className="text-xs text-gray-500">Aucune parcelle active pour ce planteur.</p>
            ) : (
              <ul className="space-y-2">
                {shares.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <select
                      className="flex-1 rounded border px-2 py-1 text-sm"
                      value={s.parcelle_id}
                      onChange={(e) => {
                        const next = [...shares];
                        next[i] = { ...next[i], parcelle_id: e.target.value };
                        setShares(next);
                      }}
                    >
                      {parcelles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.code}
                          {p.label ? ` — ${p.label}` : ''}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="kg"
                      className="w-28 rounded border px-2 py-1 text-sm"
                      value={s.weight_kg}
                      onChange={(e) => {
                        const next = [...shares];
                        next[i] = { ...next[i], weight_kg: e.target.value };
                        setShares(next);
                      }}
                    />
                    <button
                      type="button"
                      className="text-xs text-red-700"
                      onClick={() => setShares(shares.filter((_, j) => j !== i))}
                    >
                      Retirer
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Photos (URLs, une par ligne)
          </label>
          <textarea
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            rows={2}
            placeholder="https://… ou chemin storage"
            value={photoUrlsText}
            onChange={(e) => setPhotoUrlsText(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Notes</label>
          <textarea
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-[#5C4033] py-3 font-medium text-white hover:bg-[#4a3329] disabled:opacity-50"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer la réception'}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  step,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  step?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <input
        type={type}
        step={step}
        required={required}
        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
