/**
 * Cache Warming API Endpoint
 * 
 * This endpoint triggers the cache warming background job.
 * It can be called manually or by a cron job scheduler.
 * 
 * Requirements: Task 6.2.4
 * - Provide API endpoint to trigger cache warming
 * - Authenticate requests (API key or cron secret)
 * - Return job execution results
 * 
 * Security:
 * - Requires CRON_SECRET environment variable for authentication
 * - Only accessible via POST with correct secret
 */

import { NextRequest, NextResponse } from 'next/server';
import { cacheWarmingService } from '@/lib/satellite/services/cache-warming.service';

/**
 * POST /api/satellite/cache-warming
 * 
 * Triggers the cache warming background job.
 * 
 * Authentication:
 * - Requires Authorization header with Bearer token matching CRON_SECRET
 * - Or x-cron-secret header matching CRON_SECRET
 * 
 * @returns Cache warming job result
 * 
 * @example
 * ```bash
 * curl -X POST https://your-domain.com/api/satellite/cache-warming \
 *   -H "Authorization: Bearer your-cron-secret"
 * ```
 */
export async function POST(request: NextRequest) {
  try {
    // Step 1: Authenticate request
    const isAuthenticated = authenticateRequest(request);
    
    if (!isAuthenticated) {
      return NextResponse.json(
        { error: 'Unauthorized. Invalid or missing CRON_SECRET.' },
        { status: 401 }
      );
    }

    console.log('[Cache Warming API] Starting cache warming job');

    // Step 2: Run cache warming job
    const result = await cacheWarmingService.runCacheWarmingJob();

    // Step 3: Return results
    return NextResponse.json({
      success: true,
      message: 'Cache warming job completed',
      result: {
        duration: result.duration,
        totalParcelles: result.totalParcelles,
        successCount: result.successCount,
        failureCount: result.failureCount,
        statistics: result.statistics,
        startTime: result.startTime.toISOString(),
        endTime: result.endTime.toISOString(),
      },
    }, { status: 200 });

  } catch (error) {
    console.error('[Cache Warming API] Error running cache warming job:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Cache warming job failed',
        message: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

/**
 * Authenticate cache warming request
 * 
 * Checks for CRON_SECRET in:
 * 1. Authorization header (Bearer token)
 * 2. x-cron-secret header
 * 
 * @param request - Next.js request object
 * @returns True if authenticated, false otherwise
 */
function authenticateRequest(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;

  // If no CRON_SECRET is configured, reject all requests
  if (!cronSecret) {
    console.error('[Cache Warming API] CRON_SECRET not configured');
    return false;
  }

  // Check Authorization header (Bearer token)
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    if (token === cronSecret) {
      return true;
    }
  }

  // Check x-cron-secret header
  const cronSecretHeader = request.headers.get('x-cron-secret');
  if (cronSecretHeader === cronSecret) {
    return true;
  }

  return false;
}

/**
 * GET /api/satellite/cache-warming
 * 
 * Returns information about the cache warming endpoint.
 * Does not trigger the job (use POST for that).
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/satellite/cache-warming',
    method: 'POST',
    description: 'Triggers cache warming background job for favorite parcelles',
    authentication: 'Requires CRON_SECRET in Authorization header or x-cron-secret header',
    schedule: 'Daily at 2:00 AM UTC',
    features: [
      'Pre-caches recent imagery (last 30 days)',
      'Pre-calculates NDVI for recent dates',
      'Pre-generates temporal data (last 3 months)',
      'Processes top 20 most recently accessed parcelles',
    ],
  }, { status: 200 });
}
