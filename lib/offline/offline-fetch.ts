// CocoaTrack V2 - Offline Fetch Wrapper
// Intercepts fetch calls to handle offline mutations
// Requirements: REQ-OFF-006

import { v4 as uuidv4 } from 'uuid';

import { getSyncEngine, type AllowedTable, TABLE_PRIORITY_MAP } from './sync-engine';
import type { SyncOperationType, OperationPriority } from '@/types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * HTTP methods that are considered mutations (not safe for offline passthrough)
 */
const MUTATION_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'] as const;
type MutationMethod = (typeof MUTATION_METHODS)[number];

/**
 * Configuration for offline fetch behavior
 */
export interface OfflineFetchConfig {
  /** User ID for operation ownership */
  userId: string;
  /** Cooperative ID for data isolation */
  cooperativeId: string;
  /** Callback when operation is queued offline */
  onOfflineQueue?: (operation: OfflineQueuedOperation) => void;
  /** Callback when online fetch fails */
  onFetchError?: (error: Error) => void;
}

/**
 * Information about a queued offline operation
 */
export interface OfflineQueuedOperation {
  id: string;
  table: string;
  type: SyncOperationType;
  recordId: string;
  queuedAt: string;
}

/**
 * Result of offline fetch operation
 */
export interface OfflineFetchResult {
  response: Response;
  wasQueued: boolean;
  queuedOperation?: OfflineQueuedOperation;
}

/**
 * Parsed API endpoint information
 */
