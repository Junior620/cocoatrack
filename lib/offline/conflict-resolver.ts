// CocoaTrack V2 - Conflict Resolution
// Handles critical vs non-critical field conflicts
// Requirements: REQ-SYNC-007

import type { SyncOperation } from '@/types';

// ============================================================================
// CRITICAL FIELDS CONFIGURATION
// ============================================================================

/**
 * Critical fields that require manual user choice when conflicting.
 * These fields affect financial calculations, data integrity, or entity relationships.
 * REQ-SYNC-007: "User chooses" for critical fields
 */
export const CRITICAL_FIELDS: Record<string, string[]> = {
  deliveries: [
    'weight_kg',        // Financial impact - affects total calculation
    'price_per_kg',     // Financial impact - affects total calculation
    'planteur_id',      // Entity relationship - critical for traceability
    'total_amount',     // Financial impact
    'payment_status',   // Financial impact
    'payment_amount_paid', // Financial impact
  ],
  planteurs: [
    'planteur_id',      // Entity identity
    'chef_planteur_id', // Entity relationship - changing association is critical
  ],
  chef_planteurs: [
    'cooperative_id',   // Entity relationship - changing cooperative is critical
    'quantite_max_kg',  // Business rule - affects quantity warnings
    'validation_status', // Workflow state
  ],
};

/**
 * Mergeable fields that can be auto-merged without user intervention.
 * These are typically metadata, notes, or non-financial descriptive fields.
 * REQ-SYNC-007: Auto-merge for non-critical fields
 */
export const MERGEABLE_FIELDS: Record<string, string[]> = {
  deliveries: [
    'notes',           // Descriptive - can be merged
    'metadata',        // Metadata - can be merged
    'quality_grade',   // Non-financial descriptor
  ],
  planteurs: [
    'notes',           // Descriptive
    'metadata',        // Metadata
    'phone',           // Contact info - LWW acceptable
    'cni',             // ID info - LWW acceptable
    'latitude',        // Location - LWW acceptable
    'longitude',       // Location - LWW acceptable
    'name',            // Descriptive - LWW acceptable
  ],
  chef_planteurs: [
    'notes',           // Descriptive
    'metadata',        // Metadata
    'phone',           // Contact info
    'cni',             // ID info
    'latitude',        // Location
    'longitude',       // Location
    'region',          // Location descriptor
    'departement',     // Location descriptor
    'localite',        // Location descriptor
    'name',            // Descriptive
  ],
};

/**
 * @deprecated Use MERGEABLE_FIELDS instead
 * Kept for backward compatibility
 */
export const NON_CRITICAL_FIELDS = MERGEABLE_FIELDS;

// ============================================================================
// CONFLICT TYPES
// ============================================================================

export type ConflictType = 'none' | 'critical' | 'non_critical';

export interface ConflictDetails {
  type: ConflictType;
  conflictingFields: string[];
  localValues: Record<string, unknown>;
  remoteValues: Record<string, unknown>;
  baseValues: Record<string, unknown>;
}

// ============================================================================
// CONFLICT DETECTION
// ============================================================================

/**
 * Detects if there's a conflict between local changes and remote state
 * 
 * @param op - The sync operation with local changes and base snapshot
 * @param remoteState - Current state of the record on the server
 * @returns The type of conflict detected
 */
export function detectConflict(
  op: Pick<SyncOperation, 'type' | 'table' | 'data' | 'base_snapshot'>,
  remoteState: Record<string, unknown>
): ConflictType {
  // Only UPDATE operations can have conflicts
  if (op.type !== 'UPDATE') {
    return 'none';
  }

  // No base snapshot means we can't detect conflicts
  if (!op.base_snapshot) {
    return 'none';
  }

  const criticalFields = CRITICAL_FIELDS[op.table] || [];
  const changedFields = Object.keys(op.data);

  // Check if remote has changed since our base snapshot
  const remoteChangedFields = getChangedFields(op.base_snapshot, remoteState);

  if (remoteChangedFields.length === 0) {
    // Remote hasn't changed, no conflict
    return 'none';
  }

  // Check if we're changing any fields that remote also changed
  const conflictingFields = changedFields.filter((field) =>
    remoteChangedFields.includes(field)
  );

  if (conflictingFields.length === 0) {
    // No overlapping changes, no conflict
    return 'none';
  }

  // Check if any conflicting fields are critical
  const hasCriticalConflict = conflictingFields.some((field) =>
    criticalFields.includes(field)
  );

  return hasCriticalConflict ? 'critical' : 'non_critical';
}

