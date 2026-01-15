'use client';

// CocoaTrack V2 - New Chef Planteur Page (V1 Style)
// Form for creating a new chef_planteur with associated planters and first delivery

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { MapPin, Calendar, Users, Truck } from 'lucide-react';

import { useAuth, hasPermission } from '@/lib/auth';
import { chefPlanteursApi } from '@/lib/api/chef-planteurs';
import { planteursApi } from '@/lib/api/planteurs';
import { cooperativesApi } from '@/lib/api/cooperatives';
import { createChefPlanteurSchema } from '@/lib/validations/chef-planteur';
import type { CreateChefPlanteurInput } from '@/lib/validations/chef-planteur';

// Quality options for cocoa
const QUALITE_CACAO_OPTIONS = ['Grade A', 'Grade B', 'Grade C', 'Standard'];

// Location options (simplified - could be fetched from API)
const LIEU_OPTIONS = ['Entrepôt Central', 'Point de Collecte 1', 'Point de Collecte 2', 'Autre'];

interface PlanteurOption {
  id: string;
  name: string;
  code: string;
}

interface CooperativeOption {
  id: string;
  name: string;
  code: string;
}

interface FirstDeliveryData {
  planteur_id: string;
  date_chargement: string;
  lieu_chargement: string;
  date_dechargement: string;
  lieu_dechargement: string;
  quantite_chargee_kg: number | null;
  quantite_dechargee_kg: number | null;
  qualite_cacao: string;
  notes: string;
}

