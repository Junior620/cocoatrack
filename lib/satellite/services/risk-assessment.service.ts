/**
 * Risk Assessment Service
 * 
 * Classifies parcelles into risk categories based on:
 * - NDVI health status (current)
 * - Temporal trend analysis (improving/declining/stable)
 * - Deforestation alerts
 * - Significant NDVI changes
 * 
 * Categories:
 * - HIGH_RISK: Critical/poor health + declining trend + deforestation alerts
 * - MEDIUM_RISK: Fair health or declining trend without critical status
 * - LOW_RISK: Good/excellent health + stable/improving trend
 * - EXCELLENT: Excellent health + improving trend + no alerts
 */

import type { HealthStatus } from '../types';

// ============================================================================
// Constants
// ============================================================================

/**
 * Risk categories for parcelles
 */
export const RISK_CATEGORIES = {
  HIGH_RISK: 'high_risk',
  MEDIUM_RISK: 'medium_risk',
  LOW_RISK: 'low_risk',
  EXCELLENT: 'excellent',
  UNKNOWN: 'unknown',
} as const;

export type RiskCategory = (typeof RISK_CATEGORIES)[keyof typeof RISK_CATEGORIES];

/**
 * French labels for risk categories
 */
export const RISK_CATEGORY_LABELS: Record<RiskCategory, string> = {
  high_risk: 'À Risque Élevé',
  medium_risk: 'À Surveiller',
  low_risk: 'Santé Correcte',
  excellent: 'Excellente Santé',
  unknown: 'Non Évalué',
};

/**
 * Colors for risk categories
 */
export const RISK_CATEGORY_COLORS: Record<RiskCategory, string> = {
  high_risk: '#ef4444',    // Red
  medium_risk: '#f59e0b',  // Amber
  low_risk: '#10b981',     // Green
  excellent: '#2d5016',    // Dark Green
  unknown: '#6b7280',      // Gray
};

/**
 * High-risk health statuses
 */
const HIGH_RISK_STATUSES: HealthStatus[] = ['critical', 'poor'];

/**
 * Good health statuses
 */
const GOOD_STATUSES: HealthStatus[] = ['excellent', 'good'];

/**
 * Temporal trend window in days for analysis
 */
const TREND_ANALYSIS_WINDOW_DAYS = 90;

// ============================================================================
// Types
// ============================================================================

/**
 * Risk assessment result for a parcelle
 */
export interface RiskAssessment {
  parcelleId: string;
  riskCategory: RiskCategory;
  currentHealthStatus: HealthStatus | null;
  currentNDVI: number | null;
  trend: 'improving' | 'stable' | 'declining' | null;
  trendChangeRate: number | null;
  hasDeforestationAlerts: boolean;
  deforestationAlertCount: number;
  hasSignificantChanges: boolean;
  significantChangeCount: number;
  lastCalculationDate: Date | null;
  temporalDataPoints: number;
  averageNDVI: number | null;
  minNDVI: number | null;
  maxNDVI: number | null;
  riskFactors: string[];
  recommendations: string[];
  assessmentDate: Date;
}

/**
 * Parcelle with full details for export
 */
export interface ParcelleWithRiskDetails {
  // Basic parcelle info
  id: string;
  code: string | null;
  label: string | null;
  village: string | null;
  region: string | null;
  surface_hectares: number;
  
  // Planteur info
  planteur_id: string | null;
  planteur_name: string | null;
  planteur_code: string | null;
  
  // Risk assessment
  risk_category: RiskCategory;
  current_health_status: HealthStatus | null;
  current_ndvi: number | null;
  trend: string | null;
  trend_change_rate: number | null;
  
  // Alerts and changes
  deforestation_alert_count: number;
  significant_change_count: number;
  
  // Temporal statistics
  last_calculation_date: Date | null;
  temporal_data_points: number;
  average_ndvi: number | null;
  min_ndvi: number | null;
  max_ndvi: number | null;
  
