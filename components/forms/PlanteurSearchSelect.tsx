'use client';

/**
 * PlanteurSearchSelect Component
 * 
 * Searchable select component for planteurs with autocomplete
 * Replaces standard <select> to handle large lists efficiently
 */

import { useEffect, useState, useRef, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Planteur {
  id: string;
  name: string;
  code: string;
  cooperative_id: string | null;
  chef_planteur_id: string | null;
}

interface PlanteurSearchSelectProps {
  value: string;
  onChange: (value: string) => void;
  cooperativeId?: string;
  chefPlanteurId?: string;
  disabled?: boolean;
  placeholder?: string;
}

export default function PlanteurSearchSelect({
  value,
  onChange,
  cooperativeId,
  chefPlanteurId,
  disabled = false,
  placeholder = 'Rechercher un planteur...',
}: PlanteurSearchSelectProps) {
  const [planteurs, setPlanteurs] = useState<Planteur[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch planteurs based on search term (server-side search)
  useEffect(() => {
    const fetchPlanteurs = async () => {
      // Clear previous timeout
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      // If no search term, load first 100 planteurs
      if (!searchTerm.trim()) {
        setIsSearching(true);
        const supabase = createClient();

        let query = supabase
          .from('planteurs')
          .select('id, name, code, cooperative_id, chef_planteur_id')
          .eq('is_active', true)
          .order('name')
          .limit(100);

        if (cooperativeId) {
          query = query.eq('cooperative_id', cooperativeId);
        }

        if (chefPlanteurId) {
          query = query.eq('chef_planteur_id', chefPlanteurId);
        }

        const { data, error } = await query;

        if (!error && data) {
          setPlanteurs(data);
        }
        setIsSearching(false);
        return;
      }

      // Debounce search
      searchTimeoutRef.current = setTimeout(async () => {
        setIsSearching(true);
        const supabase = createClient();

        // Search using ilike for case-insensitive partial match
        let query = supabase
          .from('planteurs')
          .select('id, name, code, cooperative_id, chef_planteur_id')
          .eq('is_active', true)
          .or(`name.ilike.%${searchTerm}%,code.ilike.%${searchTerm}%`)
          .order('name')
          .limit(100);

        if (cooperativeId) {
          query = query.eq('cooperative_id', cooperativeId);
        }

        if (chefPlanteurId) {
          query = query.eq('chef_planteur_id', chefPlanteurId);
        }

        const { data, error } = await query;

        if (!error && data) {
          setPlanteurs(data);
        }
        setIsSearching(false);
      }, 300); // Wait 300ms after user stops typing
    };

    fetchPlanteurs();

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm, cooperativeId, chefPlanteurId]);

  // Normalize string for search (remove accents, lowercase)
  const normalizeString = (str: string): string => {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''); // Remove diacritics
  };

  // No need for client-side filtering anymore since we do server-side search
  const filteredPlanteurs = planteurs;

  // Get selected planteur
  const selectedPlanteur = planteurs.find((p) => p.id === value);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredPlanteurs.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredPlanteurs[highlightedIndex]) {
          handleSelect(filteredPlanteurs[highlightedIndex].id);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  // Handle selection
  const handleSelect = (planteurId: string) => {
    onChange(planteurId);
    setIsOpen(false);
    setSearchTerm('');
    setHighlightedIndex(0);
  };

  // Handle clear
  const handleClear = () => {
    onChange('');
    setSearchTerm('');
    setHighlightedIndex(0);
    inputRef.current?.focus();
  };

  // Reset highlighted index when filtered list changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [planteurs]);

  return (
    <div ref={wrapperRef} className="relative">
      {/* Input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? searchTerm : selectedPlanteur ? `${selectedPlanteur.name} (${selectedPlanteur.code})` : ''}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isSearching}
          placeholder={isSearching ? 'Recherche...' : placeholder}
          className="block w-full rounded-md border border-gray-300 py-2 pl-3 pr-10 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        />

        {/* Icons */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-2">
          {selectedPlanteur && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              <XIcon className="h-4 w-4" />
            </button>
          )}
          <ChevronDownIcon
            className={`h-5 w-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
          {isSearching ? (
            <div className="px-3 py-2 text-sm text-gray-500">Recherche en cours...</div>
          ) : filteredPlanteurs.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">
              {searchTerm ? (
                <>
                  Aucun planteur trouvé pour "{searchTerm}"
                  <div className="mt-1 text-xs text-gray-400">
                    Essayez un autre terme de recherche
                  </div>
                </>
              ) : (
                'Tapez pour rechercher un planteur'
              )}
            </div>
          ) : (
            <>
              {searchTerm && (
                <div className="px-3 py-1 text-xs text-gray-400 border-b border-gray-100">
                  {filteredPlanteurs.length} résultat(s) trouvé(s)
                </div>
              )}
              {filteredPlanteurs.map((planteur, index) => (
                <button
                  key={planteur.id}
                  type="button"
                  onClick={() => handleSelect(planteur.id)}
                  className={`block w-full px-3 py-2 text-left text-sm ${
                    index === highlightedIndex
                      ? 'bg-primary-100 text-primary-900'
                      : value === planteur.id
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-900 hover:bg-gray-100'
                  }`}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  <div className="font-medium">{planteur.name}</div>
                  <div className="text-xs text-gray-500">{planteur.code}</div>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Icons
function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
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
