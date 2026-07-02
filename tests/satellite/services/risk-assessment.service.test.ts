/**
 * Risk Assessment Service Tests
 * 
 * Tests for parcelle risk classification and assessment logic
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  RiskAssessmentService,
  RISK_CATEGORIES,
  type RiskCategory,
} from '@/lib/satellite/services/risk-assessment.service';
import type { HealthStatus } from '@/lib/satellite/types';

describe('RiskAssessmentService', () => {
  let service: RiskAssessmentService;
  let mockSupabase: any;

  beforeEach(() => {
    service = new RiskAssessmentService();
    
    // Mock Supabase client
    mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({
                single: vi.fn(),
              })),
            })),
            gte: vi.fn(() => ({
              order: vi.fn(),
            })),
            in: vi.fn(),
          })),
        })),
      })),
    };
  });

  describe('determineRiskCategory', () => {
    it('should classify as HIGH_RISK for critical health status', () => {
      // @ts-ignore - accessing private method for testing
      const category = service.determineRiskCategory(
        'critical' as HealthStatus,
        'stable',
        false,
        0
      );
      expect(category).toBe(RISK_CATEGORIES.HIGH_RISK);
    });

    it('should classify as HIGH_RISK for poor health status', () => {
      // @ts-ignore
      const category = service.determineRiskCategory(
        'poor' as HealthStatus,
        'stable',
        false,
        0
      );
      expect(category).toBe(RISK_CATEGORIES.HIGH_RISK);
    });

    it('should classify as HIGH_RISK when deforestation alerts present', () => {
      // @ts-ignore
      const category = service.determineRiskCategory(
        'good' as HealthStatus,
        'stable',
        true, // has deforestation
        0
      );
      expect(category).toBe(RISK_CATEGORIES.HIGH_RISK);
    });

    it('should classify as HIGH_RISK for declining fair health', () => {
      // @ts-ignore
      const category = service.determineRiskCategory(
        'fair' as HealthStatus,
        'declining',
        false,
        0
      );
      expect(category).toBe(RISK_CATEGORIES.HIGH_RISK);
    });

    it('should classify as EXCELLENT for excellent health with improving trend', () => {
      // @ts-ignore
      const category = service.determineRiskCategory(
        'excellent' as HealthStatus,
        'improving',
        false,
        0
      );
      expect(category).toBe(RISK_CATEGORIES.EXCELLENT);
    });

    it('should classify as EXCELLENT for excellent health with stable trend', () => {
      // @ts-ignore
      const category = service.determineRiskCategory(
        'excellent' as HealthStatus,
        'stable',
        false,
        0
      );
      expect(category).toBe(RISK_CATEGORIES.EXCELLENT);
    });

    it('should NOT classify as EXCELLENT if deforestation present', () => {
      // @ts-ignore
      const category = service.determineRiskCategory(
        'excellent' as HealthStatus,
        'stable',
        true, // has deforestation
        0
      );
      expect(category).not.toBe(RISK_CATEGORIES.EXCELLENT);
    });

    it('should NOT classify as EXCELLENT if significant changes present', () => {
      // @ts-ignore
      const category = service.determineRiskCategory(
        'excellent' as HealthStatus,
        'stable',
        false,
        3 // significant changes
      );
      expect(category).not.toBe(RISK_CATEGORIES.EXCELLENT);
    });

    it('should classify as LOW_RISK for good health with improving trend', () => {
      // @ts-ignore
      const category = service.determineRiskCategory(
        'good' as HealthStatus,
        'improving',
        false,
        0
      );
      expect(category).toBe(RISK_CATEGORIES.LOW_RISK);
    });

    it('should classify as LOW_RISK for excellent health with improving trend but minor changes', () => {
      // @ts-ignore
      const category = service.determineRiskCategory(
        'excellent' as HealthStatus,
        'improving',
        false,
        1 // has minor change
      );
      expect(category).toBe(RISK_CATEGORIES.LOW_RISK);
    });

    it('should classify as MEDIUM_RISK for fair health with stable trend', () => {
      // @ts-ignore
      const category = service.determineRiskCategory(
        'fair' as HealthStatus,
        'stable',
        false,
        0
      );
      expect(category).toBe(RISK_CATEGORIES.MEDIUM_RISK);
    });

    it('should classify as MEDIUM_RISK for good health with declining trend', () => {
      // @ts-ignore
      const category = service.determineRiskCategory(
        'good' as HealthStatus,
        'declining',
        false,
        0
      );
      expect(category).toBe(RISK_CATEGORIES.MEDIUM_RISK);
    });

    it('should classify as UNKNOWN when no health status', () => {
      // @ts-ignore
      const category = service.determineRiskCategory(null, null, false, 0);
      expect(category).toBe(RISK_CATEGORIES.UNKNOWN);
    });
  });

  describe('analyzeTemporalData', () => {
    it('should return null values for empty data', () => {
      // @ts-ignore
      const result = service.analyzeTemporalData([]);
      expect(result.trend).toBeNull();
      expect(result.changeRate).toBeNull();
      expect(result.avgNDVI).toBeNull();
    });

    it('should return single value stats for one data point', () => {
      const data = [{ mean_ndvi: 0.65, calculation_date: new Date() }];
      // @ts-ignore
      const result = service.analyzeTemporalData(data);
      expect(result.trend).toBeNull();
      expect(result.avgNDVI).toBe(0.65);
      expect(result.minNDVI).toBe(0.65);
      expect(result.maxNDVI).toBe(0.65);
    });

    it('should detect improving trend', () => {
      const data = [
        { mean_ndvi: 0.50, calculation_date: new Date('2026-05-01') },
        { mean_ndvi: 0.55, calculation_date: new Date('2026-05-15') },
        { mean_ndvi: 0.60, calculation_date: new Date('2026-06-01') },
        { mean_ndvi: 0.65, calculation_date: new Date('2026-06-15') },
      ];
      // @ts-ignore
      const result = service.analyzeTemporalData(data);
      expect(result.trend).toBe('improving');
      expect(result.changeRate).toBeGreaterThan(0);
    });

    it('should detect declining trend', () => {
      const data = [
        { mean_ndvi: 0.65, calculation_date: new Date('2026-05-01') },
        { mean_ndvi: 0.60, calculation_date: new Date('2026-05-15') },
        { mean_ndvi: 0.55, calculation_date: new Date('2026-06-01') },
        { mean_ndvi: 0.50, calculation_date: new Date('2026-06-15') },
      ];
      // @ts-ignore
      const result = service.analyzeTemporalData(data);
      expect(result.trend).toBe('declining');
      expect(result.changeRate).toBeLessThan(0);
    });

    it('should detect stable trend', () => {
      const data = [
        { mean_ndvi: 0.60, calculation_date: new Date('2026-05-01') },
        { mean_ndvi: 0.60, calculation_date: new Date('2026-05-15') },
        { mean_ndvi: 0.60, calculation_date: new Date('2026-06-01') },
        { mean_ndvi: 0.60, calculation_date: new Date('2026-06-15') },
      ];
      // @ts-ignore
      const result = service.analyzeTemporalData(data);
      expect(result.trend).toBe('stable');
      expect(Math.abs(result.changeRate!)).toBeLessThan(0.001);
    });

    it('should calculate correct statistics', () => {
      const data = [
        { mean_ndvi: 0.40, calculation_date: new Date('2026-05-01') },
        { mean_ndvi: 0.50, calculation_date: new Date('2026-05-15') },
        { mean_ndvi: 0.60, calculation_date: new Date('2026-06-01') },
        { mean_ndvi: 0.70, calculation_date: new Date('2026-06-15') },
      ];
      // @ts-ignore
      const result = service.analyzeTemporalData(data);
      expect(result.avgNDVI).toBe(0.55); // (0.40 + 0.50 + 0.60 + 0.70) / 4
      expect(result.minNDVI).toBe(0.40);
      expect(result.maxNDVI).toBe(0.70);
    });

    it('should count significant changes (> 0.15)', () => {
      const data = [
        { mean_ndvi: 0.40, calculation_date: new Date('2026-05-01') },
        { mean_ndvi: 0.60, calculation_date: new Date('2026-05-15') }, // +0.20 (significant)
        { mean_ndvi: 0.65, calculation_date: new Date('2026-06-01') }, // +0.05 (not significant)
        { mean_ndvi: 0.45, calculation_date: new Date('2026-06-15') }, // -0.20 (significant)
      ];
      // @ts-ignore
      const result = service.analyzeTemporalData(data);
      expect(result.significantChanges).toBe(2);
    });

    it('should not count non-significant changes (< 0.15)', () => {
      const data = [
        { mean_ndvi: 0.50, calculation_date: new Date('2026-05-01') },
        { mean_ndvi: 0.55, calculation_date: new Date('2026-05-15') }, // +0.05
        { mean_ndvi: 0.60, calculation_date: new Date('2026-06-01') }, // +0.05
        { mean_ndvi: 0.62, calculation_date: new Date('2026-06-15') }, // +0.02
      ];
      // @ts-ignore
      const result = service.analyzeTemporalData(data);
      expect(result.significantChanges).toBe(0);
    });
  });

  describe('identifyRiskFactors', () => {
    it('should identify critical health as risk factor', () => {
      // @ts-ignore
      const factors = service.identifyRiskFactors(
        'critical' as HealthStatus,
        'stable',
        false,
        0
      );
      expect(factors).toContain('Santé critique');
    });

    it('should identify poor health as risk factor', () => {
      // @ts-ignore
      const factors = service.identifyRiskFactors(
        'poor' as HealthStatus,
        'stable',
        false,
        0
      );
      expect(factors).toContain('Santé faible');
    });

    it('should identify declining trend as risk factor', () => {
      // @ts-ignore
      const factors = service.identifyRiskFactors(
        'good' as HealthStatus,
        'declining',
        false,
        0
      );
      expect(factors).toContain('Tendance en déclin');
    });

    it('should identify deforestation as risk factor', () => {
      // @ts-ignore
      const factors = service.identifyRiskFactors(
        'good' as HealthStatus,
        'stable',
        true,
        0
      );
      expect(factors).toContain('Alertes de déforestation');
    });

    it('should identify significant changes as risk factor', () => {
      // @ts-ignore
      const factors = service.identifyRiskFactors(
        'good' as HealthStatus,
        'stable',
        false,
        3
      );
      expect(factors).toContain('3 changement(s) significatif(s)');
    });

    it('should return no risk factors for excellent parcelle', () => {
      // @ts-ignore
      const factors = service.identifyRiskFactors(
        'excellent' as HealthStatus,
        'stable',
        false,
        0
      );
      expect(factors).toContain('Aucun facteur de risque identifié');
    });

    it('should return insufficient data for null values', () => {
      // @ts-ignore
      const factors = service.identifyRiskFactors(null, null, false, 0);
      expect(factors).toContain('Données insuffisantes');
    });
  });

  describe('generateRecommendations', () => {
    it('should recommend urgent visit for HIGH_RISK', () => {
      // @ts-ignore
      const recommendations = service.generateRecommendations(
        RISK_CATEGORIES.HIGH_RISK,
        'critical' as HealthStatus,
        'declining',
        false
      );
      expect(recommendations).toContain('Visite terrain urgente requise');
    });

    it('should recommend immediate intervention for critical health', () => {
      // @ts-ignore
      const recommendations = service.generateRecommendations(
        RISK_CATEGORIES.HIGH_RISK,
        'critical' as HealthStatus,
        'stable',
        false
      );
      expect(recommendations).toContain('Intervention immédiate pour défoliation sévère');
    });

    it('should recommend EUDR check when deforestation present', () => {
      // @ts-ignore
      const recommendations = service.generateRecommendations(
        RISK_CATEGORIES.HIGH_RISK,
        'good' as HealthStatus,
        'stable',
        true
      );
      expect(recommendations).toContain('Vérifier conformité EUDR');
    });

    it('should recommend increased monitoring for MEDIUM_RISK', () => {
      // @ts-ignore
      const recommendations = service.generateRecommendations(
        RISK_CATEGORIES.MEDIUM_RISK,
        'fair' as HealthStatus,
        'stable',
        false
      );
      expect(recommendations).toContain('Surveillance accrue recommandée');
    });

    it('should recommend maintaining practices for LOW_RISK', () => {
      // @ts-ignore
      const recommendations = service.generateRecommendations(
        RISK_CATEGORIES.LOW_RISK,
        'good' as HealthStatus,
        'stable',
        false
      );
      expect(recommendations).toContain('Maintenir pratiques culturales actuelles');
    });

    it('should recommend sharing best practices for EXCELLENT', () => {
      // @ts-ignore
      const recommendations = service.generateRecommendations(
        RISK_CATEGORIES.EXCELLENT,
        'excellent' as HealthStatus,
        'improving',
        false
      );
      expect(recommendations).toContain('Partager bonnes pratiques avec autres planteurs');
    });

    it('should recommend data collection for UNKNOWN', () => {
      // @ts-ignore
      const recommendations = service.generateRecommendations(
        RISK_CATEGORIES.UNKNOWN,
        null,
        null,
        false
      );
      expect(recommendations).toContain('Collecter données NDVI pour évaluation');
    });
  });
});
