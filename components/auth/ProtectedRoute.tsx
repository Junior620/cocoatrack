'use client';

// CocoaTrack V2 - Protected Route Component
// Restricts access based on authentication and permissions

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useAuth } from '@/lib/auth';
import { hasPermission } from '@/lib/auth/permissions';

import type { Permission, ExtendedUserRole } from '@/lib/auth/permissions';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Required role(s) to access this route */
  requiredRoles?: ExtendedUserRole[];
  /** Required permission to access this route (format: 'resource:action') */
  requiredPermission?: Permission;
  /** Fallback component to show while loading */
  fallback?: React.ReactNode;
  /** URL to redirect to if unauthorized */
  redirectTo?: string;
}

/**
 * Protects a route based on authentication and optional role/permission requirements
 */
export function ProtectedRoute({
  children,
  requiredRoles,
  requiredPermission,
  fallback,
  redirectTo = '/login',
}: ProtectedRouteProps) {
  const router = useRouter();
  const { user, isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    // Redirect if not authenticated
    if (!isAuthenticated || !user) {
      router.push(redirectTo);
      return;
    }

    // Check role requirement
    if (requiredRoles && requiredRoles.length > 0) {
      if (!requiredRoles.includes(user.role as ExtendedUserRole)) {
        router.push('/unauthorized');
        return;
      }
    }

    // Check permission requirement
    if (requiredPermission) {
      if (!hasPermission(user.role as ExtendedUserRole, requiredPermission)) {
        router.push('/unauthorized');
        return;
      }
    }
  }, [isLoading, isAuthenticated, user, requiredRoles, requiredPermission, router, redirectTo]);

  // Show loading state
  if (isLoading) {
    return fallback || <LoadingSpinner />;
  }

  // Don't render children if not authenticated
  if (!isAuthenticated || !user) {
    return fallback || <LoadingSpinner />;
  }

  // Check role requirement
  if (requiredRoles && requiredRoles.length > 0) {
    if (!requiredRoles.includes(user.role as ExtendedUserRole)) {
      return null;
    }
  }

  // Check permission requirement
  if (requiredPermission) {
    if (!hasPermission(user.role as ExtendedUserRole, requiredPermission)) {
      return null;
    }
  }

  return <>{children}</>;
}

/**
 * Default loading spinner component
 */
function LoadingSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
    </div>
  );
}

/**
 * Hook to check if current user has a specific permission
 */
export function useHasPermission(permission: Permission): boolean {
  const { user } = useAuth();
  if (!user) return false;
  return hasPermission(user.role as ExtendedUserRole, permission);
}

/**
 * Hook to check if current user has one of the required roles
 */
export function useHasRole(roles: ExtendedUserRole[]): boolean {
  const { user } = useAuth();
  if (!user) return false;
  return roles.includes(user.role as ExtendedUserRole);
}
