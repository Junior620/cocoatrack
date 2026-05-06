/**
 * Tests for Job Monitoring Service
 * 
 * Task: 4.5.2 - Implement job monitoring
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JobMonitoringService } from '@/lib/satellite/jobs/job-monitoring.service';

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({
            data: null,
            error: null,
          })),
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              single: vi.fn(() => ({
                data: null,
                error: null,
              })),
            })),
          })),
        })),
        gte: vi.fn(() => ({
          lte: vi.fn(() => ({
            order: vi.fn(() => ({
              data: [],
              error: null,
            })),
          })),
        })),
        order: vi.fn(() => ({
          limit: vi.fn(() => ({
            data: [],
            error: null,
          })),
        })),
      })),
      insert: vi.fn(() => ({
        data: { id: 'test-notification-id' },
        error: null,
      })),
    })),
  })),
}));

describe('JobMonitoringService', () => {
  let service: JobMonitoringService;
  const executionId = 'test-execution-id';

  beforeEach(() => {
    service = new JobMonitoringService();
    // Clear any existing logs
    service.clearJobLogs(executionId);
  });

  describe('Logging', () => {
    it('should log job start', () => {
      service.logJobStart(
        executionId,
        'Test Job',
        'test_job',
        { testParam: 'value' }
      );

      const logs = service.getJobLogs(executionId);
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('info');
      expect(logs[0].message).toContain('Job Start');
      expect(logs[0].message).toContain('Test Job');
      expect(logs[0].context).toMatchObject({
        jobName: 'Test Job',
        jobType: 'test_job',
        executionId,
        testParam: 'value',
      });
    });

    it('should log job progress', () => {
      service.logJobProgress(
        executionId,
        'Processing batch 1/10',
        { batchNumber: 1, totalBatches: 10 }
      );

      const logs = service.getJobLogs(executionId);
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('info');
      expect(logs[0].message).toContain('Job Progress');
      expect(logs[0].message).toContain('Processing batch 1/10');
      expect(logs[0].context).toMatchObject({
        batchNumber: 1,
        totalBatches: 10,
      });
    });

    it('should log job completion with success', () => {
      service.logJobCompletion(
        executionId,
        'Test Job',
        'completed',
        {
          durationMs: 5000,
          itemsProcessed: 100,
          itemsFailed: 0,
        }
      );

      const logs = service.getJobLogs(executionId);
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('info');
      expect(logs[0].message).toContain('Job COMPLETED');
      expect(logs[0].message).toContain('Duration: 5000ms');
      expect(logs[0].message).toContain('Processed: 100');
      expect(logs[0].message).toContain('Failed: 0');
      expect(logs[0].message).toContain('Success Rate: 100.0%');
    });

    it('should log job completion with partial success', () => {
      service.logJobCompletion(
        executionId,
        'Test Job',
        'partial',
        {
          durationMs: 5000,
          itemsProcessed: 100,
          itemsFailed: 10,
        }
      );

      const logs = service.getJobLogs(executionId);
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('warn');
      expect(logs[0].message).toContain('Job PARTIAL');
      expect(logs[0].message).toContain('Success Rate: 90.0%');
    });

    it('should log job completion with failure', () => {
      service.logJobCompletion(
        executionId,
        'Test Job',
        'failed',
        {
          durationMs: 5000,
          itemsProcessed: 0,
          itemsFailed: 0,
          errorMessage: 'Test error',
        }
      );

      const logs = service.getJobLogs(executionId);
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('error');
      expect(logs[0].message).toContain('Job FAILED');
      expect(logs[0].context?.errorMessage).toBe('Test error');
    });

    it('should log job error', () => {
      const error = new Error('Test error message');
      service.logJobError(executionId, error, { additionalContext: 'value' });

      const logs = service.getJobLogs(executionId);
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('error');
      expect(logs[0].message).toContain('Job Error');
      expect(logs[0].message).toContain('Test error message');
      expect(logs[0].context?.error).toBe('Test error message');
      expect(logs[0].context?.stack).toBeDefined();
      expect(logs[0].context?.additionalContext).toBe('value');
    });

    it('should log job warning', () => {
      service.logJobWarning(
        executionId,
        'Max execution time approaching',
        { timeRemaining: 60000 }
      );

      const logs = service.getJobLogs(executionId);
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('warn');
      expect(logs[0].message).toContain('Job Warning');
      expect(logs[0].message).toContain('Max execution time approaching');
      expect(logs[0].context?.timeRemaining).toBe(60000);
    });

    it('should accumulate multiple log entries', () => {
      service.logJobStart(executionId, 'Test Job', 'test_job');
      service.logJobProgress(executionId, 'Step 1');
      service.logJobProgress(executionId, 'Step 2');
      service.logJobCompletion(executionId, 'Test Job', 'completed', {
        durationMs: 1000,
        itemsProcessed: 10,
        itemsFailed: 0,
      });

      const logs = service.getJobLogs(executionId);
      expect(logs).toHaveLength(4);
      expect(logs[0].message).toContain('Job Start');
      expect(logs[1].message).toContain('Step 1');
      expect(logs[2].message).toContain('Step 2');
      expect(logs[3].message).toContain('Job COMPLETED');
    });

    it('should clear job logs', () => {
      service.logJobStart(executionId, 'Test Job', 'test_job');
      service.logJobProgress(executionId, 'Progress');
      
      expect(service.getJobLogs(executionId)).toHaveLength(2);
      
      service.clearJobLogs(executionId);
      
      expect(service.getJobLogs(executionId)).toHaveLength(0);
    });

    it('should return empty array for non-existent execution', () => {
      const logs = service.getJobLogs('non-existent-id');
      expect(logs).toEqual([]);
    });
  });

  describe('Log Entry Structure', () => {
    it('should include timestamp in log entries', () => {
      const beforeTime = new Date();
      service.logJobStart(executionId, 'Test Job', 'test_job');
      const afterTime = new Date();

      const logs = service.getJobLogs(executionId);
      expect(logs[0].timestamp).toBeInstanceOf(Date);
      expect(logs[0].timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(logs[0].timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should include all required fields in log entry', () => {
      service.logJobProgress(executionId, 'Test message', { key: 'value' });

      const logs = service.getJobLogs(executionId);
      const log = logs[0];

      expect(log).toHaveProperty('timestamp');
      expect(log).toHaveProperty('level');
      expect(log).toHaveProperty('message');
      expect(log).toHaveProperty('context');
      expect(log.level).toBe('info');
      expect(log.message).toContain('Test message');
      expect(log.context).toMatchObject({ key: 'value' });
    });
  });

  describe('Success Rate Calculation', () => {
    it('should calculate 100% success rate when no failures', () => {
      service.logJobCompletion(executionId, 'Test Job', 'completed', {
        durationMs: 1000,
        itemsProcessed: 50,
        itemsFailed: 0,
      });

      const logs = service.getJobLogs(executionId);
      expect(logs[0].message).toContain('Success Rate: 100.0%');
      expect(logs[0].context?.successRate).toBe(100);
    });

    it('should calculate correct success rate with failures', () => {
      service.logJobCompletion(executionId, 'Test Job', 'partial', {
        durationMs: 1000,
        itemsProcessed: 100,
        itemsFailed: 25,
      });

      const logs = service.getJobLogs(executionId);
      expect(logs[0].message).toContain('Success Rate: 75.0%');
      expect(logs[0].context?.successRate).toBe(75);
    });

    it('should handle 0% success rate', () => {
      service.logJobCompletion(executionId, 'Test Job', 'failed', {
        durationMs: 1000,
        itemsProcessed: 10,
        itemsFailed: 10,
      });

      const logs = service.getJobLogs(executionId);
      expect(logs[0].message).toContain('Success Rate: 0.0%');
      expect(logs[0].context?.successRate).toBe(0);
    });

    it('should handle zero items processed', () => {
      service.logJobCompletion(executionId, 'Test Job', 'failed', {
        durationMs: 1000,
        itemsProcessed: 0,
        itemsFailed: 0,
      });

      const logs = service.getJobLogs(executionId);
      expect(logs[0].message).toContain('Success Rate: 0.0%');
      expect(logs[0].context?.successRate).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle Error objects', () => {
      const error = new Error('Test error');
      error.stack = 'Error stack trace';
      
      service.logJobError(executionId, error);

      const logs = service.getJobLogs(executionId);
      expect(logs[0].context?.error).toBe('Test error');
      expect(logs[0].context?.stack).toBe('Error stack trace');
    });

    it('should handle string errors', () => {
      service.logJobError(executionId, 'String error message');

      const logs = service.getJobLogs(executionId);
      expect(logs[0].context?.error).toBe('String error message');
      expect(logs[0].context?.stack).toBeUndefined();
    });

    it('should include additional context with errors', () => {
      const error = new Error('Test error');
      service.logJobError(executionId, error, {
        parcelleId: 'test-parcelle',
        attemptNumber: 3,
      });

      const logs = service.getJobLogs(executionId);
      expect(logs[0].context?.parcelleId).toBe('test-parcelle');
      expect(logs[0].context?.attemptNumber).toBe(3);
    });
  });

  describe('Multiple Executions', () => {
    it('should maintain separate logs for different executions', () => {
      const execution1 = 'execution-1';
      const execution2 = 'execution-2';

      service.logJobStart(execution1, 'Job 1', 'test_job');
      service.logJobStart(execution2, 'Job 2', 'test_job');
      service.logJobProgress(execution1, 'Progress 1');
      service.logJobProgress(execution2, 'Progress 2');

      const logs1 = service.getJobLogs(execution1);
      const logs2 = service.getJobLogs(execution2);

      expect(logs1).toHaveLength(2);
      expect(logs2).toHaveLength(2);
      expect(logs1[0].message).toContain('Job 1');
      expect(logs2[0].message).toContain('Job 2');
      expect(logs1[1].message).toContain('Progress 1');
      expect(logs2[1].message).toContain('Progress 2');
    });
  });
});
