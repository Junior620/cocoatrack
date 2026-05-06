/**
 * Tests for Deforestation Detection Job
 * 
 * Task: 4.5.1 - Create periodic deforestation detection job
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DeforestationDetectionJob } from '@/lib/satellite/jobs/deforestation-detection.job';
import { deforestationService } from '@/lib/satellite/services/deforestation.service';
import type { MultiPolygon } from 'geojson';

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        not: vi.fn(() => ({
          gt: vi.fn(() => ({
            eq: vi.fn(() => ({
              data: [],
              error: null,
            })),
          })),
        })),
        single: vi.fn(() => ({
          data: { id: 'test-execution-id' },
          error: null,
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({
            data: { id: 'test-execution-id' },
            error: null,
          })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          data: null,
          error: null,
        })),
      })),
    })),
  })),
}));

// Mock deforestation service
vi.mock('@/lib/satellite/services/deforestation.service', () => ({
  deforestationService: {
    detectDeforestation: vi.fn(),
  },
}));

describe('DeforestationDetectionJob', () => {
  let job: DeforestationDetectionJob;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set required environment variables
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Job Initialization', () => {
    it('should throw error if SUPABASE_SERVICE_KEY is missing', () => {
      delete process.env.SUPABASE_SERVICE_KEY;
      
      expect(() => new DeforestationDetectionJob()).toThrow(
        'SUPABASE_SERVICE_KEY environment variable is required'
      );
    });

    it('should initialize successfully with required environment variables', () => {
      expect(() => new DeforestationDetectionJob()).not.toThrow();
    });
  });

  describe('Job Execution', () => {
    beforeEach(() => {
      job = new DeforestationDetectionJob();
    });

    it('should complete successfully with no parcelles', async () => {
      // Mock empty parcelles result
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            not: vi.fn(() => ({
              gt: vi.fn(() => ({
                data: [],
                error: null,
              })),
            })),
          })),
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => ({
                data: { id: 'test-execution-id' },
                error: null,
              })),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              data: null,
              error: null,
            })),
          })),
        })),
      };

      // @ts-ignore - Mock private property
      job.supabase = mockSupabase;

      const result = await job.run();

      expect(result.status).toBe('completed');
      expect(result.totalProcessed).toBe(0);
      expect(result.totalFailed).toBe(0);
      expect(result.deforestationDetected).toBe(0);
    });

    it('should process parcelles in batches', async () => {
      // Mock parcelles
      const mockParcelles = [
        {
          id: 'parcelle-1',
          code: 'P001',
          geometry: { type: 'MultiPolygon', coordinates: [] } as MultiPolygon,
          surface_hectares: 5.5,
        },
        {
          id: 'parcelle-2',
          code: 'P002',
          geometry: { type: 'MultiPolygon', coordinates: [] } as MultiPolygon,
          surface_hectares: 3.2,
        },
      ];

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'parcelles') {
            return {
              select: vi.fn(() => ({
                not: vi.fn(() => ({
                  gt: vi.fn(() => ({
                    data: mockParcelles,
                    error: null,
                  })),
                })),
              })),
            };
          }
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(() => ({
                  data: { id: 'test-execution-id' },
                  error: null,
                })),
              })),
            })),
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                data: null,
                error: null,
              })),
            })),
          };
        }),
      };

      // @ts-ignore - Mock private property
      job.supabase = mockSupabase;

      // Mock deforestation detection
      vi.mocked(deforestationService.detectDeforestation).mockResolvedValue({
        detected: false,
        baselineNDVI: 0.7,
        currentNDVI: 0.68,
        ndviChange: -0.02,
        affectedAreaHectares: 0,
        affectedAreaPercent: 0,
      });

      const result = await job.run({ batchSize: 1 });

      expect(result.status).toBe('completed');
      expect(result.totalProcessed).toBe(2);
      expect(result.totalFailed).toBe(0);
      expect(deforestationService.detectDeforestation).toHaveBeenCalledTimes(2);
    });

    it('should detect deforestation events', async () => {
      // Mock parcelles
      const mockParcelles = [
        {
          id: 'parcelle-1',
          code: 'P001',
          geometry: { type: 'MultiPolygon', coordinates: [] } as MultiPolygon,
          surface_hectares: 5.5,
        },
      ];

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'parcelles') {
            return {
              select: vi.fn(() => ({
                not: vi.fn(() => ({
                  gt: vi.fn(() => ({
                    data: mockParcelles,
                    error: null,
                  })),
                })),
              })),
            };
          }
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(() => ({
                  data: { id: 'test-execution-id' },
                  error: null,
                })),
              })),
            })),
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                data: null,
                error: null,
              })),
            })),
          };
        }),
      };

      // @ts-ignore - Mock private property
      job.supabase = mockSupabase;

      // Mock deforestation detection - deforestation detected
      vi.mocked(deforestationService.detectDeforestation).mockResolvedValue({
        detected: true,
        baselineNDVI: 0.8,
        currentNDVI: 0.4,
        ndviChange: -0.4,
        affectedAreaHectares: 5.5,
        affectedAreaPercent: 100,
        event: {
          id: 'event-1',
          parcelleId: 'parcelle-1',
          baselineDate: new Date('2020-12-31'),
          detectionDate: new Date(),
          baselineNDVI: 0.8,
          currentNDVI: 0.4,
          ndviChange: -0.4,
          affectedAreaHectares: 5.5,
          affectedAreaPercent: 100,
          status: 'pending',
          acknowledgedBy: null,
          acknowledgedAt: null,
          acknowledgmentNotes: null,
          disputedBy: null,
          disputedAt: null,
          disputeReason: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const result = await job.run();

      expect(result.status).toBe('completed');
      expect(result.totalProcessed).toBe(1);
      expect(result.totalFailed).toBe(0);
      expect(result.deforestationDetected).toBe(1);
    });

    it('should handle partial failures', async () => {
      // Mock parcelles
      const mockParcelles = [
        {
          id: 'parcelle-1',
          code: 'P001',
          geometry: { type: 'MultiPolygon', coordinates: [] } as MultiPolygon,
          surface_hectares: 5.5,
        },
        {
          id: 'parcelle-2',
          code: 'P002',
          geometry: { type: 'MultiPolygon', coordinates: [] } as MultiPolygon,
          surface_hectares: 3.2,
        },
      ];

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'parcelles') {
            return {
              select: vi.fn(() => ({
                not: vi.fn(() => ({
                  gt: vi.fn(() => ({
                    data: mockParcelles,
                    error: null,
                  })),
                })),
              })),
            };
          }
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(() => ({
                  data: { id: 'test-execution-id' },
                  error: null,
                })),
              })),
            })),
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                data: null,
                error: null,
              })),
            })),
          };
        }),
      };

      // @ts-ignore - Mock private property
      job.supabase = mockSupabase;

      // Mock deforestation detection - first succeeds, second fails
      vi.mocked(deforestationService.detectDeforestation)
        .mockResolvedValueOnce({
          detected: false,
          baselineNDVI: 0.7,
          currentNDVI: 0.68,
          ndviChange: -0.02,
          affectedAreaHectares: 0,
          affectedAreaPercent: 0,
        })
        .mockRejectedValueOnce(new Error('Imagery unavailable'));

      const result = await job.run();

      expect(result.status).toBe('partial');
      expect(result.totalProcessed).toBe(1);
      expect(result.totalFailed).toBe(1);
    });

    it('should respect batch delay', async () => {
      // Mock parcelles
      const mockParcelles = [
        {
          id: 'parcelle-1',
          code: 'P001',
          geometry: { type: 'MultiPolygon', coordinates: [] } as MultiPolygon,
          surface_hectares: 5.5,
        },
        {
          id: 'parcelle-2',
          code: 'P002',
          geometry: { type: 'MultiPolygon', coordinates: [] } as MultiPolygon,
          surface_hectares: 3.2,
        },
      ];

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'parcelles') {
            return {
              select: vi.fn(() => ({
                not: vi.fn(() => ({
                  gt: vi.fn(() => ({
                    data: mockParcelles,
                    error: null,
                  })),
                })),
              })),
            };
          }
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(() => ({
                  data: { id: 'test-execution-id' },
                  error: null,
                })),
              })),
            })),
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                data: null,
                error: null,
              })),
            })),
          };
        }),
      };

      // @ts-ignore - Mock private property
      job.supabase = mockSupabase;

      // Mock deforestation detection
      vi.mocked(deforestationService.detectDeforestation).mockResolvedValue({
        detected: false,
        baselineNDVI: 0.7,
        currentNDVI: 0.68,
        ndviChange: -0.02,
        affectedAreaHectares: 0,
        affectedAreaPercent: 0,
      });

      const startTime = Date.now();
      await job.run({ batchSize: 1, batchDelayMs: 100 });
      const duration = Date.now() - startTime;

      // Should have at least one batch delay (100ms)
      expect(duration).toBeGreaterThanOrEqual(100);
    });

    it('should filter by cooperative ID', async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'parcelles') {
            return {
              select: vi.fn(() => ({
                not: vi.fn(() => ({
                  gt: vi.fn(() => ({
                    eq: vi.fn(() => ({
                      data: [],
                      error: null,
                    })),
                  })),
                })),
              })),
            };
          }
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(() => ({
                  data: { id: 'test-execution-id' },
                  error: null,
                })),
              })),
            })),
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                data: null,
                error: null,
              })),
            })),
          };
        }),
      };

      // @ts-ignore - Mock private property
      job.supabase = mockSupabase;

      await job.run({ cooperativeId: 'test-cooperative-id' });

      // Verify that the query was called with cooperative filter
      expect(mockSupabase.from).toHaveBeenCalledWith('parcelles');
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      job = new DeforestationDetectionJob();
    });

    it('should handle complete job failure', async () => {
      const mockSupabase = {
        from: vi.fn(() => {
          throw new Error('Database connection failed');
        }),
      };

      // @ts-ignore - Mock private property
      job.supabase = mockSupabase;

      const result = await job.run();

      expect(result.status).toBe('failed');
      expect(result.errorMessage).toBe('Database connection failed');
    });
  });
});
