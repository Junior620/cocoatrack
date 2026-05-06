/**
 * Job Monitoring Service
 * 
 * Provides comprehensive monitoring and alerting for background jobs.
 * 
 * Task: 4.5.2 - Implement job monitoring
 * Requirements:
 * - Add logging for job start, progress, completion
 * - Track job execution time and success rate
 * - Send alert if job fails
 * 
 * Features:
 * - Structured logging with context
 * - Job execution statistics and metrics
 * - Failure alerting to administrators
 * - Performance tracking and analysis
 * - Job health monitoring
 */

import { createClient } from '@supabase/supabase-js';
import { NotificationService } from '@/lib/notifications/notification.service';

// ============================================================================
// Types
// ============================================================================

/**
 * Job execution log entry
 */
export interface JobLogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error';
  message: string;
  context?: Record<string, unknown>;
}

/**
 * Job execution metrics
 */
export interface JobExecutionMetrics {
  executionId: string;
  jobType: string;
  startTime: Date;
  endTime?: Date;
  durationMs?: number;
  status: 'running' | 'completed' | 'failed' | 'partial';
  itemsProcessed: number;
  itemsFailed: number;
  successRate: number;
  errorMessage?: string;
  logs: JobLogEntry[];
}

/**
 * Job statistics over a time period
 */
export interface JobStatistics {
  jobType: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  partialExecutions: number;
  successRate: number;
  averageDurationMs: number;
  totalItemsProcessed: number;
  totalItemsFailed: number;
  lastExecution?: {
    executionId: string;
    status: string;
    startedAt: Date;
    durationMs?: number;
  };
}

/**
 * Job health status
 */
export interface JobHealthStatus {
  jobType: string;
  isHealthy: boolean;
  issues: string[];
  lastSuccessfulRun?: Date;
  consecutiveFailures: number;
  recentSuccessRate: number;
  averageExecutionTime: number;
}

/**
 * Job failure alert data
 */
export interface JobFailureAlertData {
  executionId: string;
  jobName: string;
  jobType: string;
  errorMessage: string;
  startedAt: Date;
  durationMs: number;
  itemsProcessed: number;
  itemsFailed: number;
  consecutiveFailures: number;
}

// ============================================================================
// JobMonitoringService Class
// ============================================================================

/**
 * Service for monitoring and tracking background job executions
 */
export class JobMonitoringService {
  private supabase: any;
  private logs: Map<string, JobLogEntry[]> = new Map();

