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
  requiredRoles?: ExtendedUserRole[];
  requiredPermission?: Permission;
  fallback?: React.ReactNode;
  redirectTo?: string;
}

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
    if (!isAuthenticated || !user) {
      router.push(redirectTo);
      return;
    }
    if (requiredRoles && requiredRoles.length > 0) {
      if (!requiredRoles.includes(user.role as ExtendedUserRole)) {
        router.push('/unauthorized');
        return;
      }
    }
    if (requiredPermission) {
      if (!hasPermission(user.role as ExtendedUserRole, requiredPermission)) {
        router.push('/unauthorized');
        return;
      }
    }
  }, [isLoading, isAuthenticated, user, requiredRoles, requiredPermission, router, redirectTo]);

  // If we already have a user (from server-side initialProfile),
  // render children immediately, avoids spinner and hydration mismatch.
  if (user && isAuthenticated) {
    if (requiredRoles && requiredRoles.length > 0) {
      if (!requiredRoles.includes(user.role as ExtendedUserRole)) return null;
    }
    if (requiredPermission) {
      if (!hasPermission(user.role as ExtendedUserRole, requiredPermission)) return null;
    }
    return <>{children}</>;
  }

  // Still loading with no user yet, only shown on very first load without server profile
  if (isLoading) {
    return fallback || <LoadingSpinner />;
  }

  // Not authenticated, redirect handled by useEffect
  return fallback || <LoadingSpinner />;
}

function LoadingSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
    </div>
  );
}

export function useHasPermission(permission: Permission): boolean {
  const { user } = useAuth();
  if (!user) return false;
  return hasPermission(user.role as ExtendedUserRole, permission);
}

export function useHasRole(roles: ExtendedUserRole[]): boolean {
  const { user } = useAuth();
  if (!user) return false;
  return roles.includes(user.role as ExtendedUserRole);
}
