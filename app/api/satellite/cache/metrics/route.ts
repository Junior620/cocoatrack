/**
 * Cache Metrics API Endpoint
 * 
 * GET /api/satellite/cache/metrics
 * 
 * Returns current cache performance metrics including:
 * - Hit rate statistics
 * - Memory usage
 * - Cache size and entry counts
 * - Active alerts
 * - Performance history
 * 
 * Requirements: Task 6.2.5
 * - Expose cache monitoring data via API
 * - Support admin access only
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getCacheMonitor } from '@/lib/satellite/services/cache-monitor.service';
import type { Database } from '@/types/database.gen';

type UserRole = Database['public']['Enums']['user_role'];

/**
 * GET /api/satellite/cache/metrics
 * 
 * Retrieve current cache performance metrics
 * 
 * Query Parameters:
 * - includeHistory: boolean - Include performance history (default: false)
 * - historyLimit: number - Limit history entries (default: 50)
 * 
 * Returns:
 * - 200: Cache metrics object
 * - 401: Unauthorized (not authenticated)
 * - 403: Forbidden (not admin)
 * - 500: Internal server error
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError) {
      return NextResponse.json(
        { error: 'Failed to retrieve user profile' },
        { status: 500 }
      );
    }

    const profile = profileData as { role: UserRole } | null;

    if (!profile) {
      return NextResponse.json(
        { error: 'Failed to retrieve user profile' },
        { status: 500 }
      );
    }

    // Only admins can access cache metrics
    if (profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const includeHistory = searchParams.get('includeHistory') === 'true';
    const historyLimit = parseInt(searchParams.get('historyLimit') || '50', 10);

    // Get cache monitor
    const cacheMonitor = getCacheMonitor();

    // Get current metrics
    const metrics = await cacheMonitor.getMetrics();

    // Get health summary
    const health = await cacheMonitor.getHealthSummary();

    // Build response
    const response: any = {
      metrics,
      health,
    };

    // Include performance history if requested
    if (includeHistory) {
      response.history = cacheMonitor.getPerformanceHistory(historyLimit);
    }

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[Cache Metrics API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/satellite/cache/metrics/reset
 * 
 * Reset cache statistics (admin only)
 * 
 * Returns:
 * - 200: Statistics reset successfully
 * - 401: Unauthorized
 * - 403: Forbidden
 * - 500: Internal server error
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError) {
      return NextResponse.json(
        { error: 'Failed to retrieve user profile' },
        { status: 500 }
      );
    }

    const profile = profileData as { role: UserRole } | null;

    if (!profile) {
      return NextResponse.json(
        { error: 'Failed to retrieve user profile' },
        { status: 500 }
      );
    }

    if (profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // Get cache monitor
    const cacheMonitor = getCacheMonitor();

    // Reset statistics
    cacheMonitor.clearHistory();
    cacheMonitor.resetAlertCooldowns();

    // Also reset Redis stats
    const { redisCacheService } = await import('@/lib/satellite/services/redis-cache.service');
    redisCacheService.resetStats();

    return NextResponse.json(
      { message: 'Cache statistics reset successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Cache Metrics API] Error resetting stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
