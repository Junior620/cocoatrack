// CocoaTrack V2 - Dashboard API
// Client-side API functions for dashboard operations
// Requirements: 6.1, 6.5, 6.8

import { createClient } from '@/lib/supabase/client';

// ============================================================================
// TYPES
// ============================================================================

export interface DashboardMetrics {
  totalDeliveries: number;
  totalWeightKg: number;
  totalAmountXAF: number;
  averagePricePerKg: number;
}

export interface DashboardMetricsWithComparison extends DashboardMetrics {
  periodComparison: {
    deliveriesChange: number;
    weightChange: number;
    amountChange: number;
    priceChange: number;
  };
}

export interface DashboardFilters {
  cooperativeId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface TimeSeriesPoint {
  date: string;
  deliveries: number;
  weightKg: number;
  amountXAF: number;
}

export interface TopPerformer {
  id: string;
  name: string;
  code: string;
  totalDeliveries: number;
  totalWeightKg: number;
  totalAmountXAF: number;
}

export interface DashboardData {
  metrics: DashboardMetricsWithComparison;
  dailyTrend: TimeSeriesPoint[];
  topPlanteurs: TopPerformer[];
  topChefPlanteurs: TopPerformer[];
}

export interface DeliveryLocation {
  id: string;
  coordinates: [number, number];
  weight: number;
  amount: number;
  planteurName?: string;
  chefPlanteurName?: string;
  date?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return Math.round(((current - previous) / previous) * 100 * 10) / 10;
}

function getDateRange(
  period: 'today' | 'week' | 'month' | 'year' | 'custom',
  customFrom?: string,
  customTo?: string
) {
  const now = new Date();
  let from: Date;
  let to: Date = now;

  switch (period) {
    case 'today':
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      from = new Date(now);
      from.setDate(now.getDate() - 7);
      break;
    case 'month':
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'year':
      from = new Date(now.getFullYear(), 0, 1);
      break;
    case 'custom':
      from = customFrom ? new Date(customFrom) : new Date(now.getFullYear(), now.getMonth(), 1);
      to = customTo ? new Date(customTo) : now;
      break;
    default:
      from = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  };
}

function getPreviousPeriodRange(from: string, to: string) {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  const duration = toDate.getTime() - fromDate.getTime();

  const prevTo = new Date(fromDate.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - duration);

  return {
    from: prevFrom.toISOString().split('T')[0],
    to: prevTo.toISOString().split('T')[0],
  };
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

async function getMetrics(filters: DashboardFilters = {}): Promise<DashboardMetrics> {
  const supabase = createClient();
  const { cooperativeId, dateFrom, dateTo } = filters;

  let query = supabase
    .from('dashboard_aggregates')
    .select('total_deliveries, total_weight_kg, total_amount_xaf');

  if (cooperativeId) {
    query = query.eq('cooperative_id', cooperativeId);
  }
  if (dateFrom) {
    query = query.gte('period_date', dateFrom);
  }
  if (dateTo) {
    query = query.lte('period_date', dateTo);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch dashboard metrics: ${error.message}`);
  }

  const aggregated = (data || []).reduce(
    (acc, row) => {
      const r = row as { total_deliveries: number; total_weight_kg: number; total_amount_xaf: number };
      acc.totalDeliveries += r.total_deliveries;
      acc.totalWeightKg += Number(r.total_weight_kg);
      acc.totalAmountXAF += Number(r.total_amount_xaf);
      return acc;
    },
    { totalDeliveries: 0, totalWeightKg: 0, totalAmountXAF: 0 }
  );

  return {
    totalDeliveries: aggregated.totalDeliveries,
    totalWeightKg: Math.round(aggregated.totalWeightKg * 100) / 100,
    totalAmountXAF: aggregated.totalAmountXAF,
    averagePricePerKg:
      aggregated.totalWeightKg > 0
        ? Math.round((aggregated.totalAmountXAF / aggregated.totalWeightKg) * 100) / 100
        : 0,
  };
}

async function getMetricsWithComparison(
  period: 'today' | 'week' | 'month' | 'year' | 'custom' = 'month',
  filters: DashboardFilters = {}
): Promise<DashboardMetricsWithComparison> {
  const { from, to } = getDateRange(period, filters.dateFrom, filters.dateTo);
  const prevPeriod = getPreviousPeriodRange(from, to);

  const [currentMetrics, previousMetrics] = await Promise.all([
    getMetrics({ ...filters, dateFrom: from, dateTo: to }),
    getMetrics({ ...filters, dateFrom: prevPeriod.from, dateTo: prevPeriod.to }),
  ]);

  return {
    ...currentMetrics,
    periodComparison: {
      deliveriesChange: calculatePercentageChange(
        currentMetrics.totalDeliveries,
        previousMetrics.totalDeliveries
      ),
      weightChange: calculatePercentageChange(
        currentMetrics.totalWeightKg,
        previousMetrics.totalWeightKg
      ),
      amountChange: calculatePercentageChange(
        currentMetrics.totalAmountXAF,
        previousMetrics.totalAmountXAF
      ),
      priceChange: calculatePercentageChange(
        currentMetrics.averagePricePerKg,
        previousMetrics.averagePricePerKg
      ),
    },
  };
}

async function getDailyTrend(filters: DashboardFilters = {}): Promise<TimeSeriesPoint[]> {
  const supabase = createClient();
  const { cooperativeId, dateFrom, dateTo } = filters;

  let query = supabase
    .from('dashboard_aggregates')
    .select('period_date, total_deliveries, total_weight_kg, total_amount_xaf')
    .order('period_date', { ascending: true });

  if (cooperativeId) {
    query = query.eq('cooperative_id', cooperativeId);
  }
  if (dateFrom) {
    query = query.gte('period_date', dateFrom);
  }
  if (dateTo) {
    query = query.lte('period_date', dateTo);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch daily trend: ${error.message}`);
  }

  return (data || []).map((row) => {
    const r = row as { period_date: string; total_deliveries: number; total_weight_kg: number; total_amount_xaf: number };
    return {
      date: r.period_date,
      deliveries: r.total_deliveries,
      weightKg: Number(r.total_weight_kg),
      amountXAF: Number(r.total_amount_xaf),
    };
  });
}

async function getTopPlanteurs(
  filters: DashboardFilters = {},
  limit: number = 10
): Promise<TopPerformer[]> {
  const supabase = createClient();
  const { cooperativeId, dateFrom, dateTo } = filters;

  let query = supabase
    .from('deliveries')
    .select(`
      planteur_id,
      planteur:planteurs!deliveries_planteur_id_fkey(id, name, code),
      weight_kg,
      total_amount
    `);

  if (cooperativeId) {
    query = query.eq('cooperative_id', cooperativeId);
  }
  if (dateFrom) {
    query = query.gte('delivered_at', dateFrom);
  }
  if (dateTo) {
    query = query.lte('delivered_at', dateTo);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch top planteurs: ${error.message}`);
  }

  const planteurMap = new Map<string, TopPerformer>();

  for (const row of data || []) {
    const r = row as { planteur: { id: string; name: string; code: string } | null; weight_kg: number; total_amount: number };
    const planteur = r.planteur;
    if (!planteur) continue;

    const existing = planteurMap.get(planteur.id);
    if (existing) {
      existing.totalDeliveries += 1;
      existing.totalWeightKg += Number(r.weight_kg);
      existing.totalAmountXAF += Number(r.total_amount);
    } else {
      planteurMap.set(planteur.id, {
        id: planteur.id,
        name: planteur.name,
        code: planteur.code,
        totalDeliveries: 1,
        totalWeightKg: Number(r.weight_kg),
        totalAmountXAF: Number(r.total_amount),
      });
    }
  }

  return Array.from(planteurMap.values())
    .sort((a, b) => b.totalWeightKg - a.totalWeightKg)
    .slice(0, limit)
    .map((p) => ({
      ...p,
      totalWeightKg: Math.round(p.totalWeightKg * 100) / 100,
    }));
}

async function getTopChefPlanteurs(
  filters: DashboardFilters = {},
  limit: number = 10
): Promise<TopPerformer[]> {
  const supabase = createClient();
  const { cooperativeId, dateFrom, dateTo } = filters;

  let query = supabase
    .from('deliveries')
    .select(`
      chef_planteur_id,
      chef_planteur:chef_planteurs!deliveries_chef_planteur_id_fkey(id, name, code),
      weight_kg,
      total_amount
    `);

  if (cooperativeId) {
    query = query.eq('cooperative_id', cooperativeId);
  }
  if (dateFrom) {
    query = query.gte('delivered_at', dateFrom);
  }
  if (dateTo) {
    query = query.lte('delivered_at', dateTo);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch top chef planteurs: ${error.message}`);
  }

