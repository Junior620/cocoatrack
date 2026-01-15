// CocoaTrack V2 - Auth Exports
// Re-exports all auth utilities

export { AuthProvider, useAuth } from './context';
export { usePermissions, useCanDo } from './use-permissions';
export {
  hasPermission,
  isAdmin,
  canWrite,
  hasHigherOrEqualRole,
  getRoleDisplayName,
  getRoleDescription,
  ROLE_PERMISSIONS,
  ROLE_HIERARCHY,
  ROLE_DISPLAY_NAMES,
} from './permissions';
export type { AuthContextValue, AuthState, AuthUser, SignInCredentials, UserRole } from './types';
export type { Permission, ExtendedUserRole } from './permissions';
