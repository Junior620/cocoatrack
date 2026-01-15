'use client';

// CocoaTrack V2 - Assign Parcelles Modal
// Modal for assigning orphan parcelles to a planteur (existing or new)
// @see Requirements 5.1, 5.2, 5.3

import { useState, useEffect, useCallback } from 'react';
import { 
  X, 
  Search, 
  User, 
  UserPlus, 
  Check, 
  Loader2, 
  MapPin,
  AlertCircle,
  ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { planteursApi } from '@/lib/api/planteurs';
import { chefPlanteursApi } from '@/lib/api/chef-planteurs';
import type { Parcelle } from '@/types/parcelles';

// =============================================================================
// Types
// =============================================================================

export interface AssignParcellesModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Parcelles to assign */
  parcelles: Parcelle[];
  /** Callback when assignment is complete */
  onAssignComplete: (result: AssignResult) => void;
}

export interface AssignResult {
  /** Number of parcelles assigned */
  updated_count: number;
  /** IDs of assigned parcelles */
  assigned_ids: string[];
  /** Planteur ID (existing or newly created) */
  planteur_id: string;
  /** Planteur name */
  planteur_name: string;
  /** Whether a new planteur was created */
  planteur_created: boolean;
}

interface PlanteurOption {
  id: string;
  name: string;
  code: string;
  phone?: string | null;
  village?: string | null;
}

interface ChefPlanteurOption {
  id: string;
  name: string;
  code: string;
}

type AssignMode = 'existing' | 'new';

// =============================================================================
// Helper Components
// =============================================================================

/**
 * Format hectares for display
 */
function formatHectares(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Parcelle summary item
 */
function ParcelleSummaryItem({ parcelle }: { parcelle: Parcelle }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-2 min-w-0">
        <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
        <div className="min-w-0">
          <span className="text-sm font-medium text-gray-900 truncate block">
            {parcelle.code || parcelle.label || 'Sans code'}
          </span>
          {parcelle.village && (
            <span className="text-xs text-gray-500 truncate block">
              {parcelle.village}
            </span>
          )}
        </div>
      </div>
      <span className="text-sm text-gray-600 flex-shrink-0 ml-2">
        {formatHectares(parcelle.surface_hectares)} ha
      </span>
    </div>
  );
}

/**
 * Searchable dropdown for selecting a planteur
 */