  const chefMap = new Map<string, TopPerformer>();

  for (const row of data || []) {
    const r = row as { chef_planteur: { id: string; name: string; code: string } | null; weight_kg: number; total_amount: number };
    const chef = r.chef_planteur;
    if (!chef) continue;

    const existing = chefMap.get(chef.id);
    if (existing) {
      existing.totalDeliveries += 1;
      existing.totalWeightKg += Number(r.weight_kg);
      existing.totalAmountXAF += Number(r.total_amount);
    } else {
      chefMap.set(chef.id, {
        id: chef.id,
        name: chef.name,
        code: chef.code,
        totalDeliveries: 1,
        totalWeightKg: Number(r.weight_kg),
        totalAmountXAF: Number(r.total_amount),
      });
    }
  }

  return Array.from(chefMap.values())
    .sort((a, b) => b.totalWeightKg - a.totalWeightKg)
    .slice(0, limit)
    .map((c) => ({
      ...c,
      totalWeightKg: Math.round(c.totalWeightKg * 100) / 100,
    }));
}

async function getDashboardData(
  period: 'today' | 'week' | 'month' | 'year' | 'custom' = 'month',
  filters: DashboardFilters = {}
): Promise<DashboardData> {
  const { from, to } = getDateRange(period, filters.dateFrom, filters.dateTo);
  const filtersWithDates = { ...filters, dateFrom: from, dateTo: to };

  const [metrics, dailyTrend, topPlanteurs, topChefPlanteurs] = await Promise.all([
    getMetricsWithComparison(period, filters),
    getDailyTrend(filtersWithDates),
    getTopPlanteurs(filtersWithDates),
    getTopChefPlanteurs(filtersWithDates),
  ]);

  return {
    metrics,
    dailyTrend,
    topPlanteurs,
    topChefPlanteurs,
  };
}