  // Additional context
  risk_factors: string;
  recommendations: string;
}

/**
 * Filter options for parcelle risk queries
 */
export interface RiskFilterOptions {
  riskCategories?: RiskCategory[];
  regions?: string[];
  minSurfaceHectares?: number;
  maxSurfaceHectares?: number;
  hasDeforestation?: boolean;
  planteurId?: string;
  cooperativeId?: string;
}

// ============================================================================
// Service
// ============================================================================

export class RiskAssessmentService {
  /**
   * Assess risk for a single parcelle
   * 
   * @param parcelleId - Parcelle UUID
   * @param supabase - Supabase client
   * @returns Risk assessment
   */
  async assessRisk(
    parcelleId: string,
    supabase: any
  ): Promise<RiskAssessment> {
    const assessmentDate = new Date();

    // Get latest NDVI result
    const { data: latestNDVI } = await supabase
      .from('ndvi_results')
      .select('*')
      .eq('parcelle_id', parcelleId)
      .order('calculation_date', { ascending: false })
      .limit(1)
      .single();

    // Get temporal data for trend analysis (last 90 days)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - TREND_ANALYSIS_WINDOW_DAYS);

    const { data: temporalData } = await supabase
      .from('ndvi_results')
      .select('calculation_date, mean_ndvi, mean_evi, mean_ndmi, health_status')
      .eq('parcelle_id', parcelleId)
      .gte('calculation_date', startDate.toISOString())
      .order('calculation_date', { ascending: true });

    // Get deforestation alerts
    const { data: deforestationEvents } = await supabase
      .from('deforestation_events')
      .select('*')
      .eq('parcelle_id', parcelleId)
      .in('status', ['pending', 'acknowledged']);

    // Calculate temporal statistics and trend
    const { trend, changeRate, avgNDVI, minNDVI, maxNDVI, significantChanges } =
      this.analyzeTemporalData(temporalData || []);

    const deforestationCount = deforestationEvents?.length || 0;
    const hasDeforestation = deforestationCount > 0;

    // Early hydric / canopy alerts from index series
    const { detectNDMIEarlyAlert } = await import('../ndmi-alerts');
    const { detectEVIEarlyAlert } = await import('../evi-alerts');
    const { combineVegetationAlerts } = await import('../combined-alerts');
    const series = (temporalData || []).map((row: any) => ({
      date: row.calculation_date,
      ndvi: Number(row.mean_ndvi),
      evi: row.mean_evi != null ? Number(row.mean_evi) : null,
      ndmi: row.mean_ndmi != null ? Number(row.mean_ndmi) : null,
    }));
    const eviAlert = detectEVIEarlyAlert(series);
    const ndmiAlert = detectNDMIEarlyAlert(series);
    const combined = combineVegetationAlerts(eviAlert, ndmiAlert);
    const hasHydricAlert = ndmiAlert.level === 'alert';
    const hasEarlyWatch =
      ndmiAlert.level === 'watch' ||
      eviAlert.level === 'watch' ||
      eviAlert.level === 'alert';
    const hasDualAlert = combined.code === 'canopy_and_hydric';

    // Determine risk category
    const riskCategory = this.determineRiskCategory(
      latestNDVI?.health_status as HealthStatus | null,
      trend,
      hasDeforestation,
      significantChanges,
      hasHydricAlert || hasDualAlert,
      hasEarlyWatch
    );

    // Identify risk factors
    const riskFactors = this.identifyRiskFactors(
      latestNDVI?.health_status as HealthStatus | null,
      trend,
      hasDeforestation,
      significantChanges,
      ndmiAlert.level,
      eviAlert.level,
      hasDualAlert
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      riskCategory,
      latestNDVI?.health_status as HealthStatus | null,
      trend,
      hasDeforestation,
      hasHydricAlert || hasDualAlert
    );

    return {
      parcelleId,
      riskCategory,
      currentHealthStatus: (latestNDVI?.health_status as HealthStatus) || null,
      currentNDVI: latestNDVI?.mean_ndvi ? Number(latestNDVI.mean_ndvi) : null,
      trend,
      trendChangeRate: changeRate,
      hasDeforestationAlerts: hasDeforestation,
      deforestationAlertCount: deforestationCount,
      hasSignificantChanges: significantChanges > 0,
      significantChangeCount: significantChanges,
      lastCalculationDate: latestNDVI?.calculation_date
        ? new Date(latestNDVI.calculation_date)
        : null,
      temporalDataPoints: temporalData?.length || 0,
      averageNDVI: avgNDVI,
      minNDVI: minNDVI,
      maxNDVI: maxNDVI,
      riskFactors,
      recommendations,
      assessmentDate,
    };
  }

