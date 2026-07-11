'use client';

// CocoaTrack V2 - New Delivery Page
// Form to create a new delivery (aligned with receipt import product fields)

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth, hasPermission } from '@/lib/auth';
import { deliveriesApi } from '@/lib/api/deliveries';
import { planteursApi } from '@/lib/api/planteurs';
import { chefPlanteursApi } from '@/lib/api/chef-planteurs';
import { cooperativesApi } from '@/lib/api/cooperatives';
import { createClient } from '@/lib/supabase/client';
import { ReceiptImportButton } from '@/components/receipts/ReceiptImportButton';
import { DeliveriesSubNav } from '@/components/deliveries/DeliveriesSubNav';
import {
  COMMERCIAL_TYPES,
  calculateNetWeightFromGross,
  commercialTypeToQualityGrade,
  dateInputToIso,
  todayDateInputValue,
} from '@/lib/utils/commercial-type';
import type { CreateDeliveryInput } from '@/lib/validations/delivery';
import type { QualityGrade } from '@/types';

interface SelectOption {
  id: string;
  name: string;
  code: string;
}

type DeliveryFormState = {
  cooperative_id: string;
  planteur_id: string;
  chef_planteur_id: string;
  warehouse_id: string;
  delivered_at: string;
  commercial_type: string;
  gross_weight_kg: number;
  humidity: number;
  weight_kg: number;
  price_per_kg: number;
  quality_grade: QualityGrade;
  notes: string;
};

