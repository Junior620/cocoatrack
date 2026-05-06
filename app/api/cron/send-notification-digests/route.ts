// CocoaTrack V2 - Notification Digest Cron Job
// Sends daily notification digests for batched notifications
// Task: 4.4.5 - Implement notification batching
// Requirement 19.6: Batch notifications (max 1 digest per day)

import { NextRequest, NextResponse } from 'next/server';
import { NotificationBatchingService } from '@/lib/notifications/notification-batching.service';

/**
 * Cron job endpoint to send daily notification digests
 * 
 * This endpoint should be called once per day (e.g., at 8:00 AM) by:
 * - Vercel Cron (vercel.json configuration)
 * - External cron service (e.g., cron-job.org)
 * - Manual trigger for testing
 * 
 * Security: Protected by CRON_SECRET environment variable
 * 
 * @returns JSON response with processing results
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.error('[Cron] Unauthorized request to send-notification-digests');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    console.log('[Cron] Starting notification digest processing');
    
    // Process unsent batches from yesterday
    const processedCount = await NotificationBatchingService.processUnsentBatches();
    
    console.log(`[Cron] Notification digest processing complete: ${processedCount} batches sent`);
    
    return NextResponse.json({
      success: true,
      processedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Cron] Error processing notification digests:', error);
    
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
 * POST endpoint for manual triggering (admin only)
 * 
 * Allows admins to manually trigger digest sending for a specific date
 * 
 * @param request - Request with optional batchDate in body
 * @returns JSON response with processing results
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.error('[Cron] Unauthorized POST request to send-notification-digests');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Parse request body
    const body = await request.json().catch(() => ({}));
    const batchDate = body.batchDate as string | undefined;
    
    console.log(`[Cron] Manual trigger for notification digests${batchDate ? ` (date: ${batchDate})` : ''}`);
    
    // Process unsent batches
    const processedCount = await NotificationBatchingService.processUnsentBatches(batchDate);
    
    console.log(`[Cron] Manual notification digest processing complete: ${processedCount} batches sent`);
    
    return NextResponse.json({
      success: true,
      processedCount,
      batchDate: batchDate || 'yesterday',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Cron] Error in manual notification digest processing:', error);
    
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