  /**
   * Get parcelles filtered by risk category with full details
   * 
   * @param filters - Filter options
   * @param supabase - Supabase client
   * @returns Array of parcelles with risk details
   */
  async getParcellesByRisk(
    filters: RiskFilterOptions,
    supabase: any,
    limit?: number
  ): Promise<ParcelleWithRiskDetails[]> {
    // Get all parcelles with basic filters
    let query = supabase
      .from('parcelles')
      .select(`
        id,
        code,
        label,
        village,
        region,
        surface_hectares,
        planteur_id
      `);

    // Apply basic filters
    if (filters.regions && filters.regions.length > 0) {
      query = query.in('region', filters.regions);
    }
    if (filters.minSurfaceHectares) {
      query = query.gte('surface_hectares', filters.minSurfaceHectares);
    }
    if (filters.maxSurfaceHectares) {
      query = query.lte('surface_hectares', filters.maxSurfaceHectares);
    }
    if (filters.planteurId) {
      query = query.eq('planteur_id', filters.planteurId);
    }

    // Apply limit if specified (important for large exports)
    if (limit) {
      query = query.limit(limit);
    }

    const { data: parcelles, error } = await query;

    if (error || !parcelles) {
      throw new Error(`Failed to fetch parcelles: ${error?.message}`);
    }

    // Assess risk for each parcelle
    const assessments = await Promise.all(
      parcelles.map(async (p: any) => {
        const assessment = await this.assessRisk(p.id, supabase);
        
        // Get planteur info if planteur_id exists
        let planteurInfo = null;
        if (p.planteur_id) {
          const { data: planteur } = await supabase
            .from('planteurs')
            .select('code, nom, prenom')
            .eq('id', p.planteur_id)
            .single();
          
          if (planteur) {
            planteurInfo = {
              code: planteur.code,
              name: `${planteur.prenom || ''} ${planteur.nom || ''}`.trim() || null,
            };
          }
        }
        
        return {
          parcelle: p,
          planteur: planteurInfo,
          assessment,
        };
      })
    );

    // Filter by risk category
    let filtered = assessments;
    if (filters.riskCategories && filters.riskCategories.length > 0) {
      filtered = filtered.filter((item) =>
        filters.riskCategories!.includes(item.assessment.riskCategory)
      );
    }

    // Filter by deforestation
    if (filters.hasDeforestation !== undefined) {
      filtered = filtered.filter(
        (item) => item.assessment.hasDeforestationAlerts === filters.hasDeforestation
      );
    }

    // Map to export format
    return filtered.map((item) => ({
      id: item.parcelle.id,
      code: item.parcelle.code,
      label: item.parcelle.label,
      village: item.parcelle.village,
      region: item.parcelle.region,
      surface_hectares: item.parcelle.surface_hectares,
      planteur_id: item.parcelle.planteur_id,
      planteur_name: item.planteur?.name || null,
      planteur_code: item.planteur?.code || null,
      risk_category: item.assessment.riskCategory,
      current_health_status: item.assessment.currentHealthStatus,
      current_ndvi: item.assessment.currentNDVI,
      trend: item.assessment.trend,
      trend_change_rate: item.assessment.trendChangeRate,
      deforestation_alert_count: item.assessment.deforestationAlertCount,
      significant_change_count: item.assessment.significantChangeCount,
      last_calculation_date: item.assessment.lastCalculationDate,
      temporal_data_points: item.assessment.temporalDataPoints,
      average_ndvi: item.assessment.averageNDVI,
      min_ndvi: item.assessment.minNDVI,
      max_ndvi: item.assessment.maxNDVI,
      risk_factors: item.assessment.riskFactors.join('; '),
      recommendations: item.assessment.recommendations.join('; '),
    }));
  }

