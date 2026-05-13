/**
 * Cache Monitoring Background Job
 * 
 * This job starts the cache monitoring service when the application starts.
 * It runs continuously in the background, logging cache metrics at regular
 * intervals and generating alerts when thresholds are exceeded.
 * 
 * Requirements: Task 6.2.5
 * - Start cache monitoring on application startup
 * - Log metrics periodically
 * - Generate alerts for low hit rate
 */

import { getCacheMonitor } from '../services/cache-monitor.service';

/**
 * Initialize cache monitoring
 * 
 * Starts the cache monitoring service. Should be called once during
 * application initialization.
 * 
 * @returns True if monitoring started successfully
 */
export function initializeCacheMonitoring(): boolean {
  try {
    console.log('[Cache Monitoring Job] Initializing cache monitoring');
    
    const cacheMonitor = getCacheMonitor();
    cacheMonitor.startMonitoring();
    
    console.log('[Cache Monitoring Job] Cache monitoring started successfully');
    return true;
  } catch (error) {
    console.error('[Cache Monitoring Job] Failed to start cache monitoring:', error);
    return false;
  }
}

/**
 * Stop cache monitoring
 * 
 * Stops the cache monitoring service. Should be called during
 * application shutdown.
 */
export function stopCacheMonitoring(): void {
  try {
    console.log('[Cache Monitoring Job] Stopping cache monitoring');
    
    const cacheMonitor = getCacheMonitor();
    cacheMonitor.stopMonitoring();
    
    console.log('[Cache Monitoring Job] Cache monitoring stopped');
  } catch (error) {
    console.error('[Cache Monitoring Job] Error stopping cache monitoring:', error);
  }
}

/**
 * Get cache health status
 * 
 * Retrieves current cache health summary for health check endpoints.
 * 
 * @returns Health summary object
 */
export async function getCacheHealth() {
  try {
    const cacheMonitor = getCacheMonitor();
    return await cacheMonitor.getHealthSummary();
  } catch (error) {
    console.error('[Cache Monitoring Job] Error getting cache health:', error);
    return {
      status: 'critical' as const,
      hitRate: 0,
      memoryUsage: 0,
      activeAlerts: 0,
      redisAvailable: false,
    };
  }
}