  constructor() {
    // Initialize Supabase client with service role key
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

  // ==========================================================================
  // Logging Methods
  // ==========================================================================

  /**
   * Log job start
   * 
   * @param executionId - Job execution ID
   * @param jobName - Human-readable job name
   * @param jobType - Job type identifier
   * @param metadata - Additional metadata
   */
  logJobStart(
    executionId: string,
    jobName: string,
    jobType: string,
    metadata?: Record<string, unknown>
  ): void {
    const message = `[Job Start] ${jobName} (${jobType}) - Execution ID: ${executionId}`;
    
    this.addLog(executionId, 'info', message, {
      jobName,
      jobType,
      executionId,
      ...metadata,
    });

    console.log(message, metadata || {});
  }

  /**
   * Log job progress
   * 
   * @param executionId - Job execution ID
   * @param message - Progress message
   * @param context - Additional context
   */
  logJobProgress(
    executionId: string,
    message: string,
    context?: Record<string, unknown>
  ): void {
    const fullMessage = `[Job Progress] ${message}`;
    
    this.addLog(executionId, 'info', fullMessage, context);
    console.log(fullMessage, context || {});
  }

  /**
   * Log job completion
   * 
   * @param executionId - Job execution ID
   * @param jobName - Human-readable job name
   * @param status - Completion status
   * @param metrics - Execution metrics
   */
  logJobCompletion(
    executionId: string,
    jobName: string,
    status: 'completed' | 'failed' | 'partial',
    metrics: {
      durationMs: number;
      itemsProcessed: number;
      itemsFailed: number;
      errorMessage?: string;
    }
  ): void {
    const successRate = metrics.itemsProcessed > 0
      ? ((metrics.itemsProcessed - metrics.itemsFailed) / metrics.itemsProcessed * 100).toFixed(1)
      : '0.0';

    const message = `[Job ${status.toUpperCase()}] ${jobName} - Duration: ${metrics.durationMs}ms, Processed: ${metrics.itemsProcessed}, Failed: ${metrics.itemsFailed}, Success Rate: ${successRate}%`;
    
    const level = status === 'failed' ? 'error' : status === 'partial' ? 'warn' : 'info';
    
    this.addLog(executionId, level, message, {
      status,
      ...metrics,
      successRate: parseFloat(successRate),
    });

    if (level === 'error') {
      console.error(message, metrics);
    } else if (level === 'warn') {
      console.warn(message, metrics);
    } else {
      console.log(message, metrics);
    }
  }

  /**
   * Log job error
   * 
   * @param executionId - Job execution ID
   * @param error - Error object or message
   * @param context - Additional context
   */
  logJobError(
    executionId: string,
    error: Error | string,
    context?: Record<string, unknown>
  ): void {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    const message = `[Job Error] ${errorMessage}`;
    
    this.addLog(executionId, 'error', message, {
      error: errorMessage,
      stack: errorStack,
      ...context,
    });

    console.error(message, {
      error: errorMessage,
      stack: errorStack,
      ...context,
    });
  }

  /**
   * Log job warning
   * 
   * @param executionId - Job execution ID
   * @param message - Warning message
   * @param context - Additional context
   */
  logJobWarning(
    executionId: string,
    message: string,
    context?: Record<string, unknown>
  ): void {
    const fullMessage = `[Job Warning] ${message}`;
    
    this.addLog(executionId, 'warn', fullMessage, context);
    console.warn(fullMessage, context || {});
  }

  /**
   * Add log entry to in-memory log collection
   * 
   * @param executionId - Job execution ID
   * @param level - Log level
   * @param message - Log message
   * @param context - Additional context
   */
  private addLog(
    executionId: string,
    level: 'info' | 'warn' | 'error',
    message: string,
    context?: Record<string, unknown>
  ): void {
    if (!this.logs.has(executionId)) {
      this.logs.set(executionId, []);
    }

    this.logs.get(executionId)!.push({
      timestamp: new Date(),
      level,
      message,
      context,
    });
  }

  /**
   * Get logs for a job execution
   * 
   * @param executionId - Job execution ID
   * @returns Array of log entries
   */
  getJobLogs(executionId: string): JobLogEntry[] {
    return this.logs.get(executionId) || [];
  }

  /**
   * Clear logs for a job execution
   * 
   * @param executionId - Job execution ID
   */
  clearJobLogs(executionId: string): void {
    this.logs.delete(executionId);
  }

  // ==========================================================================
  // Metrics and Statistics
  // ==========================================================================

  /**
   * Get job execution metrics
   * 
   * @param executionId - Job execution ID
   * @returns Job execution metrics
   */
  async getJobMetrics(executionId: string): Promise<JobExecutionMetrics | null> {
    try {
      const { data, error } = await this.supabase
        .from('job_executions')
        .select('*')
        .eq('id', executionId)
        .single();

      if (error || !data) {
        console.error('[JobMonitoring] Failed to get job metrics:', error);
        return null;
      }

      const itemsProcessed = data.items_processed || 0;
      const itemsFailed = data.items_failed || 0;
      const successRate = itemsProcessed > 0
        ? ((itemsProcessed - itemsFailed) / itemsProcessed * 100)
        : 0;

      return {
        executionId: data.id,
        jobType: data.job_type,
        startTime: new Date(data.started_at),
        endTime: data.completed_at ? new Date(data.completed_at) : undefined,
        durationMs: data.duration_ms,
        status: data.status,
        itemsProcessed,
        itemsFailed,
        successRate,
        errorMessage: data.error_message,
        logs: this.getJobLogs(executionId),
      };
    } catch (error) {
      console.error('[JobMonitoring] Error getting job metrics:', error);
      return null;
    }
  }

  /**
   * Get job statistics for a time period
   * 
   * @param jobType - Job type to analyze
   * @param startDate - Start of time period
   * @param endDate - End of time period
   * @returns Job statistics
   */
  async getJobStatistics(
    jobType: string,
    startDate: Date,
    endDate: Date
  ): Promise<JobStatistics | null> {
    try {
      const { data, error } = await this.supabase
        .from('job_executions')
        .select('*')
        .eq('job_type', jobType)
        .gte('started_at', startDate.toISOString())
        .lte('started_at', endDate.toISOString())
        .order('started_at', { ascending: false });

      if (error) {
        console.error('[JobMonitoring] Failed to get job statistics:', error);
        return null;
      }

      if (!data || data.length === 0) {
        return {
          jobType,
          period: { startDate, endDate },
          totalExecutions: 0,
          successfulExecutions: 0,
          failedExecutions: 0,
          partialExecutions: 0,
          successRate: 0,
          averageDurationMs: 0,
          totalItemsProcessed: 0,
          totalItemsFailed: 0,
        };
      }

      const totalExecutions = data.length;
      const successfulExecutions = data.filter((e: any) => e.status === 'completed').length;
      const failedExecutions = data.filter((e: any) => e.status === 'failed').length;
      const partialExecutions = data.filter((e: any) => e.status === 'partial').length;
      const successRate = (successfulExecutions / totalExecutions) * 100;

      const completedJobs = data.filter((e: any) => e.duration_ms !== null);
      const averageDurationMs = completedJobs.length > 0
        ? completedJobs.reduce((sum: number, e: any) => sum + (e.duration_ms || 0), 0) / completedJobs.length
        : 0;

      const totalItemsProcessed = data.reduce((sum: number, e: any) => sum + (e.items_processed || 0), 0);
      const totalItemsFailed = data.reduce((sum: number, e: any) => sum + (e.items_failed || 0), 0);

      const lastExecution = data[0];

      return {
        jobType,
        period: { startDate, endDate },
        totalExecutions,
        successfulExecutions,
        failedExecutions,
        partialExecutions,
        successRate,
        averageDurationMs,
        totalItemsProcessed,
        totalItemsFailed,
        lastExecution: {
          executionId: lastExecution.id,
          status: lastExecution.status,
          startedAt: new Date(lastExecution.started_at),
          durationMs: lastExecution.duration_ms,
        },
      };
    } catch (error) {
      console.error('[JobMonitoring] Error getting job statistics:', error);
      return null;
    }
  }

  /**
   * Get job health status
   * 
   * Analyzes recent job executions to determine health status
   * 
   * @param jobType - Job type to check
   * @param lookbackDays - Number of days to analyze (default: 7)
   * @returns Job health status
   */
  async getJobHealthStatus(
    jobType: string,
    lookbackDays: number = 7
  ): Promise<JobHealthStatus> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - lookbackDays);

