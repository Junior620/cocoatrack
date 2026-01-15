'use client';

// CocoaTrack V2 - Global Search Component
// Search across planteurs, deliveries, and more

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, Users, Truck, FileText, User, Command } from 'lucide-react';

interface SearchResult {
  id: string;
  type: 'planteur' | 'chef_planteur' | 'delivery' | 'invoice';
  title: string;
  subtitle: string;
  href: string;
}

const typeConfig = {
  planteur: { icon: <User className="h-4 w-4" />, label: 'Planteur', color: 'text-blue-600 bg-blue-50' },
  chef_planteur: { icon: <Users className="h-4 w-4" />, label: 'Chef Planteur', color: 'text-purple-600 bg-purple-50' },
  delivery: { icon: <Truck className="h-4 w-4" />, label: 'Livraison', color: 'text-emerald-600 bg-emerald-50' },
  invoice: { icon: <FileText className="h-4 w-4" />, label: 'Facture', color: 'text-amber-600 bg-amber-50' },
};

export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Keyboard shortcut to open search (Cmd/Ctrl + K)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Mock search function - replace with actual API call
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 200));

    // Mock results - replace with actual search
    const mockResults: SearchResult[] = [
      // These would come from your API
    ];

    setResults(mockResults);
    setIsLoading(false);
    setSelectedIndex(0);
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, performSearch]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      router.push(results[selectedIndex].href);
      setIsOpen(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setQuery('');
    setResults([]);
  };

  return (
    <>
      {/* Search trigger button */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors w-full max-w-xs"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Rechercher...</span>
        <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium text-gray-400 bg-white rounded border border-gray-200">
          <Command className="h-3 w-3" />K
        </kbd>
      </button>

      {/* Search modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal */}
          <div className="relative min-h-screen flex items-start justify-center pt-[15vh] px-4">
            <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden">
              {/* Search input */}
              <div className="flex items-center gap-3 px-4 border-b border-gray-200">
                <Search className="h-5 w-5 text-gray-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Rechercher planteurs, livraisons, factures..."
                  className="flex-1 py-4 text-base text-gray-900 placeholder-gray-400 bg-transparent border-0 focus:outline-none focus:ring-0"
                />
                {query && (
                  <button
                    onClick={() => setQuery('')}
                    className="p-1 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Results */}
              <div className="max-h-96 overflow-y-auto">
                {isLoading ? (
                  <div className="p-8 text-center">
                    <div className="inline-block h-6 w-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                    <p className="mt-2 text-sm text-gray-500">Recherche en cours...</p>
                  </div>
                ) : results.length > 0 ? (
                  <div className="p-2">
                    {results.map((result, index) => {
                      const config = typeConfig[result.type];
                      return (
                        <button
                          key={result.id}
                          onClick={() => {
                            router.push(result.href);
                            handleClose();
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-colors ${
                            index === selectedIndex ? 'bg-gray-100' : 'hover:bg-gray-50'
                          }`}
                        >
                          <span className={`p-2 rounded-lg ${config.color}`}>
                            {config.icon}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {result.title}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {result.subtitle}
                            </p>
                          </div>
                          <span className="text-xs text-gray-400">
                            {config.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : query ? (
                  <div className="p-8 text-center">
                    <Search className="mx-auto h-8 w-8 text-gray-300" />
                    <p className="mt-2 text-sm text-gray-500">
                      Aucun résultat pour "{query}"
                    </p>
                  </div>
                ) : (
                  <div className="p-6">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                      Raccourcis
                    </p>
                    <div className="space-y-2">
                      {Object.entries(typeConfig).map(([type, config]) => (
                        <div key={type} className="flex items-center gap-3 text-sm text-gray-600">
                          <span className={`p-1.5 rounded ${config.color}`}>
                            {config.icon}
                          </span>
                          <span>Tapez pour rechercher des {config.label.toLowerCase()}s</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-white rounded border border-gray-200">↑</kbd>
                    <kbd className="px-1.5 py-0.5 bg-white rounded border border-gray-200">↓</kbd>
                    <span>naviguer</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-white rounded border border-gray-200">↵</kbd>
                    <span>sélectionner</span>
                  </span>
                </div>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-white rounded border border-gray-200">esc</kbd>
                  <span>fermer</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