  /**
   * Analyze temporal data to determine trend and statistics
   */
  private analyzeTemporalData(data: any[]): {
    trend: 'improving' | 'stable' | 'declining' | null;
    changeRate: number | null;
    avgNDVI: number | null;
    minNDVI: number | null;
    maxNDVI: number | null;
    significantChanges: number;
  } {
    if (!data || data.length < 2) {
      return {
        trend: null,
        changeRate: null,
        avgNDVI: data[0]?.mean_ndvi ? Number(data[0].mean_ndvi) : null,
        minNDVI: data[0]?.mean_ndvi ? Number(data[0].mean_ndvi) : null,
        maxNDVI: data[0]?.mean_ndvi ? Number(data[0].mean_ndvi) : null,
        significantChanges: 0,
      };
    }

    const ndviValues = data.map((d) => Number(d.mean_ndvi));

    // Calculate statistics
    const avgNDVI = ndviValues.reduce((a, b) => a + b, 0) / ndviValues.length;
    const minNDVI = Math.min(...ndviValues);
    const maxNDVI = Math.max(...ndviValues);

    // Calculate trend (linear regression slope)
    const n = data.length;
    const xValues = Array.from({ length: n }, (_, i) => i);
    const yValues = ndviValues;

    const xMean = xValues.reduce((a, b) => a + b, 0) / n;
    const yMean = yValues.reduce((a, b) => a + b, 0) / n;

    const numerator = xValues.reduce(
      (sum, x, i) => sum + (x - xMean) * (yValues[i] - yMean),
      0
    );
    const denominator = xValues.reduce((sum, x) => sum + Math.pow(x - xMean, 2), 0);

    const slope = denominator !== 0 ? numerator / denominator : 0;

    // Determine trend category
    let trend: 'improving' | 'stable' | 'declining' | null = null;
    if (Math.abs(slope) < 0.001) {
      trend = 'stable';
    } else if (slope > 0) {
      trend = 'improving';
    } else {
      trend = 'declining';
    }

    // Count significant changes (NDVI change > 0.15 from previous)
    let significantChanges = 0;
    for (let i = 1; i < ndviValues.length; i++) {
      const change = Math.abs(ndviValues[i] - ndviValues[i - 1]);
      if (change > 0.15) {
        significantChanges++;
      }
    }

    return {
      trend,
      changeRate: slope,
      avgNDVI,
      minNDVI,
      maxNDVI,
      significantChanges,
    };
  }

  /**
   * Determine risk category based on multiple factors
   */
  private determineRiskCategory(
    healthStatus: HealthStatus | null,
    trend: 'improving' | 'stable' | 'declining' | null,
    hasDeforestation: boolean,
    significantChanges: number,
    hasHydricAlert = false,
    hasEarlyWatch = false
  ): RiskCategory {
    if (!healthStatus || !trend) {
      return RISK_CATEGORIES.UNKNOWN;
    }

    if (
      HIGH_RISK_STATUSES.includes(healthStatus) ||
      hasDeforestation ||
      hasHydricAlert ||
      (trend === 'declining' && healthStatus !== 'excellent' && healthStatus !== 'good')
    ) {
      return RISK_CATEGORIES.HIGH_RISK;
    }

    if (
      healthStatus === 'excellent' &&
      (trend === 'improving' || trend === 'stable') &&
      !hasDeforestation &&
      !hasEarlyWatch &&
      significantChanges === 0
    ) {
      return RISK_CATEGORIES.EXCELLENT;
    }

    if (
      GOOD_STATUSES.includes(healthStatus) &&
      (trend === 'improving' || trend === 'stable') &&
      !hasEarlyWatch
    ) {
      return RISK_CATEGORIES.LOW_RISK;
    }

    return RISK_CATEGORIES.MEDIUM_RISK;
  }

