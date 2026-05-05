/**
 * GET /api/satellite/cache
 * 
 * Retrieves Redis cache statistics for monitoring cache performance.
 * Returns hit rate, total hits, misses, and errors.
 * 
 * DELETE /api/satellite/cache
 * 
 * Clears all temporal caches (admin operation).
 * Requires authentication and admin role.
 * 
 * Requirements: Task 3.2.2
 * - Monitor cache performance
 * - Admin cache management
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redisCacheService } from '@/lib/satellite/services/redis-cache.service';

/**
 * GET handler for cache statistics
 */
export async function GET(request: NextRequest) {
  try {
    // Get cache statistics
    const stats = redisCacheService.getCacheStats();
    const isAvailable = redisCacheService.isAvailable();

    return NextResponse.json(
      {
        success: true,
        data: {
          redis: {
            available: isAvailable,
            status: isAvailable ? 'connected' : 'disconnected',
          },
          stats: {
            hits: stats.hits,
            misses: stats.misses,
            errors: stats.errors,
            hitRate: stats.hitRate,
            total: stats.hits + stats.misses,
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Cache API] Error retrieving cache stats:', error);
    return NextResponse.json(
      {
        error: 'Failed to retrieve cache statistics',
        code: 'INTERNAL_SERVER_ERROR',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE handler for clearing all temporal caches
 * 
 * Admin operation - requires authentication and admin role
 */
export async function DELETE(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
        },
        { status: 401 }
      );
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single<{ role: string }>();

    if (profileError || !profile) {
      return NextResponse.json(
        {
          error: 'Failed to verify user permissions',
          code: 'FORBIDDEN',
        },
        { status: 403 }
      );
    }

    // Only admins can clear cache
    if (profile.role !== 'admin') {
      return NextResponse.json(
        {
          error: 'Admin role required to clear cache',
          code: 'FORBIDDEN',
        },
        { status: 403 }
      );
    }

    // Clear all temporal caches
    const deletedCount = await redisCacheService.clearAllTemporalCaches();

    console.log(`[Cache API] Admin ${user.id} cleared ${deletedCount} cache entries`);

    return NextResponse.json(
      {
        success: true,
        data: {
          message: 'All temporal caches cleared successfully',
          deletedCount,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Cache API] Error clearing cache:', error);
    return NextResponse.json(
      {
        error: 'Failed to clear cache',
        code: 'INTERNAL_SERVER_ERROR',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
