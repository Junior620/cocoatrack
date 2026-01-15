'use client';

// CocoaTrack V2 - Parcelle Table Component
// Displays parcelles in a sortable, paginated table with status badges and certification tags

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronUp, ChevronDown, Search, MapPin, FileUp } from 'lucide-react';
import type { ParcelleWithPlanteur, Certification, ConformityStatus } from '@/types/parcelles';
import {
  CERTIFICATION_LABELS,
  CONFORMITY_STATUS_LABELS,
  CONFORMITY_STATUS_COLORS,
} from '@/types/parcelles';
import { ConformityInfoBubble } from './ConformityInfoBubble';

// =============================================================================
// Types
// =============================================================================

/**
 * Sort configuration for the table
 */
export interface SortConfig {
  /** Column to sort by */
  column: SortableColumn;
  /** Sort direction */
  direction: 'asc' | 'desc';
}

/**
 * Columns that can be sorted
 */
export type SortableColumn = 
  | 'code' 
  | 'planteur' 
  | 'village' 
  | 'surface_hectares' 
  | 'conformity_status';

/**
 * Props for the ParcelleTable component
 */
export interface ParcelleTableProps {
  /** Array of parcelles to display */
  parcelles: ParcelleWithPlanteur[];
  /** Loading state */
  loading?: boolean;
  /** Current sort configuration */
  sortConfig?: SortConfig;
  /** Callback when sort changes */
  onSortChange?: (config: SortConfig) => void;
  /** Pagination info */
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  /** Callback when page changes */
  onPageChange?: (page: number) => void;
  /** Callback when page size changes */
  onPageSizeChange?: (pageSize: number) => void;
  /** Empty state message */
  emptyMessage?: string;
}

// =============================================================================
// Helper Components
// =============================================================================

/**
 * Status badge component with color coding
 */
