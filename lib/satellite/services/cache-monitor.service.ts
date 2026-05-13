/**
 * Cache Monitor Service
 * 
 * This service provides monitoring and alerting for cache performance.
 * It tracks:
 * - Cache hit rate (hits / total requests)
 * - Cache size and memory usage
 * - Performance metrics over time
 * - Alerts for low hit rate (<50%)
 * 
 * Requirements: Task 6.2.5
 * - Track cache hit rate
 * - Track cache size and memory usage
 * - Log cache performance metrics
 * - Add alerts for low hit rate (<50%)
 */

import { getCacheService, CacheStats } from './cache.service';
import { redisCacheService } from './redis-cache.service';

// ============================================================================
// Constants
// ============================================================================

/**
 * Minimum acceptable cache hit rate (50%)
 */
const MIN_HIT_RATE_THRESHOLD = 50;

/**
 * Interval for logging cache metrics (5 minutes in milliseconds)
 */
const METRICS_LOG_INTERVAL = 5 * 60 * 1000;

/**
 * Maximum memory usage threshold (500 MB in bytes)
 */
const MAX_MEMORY_THRESHOLD = 500 * 1024 * 1024;

// ============================================================================
// Types
// ============================================================================

/**
 * Combined cache metrics from all cache layers
 */
export interface CacheMetrics {
  timestamp: Date;
  
  // Local cache (satellite_cache_metadata)
  localCache: {
    totalEntries: number;
    totalSizeBytes: number;
    uniqueParcelles: number;
    entriesByType: {
      imagery: number;
      ndvi: number;
      bands: number;
    };
    oldestEntry: Date | null;
    newestEntry: Date | null;
  };
  
  // Redis cache
  redisCache: {
    hits: number;
    misses: number;
    errors: number;
    hitRate: number;
    isAvailable: boolean;
  };
  
  // Combined metrics
  combined: {
    totalHitRate: number;
    totalMemoryBytes: number;
    memoryUsagePercent: number;
  };
  
  // Alerts
  alerts: CacheAlert[];
}

/**
 * Cache alert
 */
export interface CacheAlert {
  severity: 'warning' | 'critical';
  type: 'low_hit_rate' | 'high_memory' | 'redis_unavailable';
  message: string;
  timestamp: Date;
  value?: number;
  threshold?: number;
}

/**
 * Cache performance log entry
 */
export interface CachePerformanceLog {
  timestamp: Date;
  hitRate: number;
  memoryBytes: number;
  requestCount: number;
  alerts: CacheAlert[];
}

// ============================================================================
// CacheMonitorService Class
// ============================================================================

/**
 * Service for monitoring cache performance and generating alerts
 */
export class CacheMonitorService {
  private performanceLogs: CachePerformanceLog[] = [];
  private maxLogEntries = 288; // 24 hours of 5-minute intervals
  private monitoringInterval: NodeJS.Timeout | null = null;
  private lastAlertTimestamp: Map<string, Date> = new Map();
  private alertCooldown = 15 * 60 * 1000; // 15 minutes between same alert type

  /**
   * Start monitoring cache performance
   * 
   * Begins periodic logging of cache metrics at the configured interval.
   * Automatically generates alerts when thresholds are exceeded.
   */
  startMonitoring(): void {
    if (this.monitoringInterval) {
      console.log('[Cache Monitor] Monitoring already started');
      return;
    }

    console.log('[Cache Monitor] Starting cache performance monitoring');
    
    // Log initial metrics
    this.logMetrics();
    
    // Set up periodic logging
    this.monitoringInterval = setInterval(() => {
      this.logMetrics();
    }, METRICS_LOG_INTERVAL);
  }

