/**
 * Audit Log API
 * Provides functions to query and export audit logs
 */

import { createClient } from '@/lib/supabase/client';

export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE';

export interface AuditLogEntry {
  id: string;
  actor_id: string | null;
  actor_type: string;
  actor_name: string;
  actor_email: string | null;
  table_name: string;
  row_id: string;
  action: AuditAction;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface AuditLogFilters {
  table_name?: string;
  row_id?: string;
  actor_id?: string;
  action?: AuditAction;
  start_date?: string;
  end_date?: string;
}

export interface PaginatedAuditLogs {
  data: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Fetch audit logs with filters and pagination
 */
export async function getAuditLogs(
  filters: AuditLogFilters = {},
  page: number = 1,
  pageSize: number = 20
): Promise<PaginatedAuditLogs> {
  const supabase = createClient();
  const offset = (page - 1) * pageSize;

  // Get audit logs with actor info using the RPC function
  const { data, error } = await (supabase.rpc as unknown as (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{ data: AuditLogEntry[] | null; error: Error | null }>)(
    'get_audit_logs_with_actor',
    {
      p_table_name: filters.table_name ?? null,
      p_row_id: filters.row_id ?? null,
      p_actor_id: filters.actor_id ?? null,
      p_action: filters.action ?? null,
      p_start_date: filters.start_date ?? null,
      p_end_date: filters.end_date ?? null,
      p_limit: pageSize,
      p_offset: offset,
    }
  );

  if (error) {
    console.error('Error fetching audit logs:', error);
    throw new Error(`Failed to fetch audit logs: ${error.message}`);
  }

  // Get total count for pagination
  const { data: countData, error: countError } = await (supabase.rpc as unknown as (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{ data: number | null; error: Error | null }>)(
    'count_audit_logs',
    {
      p_table_name: filters.table_name ?? null,
      p_row_id: filters.row_id ?? null,
      p_actor_id: filters.actor_id ?? null,
      p_action: filters.action ?? null,
      p_start_date: filters.start_date ?? null,
      p_end_date: filters.end_date ?? null,
    }
  );

  if (countError) {
    console.error('Error counting audit logs:', countError);
    throw new Error(`Failed to count audit logs: ${countError.message}`);
  }

  const total = countData || 0;

  return {
    data: data || [],
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Get audit history for a specific record
 */
export async function getRecordAuditHistory(
  tableName: string,
  rowId: string
): Promise<AuditLogEntry[]> {
  const supabase = createClient();

  const { data, error } = await (supabase.rpc as unknown as (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{ data: AuditLogEntry[] | null; error: Error | null }>)(
    'get_audit_logs_with_actor',
    {
      p_table_name: tableName,
      p_row_id: rowId,
      p_actor_id: null,
      p_action: null,
      p_start_date: null,
      p_end_date: null,
      p_limit: 100,
      p_offset: 0,
    }
  );

  if (error) {
    console.error('Error fetching record audit history:', error);
    throw new Error(`Failed to fetch audit history: ${error.message}`);
  }

  return data || [];
}

/**
 * Get list of unique users who have performed actions (for filter dropdown)
 */
export async function getAuditActors(): Promise<{ id: string; name: string; email: string }[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .order('full_name');

  if (error) {
    console.error('Error fetching audit actors:', error);
    throw new Error(`Failed to fetch actors: ${error.message}`);
  }

  return ((data || []) as { id: string; full_name: string; email: string }[]).map((p) => ({
    id: p.id,
    name: p.full_name,
    email: p.email,
  }));
}

/**
 * Get list of audited tables (for filter dropdown)
 */
export function getAuditedTables(): string[] {
  return [
    'deliveries',
    'planteurs',
    'chef_planteurs',
    'invoices',
    'profiles',
    'warehouses',
    'cooperatives',
  ];
}

/**
 * Export audit logs to CSV format
 */
export async function exportAuditLogsToCSV(
  filters: AuditLogFilters = {}
): Promise<string> {
  const supabase = createClient();

  // Fetch all matching logs (up to 10000 for export)
  const { data, error } = await (supabase.rpc as unknown as (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{ data: AuditLogEntry[] | null; error: Error | null }>)(
    'get_audit_logs_with_actor',
    {
      p_table_name: filters.table_name ?? null,
      p_row_id: filters.row_id ?? null,
      p_actor_id: filters.actor_id ?? null,
      p_action: filters.action ?? null,
      p_start_date: filters.start_date ?? null,
      p_end_date: filters.end_date ?? null,
      p_limit: 10000,
      p_offset: 0,
    }
  );

  if (error) {
    console.error('Error exporting audit logs:', error);
    throw new Error(`Failed to export audit logs: ${error.message}`);
  }

  const logs = data || [];
  
  if (logs.length === 0) {
    return 'No audit logs found matching the criteria';
  }

  // CSV header
  const headers = [
    'ID',
    'Date/Time',
    'Actor Name',
    'Actor Email',
    'Actor Type',
    'Table',
    'Row ID',
    'Action',
    'IP Address',
    'Changes',
  ];

  // Format data rows
  const rows = logs.map((log: AuditLogEntry) => {
    const changes = formatChanges(log.action, log.old_data, log.new_data);
    return [
      log.id,
      new Date(log.created_at).toISOString(),
      log.actor_name || 'System',
      log.actor_email || '',
      log.actor_type,
      log.table_name,
      log.row_id,
      log.action,
      log.ip_address || '',
      `"${changes.replace(/"/g, '""')}"`, // Escape quotes for CSV
    ];
  });

  // Combine header and rows
  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.join(',')),
  ].join('\n');

  return csvContent;
}

/**
 * Format changes between old and new data for display
 */
export function formatChanges(
  action: AuditAction,
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown> | null
): string {
  if (action === 'INSERT') {
    return 'Record created';
  }

  if (action === 'DELETE') {
    return 'Record deleted';
  }

  if (action === 'UPDATE' && oldData && newData) {
    const changes: string[] = [];
    const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);

    for (const key of allKeys) {
      // Skip metadata fields
      if (['updated_at', 'created_at'].includes(key)) continue;

      const oldValue = oldData[key];
      const newValue = newData[key];

      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes.push(`${key}: ${formatValue(oldValue)} → ${formatValue(newValue)}`);
      }
    }

    return changes.length > 0 ? changes.join('; ') : 'No significant changes';
  }

  return 'Unknown change';
}

/**
 * Format a value for display
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Get a human-readable label for a table name
 */
export function getTableLabel(tableName: string): string {
  const labels: Record<string, string> = {
    deliveries: 'Livraisons',
    planteurs: 'Planteurs',
    chef_planteurs: 'Chef Planteurs',
    invoices: 'Factures',
    profiles: 'Utilisateurs',
    warehouses: 'Entrepôts',
    cooperatives: 'Coopératives',
  };
  return labels[tableName] || tableName;
}

/**
 * Get a human-readable label for an action
 */
export function getActionLabel(action: AuditAction): string {
  const labels: Record<AuditAction, string> = {
    INSERT: 'Création',
    UPDATE: 'Modification',
    DELETE: 'Suppression',
  };
  return labels[action] || action;
}

/**
 * Get action badge color
 */
export function getActionColor(action: AuditAction): string {
  const colors: Record<AuditAction, string> = {
    INSERT: 'bg-green-100 text-green-800',
    UPDATE: 'bg-blue-100 text-blue-800',
    DELETE: 'bg-red-100 text-red-800',
  };
  return colors[action] || 'bg-gray-100 text-gray-800';
}