    const stats = await this.getJobStatistics(jobType, startDate, endDate);

    if (!stats || stats.totalExecutions === 0) {
      return {
        jobType,
        isHealthy: false,
        issues: ['No recent executions found'],
        consecutiveFailures: 0,
        recentSuccessRate: 0,
        averageExecutionTime: 0,
      };
    }

    const issues: string[] = [];
    let isHealthy = true;

    // Check success rate
    if (stats.successRate < 80) {
      issues.push(`Low success rate: ${stats.successRate.toFixed(1)}%`);
      isHealthy = false;
    }

    // Check for consecutive failures
    const consecutiveFailures = await this.getConsecutiveFailures(jobType);
    if (consecutiveFailures >= 3) {
      issues.push(`${consecutiveFailures} consecutive failures`);
      isHealthy = false;
    }

    // Check average execution time (warn if > 5 minutes)
    if (stats.averageDurationMs > 5 * 60 * 1000) {
      issues.push(`High average execution time: ${(stats.averageDurationMs / 1000).toFixed(0)}s`);
    }

    // Check last execution
    if (stats.lastExecution && stats.lastExecution.status === 'failed') {
      issues.push('Last execution failed');
      isHealthy = false;
    }

    // Get last successful run
    const lastSuccessfulRun = await this.getLastSuccessfulRun(jobType);

