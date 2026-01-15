'use client';

// CocoaTrack V2 - Edit Chef Planteur Page
// Form for editing an existing chef_planteur (fournisseur)

import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth, hasPermission } from '@/lib/auth';
import { chefPlanteursApi } from '@/lib/api/chef-planteurs';
import { updateChefPlanteurSchema } from '@/lib/validations/chef-planteur';
import { createClient } from '@/lib/supabase/client';
import type { UpdateChefPlanteurInput, ChefPlanteurWithRelations } from '@/lib/validations/chef-planteur';
import type { Database } from '@/types/database.gen';

type Cooperative = Database['public']['Tables']['cooperatives']['Row'];

export default function EditChefPlanteurPage() {
  const router = useRouter();
  const params = useParams();
  const chefPlanteurId = params.id as string;
  const { user } = useAuth();

  const [chefPlanteur, setChefPlanteur] = useState<ChefPlanteurWithRelations | null>(null);
  const [formData, setFormData] = useState<Partial<UpdateChefPlanteurInput>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [cooperatives, setCooperatives] = useState<Cooperative[]>([]);

  const canEdit = user && hasPermission(user.role, 'chef_planteurs:update');

  // Load chef_planteur data and cooperatives
  useEffect(() => {
    const loadData = async () => {
      try {
        const [data, coops] = await Promise.all([
          chefPlanteursApi.get(chefPlanteurId),
          (async () => {
            const supabase = createClient();
            const { data } = await supabase.from('cooperatives').select('*').order('name');
            return data || [];
          })(),
        ]);

        setCooperatives(coops);

        if (data) {
          setChefPlanteur(data);
          setFormData({
            name: data.name,
            code: data.code,
            phone: data.phone,
            cni: data.cni,
            cooperative_id: data.cooperative_id,
            region: data.region,
            departement: data.departement,
            localite: data.localite,
            latitude: data.latitude,
            longitude: data.longitude,
            quantite_max_kg: data.quantite_max_kg,
            contract_start: data.contract_start,
            contract_end: data.contract_end,
            is_active: data.is_active,
          });
        }
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : 'Échec du chargement');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [chefPlanteurId]);

  if (!canEdit) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <p className="text-sm text-red-700">
          Vous n&apos;avez pas la permission de modifier les fournisseurs.
        </p>
        <Link href="/chef-planteurs" className="mt-2 text-sm text-red-600 underline">
          Retour à la liste
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-gray-200 rounded mb-6" />
          <div className="bg-white rounded-lg p-6 shadow space-y-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-200 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!chefPlanteur) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <p className="text-sm text-red-700">Fournisseur non trouvé.</p>
        <Link href="/chef-planteurs" className="mt-2 text-sm text-red-600 underline">
          Retour à la liste
        </Link>
      </div>
    );
  }

  // Handle form field change
  const handleChange = (field: keyof UpdateChefPlanteurInput, value: string | number | boolean | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    // Clean up empty strings to null
    const cleanedData = {
      ...formData,
      phone: formData.phone || null,
      cni: formData.cni || null,
      region: formData.region || null,
      departement: formData.departement || null,
      localite: formData.localite || null,
      contract_start: formData.contract_start || null,
      contract_end: formData.contract_end || null,
    };

    // Validate form data
    const result = updateChefPlanteurSchema.safeParse(cleanedData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as string;
        fieldErrors[field] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      await chefPlanteursApi.update(chefPlanteurId, result.data);
      router.push(`/chef-planteurs/${chefPlanteurId}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Échec de la mise à jour');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link href={`/chef-planteurs/${chefPlanteurId}`} className="text-gray-500 hover:text-gray-700">
          <ArrowLeftIcon className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Modifier le fournisseur</h1>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6 rounded-lg bg-white p-6 shadow">
        {submitError && (
          <div className="rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-700">{submitError}</p>
          </div>
        )}

        {/* Basic info section */}
        <div className="space-y-4">
          <h2 className="text-lg font-medium text-gray-900">Informations de base</h2>
          
          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Nom <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              value={formData.name || ''}
              onChange={(e) => handleChange('name', e.target.value)}
              className={`mt-1 block w-full rounded-md border ${
                errors.name ? 'border-red-300' : 'border-gray-300'
              } px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500`}
            />
            {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
          </div>

          {/* Code */}
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-gray-700">
              Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="code"
              value={formData.code || ''}
              onChange={(e) => handleChange('code', e.target.value.toUpperCase())}
              className={`mt-1 block w-full rounded-md border ${
                errors.code ? 'border-red-300' : 'border-gray-300'
              } px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500`}
            />
            {errors.code && <p className="mt-1 text-sm text-red-600">{errors.code}</p>}
          </div>

          {/* Cooperative */}
          <div>
            <label htmlFor="cooperative_id" className="block text-sm font-medium text-gray-700">
              Coopérative <span className="text-red-500">*</span>
            </label>
            <select
              id="cooperative_id"
              value={formData.cooperative_id || ''}
              onChange={(e) => handleChange('cooperative_id', e.target.value)}
              disabled={!!user?.cooperative_id && user.role !== 'admin'}
              className={`mt-1 block w-full rounded-md border ${
                errors.cooperative_id ? 'border-red-300' : 'border-gray-300'
              } px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-gray-100`}
            >
              <option value="">Sélectionner une coopérative</option>
              {cooperatives.map((coop) => (
                <option key={coop.id} value={coop.id}>
                  {coop.name} ({coop.code})
                </option>
              ))}
            </select>
            {errors.cooperative_id && <p className="mt-1 text-sm text-red-600">{errors.cooperative_id}</p>}
          </div>

          {/* Phone and CNI */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                Téléphone
              </label>
              <input
                type="tel"
                id="phone"
                value={formData.phone || ''}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="+237..."
                className={`mt-1 block w-full rounded-md border ${
                  errors.phone ? 'border-red-300' : 'border-gray-300'
                } px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500`}
              />
              {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone}</p>}
            </div>
            <div>
              <label htmlFor="cni" className="block text-sm font-medium text-gray-700">
                CNI
              </label>
              <input
                type="text"
                id="cni"
                value={formData.cni || ''}
                onChange={(e) => handleChange('cni', e.target.value)}
                className={`mt-1 block w-full rounded-md border ${
                  errors.cni ? 'border-red-300' : 'border-gray-300'
                } px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500`}
              />
              {errors.cni && <p className="mt-1 text-sm text-red-600">{errors.cni}</p>}
            </div>
          </div>

          {/* Statut actif */}
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_active ?? true}
                onChange={(e) => handleChange('is_active', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700">Fournisseur actif</span>
            </label>
          </div>
        </div>

        {/* Location section */}
        <div className="space-y-4 border-t border-gray-200 pt-6">
          <h2 className="text-lg font-medium text-gray-900">Localisation</h2>
          
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="region" className="block text-sm font-medium text-gray-700">
                Région
              </label>
              <input
                type="text"
                id="region"
                value={formData.region || ''}
                onChange={(e) => handleChange('region', e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
              <label htmlFor="departement" className="block text-sm font-medium text-gray-700">
                Département
              </label>
              <input
                type="text"
                id="departement"
                value={formData.departement || ''}
                onChange={(e) => handleChange('departement', e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
              <label htmlFor="localite" className="block text-sm font-medium text-gray-700">
                Localité
              </label>
              <input
                type="text"
                id="localite"
                value={formData.localite || ''}
                onChange={(e) => handleChange('localite', e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Coordinates */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="latitude" className="block text-sm font-medium text-gray-700">
                Latitude
              </label>
              <input
                type="number"
                id="latitude"
                step="any"
                value={formData.latitude ?? ''}
                onChange={(e) =>
                  handleChange('latitude', e.target.value ? parseFloat(e.target.value) : null)
                }
                placeholder="Ex: 4.0511"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
              <label htmlFor="longitude" className="block text-sm font-medium text-gray-700">
                Longitude
              </label>
              <input
                type="number"
                id="longitude"
                step="any"
                value={formData.longitude ?? ''}
                onChange={(e) =>
                  handleChange('longitude', e.target.value ? parseFloat(e.target.value) : null)
                }
                placeholder="Ex: 9.7679"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>

        {/* Contract section */}
        <div className="space-y-4 border-t border-gray-200 pt-6">
          <h2 className="text-lg font-medium text-gray-900">Contrat</h2>
          
          <div>
            <label htmlFor="quantite_max_kg" className="block text-sm font-medium text-gray-700">
              Quantité maximale (kg) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              id="quantite_max_kg"
              min="0"
              step="0.01"
              value={formData.quantite_max_kg ?? ''}
              onChange={(e) =>
                handleChange('quantite_max_kg', e.target.value ? parseFloat(e.target.value) : 0)
              }
              className={`mt-1 block w-full rounded-md border ${
                errors.quantite_max_kg ? 'border-red-300' : 'border-gray-300'
              } px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500`}
            />
            {errors.quantite_max_kg && <p className="mt-1 text-sm text-red-600">{errors.quantite_max_kg}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="contract_start" className="block text-sm font-medium text-gray-700">
                Début du contrat
              </label>
              <input
                type="date"
                id="contract_start"
                value={formData.contract_start || ''}
                onChange={(e) => handleChange('contract_start', e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
              <label htmlFor="contract_end" className="block text-sm font-medium text-gray-700">
                Fin du contrat
              </label>
              <input
                type="date"
                id="contract_end"
                value={formData.contract_end || ''}
                onChange={(e) => handleChange('contract_end', e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 border-t border-gray-200 pt-6">
          <Link
            href={`/chef-planteurs/${chefPlanteurId}`}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Annuler
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting && <LoadingSpinner className="mr-2" />}
            Enregistrer
          </button>
        </div>
      </form>
    </div>
  );
}

// Icons and components
function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );
}

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg
      className={`h-4 w-4 animate-spin text-current ${className}`}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
