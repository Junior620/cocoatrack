/**
 * Request Queue Indicator Component
 * 
 * Displays the pending request count and provides controls for managing
 * the offline request queue.
 * 
 * Requirements: Task 6.3.4
 * - Display pending request count
 * - Show retry status
 * - Allow manual retry trigger
 */

'use client';

import { useState } from 'react';
import { useRequestQueue } from '@/hooks/satellite/useRequestQueue';
import { RefreshCw, Wifi, WifiOff, X, AlertCircle } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface RequestQueueIndicatorProps {
  /**
   * Position of the indicator on screen
   * @default 'bottom-right'
   */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

  /**
   * Whether to show detailed view by default
   * @default false
   */
  showDetailsDefault?: boolean;

  /**
   * Custom class name
   */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Request Queue Indicator
 * 
 * Shows a badge with the pending request count and provides controls for
 * managing queued requests. Automatically updates when queue state changes.
 * 
 * @example
 * ```tsx
 * <RequestQueueIndicator position="bottom-right" />
 * ```
 */
export function RequestQueueIndicator({
  position = 'bottom-right',
  showDetailsDefault = false,
  className = '',
}: RequestQueueIndicatorProps) {
  const { state, operations, pendingCount, requests } = useRequestQueue();
  const [showDetails, setShowDetails] = useState(showDetailsDefault);

  // Don't render if no pending requests and not showing details
  if (pendingCount === 0 && !showDetails) {
    return null;
  }

  // Position classes
  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4',
  };

  return (
    <div
      className={`fixed ${positionClasses[position]} z-50 ${className}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {/* Compact Badge */}
      {!showDetails && (
        <button
          onClick={() => setShowDetails(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
          aria-label={`${pendingCount} pending requests. Click to view details.`}
        >
          <WifiOff className="w-4 h-4" />
          <span className="font-medium">{pendingCount}</span>
          <span className="text-sm">pending</span>
        </button>
      )}

      {/* Detailed Panel */}
      {showDetails && (
        <div className="bg-white rounded-lg shadow-xl border border-gray-200 w-80 max-h-96 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center gap-2">
              <WifiOff className="w-5 h-5 text-gray-600" />
              <h3 className="font-semibold text-gray-900">Offline Queue</h3>
            </div>
            <button
              onClick={() => setShowDetails(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close queue details"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* Statistics */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-gray-600">Pending requests:</span>
                <span className="font-semibold text-gray-900">{pendingCount}</span>
              </div>
              {state.statistics && state.statistics.failedRequests > 0 && (
                <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-2 rounded">
                  <AlertCircle className="w-4 h-4" />
                  <span>{state.statistics.failedRequests} failed (max retries)</span>
                </div>
              )}
            </div>

            {/* Request List */}
            {requests.length > 0 && (
              <div className="space-y-2 mb-4">
                <h4 className="text-xs font-medium text-gray-500 uppercase">Queued Requests</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {requests.map((request) => (
                    <div
                      key={request.id}
                      className="text-sm p-2 bg-gray-50 rounded border border-gray-200"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-gray-700">
                          {request.method}
                        </span>
                        <span className="text-xs text-gray-500">
                          {request.retryCount}/{request.maxRetries} retries
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 truncate">
                        {request.metadata?.description || request.url}
                      </div>
                      {request.metadata?.parcelleId && (
                        <div className="text-xs text-gray-500 mt-1">
                          Parcelle: {request.metadata.parcelleId}
                        </div>
                      )}
                      {request.error && (
                        <div className="text-xs text-red-600 mt-1 truncate">
                          Error: {request.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {requests.length === 0 && (
              <div className="text-center py-6 text-gray-500">
                <Wifi className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm">No pending requests</p>
              </div>
            )}

            {/* Error Display */}
            {state.error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{state.error.message}</span>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="p-4 border-t border-gray-200 bg-gray-50 space-y-2">
            <button
              onClick={operations.retryAll}
              disabled={state.isRetrying || pendingCount === 0}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              aria-label="Retry all pending requests"
            >
              <RefreshCw
                className={`w-4 h-4 ${state.isRetrying ? 'animate-spin' : ''}`}
              />
              <span>{state.isRetrying ? 'Retrying...' : 'Retry All'}</span>
            </button>

            {requests.length > 0 && (
              <button
                onClick={operations.clear}
                disabled={state.isRetrying}
                className="w-full text-sm text-gray-600 hover:text-gray-900 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                aria-label="Clear all queued requests"
              >
                Clear Queue
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Simple badge component for showing pending count only
 * 
 * Lightweight version that only shows a badge with the count.
 * 
 * @example
 * ```tsx
 * <RequestQueueBadge />
 * ```
 */
export function RequestQueueBadge({ className = '' }: { className?: string }) {
  const { pendingCount } = useRequestQueue();

  if (pendingCount === 0) {
    return null;
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-medium ${className}`}
      role="status"
      aria-label={`${pendingCount} pending requests`}
    >
      <WifiOff className="w-3 h-3" />
      <span>{pendingCount}</span>
    </div>
  );
}