/**
 * Gets detailed information about a conflict
 */
export function getConflictDetails(
  op: Pick<SyncOperation, 'type' | 'table' | 'data' | 'base_snapshot'>,
  remoteState: Record<string, unknown>
): ConflictDetails {
  const conflictType = detectConflict(op, remoteState);

  if (conflictType === 'none' || !op.base_snapshot) {
    return {
      type: 'none',
      conflictingFields: [],
      localValues: {},
      remoteValues: {},
      baseValues: {},
    };
  }

  const changedFields = Object.keys(op.data);
  const remoteChangedFields = getChangedFields(op.base_snapshot, remoteState);
  const conflictingFields = changedFields.filter((field) =>
    remoteChangedFields.includes(field)
  );

  const localValues: Record<string, unknown> = {};
  const remoteValues: Record<string, unknown> = {};
  const baseValues: Record<string, unknown> = {};

  for (const field of conflictingFields) {
    localValues[field] = op.data[field];
    remoteValues[field] = remoteState[field];
    baseValues[field] = op.base_snapshot[field];
  }

  return {
    type: conflictType,
    conflictingFields,
    localValues,
    remoteValues,
    baseValues,
  };
}

/**
 * Gets the list of fields that changed between two states
 */
function getChangedFields(
  baseState: Record<string, unknown>,
  currentState: Record<string, unknown>
): string[] {
  const changedFields: string[] = [];

  for (const key of Object.keys(currentState)) {
    if (!isEqual(baseState[key], currentState[key])) {
      changedFields.push(key);
    }
  }

  return changedFields;
}

/**
 * Deep equality check for values
 */
function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;

  if (typeof a === 'object' && typeof b === 'object') {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);

    if (aKeys.length !== bKeys.length) return false;

    return aKeys.every((key) => isEqual(aObj[key], bObj[key]));
  }

  return false;
}

// ============================================================================
// CONFLICT RESOLUTION STRATEGIES
// REQ-SYNC-007: Conflict Resolution Strategy
// ============================================================================

/**
 * Resolution strategy types
 * - 'server_wins': Server value takes precedence (default for non-critical, non-mergeable)
 * - 'user_chooses': User must manually resolve (for critical fields)
 * - 'auto_merge': Automatically merge changes (for mergeable fields)
 */
export type ResolutionStrategy = 'server_wins' | 'user_chooses' | 'auto_merge';

/**
 * Result of auto-merge operation
 */
export interface AutoMergeResult {
  success: boolean;
  mergedData: Record<string, unknown>;
  requiresUserChoice: string[];  // Fields that couldn't be auto-merged
  autoMergedFields: string[];    // Fields that were auto-merged
  serverWinsFields: string[];    // Fields where server value was used
}

/**
 * Determines the resolution strategy for a specific field
 * REQ-SYNC-007: Define resolution strategy per field type
 */
export function getFieldResolutionStrategy(table: string, field: string): ResolutionStrategy {
  const criticalFields = CRITICAL_FIELDS[table] || [];
  const mergeableFields = MERGEABLE_FIELDS[table] || [];
  
  if (criticalFields.includes(field)) {
    return 'user_chooses';
  }
  
  if (mergeableFields.includes(field)) {
    return 'auto_merge';
  }
  
  // Default: server wins for unknown fields
  return 'server_wins';
}

/**
 * Applies last-write-wins strategy for non-critical fields
 * Local changes overwrite remote changes
 */
