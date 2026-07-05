'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Upload } from 'lucide-react';

import { useAuth, hasPermission } from '@/lib/auth';
import { cooperativesApi } from '@/lib/api/cooperatives';
import { waybillsApi } from '@/lib/api/waybills';
import { DeliveriesSubNav } from '@/components/deliveries/DeliveriesSubNav';
import { DeliveryPicker } from '@/components/waybills/DeliveryPicker';
import { useLinkedDeliveryIds } from '@/lib/hooks/useWaybills';
import { COMMERCIAL_TYPES, commercialTypeToQualityGrade, todayDateInputValue } from '@/lib/utils/commercial-type';
import type { CreateWaybillInput } from '@/types/waybills';
import type { QualityGrade } from '@/types';
import { useEffect } from 'react';

export default function NewWaybillPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const canCreate = user && hasPermission(user.role, 'deliveries:create');

  const { data: linkedIds = new Set<string>() } = useLinkedDeliveryIds();
  const [cooperatives, setCooperatives] = useState<Array<{ id: string; name: string }>>([]);
  const [file, setFile] = useState<File | null>(null);
  const [selectedDeliveryIds, setSelectedDeliveryIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weightWarning, setWeightWarning] = useState<string | null>(null);

  const [form, setForm] = useState({
    cooperative_id: user?.cooperative_id ?? '',
    sender_name: '',
    recipient_name: '',
    carrier_name: '',
    vehicle_plate: '',
    driver_name: '',
    origin_location: '',
    destination_location: '',
    loading_date: todayDateInputValue(),
    sack_count: '',
    total_weight_kg: '',
    lot_number: '',
    commercial_type: 'Tout Venant',
    quality_grade: 'B' as QualityGrade,
    notes: '',
  });

  useEffect(() => {
    if (isAdmin) {
      cooperativesApi.listWithStats().then((list) =>
        setCooperatives(list.map((c) => ({ id: c.id, name: c.name })))
      );
    }
  }, [isAdmin]);

  const scopeCoopId = form.cooperative_id || user?.cooperative_id || undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate) return;

    setLoading(true);
    setError(null);
    setWeightWarning(null);

    const payload: CreateWaybillInput = {
      cooperative_id: form.cooperative_id || undefined,
      sender_name: form.sender_name || undefined,
      recipient_name: form.recipient_name || undefined,
      carrier_name: form.carrier_name || undefined,
      vehicle_plate: form.vehicle_plate || undefined,
      driver_name: form.driver_name || undefined,
      origin_location: form.origin_location || undefined,
      destination_location: form.destination_location || undefined,
      loading_date: form.loading_date,
      sack_count: form.sack_count ? parseInt(form.sack_count, 10) : undefined,
      total_weight_kg: form.total_weight_kg ? parseFloat(form.total_weight_kg) : undefined,
      lot_number: form.lot_number || undefined,
      quality_grade: form.quality_grade,
      notes: form.notes || undefined,
      delivery_ids: Array.from(selectedDeliveryIds),
    };

    try {
      const created = await waybillsApi.createWithDocument(payload, file);
      if (
        payload.total_weight_kg &&
        created.linked_weight_kg > 0 &&
        Math.abs(created.linked_weight_kg - payload.total_weight_kg) / payload.total_weight_kg > 0.05
      ) {
        setWeightWarning(
          `Écart de poids > 5 % entre la LV (${payload.total_weight_kg} kg) et les livraisons (${created.linked_weight_kg} kg).`
        );
      }
      router.push(`/deliveries/waybills/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
      setLoading(false);
    }
  };

  if (!canCreate) {
    return (
      <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
        Permission insuffisante
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DeliveriesSubNav />

      <div>
        <Link href="/deliveries/waybills" className="text-sm text-gray-500 hover:text-gray-700">
          ← Retour aux lettres de voiture
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Nouvelle lettre de voiture</h1>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}
      {weightWarning && (
        <div className="rounded-md bg-amber-50 p-4 text-sm text-amber-800">{weightWarning}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="text-lg font-medium">Document scanné</h2>
          <label className="mt-4 flex cursor-pointer flex-col items-center rounded-lg border-2 border-dashed border-gray-300 p-8 hover:border-primary-400">
            <Upload className="h-8 w-8 text-gray-400" />
            <span className="mt-2 text-sm text-gray-600">
              {file ? file.name : 'PDF ou image (max 10 Mo) — optionnel'}
            </span>
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="text-lg font-medium">Transport</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {isAdmin && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Coopérative</label>
                <select
                  value={form.cooperative_id}
                  onChange={(e) => setForm({ ...form, cooperative_id: e.target.value })}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Aucune</option>
                  {cooperatives.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700">Date de chargement *</label>
              <input
                type="date"
                required
                max={todayDateInputValue()}
                value={form.loading_date}
                onChange={(e) => setForm({ ...form, loading_date: e.target.value })}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            {[
              ['sender_name', 'Expéditeur'],
              ['recipient_name', 'Destinataire'],
              ['carrier_name', 'Transporteur'],
              ['vehicle_plate', 'Immatriculation camion'],
              ['driver_name', 'Chauffeur'],
              ['origin_location', 'Lieu de départ'],
              ['destination_location', 'Lieu d\'arrivée'],
              ['lot_number', 'N° de lot'],
            ].map(([key, label]) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700">{label}</label>
                <input
                  type="text"
                  value={form[key as keyof typeof form] as string}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-gray-700">Nombre de sacs</label>
              <input
                type="number"
                min="0"
                value={form.sack_count}
                onChange={(e) => setForm({ ...form, sack_count: e.target.value })}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Poids total LV (kg)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.total_weight_kg}
                onChange={(e) => setForm({ ...form, total_weight_kg: e.target.value })}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Type commercial</label>
              <select
                value={form.commercial_type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    commercial_type: e.target.value,
                    quality_grade: commercialTypeToQualityGrade(e.target.value),
                  })
                }
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                {COMMERCIAL_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="text-lg font-medium">Livraisons rattachées</h2>
          <p className="mt-1 text-xs text-gray-500">
            Sélectionnez les livraisons transportées par ce camion (non déjà liées à une autre LV).
          </p>
          <div className="mt-4">
            <DeliveryPicker
              cooperativeId={scopeCoopId}
              excludedIds={linkedIds}
              selectedIds={selectedDeliveryIds}
              onChange={setSelectedDeliveryIds}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Link
            href="/deliveries/waybills"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Annuler
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {loading ? 'Enregistrement…' : 'Créer la lettre de voiture'}
          </button>
        </div>
      </form>
    </div>
  );
}
