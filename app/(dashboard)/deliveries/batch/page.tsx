'use client';

// CocoaTrack V2 - Batch Delivery Entry Page
// Form to create multiple deliveries at once + CSV import

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';

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

interface BatchEntry extends CreateDeliveryInput {
  key: string;
  error?: string;
}

export default function BatchDeliveryPage() {
  const router = useRouter();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Options for selects
  const [chefPlanteurs, setChefPlanteurs] = useState<SelectOption[]>([]);
  const [planteursByChef, setPlanteursByChef] = useState<Record<string, SelectOption[]>>({});
  const [warehouses, setWarehouses] = useState<SelectOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  // Batch entries
  const [entries, setEntries] = useState<BatchEntry[]>([
    createEmptyEntry(),
  ]);

  const canCreate = user && hasPermission(user.role, 'deliveries:create');

  function createEmptyEntry(): BatchEntry {
    return {
      key: crypto.randomUUID(),
      planteur_id: '',
      chef_planteur_id: '',
      warehouse_id: '',
      weight_kg: 0,
      price_per_kg: 0,
      quality_grade: 'B',
      notes: '',
    };
  }

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

  // Load planteurs for a chef_planteur
  const loadPlanteursForChef = async (chefId: string) => {
    if (planteursByChef[chefId]) return;

    try {
      const result = await planteursApi.list({
        page: 1,
        chef_planteur_id: chefId,
        is_active: true,
        pageSize: 100,
      });
      setPlanteursByChef(prev => ({
        ...prev,
        [chefId]: result.data.map(p => ({
          id: p.id,
          name: p.name,
          code: p.code,
        })),
      }));
    } catch (err) {
      console.error('Failed to load planteurs:', err);
    }
  };

  // Update entry
  const updateEntry = (key: string, field: keyof BatchEntry, value: unknown) => {
    setEntries(prev => prev.map(entry => {
      if (entry.key !== key) return entry;
      
      const updated = { ...entry, [field]: value, error: undefined };
      
      // Reset planteur when chef changes
      if (field === 'chef_planteur_id') {
        updated.planteur_id = '';
        if (value) {
          loadPlanteursForChef(value as string);
        }
      }
      
      return updated;
    }));
  };

  // Add new entry
  const addEntry = () => {
    setEntries(prev => [...prev, createEmptyEntry()]);
  };

  // Remove entry
  const removeEntry = (key: string) => {
    if (entries.length === 1) return;
    setEntries(prev => prev.filter(e => e.key !== key));
  };

  // Duplicate entry
  const duplicateEntry = (key: string) => {
    const entry = entries.find(e => e.key === key);
    if (!entry) return;
    
    setEntries(prev => [
      ...prev,
      { ...entry, key: crypto.randomUUID(), error: undefined },
    ]);
  };

  // Handle CSV import
  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        setError('Le fichier CSV doit contenir au moins une ligne de données');
        return;
      }

      // Parse header
      const header = lines[0].split(',').map(h => h.trim().toLowerCase());
      const requiredFields = ['planteur_code', 'warehouse_code', 'weight_kg', 'price_per_kg'];
      const missingFields = requiredFields.filter(f => !header.includes(f));
      
      if (missingFields.length > 0) {
        setError(`Champs manquants dans le CSV: ${missingFields.join(', ')}`);
        return;
      }

      // Build lookup maps
      const supabase = createClient();
      const { data: allPlanteurs } = await supabase
        .from('planteurs')
        .select('id, code, chef_planteur_id')
        .eq('is_active', true);
      
      type PlanteurLookup = { id: string; code: string; chef_planteur_id: string };
      const planteurByCode = new Map((allPlanteurs as PlanteurLookup[] | null)?.map(p => [p.code, p]) || []);
      const warehouseByCode = new Map(warehouses.map(w => [w.code, w]));

      // Parse data rows
      const newEntries: BatchEntry[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const row: Record<string, string> = {};
        header.forEach((h, idx) => {
          row[h] = values[idx] || '';
        });

        const planteur = planteurByCode.get(row.planteur_code);
        const warehouse = warehouseByCode.get(row.warehouse_code);

        const entry: BatchEntry = {
          key: crypto.randomUUID(),
          planteur_id: planteur?.id || '',
          chef_planteur_id: planteur?.chef_planteur_id || '',
          warehouse_id: warehouse?.id || '',
          weight_kg: parseFloat(row.weight_kg) || 0,
          price_per_kg: parseFloat(row.price_per_kg) || 0,
          quality_grade: (row.quality_grade as QualityGrade) || 'B',
          notes: row.notes || '',
        };

        if (!planteur) {
          entry.error = `Planteur non trouvé: ${row.planteur_code}`;
        } else if (!warehouse) {
          entry.error = `Entrepôt non trouvé: ${row.warehouse_code}`;
        }

        // Load planteurs for this chef
        if (planteur?.chef_planteur_id) {
          loadPlanteursForChef(planteur.chef_planteur_id);
        }

        newEntries.push(entry);
      }

      setEntries(newEntries);
      setSuccess(`${newEntries.length} lignes importées`);
    } catch (err) {
      setError('Erreur lors de l\'import du fichier CSV');
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!canCreate) {
      setError('Vous n\'avez pas la permission de créer des livraisons');
      return;
    }

    // Validate entries
    const validEntries = entries.filter(e => 
      e.planteur_id && e.chef_planteur_id && e.warehouse_id && 
      e.weight_kg > 0 && e.price_per_kg > 0 && !e.error
    );

    if (validEntries.length === 0) {
      setError('Aucune entrée valide à créer');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const deliveries = await deliveriesApi.createBatch({
        deliveries: validEntries.map(({ key, error, ...data }) => data),
      });
      
      setSuccess(`${deliveries.length} livraisons créées avec succès`);
      
      // Reset form after short delay
      setTimeout(() => {
        router.push('/deliveries');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create deliveries');
    } finally {
      setLoading(false);
    }
  };

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
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/deliveries"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Retour aux livraisons
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">
            Entrée multiple de livraisons
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Créez plusieurs livraisons en une seule fois
          </p>
        </div>
        <div className="flex gap-2">
          <label className="inline-flex cursor-pointer items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <UploadIcon className="mr-2 h-4 w-4" />
            Importer CSV
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleCsvImport}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      {success && (
        <div className="rounded-md bg-green-50 p-4">
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      {/* CSV format help */}
      <div className="rounded-md bg-blue-50 p-4">
        <h3 className="text-sm font-medium text-blue-800">Format CSV attendu</h3>
        <p className="mt-1 text-xs text-blue-700">
          Colonnes requises: planteur_code, warehouse_code, weight_kg, price_per_kg
        </p>
        <p className="text-xs text-blue-700">
          Colonnes optionnelles: quality_grade (A/B/C), notes
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {entries.map((entry, index) => (
          <div 
            key={entry.key} 
            className={`rounded-lg bg-white p-4 shadow ${entry.error ? 'ring-2 ring-red-500' : ''}`}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-500">
                Livraison #{index + 1}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => duplicateEntry(entry.key)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Dupliquer
                </button>
                {entries.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeEntry(entry.key)}
                    className="text-sm text-red-500 hover:text-red-700"
                  >
                    Supprimer
                  </button>
                )}
              </div>
            </div>

            {entry.error && (
              <div className="mb-4 rounded-md bg-red-50 p-2">
                <p className="text-xs text-red-700">{entry.error}</p>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
              {/* Chef Planteur */}
              <div>
                <label className="block text-xs font-medium text-gray-700">Chef Planteur</label>
                <select
                  required
                  value={entry.chef_planteur_id}
                  onChange={(e) => updateEntry(entry.key, 'chef_planteur_id', e.target.value)}
                  disabled={loadingOptions}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-gray-100"
                >
                  <option value="">Sélectionner</option>
                  {chefPlanteurs.map((cp) => (
                    <option key={cp.id} value={cp.id}>{cp.code}</option>
                  ))}
                </select>
              </div>

              {/* Planteur */}
              <div>
                <label className="block text-xs font-medium text-gray-700">Planteur</label>
                <select
                  required
                  value={entry.planteur_id}
                  onChange={(e) => updateEntry(entry.key, 'planteur_id', e.target.value)}
                  disabled={!entry.chef_planteur_id}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-gray-100"
                >
                  <option value="">Sélectionner</option>
                  {(planteursByChef[entry.chef_planteur_id] || []).map((p) => (
                    <option key={p.id} value={p.id}>{p.code}</option>
                  ))}
                </select>
              </div>

              {/* Warehouse */}
              <div>
                <label className="block text-xs font-medium text-gray-700">Entrepôt</label>
                <select
                  required
                  value={entry.warehouse_id}
                  onChange={(e) => updateEntry(entry.key, 'warehouse_id', e.target.value)}
                  disabled={loadingOptions}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-gray-100"
                >
                  <option value="">Sélectionner</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.code}</option>
                  ))}
                </select>
              </div>

              {/* Weight */}
              <div>
                <label className="block text-xs font-medium text-gray-700">Poids (kg)</label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  value={entry.weight_kg || ''}
                  onChange={(e) => updateEntry(entry.key, 'weight_kg', parseFloat(e.target.value) || 0)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="0.00"
                />
              </div>

              {/* Price */}
              <div>
                <label className="block text-xs font-medium text-gray-700">Prix/kg</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="1"
                  value={entry.price_per_kg || ''}
                  onChange={(e) => updateEntry(entry.key, 'price_per_kg', parseFloat(e.target.value) || 0)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="0"
                />
              </div>

              {/* Quality */}
              <div>
                <label className="block text-xs font-medium text-gray-700">Qualité</label>
                <select
                  value={entry.quality_grade}
                  onChange={(e) => updateEntry(entry.key, 'quality_grade', e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                </select>
              </div>
            </div>
          </div>
        ))}

        {/* Add entry button */}
        <button
          type="button"
          onClick={addEntry}
          className="flex w-full items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-4 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700"
        >
          <PlusIcon className="mr-2 h-4 w-4" />
          Ajouter une livraison
        </button>

        {/* Actions */}
        <div className="flex justify-between items-center pt-4">
          <span className="text-sm text-gray-500">
            {entries.filter(e => !e.error && e.planteur_id && e.weight_kg > 0).length} / {entries.length} entrées valides
          </span>
          <div className="flex gap-3">
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
              {loading ? 'Création...' : `Créer ${entries.filter(e => !e.error && e.planteur_id && e.weight_kg > 0).length} livraisons`}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

// Icons
function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  );
}
