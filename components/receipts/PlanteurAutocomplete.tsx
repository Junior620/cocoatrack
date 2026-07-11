'use client';

// CocoaTrack V2 - PlanteurAutocomplete Component
// Autocomplete component for selecting or creating planteurs in receipt import
//
// Features:
// - Search by name with debounced input
// - Display suggestions list
// - "Create new planteur" option when no match found
// - Filter by cooperative
// - Handle selection callback
// - Requirements: 6.1, 6.2, 6.3, 6.4

import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, X, ChevronDown, User, Loader2, AlertCircle, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { planteursApi } from '@/lib/api/planteurs';

/**
 * Minimal planteur info for display in autocomplete
 */
export interface PlanteurOption {
  id: string;
  name: string;
  code: string;
  phone?: string | null;
  cooperative_id: string;
  cooperative_name?: string | null;
}

/**
 * Props for PlanteurAutocomplete component
 */
export interface PlanteurAutocompleteProps {
  /** Currently selected planteur ID */
  value?: string;
  /** Callback when selection changes */
  onChange: (planteurId: string | null, planteur: PlanteurOption | null) => void;
  /** Callback when "Create new" is clicked */
  onCreateNew?: (name: string) => void;
  /** Cooperative ID to filter by */
  cooperativeId?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Error message to display */
  error?: string;
  /** Additional CSS classes */
  className?: string;
  /** Label for the field */
  label?: string;
  /** Help text below the field */
  helpText?: string;
}

/**
 * PlanteurAutocomplete - Searchable autocomplete for selecting or creating a planteur
 *
 * Provides a user-friendly way to search and select a planteur from the database,
 * with the option to create a new planteur if no match is found.
 */
