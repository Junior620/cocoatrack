/**
 * Deforestation Detection Service
 * 
 * This service provides methods to detect deforestation events by comparing
 * baseline NDVI (typically December 31, 2020 for EUDR compliance) with current
 * NDVI values. Deforestation is flagged when:
 * - NDVI decrease > 0.3 (30% vegetation loss)
 * - Affected area > 0.5 hectares
 * 
 * Requirements: Task 4.1.1
 * - Compare baseline NDVI (Dec 31, 2020) with current NDVI
 * - Flag deforestation if NDVI decrease > 0.3 and area > 0.5 hectares
 * - Calculate affected area in hectares and percentage
 */

import type { MultiPolygon } from 'geojson';
import {
  DeforestationEvent,
  NDVICalculationError,
  InsufficientDataError,
} from '../types';
import { ndviService } from './ndvi.service';
import { imageryService } from './imagery.service';

// ============================================================================
// Constants
// ============================================================================

/**
 * EUDR baseline date (December 31, 2020)
 * EU Deforestation Regulation requires proof that cocoa was not grown on
 * deforested land after this date
 */
const EUDR_BASELINE_DATE = new Date('2020-12-31T00:00:00Z');

/**
 * Minimum NDVI decrease threshold to flag deforestation
 * A decrease of 0.3 (30%) indicates significant vegetation loss
 */
const DEFORESTATION_NDVI_THRESHOLD = 0.3;

/**
 * Minimum affected area threshold in hectares
 * Only flag deforestation if affected area exceeds 0.5 hectares
 */
const DEFORESTATION_AREA_THRESHOLD = 0.5;

/**
 * Maximum days to search for baseline imagery if exact date unavailable
 * Will search ±60 days from baseline date for cloud-free imagery
 */
const BASELINE_SEARCH_WINDOW_DAYS = 60;

// ============================================================================
// Types
// ============================================================================

/**
 * Deforestation detection options
 */
interface DeforestationDetectionOptions {
  /**
   * Baseline date for comparison (defaults to EUDR baseline: Dec 31, 2020)
   */
  baselineDate?: Date;

  /**
   * Current date for comparison (defaults to today)
   */
  currentDate?: Date;

  /**
   * Whether to store detected events in database
   */
  storeEvents?: boolean;

  /**
   * Supabase client for database operations
   */
  supabase?: any;
}

/**
 * Deforestation detection result
 */
interface DeforestationDetectionResult {
  /**
   * Whether deforestation was detected
   */
  detected: boolean;

  /**
   * Baseline NDVI value
   */
  baselineNDVI: number;

  /**
   * Current NDVI value
   */
  currentNDVI: number;

  /**
   * NDVI change (negative indicates vegetation loss)
   */
  ndviChange: number;

  /**
   * Affected area in hectares
   */
  affectedAreaHectares: number;

  /**
   * Affected area as percentage of total parcelle area
   */
  affectedAreaPercent: number;

  /**
   * Created deforestation event (if detected and stored)
   */
  event?: DeforestationEvent;
}

// ============================================================================
// DeforestationService Class
// ============================================================================

/**
 * Service for detecting deforestation events
 */