  /**
   * Stop monitoring cache performance
   * 
   * Stops the periodic logging interval.
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('[Cache Monitor] Stopped cache performance monitoring');
    }
  }

  /**
   * Get current cache metrics
   * 
   * Retrieves metrics from all cache layers and combines them into
   * a comprehensive metrics object with alerts.
   * 
   * @returns Current cache metrics
   */
  async getMetrics(): Promise<CacheMetrics> {
    try {
      // Get local cache stats
      const cacheService = getCacheService();
      const localStats = await cacheService.getCacheStats();

      // Get Redis cache stats
      const redisStats = redisCacheService.getCacheStats();
      const redisAvailable = redisCacheService.isAvailable();

      // Calculate combined metrics
      const totalRequests = redisStats.hits + redisStats.misses;
      const totalHitRate = totalRequests > 0 
        ? (redisStats.hits / totalRequests) * 100 
        : 0;
      
      const totalMemoryBytes = localStats.totalSizeBytes;
      const memoryUsagePercent = (totalMemoryBytes / MAX_MEMORY_THRESHOLD) * 100;

      // Generate alerts
      const alerts = this.generateAlerts({
        hitRate: totalHitRate,
        memoryBytes: totalMemoryBytes,
        redisAvailable,
      });

      return {
        timestamp: new Date(),
        localCache: localStats,
        redisCache: {
          ...redisStats,
          isAvailable: redisAvailable,
        },
        combined: {
          totalHitRate: Math.round(totalHitRate * 100) / 100,
          totalMemoryBytes,
          memoryUsagePercent: Math.round(memoryUsagePercent * 100) / 100,
        },
        alerts,
      };
    } catch (error) {
      console.error('[Cache Monitor] Error getting metrics:', error);
      
      // Return empty metrics on error
      return {
        timestamp: new Date(),
        localCache: {
          totalEntries: 0,
          totalSizeBytes: 0,
          uniqueParcelles: 0,
          entriesByType: { imagery: 0, ndvi: 0, bands: 0 },
          oldestEntry: null,
          newestEntry: null,
        },
        redisCache: {
          hits: 0,
          misses: 0,
          errors: 0,
          hitRate: 0,
          isAvailable: false,
        },
        combined: {
          totalHitRate: 0,
          totalMemoryBytes: 0,
          memoryUsagePercent: 0,
        },
        alerts: [{
          severity: 'critical',
          type: 'redis_unavailable',
          message: 'Failed to retrieve cache metrics',
          timestamp: new Date(),
        }],
      };
    }
  }

  /**
   * Generate alerts based on current metrics
   * 
   * Checks metrics against thresholds and generates alerts for:
   * - Low hit rate (<50%)
   * - High memory usage (>80% of threshold)
   * - Redis unavailable
   * 
   * Implements alert cooldown to prevent spam.
   * 
   * @param metrics - Current metric values
   * @returns Array of alerts
   */
  private generateAlerts(metrics: {
    hitRate: number;
    memoryBytes: number;
    redisAvailable: boolean;
  }): CacheAlert[] {
    const alerts: CacheAlert[] = [];
    const now = new Date();

    // Check hit rate
    if (metrics.hitRate < MIN_HIT_RATE_THRESHOLD && metrics.hitRate > 0) {
      if (this.shouldGenerateAlert('low_hit_rate', now)) {
        alerts.push({
          severity: metrics.hitRate < 30 ? 'critical' : 'warning',
          type: 'low_hit_rate',
          message: `Cache hit rate is ${metrics.hitRate.toFixed(2)}%, below threshold of ${MIN_HIT_RATE_THRESHOLD}%`,
          timestamp: now,
          value: metrics.hitRate,
          threshold: MIN_HIT_RATE_THRESHOLD,
        });
        this.lastAlertTimestamp.set('low_hit_rate', now);
      }
    }

    // Check memory usage
    const memoryPercent = (metrics.memoryBytes / MAX_MEMORY_THRESHOLD) * 100;
    if (memoryPercent > 80) {
      if (this.shouldGenerateAlert('high_memory', now)) {
        alerts.push({
          severity: memoryPercent > 95 ? 'critical' : 'warning',
          type: 'high_memory',
          message: `Cache memory usage is ${memoryPercent.toFixed(2)}% (${this.formatBytes(metrics.memoryBytes)} / ${this.formatBytes(MAX_MEMORY_THRESHOLD)})`,
          timestamp: now,
          value: memoryPercent,
          threshold: 80,
        });
        this.lastAlertTimestamp.set('high_memory', now);
      }
    }

    // Check Redis availability
    if (!metrics.redisAvailable) {
      if (this.shouldGenerateAlert('redis_unavailable', now)) {
        alerts.push({
          severity: 'warning',
          type: 'redis_unavailable',
          message: 'Redis cache is unavailable, falling back to local cache only',
          timestamp: now,
        });
        this.lastAlertTimestamp.set('redis_unavailable', now);
      }
    }

    return alerts;
  }

  /**
   * Check if an alert should be generated based on cooldown
   * 
   * Prevents alert spam by enforcing a cooldown period between
   * alerts of the same type.
   * 
   * @param alertType - Type of alert
   * @param now - Current timestamp
   * @returns True if alert should be generated
   */
  private shouldGenerateAlert(alertType: string, now: Date): boolean {
    const lastAlert = this.lastAlertTimestamp.get(alertType);
    if (!lastAlert) {
      return true;
    }

    const timeSinceLastAlert = now.getTime() - lastAlert.getTime();
    return timeSinceLastAlert >= this.alertCooldown;
  }