function StatusBadge({ status }: { status: ConformityStatus }) {
  const label = CONFORMITY_STATUS_LABELS[status] || status;
  const color = CONFORMITY_STATUS_COLORS[status] || '#9ca3af';
  
  // Map colors to Tailwind classes for consistency
  const colorClasses: Record<string, string> = {
    '#6FAF3D': 'bg-green-100 text-green-800 border-green-200',
    '#E68A1F': 'bg-orange-100 text-orange-800 border-orange-200',
    '#ef4444': 'bg-red-100 text-red-800 border-red-200',
    '#9ca3af': 'bg-gray-100 text-gray-600 border-gray-200',
  };
  
  const classes = colorClasses[color] || 'bg-gray-100 text-gray-600 border-gray-200';
  
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border ${classes}`}
    >
      <span
        className="mr-1.5 h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

/**
 * Certification tag component
 */
function CertificationTag({ certification }: { certification: Certification }) {
  const label = CERTIFICATION_LABELS[certification] || certification;
  
  return (
    <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20">
      {label}
    </span>
  );
}

/**
 * Sortable column header component
 */
function SortableHeader({
  column,
  label,
  currentSort,
  onSort,
  icon,
}: {
  column: SortableColumn;
  label: string;
  currentSort?: SortConfig;
  onSort?: (config: SortConfig) => void;
  icon?: React.ReactNode;
}) {
  const isActive = currentSort?.column === column;
  const direction = isActive ? currentSort.direction : 'asc';
  
  const handleClick = () => {
    if (!onSort) return;
    
    const newDirection = isActive && direction === 'asc' ? 'desc' : 'asc';
    onSort({ column, direction: newDirection });
  };
  
  return (
    <th
      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors select-none"
      onClick={handleClick}
    >
      <div className="flex items-center gap-1">
        {icon}
        <span>{label}</span>
        {onSort && (
          <span className="ml-1 flex flex-col">
            <ChevronUp
              className={`h-3 w-3 -mb-1 ${
                isActive && direction === 'asc' ? 'text-primary-600' : 'text-gray-300'
              }`}
            />
            <ChevronDown
              className={`h-3 w-3 ${
                isActive && direction === 'desc' ? 'text-primary-600' : 'text-gray-300'
              }`}
            />
          </span>
        )}
      </div>
    </th>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * ParcelleTable Component
 * 
 * Displays parcelles in a table with:
 * - Columns: Identifiant, Planteur, Village, Hectares, Certificats, Statut
 * - Sortable columns
 * - Status badge with color
 * - Certifications as tags
 * - Row click → navigate to detail
 * - Pagination controls
 */
export function ParcelleTable({
  parcelles,
  loading = false,
  sortConfig,
  onSortChange,
  pagination,
  onPageChange,
  onPageSizeChange,
  emptyMessage = 'Aucune parcelle trouvée',
}: ParcelleTableProps) {
  const router = useRouter();
  
  /**
   * Handle row click - navigate to parcelle detail
   */
  const handleRowClick = (parcelle: ParcelleWithPlanteur) => {
    router.push(`/parcelles/${parcelle.id}`);
  };
  
  /**
   * Format hectares for display
   */
  const formatHectares = (value: number): string => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(value);
  };
  
  // Loading skeleton
  if (loading) {
    return (
      <div className="overflow-hidden rounded-xl bg-white shadow-sm border border-gray-100">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left"><div className="h-4 w-20 bg-gray-200 rounded animate-pulse" /></th>
                <th className="px-4 py-3 text-left"><div className="h-4 w-24 bg-gray-200 rounded animate-pulse" /></th>
                <th className="px-4 py-3 text-left"><div className="h-4 w-20 bg-gray-200 rounded animate-pulse" /></th>
                <th className="px-4 py-3 text-left"><div className="h-4 w-16 bg-gray-200 rounded animate-pulse" /></th>
                <th className="px-4 py-3 text-left"><div className="h-4 w-28 bg-gray-200 rounded animate-pulse" /></th>
                <th className="px-4 py-3 text-left"><div className="h-4 w-20 bg-gray-200 rounded animate-pulse" /></th>
                <th className="px-4 py-3 text-left"><div className="h-4 w-20 bg-gray-200 rounded animate-pulse" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {[...Array(5)].map((_, i) => (
                <tr key={i}>
                  <td className="px-4 py-3"><div className="h-4 w-24 bg-gray-100 rounded animate-pulse" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-32 bg-gray-100 rounded animate-pulse" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-20 bg-gray-100 rounded animate-pulse" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-16 bg-gray-100 rounded animate-pulse" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-24 bg-gray-100 rounded animate-pulse" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-20 bg-gray-100 rounded animate-pulse" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-20 bg-gray-100 rounded animate-pulse" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="overflow-hidden rounded-xl bg-white shadow-sm border border-gray-100">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <SortableHeader
                  column="code"
                  label="Identifiant"
                  currentSort={sortConfig}
                  onSort={onSortChange}
                />
                <SortableHeader
                  column="planteur"
                  label="Planteur"
                  currentSort={sortConfig}
                  onSort={onSortChange}
                />
                <SortableHeader
                  column="village"
                  label="Village"
                  currentSort={sortConfig}
                  onSort={onSortChange}
                  icon={<MapPin className="h-3.5 w-3.5" />}
                />
                <SortableHeader
                  column="surface_hectares"
                  label="Hectares"
                  currentSort={sortConfig}
                  onSort={onSortChange}
                />
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Certificats
                </th>
                <SortableHeader
                  column="conformity_status"
                  label="Statut"
                  currentSort={sortConfig}
                  onSort={onSortChange}
                />
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Source
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {parcelles.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <div className="p-3 bg-gray-100 rounded-full mb-3">
                        <Search className="h-6 w-6 text-gray-400" />
                      </div>
                      <p className="text-sm font-medium text-gray-900">{emptyMessage}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        Essayez de modifier vos filtres ou créez une nouvelle parcelle
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                parcelles.map((parcelle) => (
                  <tr
                    key={parcelle.id}
                    onClick={() => handleRowClick(parcelle)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    {/* Identifiant */}
                    <td className="whitespace-nowrap px-4 py-3">
                      <div>
                        <div className="font-medium text-gray-900">{parcelle.code}</div>
                        {parcelle.label && (
                          <div className="text-xs text-gray-500 truncate max-w-[150px]">
                            {parcelle.label}
                          </div>
                        )}
                      </div>
                    </td>
                    
                    {/* Planteur */}
                    <td className="whitespace-nowrap px-4 py-3">
                      <div>
                        <div className="font-medium text-gray-900">
                          {parcelle.planteur?.name || '-'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {parcelle.planteur?.code || '-'}
                        </div>
                      </div>
                    </td>
                    
                    {/* Village */}
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {parcelle.village || '-'}
                    </td>
                    
                    {/* Hectares */}
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900 font-medium">
                      {formatHectares(parcelle.surface_hectares)} ha
                    </td>
                    
                    {/* Certificats */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {parcelle.certifications && parcelle.certifications.length > 0 ? (
                          parcelle.certifications.map((cert) => (
                            <CertificationTag key={cert} certification={cert} />
                          ))
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    
                    {/* Statut */}
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center gap-1">
                        <StatusBadge status={parcelle.conformity_status} />
                        <div onClick={(e) => e.stopPropagation()}>
                          <ConformityInfoBubble parcelle={parcelle} />
                        </div>
                      </div>
                    </td>
                    
                    {/* Source / Import Link */}
                    <td className="whitespace-nowrap px-4 py-3">
                      {parcelle.import_file_id ? (
                        <Link
                          href={`/parcelles?import_file_id=${parcelle.import_file_id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 hover:underline"
                          title="Voir l'import"
                        >
                          <FileUp className="h-3.5 w-3.5" />
                          <span>Voir l&apos;import</span>
                        </Link>
                      ) : (
                        <span className="text-sm text-gray-400">Manuel</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Pagination */}
      {pagination && pagination.totalPages > 0 && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          pageSize={pagination.pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </div>
  );
}

// =============================================================================
// Pagination Component
// =============================================================================

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
}

function Pagination({
  currentPage,
  totalPages,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const pageSizeOptions = [25, 50, 100];
  
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white px-4 py-3 rounded-xl shadow-sm border border-gray-100">
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-600">
          {total} parcelle{total > 1 ? 's' : ''} au total
        </span>
        
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Afficher</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="rounded-lg border border-gray-200 py-1.5 pl-2 pr-8 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange?.(currentPage - 1)}
          disabled={currentPage === 1 || !onPageChange}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
        >
          Précédent
        </button>
        <span className="text-sm text-gray-600 px-2">
          {currentPage} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange?.(currentPage + 1)}
          disabled={currentPage === totalPages || !onPageChange}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
        >
          Suivant
        </button>
      </div>
    </div>
  );
}


