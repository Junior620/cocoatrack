'use client';

// CocoaTrack V2 - Responsive Table Component
// REQ-RESP-002: Tableaux Responsifs
// Card layout for < 640px, Table layout for >= 640px
// REQ-RESP-006: Swipe actions on cards

import React, { useState, useRef, useCallback, ReactNode } from 'react';
import { ChevronUp, ChevronDown, Search, ChevronLeft, ChevronRight } from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

export interface Column<T> {
  /** Unique key for the column */
  key: string;
  /** Header label */
  header: string;
  /** Render function for cell content */
  render: (item: T) => ReactNode;
  /** Whether column is sortable */
  sortable?: boolean;
  /** Whether to show in card view (default: true) */
  showInCard?: boolean;
  /** Priority for card view (lower = more important) */
  cardPriority?: number;
  /** Custom header icon */
  headerIcon?: ReactNode;
  /** Width class for table column */
  width?: string;
}

export interface SortConfig {
  column: string;
  direction: 'asc' | 'desc';
}

export interface SwipeAction<T> {
  /** Action identifier */
  id: string;
  /** Action label */
  label: string;
  /** Action icon */
  icon: ReactNode;
  /** Background color class */
  bgColor: string;
  /** Text color class */
  textColor?: string;
  /** Action handler */
  onAction: (item: T) => void;
  /** Whether action is destructive (requires confirmation) */
  destructive?: boolean;
}

export interface ResponsiveTableProps<T> {
  /** Data items to display */
  data: T[];
  /** Column definitions */
  columns: Column<T>[];
  /** Unique key extractor */
  keyExtractor: (item: T) => string;
  /** Loading state */
  loading?: boolean;
  /** Current sort configuration */
  sortConfig?: SortConfig;
  /** Sort change handler */
  onSortChange?: (config: SortConfig) => void;
  /** Row click handler */
  onRowClick?: (item: T) => void;
  /** Left swipe actions (secondary) */
  leftSwipeActions?: SwipeAction<T>[];
  /** Right swipe action (primary) */
  rightSwipeAction?: SwipeAction<T>;
  /** Empty state message */
  emptyMessage?: string;
  /** Empty state description */
  emptyDescription?: string;
  /** Card title extractor */
  cardTitle?: (item: T) => ReactNode;
  /** Card subtitle extractor */
  cardSubtitle?: (item: T) => ReactNode;
  /** Pagination */
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  /** Page change handler */
  onPageChange?: (page: number) => void;
  /** Page size change handler */
  onPageSizeChange?: (pageSize: number) => void;
}

// =============================================================================
// Swipe Card Component
// =============================================================================

interface SwipeCardProps<T> {
  item: T;
  children: ReactNode;
  leftActions?: SwipeAction<T>[];
  rightAction?: SwipeAction<T>;
  onClick?: () => void;
  onActionComplete?: (actionId: string, item: T) => void;
}

