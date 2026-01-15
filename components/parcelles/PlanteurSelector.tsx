'use client';

// CocoaTrack V2 - PlanteurSelector Component
// Searchable dropdown selector for planteurs
// Used in ParcelleForm and other forms that need to select a planteur
//
// Features:
// - Search by name, code, or phone
// - Debounced search input
// - Shows planteur name and code
// - Loading state
// - Error handling
// - Required field validation

import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, X, ChevronDown, User, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { planteursApi } from '@/lib/api/planteurs';

/**
 * Minimal planteur info for display in selector
 */
export interface PlanteurOption {
  id: string;
  name: string;
  code: string;
  phone?: string | null;
  village?: string | null;
}

/**
 * Props for PlanteurSelector component
 */
export interface PlanteurSelectorProps {
  /** Currently selected planteur ID */
  value?: string;
  /** Callback when selection changes */
  onChange: (planteurId: string | null, planteur: PlanteurOption | null) => void;
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
 * PlanteurSelector - Searchable dropdown for selecting a planteur
 *
 * Provides a user-friendly way to search and select a planteur from the database.
 * Supports keyboard navigation and shows planteur details in the dropdown.
 */
export function PlanteurSelector({
  value,
  onChange,
  required = false,
  disabled = false,
  placeholder = 'Rechercher un planteur...',
  error,
  className,
  label,
  helpText,
}: PlanteurSelectorProps) {
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
            village: planteur.localite || null,
          });
        }
      } catch (err) {
        console.error('Failed to load selected planteur:', err);
      }
    };

    loadSelectedPlanteur();
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // Search planteurs with debounce
  useEffect(() => {
    const searchPlanteurs = async () => {
      if (!searchQuery.trim()) {
        // Load initial options when no search query
        setLoading(true);
        try {
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
        } catch (err) {
          console.error('Failed to load planteurs:', err);
        } finally {
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
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
      } catch (err) {
        console.error('Failed to search planteurs:', err);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(searchPlanteurs, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
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

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setHighlightedIndex((prev) => Math.min(prev + 1, options.length - 1));
          break;
        case 'ArrowUp':
          event.preventDefault();
          setHighlightedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          event.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < options.length) {
            handleSelect(options[highlightedIndex]);
          }
          break;
        case 'Escape':
          event.preventDefault();
          setIsOpen(false);
          setSearchQuery('');
          setHighlightedIndex(-1);
          break;
      }
    },
    [isOpen, options, highlightedIndex]
  );

  // Handle selection
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
                {selectedPlanteur.village && ` • ${selectedPlanteur.village}`}
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

      {/* Dropdown */}
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
                placeholder="Rechercher par nom, code ou téléphone..."
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
            {options.length === 0 ? (
              <li className="px-4 py-8 text-center">
                {loading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-6 w-6 text-gray-400 animate-spin" />
                    <span className="text-sm text-gray-500">Chargement...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <User className="h-6 w-6 text-gray-300" />
                    <span className="text-sm text-gray-500">
                      {searchQuery ? 'Aucun planteur trouvé' : 'Aucun planteur disponible'}
                    </span>
                  </div>
                )}
              </li>
            ) : (
              options.map((planteur, index) => (
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
                        {planteur.village && ` • ${planteur.village}`}
                      </p>
                    </div>
                    {selectedPlanteur?.id === planteur.id && (
                      <div className="flex-shrink-0">
                        <div className="h-2 w-2 rounded-full bg-primary-500" />
                      </div>
                    )}
                  </div>
                </li>
              ))
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

export default PlanteurSelector;
