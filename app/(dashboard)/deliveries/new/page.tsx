'use client';

// CocoaTrack V2 - New Delivery Page
// Form to create a new delivery

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth, hasPermission } from '@/lib/auth';
import { deliveriesApi } from '@/lib/api/deliveries';
import { planteursApi } from '@/lib/api/planteurs';
import { chefPlanteursApi } from '@/lib/api/chef-planteurs';
import { createClient } from '@/lib/supabase/client';
import type { CreateDeliveryInput } from '@/lib/validations/delivery';
import type { QualityGrade } from '@/types';

interface SelectOption {
  id: string;
  name: string;
  code: string;
}

export default function NewDeliveryPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Options for selects
  const [chefPlanteurs, setChefPlanteurs] = useState<SelectOption[]>([]);
  const [planteurs, setPlanteurs] = useState<SelectOption[]>([]);
  const [warehouses, setWarehouses] = useState<SelectOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  // Form data
  const [formData, setFormData] = useState<CreateDeliveryInput>({
    planteur_id: '',
    chef_planteur_id: '',
    warehouse_id: '',
    weight_kg: 0,
    price_per_kg: 0,
    quality_grade: 'B',
    notes: '',
  });

  const canCreate = user && hasPermission(user.role, 'deliveries:create');

  // Load options
  useEffect(() => {
    const loadOptions = async () => {
      setLoadingOptions(true);
      try {
        const supabase = createClient();
        
        // Load chef planteurs
        const chefResult = await chefPlanteursApi.list({ page: 1, pageSize: 100 });
        setChefPlanteurs(chefResult.data.map(cp => ({
          id: cp.id,
          name: cp.name,
          code: cp.code,
        })));

        // Load warehouses
        const { data: warehouseData } = await supabase
          .from('warehouses')
          .select('id, name, code')
          .eq('is_active', true)
          .order('name');
        setWarehouses(warehouseData || []);
      } catch (err) {
        setError('Failed to load options');
      } finally {
        setLoadingOptions(false);
      }
    };

    loadOptions();
  }, []);

  // Load planteurs when chef_planteur changes
  useEffect(() => {
    const loadPlanteurs = async () => {
      if (!formData.chef_planteur_id) {
        setPlanteurs([]);
        return;
      }

      try {
        const result = await planteursApi.list({
          page: 1,
          chef_planteur_id: formData.chef_planteur_id,
          is_active: true,
          pageSize: 100,
        });
        setPlanteurs(result.data.map(p => ({
          id: p.id,
          name: p.name,
          code: p.code,
        })));
      } catch (err) {
        console.error('Failed to load planteurs:', err);
      }
    };

    loadPlanteurs();
  }, [formData.chef_planteur_id]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!canCreate) {
      setError('Vous n\'avez pas la permission de créer des livraisons');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const delivery = await deliveriesApi.create(formData);
      router.push(`/deliveries/${delivery.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create delivery');
    } finally {
      setLoading(false);
    }
  };

  // Calculate estimated total
  const estimatedTotal = Math.round(formData.weight_kg * formData.price_per_kg);

  if (!canCreate) {
    return (
      <div className="space-y-6">
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">
            Vous n'avez pas la permission de créer des livraisons
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
      {/* Header */}
      <div>
        <Link
          href="/deliveries"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Retour aux livraisons
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">
          Nouvelle livraison
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Enregistrez une nouvelle livraison de cacao
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="text-lg font-medium text-gray-900">Informations de la livraison</h2>
          
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            {/* Chef Planteur */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Chef Planteur <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.chef_planteur_id}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  chef_planteur_id: e.target.value,
                  planteur_id: '', // Reset planteur when chef changes
                })}
                disabled={loadingOptions}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-gray-100"
              >
                <option value="">Sélectionner un chef planteur</option>
                {chefPlanteurs.map((cp) => (
                  <option key={cp.id} value={cp.id}>
                    {cp.name} ({cp.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Planteur */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Planteur <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.planteur_id}
                onChange={(e) => setFormData({ ...formData, planteur_id: e.target.value })}
                disabled={!formData.chef_planteur_id || planteurs.length === 0}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-gray-100"
              >
                <option value="">
                  {!formData.chef_planteur_id 
                    ? 'Sélectionnez d\'abord un chef planteur' 
                    : planteurs.length === 0 
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

            {/* Warehouse */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Entrepôt <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.warehouse_id}
                onChange={(e) => setFormData({ ...formData, warehouse_id: e.target.value })}
                disabled={loadingOptions}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-gray-100"
              >
                <option value="">Sélectionner un entrepôt</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Quality Grade */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Qualité
              </label>
              <select
                value={formData.quality_grade}
                onChange={(e) => setFormData({ ...formData, quality_grade: e.target.value as QualityGrade })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="A">Grade A</option>
                <option value="B">Grade B</option>
                <option value="C">Grade C</option>
              </select>
            </div>

            {/* Weight */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Poids (kg) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="0.01"
                step="0.01"
                value={formData.weight_kg || ''}
                onChange={(e) => setFormData({ ...formData, weight_kg: parseFloat(e.target.value) || 0 })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="0.00"
              />
            </div>

            {/* Price per kg */}
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
                onChange={(e) => setFormData({ ...formData, price_per_kg: parseFloat(e.target.value) || 0 })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="0"
              />
            </div>

            {/* Notes */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="Notes optionnelles..."
              />
            </div>
          </div>

          {/* Estimated total */}
          {formData.weight_kg > 0 && formData.price_per_kg > 0 && (
            <div className="mt-6 rounded-md bg-gray-50 p-4">
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-700">Total estimé</span>
                <span className="text-lg font-bold text-primary-600">
                  {new Intl.NumberFormat('fr-FR').format(estimatedTotal)} XAF
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Le total final sera calculé automatiquement par le système
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
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
