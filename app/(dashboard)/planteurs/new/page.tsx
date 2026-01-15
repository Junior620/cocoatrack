'use client';

// CocoaTrack V2 - New Planteur Page
// Form for creating a new planteur with optional first delivery (V1 feature)
// Now includes optional parcelles import section

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

import { useAuth, hasPermission } from '@/lib/auth';
import { planteursApi } from '@/lib/api/planteurs';
import { chefPlanteursApi } from '@/lib/api/chef-planteurs';
import { cooperativesApi } from '@/lib/api/cooperatives';
import { parcellesImportApi } from '@/lib/api/parcelles-import';
import { createPlanteurSchema, STATUT_PLANTATION_OPTIONS } from '@/lib/validations/planteur';
import type { CreatePlanteurInput } from '@/lib/validations/planteur';
import type { Database } from '@/types/database.gen';
import { PlanteurParcellesImport, type ImportData } from '@/components/planteurs';

type ChefPlanteur = Database['public']['Tables']['chef_planteurs']['Row'];

// Quality options for delivery
const QUALITY_OPTIONS = ['Grade A', 'Grade B', 'Grade C', 'Standard'] as const;

// Location options (can be fetched from API later)
const LOCATION_OPTIONS = ['Entrepôt Central', 'Point de Collecte A', 'Point de Collecte B', 'Coopérative'] as const;

interface CooperativeOption {
  id: string;
  name: string;
  code: string;
}

interface FirstDeliveryData {
  loading_date: string;
  loading_location: string;
  unloading_date: string;
  unloading_location: string;
  quantity_loaded_kg: string;
  quantity_kg: string;
  quality: string;
  notes: string;
}

