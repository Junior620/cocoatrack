'use client';

// CocoaTrack V2 - Edit Planteur Page
// Form for editing an existing planteur
// Now includes optional parcelles import section

import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useState, useEffect } from 'react';

import { useAuth, hasPermission } from '@/lib/auth';
import { planteursApi } from '@/lib/api/planteurs';
import { chefPlanteursApi } from '@/lib/api/chef-planteurs';
import { parcellesImportApi } from '@/lib/api/parcelles-import';
import { updatePlanteurSchema, STATUT_PLANTATION_OPTIONS } from '@/lib/validations/planteur';
import type { UpdatePlanteurInput, PlanteurWithRelations } from '@/lib/validations/planteur';
import type { Database } from '@/types/database.gen';
import { PlanteurParcellesImport, type ImportData } from '@/components/planteurs';

type ChefPlanteur = Database['public']['Tables']['chef_planteurs']['Row'];

export default function EditPlanteurPage() {
  const router = useRouter();
  const params = useParams();
  const planteurId = params.id as string;
  const { user } = useAuth();

  const [planteur, setPlanteur] = useState<PlanteurWithRelations | null>(null);
  const [formData, setFormData] = useState<Partial<UpdatePlanteurInput>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Chef planteur search
  const [chefSearch, setChefSearch] = useState('');
  const [chefResults, setChefResults] = useState<ChefPlanteur[]>([]);
  const [selectedChef, setSelectedChef] = useState<ChefPlanteur | null>(null);
  const [searchingChef, setSearchingChef] = useState(false);

  // Parcelles import (optional - for adding new parcelles)
  const [importData, setImportData] = useState<ImportData | null>(null);

  const canEdit = user && hasPermission(user.role, 'planteurs:update');

  // Load planteur data
  useEffect(() => {
    const loadPlanteur = async () => {
      try {
        const data = await planteursApi.get(planteurId);
        if (data) {
          setPlanteur(data);
          setFormData({
            name: data.name,
            code: data.code,
            phone: data.phone,
            cni: data.cni,
            chef_planteur_id: data.chef_planteur_id,
            cooperative: (data as unknown as { cooperative?: string }).cooperative || '',
            region: data.region,
            departement: data.departement,
            localite: data.localite,
            statut_plantation: data.statut_plantation,
            superficie_hectares: data.superficie_hectares,
            is_active: data.is_active,
          });
          if (data.chef_planteur) {
            setSelectedChef(data.chef_planteur as unknown as ChefPlanteur);
          }
        }
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : 'Échec du chargement');
      } finally {
        setLoading(false);
      }
    };
    loadPlanteur();
  }, [planteurId]);

  if (!canEdit) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <p className="text-sm text-red-700">
          Vous n&apos;avez pas la permission de modifier les planteurs.
        </p>
        <Link href="/planteurs" className="mt-2 text-sm text-red-600 underline">
          Retour à la liste
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-gray-200 rounded mb-6" />
          <div className="bg-white rounded-lg p-6 shadow space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-200 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!planteur) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <p className="text-sm text-red-700">Planteur non trouvé.</p>
        <Link href="/planteurs" className="mt-2 text-sm text-red-600 underline">
          Retour à la liste
        </Link>
      </div>
    );
  }

  // Search chef planteurs
  const handleChefSearch = async (query: string) => {
    setChefSearch(query);
    if (query.length < 2) {
      setChefResults([]);
      return;
    }

    setSearchingChef(true);
    try {
      const results = await chefPlanteursApi.search(query, 5);
      setChefResults(results);
    } catch (err) {
      console.error('Failed to search chef planteurs:', err);
    } finally {
      setSearchingChef(false);
    }
  };

  // Select chef planteur
  const handleSelectChef = (chef: ChefPlanteur) => {
    setSelectedChef(chef);
    setFormData((prev) => ({ ...prev, chef_planteur_id: chef.id }));
    setChefSearch('');
    setChefResults([]);
  };

  // Handle form field change
  const handleChange = (field: keyof UpdatePlanteurInput, value: string | number | boolean | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    // Validate form data
    const result = updatePlanteurSchema.safeParse(formData);
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
      // Step 1: Update the planteur
      await planteursApi.update(planteurId, result.data);

      // Step 2: Apply parcelles import if data is available
      if (importData && importData.importFile && importData.features.length > 0) {
        try {
          const validFeatures = importData.features.filter(
            (f) => f.validation.ok && !f.is_duplicate
          );
          
          if (validFeatures.length > 0) {
            await parcellesImportApi.apply(importData.importFile.id, {
              planteur_id: planteurId,
              mapping: importData.mapping,
              defaults: importData.defaults,
            });
          }
        } catch (importErr) {
          // Log import error but don't fail the whole operation
          // The planteur was updated successfully
          console.error('Failed to apply parcelles import:', importErr);
        }
      }

      router.push(`/planteurs/${planteurId}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Échec de la mise à jour');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link href={`/planteurs/${planteurId}`} className="text-gray-500 hover:text-gray-700">
          <ArrowLeftIcon className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Modifier le planteur</h1>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6 rounded-lg bg-white p-6 shadow">
        {submitError && (
          <div className="rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-700">{submitError}</p>
          </div>
        )}

        {/* Section: Informations du Planteur */}
        <div>
          <h2 className="mb-4 text-lg font-semibold text-primary-700">Informations du Planteur</h2>
          
          {/* Name */}
          <div className="mb-4">
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
          <div className="mb-4">
            <label htmlFor="code" className="block text-sm font-medium text-gray-700">
              Code
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

          {/* Phone */}
          <div className="mb-4">
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
              Téléphone
            </label>
            <input
              type="tel"
              id="phone"
              value={formData.phone || ''}
              onChange={(e) => handleChange('phone', e.target.value || null)}
              placeholder="+237..."
              className={`mt-1 block w-full rounded-md border ${
                errors.phone ? 'border-red-300' : 'border-gray-300'
              } px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500`}
            />
            {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone}</p>}
          </div>

          {/* CNI */}
          <div className="mb-4">
            <label htmlFor="cni" className="block text-sm font-medium text-gray-700">
              CNI (Carte Nationale d&apos;Identité)
            </label>
            <input
              type="text"
              id="cni"
              value={formData.cni || ''}
              onChange={(e) => handleChange('cni', e.target.value || null)}
              className={`mt-1 block w-full rounded-md border ${
                errors.cni ? 'border-red-300' : 'border-gray-300'
              } px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500`}
            />
            {errors.cni && <p className="mt-1 text-sm text-red-600">{errors.cni}</p>}
          </div>

          {/* Coopérative */}
          <div className="mb-4">
            <label htmlFor="cooperative" className="block text-sm font-medium text-gray-700">
              Coopérative
            </label>
            <input
              type="text"
              id="cooperative"
              value={(formData as { cooperative?: string }).cooperative || ''}
              onChange={(e) => handleChange('cooperative' as keyof UpdatePlanteurInput, e.target.value || null)}
              placeholder="Nom de la coopérative"
              className={`mt-1 block w-full rounded-md border ${
                errors.cooperative ? 'border-red-300' : 'border-gray-300'
              } px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500`}
            />
            <p className="mt-1 text-xs text-gray-500">Sélectionnez une coopérative existante ou saisissez-en une nouvelle</p>
            {errors.cooperative && <p className="mt-1 text-sm text-red-600">{errors.cooperative}</p>}
          </div>

          {/* Region & Département */}
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="region" className="block text-sm font-medium text-gray-700">
                Région
              </label>
              <input
                type="text"
                id="region"
                value={formData.region || ''}
                onChange={(e) => handleChange('region', e.target.value || null)}
                placeholder="Ex: Centre"
                className={`mt-1 block w-full rounded-md border ${
                  errors.region ? 'border-red-300' : 'border-gray-300'
                } px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500`}
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
                onChange={(e) => handleChange('departement', e.target.value || null)}
                placeholder="Ex: Mfoundi"
                className={`mt-1 block w-full rounded-md border ${
                  errors.departement ? 'border-red-300' : 'border-gray-300'
                } px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500`}
              />
            </div>
          </div>

          {/* Localité */}
          <div className="mb-4">
            <label htmlFor="localite" className="block text-sm font-medium text-gray-700">
              Localité / Village
            </label>
            <input
              type="text"
              id="localite"
              value={formData.localite || ''}
              onChange={(e) => handleChange('localite', e.target.value || null)}
              placeholder="Ex: Yaoundé"
              className={`mt-1 block w-full rounded-md border ${
                errors.localite ? 'border-red-300' : 'border-gray-300'
              } px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500`}
            />
          </div>

          {/* Statut de la plantation */}
          <div className="mb-4">
            <label htmlFor="statut_plantation" className="block text-sm font-medium text-gray-700">
              Statut de la plantation
            </label>
            <select
              id="statut_plantation"
              value={formData.statut_plantation || ''}
              onChange={(e) => handleChange('statut_plantation', e.target.value || null)}
              className={`mt-1 block w-full rounded-md border ${
                errors.statut_plantation ? 'border-red-300' : 'border-gray-300'
              } px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500`}
            >
              <option value="">Sélectionner...</option>
              {STATUT_PLANTATION_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">Indique si le champ appartient au planteur ou non</p>
          </div>

          {/* Superficie */}
          <div className="mb-4">
            <label htmlFor="superficie_hectares" className="block text-sm font-medium text-gray-700">
              Superficie (hectares)
            </label>
            <input
              type="number"
              id="superficie_hectares"
              step="0.01"
              min="0"
              value={formData.superficie_hectares ?? ''}
              onChange={(e) => handleChange('superficie_hectares', e.target.value ? parseFloat(e.target.value) : null)}
              className={`mt-1 block w-full rounded-md border ${
                errors.superficie_hectares ? 'border-red-300' : 'border-gray-300'
              } px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500`}
            />
            <p className="mt-1 text-xs text-gray-500">1 hectare = 1000 kg de production maximale</p>
          </div>

          {/* Fournisseur (Chef Planteur) */}
          <div className="mb-4">
            <label htmlFor="chef_planteur" className="block text-sm font-medium text-gray-700">
              Fournisseur
            </label>
            {selectedChef ? (
              <div className="mt-1 flex items-center justify-between rounded-md border border-gray-300 bg-gray-50 px-3 py-2">
                <div>
                  <p className="font-medium text-gray-900">{selectedChef.name}</p>
                  <p className="text-sm text-gray-500">{selectedChef.code}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedChef(null);
                    setFormData((prev) => ({ ...prev, chef_planteur_id: undefined }));
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XIcon className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  id="chef_planteur"
                  value={chefSearch}
                  onChange={(e) => handleChefSearch(e.target.value)}
                  placeholder="Rechercher un fournisseur..."
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                {searchingChef && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <LoadingSpinner />
                  </div>
                )}
                {chefResults.length > 0 && (
                  <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
                    {chefResults.map((chef) => (
                      <li key={chef.id}>
                        <button
                          type="button"
                          onClick={() => handleSelectChef(chef)}
                          className="w-full px-4 py-2 text-left hover:bg-gray-100"
                        >
                          <p className="font-medium text-gray-900">{chef.name}</p>
                          <p className="text-sm text-gray-500">{chef.code}</p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Statut actif */}
          <div className="mb-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_active ?? true}
                onChange={(e) => handleChange('is_active', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700">Planteur actif</span>
            </label>
          </div>
        </div>

        {/* Section: Importer Parcelles (Optionnel) */}
        <PlanteurParcellesImport
          onImportDataChange={setImportData}
          disabled={submitting}
        />

        {/* Actions */}
        <div className="flex justify-end gap-3 border-t border-gray-200 pt-6">
          <Link
            href={`/planteurs/${planteurId}`}
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

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