function PlanteurDropdown({
  value,
  onChange,
  disabled,
}: {
  value: PlanteurOption | null;
  onChange: (planteur: PlanteurOption | null) => void;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [options, setOptions] = useState<PlanteurOption[]>([]);
  const [loading, setLoading] = useState(false);

  // Search planteurs with debounce
  useEffect(() => {
    const searchPlanteurs = async () => {
      setLoading(true);
      try {
        if (!searchQuery.trim()) {
          const result = await planteursApi.list({
            page: 1,
            pageSize: 20,
            is_active: true,
          });
          setOptions(
            result.data.map((p) => ({
              id: p.id,
              name: p.name,
              code: p.code,
              phone: p.phone,
              village: p.localite || null,
            }))
          );
        } else {
          const result = await planteursApi.search(searchQuery, 20);
          setOptions(
            result.map((p) => ({
              id: p.id,
              name: p.name,
              code: p.code,
              phone: p.phone,
              village: p.localite || null,
            }))
          );
        }
      } catch (err) {
        console.error('Failed to search planteurs:', err);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(searchPlanteurs, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load initial options when opening
  useEffect(() => {
    if (isOpen && options.length === 0) {
      setSearchQuery('');
    }
  }, [isOpen, options.length]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'w-full flex items-center justify-between px-3 py-2.5 rounded-lg border bg-white text-left transition-colors',
          disabled && 'bg-gray-100 cursor-not-allowed opacity-60',
          isOpen ? 'border-primary-500 ring-2 ring-primary-500/20' : 'border-gray-200 hover:border-gray-300'
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
          {value ? (
            <div className="min-w-0">
              <span className="text-sm font-medium text-gray-900 truncate block">
                {value.name}
              </span>
              <span className="text-xs text-gray-500 truncate block">
                {value.code}
              </span>
            </div>
          ) : (
            <span className="text-sm text-gray-400">Sélectionner un planteur...</span>
          )}
        </div>
        <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
          {/* Search Input */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher par nom ou code..."
                className="w-full rounded-md border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                autoFocus
              />
              {loading && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 animate-spin" />
              )}
            </div>
          </div>

          {/* Options List */}
          <ul className="max-h-48 overflow-y-auto py-1">
            {options.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-gray-500">
                {loading ? 'Chargement...' : 'Aucun planteur trouvé'}
              </li>
            ) : (
              options.map((planteur) => (
                <li
                  key={planteur.id}
                  onClick={() => {
                    onChange(planteur);
                    setIsOpen(false);
                    setSearchQuery('');
                  }}
                  className={cn(
                    'px-3 py-2 cursor-pointer transition-colors hover:bg-primary-50',
                    value?.id === planteur.id && 'bg-primary-100'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                      <User className="h-4 w-4 text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{planteur.name}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {planteur.code}
                        {planteur.village && ` • ${planteur.village}`}
                      </p>
                    </div>
                    {value?.id === planteur.id && (
                      <Check className="h-4 w-4 text-primary-600 flex-shrink-0" />
                    )}
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      )}

      {/* Backdrop to close dropdown */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => {
            setIsOpen(false);
            setSearchQuery('');
          }} 
        />
      )}
    </div>
  );
}

/**
 * Searchable dropdown for selecting a chef planteur
 */
function ChefPlanteurDropdown({
  value,
  onChange,
  disabled,
  error,
}: {
  value: ChefPlanteurOption | null;
  onChange: (chef: ChefPlanteurOption | null) => void;
  disabled?: boolean;
  error?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [options, setOptions] = useState<ChefPlanteurOption[]>([]);
  const [loading, setLoading] = useState(false);

  // Search chef planteurs with debounce
  useEffect(() => {
    const searchChefPlanteurs = async () => {
      setLoading(true);
      try {
        if (!searchQuery.trim()) {
          const result = await chefPlanteursApi.list({
            page: 1,
            pageSize: 20,
            validation_status: 'validated',
          });
          setOptions(
            result.data.map((cp) => ({
              id: cp.id,
              name: cp.name,
              code: cp.code,
            }))
          );
        } else {
          const result = await chefPlanteursApi.search(searchQuery, 20);
          setOptions(
            result.map((cp) => ({
              id: cp.id,
              name: cp.name,
              code: cp.code,
            }))
          );
        }
      } catch (err) {
        console.error('Failed to search chef planteurs:', err);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(searchChefPlanteurs, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'w-full flex items-center justify-between px-3 py-2.5 rounded-lg border bg-white text-left transition-colors',
          disabled && 'bg-gray-100 cursor-not-allowed opacity-60',
          error ? 'border-red-300' : isOpen ? 'border-primary-500 ring-2 ring-primary-500/20' : 'border-gray-200 hover:border-gray-300'
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
          {value ? (
            <div className="min-w-0">
              <span className="text-sm font-medium text-gray-900 truncate block">
                {value.name}
              </span>
              <span className="text-xs text-gray-500 truncate block">
                {value.code}
              </span>
            </div>
          ) : (
            <span className="text-sm text-gray-400">Sélectionner un chef planteur...</span>
          )}
        </div>
        <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {error && (
        <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
          {/* Search Input */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher par nom ou code..."
                className="w-full rounded-md border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                autoFocus
              />
              {loading && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 animate-spin" />
              )}
            </div>
          </div>

          {/* Options List */}
          <ul className="max-h-48 overflow-y-auto py-1">
            {options.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-gray-500">
                {loading ? 'Chargement...' : 'Aucun chef planteur trouvé'}
              </li>
            ) : (
              options.map((chef) => (
                <li
                  key={chef.id}
                  onClick={() => {
                    onChange(chef);
                    setIsOpen(false);
                    setSearchQuery('');
                  }}
                  className={cn(
                    'px-3 py-2 cursor-pointer transition-colors hover:bg-primary-50',
                    value?.id === chef.id && 'bg-primary-100'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center">
                      <User className="h-4 w-4 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{chef.name}</p>
                      <p className="text-xs text-gray-500 truncate">{chef.code}</p>
                    </div>
                    {value?.id === chef.id && (
                      <Check className="h-4 w-4 text-primary-600 flex-shrink-0" />
                    )}
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      )}

      {/* Backdrop to close dropdown */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => {
            setIsOpen(false);
            setSearchQuery('');
          }} 
        />
      )}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * AssignParcellesModal Component
 * 
 * Modal for assigning orphan parcelles to a planteur.
 * Supports two modes:
 * - Assign to existing planteur (dropdown selection)
 * - Create new planteur and assign (inline form)
 * 
 * @see Requirements 5.1, 5.2, 5.3
 */
export function AssignParcellesModal({
  isOpen,
  onClose,
  parcelles,
  onAssignComplete,
}: AssignParcellesModalProps) {
  // State
  const [mode, setMode] = useState<AssignMode>('existing');
  const [selectedPlanteur, setSelectedPlanteur] = useState<PlanteurOption | null>(null);
  const [newPlanteurName, setNewPlanteurName] = useState('');
  const [newPlanteurCode, setNewPlanteurCode] = useState('');
  const [selectedChefPlanteur, setSelectedChefPlanteur] = useState<ChefPlanteurOption | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setMode('existing');
      setSelectedPlanteur(null);
      setNewPlanteurName('');
      setNewPlanteurCode('');
      setSelectedChefPlanteur(null);
      setError(null);
      setValidationErrors({});
    }
  }, [isOpen]);

  // Calculate total surface
  const totalSurface = parcelles.reduce((sum, p) => sum + p.surface_hectares, 0);

  // Validate form
  const validateForm = useCallback((): boolean => {
    const errors: Record<string, string> = {};

    if (mode === 'existing') {
      if (!selectedPlanteur) {
        errors.planteur = 'Veuillez sélectionner un planteur';
      }
    } else {
      if (!newPlanteurName.trim()) {
        errors.name = 'Le nom est obligatoire';
      }
      if (!selectedChefPlanteur) {
        errors.chef_planteur = 'Veuillez sélectionner un chef planteur';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [mode, selectedPlanteur, newPlanteurName, selectedChefPlanteur]);

  // Handle submit
  const handleSubmit = useCallback(async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const parcelleIds = parcelles.map((p) => p.id);

      if (mode === 'existing' && selectedPlanteur) {
        // Assign to existing planteur
        const response = await fetch('/api/parcelles/assign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            parcelle_ids: parcelleIds,
            planteur_id: selectedPlanteur.id,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Erreur lors de l\'assignation');
        }

        const result = await response.json();
        onAssignComplete({
          updated_count: result.updated_count,
          assigned_ids: result.assigned_ids,
          planteur_id: selectedPlanteur.id,
          planteur_name: selectedPlanteur.name,
          planteur_created: false,
        });
      } else if (mode === 'new' && selectedChefPlanteur) {
        // Create new planteur and assign
        const response = await fetch('/api/parcelles/assign-new-planteur', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            parcelle_ids: parcelleIds,
            planteur: {
              name: newPlanteurName.trim(),
              code: newPlanteurCode.trim() || undefined,
              chef_planteur_id: selectedChefPlanteur.id,
            },
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Erreur lors de la création du planteur');
        }

        const result = await response.json();
        onAssignComplete({
          updated_count: result.updated_count,
          assigned_ids: result.assigned_ids,
          planteur_id: result.planteur_id,
          planteur_name: result.planteur_name,
          planteur_created: true,
        });
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    mode,
    selectedPlanteur,
    newPlanteurName,
    newPlanteurCode,
    selectedChefPlanteur,
    parcelles,
    validateForm,
    onAssignComplete,
    onClose,
  ]);

  // Handle close
  const handleClose = useCallback(() => {
    if (!isSubmitting) {
      onClose();
    }
  }, [isSubmitting, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Assigner les parcelles
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {parcelles.length} parcelle{parcelles.length > 1 ? 's' : ''} • {formatHectares(totalSurface)} ha
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Parcelles Summary */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              Parcelles à assigner
            </h3>
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {parcelles.map((parcelle) => (
                <ParcelleSummaryItem key={parcelle.id} parcelle={parcelle} />
              ))}
            </div>
          </div>

          {/* Mode Selector */}
          <div className="flex border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setMode('existing')}
              className={cn(
                'flex-1 px-4 py-2.5 text-sm font-medium flex items-center justify-center gap-2 transition-colors',
                mode === 'existing'
                  ? 'bg-primary-50 text-primary-700 border-r border-primary-200'
                  : 'text-gray-600 hover:bg-gray-50 border-r border-gray-200'
              )}
            >
              <User className="h-4 w-4" />
              Planteur existant
            </button>
            <button
              onClick={() => setMode('new')}
              className={cn(
                'flex-1 px-4 py-2.5 text-sm font-medium flex items-center justify-center gap-2 transition-colors',
                mode === 'new'
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-50'
              )}
            >
              <UserPlus className="h-4 w-4" />
              Nouveau planteur
            </button>
          </div>

          {/* Mode-specific Form */}
          {mode === 'existing' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Planteur <span className="text-red-500">*</span>
              </label>
              <PlanteurDropdown
                value={selectedPlanteur}
                onChange={setSelectedPlanteur}
                disabled={isSubmitting}
              />
              {validationErrors.planteur && (
                <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
                  <AlertCircle className="h-3 w-3" />
                  {validationErrors.planteur}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Nom du planteur <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newPlanteurName}
                  onChange={(e) => setNewPlanteurName(e.target.value)}
                  placeholder="Ex: Konan Yao"
                  disabled={isSubmitting}
                  className={cn(
                    'w-full px-3 py-2.5 rounded-lg border text-sm transition-colors',
                    'focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500',
                    validationErrors.name ? 'border-red-300' : 'border-gray-200'
                  )}
                />
                {validationErrors.name && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
                    <AlertCircle className="h-3 w-3" />
                    {validationErrors.name}
                  </p>
                )}
              </div>

              {/* Code (optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Code <span className="text-gray-400 font-normal">(optionnel)</span>
                </label>
                <input
                  type="text"
                  value={newPlanteurCode}
                  onChange={(e) => setNewPlanteurCode(e.target.value)}
                  placeholder="Auto-généré si vide"
                  disabled={isSubmitting}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                />
              </div>

              {/* Chef Planteur */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Chef planteur <span className="text-red-500">*</span>
                </label>
                <ChefPlanteurDropdown
                  value={selectedChefPlanteur}
                  onChange={setSelectedChefPlanteur}
                  disabled={isSubmitting}
                  error={validationErrors.chef_planteur}
                />
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200">
              <p className="text-sm text-red-700 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Assignation...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Assigner
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AssignParcellesModal;
