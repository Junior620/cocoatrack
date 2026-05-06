// CocoaTrack V2 - Job Execution Details API
// Provides detailed information about a specific job execution
// Task: 4.5.2 - Implement job monitoring

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { jobMonitoringService } from '@/lib/satellite/jobs/job-monitoring.service';

/**
 * GET /api/admin/jobs/[executionId]
 * 
 * Get detailed information about a specific job execution
 * 
 * Returns:
 * - execution: Job execution record from database
 * - metrics: Calculated metrics (success rate, etc.)
 * - logs: Execution logs (if available in memory)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ executionId: string }> }
) {
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

    const { executionId } = await params;

    // Get job execution from database
    const { data: execution, error: executionError } = await supabase
      .from('job_executions')
      .select('*')
      .eq('id', executionId)
      .single();

    if (executionError || !execution) {
      return NextResponse.json(
        { error: 'Job execution not found' },
        { status: 404 }
      );
    }

    // Get job metrics
    const metrics = await jobMonitoringService.getJobMetrics(executionId);

    // Get logs (if available in memory)
    const logs = jobMonitoringService.getJobLogs(executionId);

    return NextResponse.json({
      success: true,
      data: {
        execution,
        metrics,
        logs: logs.length > 0 ? logs : null,
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