export default function NewDeliveryPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [cooperatives, setCooperatives] = useState<SelectOption[]>([]);
  const [chefPlanteurs, setChefPlanteurs] = useState<SelectOption[]>([]);
  const [planteurs, setPlanteurs] = useState<SelectOption[]>([]);
  const [planteurChefMap, setPlanteurChefMap] = useState<Map<string, string | null>>(new Map());
  const [warehouses, setWarehouses] = useState<SelectOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [netWeightManual, setNetWeightManual] = useState(false);

  const [formData, setFormData] = useState<DeliveryFormState>({
    cooperative_id: user?.cooperative_id ?? '',
    planteur_id: '',
    chef_planteur_id: '',
    warehouse_id: '',
    delivered_at: todayDateInputValue(),
    commercial_type: 'Tout Venant',
    gross_weight_kg: 0,
    humidity: 0,
    weight_kg: 0,
    price_per_kg: 0,
    quality_grade: 'B',
    notes: '',
  });

  const canCreate = user && hasPermission(user.role, 'deliveries:create');

  const scopeCoopId = formData.cooperative_id || user?.cooperative_id || undefined;

  useEffect(() => {
    const loadOptions = async () => {
      setLoadingOptions(true);
      try {
        const supabase = createClient();

        if (isAdmin) {
          const coopList = await cooperativesApi.listWithStats();
          setCooperatives(
            coopList.map((c) => ({ id: c.id, name: c.name, code: c.code || '' }))
          );
        }

        const chefResult = await chefPlanteursApi.list({ page: 1, pageSize: 100 });
        setChefPlanteurs(
          chefResult.data.map((cp) => ({
            id: cp.id,
            name: cp.name,
            code: cp.code,
          }))
        );

        let warehouseQuery = supabase
          .from('warehouses')
          .select('id, name, code')
          .eq('is_active', true)
          .order('name');
        if (scopeCoopId) {
          warehouseQuery = warehouseQuery.eq('cooperative_id', scopeCoopId);
        }
        const { data: warehouseData } = await warehouseQuery;
        setWarehouses(warehouseData || []);
      } catch {
        setError('Impossible de charger les listes');
      } finally {
        setLoadingOptions(false);
      }
    };

    loadOptions();
  }, [isAdmin, scopeCoopId]);

  useEffect(() => {
    const loadPlanteurs = async () => {
      try {
        const result = await planteursApi.list({
          page: 1,
          pageSize: 100,
          is_active: true,
          chef_planteur_id: formData.chef_planteur_id || undefined,
          cooperative_id: scopeCoopId,
        });
        setPlanteurs(
          result.data.map((p) => ({
            id: p.id,
            name: p.name,
            code: p.code,
          }))
        );
        setPlanteurChefMap(
          new Map(result.data.map((p) => [p.id, p.chef_planteur_id ?? null]))
        );
      } catch {
        console.error('Impossible de charger les planteurs');
      }
    };

    loadPlanteurs();
  }, [formData.chef_planteur_id, scopeCoopId]);

  const applyGrossCalculation = (
    gross: number,
    humidity: number,
    manualNet: boolean
  ): number | null => {
    if (manualNet || !gross || gross <= 0) return null;
    return calculateNetWeightFromGross(gross, humidity);
  };

  const handleCommercialTypeChange = (commercialType: string) => {
    setFormData((prev) => ({
      ...prev,
      commercial_type: commercialType,
      quality_grade: commercialTypeToQualityGrade(commercialType),
    }));
  };

  const handleGrossOrHumidityChange = (field: 'gross_weight_kg' | 'humidity', value: number) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      const net = applyGrossCalculation(
        field === 'gross_weight_kg' ? value : prev.gross_weight_kg,
        field === 'humidity' ? value : prev.humidity,
        netWeightManual
      );
      if (net !== null) {
        next.weight_kg = net;
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canCreate) {
      setError("Vous n'avez pas la permission de créer des livraisons");
      return;
    }

    if (!formData.planteur_id) {
      setError('Veuillez sélectionner un planteur');
      return;
    }

    if (formData.delivered_at && new Date(formData.delivered_at) > new Date()) {
      setError('La date de livraison ne peut pas être dans le futur');
      return;
    }

    setLoading(true);
    setError(null);

    const weightLoaded =
      formData.gross_weight_kg > 0 ? formData.gross_weight_kg : undefined;

    const payload: CreateDeliveryInput = {
      planteur_id: formData.planteur_id,
      chef_planteur_id: formData.chef_planteur_id || undefined,
      warehouse_id: formData.warehouse_id || undefined,
      cooperative_id: formData.cooperative_id || undefined,
      weight_kg: formData.weight_kg,
      weight_loaded_kg: weightLoaded,
      price_per_kg: formData.price_per_kg,
      quality_grade: formData.quality_grade,
      delivered_at: dateInputToIso(formData.delivered_at),
      notes: formData.notes || undefined,
    };

    try {
      const delivery = await deliveriesApi.create(payload);
      router.push(`/deliveries/${delivery.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de la création de la livraison');
    } finally {
      setLoading(false);
    }
  };

  const estimatedTotal = Math.round(formData.weight_kg * formData.price_per_kg);
  const lossKg =
    formData.gross_weight_kg > 0 && formData.weight_kg > 0
      ? formData.gross_weight_kg - formData.weight_kg
      : null;

  if (!canCreate) {
    return (
      <div className="space-y-6">
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">
            Vous n&apos;avez pas la permission de créer des livraisons
          </p>
        </div>
        <Link href="/deliveries" className="text-primary-600 hover:text-primary-900">
          ← Retour aux livraisons
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DeliveriesSubNav />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/deliveries" className="text-sm text-gray-500 hover:text-gray-700">
            ← Retour aux livraisons
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">Nouvelle livraison</h1>
          <p className="mt-1 text-sm text-gray-500">
            Saisie manuelle, mêmes données produit que l&apos;import de reçu
          </p>
        </div>
        <ReceiptImportButton
          cooperativeId={formData.cooperative_id || user?.cooperative_id}
          onImportComplete={() => router.push('/deliveries')}
        />
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Acteurs */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="text-lg font-medium text-gray-900">Acteurs</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            {isAdmin && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Coopérative <span className="font-normal text-gray-400">(optionnel)</span>
                </label>
                <select
                  value={formData.cooperative_id}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      cooperative_id: e.target.value,
                      warehouse_id: '',
                      planteur_id: '',
                    }))
                  }
                  disabled={loadingOptions}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-gray-100"
                >
                  <option value="">Aucune</option>
                  {cooperatives.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.code ? `(${c.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Date de livraison <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                max={todayDateInputValue()}
                value={formData.delivered_at}
                onChange={(e) => setFormData({ ...formData, delivered_at: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Planteur <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.planteur_id}
                onChange={(e) => {
                  const planteurId = e.target.value;
                  const linkedChef = planteurChefMap.get(planteurId);
                  setFormData((prev) => ({
                    ...prev,
                    planteur_id: planteurId,
                    chef_planteur_id: linkedChef || prev.chef_planteur_id,
                  }));
                }}
                disabled={loadingOptions || planteurs.length === 0}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-gray-100"
              >
                <option value="">
                  {planteurs.length === 0
                    ? 'Aucun planteur disponible'
                    : 'Sélectionner un planteur'}
                </option>
                {planteurs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Chef planteur <span className="font-normal text-gray-400">(optionnel)</span>
              </label>
              <select
                value={formData.chef_planteur_id}
                onChange={(e) => {
                  const chefId = e.target.value;
                  setFormData((prev) => ({
                    ...prev,
                    chef_planteur_id: chefId,
                    planteur_id:
                      chefId && chefId !== prev.chef_planteur_id ? '' : prev.planteur_id,
                  }));
                }}
                disabled={loadingOptions}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-gray-100"
              >
                <option value="">Aucun</option>
                {chefPlanteurs.map((cp) => (
                  <option key={cp.id} value={cp.id}>
                    {cp.name} ({cp.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Entrepôt <span className="font-normal text-gray-400">(optionnel)</span>
              </label>
              <select
                value={formData.warehouse_id}
                onChange={(e) => setFormData({ ...formData, warehouse_id: e.target.value })}
                disabled={loadingOptions}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-gray-100"
              >
                <option value="">Aucun</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Produit, comme une ligne du reçu */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="text-lg font-medium text-gray-900">Produit</h2>
          <p className="mt-1 text-xs text-gray-500">
            Poids net calculé comme à l&apos;import : PB × (100 − Hmes) / (100 − 8)
          </p>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Type commercial</label>
              <select
                value={formData.commercial_type}
                onChange={(e) => handleCommercialTypeChange(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                {COMMERCIAL_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Qualité <span className="text-xs text-gray-400">(dérivée du type)</span>
              </label>
              <select
                value={formData.quality_grade}
                onChange={(e) =>
                  setFormData({ ...formData, quality_grade: e.target.value as QualityGrade })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="A">Grade A</option>
                <option value="B">Grade B</option>
                <option value="C">Grade C</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Poids brut / chargé (kg) <span className="font-normal text-gray-400">(optionnel)</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.gross_weight_kg || ''}
                onChange={(e) =>
                  handleGrossOrHumidityChange(
                    'gross_weight_kg',
                    parseFloat(e.target.value) || 0
                  )
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Humidité Hmes (%) <span className="font-normal text-gray-400">(optionnel)</span>
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={formData.humidity || ''}
                onChange={(e) =>
                  handleGrossOrHumidityChange('humidity', parseFloat(e.target.value) || 0)
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Poids net / déchargé (kg) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="0.01"
                step="0.01"
                value={formData.weight_kg || ''}
                onChange={(e) => {
                  setNetWeightManual(true);
                  setFormData({
                    ...formData,
                    weight_kg: parseFloat(e.target.value) || 0,
                  });
                }}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="0.00"
              />
              {formData.gross_weight_kg > 0 && !netWeightManual && (
                <p className="mt-1 text-xs text-gray-500">Calculé automatiquement depuis le poids brut</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Prix par kg (XAF) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="1"
                step="1"
                value={formData.price_per_kg || ''}
                onChange={(e) =>
                  setFormData({ ...formData, price_per_kg: parseFloat(e.target.value) || 0 })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="0"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="Notes optionnelles..."
              />
            </div>
          </div>

          {(formData.weight_kg > 0 && formData.price_per_kg > 0) || lossKg !== null ? (
            <div className="mt-6 rounded-md bg-gray-50 p-4 space-y-2">
              {formData.weight_kg > 0 && formData.price_per_kg > 0 && (
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-700">Montant estimé</span>
                  <span className="text-lg font-bold text-primary-600">
                    {new Intl.NumberFormat('fr-FR').format(estimatedTotal)} XAF
                  </span>
                </div>
              )}
              {lossKg !== null && lossKg > 0 && (
                <p className="text-xs text-amber-700">
                  Pertes transport estimées : {lossKg.toLocaleString('fr-FR')} kg
                </p>
              )}
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-3">
          <Link
            href="/deliveries"
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Annuler
          </Link>
          <button
            type="submit"
            disabled={loading || loadingOptions}
            className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {loading ? 'Création...' : 'Créer la livraison'}
          </button>
        </div>
      </form>
    </div>
  );
}