export function applyLastWriteWins(
  localData: Record<string, unknown>,
  remoteState: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...remoteState,
    ...localData,
  };
}

/**
 * Auto-merges non-critical fields, returns fields requiring user choice
 * REQ-SYNC-007: Auto-merge for non-critical fields
 * 
 * Strategy:
 * - CRITICAL_FIELDS: Require user choice if both local and remote changed
 * - MERGEABLE_FIELDS: Auto-merge (local wins if local changed, else remote)
 * - Other fields: Server wins
 */
export function autoMergeChanges(
  table: string,
  localData: Record<string, unknown>,
  remoteState: Record<string, unknown>,
  baseSnapshot: Record<string, unknown>
): AutoMergeResult {
  const result: Record<string, unknown> = { ...remoteState };
  const requiresUserChoice: string[] = [];
  const autoMergedFields: string[] = [];
  const serverWinsFields: string[] = [];
  
  const criticalFields = CRITICAL_FIELDS[table] || [];
  const mergeableFields = MERGEABLE_FIELDS[table] || [];
  
  // Get all fields that were changed locally
  const localChangedFields = Object.keys(localData).filter(
    field => !isEqual(localData[field], baseSnapshot[field])
  );
  
  for (const field of localChangedFields) {
    const localValue = localData[field];
    const remoteValue = remoteState[field];
    const baseValue = baseSnapshot[field];
    
    const localChanged = !isEqual(localValue, baseValue);
    const remoteChanged = !isEqual(remoteValue, baseValue);
    
    if (!localChanged) {
      // Local didn't change this field, keep remote
      continue;
    }
    
    if (!remoteChanged) {
      // Remote didn't change, use local value
      result[field] = localValue;
      autoMergedFields.push(field);
      continue;
    }
    
    // Both changed - determine strategy based on field type
    if (criticalFields.includes(field)) {
      // Critical field with conflict - requires user choice
      requiresUserChoice.push(field);
      // Keep remote value for now, user will decide
    } else if (mergeableFields.includes(field)) {
      // Mergeable field - local wins (last-write-wins for mergeable)
      result[field] = localValue;
      autoMergedFields.push(field);
    } else {
      // Unknown field - server wins
      serverWinsFields.push(field);
    }
  }
  
  return {
    success: requiresUserChoice.length === 0,
    mergedData: result,
    requiresUserChoice,
    autoMergedFields,
    serverWinsFields,
  };
}

/**
 * Merges local and remote changes, preferring local for specified fields
 */
export function mergeChanges(
  localData: Record<string, unknown>,
  remoteState: Record<string, unknown>,
  baseSnapshot: Record<string, unknown>,
  preferLocalFields: string[] = []
): Record<string, unknown> {
  const result = { ...remoteState };

  for (const [key, localValue] of Object.entries(localData)) {
    const baseValue = baseSnapshot[key];
    const remoteValue = remoteState[key];

    // If local changed and remote didn't, use local
    if (!isEqual(localValue, baseValue) && isEqual(remoteValue, baseValue)) {
      result[key] = localValue;
    }
    // If remote changed and local didn't, use remote (already in result)
    else if (isEqual(localValue, baseValue) && !isEqual(remoteValue, baseValue)) {
      // Keep remote value
    }
    // If both changed, prefer local for specified fields
    else if (preferLocalFields.includes(key)) {
      result[key] = localValue;
    }
    // Otherwise keep remote (default)
  }

  return result;
}

/**
 * Applies user's resolution choice to a conflict
 * @param localValue - The local value
 * @param serverValue - The server value
 * @param resolution - 'local' keeps local value, 'server' keeps server value
 */
export function applyResolution(
  localValue: unknown,
  serverValue: unknown,
  resolution: 'local' | 'server'
): unknown {
  return resolution === 'local' ? localValue : serverValue;
}

/**
 * Resolves all conflicts in a sync operation based on user choices
 */