function SwipeCard<T>({
  item,
  children,
  leftActions = [],
  rightAction,
  onClick,
  onActionComplete,
}: SwipeCardProps<T>) {
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const SWIPE_THRESHOLD = 80;
  const MAX_SWIPE = 120;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = e.touches[0].clientX;
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    
    currentXRef.current = e.touches[0].clientX;
    const diff = currentXRef.current - startXRef.current;
    
    // Limit swipe distance
    const limitedDiff = Math.max(-MAX_SWIPE, Math.min(MAX_SWIPE, diff));
    
    // Only allow swipe in directions with actions
    if (diff > 0 && !rightAction) return;
    if (diff < 0 && leftActions.length === 0) return;
    
    setTranslateX(limitedDiff);
  }, [isDragging, leftActions.length, rightAction]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    
    if (Math.abs(translateX) >= SWIPE_THRESHOLD) {
      if (translateX > 0 && rightAction) {
        // Right swipe - primary action
        rightAction.onAction(item);
        onActionComplete?.(rightAction.id, item);
      } else if (translateX < 0 && leftActions.length > 0) {
        // Left swipe - show actions (keep revealed)
        setTranslateX(-MAX_SWIPE);
        return;
      }
    }
    
    setTranslateX(0);
  }, [translateX, rightAction, leftActions, item, onActionComplete]);

  const handleActionClick = (action: SwipeAction<T>) => {
    action.onAction(item);
    onActionComplete?.(action.id, item);
    setTranslateX(0);
  };

  const resetSwipe = () => {
    setTranslateX(0);
  };

  return (
    <div className="relative overflow-hidden rounded-xl mb-3">
      {/* Left actions (revealed on left swipe) */}
      {leftActions.length > 0 && (
        <div 
          className="absolute inset-y-0 right-0 flex items-stretch"
          style={{ width: MAX_SWIPE }}
        >
          {leftActions.map((action) => (
            <button
              key={action.id}
              onClick={() => handleActionClick(action)}
              className={`
                flex-1 flex flex-col items-center justify-center gap-1
                ${action.bgColor} ${action.textColor || 'text-white'}
                min-w-[60px] touch-manipulation
              `}
              aria-label={action.label}
            >
              {action.icon}
              <span className="text-[10px] font-medium">{action.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Right action (revealed on right swipe) */}
      {rightAction && (
        <div 
          className="absolute inset-y-0 left-0 flex items-stretch"
          style={{ width: MAX_SWIPE }}
        >
          <button
            onClick={() => handleActionClick(rightAction)}
            className={`
              flex-1 flex flex-col items-center justify-center gap-1
              ${rightAction.bgColor} ${rightAction.textColor || 'text-white'}
              touch-manipulation
            `}
            aria-label={rightAction.label}
          >
            {rightAction.icon}
            <span className="text-[10px] font-medium">{rightAction.label}</span>
          </button>
        </div>
      )}

      {/* Card content */}
      <div
        ref={cardRef}
        className={`
          relative bg-white border border-gray-100 rounded-xl shadow-sm
          transition-transform ${isDragging ? '' : 'duration-200'}
          touch-manipulation
        `}
        style={{ transform: `translateX(${translateX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => {
          if (Math.abs(translateX) < 5) {
            onClick?.();
          } else {
            resetSwipe();
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}

// =============================================================================
// Sortable Header Component
// =============================================================================

interface SortableHeaderProps {
  column: string;
  label: string;
  currentSort?: SortConfig;
  onSort?: (config: SortConfig) => void;
  icon?: ReactNode;
}

function SortableHeader({
  column,
  label,
  currentSort,
  onSort,
  icon,
}: SortableHeaderProps) {
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
// Loading Skeleton
// =============================================================================

function TableSkeleton({ columns }: { columns: number }) {
  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-sm border border-gray-100">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {[...Array(columns)].map((_, i) => (
                <th key={i} className="px-4 py-3 text-left">
                  <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {[...Array(5)].map((_, i) => (
              <tr key={i}>
                {[...Array(columns)].map((_, j) => (
                  <td key={j} className="px-4 py-3">
                    <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="h-5 w-32 bg-gray-200 rounded animate-pulse mb-2" />
              <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
            </div>
            <div className="h-6 w-20 bg-gray-100 rounded-full animate-pulse" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="h-4 w-full bg-gray-100 rounded animate-pulse" />
            <div className="h-4 w-full bg-gray-100 rounded animate-pulse" />
          </div>
        </div>
      ))}
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
          {total} élément{total > 1 ? 's' : ''}
        </span>

        {onPageSizeChange && (
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-sm text-gray-500">Afficher</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="rounded-lg border border-gray-200 py-1.5 pl-2 pr-8 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 min-h-[44px]"
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
          className="rounded-lg border border-gray-200 bg-white p-2 sm:px-3 sm:py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Page précédente"
        >
          <ChevronLeft className="h-5 w-5 sm:hidden" />
          <span className="hidden sm:inline">Précédent</span>
        </button>
        <span className="text-sm text-gray-600 px-2">
          {currentPage} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange?.(currentPage + 1)}
          disabled={currentPage === totalPages || !onPageChange}
          className="rounded-lg border border-gray-200 bg-white p-2 sm:px-3 sm:py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Page suivante"
        >
          <ChevronRight className="h-5 w-5 sm:hidden" />
          <span className="hidden sm:inline">Suivant</span>
        </button>
      </div>
    </div>
  );
}


// =============================================================================
// Main Component
// =============================================================================

/**
 * ResponsiveTable Component
 * 
 * Displays data in a table on desktop (>= 640px) and cards on mobile (< 640px).
 * Supports swipe actions on mobile cards.
 * 
 * REQ-RESP-002: Tableaux Responsifs
 * REQ-RESP-006: Swipe Actions Standardisées
 */
export function ResponsiveTable<T>({
  data,
  columns,
  keyExtractor,
  loading = false,
  sortConfig,
  onSortChange,
  onRowClick,
  leftSwipeActions,
  rightSwipeAction,
  emptyMessage = 'Aucun élément trouvé',
  emptyDescription = 'Essayez de modifier vos filtres',
  cardTitle,
  cardSubtitle,
  pagination,
  onPageChange,
  onPageSizeChange,
}: ResponsiveTableProps<T>) {
  // Get columns to show in card view, sorted by priority
  const cardColumns = columns
    .filter((col) => col.showInCard !== false)
    .sort((a, b) => (a.cardPriority || 99) - (b.cardPriority || 99))
    .slice(0, 4); // Show max 4 fields in card

  // Loading state
  if (loading) {
    return (
      <div className="space-y-4">
        {/* Table skeleton for desktop */}
        <div className="hidden sm:block">
          <TableSkeleton columns={columns.length} />
        </div>
        {/* Card skeleton for mobile */}
        <div className="sm:hidden">
          <CardSkeleton />
        </div>
      </div>
    );
  }

  // Empty state
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-6 py-12 text-center">
        <div className="flex flex-col items-center">
          <div className="p-3 bg-gray-100 rounded-full mb-3">
            <Search className="h-6 w-6 text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-900">{emptyMessage}</p>
          <p className="text-sm text-gray-500 mt-1">{emptyDescription}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Desktop Table View (>= 640px) */}
      <div className="hidden sm:block overflow-hidden rounded-xl bg-white shadow-sm border border-gray-100">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {columns.map((col) => (
                  col.sortable ? (
                    <SortableHeader
                      key={col.key}
                      column={col.key}
                      label={col.header}
                      currentSort={sortConfig}
                      onSort={onSortChange}
                      icon={col.headerIcon}
                    />
                  ) : (
                    <th
                      key={col.key}
                      className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 ${col.width || ''}`}
                    >
                      <div className="flex items-center gap-1">
                        {col.headerIcon}
                        <span>{col.header}</span>
                      </div>
                    </th>
                  )
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {data.map((item) => (
                <tr
                  key={keyExtractor(item)}
                  onClick={() => onRowClick?.(item)}
                  className={`${onRowClick ? 'hover:bg-gray-50 cursor-pointer' : ''} transition-colors`}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`px-4 py-3 ${col.width || ''}`}>
                      {col.render(item)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View (< 640px) */}
      <div className="sm:hidden">
        {data.map((item) => (
          <SwipeCard
            key={keyExtractor(item)}
            item={item}
            leftActions={leftSwipeActions}
            rightAction={rightSwipeAction}
            onClick={() => onRowClick?.(item)}
          >
            <div className="p-4">
              {/* Card header */}
              {(cardTitle || cardSubtitle) && (
                <div className="mb-3">
                  {cardTitle && (
                    <div className="font-medium text-gray-900">
                      {cardTitle(item)}
                    </div>
                  )}
                  {cardSubtitle && (
                    <div className="text-sm text-gray-500">
                      {cardSubtitle(item)}
                    </div>
                  )}
                </div>
              )}

              {/* Card fields */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {cardColumns.map((col) => (
                  <div key={col.key}>
                    <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">
                      {col.header}
                    </div>
                    <div className="text-sm text-gray-900">
                      {col.render(item)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </SwipeCard>
        ))}
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

export default ResponsiveTable;
