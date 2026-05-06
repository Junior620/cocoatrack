// CocoaTrack V2 - Deforestation Detection Cron Job
// Runs periodic deforestation detection on all parcelles
// Task: 4.5.1 - Create periodic deforestation detection job
// Requirement 4: Deforestation Detection

import { NextRequest, NextResponse } from 'next/server';
import { deforestationDetectionJob } from '@/lib/satellite/jobs/deforestation-detection.job';

/**
 * Cron job endpoint to run periodic deforestation detection
 * 
 * This endpoint should be called weekly by:
 * - Vercel Cron (vercel.json configuration)
 * - External cron service (e.g., cron-job.org)
 * - Manual trigger for testing
 * 
 * Security: Protected by CRON_SECRET environment variable
 * 
 * The job:
 * 1. Retrieves all active parcelles
 * 2. Processes parcelles in batches (default: 10 per batch)
 * 3. Detects deforestation by comparing baseline NDVI (Dec 31, 2020) with current NDVI
 * 4. Creates deforestation events and sends notifications
 * 5. Logs execution results to job_executions table
 * 
 * @returns JSON response with processing results
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.error('[Cron] Unauthorized request to deforestation-detection');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    console.log('[Cron] Starting deforestation detection job');
    
    // Run deforestation detection job
    const result = await deforestationDetectionJob.run();
    
    console.log(`[Cron] Deforestation detection job complete: ${result.totalProcessed} processed, ${result.totalFailed} failed, ${result.deforestationDetected} deforestation events detected`);
    
    return NextResponse.json({
      success: result.status !== 'failed',
      status: result.status,
      executionId: result.executionId,
      totalProcessed: result.totalProcessed,
      totalFailed: result.totalFailed,
      deforestationDetected: result.deforestationDetected,
      durationMs: result.durationMs,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Cron] Error running deforestation detection job:', error);
    
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

/**
 * POST endpoint for manual triggering with custom options
 * 
 * Allows admins to manually trigger deforestation detection with custom parameters:
 * - batchSize: Number of parcelles to process per batch
 * - batchDelayMs: Delay between batches in milliseconds
 * - cooperativeId: Filter parcelles by cooperative
 * - baselineDate: Custom baseline date (defaults to EUDR baseline)
 * - currentDate: Custom current date (defaults to today)
 * 
 * @param request - Request with optional parameters in body
 * @returns JSON response with processing results
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.error('[Cron] Unauthorized POST request to deforestation-detection');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Parse request body
    const body = await request.json().catch(() => ({}));
    const {
      batchSize,
      batchDelayMs,
      cooperativeId,
      baselineDate,
      currentDate,
    } = body;
    
    console.log(`[Cron] Manual trigger for deforestation detection${cooperativeId ? ` (cooperative: ${cooperativeId})` : ''}`);
    
    // Run deforestation detection job with custom options
    const result = await deforestationDetectionJob.run({
      batchSize: batchSize ? parseInt(batchSize, 10) : undefined,
      batchDelayMs: batchDelayMs ? parseInt(batchDelayMs, 10) : undefined,
      cooperativeId,
      baselineDate: baselineDate ? new Date(baselineDate) : undefined,
      currentDate: currentDate ? new Date(currentDate) : undefined,
    });
    
    console.log(`[Cron] Manual deforestation detection job complete: ${result.totalProcessed} processed, ${result.totalFailed} failed, ${result.deforestationDetected} deforestation events detected`);
    
    return NextResponse.json({
      success: result.status !== 'failed',
      status: result.status,
      executionId: result.executionId,
      totalProcessed: result.totalProcessed,
      totalFailed: result.totalFailed,
      deforestationDetected: result.deforestationDetected,
      durationMs: result.durationMs,
      options: {
        batchSize,
        batchDelayMs,
        cooperativeId,
        baselineDate,
        currentDate,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Cron] Error in manual deforestation detection job:', error);
    
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
