/**
 * Periodic Deforestation Detection Job
 * 
 * This job runs on a weekly schedule to check all parcelles for deforestation.
 * It processes parcelles in batches to avoid rate limits and logs execution results.
 * 
 * Requirements: Task 4.5.1
 * - Check all parcelles for deforestation
 * - Run weekly (configurable schedule)
 * - Process in batches to avoid rate limits
 * - Log job execution and results
 * 
 * Usage:
 * - Scheduled via Vercel Cron (vercel.json)
 * - Can be triggered manually via API endpoint
 * - Processes parcelles in batches of 10 (configurable)
 */

import { createClient } from '@supabase/supabase-js';
import { deforestationService } from '../services/deforestation.service';
import { jobMonitoringService } from './job-monitoring.service';
import type { MultiPolygon } from 'geojson';

// ============================================================================
// Constants
// ============================================================================

/**
 * Batch size for processing parcelles
 * Smaller batches reduce memory usage and allow for better progress tracking
 */
const BATCH_SIZE = 10;

/**
 * Delay between batches in milliseconds
 * Helps avoid rate limiting from Google Earth Engine API
 */
const BATCH_DELAY_MS = 2000; // 2 seconds

/**
 * Maximum execution time in milliseconds (10 minutes)
 * Vercel serverless functions have a 10-minute timeout
 */
const MAX_EXECUTION_TIME_MS = 10 * 60 * 1000;

/**
 * EUDR baseline date (December 31, 2020)
 */
const EUDR_BASELINE_DATE = new Date('2020-12-31T00:00:00Z');

// ============================================================================
// Types
// ============================================================================

/**
 * Job execution result
 */
export interface DeforestationJobResult {
  /**
   * Job execution ID
   */
  executionId: string;

  /**
   * Job status
   */
  status: 'completed' | 'failed' | 'partial';

  /**
   * Total parcelles processed
   */
  totalProcessed: number;

  /**
   * Total parcelles failed
   */
  totalFailed: number;

  /**
   * Total deforestation events detected
   */
  deforestationDetected: number;

  /**
   * Execution duration in milliseconds
   */
  durationMs: number;

  /**
   * Error message if job failed
   */
  errorMessage?: string;

  /**
   * Detailed error information
   */
  errorDetails?: any;
}

/**
 * Parcelle data for processing
 */
interface ParcelleData {
  id: string;
  code: string;
  geometry: MultiPolygon;
  surface_hectares: number;
}

/**
 * Batch processing result
 */
interface BatchResult {
  processed: number;
  failed: number;
  deforestationDetected: number;
  errors: Array<{ parcelleId: string; error: string }>;
}

// ============================================================================
// DeforestationDetectionJob Class
// ============================================================================

/**
 * Service for running periodic deforestation detection
 */
export class DeforestationDetectionJob {
  private supabase: any;
  private startTime: number = 0;
  private executionId: string = '';

