// CocoaTrack V2 - Role-Based Permissions
// Defines what each role can do in the application

/**
 * Role hierarchy (highest to lowest):
 * - admin: Full access to everything
 * - manager: CRUD operations on data
 * - agent: Legacy role (same as manager)
 * - viewer: Read-only access
 */

// Extended type to include legacy 'agent' role from database
export type ExtendedUserRole = 'admin' | 'manager' | 'agent' | 'viewer';

export const ROLE_HIERARCHY: Record<ExtendedUserRole, number> = {
  admin: 3,
  manager: 2,
  agent: 2, // Same level as manager
  viewer: 1,
};

export type Permission = 
  // Users
  | 'users:read'
  | 'users:create'
  | 'users:update'
  | 'users:delete'
  // Planteurs
  | 'planteurs:read'
  | 'planteurs:create'
  | 'planteurs:update'
  | 'planteurs:delete'
  // Chef Planteurs
  | 'chef_planteurs:read'
  | 'chef_planteurs:create'
  | 'chef_planteurs:update'
  | 'chef_planteurs:delete'
  | 'chef_planteurs:validate'
  // Parcelles
  | 'parcelles:read'
  | 'parcelles:create'
  | 'parcelles:update'
  | 'parcelles:delete'
  | 'parcelles:import'
  // Deliveries
  | 'deliveries:read'
  | 'deliveries:create'
  | 'deliveries:update'
  | 'deliveries:delete'
  // Invoices
  | 'invoices:read'
  | 'invoices:create'
  | 'invoices:update'
  | 'invoices:delete'
  // Cooperatives
  | 'cooperatives:read'
  | 'cooperatives:create'
  | 'cooperatives:update'
  | 'cooperatives:delete'
  // Regions
  | 'regions:read'
  | 'regions:create'
  | 'regions:update'
  | 'regions:delete'
  // Settings
  | 'settings:read'
  | 'settings:update'
  // Audit
  | 'audit:read'
  // Export
  | 'export:csv'
  | 'export:excel'
  | 'export:pdf';

const MANAGER_PERMISSIONS: Permission[] = [
  'users:read',
  'planteurs:read', 'planteurs:create', 'planteurs:update', 'planteurs:delete',
  'chef_planteurs:read', 'chef_planteurs:create', 'chef_planteurs:update', 'chef_planteurs:delete',
  'parcelles:read', 'parcelles:create', 'parcelles:update', 'parcelles:delete', 'parcelles:import',
  'deliveries:read', 'deliveries:create', 'deliveries:update', 'deliveries:delete',
  'invoices:read', 'invoices:create', 'invoices:update', 'invoices:delete',
  'cooperatives:read',
  'regions:read',
  'settings:read',
  'audit:read',
  'export:csv', 'export:excel', 'export:pdf',
];

/**
 * Permissions by role
 */
export const ROLE_PERMISSIONS: Record<ExtendedUserRole, Permission[]> = {
  admin: [
    // Full access to everything
    'users:read', 'users:create', 'users:update', 'users:delete',
    'planteurs:read', 'planteurs:create', 'planteurs:update', 'planteurs:delete',
    'chef_planteurs:read', 'chef_planteurs:create', 'chef_planteurs:update', 'chef_planteurs:delete', 'chef_planteurs:validate',
    'parcelles:read', 'parcelles:create', 'parcelles:update', 'parcelles:delete', 'parcelles:import',
    'deliveries:read', 'deliveries:create', 'deliveries:update', 'deliveries:delete',
    'invoices:read', 'invoices:create', 'invoices:update', 'invoices:delete',
    'cooperatives:read', 'cooperatives:create', 'cooperatives:update', 'cooperatives:delete',
    'regions:read', 'regions:create', 'regions:update', 'regions:delete',
    'settings:read', 'settings:update',
    'audit:read',
    'export:csv', 'export:excel', 'export:pdf',
  ],
  manager: MANAGER_PERMISSIONS,
  agent: MANAGER_PERMISSIONS, // Legacy role - same permissions as manager
  viewer: [
    // Read-only access
    'users:read',
    'planteurs:read',
    'chef_planteurs:read',
    'parcelles:read',
    'deliveries:read',
    'invoices:read',
    'cooperatives:read',
    'regions:read',
    'audit:read',
    'export:csv', 'export:excel', 'export:pdf',
  ],
};

/**
 * Role display names
 */
export const ROLE_DISPLAY_NAMES: Record<ExtendedUserRole, string> = {
  admin: 'Administrateur',
  manager: 'Gestionnaire',
  agent: 'Agent', // Legacy
  viewer: 'Lecteur',
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: ExtendedUserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Check if a role can perform write operations
 */
export function canWrite(role: ExtendedUserRole): boolean {
  return role === 'admin' || role === 'manager' || role === 'agent';
}

/**
 * Check if a role is admin
 */
export function isAdmin(role: ExtendedUserRole): boolean {
  return role === 'admin';
}

/**
 * Check if roleA has higher or equal privileges than roleB
 */
export function hasHigherOrEqualRole(roleA: ExtendedUserRole, roleB: ExtendedUserRole): boolean {
  return ROLE_HIERARCHY[roleA] >= ROLE_HIERARCHY[roleB];
}

/**
 * Get role display name in French
 */
export function getRoleDisplayName(role: ExtendedUserRole): string {
  return ROLE_DISPLAY_NAMES[role] || role;
}

/**
 * Get role description in French
 */
export function getRoleDescription(role: ExtendedUserRole): string {
  const descriptions: Record<ExtendedUserRole, string> = {
    admin: 'Accès complet à toutes les fonctionnalités',
    manager: 'Gestion des planteurs, livraisons et factures',
    agent: 'Gestion des planteurs, livraisons et factures',
    viewer: 'Consultation des données uniquement',
  };
  return descriptions[role] || '';
}