export class DeforestationService {
  /**
   * Detect deforestation by comparing baseline and current NDVI
   * 
   * This method:
   * 1. Retrieves baseline NDVI (Dec 31, 2020 or closest available)
   * 2. Retrieves current NDVI (today or specified date)
   * 3. Calculates NDVI change (current - baseline)
   * 4. Calculates affected area based on NDVI decrease
   * 5. Flags deforestation if:
   *    - NDVI decrease > 0.3 (30% vegetation loss)
   *    - Affected area > 0.5 hectares
   * 6. Creates deforestation event record if detected and storeEvents is true
   * 
   * @param parcelleId - Parcelle ID
   * @param geometry - Parcelle geometry (MultiPolygon)
   * @param surfaceHectares - Total parcelle surface area in hectares
   * @param options - Detection options
   * @returns Deforestation detection result
   * @throws {NDVICalculationError} If NDVI calculation fails
   * @throws {InsufficientDataError} If insufficient data is available
   * 
   * @example
   * ```typescript
   * const service = new DeforestationService();
   * const result = await service.detectDeforestation(
   *   'parcelle-123',
   *   parcelleGeometry,
   *   5.5 // 5.5 hectares
   * );
   * 
   * if (result.detected) {
   *   console.log('Deforestation detected!');
   *   console.log('NDVI change:', result.ndviChange);
   *   console.log('Affected area:', result.affectedAreaHectares, 'ha');
   * }
   * ```
   */
  async detectDeforestation(
    parcelleId: string,
    geometry: MultiPolygon,
    surfaceHectares: number,
    options: DeforestationDetectionOptions = {}
  ): Promise<DeforestationDetectionResult> {
    const {
      baselineDate = EUDR_BASELINE_DATE,
      currentDate = new Date(),
      storeEvents = true,
      supabase,
    } = options;

    try {
      // Step 1: Retrieve baseline NDVI
      console.log(`[Deforestation Service] Retrieving baseline NDVI for ${parcelleId} at ${baselineDate.toISOString()}`);
      const baselineNDVI = await this.getBaselineNDVI(
        parcelleId,
        geometry,
        baselineDate,
        supabase
      );

      // Step 2: Retrieve current NDVI
      console.log(`[Deforestation Service] Retrieving current NDVI for ${parcelleId} at ${currentDate.toISOString()}`);
      const currentNDVI = await this.getCurrentNDVI(
        parcelleId,
        geometry,
        currentDate,
        supabase
      );

      // Step 3: Calculate NDVI change
      // Negative value indicates vegetation loss
      const ndviChange = currentNDVI.meanNDVI - baselineNDVI.meanNDVI;

      console.log(`[Deforestation Service] NDVI change for ${parcelleId}: ${ndviChange.toFixed(4)} (baseline: ${baselineNDVI.meanNDVI.toFixed(4)}, current: ${currentNDVI.meanNDVI.toFixed(4)})`);

      // Step 4: Calculate affected area
      // If NDVI decreased, calculate the affected area
      // For simplicity, we assume the entire parcelle is affected if NDVI decreased
      // In a more sophisticated implementation, we would analyze pixel-level changes
      const affectedAreaHectares = ndviChange < 0 ? surfaceHectares : 0;
      const affectedAreaPercent = ndviChange < 0 ? 100 : 0;

      // Step 5: Check if deforestation thresholds are met
      const ndviDecrease = Math.abs(ndviChange);
      const detected =
        ndviChange < 0 && // NDVI decreased (vegetation loss)
        ndviDecrease > DEFORESTATION_NDVI_THRESHOLD && // Decrease exceeds threshold
        affectedAreaHectares > DEFORESTATION_AREA_THRESHOLD; // Affected area exceeds threshold

      console.log(`[Deforestation Service] Deforestation detected: ${detected} (decrease: ${ndviDecrease.toFixed(4)}, area: ${affectedAreaHectares.toFixed(2)} ha)`);

      // Step 6: Create deforestation event if detected and storeEvents is true
      let event: DeforestationEvent | undefined;
      if (detected && storeEvents) {
        event = await this.createDeforestationEvent(
          parcelleId,
          baselineDate,
          currentDate,
          baselineNDVI.meanNDVI,
          currentNDVI.meanNDVI,
          ndviChange,
          affectedAreaHectares,
          affectedAreaPercent,
          supabase
        );
        console.log(`[Deforestation Service] Created deforestation event: ${event.id}`);
        
        // Step 6.1: Send notifications to cooperative manager and agronomist
        try {
          await this.sendDeforestationNotifications(event, supabase);
        } catch (notificationError) {
          // Log error but don't fail the detection
          console.error(`[Deforestation Service] Failed to send notifications for event ${event.id}:`, notificationError);
        }
      }

      // Step 7: Return detection result
      return {
        detected,
        baselineNDVI: baselineNDVI.meanNDVI,
        currentNDVI: currentNDVI.meanNDVI,
        ndviChange,
        affectedAreaHectares,
        affectedAreaPercent,
        event,
      };
    } catch (error) {
      // Re-throw known errors
      if (
        error instanceof NDVICalculationError ||
        error instanceof InsufficientDataError
      ) {
        throw error;
      }

      // Wrap unknown errors
      throw new NDVICalculationError(
        `Failed to detect deforestation for parcelle ${parcelleId}: ${(error as Error).message}`,
        parcelleId,
        (error as Error).message
      );
    }
  }