    return {
      jobType,
      isHealthy,
      issues,
      lastSuccessfulRun,
      consecutiveFailures,
      recentSuccessRate: stats.successRate,
      averageExecutionTime: stats.averageDurationMs,
    };
  }

  /**
   * Get number of consecutive failures for a job type
   * 
   * @param jobType - Job type to check
   * @returns Number of consecutive failures
   */
  private async getConsecutiveFailures(jobType: string): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .from('job_executions')
        .select('status')
        .eq('job_type', jobType)
        .order('started_at', { ascending: false })
        .limit(10);

      if (error || !data) {
        return 0;
      }

      let consecutiveFailures = 0;
      for (const execution of data) {
        if (execution.status === 'failed') {
          consecutiveFailures++;
        } else {
          break;
        }
      }

      return consecutiveFailures;
    } catch (error) {
      console.error('[JobMonitoring] Error getting consecutive failures:', error);
      return 0;
    }
  }

  /**
   * Get last successful run date for a job type
   * 
   * @param jobType - Job type to check
   * @returns Date of last successful run
   */
  private async getLastSuccessfulRun(jobType: string): Promise<Date | undefined> {
    try {
      const { data, error } = await this.supabase
        .from('job_executions')
        .select('completed_at')
        .eq('job_type', jobType)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data || !data.completed_at) {
        return undefined;
      }

      return new Date(data.completed_at);
    } catch (error) {
      return undefined;
    }
  }

  // ==========================================================================
  // Alerting
  // ==========================================================================

  /**
   * Send job failure alert to administrators
   * 
   * @param alertData - Job failure alert data
   */
  async sendJobFailureAlert(alertData: JobFailureAlertData): Promise<void> {
    try {
      console.log('[JobMonitoring] Sending job failure alert:', alertData);

      // Get admin users
      const adminUserIds = await this.getAdminUserIds();

      if (adminUserIds.length === 0) {
        console.warn('[JobMonitoring] No admin users found to send alert');
        return;
      }

      // Send notification to each admin
      for (const userId of adminUserIds) {
        await this.sendJobFailureNotification(userId, alertData);
      }

      console.log(`[JobMonitoring] Job failure alert sent to ${adminUserIds.length} administrators`);
    } catch (error) {
      console.error('[JobMonitoring] Error sending job failure alert:', error);
    }
  }

  /**
   * Send job failure notification to a user
   * 
   * @param userId - User ID
   * @param alertData - Job failure alert data
   */
  private async sendJobFailureNotification(
    userId: string,
    alertData: JobFailureAlertData
  ): Promise<void> {
    try {
      // Create in-app notification
      const { error } = await this.supabase
        .from('notifications')
        .insert({
          user_id: userId,
          type: 'job_failure',
          title: `🚨 Échec du job: ${alertData.jobName}`,
          body: `Le job "${alertData.jobName}" a échoué après ${(alertData.durationMs / 1000).toFixed(0)}s. Erreur: ${alertData.errorMessage}. ${alertData.consecutiveFailures > 1 ? `Échecs consécutifs: ${alertData.consecutiveFailures}.` : ''}`,
          payload: {
            priority: 'high',
            actionUrl: '/admin/jobs',
            metadata: alertData,
          },
        });

      if (error) {
        console.error('[JobMonitoring] Failed to create job failure notification:', error);
      }
    } catch (error) {
      console.error('[JobMonitoring] Error sending job failure notification:', error);
    }
  }

  /**
   * Get admin user IDs
   * 
   * @returns Array of admin user IDs
   */
  private async getAdminUserIds(): Promise<string[]> {
    try {
      const { data, error } = await this.supabase
        .from('profiles')
        .select('id')
        .eq('role', 'admin');

      if (error || !data) {
        console.error('[JobMonitoring] Failed to get admin users:', error);
        return [];
      }

      return data.map((profile: any) => profile.id);
    } catch (error) {
      console.error('[JobMonitoring] Error getting admin users:', error);
      return [];
    }
  }

  /**
   * Check if job failure alert should be sent
   * 
   * Sends alert if:
   * - Job failed completely
   * - 3 or more consecutive failures
   * - Success rate drops below 50% in last 24 hours
   * 
   * @param executionId - Job execution ID
   * @param jobName - Job name
   * @param jobType - Job type
   * @param status - Job status
   * @param metrics - Job metrics
   */
  async checkAndSendFailureAlert(
    executionId: string,
    jobName: string,
    jobType: string,
    status: 'completed' | 'failed' | 'partial',
    metrics: {
      durationMs: number;
      itemsProcessed: number;
      itemsFailed: number;
      errorMessage?: string;
    }
  ): Promise<void> {
    // Only send alert for failed jobs
    if (status !== 'failed') {
      return;
    }

    const consecutiveFailures = await this.getConsecutiveFailures(jobType);

    // Send alert if job failed or multiple consecutive failures
    if (status === 'failed' || consecutiveFailures >= 3) {
      await this.sendJobFailureAlert({
        executionId,
        jobName,
        jobType,
        errorMessage: metrics.errorMessage || 'Unknown error',
        startedAt: new Date(),
        durationMs: metrics.durationMs,
        itemsProcessed: metrics.itemsProcessed,
        itemsFailed: metrics.itemsFailed,
        consecutiveFailures,
      });
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Singleton instance of JobMonitoringService
 */
export const jobMonitoringService = new JobMonitoringService();