export default function NewPlanteurPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [formData, setFormData] = useState<Partial<CreatePlanteurInput>>({
    name: '',
    code: '',
    phone: '',
    cni: '',
    chef_planteur_id: '',
    cooperative: '',
    region: '',
    departement: '',
    localite: '',
    statut_plantation: null,
    superficie_hectares: null,
    latitude: undefined,
    longitude: undefined,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Chef planteur list (fournisseurs)
  const [chefPlanteurs, setChefPlanteurs] = useState<ChefPlanteur[]>([]);
  const [loadingChefPlanteurs, setLoadingChefPlanteurs] = useState(true);

  // Cooperatives list
  const [cooperatives, setCooperatives] = useState<CooperativeOption[]>([]);
  const [loadingCooperatives, setLoadingCooperatives] = useState(true);
  
  // New cooperative creation
  const [showNewCoopInput, setShowNewCoopInput] = useState(false);
  const [newCooperativeName, setNewCooperativeName] = useState('');

  // First delivery (optional)
  const [includeDelivery, setIncludeDelivery] = useState(false);
  const [deliveryData, setDeliveryData] = useState<FirstDeliveryData>({
    loading_date: '',
    loading_location: '',
    unloading_date: '',
    unloading_location: '',
    quantity_loaded_kg: '',
    quantity_kg: '',
    quality: '',
    notes: '',
  });

  // Parcelles import (optional)
  const [importData, setImportData] = useState<ImportData | null>(null);

  // Calculate losses automatically
  const calculatedLosses = (() => {
    const loaded = parseFloat(deliveryData.quantity_loaded_kg) || 0;
    const unloaded = parseFloat(deliveryData.quantity_kg) || 0;
    return loaded > 0 && unloaded > 0 ? Math.max(0, loaded - unloaded) : 0;
  })();

  const canCreate = user && hasPermission(user.role, 'planteurs:create');

  // Fetch cooperatives
  useEffect(() => {
    const fetchCooperatives = async () => {
      setLoadingCooperatives(true);
      try {
        const result = await cooperativesApi.listWithStats();
        const coops = result.map((c) => ({ id: c.id, name: c.name, code: c.code || '' }));
        setCooperatives(coops);
      } catch (err) {
        console.error('Failed to fetch cooperatives:', err);
      } finally {
        setLoadingCooperatives(false);
      }
    };
    fetchCooperatives();
  }, []);

  // Fetch chef planteurs (fournisseurs)
  useEffect(() => {
    const fetchChefPlanteurs = async () => {
      setLoadingChefPlanteurs(true);
      try {
        const result = await chefPlanteursApi.list({ pageSize: 100 });
        // Cast to ChefPlanteur[] - the API returns compatible data
        setChefPlanteurs(result.data as ChefPlanteur[]);
      } catch (err) {
        console.error('Failed to fetch chef planteurs:', err);
      } finally {
        setLoadingChefPlanteurs(false);
      }
    };
    fetchChefPlanteurs();
  }, []);

  if (!canCreate) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <p className="text-sm text-red-700">
          Vous n&apos;avez pas la permission de créer des planteurs.
        </p>
        <Link href="/planteurs" className="mt-2 text-sm text-red-600 underline">
          Retour à la liste
        </Link>
      </div>
    );
  }

  // Handle form field change
  const handleChange = (field: keyof CreatePlanteurInput, value: string | number | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  // Handle delivery field change
  const handleDeliveryChange = (field: keyof FirstDeliveryData, value: string) => {
    setDeliveryData((prev) => ({ ...prev, [field]: value }));
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    // Validate new cooperative name if creating a new one
    if (showNewCoopInput && !newCooperativeName.trim()) {
      setErrors((prev) => ({ ...prev, new_cooperative_name: 'Le nom de la coopérative est requis' }));
      return;
    }

    // Prepare cooperative name
    let cooperativeName = formData.cooperative || null;

    // Create new cooperative if needed
    if (showNewCoopInput && newCooperativeName.trim()) {
      try {
        const newCoop = await cooperativesApi.create({ name: newCooperativeName.trim() });
        cooperativeName = newCoop.name;
        // Add to local list for display
        setCooperatives((prev) => [...prev, { id: newCoop.id, name: newCoop.name, code: newCoop.code || '' }]);
      } catch (err) {
        setSubmitError(err instanceof Error ? `Échec de la création de la coopérative: ${err.message}` : 'Échec de la création de la coopérative');
        return;
      }
    }

    // Update formData with cooperative name
    const dataToValidate = { ...formData, cooperative: cooperativeName };

    // Validate form data
    const result = createPlanteurSchema.safeParse(dataToValidate);
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
      // Step 1: Create the planteur
      const planteur = await planteursApi.create(result.data);

      // Step 2: Apply parcelles import if data is available
      if (importData && importData.importFile && importData.features.length > 0) {
        try {
          const validFeatures = importData.features.filter(
            (f) => f.validation.ok && !f.is_duplicate
          );
          
          if (validFeatures.length > 0) {
            await parcellesImportApi.apply(importData.importFile.id, {
              planteur_id: planteur.id,
              mapping: importData.mapping,
              defaults: importData.defaults,
            });
          }
        } catch (importErr) {
          // Log import error but don't fail the whole operation
          // The planteur was created successfully
          console.error('Failed to apply parcelles import:', importErr);
          // We could show a warning toast here, but for now we'll just log it
        }
      }

      // Note: First delivery creation is disabled for now
      // The V2 delivery API requires warehouse_id which is not in the V1 form
      // TODO: Add warehouse selection to enable first delivery creation

      router.push(`/planteurs/${planteur.id}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Échec de la création du planteur');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link href="/planteurs" className="text-gray-500 hover:text-gray-700">
          <ArrowLeftIcon className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Ajouter Planteur / Livraison</h1>
      </div>

      {/* Mode selector */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <p className="mb-2 text-sm font-medium text-gray-700">Mode :</p>
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={true}
              readOnly
              className="h-4 w-4 text-primary-600"
            />
            <span className="text-sm text-gray-700">Nouveau planteur</span>
          </label>
          <label className="flex items-center gap-2 opacity-50">
            <input
              type="radio"
              disabled
              className="h-4 w-4"
            />
            <span className="text-sm text-gray-500">Planteur existant</span>
          </label>
        </div>
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
              placeholder="Ex: 123456789"
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
            <select
              id="cooperative"
              value={showNewCoopInput ? '__NEW__' : (formData.cooperative || '')}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '__NEW__') {
                  setShowNewCoopInput(true);
                  handleChange('cooperative', null);
                } else {
                  setShowNewCoopInput(false);
                  setNewCooperativeName('');
                  handleChange('cooperative', value || null);
                }
              }}
              className={`mt-1 block w-full rounded-md border ${
                errors.cooperative ? 'border-red-300' : 'border-gray-300'
              } px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500`}
              disabled={loadingCooperatives}
            >
              <option value="">-- Aucune --</option>
              {cooperatives.map((coop) => (
                <option key={coop.id} value={coop.name}>
                  {coop.name} ({coop.code})
                </option>
              ))}
              <option value="__NEW__">+ Ajouter une nouvelle coopérative</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">Sélectionnez la coopérative du planteur ou créez-en une nouvelle (optionnel)</p>
            {errors.cooperative && <p className="mt-1 text-sm text-red-600">{errors.cooperative}</p>}
          </div>

          {/* New cooperative name input */}
          {showNewCoopInput && (
            <div className="mb-4 ml-4 border-l-2 border-primary-200 pl-4">
              <label htmlFor="new_cooperative_name" className="block text-sm font-medium text-gray-700">
                Nom de la nouvelle coopérative <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="new_cooperative_name"
                value={newCooperativeName}
                onChange={(e) => setNewCooperativeName(e.target.value)}
                placeholder="Ex: Coopérative du Sud"
                className={`mt-1 block w-full rounded-md border ${
                  errors.new_cooperative_name ? 'border-red-300' : 'border-gray-300'
                } px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500`}
              />
              {errors.new_cooperative_name && (
                <p className="mt-1 text-sm text-red-600">{errors.new_cooperative_name}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                La coopérative sera créée automatiquement lors de l&apos;enregistrement
              </p>
            </div>
          )}

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
              {errors.region && <p className="mt-1 text-sm text-red-600">{errors.region}</p>}
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
              {errors.departement && <p className="mt-1 text-sm text-red-600">{errors.departement}</p>}
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
            {errors.localite && <p className="mt-1 text-sm text-red-600">{errors.localite}</p>}
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
            {errors.statut_plantation && <p className="mt-1 text-sm text-red-600">{errors.statut_plantation}</p>}
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
            <p className="mt-1 text-xs text-gray-500">1 hectare = 1000 kg de production maximale (optionnel)</p>
            {errors.superficie_hectares && <p className="mt-1 text-sm text-red-600">{errors.superficie_hectares}</p>}
          </div>

          {/* Fournisseur (Chef Planteur) */}
          <div className="mb-4">
            <label htmlFor="chef_planteur_id" className="block text-sm font-medium text-gray-700">
              Fournisseur
            </label>
            <select
              id="chef_planteur_id"
              value={formData.chef_planteur_id || ''}
              onChange={(e) => handleChange('chef_planteur_id', e.target.value || null)}
              className={`mt-1 block w-full rounded-md border ${
                errors.chef_planteur_id ? 'border-red-300' : 'border-gray-300'
              } px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500`}
              disabled={loadingChefPlanteurs}
            >
              <option value="">-- Aucun --</option>
              {chefPlanteurs.map((chef) => (
                <option key={chef.id} value={chef.id}>
                  {chef.name} ({chef.code})
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">Associer ce planteur à un fournisseur (optionnel)</p>
            {errors.chef_planteur_id && (
              <p className="mt-1 text-sm text-red-600">{errors.chef_planteur_id}</p>
            )}
          </div>
        </div>

        {/* Section: Première Livraison (Optionnel) */}
        <div className="border-t border-gray-200 pt-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-primary-700">Première Livraison (Optionnel)</h2>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={includeDelivery}
                onChange={(e) => setIncludeDelivery(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-600">Ajouter une livraison</span>
            </label>
          </div>
          
          {includeDelivery && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="mb-4 text-sm text-gray-600">
                Vous pouvez ajouter directement la première livraison du planteur
              </p>

              {/* Dates */}
              <div className="mb-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="loading_date" className="block text-sm font-medium text-gray-700">
                    Date de chargement
                  </label>
                  <input
                    type="date"
                    id="loading_date"
                    value={deliveryData.loading_date}
                    onChange={(e) => handleDeliveryChange('loading_date', e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label htmlFor="loading_location" className="block text-sm font-medium text-gray-700">
                    Lieu de chargement
                  </label>
                  <select
                    id="loading_location"
                    value={deliveryData.loading_location}
                    onChange={(e) => handleDeliveryChange('loading_location', e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="">Sélectionner...</option>
                    {LOCATION_OPTIONS.map((loc) => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mb-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="unloading_date" className="block text-sm font-medium text-gray-700">
                    Date de déchargement
                  </label>
                  <input
                    type="date"
                    id="unloading_date"
                    value={deliveryData.unloading_date}
                    onChange={(e) => handleDeliveryChange('unloading_date', e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label htmlFor="unloading_location" className="block text-sm font-medium text-gray-700">
                    Lieu de déchargement
                  </label>
                  <select
                    id="unloading_location"
                    value={deliveryData.unloading_location}
                    onChange={(e) => handleDeliveryChange('unloading_location', e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="">Sélectionner...</option>
                    {LOCATION_OPTIONS.map((loc) => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quantities */}
              <div className="mb-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="quantity_loaded_kg" className="block text-sm font-medium text-gray-700">
                    Quantité chargée (kg)
                  </label>
                  <input
                    type="number"
                    id="quantity_loaded_kg"
                    step="0.01"
                    min="0"
                    value={deliveryData.quantity_loaded_kg}
                    onChange={(e) => handleDeliveryChange('quantity_loaded_kg', e.target.value)}
                    placeholder="Ex: 1550.00"
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label htmlFor="quantity_kg" className="block text-sm font-medium text-gray-700">
                    Quantité déchargée (kg)
                  </label>
                  <input
                    type="number"
                    id="quantity_kg"
                    step="0.01"
                    min="0"
                    value={deliveryData.quantity_kg}
                    onChange={(e) => handleDeliveryChange('quantity_kg', e.target.value)}
                    placeholder="Ex: 1500.50"
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
              </div>

              {/* Quality & Losses */}
              <div className="mb-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="quality" className="block text-sm font-medium text-gray-700">
                    Qualité du cacao
                  </label>
                  <select
                    id="quality"
                    value={deliveryData.quality}
                    onChange={(e) => handleDeliveryChange('quality', e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="">Sélectionner...</option>
                    {QUALITY_OPTIONS.map((q) => (
                      <option key={q} value={q}>{q}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Pertes (kg)
                  </label>
                  <input
                    type="text"
                    value={calculatedLosses > 0 ? calculatedLosses.toFixed(2) : ''}
                    disabled
                    placeholder="Calculé automatiquement"
                    className="mt-1 block w-full rounded-md border border-gray-200 bg-gray-100 px-3 py-2 text-gray-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">Pertes = Chargé - Déchargé</p>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                  Notes
                </label>
                <textarea
                  id="notes"
                  rows={3}
                  value={deliveryData.notes}
                  onChange={(e) => handleDeliveryChange('notes', e.target.value)}
                  placeholder="Notes sur la livraison..."
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Section: Importer Parcelles (Optionnel) */}
        <PlanteurParcellesImport
          onImportDataChange={setImportData}
          disabled={submitting}
        />

        {/* Actions */}
        <div className="flex justify-end gap-3 border-t border-gray-200 pt-6">
          <Link
            href="/planteurs"
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