  private identifyRiskFactors(
    healthStatus: HealthStatus | null,
    trend: 'improving' | 'stable' | 'declining' | null,
    hasDeforestation: boolean,
    significantChanges: number,
    ndmiLevel: string = 'none',
    eviLevel: string = 'none',
    hasDualAlert = false
  ): string[] {
    const factors: string[] = [];

    if (!healthStatus || !trend) {
      factors.push('Données insuffisantes');
      return factors;
    }

    if (HIGH_RISK_STATUSES.includes(healthStatus)) {
      factors.push(`Santé ${healthStatus === 'critical' ? 'critique' : 'faible'}`);
    }

    if (trend === 'declining') {
      factors.push('Tendance en déclin');
    }

    if (hasDeforestation) {
      factors.push('Alertes de déforestation');
    }

    if (hasDualAlert) {
      factors.push('Double signal EVI + NDMI');
    } else if (ndmiLevel === 'alert') {
      factors.push('Stress hydrique (NDMI)');
    } else if (ndmiLevel === 'watch') {
      factors.push('Surveillance hydrique (NDMI)');
    }

    if (!hasDualAlert && eviLevel === 'alert') {
      factors.push('Stress canopée (EVI)');
    } else if (!hasDualAlert && eviLevel === 'watch') {
      factors.push('Surveillance canopée (EVI)');
    }

    if (significantChanges > 0) {
      factors.push(`${significantChanges} changement(s) significatif(s)`);
    }

    if (factors.length === 0) {
      factors.push('Aucun facteur de risque identifié');
    }

    return factors;
  }

  private generateRecommendations(
    riskCategory: RiskCategory,
    healthStatus: HealthStatus | null,
    trend: 'improving' | 'stable' | 'declining' | null,
    hasDeforestation: boolean,
    hasHydricAlert = false
  ): string[] {
    const recommendations: string[] = [];

    switch (riskCategory) {
      case RISK_CATEGORIES.HIGH_RISK:
        recommendations.push('Visite terrain urgente requise');
        if (healthStatus === 'critical') {
          recommendations.push('Intervention immédiate pour défoliation sévère');
        }
        if (hasDeforestation) {
          recommendations.push('Vérifier conformité EUDR');
        }
        if (hasHydricAlert) {
          recommendations.push('Vérifier irrigation et disponibilité en eau (NDMI)');
        }
        if (trend === 'declining') {
          recommendations.push('Analyser causes du déclin (stress hydrique, maladies)');
        }
        break;

      case RISK_CATEGORIES.MEDIUM_RISK:
        recommendations.push('Surveillance accrue recommandée');
        if (trend === 'declining') {
          recommendations.push('Planifier visite terrain sous 2 semaines');
        }
        if (hasHydricAlert) {
          recommendations.push('Surveiller le stress hydrique (NDMI)');
        }
        recommendations.push('Vérifier irrigation et nutrition');
        break;

      case RISK_CATEGORIES.LOW_RISK:
        recommendations.push('Maintenir pratiques culturales actuelles');
        recommendations.push('Surveillance mensuelle standard');
        break;

      case RISK_CATEGORIES.EXCELLENT:
        recommendations.push('Excellente performance, continuer');
        recommendations.push('Partager bonnes pratiques avec autres planteurs');
        break;

      case RISK_CATEGORIES.UNKNOWN:
        recommendations.push('Collecter données NDVI pour évaluation');
        break;
    }

    return recommendations;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const riskAssessmentService = new RiskAssessmentService();
