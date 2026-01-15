'use client';

// CocoaTrack V2 - Parcelles By Planteur Component
// Displays parcelles grouped by planteur in an accordion view
// @see Requirements 4.1, 4.2, 4.4, 4.5

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ChevronDown, 
  ChevronRight, 
  User, 
  AlertTriangle, 
  MapPin,
  Loader2,
  Search
} from 'lucide-react';
import type { PlanteurWithParcelles, Parcelle, ParcelleStats } from '@/types/parcelles';
import { parcellesGroupedApi } from '@/lib/api/parcelles-grouped';

// =============================================================================
// Types
// =============================================================================

export interface ParcellesByPlanteurProps {
  /** Planteur groups with parcelle counts */
  groups: PlanteurWithParcelles[];
  /** Orphan parcelles group (planteur_id IS NULL) */
  orphans: PlanteurWithParcelles | null;
  /** Statistics for all parcelles */
  stats: ParcelleStats;
  /** Loading state */
  loading?: boolean;
  /** Callback when assignment is requested for orphan parcelles */
  onAssignRequest?: (parcelleIds: string[]) => void;
  /** Empty state message */
  emptyMessage?: string;
}

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
 * Skeleton loader for accordion items
 */
function AccordionSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(5)].map((_, i) => (
        <div 
          key={i} 
          className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-gray-200 rounded-full" />
              <div>
                <div className="h-4 w-32 bg-gray-200 rounded mb-2" />
                <div className="h-3 w-24 bg-gray-100 rounded" />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-4 w-20 bg-gray-100 rounded" />
              <div className="h-4 w-4 bg-gray-200 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Parcelle row in expanded accordion
 */
function ParcelleRow({ 
  parcelle, 
  isOrphan,
  isSelected,
  onSelect,
  onAssign,
}: { 
  parcelle: Parcelle;
  isOrphan: boolean;
  isSelected?: boolean;
  onSelect?: (id: string, selected: boolean) => void;
  onAssign?: (id: string) => void;
}) {
  const router = useRouter();

  const handleRowClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on checkbox or button
    if ((e.target as HTMLElement).closest('input, button')) return;
    router.push(`/parcelles/${parcelle.id}`);
  };

  return (
    <div 
      className="flex items-center justify-between py-3 px-4 hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-100 last:border-b-0"
      onClick={handleRowClick}
    >
      <div className="flex items-center gap-3">
        {isOrphan && onSelect && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelect(parcelle.id, e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            onClick={(e) => e.stopPropagation()}
          />
        )}
        <div>
          <div className="font-medium text-gray-900">
            {parcelle.code || 'Sans code'}
          </div>
          {parcelle.label && (
            <div className="text-xs text-gray-500 truncate max-w-[200px]">
              {parcelle.label}
            </div>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        {parcelle.village && (
          <div className="flex items-center gap-1 text-sm text-gray-500">
            <MapPin className="h-3.5 w-3.5" />
            <span>{parcelle.village}</span>
          </div>
        )}
        <div className="text-sm font-medium text-gray-900 min-w-[80px] text-right">
          {formatHectares(parcelle.surface_hectares)} ha
        </div>
        {isOrphan && onAssign && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAssign(parcelle.id);
            }}
            className="text-xs font-medium text-primary-600 hover:text-primary-700 hover:underline"
          >
            Assigner
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Accordion item for a planteur group
 */
function PlanteurAccordionItem({
  group,
  isOrphan = false,
  onAssignRequest,
}: {
  group: PlanteurWithParcelles;
  isOrphan?: boolean;
  onAssignRequest?: (parcelleIds: string[]) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [parcelles, setParcelles] = useState<Parcelle[]>([]);
  const [loadingParcelles, setLoadingParcelles] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Fetch parcelles when expanding
  const handleToggle = useCallback(async () => {
    if (!isExpanded && parcelles.length === 0) {
      setLoadingParcelles(true);
      try {
        const data = isOrphan
          ? await parcellesGroupedApi.getOrphanParcelles()
          : await parcellesGroupedApi.getParcellesForPlanteur(group.planteur!.id);
        setParcelles(data);
      } catch (err) {
        console.error('Failed to fetch parcelles:', err);
      } finally {
        setLoadingParcelles(false);
      }
    }
    setIsExpanded(!isExpanded);
  }, [isExpanded, parcelles.length, isOrphan, group.planteur]);

  // Handle selection
  const handleSelect = (id: string, selected: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  // Handle select all
  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedIds(new Set(parcelles.map(p => p.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  // Handle assign single
  const handleAssignSingle = (id: string) => {
    onAssignRequest?.([id]);
  };

  // Handle assign selected
  const handleAssignSelected = () => {
    if (selectedIds.size > 0) {
      onAssignRequest?.(Array.from(selectedIds));
    }
  };

  return (
    <div className={`bg-white rounded-xl border ${isOrphan ? 'border-amber-200' : 'border-gray-100'} shadow-sm overflow-hidden`}>
      {/* Header */}
      <button
        onClick={handleToggle}
        className={`w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors ${
          isOrphan ? 'bg-amber-50/50' : ''
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-full ${
            isOrphan 
              ? 'bg-amber-100 text-amber-600' 
              : 'bg-primary-100 text-primary-600'
          }`}>
            {isOrphan ? (
              <AlertTriangle className="h-5 w-5" />
            ) : (
              <User className="h-5 w-5" />
            )}
          </div>
          <div className="text-left">
            <div className="font-semibold text-gray-900">
              {isOrphan ? 'Parcelles non assignées' : group.planteur?.name}
            </div>
            <div className="text-sm text-gray-500">
              {!isOrphan && group.planteur?.code}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm font-medium text-gray-900">
              {group.parcelles_count} parcelle{group.parcelles_count > 1 ? 's' : ''}
            </div>
            <div className="text-xs text-gray-500">
              {formatHectares(group.total_surface_ha)} ha
            </div>
          </div>
          {isOrphan && (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
              ⚠️ À assigner
            </span>
          )}
          {isExpanded ? (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronRight className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-gray-100">
          {loadingParcelles ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-gray-500">Chargement...</span>
            </div>
          ) : parcelles.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">
              Aucune parcelle
            </div>
          ) : (
            <>
              {/* Bulk actions for orphans */}
              {isOrphan && onAssignRequest && (
                <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100">
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === parcelles.length && parcelles.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    Tout sélectionner
                  </label>
                  {selectedIds.size > 0 && (
                    <button
                      onClick={handleAssignSelected}
                      className="inline-flex items-center rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
                    >
                      Assigner la sélection ({selectedIds.size})
                    </button>
                  )}
                </div>
              )}
              
              {/* Parcelle list */}
              <div className="max-h-[400px] overflow-y-auto">
                {parcelles.map((parcelle) => (
                  <ParcelleRow
                    key={parcelle.id}
                    parcelle={parcelle}
                    isOrphan={isOrphan}
                    isSelected={selectedIds.has(parcelle.id)}
                    onSelect={isOrphan ? handleSelect : undefined}
                    onAssign={isOrphan && onAssignRequest ? handleAssignSingle : undefined}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * ParcellesByPlanteur Component
 * 
 * Displays parcelles grouped by planteur in an accordion view.
 * Features:
 * - Accordion list of planteurs with stats (count, surface)
 * - Separate section for orphan parcelles (non assignées)
 * - Expand/collapse to see parcelles
 * - Selection and bulk assignment for orphans
 * 
 * @see Requirements 4.1, 4.2, 4.4, 4.5
 */
export function ParcellesByPlanteur({
  groups,
  orphans,
  stats,
  loading = false,
  onAssignRequest,
  emptyMessage = 'Aucune parcelle trouvée',
}: ParcellesByPlanteurProps) {
  if (loading) {
    return <AccordionSkeleton />;
  }

  const hasData = groups.length > 0 || (orphans && orphans.parcelles_count > 0);

  if (!hasData) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
        <div className="flex flex-col items-center">
          <div className="p-3 bg-gray-100 rounded-full mb-3">
            <Search className="h-6 w-6 text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-900">{emptyMessage}</p>
          <p className="text-sm text-gray-500 mt-1">
            Importez des parcelles ou créez-en manuellement
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Orphan parcelles section (shown first with warning) */}
      {orphans && orphans.parcelles_count > 0 && (
        <PlanteurAccordionItem
          group={orphans}
          isOrphan={true}
          onAssignRequest={onAssignRequest}
        />
      )}

      {/* Planteur groups */}
      {groups.map((group) => (
        <PlanteurAccordionItem
          key={group.planteur?.id}
          group={group}
          isOrphan={false}
        />
      ))}
    </div>
  );
}