export function PlanteurAutocomplete({
  value,
  onChange,
  onCreateNew,
  cooperativeId,
  required = false,
  disabled = false,
  placeholder = 'Rechercher un planteur...',
  error,
  className,
  label,
  helpText,
}: PlanteurAutocompleteProps) {
  // State
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [options, setOptions] = useState<PlanteurOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlanteur, setSelectedPlanteur] = useState<PlanteurOption | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Load selected planteur on mount or when value changes
  useEffect(() => {
    const loadSelectedPlanteur = async () => {
      if (!value) {
        setSelectedPlanteur(null);
        return;
      }

      // Check if we already have this planteur in options
      const existing = options.find((p) => p.id === value);
      if (existing) {
        setSelectedPlanteur(existing);
        return;
      }

      // Fetch the planteur
      try {
        const planteur = await planteursApi.get(value);
        if (planteur) {
          setSelectedPlanteur({
            id: planteur.id,
            name: planteur.name,
            code: planteur.code,
            phone: planteur.phone,
            cooperative_id: planteur.cooperative_id,
          });
        }
      } catch (err) {
        console.error('Failed to load selected planteur:', err);
      }
    };

    loadSelectedPlanteur();
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // Search planteurs with debounce (Requirement 6.1)
  useEffect(() => {
    const searchPlanteurs = async () => {
      if (!searchQuery.trim()) {
        setOptions([]);
        return;
      }

      setLoading(true);
      try {
        // Search all active planteurs, no cooperative filter to ensure all results are visible
        const params = new URLSearchParams({ search: searchQuery, limit: '20' });

        const res = await fetch(`/api/planteurs?${params}`);
        const result: PlanteurOption[] = res.ok ? await res.json() : [];

        setOptions(result.map((p: PlanteurOption & { cooperative?: { name: string } | null }) => ({
          id: p.id,
          name: p.name,
          code: p.code,
          phone: p.phone,
          cooperative_id: p.cooperative_id,
          cooperative_name: p.cooperative?.name ?? null,
        })));
      } catch (err) {
        console.error('Failed to search planteurs:', err);
        setOptions([]);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(searchPlanteurs, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, cooperativeId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!isOpen) {
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
          event.preventDefault();
          setIsOpen(true);
        }
        return;
      }

      const totalOptions = options.length + (searchQuery.trim() && onCreateNew ? 1 : 0);

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setHighlightedIndex((prev) => Math.min(prev + 1, totalOptions - 1));
          break;
        case 'ArrowUp':
          event.preventDefault();
          setHighlightedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          event.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < options.length) {
            handleSelect(options[highlightedIndex]);
          } else if (highlightedIndex === options.length && searchQuery.trim() && onCreateNew) {
            handleCreateNew();
          }
          break;
        case 'Escape':
          event.preventDefault();
          setIsOpen(false);
          setHighlightedIndex(-1);
          break;
      }
    },
    [isOpen, options, highlightedIndex, searchQuery, onCreateNew]
  );

  // Handle selection (Requirement 6.3)
  const handleSelect = useCallback(
    (planteur: PlanteurOption) => {
      setSelectedPlanteur(planteur);
      onChange(planteur.id, planteur);
      setIsOpen(false);
      setSearchQuery('');
      setHighlightedIndex(-1);
    },
    [onChange]
  );

  // Handle create new (Requirement 6.4)
  const handleCreateNew = useCallback(() => {
    if (onCreateNew && searchQuery.trim()) {
      onCreateNew(searchQuery.trim());
      setIsOpen(false);
      setSearchQuery('');
      setHighlightedIndex(-1);
    }
  }, [onCreateNew, searchQuery]);

  // Handle clear
  const handleClear = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      setSelectedPlanteur(null);
      onChange(null, null);
      setSearchQuery('');
    },
    [onChange]
  );

  // Open dropdown and focus input
  const handleOpen = useCallback(() => {
    if (!disabled) {
      setIsOpen(true);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [disabled]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightedIndex] as HTMLElement;
      if (item) {
        item.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  return (
    <div className={cn('relative', className)} ref={containerRef}>
      {/* Label */}
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* Selector Button */}
      <div
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls="planteur-listbox"
        tabIndex={disabled ? -1 : 0}
        onClick={handleOpen}
        onKeyDown={handleKeyDown}
        className={cn(
          'relative w-full rounded-lg border bg-white px-3 py-2.5 text-left cursor-pointer transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500',
          disabled && 'bg-gray-100 cursor-not-allowed opacity-60',
          error
            ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
            : 'border-gray-200 hover:border-gray-300'
        )}
      >
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
          {selectedPlanteur ? (
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-gray-900 truncate block">
                {selectedPlanteur.name}
              </span>
              <span className="text-xs text-gray-500 truncate block">
                {selectedPlanteur.code}
              </span>
            </div>
          ) : (
            <span className="flex-1 text-sm text-gray-400">{placeholder}</span>
          )}
          <div className="flex items-center gap-1 flex-shrink-0">
            {selectedPlanteur && !disabled && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Effacer la sélection"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <ChevronDown
              className={cn(
                'h-4 w-4 text-gray-400 transition-transform',
                isOpen && 'rotate-180'
              )}
            />
          </div>
        </div>
      </div>

      {/* Dropdown (Requirement 6.2) */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
          {/* Search Input */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Rechercher par nom..."
                className="w-full rounded-md border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              {loading && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 animate-spin" />
              )}
            </div>
          </div>

          {/* Options List */}
          <ul
            ref={listRef}
            id="planteur-listbox"
            role="listbox"
            className="max-h-60 overflow-y-auto py-1"
          >
            {!searchQuery.trim() ? (
              <li className="px-4 py-8 text-center">
                <div className="flex flex-col items-center gap-2">
                  <Search className="h-6 w-6 text-gray-300" />
                  <span className="text-sm text-gray-500">
                    Commencez à taper pour rechercher
                  </span>
                </div>
              </li>
            ) : loading ? (
              <li className="px-4 py-8 text-center">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-6 w-6 text-gray-400 animate-spin" />
                  <span className="text-sm text-gray-500">Recherche...</span>
                </div>
              </li>
            ) : options.length === 0 ? (
              <>
                <li className="px-4 py-4 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <User className="h-6 w-6 text-gray-300" />
                    <span className="text-sm text-gray-500">Aucun planteur trouvé</span>
                  </div>
                </li>
                {/* Create new option (Requirement 6.4) */}
                {onCreateNew && (
                  <li
                    role="option"
                    onClick={handleCreateNew}
                    onMouseEnter={() => setHighlightedIndex(0)}
                    className={cn(
                      'mx-2 mb-2 px-3 py-2 cursor-pointer transition-colors rounded-md border-2 border-dashed',
                      highlightedIndex === 0
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
                        <Plus className="h-4 w-4 text-primary-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-primary-600">
                          Créer nouveau planteur
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          &quot;{searchQuery}&quot;
                        </p>
                      </div>
                    </div>
                  </li>
                )}
              </>
            ) : (
              <>
                {options.map((planteur, index) => (
                  <li
                    key={planteur.id}
                    role="option"
                    aria-selected={selectedPlanteur?.id === planteur.id}
                    onClick={() => handleSelect(planteur)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={cn(
                      'px-3 py-2 cursor-pointer transition-colors',
                      highlightedIndex === index && 'bg-primary-50',
                      selectedPlanteur?.id === planteur.id && 'bg-primary-100'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                        <User className="h-4 w-4 text-gray-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {planteur.name}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {planteur.code}
                          {planteur.phone && ` • ${planteur.phone}`}
                          {planteur.cooperative_name && ` • ${planteur.cooperative_name}`}
                        </p>
                      </div>
                      {selectedPlanteur?.id === planteur.id && (
                        <div className="flex-shrink-0">
                          <div className="h-2 w-2 rounded-full bg-primary-500" />
                        </div>
                      )}
                    </div>
                  </li>
                ))}
                {/* Create new option at bottom (Requirement 6.4) */}
                {onCreateNew && (
                  <li
                    role="option"
                    onClick={handleCreateNew}
                    onMouseEnter={() => setHighlightedIndex(options.length)}
                    className={cn(
                      'mx-2 mt-1 mb-2 px-3 py-2 cursor-pointer transition-colors rounded-md border-2 border-dashed',
                      highlightedIndex === options.length
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
                        <Plus className="h-4 w-4 text-primary-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-primary-600">
                          Créer nouveau planteur
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          &quot;{searchQuery}&quot;
                        </p>
                      </div>
                    </div>
                  </li>
                )}
              </>
            )}
          </ul>
        </div>
      )}

      {/* Help Text */}
      {helpText && !error && (
        <p className="mt-1 text-xs text-gray-500">{helpText}</p>
      )}

      {/* Error Message */}
      {error && (
        <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  );
}

export default PlanteurAutocomplete;