  /**
   * Get baseline NDVI for a parcelle
   * 
   * Retrieves NDVI for the baseline date (typically Dec 31, 2020 for EUDR).
   * If exact date is not available, searches for the closest cloud-free imagery
   * within ±60 days of the baseline date.
   * 
   * Implementation:
   * 1. Check cache for exact baseline date
   * 2. If cached, return immediately
   * 3. If not cached, try to calculate NDVI for exact date
   * 4. If exact date fails, search for closest available date within ±60 days
   * 5. Calculate NDVI for closest date and cache it
   * 
   * @param parcelleId - Parcelle ID
   * @param geometry - Parcelle geometry
   * @param baselineDate - Baseline date
   * @param supabase - Optional Supabase client
   * @returns Baseline NDVI result
   * @throws {InsufficientDataError} If no baseline imagery is available within search window
   */
  private async getBaselineNDVI(
    parcelleId: string,
    geometry: MultiPolygon,
    baselineDate: Date,
    supabase?: any
  ) {
    try {
      // Step 1: Try to get cached NDVI for exact baseline date
      const cachedNDVI = await ndviService.getCachedNDVI(
        parcelleId,
        baselineDate,
        supabase
      );

      if (cachedNDVI) {
        console.log(`[Deforestation Service] Using cached baseline NDVI for ${parcelleId} (date: ${baselineDate.toISOString()})`);
        return cachedNDVI;
      }

      // Step 2: Try to calculate NDVI for exact baseline date
      console.log(`[Deforestation Service] Attempting to calculate baseline NDVI for ${parcelleId} at exact date ${baselineDate.toISOString()}`);
      
      try {
        const baselineNDVI = await ndviService.calculateNDVI(
          parcelleId,
          geometry,
          baselineDate,
          {
            storeResult: true,
            generateRaster: false,
          }
        );

        console.log(`[Deforestation Service] Successfully calculated baseline NDVI for exact date`);
        return baselineNDVI;
      } catch (exactDateError) {
        // Exact date failed, proceed to search for closest available date
        console.log(`[Deforestation Service] Exact date unavailable, searching for closest date within ±${BASELINE_SEARCH_WINDOW_DAYS} days`);
      }

      // Step 3: Search for closest available date within ±60 days
      const closestDate = await this.findClosestBaselineDate(
        geometry,
        baselineDate,
        BASELINE_SEARCH_WINDOW_DAYS
      );

      if (!closestDate) {
        throw new InsufficientDataError(
          `Baseline imagery not available for parcelle ${parcelleId} at ${baselineDate.toISOString()}. ` +
          `Searched within ±${BASELINE_SEARCH_WINDOW_DAYS} days but no cloud-free imagery was found.`,
          1,
          0
        );
      }

      console.log(`[Deforestation Service] Found closest baseline date: ${closestDate.toISOString()} (${Math.abs(closestDate.getTime() - baselineDate.getTime()) / (1000 * 60 * 60 * 24)} days from target)`);

      // Step 4: Check if NDVI is already cached for the closest date
      const cachedClosestNDVI = await ndviService.getCachedNDVI(
        parcelleId,
        closestDate,
        supabase
      );

      if (cachedClosestNDVI) {
        console.log(`[Deforestation Service] Using cached NDVI for closest baseline date`);
        return cachedClosestNDVI;
      }

      // Step 5: Calculate NDVI for closest date and cache it
      console.log(`[Deforestation Service] Calculating baseline NDVI for closest date ${closestDate.toISOString()}`);
      const baselineNDVI = await ndviService.calculateNDVI(
        parcelleId,
        geometry,
        closestDate,
        {
          storeResult: true,
          generateRaster: false,
        }
      );

      console.log(`[Deforestation Service] Successfully calculated and cached baseline NDVI for closest date`);
      return baselineNDVI;
    } catch (error) {
      // Re-throw InsufficientDataError as-is
      if (error instanceof InsufficientDataError) {
        throw error;
      }

      // Wrap other errors
      throw new InsufficientDataError(
        `Failed to retrieve baseline NDVI for parcelle ${parcelleId}: ${(error as Error).message}`,
        1,
        0
      );
    }
  }