export default function NewChefPlanteurPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [formData, setFormData] = useState<Partial<CreateChefPlanteurInput>>({
    name: '',
    code: '',
    phone: '',
    cni: '',
    cooperative_id: undefined,
    region: '',
    departement: '',
    localite: '',
    latitude: undefined,
    longitude: undefined,
    quantite_max_kg: 0,
    contract_start: '',
    contract_end: '',
  });
  
  const [terminationReason, setTerminationReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);

  // Cooperatives list
  const [cooperatives, setCooperatives] = useState<CooperativeOption[]>([]);
  const [loadingCooperatives, setLoadingCooperatives] = useState(true);
  
  // New cooperative creation
  const [showNewCoopInput, setShowNewCoopInput] = useState(false);
  const [newCooperativeName, setNewCooperativeName] = useState('');
  const [creatingCooperative, setCreatingCooperative] = useState(false);

  // Associated planters
  const [availablePlanteurs, setAvailablePlanteurs] = useState<PlanteurOption[]>([]);
  const [selectedPlanteurIds, setSelectedPlanteurIds] = useState<string[]>([]);
  const [loadingPlanteurs, setLoadingPlanteurs] = useState(true);

  // First delivery (optional)
  const [includeFirstDelivery, setIncludeFirstDelivery] = useState(false);
  const [firstDelivery, setFirstDelivery] = useState<FirstDeliveryData>({
    planteur_id: '',
    date_chargement: '',
    lieu_chargement: '',
    date_dechargement: '',
    lieu_dechargement: '',
    quantite_chargee_kg: null,
    quantite_dechargee_kg: null,
    qualite_cacao: '',
    notes: '',
  });

  const canCreate = user && hasPermission(user.role, 'chef_planteurs:create');

  // Fetch cooperatives
  useEffect(() => {
    const fetchCooperatives = async () => {
      setLoadingCooperatives(true);
      try {
        const result = await cooperativesApi.listWithStats();
        const coops = result.map((c) => ({ id: c.id, name: c.name, code: c.code || '' }));
        setCooperatives(coops);
        
        // Pre-select user's cooperative if they have one
        if (user?.cooperative_id) {
          setFormData(prev => ({ ...prev, cooperative_id: user.cooperative_id as string }));
        }
      } catch (err) {
        console.error('Failed to fetch cooperatives:', err);
      } finally {
        setLoadingCooperatives(false);
      }
    };
    fetchCooperatives();
  }, [user?.cooperative_id]);

  // Fetch available planteurs (those without a chef_planteur)
  useEffect(() => {
    const fetchPlanteurs = async () => {
      setLoadingPlanteurs(true);
      try {
        const result = await planteursApi.list({ pageSize: 100 });
        // Filter planteurs without chef_planteur_id
        const available = result.data
          .filter((p: any) => !p.chef_planteur_id)
          .map((p: any) => ({ id: p.id, name: p.name, code: p.code }));
        setAvailablePlanteurs(available);
      } catch (err) {
        console.error('Failed to fetch planteurs:', err);
      } finally {
        setLoadingPlanteurs(false);
      }
    };
    fetchPlanteurs();
  }, []);

  // Calculate pertes (losses)
  const pertes = firstDelivery.quantite_chargee_kg && firstDelivery.quantite_dechargee_kg
    ? Math.max(0, firstDelivery.quantite_chargee_kg - firstDelivery.quantite_dechargee_kg)
    : null;

  if (!canCreate) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <p className="text-sm text-red-700">
          Vous n&apos;avez pas la permission de créer des fournisseurs.
        </p>
        <Link href="/chef-planteurs" className="mt-2 text-sm text-red-600 underline">
          Retour à la liste
        </Link>
      </div>
    );
  }

  // Get current location
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      alert('La géolocalisation n\'est pas supportée par votre navigateur');
      return;
    }

    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData((prev) => ({
          ...prev,
          latitude: Math.round(position.coords.latitude * 10000) / 10000,
          longitude: Math.round(position.coords.longitude * 10000) / 10000,
        }));
        setGettingLocation(false);
      },
      (error) => {
        setGettingLocation(false);
        // Provide more specific error messages
        let message = 'Impossible d\'obtenir votre position.';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = 'Permission refusée. Veuillez autoriser l\'accès à votre position dans les paramètres du navigateur.';
            break;
          case error.POSITION_UNAVAILABLE:
            message = 'Position non disponible. Vérifiez que le GPS est activé.';
            break;
          case error.TIMEOUT:
            message = 'Délai d\'attente dépassé. Réessayez.';
            break;
        }
        alert(message);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  };

  // Handle form field change
  const handleChange = (field: string, value: string | number | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  // Handle first delivery field change
  const handleDeliveryChange = (field: keyof FirstDeliveryData, value: string | number | null) => {
    setFirstDelivery((prev) => ({ ...prev, [field]: value }));
  };

  // Toggle planteur selection
  const togglePlanteurSelection = (planteurId: string) => {
    setSelectedPlanteurIds((prev) =>
      prev.includes(planteurId)
        ? prev.filter((id) => id !== planteurId)
        : [...prev, planteurId]
    );
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

    let cooperativeId = formData.cooperative_id || null;

    // Create new cooperative if needed
    if (showNewCoopInput && newCooperativeName.trim()) {
      setCreatingCooperative(true);
      try {
        const newCoop = await cooperativesApi.create({ name: newCooperativeName.trim() });
        cooperativeId = newCoop.id;
        // Add to local list for display
        setCooperatives((prev) => [...prev, { id: newCoop.id, name: newCoop.name, code: newCoop.code || '' }]);
      } catch (err) {
        setSubmitError(err instanceof Error ? `Échec de la création de la coopérative: ${err.message}` : 'Échec de la création de la coopérative');
        setCreatingCooperative(false);
        return;
      }
      setCreatingCooperative(false);
    }

    // Clean up empty strings to null - cooperative_id is now optional
    const cleanedData = {
      name: formData.name,
      code: formData.code || `CP${Date.now().toString().slice(-6)}`, // Auto-generate if empty
      phone: formData.phone || null,
      cni: formData.cni || null,
      cooperative_id: cooperativeId, // Use the new or selected cooperative ID
      region: formData.region || null,
      departement: formData.departement || null,
      localite: formData.localite || null,
      latitude: formData.latitude || null,
      longitude: formData.longitude || null,
      quantite_max_kg: formData.quantite_max_kg || 0,
      contract_start: formData.contract_start || null,
      contract_end: formData.contract_end || null,
    };

    // Validate form data
    const result = createChefPlanteurSchema.safeParse(cleanedData);
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
      const chefPlanteur = await chefPlanteursApi.create(result.data);
      
      // Associate selected planteurs
      if (selectedPlanteurIds.length > 0) {
        await Promise.all(
          selectedPlanteurIds.map((planteurId) =>
            planteursApi.update(planteurId, { chef_planteur_id: chefPlanteur.id })
          )
        );
      }

      // TODO: Create first delivery if included
      // This would require the deliveries API

      router.push(`/chef-planteurs/${chefPlanteur.id}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Échec de la création');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link href="/chef-planteurs" className="text-gray-500 hover:text-gray-700">
          <ArrowLeftIcon className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Nouveau fournisseur</h1>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6 rounded-lg bg-white p-6 shadow">
        {submitError && (
          <div className="rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-700">{submitError}</p>
          </div>
        )}

        {/* Section: Informations du Fournisseur */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-primary-700">Informations du Fournisseur</h2>
          
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

          {/* Phone */}
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
              Téléphone
            </label>
            <input
              type="tel"
              id="phone"
              value={formData.phone || ''}
              onChange={(e) => handleChange('phone', e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>

          {/* CNI */}
          <div>
            <label htmlFor="cni" className="block text-sm font-medium text-gray-700">
              CNI (Carte Nationale d&apos;Identité)
            </label>
            <input
              type="text"
              id="cni"
              value={formData.cni || ''}
              onChange={(e) => handleChange('cni', e.target.value)}
              placeholder="Ex: 123456789"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>

          {/* Coopérative (select from existing cooperatives - optional) */}
          <div>
            <label htmlFor="cooperative_id" className="block text-sm font-medium text-gray-700">
              Coopérative
            </label>
            <select
              id="cooperative_id"
              value={showNewCoopInput ? '__NEW__' : (formData.cooperative_id || '')}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '__NEW__') {
                  setShowNewCoopInput(true);
                  handleChange('cooperative_id', null);
                } else {
                  setShowNewCoopInput(false);
                  setNewCooperativeName('');
                  handleChange('cooperative_id', value || null);
                }
              }}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              disabled={loadingCooperatives}
            >
              <option value="">-- Aucune (indépendant) --</option>
              {cooperatives.map((coop) => (
                <option key={coop.id} value={coop.id}>
                  {coop.name} ({coop.code})
                </option>
              ))}
              <option value="__NEW__">+ Ajouter une nouvelle coopérative</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Optionnel : sélectionnez une coopérative, créez-en une nouvelle, ou laissez vide pour un fournisseur indépendant
            </p>
          </div>

          {/* New cooperative name input */}
          {showNewCoopInput && (
            <div className="ml-4 border-l-2 border-primary-200 pl-4">
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="region" className="block text-sm font-medium text-gray-700">
                Région
              </label>
              <input
                type="text"
                id="region"
                value={formData.region || ''}
                onChange={(e) => handleChange('region', e.target.value)}
                placeholder="Ex: Centre"
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
                placeholder="Ex: Mfoundi"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Localité */}
          <div>
            <label htmlFor="localite" className="block text-sm font-medium text-gray-700">
              Localité / Village
            </label>
            <input
              type="text"
              id="localite"
              value={formData.localite || ''}
              onChange={(e) => handleChange('localite', e.target.value)}
              placeholder="Ex: Yaoundé"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>

          {/* Quantité maximale */}
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
              onChange={(e) => handleChange('quantite_max_kg', e.target.value ? parseFloat(e.target.value) : 0)}
              className={`mt-1 block w-full rounded-md border ${
                errors.quantite_max_kg ? 'border-red-300' : 'border-gray-300'
              } px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500`}
            />
            <p className="mt-1 text-xs text-gray-500">Quantité maximale que le fournisseur peut fournir</p>
            {errors.quantite_max_kg && <p className="mt-1 text-sm text-red-600">{errors.quantite_max_kg}</p>}
          </div>
        </div>

        {/* Section: Géolocalisation */}
        <div className="space-y-4 border-t border-gray-200 pt-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-primary-700">
            <MapPin className="h-5 w-5 text-red-500" />
            Géolocalisation
          </h2>
          
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
                onChange={(e) => handleChange('latitude', e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="Ex: 3.8480"
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
                onChange={(e) => handleChange('longitude', e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="Ex: 11.5021"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleGetLocation}
            disabled={gettingLocation}
            className="mt-2 w-full flex items-center justify-center gap-2 rounded-md bg-gray-700 px-4 py-3 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors shadow-sm"
          >
            <MapPin className="h-5 w-5 text-red-400" />
            {gettingLocation ? 'Obtention de la position...' : 'Obtenir ma position actuelle'}
          </button>
        </div>

        {/* Section: Informations Contrat */}
        <div className="space-y-4 border-t border-gray-200 pt-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-primary-700">
            <Calendar className="h-5 w-5" />
            Informations Contrat
          </h2>
          
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="contract_start" className="block text-sm font-medium text-gray-700">
                Date début contrat
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
                Date fin contrat
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

          <div>
            <label htmlFor="termination_reason" className="block text-sm font-medium text-gray-700">
              Raison fin de contrat
            </label>
            <textarea
              id="termination_reason"
              rows={3}
              value={terminationReason}
              onChange={(e) => setTerminationReason(e.target.value)}
              placeholder="Ex: Fin de contrat, Résiliation, etc."
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
            <p className="mt-1 text-xs text-gray-500">À remplir uniquement si le contrat est terminé</p>
          </div>
        </div>

        {/* Section: Planteurs Associés (Optionnel) */}
        <div className="space-y-4 border-t border-gray-200 pt-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-primary-700">
            <Users className="h-5 w-5" />
            Planteurs Associés (Optionnel)
          </h2>
          <p className="text-sm text-gray-500">
            Vous pouvez assigner des planteurs à ce fournisseur maintenant ou plus tard
          </p>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sélectionner des planteurs
            </label>
            <div className="border border-gray-300 rounded-md max-h-48 overflow-y-auto">
              {loadingPlanteurs ? (
                <div className="p-4 text-center text-gray-500">Chargement...</div>
              ) : availablePlanteurs.length === 0 ? (
                <div className="p-4 text-center text-gray-500">Aucun planteur disponible</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {availablePlanteurs.map((planteur) => (
                    <label
                      key={planteur.id}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedPlanteurIds.includes(planteur.id)}
                        onChange={() => togglePlanteurSelection(planteur.id)}
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <div>
                        <p className="font-medium text-gray-900">{planteur.name}</p>
                        <p className="text-xs text-gray-500">{planteur.code}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Maintenez Ctrl (ou Cmd sur Mac) pour sélectionner plusieurs planteurs
            </p>
          </div>
        </div>

        {/* Section: Première Livraison (Optionnel) */}
        <div className="space-y-4 border-t border-gray-200 pt-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-primary-700">
            <Truck className="h-5 w-5" />
            Première Livraison (Optionnel)
          </h2>
          <p className="text-sm text-gray-500">
            Vous pouvez ajouter directement la première livraison d&apos;un planteur
          </p>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeFirstDelivery}
              onChange={(e) => setIncludeFirstDelivery(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm font-medium text-gray-700">Ajouter une première livraison</span>
          </label>

          {includeFirstDelivery && (
            <div className="space-y-4 pl-6 border-l-2 border-primary-200">
              {/* Planteur pour la livraison */}
              <div>
                <label htmlFor="delivery_planteur" className="block text-sm font-medium text-gray-700">
                  Planteur pour la livraison
                </label>
                <select
                  id="delivery_planteur"
                  value={firstDelivery.planteur_id}
                  onChange={(e) => handleDeliveryChange('planteur_id', e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="">Sélectionner un planteur...</option>
                  {selectedPlanteurIds.length > 0 ? (
                    availablePlanteurs
                      .filter((p) => selectedPlanteurIds.includes(p.id))
                      .map((planteur) => (
                        <option key={planteur.id} value={planteur.id}>
                          {planteur.name} ({planteur.code})
                        </option>
                      ))
                  ) : (
                    availablePlanteurs.map((planteur) => (
                      <option key={planteur.id} value={planteur.id}>
                        {planteur.name} ({planteur.code})
                      </option>
                    ))
                  )}
                </select>
                <p className="mt-1 text-xs text-gray-500">Choisir le planteur qui effectue cette livraison</p>
              </div>

              {/* Dates et lieux de chargement */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="date_chargement" className="block text-sm font-medium text-gray-700">
                    Date de chargement
                  </label>
                  <input
                    type="date"
                    id="date_chargement"
                    value={firstDelivery.date_chargement}
                    onChange={(e) => handleDeliveryChange('date_chargement', e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label htmlFor="lieu_chargement" className="block text-sm font-medium text-gray-700">
                    Lieu de chargement
                  </label>
                  <select
                    id="lieu_chargement"
                    value={firstDelivery.lieu_chargement}
                    onChange={(e) => handleDeliveryChange('lieu_chargement', e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="">Sélectionner...</option>
                    {LIEU_OPTIONS.map((lieu) => (
                      <option key={lieu} value={lieu}>{lieu}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dates et lieux de déchargement */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="date_dechargement" className="block text-sm font-medium text-gray-700">
                    Date de déchargement
                  </label>
                  <input
                    type="date"
                    id="date_dechargement"
                    value={firstDelivery.date_dechargement}
                    onChange={(e) => handleDeliveryChange('date_dechargement', e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label htmlFor="lieu_dechargement" className="block text-sm font-medium text-gray-700">
                    Lieu de déchargement
                  </label>
                  <select
                    id="lieu_dechargement"
                    value={firstDelivery.lieu_dechargement}
                    onChange={(e) => handleDeliveryChange('lieu_dechargement', e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="">Sélectionner...</option>
                    {LIEU_OPTIONS.map((lieu) => (
                      <option key={lieu} value={lieu}>{lieu}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quantités */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="quantite_chargee" className="block text-sm font-medium text-gray-700">
                    Quantité chargée (kg)
                  </label>
                  <input
                    type="number"
                    id="quantite_chargee"
                    min="0"
                    step="0.01"
                    value={firstDelivery.quantite_chargee_kg ?? ''}
                    onChange={(e) => handleDeliveryChange('quantite_chargee_kg', e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="Ex: 1550.00"
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label htmlFor="quantite_dechargee" className="block text-sm font-medium text-gray-700">
                    Quantité déchargée (kg)
                  </label>
                  <input
                    type="number"
                    id="quantite_dechargee"
                    min="0"
                    step="0.01"
                    value={firstDelivery.quantite_dechargee_kg ?? ''}
                    onChange={(e) => handleDeliveryChange('quantite_dechargee_kg', e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="Ex: 1500.50"
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
              </div>

              {/* Qualité et Pertes */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="qualite_cacao" className="block text-sm font-medium text-gray-700">
                    Qualité du cacao
                  </label>
                  <select
                    id="qualite_cacao"
                    value={firstDelivery.qualite_cacao}
                    onChange={(e) => handleDeliveryChange('qualite_cacao', e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="">Sélectionner...</option>
                    {QUALITE_CACAO_OPTIONS.map((qualite) => (
                      <option key={qualite} value={qualite}>{qualite}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Pertes (kg)
                  </label>
                  <input
                    type="text"
                    value={pertes !== null ? pertes.toFixed(2) : ''}
                    disabled
                    placeholder="Calculé automatiquement"
                    className="mt-1 block w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">Pertes = Chargé - Déchargé</p>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="delivery_notes" className="block text-sm font-medium text-gray-700">
                  Notes
                </label>
                <textarea
                  id="delivery_notes"
                  rows={3}
                  value={firstDelivery.notes}
                  onChange={(e) => handleDeliveryChange('notes', e.target.value)}
                  placeholder="Notes sur la livraison..."
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 border-t border-gray-200 pt-6">
          <Link
            href="/chef-planteurs"
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Annuler
          </Link>
          <button
            type="submit"
            disabled={submitting || creatingCooperative}
            className="inline-flex items-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {(submitting || creatingCooperative) && <LoadingSpinner className="mr-2" />}
            {creatingCooperative ? 'Création de la coopérative...' : submitting ? 'Création...' : 'Créer le fournisseur'}
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