export function resolveAllConflicts(
  table: string,
  localData: Record<string, unknown>,
  remoteState: Record<string, unknown>,
  baseSnapshot: Record<string, unknown>,
  userChoices: Record<string, 'local' | 'server'>
): Record<string, unknown> {
  // First, auto-merge what we can
  const autoMergeResult = autoMergeChanges(table, localData, remoteState, baseSnapshot);
  const result = { ...autoMergeResult.mergedData };
  
  // Apply user choices for critical fields
  for (const [field, choice] of Object.entries(userChoices)) {
    result[field] = applyResolution(
      localData[field],
      remoteState[field],
      choice
    );
  }
  
  return result;
}

/**
 * Checks if a field is critical for a given table
 */
export function isCriticalField(table: string, field: string): boolean {
  const criticalFields = CRITICAL_FIELDS[table] || [];
  return criticalFields.includes(field);
}

/**
 * Gets all critical fields for a table
 */
export function getCriticalFields(table: string): string[] {
  return CRITICAL_FIELDS[table] || [];
}

/**
 * Gets all non-critical fields for a table
 */
export function getNonCriticalFields(table: string): string[] {
  return NON_CRITICAL_FIELDS[table] || [];
}

// ============================================================================
// CONFLICT DISPLAY HELPERS
// ============================================================================

/**
 * Formats a conflict for display in the UI
 */
export interface FormattedConflict {
  field: string;
  fieldLabel: string;
  isCritical: boolean;
  localValue: string;
  remoteValue: string;
  baseValue: string;
}

/**
 * Field labels for display (French)
 */
const FIELD_LABELS: Record<string, string> = {
  // Delivery fields
  weight_kg: 'Poids (kg)',
  price_per_kg: 'Prix/kg (XAF)',
  total_amount: 'Montant total (XAF)',
  payment_status: 'Statut paiement',
  payment_amount_paid: 'Montant payé (XAF)',
  notes: 'Notes',
  metadata: 'Métadonnées',
  quality_grade: 'Grade qualité',
  planteur_id: 'Planteur',
  // Planteur fields
  chef_planteur_id: 'Chef planteur',
  // Chef planteur fields
  cooperative_id: 'Coopérative',
  quantite_max_kg: 'Quantité max (kg)',
  validation_status: 'Statut validation',
  // Common fields
  phone: 'Téléphone',
  cni: 'CNI',
  latitude: 'Latitude',
  longitude: 'Longitude',
  name: 'Nom',
  region: 'Région',
  departement: 'Département',
  localite: 'Localité',
};

/**
 * Gets the display label for a field
 */
export function getFieldLabel(field: string): string {
  return FIELD_LABELS[field] || field;
}

/**
 * Extended formatted conflict with resolution strategy
 */
export interface FormattedConflictWithStrategy extends FormattedConflict {
  resolutionStrategy: ResolutionStrategy;
}

/**
 * Formats conflict details for UI display with resolution strategy
 */
export function formatConflictForDisplay(
  table: string,
  details: ConflictDetails
): FormattedConflictWithStrategy[] {
  return details.conflictingFields.map((field) => ({
    field,
    fieldLabel: FIELD_LABELS[field] || field,
    isCritical: isCriticalField(table, field),
    localValue: formatValue(details.localValues[field]),
    remoteValue: formatValue(details.remoteValues[field]),
    baseValue: formatValue(details.baseValues[field]),
    resolutionStrategy: getFieldResolutionStrategy(table, field),
  }));
}

/**
 * Checks if a field is mergeable for a given table
 */
export function isMergeableField(table: string, field: string): boolean {
  const mergeableFields = MERGEABLE_FIELDS[table] || [];
  return mergeableFields.includes(field);
}

/**
 * Gets all mergeable fields for a table
 */
export function getMergeableFields(table: string): string[] {
  return MERGEABLE_FIELDS[table] || [];
}

/**
 * Formats a value for display
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '(vide)';
  }
  if (typeof value === 'number') {
    return value.toLocaleString('fr-FR');
  }
  if (typeof value === 'boolean') {
    return value ? 'Oui' : 'Non';
  }
  return String(value);
}
