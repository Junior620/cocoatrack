'use client';

// CocoaTrack V2 - Invoice Generation Wizard
// Allows managers to generate invoices from deliveries
// Supports invoicing by: Cooperative, Fournisseur (Chef Planteur), or Planteur

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth';
import { invoicesApi } from '@/lib/api/invoices';
import { createClient } from '@/lib/supabase/client';

// Invoice target type
type InvoiceTargetType = 'cooperative' | 'fournisseur' | 'planteur';

interface Cooperative {
  id: string;
  name: string;
  code: string;
}

interface ChefPlanteur {
  id: string;
  name: string;
  code: string;
  cooperative_id: string | null;
}

interface Planteur {
  id: string;
  name: string;
  code: string;
  cooperative_id: string | null;
  chef_planteur_id: string | null;
}

interface AvailableDelivery {
  id: string;
  code: string;
  weight_kg: number;
  total_amount: number;
  delivered_at: string;
  planteur_name?: string;
}

export default function GenerateInvoicePage() {
  const router = useRouter();
  const { user } = useAuth();

  const [step, setStep] = useState(1);
  
  // Target type selection
  const [targetType, setTargetType] = useState<InvoiceTargetType>('cooperative');
  
  // Entity lists
  const [cooperatives, setCooperatives] = useState<Cooperative[]>([]);
  const [chefPlanteurs, setChefPlanteurs] = useState<ChefPlanteur[]>([]);
  const [planteurs, setPlanteurs] = useState<Planteur[]>([]);
  
  // Selected entities
  const [selectedCooperative, setSelectedCooperative] = useState<string>('');
  const [selectedChefPlanteur, setSelectedChefPlanteur] = useState<string>('');
  const [selectedPlanteur, setSelectedPlanteur] = useState<string>('');
  
  // Period
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  
  // Deliveries
  const [availableDeliveries, setAvailableDeliveries] = useState<AvailableDelivery[]>([]);
  const [selectedDeliveries, setSelectedDeliveries] = useState<Set<string>>(new Set());
  
  // Loading states
  const [loading, setLoading] = useState(false);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);
  const [loadingChefPlanteurs, setLoadingChefPlanteurs] = useState(false);
  const [loadingPlanteurs, setLoadingPlanteurs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  // Fetch cooperatives
  useEffect(() => {
    const fetchCooperatives = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('cooperatives')
        .select('id, name, code')
        .order('name');

      if (!error && data) {
        setCooperatives(data);
        // If user has a cooperative, pre-select it
        if (user?.cooperative_id) {
          setSelectedCooperative(user.cooperative_id);
        }
      }
    };

    fetchCooperatives();
  }, [user?.cooperative_id]);

  // Fetch chef planteurs when cooperative changes or target type is fournisseur
  useEffect(() => {
    const fetchChefPlanteurs = async () => {
      if (targetType !== 'fournisseur') return;
      
      setLoadingChefPlanteurs(true);
      const supabase = createClient();
      
      let query = supabase
        .from('chef_planteurs')
        .select('id, name, code, cooperative_id')
        .eq('is_active', true)
        .order('name');
      
      // Filter by cooperative if selected
      if (selectedCooperative) {
        query = query.eq('cooperative_id', selectedCooperative);
      }

      const { data, error } = await query;

      if (!error && data) {
        setChefPlanteurs(data);
      }
      setLoadingChefPlanteurs(false);
    };

    fetchChefPlanteurs();
  }, [targetType, selectedCooperative]);

  // Fetch planteurs when target type is planteur
  useEffect(() => {
    const fetchPlanteurs = async () => {
      if (targetType !== 'planteur') return;
      
      setLoadingPlanteurs(true);
      const supabase = createClient();
      
      let query = supabase
        .from('planteurs')
        .select('id, name, code, cooperative_id, chef_planteur_id')
        .eq('is_active', true)
        .order('name');
      
      // Filter by cooperative if selected
      if (selectedCooperative) {
        query = query.eq('cooperative_id', selectedCooperative);
      }
      
      // Filter by chef planteur if selected
      if (selectedChefPlanteur) {
        query = query.eq('chef_planteur_id', selectedChefPlanteur);
      }

      const { data, error } = await query;

      if (!error && data) {
        setPlanteurs(data);
      }
      setLoadingPlanteurs(false);
    };

    fetchPlanteurs();
  }, [targetType, selectedCooperative, selectedChefPlanteur]);

  // Fetch available deliveries when period changes
  const fetchAvailableDeliveries = useCallback(async () => {
    // Validate we have the required selection based on target type
    const hasValidSelection = 
      (targetType === 'cooperative' && selectedCooperative) ||
      (targetType === 'fournisseur' && selectedChefPlanteur) ||
      (targetType === 'planteur' && selectedPlanteur);
    
    if (!hasValidSelection || !periodStart || !periodEnd) {
      setAvailableDeliveries([]);
      return;
    }

    setLoadingDeliveries(true);
    setError(null);
    try {
      const deliveries = await invoicesApi.getAvailableDeliveriesExtended({
        target_type: targetType,
        cooperative_id: selectedCooperative || undefined,
        chef_planteur_id: targetType === 'fournisseur' ? selectedChefPlanteur : undefined,
        planteur_id: targetType === 'planteur' ? selectedPlanteur : undefined,
        period_start: periodStart,
        period_end: periodEnd,
      });
      setAvailableDeliveries(deliveries);
      // Select all by default
      setSelectedDeliveries(new Set(deliveries.map(d => d.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch deliveries');
    } finally {
      setLoadingDeliveries(false);
    }
  }, [targetType, selectedCooperative, selectedChefPlanteur, selectedPlanteur, periodStart, periodEnd]);

  useEffect(() => {
    if (step === 2) {
      fetchAvailableDeliveries();
    }
  }, [step, fetchAvailableDeliveries]);

  // Toggle delivery selection
  const toggleDelivery = (id: string) => {
    const newSelected = new Set(selectedDeliveries);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedDeliveries(newSelected);
  };

  // Select/deselect all
  const toggleAll = () => {
    if (selectedDeliveries.size === availableDeliveries.length) {
      setSelectedDeliveries(new Set());
    } else {
      setSelectedDeliveries(new Set(availableDeliveries.map(d => d.id)));
    }
  };

  // Calculate totals
  const selectedTotals = availableDeliveries
    .filter(d => selectedDeliveries.has(d.id))
    .reduce(
      (acc, d) => ({
        count: acc.count + 1,
        weight: acc.weight + Number(d.weight_kg),
        amount: acc.amount + Number(d.total_amount),
      }),
      { count: 0, weight: 0, amount: 0 }
    );

  // Generate invoice
  const handleGenerate = async () => {
    if (selectedDeliveries.size === 0) {
      setError('Veuillez sélectionner au moins une livraison');
      return;
    }

    setGenerating(true);
    setError(null);
    try {
      const invoice = await invoicesApi.generateFromDeliveriesExtended({
        target_type: targetType,
        cooperative_id: selectedCooperative || undefined,
        chef_planteur_id: targetType === 'fournisseur' ? selectedChefPlanteur : undefined,
        planteur_id: targetType === 'planteur' ? selectedPlanteur : undefined,
        period_start: periodStart,
        period_end: periodEnd,
        delivery_ids: Array.from(selectedDeliveries),
      });
      router.push(`/invoices/${invoice.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate invoice');
      setGenerating(false);
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' XAF';
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  // Can proceed to next step
  const hasValidSelection = 
    (targetType === 'cooperative' && selectedCooperative) ||
    (targetType === 'fournisseur' && selectedChefPlanteur) ||
    (targetType === 'planteur' && selectedPlanteur);
  
  const canProceed = step === 1 
    ? hasValidSelection && periodStart && periodEnd && new Date(periodStart) <= new Date(periodEnd)
    : selectedDeliveries.size > 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/invoices" className="text-gray-400 hover:text-gray-600">
          <ArrowLeftIcon className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Générer une facture</h1>
          <p className="mt-1 text-sm text-gray-500">
            Étape {step} sur 2
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-4">
        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${step >= 1 ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
          1
        </div>
        <div className={`h-1 flex-1 rounded ${step >= 2 ? 'bg-primary-600' : 'bg-gray-200'}`} />
        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${step >= 2 ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
          2
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Step 1: Select target and period */}
      {step === 1 && (
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="text-lg font-semibold text-gray-900">Sélectionner la cible et la période</h2>
          <p className="mt-1 text-sm text-gray-500">
            Choisissez le type de facturation, l&apos;entité et la période
          </p>

          <div className="mt-6 space-y-4">
            {/* Target type selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type de facturation
              </label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="targetType"
                    value="cooperative"
                    checked={targetType === 'cooperative'}
                    onChange={(e) => {
                      setTargetType(e.target.value as InvoiceTargetType);
                      setSelectedChefPlanteur('');
                      setSelectedPlanteur('');
                    }}
                    className="h-4 w-4 border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Coopérative</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="targetType"
                    value="fournisseur"
                    checked={targetType === 'fournisseur'}
                    onChange={(e) => {
                      setTargetType(e.target.value as InvoiceTargetType);
                      setSelectedPlanteur('');
                    }}
                    className="h-4 w-4 border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Fournisseur (Chef Planteur)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="targetType"
                    value="planteur"
                    checked={targetType === 'planteur'}
                    onChange={(e) => {
                      setTargetType(e.target.value as InvoiceTargetType);
                    }}
                    className="h-4 w-4 border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Planteur</span>
                </label>
              </div>
            </div>

            {/* Cooperative selector (always shown for filtering) */}
            <div>
              <label htmlFor="cooperative" className="block text-sm font-medium text-gray-700">
                Coopérative {targetType !== 'cooperative' && '(optionnel - pour filtrer)'}
              </label>
              <select
                id="cooperative"
                value={selectedCooperative}
                onChange={(e) => {
                  setSelectedCooperative(e.target.value);
                  setSelectedChefPlanteur('');
                  setSelectedPlanteur('');
                }}
                className="mt-1 block w-full rounded-md border border-gray-300 py-2 pl-3 pr-10 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="">Sélectionner une coopérative</option>
                {cooperatives.map((coop) => (
                  <option key={coop.id} value={coop.id}>
                    {coop.name} ({coop.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Chef Planteur selector (for fournisseur or planteur type) */}
            {(targetType === 'fournisseur' || targetType === 'planteur') && (
              <div>
                <label htmlFor="chefPlanteur" className="block text-sm font-medium text-gray-700">
                  Fournisseur (Chef Planteur) {targetType === 'planteur' && '(optionnel - pour filtrer)'}
                </label>
                <select
                  id="chefPlanteur"
                  value={selectedChefPlanteur}
                  onChange={(e) => {
                    setSelectedChefPlanteur(e.target.value);
                    setSelectedPlanteur('');
                  }}
                  disabled={loadingChefPlanteurs}
                  className="mt-1 block w-full rounded-md border border-gray-300 py-2 pl-3 pr-10 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-gray-100"
                >
                  <option value="">
                    {loadingChefPlanteurs ? 'Chargement...' : 'Sélectionner un fournisseur'}
                  </option>
                  {chefPlanteurs.map((chef) => (
                    <option key={chef.id} value={chef.id}>
                      {chef.name} ({chef.code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Planteur selector (for planteur type) */}
            {targetType === 'planteur' && (
              <div>
                <label htmlFor="planteur" className="block text-sm font-medium text-gray-700">
                  Planteur
                </label>
                <select
                  id="planteur"
                  value={selectedPlanteur}
                  onChange={(e) => setSelectedPlanteur(e.target.value)}
                  disabled={loadingPlanteurs}
                  className="mt-1 block w-full rounded-md border border-gray-300 py-2 pl-3 pr-10 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-gray-100"
                >
                  <option value="">
                    {loadingPlanteurs ? 'Chargement...' : 'Sélectionner un planteur'}
                  </option>
                  {planteurs.map((planteur) => (
                    <option key={planteur.id} value={planteur.id}>
                      {planteur.name} ({planteur.code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="periodStart" className="block text-sm font-medium text-gray-700">
                  Date de début
                </label>
                <input
                  type="date"
                  id="periodStart"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div>
                <label htmlFor="periodEnd" className="block text-sm font-medium text-gray-700">
                  Date de fin
                </label>
                <input
                  type="date"
                  id="periodEnd"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={() => setStep(2)}
              disabled={!canProceed}
              className="inline-flex items-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Suivant
              <ChevronRightIcon className="ml-2 h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Select deliveries */}
      {step === 2 && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-white p-4 shadow">
              <p className="text-sm font-medium text-gray-500">Livraisons sélectionnées</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{selectedTotals.count}</p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow">
              <p className="text-sm font-medium text-gray-500">Poids total</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{selectedTotals.weight.toFixed(2)} kg</p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow">
              <p className="text-sm font-medium text-gray-500">Montant total</p>
              <p className="mt-1 text-2xl font-bold text-primary-600">{formatCurrency(selectedTotals.amount)}</p>
            </div>
          </div>

          {/* Deliveries table */}
          <div className="rounded-lg bg-white shadow">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Livraisons disponibles</h2>
              <button
                onClick={toggleAll}
                className="text-sm text-primary-600 hover:text-primary-900"
              >
                {selectedDeliveries.size === availableDeliveries.length ? 'Tout désélectionner' : 'Tout sélectionner'}
              </button>
            </div>

            {loadingDeliveries ? (
              <div className="p-6">
                <div className="animate-pulse space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-12 rounded bg-gray-200" />
                  ))}
                </div>
              </div>
            ) : availableDeliveries.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500">
                Aucune livraison disponible pour cette période
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectedDeliveries.size === availableDeliveries.length}
                          onChange={toggleAll}
                          className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Code
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Poids (kg)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Montant
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {availableDeliveries.map((delivery) => (
                      <tr
                        key={delivery.id}
                        className={`cursor-pointer hover:bg-gray-50 ${selectedDeliveries.has(delivery.id) ? 'bg-primary-50' : ''}`}
                        onClick={() => toggleDelivery(delivery.id)}
                      >
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedDeliveries.has(delivery.id)}
                            onChange={() => toggleDelivery(delivery.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          />
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                          {delivery.code}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                          {formatDate(delivery.delivered_at)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                          {Number(delivery.weight_kg).toFixed(2)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                          {formatCurrency(Number(delivery.total_amount))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <ChevronLeftIcon className="mr-2 h-4 w-4" />
              Précédent
            </button>
            <button
              onClick={handleGenerate}
              disabled={!canProceed || generating}
              className="inline-flex items-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generating ? (
                <>
                  <SpinnerIcon className="mr-2 h-4 w-4 animate-spin" />
                  Génération...
                </>
              ) : (
                <>
                  <DocumentIcon className="mr-2 h-4 w-4" />
                  Générer la facture
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Icons
function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}