  /**
   * Log current cache metrics
   * 
   * Retrieves current metrics, logs them to console, and stores them
   * in the performance log history. Triggers alerts if thresholds exceeded.
   */
  private async logMetrics(): Promise<void> {
    try {
      const metrics = await this.getMetrics();

      // Log to console
      console.log('[Cache Monitor] Performance Metrics:', {
        timestamp: metrics.timestamp.toISOString(),
        hitRate: `${metrics.combined.totalHitRate}%`,
        memory: this.formatBytes(metrics.combined.totalMemoryBytes),
        memoryPercent: `${metrics.combined.memoryUsagePercent}%`,
        localEntries: metrics.localCache.totalEntries,
        redisHits: metrics.redisCache.hits,
        redisMisses: metrics.redisCache.misses,
        redisAvailable: metrics.redisCache.isAvailable,
      });

      // Log alerts
      if (metrics.alerts.length > 0) {
        console.warn('[Cache Monitor] Alerts:', metrics.alerts.map(alert => ({
          severity: alert.severity,
          type: alert.type,
          message: alert.message,
        })));
      }

      // Store in performance log
      const logEntry: CachePerformanceLog = {
        timestamp: metrics.timestamp,
        hitRate: metrics.combined.totalHitRate,
        memoryBytes: metrics.combined.totalMemoryBytes,
        requestCount: metrics.redisCache.hits + metrics.redisCache.misses,
        alerts: metrics.alerts,
      };

      this.performanceLogs.push(logEntry);

      // Trim log history to max entries
      if (this.performanceLogs.length > this.maxLogEntries) {
        this.performanceLogs = this.performanceLogs.slice(-this.maxLogEntries);
      }
    } catch (error) {
      console.error('[Cache Monitor] Error logging metrics:', error);
    }
  }

  /**
   * Get performance log history
   * 
   * Returns the stored performance log entries for analysis.
   * 
   * @param limit - Maximum number of entries to return (default: all)
   * @returns Array of performance log entries
   */
  getPerformanceHistory(limit?: number): CachePerformanceLog[] {
    if (limit) {
      return this.performanceLogs.slice(-limit);
    }
    return [...this.performanceLogs];
  }

  /**
   * Get cache health summary
   * 
   * Provides a high-level summary of cache health status.
   * 
   * @returns Health summary object
   */
  async getHealthSummary(): Promise<{
    status: 'healthy' | 'degraded' | 'critical';
    hitRate: number;
    memoryUsage: number;
    activeAlerts: number;
    redisAvailable: boolean;
  }> {
    const metrics = await this.getMetrics();
    
    // Determine overall health status
    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    
    const criticalAlerts = metrics.alerts.filter(a => a.severity === 'critical');
    const warningAlerts = metrics.alerts.filter(a => a.severity === 'warning');
    
    if (criticalAlerts.length > 0) {
      status = 'critical';
    } else if (warningAlerts.length > 0 || metrics.combined.totalHitRate < MIN_HIT_RATE_THRESHOLD) {
      status = 'degraded';
    }

    return {
      status,
      hitRate: metrics.combined.totalHitRate,
      memoryUsage: metrics.combined.memoryUsagePercent,
      activeAlerts: metrics.alerts.length,
      redisAvailable: metrics.redisCache.isAvailable,
    };
  }

  /**
   * Clear performance log history
   * 
   * Removes all stored performance log entries.
   * Useful for testing or periodic cleanup.
   */
  clearHistory(): void {
    this.performanceLogs = [];
    console.log('[Cache Monitor] Cleared performance log history');
  }

  /**
   * Reset alert cooldowns
   * 
   * Clears all alert cooldown timestamps, allowing alerts to be
   * generated immediately on next check.
   */
  resetAlertCooldowns(): void {
    this.lastAlertTimestamp.clear();
    console.log('[Cache Monitor] Reset alert cooldowns');
  }

  /**
   * Format bytes to human-readable string
   * 
   * @param bytes - Number of bytes
   * @returns Formatted string (e.g., "1.5 MB")
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Singleton instance of CacheMonitorService
 * 
 * Use this instance throughout the application for consistent monitoring.
 */
let cacheMonitorInstance: CacheMonitorService | null = null;

export const getCacheMonitor = (): CacheMonitorService => {
  if (!cacheMonitorInstance) {
    cacheMonitorInstance = new CacheMonitorService();
  }
  return cacheMonitorInstance;
};
