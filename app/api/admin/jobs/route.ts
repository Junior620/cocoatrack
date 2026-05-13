// CocoaTrack V2 - Job Monitoring API
// Provides job execution statistics and health monitoring
// Task: 4.5.2 - Implement job monitoring

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { jobMonitoringService } from '@/lib/satellite/jobs/job-monitoring.service';

/**
 * GET /api/admin/jobs
 * 
 * Get job execution statistics and health status
 * 
 * Query parameters:
 * - jobType: Filter by job type (optional)
 * - days: Number of days to look back (default: 7)
 * 
 * Returns:
 * - statistics: Job execution statistics
 * - health: Job health status
 * - recentExecutions: Recent job executions
 */
export async function GET(request: NextRequest) {
  try {
    // Verify user is authenticated and is admin
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || (profile as { role: string }).role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const jobType = searchParams.get('jobType') || 'deforestation_detection';
    const days = parseInt(searchParams.get('days') || '7', 10);

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get job statistics
    const statistics = await jobMonitoringService.getJobStatistics(
      jobType,
      startDate,
      endDate
    );

    // Get job health status
    const health = await jobMonitoringService.getJobHealthStatus(jobType, days);

    // Get recent executions from database
    const { data: recentExecutions, error: executionsError } = await supabase
      .from('job_executions')
      .select('*')
      .eq('job_type', jobType as 'deforestation_detection' | 'notification_digest' | 'cache_cleanup' | 'data_archival')
      .order('started_at', { ascending: false })
      .limit(10);

    if (executionsError) {
      console.error('[Admin Jobs API] Error fetching recent executions:', executionsError);
    }

    return NextResponse.json({
      success: true,
      data: {
        jobType,
        period: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          days,
        },
        statistics,
        health,
        recentExecutions: recentExecutions || [],
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Admin Jobs API] Error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