async function getDeliveryLocations(
  filters: DashboardFilters = {}
): Promise<DeliveryLocation[]> {
  const supabase = createClient();
  const { cooperativeId, dateFrom, dateTo } = filters;

  let query = supabase
    .from('deliveries')
    .select(`
      id,
      weight_kg,
      total_amount,
      delivered_at,
      planteur:planteurs!deliveries_planteur_id_fkey(name, latitude, longitude),
      chef_planteur:chef_planteurs!deliveries_chef_planteur_id_fkey(name)
    `);

  if (cooperativeId) {
    query = query.eq('cooperative_id', cooperativeId);
  }
  if (dateFrom) {
    query = query.gte('delivered_at', dateFrom);
  }
  if (dateTo) {
    query = query.lte('delivered_at', dateTo);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch delivery locations: ${error.message}`);
  }

  return (data || [])
    .filter((d) => {
      const row = d as { planteur: { latitude: number | null; longitude: number | null } | null };
      return row.planteur?.latitude && row.planteur?.longitude;
    })
    .map((d) => {
      const row = d as { 
        id: string; 
        weight_kg: number; 
        total_amount: number; 
        delivered_at: string;
        planteur: { name: string; latitude: number; longitude: number };
        chef_planteur: { name: string } | null;
      };
      return {
        id: row.id,
        coordinates: [row.planteur.longitude, row.planteur.latitude] as [number, number],
        weight: Number(row.weight_kg),
        amount: Number(row.total_amount),
        planteurName: row.planteur.name,
        chefPlanteurName: row.chef_planteur?.name,
        date: row.delivered_at,
      };
    });
}

// ============================================================================
// ENTITY COUNTS
// ============================================================================

export interface EntityCounts {
  planteursActifs: number;
  chefPlanteursActifs: number;
  chefPlanteursEnAttente: number;
  livraisonsAujourdhui: number;
  poidsAujourdhui: number;
}

async function getEntityCounts(cooperativeId?: string): Promise<EntityCounts> {
  const supabase = createClient();
  const today = new Date().toISOString().split('T')[0];

  // Count active planteurs
  let planteursQuery = supabase
    .from('planteurs')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);
  
  if (cooperativeId) {
    planteursQuery = planteursQuery.eq('cooperative_id', cooperativeId);
  }

  // Count active chef planteurs (validated)
  let chefPlanteursQuery = supabase
    .from('chef_planteurs')
    .select('id', { count: 'exact', head: true })
    .eq('validation_status', 'validated');
  
  if (cooperativeId) {
    chefPlanteursQuery = chefPlanteursQuery.eq('cooperative_id', cooperativeId);
  }

  // Count pending chef planteurs
  let pendingChefsQuery = supabase
    .from('chef_planteurs')
    .select('id', { count: 'exact', head: true })
    .eq('validation_status', 'pending');
  
  if (cooperativeId) {
    pendingChefsQuery = pendingChefsQuery.eq('cooperative_id', cooperativeId);
  }

  // Get today's deliveries from dashboard_aggregates
  let todayQuery = supabase
    .from('dashboard_aggregates')
    .select('total_deliveries, total_weight_kg')
    .eq('period_date', today);
  
  if (cooperativeId) {
    todayQuery = todayQuery.eq('cooperative_id', cooperativeId);
  }

  const [planteursResult, chefsResult, pendingResult, todayResult] = await Promise.all([
    planteursQuery,
    chefPlanteursQuery,
    pendingChefsQuery,
    todayQuery,
  ]);

  // Aggregate today's data
  const todayData = (todayResult.data || []).reduce(
    (acc, row) => {
      const r = row as { total_deliveries: number; total_weight_kg: number };
      acc.deliveries += r.total_deliveries;
      acc.weight += Number(r.total_weight_kg);
      return acc;
    },
    { deliveries: 0, weight: 0 }
  );

  return {
    planteursActifs: planteursResult.count || 0,
    chefPlanteursActifs: chefsResult.count || 0,
    chefPlanteursEnAttente: pendingResult.count || 0,
    livraisonsAujourdhui: todayData.deliveries,
    poidsAujourdhui: Math.round(todayData.weight * 100) / 100,
  };
}

// ============================================================================
// EXPORT API OBJECT
// ============================================================================

export const dashboardApi = {
  getMetrics,
  getMetricsWithComparison,
  getDailyTrend,
  getTopPlanteurs,
  getTopChefPlanteurs,
  getDashboardData,
  getDeliveryLocations,
  getEntityCounts,
};
