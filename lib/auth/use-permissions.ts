// CocoaTrack V2 - Permissions Hook
// React hook for checking user permissions

'use client';

import { useMemo } from 'react';

import { useAuth } from './context';
import { 
  hasPermission, 
  canWrite, 
  isAdmin, 
  ROLE_PERMISSIONS,
  type Permission,
  type ExtendedUserRole,
} from './permissions';

/**
 * Hook to check user permissions
 */
export function usePermissions() {
  const { user } = useAuth();
  const role = (user?.role ?? 'viewer') as ExtendedUserRole;

  return useMemo(() => ({
    /**
     * Check if user has a specific permission
     */
    can: (permission: Permission) => hasPermission(role, permission),
    
    /**
     * Check if user can write (create/update/delete)
     */
    canWrite: () => canWrite(role),
    
    /**
     * Check if user is admin
     */
    isAdmin: () => isAdmin(role),
    
    /**
     * Get all permissions for current user
     */
    permissions: ROLE_PERMISSIONS[role] ?? [],
    
    /**
     * Current user role
     */
    role,
  }), [role]);
}

/**
 * Hook to check a single permission
 */
export function useCanDo(permission: Permission): boolean {
  const { can } = usePermissions();
  return can(permission);
}