interface ParsedEndpoint {
  table: AllowedTable | null;
  recordId: string | null;
  isSupported: boolean;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Checks if the browser is currently online
 */
export function isOnline(): boolean {
  if (typeof navigator === 'undefined') {
    return true; // SSR - assume online
  }
  return navigator.onLine;
}

/**
 * Checks if a method is a mutation (POST, PUT, PATCH, DELETE)
 */
export function isMutationMethod(method: string): method is MutationMethod {
  return MUTATION_METHODS.includes(method.toUpperCase() as MutationMethod);
}

/**
 * Maps HTTP method to sync operation type
 */
export function methodToOperationType(method: string): SyncOperationType {
  const upperMethod = method.toUpperCase();
  switch (upperMethod) {
    case 'POST':
      return 'CREATE';
    case 'PUT':
    case 'PATCH':
      return 'UPDATE';
    case 'DELETE':
      return 'DELETE';
    default:
      return 'CREATE';
  }
}

/**
 * Parses a Supabase API URL to extract table and record information
 * Supports URLs like:
 * - /rest/v1/deliveries
 * - /rest/v1/deliveries?id=eq.xxx
 * - /rest/v1/planteurs
 */
export function parseSupabaseUrl(url: string): ParsedEndpoint {
  const result: ParsedEndpoint = {
    table: null,
    recordId: null,
    isSupported: false,
  };

  try {
    const urlObj = new URL(url, 'http://localhost');
    const pathname = urlObj.pathname;

    // Match /rest/v1/{table} pattern
    const restMatch = pathname.match(/\/rest\/v1\/(\w+)/);
    if (!restMatch) {
      return result;
    }

    const tableName = restMatch[1];
    
    // Check if table is supported for offline sync
    const supportedTables: AllowedTable[] = ['deliveries', 'planteurs', 'chef_planteurs'];
    if (!supportedTables.includes(tableName as AllowedTable)) {
      return result;
    }

    result.table = tableName as AllowedTable;
    result.isSupported = true;

    // Try to extract record ID from query params (for updates/deletes)
    const idParam = urlObj.searchParams.get('id');
    if (idParam) {
      // Parse eq.xxx format
      const eqMatch = idParam.match(/^eq\.(.+)$/);
      if (eqMatch) {
        result.recordId = eqMatch[1];
      }
    }

    return result;
  } catch {
    return result;
  }
}

/**
 * Creates a synthetic 202 Accepted response for queued operations
 */
export function createAcceptedResponse(operation: OfflineQueuedOperation): Response {
  const body = JSON.stringify({
    status: 'queued',
    message: 'Operation queued for offline sync',
    operation: {
      id: operation.id,
      table: operation.table,
      type: operation.type,
      record_id: operation.recordId,
      queued_at: operation.queuedAt,
    },
  });

  return new Response(body, {
    status: 202,
    statusText: 'Accepted',
    headers: {
      'Content-Type': 'application/json',
      'X-Offline-Queued': 'true',
    },
  });
}

/**
 * Creates an error response for unsupported offline operations
 */
export function createUnsupportedOfflineResponse(reason: string): Response {
  const body = JSON.stringify({
    error: 'OFFLINE_NOT_SUPPORTED',
    message: reason,
  });

  return new Response(body, {
    status: 503,
    statusText: 'Service Unavailable',
    headers: {
      'Content-Type': 'application/json',
      'X-Offline-Error': 'true',
    },
  });
}

// ============================================================================
// OFFLINE FETCH WRAPPER
// ============================================================================

/**
 * Wraps the native fetch to handle offline mutations
 * 
 * Behavior:
 * - GET requests: Pass through to native fetch (will fail if offline)
 * - Mutations when online: Pass through to native fetch
 * - Mutations when offline: Queue operation and return 202 Accepted
 * 
 * @param input - URL or Request object
 * @param init - Fetch init options
 * @param config - Offline fetch configuration
 * @returns Promise resolving to fetch Response
 */
export async function offlineFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  config?: OfflineFetchConfig
): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const method = init?.method || (input instanceof Request ? input.method : 'GET');

  // GET requests always pass through
  if (!isMutationMethod(method)) {
    return fetch(input, init);
  }

  // If online, try the normal fetch first
  if (isOnline()) {
    try {
      return await fetch(input, init);
    } catch (error) {
      // Network error while supposedly online - might have just gone offline
      // Fall through to offline handling
      if (config?.onFetchError) {
        config.onFetchError(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  // Offline mutation handling
  if (!config) {
    return createUnsupportedOfflineResponse('Offline fetch requires configuration');
  }

  const { userId, cooperativeId, onOfflineQueue } = config;

  if (!userId || !cooperativeId) {
    return createUnsupportedOfflineResponse('User and cooperative ID required for offline operations');
  }

  // Parse the URL to determine table and operation
  const parsed = parseSupabaseUrl(url);
  
  if (!parsed.isSupported || !parsed.table) {
    return createUnsupportedOfflineResponse(`Table not supported for offline sync: ${url}`);
  }

  // Parse request body
  let data: Record<string, unknown> = {};
  if (init?.body) {
    try {
      data = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
    } catch {
      return createUnsupportedOfflineResponse('Invalid request body for offline queue');
    }
  }

  // Determine operation type and record ID
  const operationType = methodToOperationType(method);
  const recordId = parsed.recordId || (data.id as string) || uuidv4();

  // Get priority based on table
  const priority: OperationPriority = TABLE_PRIORITY_MAP[parsed.table] || 'normal';

  // Queue the operation
  const syncEngine = getSyncEngine();
  const queuedOp = await syncEngine.createOperation({
    type: operationType,
    table: parsed.table,
    recordId,
    data,
    userId,
    cooperativeId,
    priority,
  });

  const offlineOperation: OfflineQueuedOperation = {
    id: queuedOp.id,
    table: parsed.table,
    type: operationType,
    recordId,
    queuedAt: queuedOp.created_at,
  };

  // Notify callback
  if (onOfflineQueue) {
    onOfflineQueue(offlineOperation);
  }

  // Return 202 Accepted response
  return createAcceptedResponse(offlineOperation);
}

// ============================================================================
// REACT HOOK FOR OFFLINE FETCH
// ============================================================================

/**
 * Creates an offline-aware fetch function with the given configuration
 * 
 * @param config - Configuration for offline behavior
 * @returns Configured offline fetch function
 */
export function createOfflineFetch(config: OfflineFetchConfig) {
  return (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    return offlineFetch(input, init, config);
  };
}

// ============================================================================
// HELPER TO CHECK IF RESPONSE WAS QUEUED OFFLINE
// ============================================================================

/**
 * Checks if a response was queued offline (202 with X-Offline-Queued header)
 */
export function wasQueuedOffline(response: Response): boolean {
  return response.status === 202 && response.headers.get('X-Offline-Queued') === 'true';
}

/**
 * Extracts queued operation info from an offline response
 */
export async function getQueuedOperationFromResponse(
  response: Response
): Promise<OfflineQueuedOperation | null> {
  if (!wasQueuedOffline(response)) {
    return null;
  }

  try {
    const data = await response.clone().json();
    return data.operation as OfflineQueuedOperation;
  } catch {
    return null;
  }
}