  /**
   * Find the closest available imagery date to the baseline date
   * 
   * Searches for cloud-free Sentinel-2 imagery within ±maxDays of the target date.
   * Returns the date closest to the target that has suitable imagery available.
   * 
   * @param geometry - Parcelle geometry
   * @param targetDate - Target baseline date
   * @param maxDays - Maximum days to search before/after target (default 60)
   * @returns Closest available date or null if none found
   */
  private async findClosestBaselineDate(
    geometry: MultiPolygon,
    targetDate: Date,
    maxDays: number = BASELINE_SEARCH_WINDOW_DAYS
  ): Promise<Date | null> {
    try {
      // Use ImageryService to find the closest available date
      // This method searches within ±maxDays and returns the closest date with suitable imagery
      const closestImageryDate = await imageryService.getClosestDate(
        geometry,
        targetDate,
        maxDays,
        20 // Cloud cover threshold: 20%
      );

      if (!closestImageryDate) {
        return null;
      }

      return closestImageryDate.date;
    } catch (error) {
      console.error(`[Deforestation Service] Failed to find closest baseline date: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Get current NDVI for a parcelle
   * 
   * Retrieves NDVI for the current date (or specified date).
   * If not cached, calculates NDVI from satellite imagery.
   * 
   * @param parcelleId - Parcelle ID
   * @param geometry - Parcelle geometry
   * @param currentDate - Current date
   * @param supabase - Optional Supabase client
   * @returns Current NDVI result
   * @throws {InsufficientDataError} If no current imagery is available
   */
  private async getCurrentNDVI(
    parcelleId: string,
    geometry: MultiPolygon,
    currentDate: Date,
    supabase?: any
  ) {
    try {
      // First, try to get cached NDVI for current date
      const cachedNDVI = await ndviService.getCachedNDVI(
        parcelleId,
        currentDate,
        supabase
      );

      if (cachedNDVI) {
        console.log(`[Deforestation Service] Using cached current NDVI for ${parcelleId}`);
        return cachedNDVI;
      }

      // If not cached, calculate NDVI for current date
      console.log(`[Deforestation Service] Calculating current NDVI for ${parcelleId}`);
      const currentNDVI = await ndviService.calculateNDVI(
        parcelleId,
        geometry,
        currentDate,
        {
          storeResult: true,
          generateRaster: false,
        }
      );

      return currentNDVI;
    } catch (error) {
      // If current NDVI calculation fails, throw InsufficientDataError
      throw new InsufficientDataError(
        `Current imagery not available for parcelle ${parcelleId} at ${currentDate.toISOString()}`,
        1,
        0
      );
    }
  }

  /**
   * Create deforestation event record in database
   * 
   * Stores a detected deforestation event in the deforestation_events table.
   * The event is created with 'pending' status and can be acknowledged or
   * disputed by users later.
   * 
   * @param parcelleId - Parcelle ID
   * @param baselineDate - Baseline date
   * @param detectionDate - Detection date
   * @param baselineNDVI - Baseline NDVI value
   * @param currentNDVI - Current NDVI value
   * @param ndviChange - NDVI change (negative indicates loss)
   * @param affectedAreaHectares - Affected area in hectares
   * @param affectedAreaPercent - Affected area as percentage
   * @param supabase - Optional Supabase client
   * @returns Created deforestation event
   * @throws {NDVICalculationError} If event creation fails
   */
  private async createDeforestationEvent(
    parcelleId: string,
    baselineDate: Date,
    detectionDate: Date,
    baselineNDVI: number,
    currentNDVI: number,
    ndviChange: number,
    affectedAreaHectares: number,
    affectedAreaPercent: number,
    supabase?: any
  ): Promise<DeforestationEvent> {
    try {
      // Use provided client or create a new one with SERVICE ROLE KEY to bypass RLS
      let client = supabase;
      if (!client) {
        const { createClient } = await import('@supabase/supabase-js');
        
        // Use service role key to bypass RLS for event creation
        const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY;
        if (!serviceRoleKey) {
          console.warn('SUPABASE_SERVICE_KEY not found, using anon key (may fail due to RLS)');
        }
        
        client = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          serviceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

      // Normalize dates to midnight UTC
      const normalizedBaselineDate = new Date(baselineDate);
      normalizedBaselineDate.setUTCHours(0, 0, 0, 0);
      const normalizedDetectionDate = new Date(detectionDate);
      normalizedDetectionDate.setUTCHours(0, 0, 0, 0);

      // Prepare database row
      const row = {
        parcelle_id: parcelleId,
        baseline_date: normalizedBaselineDate.toISOString(),
        detection_date: normalizedDetectionDate.toISOString(),
        baseline_ndvi: baselineNDVI,
        current_ndvi: currentNDVI,
        ndvi_change: ndviChange,
        affected_area_hectares: affectedAreaHectares,
        affected_area_percent: affectedAreaPercent,
        status: 'pending',
      };

      // Insert event into database
      const { data, error } = await client
        .from('deforestation_events')
        .insert(row)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Convert database row to DeforestationEvent
      const event: DeforestationEvent = {
        id: data.id,
        parcelleId: data.parcelle_id,
        baselineDate: new Date(data.baseline_date),
        detectionDate: new Date(data.detection_date),
        baselineNDVI: Number(data.baseline_ndvi),
        currentNDVI: Number(data.current_ndvi),
        ndviChange: Number(data.ndvi_change),
        affectedAreaHectares: Number(data.affected_area_hectares),
        affectedAreaPercent: Number(data.affected_area_percent),
        status: data.status,
        acknowledgedBy: data.acknowledged_by,
        acknowledgedAt: data.acknowledged_at ? new Date(data.acknowledged_at) : null,
        acknowledgmentNotes: data.acknowledgment_notes,
        disputedBy: data.disputed_by,
        disputedAt: data.disputed_at ? new Date(data.disputed_at) : null,
        disputeReason: data.dispute_reason,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      };

      return event;
    } catch (error) {
      throw new NDVICalculationError(
        `Failed to create deforestation event: ${(error as Error).message}`,
        parcelleId,
        'Event creation failed'
      );
    }
  }

  /**
   * Get deforestation alerts for a parcelle
   * 
   * Retrieves all deforestation events for a parcelle, optionally filtered by status.
   * 
   * @param parcelleId - Parcelle ID
   * @param status - Optional status filter ('pending', 'acknowledged', 'disputed', 'resolved')
   * @param supabase - Optional Supabase client
   * @returns Array of deforestation events
   * @throws {NDVICalculationError} If retrieval fails
   * 
   * @example
   * ```typescript
   * const service = new DeforestationService();
   * 
   * // Get all alerts
   * const allAlerts = await service.getAlerts('parcelle-123');
   * 
   * // Get only pending alerts
   * const pendingAlerts = await service.getAlerts('parcelle-123', 'pending');
   * ```
   */
  async getAlerts(
    parcelleId: string,
    status?: 'pending' | 'acknowledged' | 'disputed' | 'resolved',
    supabase?: any
  ): Promise<DeforestationEvent[]> {
    try {
      // Use provided client or create a new one
      let client = supabase;
      if (!client) {
        const { createClient } = await import('@supabase/supabase-js');
        client = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            global: {
              fetch: fetch.bind(globalThis),
            },
          }
        );
      }

      // Build query
      let query = client
        .from('deforestation_events')
        .select('*')
        .eq('parcelle_id', parcelleId)
        .order('detection_date', { ascending: false });

      // Add status filter if provided
      if (status) {
        query = query.eq('status', status);
      }

      // Execute query
      const { data, error } = await query;

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Convert database rows to DeforestationEvent objects
      return data.map((row: any) => ({
        id: row.id,
        parcelleId: row.parcelle_id,
        baselineDate: new Date(row.baseline_date),
        detectionDate: new Date(row.detection_date),
        baselineNDVI: Number(row.baseline_ndvi),
        currentNDVI: Number(row.current_ndvi),
        ndviChange: Number(row.ndvi_change),
        affectedAreaHectares: Number(row.affected_area_hectares),
        affectedAreaPercent: Number(row.affected_area_percent),
        status: row.status,
        acknowledgedBy: row.acknowledged_by,
        acknowledgedAt: row.acknowledged_at ? new Date(row.acknowledged_at) : null,
        acknowledgmentNotes: row.acknowledgment_notes,
        disputedBy: row.disputed_by,
        disputedAt: row.disputed_at ? new Date(row.disputed_at) : null,
        disputeReason: row.dispute_reason,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      }));
    } catch (error) {
      throw new NDVICalculationError(
        `Failed to retrieve deforestation alerts for parcelle ${parcelleId}: ${(error as Error).message}`,
        parcelleId,
        (error as Error).message
      );
    }
  }

  /**
   * Acknowledge a deforestation alert
   * 
   * Marks a deforestation alert as acknowledged by a user.
   * Updates the status to 'acknowledged' and records the user ID, timestamp, and notes.
   * 
   * @param alertId - Alert ID
   * @param userId - User ID who is acknowledging the alert
   * @param notes - Optional acknowledgment notes
   * @param supabase - Optional Supabase client
   * @throws {NDVICalculationError} If acknowledgment fails
   * 
   * @example
   * ```typescript
   * const service = new DeforestationService();
   * await service.acknowledgeAlert(
   *   'alert-123',
   *   'user-456',
   *   'Verified deforestation. Intervention planned.'
   * );
   * ```
   */
  async acknowledgeAlert(
    alertId: string,
    userId: string,
    notes?: string,
    supabase?: any
  ): Promise<void> {
    try {
      // Use provided client or create a new one
      let client = supabase;
      if (!client) {
        const { createClient } = await import('@supabase/supabase-js');
        
        // Use service role key to bypass RLS
        const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY;
        if (!serviceRoleKey) {
          console.warn('SUPABASE_SERVICE_KEY not found, using anon key (may fail due to RLS)');
        }
        
        client = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          serviceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

      // Update alert status
      const { error } = await client
        .from('deforestation_events')
        .update({
          status: 'acknowledged',
          acknowledged_by: userId,
          acknowledged_at: new Date().toISOString(),
          acknowledgment_notes: notes || null,
        })
        .eq('id', alertId);

      if (error) {
        throw error;
      }
    } catch (error) {
      throw new NDVICalculationError(
        `Failed to acknowledge alert ${alertId}: ${(error as Error).message}`,
        undefined,
        'Alert acknowledgment failed'
      );
    }
  }

  /**
   * Dispute a deforestation alert
   * 
   * Marks a deforestation alert as disputed by a user.
   * Updates the status to 'disputed' and records the user ID, timestamp, and reason.
   * 
   * @param alertId - Alert ID
   * @param userId - User ID who is disputing the alert
   * @param reason - Reason for disputing the alert
   * @param supabase - Optional Supabase client
   * @throws {NDVICalculationError} If dispute fails
   * 
   * @example
   * ```typescript
   * const service = new DeforestationService();
   * await service.disputeAlert(
   *   'alert-123',
   *   'user-456',
   *   'False positive - seasonal leaf drop, not deforestation'
   * );
   * ```
   */
  async disputeAlert(
    alertId: string,
    userId: string,
    reason: string,
    supabase?: any
  ): Promise<void> {
    try {
      // Use provided client or create a new one
      let client = supabase;
      if (!client) {
        const { createClient } = await import('@supabase/supabase-js');
        
        // Use service role key to bypass RLS
        const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY;
        if (!serviceRoleKey) {
          console.warn('SUPABASE_SERVICE_KEY not found, using anon key (may fail due to RLS)');
        }
        
        client = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          serviceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

      // Update alert status
      const { error } = await client
        .from('deforestation_events')
        .update({
          status: 'disputed',
          disputed_by: userId,
          disputed_at: new Date().toISOString(),
          dispute_reason: reason,
        })
        .eq('id', alertId);

      if (error) {
        throw error;
      }
    } catch (error) {
      throw new NDVICalculationError(
        `Failed to dispute alert ${alertId}: ${(error as Error).message}`,
        undefined,
        'Alert dispute failed'
      );
    }
  }

  /**
   * Send deforestation alert notifications
   * 
   * Sends notifications to cooperative manager and assigned agronomist when
   * deforestation is detected.
   * 
   * Requirements: Task 4.4.2
   * - Send notification to cooperative manager
   * - Send notification to assigned agronomist
   * - Include alert details and link to parcelle
   * 
   * @param event - Deforestation event
   * @param supabase - Optional Supabase client
   * @throws {NDVICalculationError} If notification sending fails
   */
  private async sendDeforestationNotifications(
    event: DeforestationEvent,
    supabase?: any
  ): Promise<void> {
    try {
      // Use provided client or create a new one with SERVICE ROLE KEY
      let client = supabase;
      if (!client) {
        const { createClient } = await import('@supabase/supabase-js');
        
        const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY;
        if (!serviceRoleKey) {
          console.warn('SUPABASE_SERVICE_KEY not found, using anon key (may fail due to RLS)');
        }
        
        client = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          serviceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

      // Step 1: Get parcelle details (name, cooperative)
      const { data: parcelle, error: parcelleError } = await client
        .from('parcelles')
        .select(`
          code,
          planteur:planteurs!inner(
            name,
            cooperative:cooperatives!inner(
              id,
              name
            )
          )
        `)
        .eq('id', event.parcelleId)
        .single();

      if (parcelleError || !parcelle) {
        console.error(`[Deforestation Service] Failed to get parcelle details for notification:`, parcelleError);
        throw new Error(`Failed to get parcelle details: ${parcelleError?.message || 'Parcelle not found'}`);
      }

      const cooperativeId = parcelle.planteur?.cooperative?.id;
      const cooperativeName = parcelle.planteur?.cooperative?.name || 'Coopérative inconnue';
      const parcelleName = parcelle.code || event.parcelleId;

      if (!cooperativeId) {
        console.warn(`[Deforestation Service] No cooperative found for parcelle ${event.parcelleId}, skipping notifications`);
        return;
      }

      // Step 2: Get recipient user IDs (cooperative managers and agronomists)
      const recipientIds = await this.getNotificationRecipients(cooperativeId, client);

      if (recipientIds.length === 0) {
        console.warn(`[Deforestation Service] No recipients found for cooperative ${cooperativeId}, skipping notifications`);
        return;
      }

      console.log(`[Deforestation Service] Sending deforestation notifications to ${recipientIds.length} recipients`);

      // Step 3: Prepare notification data
      const { NotificationService } = await import('@/lib/notifications/notification.service');
      const notificationData = {
        alertId: event.id,
        parcelleId: event.parcelleId,
        parcelleName,
        cooperativeId,
        cooperativeName,
        affectedAreaHectares: event.affectedAreaHectares,
        affectedAreaPercent: event.affectedAreaPercent,
        ndviChange: event.ndviChange,
        detectionDate: event.detectionDate,
        baselineDate: event.baselineDate,
      };

      // Step 4: Send notifications
      const notificationIds = await NotificationService.notifyDeforestationDetected(
        notificationData,
        recipientIds
      );

      console.log(`[Deforestation Service] Sent ${notificationIds.length} deforestation notifications for event ${event.id}`);
    } catch (error) {
      // Log error but don't throw - notifications are not critical
      console.error(`[Deforestation Service] Error sending deforestation notifications:`, error);
      throw new NDVICalculationError(
        `Failed to send deforestation notifications: ${(error as Error).message}`,
        event.parcelleId,
        'Notification sending failed'
      );
    }
  }

  /**
   * Get notification recipients for a cooperative
   * 
   * Returns user IDs of:
   * - Cooperative managers (role = 'manager' and cooperative_id matches)
   * - Agronomists (role = 'agent' and cooperative_id matches)
   * 
   * Note: 'agent' role is used for agronomists in the current system
   * 
   * @param cooperativeId - Cooperative ID
   * @param supabase - Supabase client
   * @returns Array of user IDs
   */
  private async getNotificationRecipients(
    cooperativeId: string,
    supabase: any
  ): Promise<string[]> {
    try {
      // Query profiles for managers and agents (agronomists) in the cooperative
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('cooperative_id', cooperativeId)
        .in('role', ['manager', 'agent']) // 'agent' is used for agronomists
        .eq('is_active', true);

      if (error) {
        console.error(`[Deforestation Service] Failed to get notification recipients:`, error);
        return [];
      }

      if (!profiles || profiles.length === 0) {
        return [];
      }

      return profiles.map((p: { id: string }) => p.id);
    } catch (error) {
      console.error(`[Deforestation Service] Error getting notification recipients:`, error);
      return [];
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Singleton instance of DeforestationService
 * 
 * Use this instance throughout the application for consistent deforestation detection.
 */
export const deforestationService = new DeforestationService();