  constructor() {
    // Initialize Supabase client with service role key
    // This bypasses RLS and allows the job to access all parcelles
    const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY;
    if (!serviceRoleKey) {
      throw new Error('SUPABASE_SERVICE_KEY environment variable is required');
    }

    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        global: {
          fetch: fetch.bind(globalThis),
        },
      }
    );
  }

  /**
   * Run the deforestation detection job
   * 
   * This method:
   * 1. Creates a job execution record
   * 2. Retrieves all active parcelles
   * 3. Processes parcelles in batches
   * 4. Detects deforestation for each parcelle
   * 5. Updates job execution record with results
   * 
   * @param options - Job options
   * @returns Job execution result
   */
  async run(options: {
    /**
     * Batch size (default: 10)
     */
    batchSize?: number;

    /**
     * Delay between batches in ms (default: 2000)
     */
    batchDelayMs?: number;

    /**
     * Maximum execution time in ms (default: 10 minutes)
     */
    maxExecutionTimeMs?: number;

    /**
     * Baseline date for comparison (default: EUDR baseline)
     */
    baselineDate?: Date;

    /**
     * Current date for comparison (default: today)
     */
    currentDate?: Date;

    /**
     * Filter parcelles by cooperative ID
     */
    cooperativeId?: string;
  } = {}): Promise<DeforestationJobResult> {
    const {
      batchSize = BATCH_SIZE,
      batchDelayMs = BATCH_DELAY_MS,
      maxExecutionTimeMs = MAX_EXECUTION_TIME_MS,
      baselineDate = EUDR_BASELINE_DATE,
      currentDate = new Date(),
      cooperativeId,
    } = options;

    this.startTime = Date.now();

    try {
      // Step 1: Create job execution record
      console.log('[Deforestation Job] Starting deforestation detection job');
      this.executionId = await this.createJobExecution({
        batchSize,
        batchDelayMs,
        baselineDate: baselineDate.toISOString(),
        currentDate: currentDate.toISOString(),
        cooperativeId,
      });

      // Log job start with monitoring service
      jobMonitoringService.logJobStart(
        this.executionId,
        'Periodic Deforestation Detection',
        'deforestation_detection',
        {
          batchSize,
          batchDelayMs,
          baselineDate: baselineDate.toISOString(),
          currentDate: currentDate.toISOString(),
          cooperativeId,
        }
      );

      // Step 2: Retrieve all active parcelles
      console.log('[Deforestation Job] Retrieving parcelles');
      jobMonitoringService.logJobProgress(
        this.executionId,
        'Retrieving parcelles from database',
        { cooperativeId }
      );
      
      const parcelles = await this.getParcelles(cooperativeId);
      console.log(`[Deforestation Job] Found ${parcelles.length} parcelles to process`);
      
      jobMonitoringService.logJobProgress(
        this.executionId,
        `Found ${parcelles.length} parcelles to process`,
        { parcelleCount: parcelles.length }
      );

      if (parcelles.length === 0) {
        await this.completeJobExecution(this.executionId, {
          status: 'completed',
          totalProcessed: 0,
          totalFailed: 0,
          deforestationDetected: 0,
        });

        return {
          executionId: this.executionId,
          status: 'completed',
          totalProcessed: 0,
          totalFailed: 0,
          deforestationDetected: 0,
          durationMs: Date.now() - this.startTime,
        };
      }

      // Step 3: Process parcelles in batches
      let totalProcessed = 0;
      let totalFailed = 0;
      let deforestationDetected = 0;
      const allErrors: Array<{ parcelleId: string; error: string }> = [];

      for (let i = 0; i < parcelles.length; i += batchSize) {
        // Check if we've exceeded max execution time
        if (Date.now() - this.startTime > maxExecutionTimeMs) {
          const warningMsg = `Max execution time exceeded, stopping at ${totalProcessed}/${parcelles.length} parcelles`;
          console.warn(`[Deforestation Job] ${warningMsg}`);
          jobMonitoringService.logJobWarning(
            this.executionId,
            warningMsg,
            { totalProcessed, totalParcelles: parcelles.length }
          );
          break;
        }

        const batch = parcelles.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(parcelles.length / batchSize);
        
        console.log(`[Deforestation Job] Processing batch ${batchNumber}/${totalBatches} (${batch.length} parcelles)`);
        jobMonitoringService.logJobProgress(
          this.executionId,
          `Processing batch ${batchNumber}/${totalBatches}`,
          { batchNumber, totalBatches, batchSize: batch.length }
        );

        // Process batch
        const batchResult = await this.processBatch(
          batch,
          baselineDate,
          currentDate
        );

        totalProcessed += batchResult.processed;
        totalFailed += batchResult.failed;
        deforestationDetected += batchResult.deforestationDetected;
        allErrors.push(...batchResult.errors);

        // Update job execution progress
        await this.updateJobExecutionProgress(this.executionId, {
          itemsProcessed: totalProcessed,
          itemsFailed: totalFailed,
        });

        // Delay between batches to avoid rate limiting
        if (i + batchSize < parcelles.length) {
          console.log(`[Deforestation Job] Waiting ${batchDelayMs}ms before next batch`);
          await this.delay(batchDelayMs);
        }
      }

      // Step 4: Complete job execution
      const status = totalFailed === 0 ? 'completed' : 'partial';
      await this.completeJobExecution(this.executionId, {
        status,
        totalProcessed,
        totalFailed,
        deforestationDetected,
        errors: allErrors.length > 0 ? allErrors : undefined,
      });

      console.log(`[Deforestation Job] Job completed: ${totalProcessed} processed, ${totalFailed} failed, ${deforestationDetected} deforestation events detected`);
      
      // Log job completion with monitoring service
      jobMonitoringService.logJobCompletion(
        this.executionId,
        'Periodic Deforestation Detection',
        status,
        {
          durationMs: Date.now() - this.startTime,
          itemsProcessed: totalProcessed,
          itemsFailed: totalFailed,
        }
      );

      // Check if failure alert should be sent
      await jobMonitoringService.checkAndSendFailureAlert(
        this.executionId,
        'Periodic Deforestation Detection',
        'deforestation_detection',
        status,
        {
          durationMs: Date.now() - this.startTime,
          itemsProcessed: totalProcessed,
          itemsFailed: totalFailed,
        }
      );

      return {
        executionId: this.executionId,
        status,
        totalProcessed,
        totalFailed,
        deforestationDetected,
        durationMs: Date.now() - this.startTime,
      };
    } catch (error) {
      // Job failed completely
      console.error('[Deforestation Job] Job failed:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorDetails = error instanceof Error ? { stack: error.stack } : { error };

      // Log error with monitoring service
      jobMonitoringService.logJobError(
        this.executionId,
        error instanceof Error ? error : new Error(errorMessage),
        { executionId: this.executionId }
      );

      await this.failJobExecution(this.executionId, errorMessage, errorDetails);

      // Log job failure
      jobMonitoringService.logJobCompletion(
        this.executionId,
        'Periodic Deforestation Detection',
        'failed',
        {
          durationMs: Date.now() - this.startTime,
          itemsProcessed: 0,
          itemsFailed: 0,
          errorMessage,
        }
      );

      // Send failure alert
      await jobMonitoringService.checkAndSendFailureAlert(
        this.executionId,
        'Periodic Deforestation Detection',
        'deforestation_detection',
        'failed',
        {
          durationMs: Date.now() - this.startTime,
          itemsProcessed: 0,
          itemsFailed: 0,
          errorMessage,
        }
      );

      return {
        executionId: this.executionId,
        status: 'failed',
        totalProcessed: 0,
        totalFailed: 0,
        deforestationDetected: 0,
        durationMs: Date.now() - this.startTime,
        errorMessage,
        errorDetails,
      };
    }
  }

  /**
   * Get all active parcelles
   * 
   * @param cooperativeId - Optional cooperative ID filter
   * @returns Array of parcelle data
   */
  private async getParcelles(cooperativeId?: string): Promise<ParcelleData[]> {
    try {
      let query = this.supabase
        .from('parcelles')
        .select(`
          id,
          code,
          geometry,
          surface_hectares,
          planteur:planteurs!inner(
            cooperative_id
          )
        `)
        .not('geometry', 'is', null)
        .gt('surface_hectares', 0);

      // Filter by cooperative if specified
      if (cooperativeId) {
        query = query.eq('planteur.cooperative_id', cooperativeId);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to retrieve parcelles: ${error.message}`);
      }

      if (!data || data.length === 0) {
        return [];
      }

      return data.map((row: any) => ({
        id: row.id,
        code: row.code,
        geometry: row.geometry,
        surface_hectares: row.surface_hectares,
      }));
    } catch (error) {
      console.error('[Deforestation Job] Error retrieving parcelles:', error);
      throw error;
    }
  }

  /**
   * Process a batch of parcelles
   * 
   * @param batch - Array of parcelles to process
   * @param baselineDate - Baseline date for comparison
   * @param currentDate - Current date for comparison
   * @returns Batch processing result
   */
  private async processBatch(
    batch: ParcelleData[],
    baselineDate: Date,
    currentDate: Date
  ): Promise<BatchResult> {
    const result: BatchResult = {
      processed: 0,
      failed: 0,
      deforestationDetected: 0,
      errors: [],
    };

    // Process parcelles in parallel within the batch
    const promises = batch.map(async (parcelle) => {
      try {
        console.log(`[Deforestation Job] Processing parcelle ${parcelle.code} (${parcelle.id})`);

        // Detect deforestation
        const detectionResult = await deforestationService.detectDeforestation(
          parcelle.id,
          parcelle.geometry,
          parcelle.surface_hectares,
          {
            baselineDate,
            currentDate,
            storeEvents: true,
            supabase: this.supabase,
          }
        );

        result.processed++;

        if (detectionResult.detected) {
          result.deforestationDetected++;
          console.log(`[Deforestation Job] Deforestation detected on parcelle ${parcelle.code}: NDVI change ${detectionResult.ndviChange.toFixed(4)}, affected area ${detectionResult.affectedAreaHectares.toFixed(2)} ha`);
        } else {
          console.log(`[Deforestation Job] No deforestation detected on parcelle ${parcelle.code}`);
        }
      } catch (error) {
        result.failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push({
          parcelleId: parcelle.id,
          error: errorMessage,
        });
        console.error(`[Deforestation Job] Error processing parcelle ${parcelle.code}:`, error);
      }
    });

    await Promise.all(promises);

    return result;
  }

  /**
   * Create job execution record
   * 
   * @param metadata - Job execution metadata
   * @returns Job execution ID
   */
  private async createJobExecution(metadata: any): Promise<string> {
    try {
      const { data, error } = await this.supabase
        .from('job_executions')
        .insert({
          job_name: 'Periodic Deforestation Detection',
          job_type: 'deforestation_detection',
          status: 'running',
          started_at: new Date().toISOString(),
          execution_metadata: metadata,
        })
        .select('id')
        .single();

      if (error) {
        throw new Error(`Failed to create job execution: ${error.message}`);
      }

      return data.id;
    } catch (error) {
      console.error('[Deforestation Job] Error creating job execution:', error);
      throw error;
    }
  }

  /**
   * Update job execution progress
   * 
   * @param executionId - Job execution ID
   * @param progress - Progress data
   */
  private async updateJobExecutionProgress(
    executionId: string,
    progress: {
      itemsProcessed: number;
      itemsFailed: number;
    }
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('job_executions')
        .update({
          items_processed: progress.itemsProcessed,
          items_failed: progress.itemsFailed,
        })
        .eq('id', executionId);

      if (error) {
        console.error('[Deforestation Job] Error updating job execution progress:', error);
      }
    } catch (error) {
      console.error('[Deforestation Job] Error updating job execution progress:', error);
    }
  }

  /**
   * Complete job execution
   * 
   * @param executionId - Job execution ID
   * @param result - Job result data
   */
  private async completeJobExecution(
    executionId: string,
    result: {
      status: 'completed' | 'partial';
      totalProcessed: number;
      totalFailed: number;
      deforestationDetected: number;
      errors?: Array<{ parcelleId: string; error: string }>;
    }
  ): Promise<void> {
    try {
      const durationMs = Date.now() - this.startTime;

      const { error } = await this.supabase
        .from('job_executions')
        .update({
          status: result.status,
          completed_at: new Date().toISOString(),
          duration_ms: durationMs,
          items_processed: result.totalProcessed,
          items_failed: result.totalFailed,
          execution_metadata: {
            deforestationDetected: result.deforestationDetected,
            errors: result.errors,
          },
        })
        .eq('id', executionId);

      if (error) {
        console.error('[Deforestation Job] Error completing job execution:', error);
      }
    } catch (error) {
      console.error('[Deforestation Job] Error completing job execution:', error);
    }
  }

  /**
   * Fail job execution
   * 
   * @param executionId - Job execution ID
   * @param errorMessage - Error message
   * @param errorDetails - Error details
   */
  private async failJobExecution(
    executionId: string,
    errorMessage: string,
    errorDetails: any
  ): Promise<void> {
    try {
      const durationMs = Date.now() - this.startTime;

      const { error } = await this.supabase
        .from('job_executions')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          duration_ms: durationMs,
          error_message: errorMessage,
          error_details: errorDetails,
        })
        .eq('id', executionId);

      if (error) {
        console.error('[Deforestation Job] Error failing job execution:', error);
      }
    } catch (error) {
      console.error('[Deforestation Job] Error failing job execution:', error);
    }
  }

  /**
   * Delay execution
   * 
   * @param ms - Milliseconds to delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Singleton instance of DeforestationDetectionJob
 */
export const deforestationDetectionJob = new DeforestationDetectionJob();
