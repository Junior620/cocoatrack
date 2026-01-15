'use client';

// CocoaTrack V2 - Parcelles Map Page
// Full-height interactive map view with sidebar filters and parcelle list
// Task 5.2: Parcelles Map Page
// Task 5.2 (Bbox filtering): Bbox filtering as map moves with debouncing

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { 
  ArrowLeft, 
  Search, 
  Filter, 
  ChevronDown, 
  ChevronUp,
  MapPin,
  Layers,
  X,
  Loader2
} from 'lucide-react';

import { ProtectedRoute } from '@/components/auth';
import { useAuth } from '@/lib/auth';
import { parcellesApi, getDistinctVillages, getImportFileOptions, type ImportFileOption } from '@/lib/api/parcelles';
import type { ParcelleWithPlanteur, ParcelleFilters, ConformityStatus, Certification, ParcelleSource, Parcelle } from '@/types/parcelles';
import { 
  CONFORMITY_STATUS_VALUES, 
  CONFORMITY_STATUS_LABELS, 
  CONFORMITY_STATUS_COLORS,
  CERTIFICATIONS_WHITELIST, 
  CERTIFICATION_LABELS,
  PARCELLE_SOURCE_VALUES,
  PARCELLE_SOURCE_LABELS
} from '@/types/parcelles';
import type { PaginatedResult } from '@/types';
import { ParcelleMap } from '@/components/parcelles/ParcelleMap';

// Debounce delay for bbox changes (ms)
const BBOX_DEBOUNCE_DELAY = 300;

export default function ParcellesMapPage() {
  return (
    <ProtectedRoute requiredPermission="parcelles:read">
      <ParcellesMapContent />
    </ProtectedRoute>
  );
}

function ParcellesMapContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  // State
  const [data, setData] = useState<PaginatedResult<ParcelleWithPlanteur> | null>(null);
  const [loading, setLoading] = useState(true);
  const [bboxLoading, setBboxLoading] = useState(false); // Separate loading state for bbox changes
  const [error, setError] = useState<string | null>(null);
  const [selectedParcelleId, setSelectedParcelleId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [currentBbox, setCurrentBbox] = useState<[number, number, number, number] | undefined>(undefined);
  const [debouncedBbox, setDebouncedBbox] = useState<[number, number, number, number] | undefined>(undefined);
  const [mapZoom, setMapZoom] = useState<number>(8);
  
  // Ref for debounce timer
  const bboxDebounceRef = useRef<NodeJS.Timeout | null>(null);
  
  // Filter options state
  const [villages, setVillages] = useState<string[]>([]);
  const [importFiles, setImportFiles] = useState<ImportFileOption[]>([]);
  const [filterOptionsLoading, setFilterOptionsLoading] = useState(true);

  // Parse filters from URL
  const filters: ParcelleFilters = useMemo(() => ({
    page: 1,
    pageSize: 100, // Load more for map view
    search: searchParams.get('search') || undefined,
    conformity_status: (searchParams.get('conformity_status') as ConformityStatus) || undefined,
    certification: (searchParams.get('certification') as Certification) || undefined,
    village: searchParams.get('village') || undefined,
    source: (searchParams.get('source') as ParcelleSource) || undefined,
    import_file_id: searchParams.get('import_file_id') || undefined,
    is_active: true,
    // Use debounced bbox to prevent excessive API calls during map movement
    bbox: debouncedBbox ? `${debouncedBbox[0]},${debouncedBbox[1]},${debouncedBbox[2]},${debouncedBbox[3]}` : undefined,
    zoom: mapZoom,
  }), [searchParams, debouncedBbox, mapZoom]);

  // Serialize URL filters for dependency comparison (excluding bbox)
  const urlFiltersKey = useMemo(() => {
    return JSON.stringify({
      search: searchParams.get('search'),
      conformity_status: searchParams.get('conformity_status'),
      certification: searchParams.get('certification'),
      village: searchParams.get('village'),
      source: searchParams.get('source'),
      import_file_id: searchParams.get('import_file_id'),
    });
  }, [searchParams]);

  // Track last fetched bbox to avoid duplicate fetches
  const lastFetchedBboxRef = useRef<string | undefined>(undefined);
  const lastFetchedUrlFiltersRef = useRef<string | undefined>(undefined);

  // Fetch parcelles - use ref to avoid recreating function
  const fetchParcellesRef = useRef<((isBboxChange?: boolean) => Promise<void>) | undefined>(undefined);
  fetchParcellesRef.current = async (isBboxChange = false) => {
    // Use different loading state for bbox changes to avoid full page reload feel
    if (isBboxChange) {
      setBboxLoading(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const result = await parcellesApi.list(filters);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec du chargement des parcelles');
    } finally {
      setLoading(false);
      setBboxLoading(false);
    }
  };

  const fetchParcelles = useCallback((isBboxChange = false) => {
    return fetchParcellesRef.current?.(isBboxChange);
  }, []);

  // Fetch filter options (villages and import files)
  const fetchFilterOptions = useCallback(async () => {
    setFilterOptionsLoading(true);
    try {
      const [villageList, importFileList] = await Promise.all([
        getDistinctVillages(),
        getImportFileOptions(),
      ]);
      setVillages(villageList);
      setImportFiles(importFileList);
    } catch (err) {
      console.error('Failed to fetch filter options:', err);
    } finally {
      setFilterOptionsLoading(false);
    }
  }, []);

  // Effect for URL filter changes (not bbox)
  useEffect(() => {
    // Skip if same as last fetch
    if (urlFiltersKey === lastFetchedUrlFiltersRef.current) {
      return;
    }
    lastFetchedUrlFiltersRef.current = urlFiltersKey;
    fetchParcelles(false);
  }, [urlFiltersKey, fetchParcelles]);

  // Separate effect for bbox changes
  useEffect(() => {
    const currentBboxStr = filters.bbox;
    
    // Skip if no bbox or same as last fetch
    if (!currentBboxStr || currentBboxStr === lastFetchedBboxRef.current) {
      return;
    }
    
    lastFetchedBboxRef.current = currentBboxStr;
    fetchParcelles(true);
  }, [filters.bbox, fetchParcelles]);

  useEffect(() => {
    fetchFilterOptions();
  }, [fetchFilterOptions]);

  // Debounce bbox changes to prevent excessive API calls during map movement
  useEffect(() => {
    // Clear any existing debounce timer
    if (bboxDebounceRef.current) {
      clearTimeout(bboxDebounceRef.current);
    }
    
    // Set new debounce timer
    bboxDebounceRef.current = setTimeout(() => {
      setDebouncedBbox(currentBbox);
    }, BBOX_DEBOUNCE_DELAY);
    
    // Cleanup on unmount or when currentBbox changes
    return () => {
      if (bboxDebounceRef.current) {
        clearTimeout(bboxDebounceRef.current);
      }
    };
  }, [currentBbox]);

  // Update URL with new filters
  const updateFilters = (newFilters: Partial<ParcelleFilters>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value !== undefined && value !== '' && value !== null) {
        params.set(key, String(value));
      } else {
        params.delete(key);
      }
    });
    router.push(`/parcelles/map?${params.toString()}`);
  };

  // Handle search
  const handleSearch = (query: string) => {
    updateFilters({ search: query });
  };

  // Handle bbox change from map (with zoom level)
  const handleBboxChange = useCallback((bbox: [number, number, number, number], zoom?: number) => {
    setCurrentBbox(bbox);
    if (zoom !== undefined) {
      setMapZoom(zoom);
    }
  }, []);

  // Handle parcelle selection from map
  const handleParcelleSelect = useCallback((parcelle: Parcelle) => {
    setSelectedParcelleId(parcelle.id);
    // Scroll to the parcelle in the sidebar list
    const element = document.getElementById(`parcelle-item-${parcelle.id}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  // Handle parcelle click from sidebar list
  const handleListItemClick = (parcelle: ParcelleWithPlanteur) => {
    setSelectedParcelleId(parcelle.id);
  };

  // Navigate to parcelle detail
  const handleViewDetail = (id: string) => {
    router.push(`/parcelles/${id}`);
  };

  // Clear all filters
  const clearFilters = () => {
    router.push('/parcelles/map');
  };

  // Check if any filters are active
  const hasActiveFilters = !!(
    searchParams.get('search') ||
    searchParams.get('conformity_status') ||
    searchParams.get('certification') ||
    searchParams.get('village') ||
    searchParams.get('source') ||
    searchParams.get('import_file_id')
  );

  // Get selected parcelle
  const selectedParcelle = useMemo(() => {
    if (!selectedParcelleId || !data?.data) return null;
    return data.data.find(p => p.id === selectedParcelleId) || null;
  }, [selectedParcelleId, data?.data]);

  // Convert parcelles to map format (Parcelle type without planteur requirement)
  const mapParcelles = useMemo(() => {
    return data?.data || [];
  }, [data?.data]);

  // Full-height map page: use negative margins to counteract the main content padding
  // Header is h-16 (4rem), main content has p-4 sm:p-6 lg:p-8 padding
  // We use -m-4 sm:-m-6 lg:-m-8 to extend to edges and calc height accordingly
  return (
    <div className="-m-4 sm:-m-6 lg:-m-8 flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Sidebar */}
      <div 
        className={`
          flex flex-col bg-white border-r border-gray-200 transition-all duration-300
          ${sidebarOpen ? 'w-80' : 'w-0'}
        `}
      >
        {sidebarOpen && (
          <>
            {/* Sidebar Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Link
                  href="/parcelles"
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                  title="Retour à la liste"
                >
                  <ArrowLeft className="h-5 w-5 text-gray-600" />
                </Link>
                <h2 className="font-semibold text-gray-900">Carte des Parcelles</h2>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                title="Fermer le panneau"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Search */}
            <div className="p-4 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  defaultValue={searchParams.get('search') || ''}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </div>
            </div>

            {/* Filters */}
            <div className="border-b border-gray-100">
              <button
                onClick={() => setFiltersExpanded(!filtersExpanded)}
                className="flex items-center justify-between w-full p-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  <span>Filtres</span>
                  {hasActiveFilters && (
                    <span className="px-1.5 py-0.5 text-xs bg-primary-100 text-primary-700 rounded-full">
                      Actifs
                    </span>
                  )}
                </div>
                {filtersExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>

              {filtersExpanded && (
                <div className="px-4 pb-4 space-y-3">
                  {/* Conformity Status Filter */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Statut de conformité
                    </label>
                    <select
                      value={searchParams.get('conformity_status') || ''}
                      onChange={(e) => updateFilters({ 
                        conformity_status: e.target.value as ConformityStatus || undefined 
                      })}
                      className="w-full rounded-lg border border-gray-200 py-2 pl-3 pr-8 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    >
                      <option value="">Tous</option>
                      {CONFORMITY_STATUS_VALUES.map((status) => (
                        <option key={status} value={status}>
                          {CONFORMITY_STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Certification Filter */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Certification
                    </label>
                    <select
                      value={searchParams.get('certification') || ''}
                      onChange={(e) => updateFilters({ 
                        certification: e.target.value as Certification || undefined 
                      })}
                      className="w-full rounded-lg border border-gray-200 py-2 pl-3 pr-8 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    >
                      <option value="">Toutes</option>
                      {CERTIFICATIONS_WHITELIST.map((cert) => (
                        <option key={cert} value={cert}>
                          {CERTIFICATION_LABELS[cert]}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Village Filter */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Village
                    </label>
                    <select
                      value={searchParams.get('village') || ''}
                      onChange={(e) => updateFilters({ 
                        village: e.target.value || undefined 
                      })}
                      disabled={filterOptionsLoading}
                      className="w-full rounded-lg border border-gray-200 py-2 pl-3 pr-8 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50"
                    >
                      <option value="">Tous les villages</option>
                      {villages.map((village) => (
                        <option key={village} value={village}>
                          {village}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Source Filter */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Source
                    </label>
                    <select
                      value={searchParams.get('source') || ''}
                      onChange={(e) => updateFilters({ 
                        source: e.target.value as ParcelleSource || undefined 
                      })}
                      className="w-full rounded-lg border border-gray-200 py-2 pl-3 pr-8 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    >
                      <option value="">Toutes les sources</option>
                      {PARCELLE_SOURCE_VALUES.map((source) => (
                        <option key={source} value={source}>
                          {PARCELLE_SOURCE_LABELS[source]}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Import File Filter */}
                  {importFiles.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Fichier d&apos;import
                      </label>
                      <select
                        value={searchParams.get('import_file_id') || ''}
                        onChange={(e) => updateFilters({ 
                          import_file_id: e.target.value || undefined 
                        })}
                        disabled={filterOptionsLoading}
                        className="w-full rounded-lg border border-gray-200 py-2 pl-3 pr-8 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50"
                      >
                        <option value="">Tous les imports</option>
                        {importFiles.map((file) => (
                          <option key={file.id} value={file.id}>
                            {file.filename} ({file.nb_applied})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Clear Filters Button */}
                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="w-full py-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
                    >
                      Effacer les filtres
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Parcelles List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                </div>
              ) : error ? (
                <div className="p-4 text-sm text-red-600">{error}</div>
              ) : data?.data.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-500">
                  Aucune parcelle trouvée
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {data?.data.map((parcelle) => (
                    <div
                      key={parcelle.id}
                      id={`parcelle-item-${parcelle.id}`}
                      onClick={() => handleListItemClick(parcelle)}
                      className={`
                        p-3 cursor-pointer transition-colors
                        ${selectedParcelleId === parcelle.id 
                          ? 'bg-primary-50 border-l-2 border-primary-500' 
                          : 'hover:bg-gray-50 border-l-2 border-transparent'
                        }
                      `}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span 
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: CONFORMITY_STATUS_COLORS[parcelle.conformity_status] }}
                            />
                            <span className="font-medium text-sm text-gray-900 truncate">
                              {parcelle.code}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5 truncate">
                            {parcelle.planteur?.name || 'Planteur inconnu'}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                            <span>{parcelle.surface_hectares.toFixed(2)} ha</span>
                            {parcelle.village && (
                              <>
                                <span>•</span>
                                <span className="truncate">{parcelle.village}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDetail(parcelle.id);
                          }}
                          className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors flex-shrink-0"
                          title="Voir les détails"
                        >
                          <MapPin className="h-4 w-4 text-gray-400" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sidebar Footer - Stats */}
            {data && (
              <div className="p-3 border-t border-gray-100 bg-gray-50">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{data.total} parcelle{data.total > 1 ? 's' : ''}</span>
                  <span>
                    {data.data.reduce((sum, p) => sum + p.surface_hectares, 0).toFixed(2)} ha total
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Map Container */}
      <div className="flex-1 relative">
        {/* Toggle Sidebar Button (when closed) */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute top-4 left-4 z-[1000] bg-white rounded-lg shadow-md p-2 hover:bg-gray-50 transition-colors"
            title="Ouvrir le panneau"
          >
            <Layers className="h-5 w-5 text-gray-600" />
          </button>
        )}

        {/* Map */}
        <ParcelleMap
          parcelles={mapParcelles}
          selectedId={selectedParcelleId || undefined}
          onSelect={handleParcelleSelect}
          onBboxChange={handleBboxChange}
          showCentroids={false}
          height="100%"
          enableFullscreen={true}
          zoomToSelected={true}
          className="h-full"
        />

        {/* Bbox Loading Indicator */}
        {bboxLoading && (
          <div className="absolute top-4 right-4 z-[1000] bg-white rounded-lg shadow-md px-3 py-2 flex items-center gap-2">
            <Loader2 className="h-4 w-4 text-primary-600 animate-spin" />
            <span className="text-sm text-gray-600">Chargement...</span>
          </div>
        )}

        {/* Selected Parcelle Info Card */}
        {selectedParcelle && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] bg-white rounded-xl shadow-lg p-4 max-w-sm w-full mx-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span 
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: CONFORMITY_STATUS_COLORS[selectedParcelle.conformity_status] }}
                  />
                  <h3 className="font-semibold text-gray-900">{selectedParcelle.code}</h3>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedParcelle.planteur?.name || 'Planteur inconnu'}
                </p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-sm text-gray-500">
                  <span>{selectedParcelle.surface_hectares.toFixed(2)} ha</span>
                  {selectedParcelle.village && (
                    <span>{selectedParcelle.village}</span>
                  )}
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ 
                      backgroundColor: `${CONFORMITY_STATUS_COLORS[selectedParcelle.conformity_status]}20`,
                      color: CONFORMITY_STATUS_COLORS[selectedParcelle.conformity_status]
                    }}
                  >
                    {CONFORMITY_STATUS_LABELS[selectedParcelle.conformity_status]}
                  </span>
                </div>
                {selectedParcelle.certifications.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {selectedParcelle.certifications.map((cert) => (
                      <span 
                        key={cert}
                        className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs"
                      >
                        {CERTIFICATION_LABELS[cert]}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => handleViewDetail(selectedParcelle.id)}
                  className="px-3 py-1.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Détails
                </button>
                <button
                  onClick={() => setSelectedParcelleId(null)}
                  className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
