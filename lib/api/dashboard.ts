// CocoaTrack V2 - Dashboard API
// Client-side API functions for dashboard operations
// Requirements: 6.1, 6.5, 6.8

import { createClient } from '@/lib/supabase/client';
import {
  deriveReceiptInvoiceStatus,
  extractLinkedDeliveries,
} from '@/lib/utils/receipt-invoice-status';

// Type definition for the RPC function (until types are regenerated)
type GetDashboardMetricsAllParams = {
  p_cooperative_id?: string | null;
  p_date_from?: string | null;
  p_date_to?: string | null;
};

type GetDashboardMetricsAllResult = {
  total_deliveries: number;
  total_weight_kg: number;
  total_amount_xaf: number;
};

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
    deliveriesIsNewActivity?: boolean;
    weightIsNewActivity?: boolean;
    amountIsNewActivity?: boolean;
    priceIsNewActivity?: boolean;
    contextLabel: string;
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
  village?: string | null;
  lastDeliveryAt?: string | null;
  validationStatus?: 'pending' | 'validated' | 'rejected' | null;
}

export interface DashboardData {
  metrics: DashboardMetricsWithComparison;
  dailyTrend: TimeSeriesPoint[];
  topPlanteurs: TopPerformer[];
  topChefPlanteurs: TopPerformer[];
}

export interface ESGMetrics {
  totalParcelles: number;
  conformesParcelles: number;
  conformitePct: number;
  parcellesARisque: number;
  risquePct: number;
  pendingDeforestationEvents: number;
  verifiedChefPlanteurs: number;
  verificationPct: number;
  traceableDeliveries: number;
  traceabilityPct: number;
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

type DeliveryMetricRow = {
  weight_kg: number;
  total_amount: number;
};

type DeliveryTrendRow = {
  delivered_at: string;
  weight_kg: number;
  total_amount: number;
};

type DeliveryPlanteurRow = {
  planteur_id: string;
  delivered_at: string;
  weight_kg: number;
  total_amount: number;
};

type DeliveryChefRow = {
  chef_planteur_id: string | null;
  planteur_id: string;
  delivered_at: string;
  weight_kg: number;
  total_amount: number;
};

type PlanteurLookupRow = {
  id: string;
  name: string;
  code: string;
  localite: string | null;
};

type ChefLookupRow = {
  id: string;
  name: string;
  code: string;
  validation_status: 'pending' | 'validated' | 'rejected' | null;
};

type PlanteurChefRow = {
  id: string;
  chef_planteur_id: string | null;
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return Math.round(((current - previous) / previous) * 100 * 10) / 10;
}

function isNewActivity(current: number, previous: number): boolean {
  return previous === 0 && current > 0;
}

function getDateRange(
  period: 'all' | 'today' | 'week' | 'month' | 'year' | 'last_year' | 'custom',
  customFrom?: string,
  customTo?: string
) {
  const now = new Date();
  let from: Date;
  let to: Date = now;

  switch (period) {
    case 'all':
      // No date filter, return a very early date to cover everything
      from = new Date('2000-01-01');
      break;
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
    case 'last_year':
      from = new Date(now.getFullYear() - 1, 0, 1);
      to = new Date(now.getFullYear() - 1, 11, 31);
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

export type DashboardPeriod = 'all' | 'today' | 'week' | 'month' | 'year' | 'custom';

export function buildDashboardFilters(
  period: DashboardPeriod,
  base: DashboardFilters = {},
  customFrom?: string,
  customTo?: string
): DashboardFilters {
  if (period === 'all') {
    return base;
  }
  const { from, to } = getDateRange(
    period === 'custom' ? 'custom' : period,
    customFrom,
    customTo
  );
  return { ...base, dateFrom: from, dateTo: to };
}

function aggregateDeliveriesByDate(rows: DeliveryTrendRow[]): TimeSeriesPoint[] {
  const dateMap = new Map<string, TimeSeriesPoint>();

  for (const row of rows) {
    const date = row.delivered_at.split('T')[0];
    const existing = dateMap.get(date);

    if (existing) {
      existing.deliveries += 1;
      existing.weightKg += Number(row.weight_kg);
      existing.amountXAF += Number(row.total_amount);
    } else {
      dateMap.set(date, {
        date,
        deliveries: 1,
        weightKg: Number(row.weight_kg),
        amountXAF: Number(row.total_amount),
      });
    }
  }

  return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

async function getMetricsFromDeliveries(filters: DashboardFilters = {}): Promise<DashboardMetrics> {
  const supabase = createClient();
  const { cooperativeId, dateFrom, dateTo } = filters;

  let query = supabase
    .from('deliveries')
    .select('weight_kg, total_amount');

  if (cooperativeId) {
    query = query.eq('cooperative_id', cooperativeId);
  }
  if (dateFrom) {
    query = query.gte('delivered_at', `${dateFrom}T00:00:00`);
  }
  if (dateTo) {
    query = query.lte('delivered_at', `${dateTo}T23:59:59`);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch dashboard metrics: ${error.message}`);
  }

  const rows = (data || []) as DeliveryMetricRow[];
  const totalWeightKg = rows.reduce((sum, row) => sum + Number(row.weight_kg), 0);
  const totalAmountXAF = rows.reduce((sum, row) => sum + Number(row.total_amount), 0);

  return {
    totalDeliveries: rows.length,
    totalWeightKg: Math.round(totalWeightKg * 100) / 100,
    totalAmountXAF,
    averagePricePerKg:
      totalWeightKg > 0 ? Math.round((totalAmountXAF / totalWeightKg) * 100) / 100 : 0,
  };
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

async function getMetrics(filters: DashboardFilters = {}): Promise<DashboardMetrics> {
  const supabase = createClient();
  const { cooperativeId, dateFrom, dateTo } = filters;

  // Use RPC function to get metrics including NULL cooperative deliveries
  const params: GetDashboardMetricsAllParams = {
    p_cooperative_id: cooperativeId || null,
    p_date_from: dateFrom || null,
    p_date_to: dateTo || null,
  };

  const { data, error } = await supabase.rpc('get_dashboard_metrics_all', params as any);

  if (error) {
    return getMetricsFromDeliveries(filters);
  }

  const result: GetDashboardMetricsAllResult = (data as any)?.[0] || { 
    total_deliveries: 0, 
    total_weight_kg: 0, 
    total_amount_xaf: 0 
  };

  return {
    totalDeliveries: Number(result.total_deliveries),
    totalWeightKg: Math.round(Number(result.total_weight_kg) * 100) / 100,
    totalAmountXAF: Number(result.total_amount_xaf),
    averagePricePerKg:
      Number(result.total_weight_kg) > 0
        ? Math.round((Number(result.total_amount_xaf) / Number(result.total_weight_kg)) * 100) / 100
        : 0,
  };
}

async function getMetricsWithComparison(
  period: 'all' | 'today' | 'week' | 'month' | 'year' | 'last_year' | 'custom' = 'all',
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
      deliveriesIsNewActivity: isNewActivity(
        currentMetrics.totalDeliveries,
        previousMetrics.totalDeliveries
      ),
      weightIsNewActivity: isNewActivity(
        currentMetrics.totalWeightKg,
        previousMetrics.totalWeightKg
      ),
      amountIsNewActivity: isNewActivity(
        currentMetrics.totalAmountXAF,
        previousMetrics.totalAmountXAF
      ),
      priceIsNewActivity: isNewActivity(
        currentMetrics.averagePricePerKg,
        previousMetrics.averagePricePerKg
      ),
      contextLabel: 'vs période précédente',
    },
  };
}

async function getDailyTrend(filters: DashboardFilters = {}): Promise<TimeSeriesPoint[]> {
  const supabase = createClient();
  const { cooperativeId, dateFrom, dateTo } = filters;

  // Aggregate directly from deliveries (includes NULL cooperative_id rows)
  let query = supabase
    .from('deliveries')
    .select('delivered_at, weight_kg, total_amount')
    .order('delivered_at', { ascending: true });

  if (cooperativeId) {
    query = query.eq('cooperative_id', cooperativeId);
  }
  if (dateFrom) {
    query = query.gte('delivered_at', `${dateFrom}T00:00:00`);
  }
  if (dateTo) {
    query = query.lte('delivered_at', `${dateTo}T23:59:59`);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch daily trend: ${error.message}`);
  }

  return aggregateDeliveriesByDate((data || []) as DeliveryTrendRow[]);
}

async function getTopPlanteurs(
  filters: DashboardFilters = {},
  limit: number = 10
): Promise<TopPerformer[]> {
  const supabase = createClient();
  const { cooperativeId, dateFrom, dateTo } = filters;

  let query = supabase
    .from('deliveries')
    .select('planteur_id, delivered_at, weight_kg, total_amount');

  if (cooperativeId) {
    query = query.eq('cooperative_id', cooperativeId);
  }
  if (dateFrom) {
    query = query.gte('delivered_at', `${dateFrom}T00:00:00`);
  }
  if (dateTo) {
    query = query.lte('delivered_at', `${dateTo}T23:59:59`);
  }

  const { data: deliveries, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch top planteurs: ${error.message}`);
  }

  const deliveryRows = (deliveries || []) as DeliveryPlanteurRow[];

  const planteurIds = [
    ...new Set(deliveryRows.map((row) => row.planteur_id).filter(Boolean)),
  ];

  if (planteurIds.length === 0) {
    return [];
  }

  const { data: planteurs, error: planteursError } = await supabase
    .from('planteurs')
    .select('id, name, code, localite')
    .in('id', planteurIds);

  if (planteursError) {
    throw new Error(`Failed to fetch planteurs for ranking: ${planteursError.message}`);
  }

  const planteurLookup = new Map(
    ((planteurs || []) as PlanteurLookupRow[]).map((p) => [p.id, p])
  );
  const planteurMap = new Map<string, TopPerformer>();

  for (const row of deliveryRows) {
    const planteur = planteurLookup.get(row.planteur_id);
    if (!planteur) continue;

    const existing = planteurMap.get(planteur.id);
    if (existing) {
      existing.totalDeliveries += 1;
      existing.totalWeightKg += Number(row.weight_kg);
      existing.totalAmountXAF += Number(row.total_amount);
      if (!existing.lastDeliveryAt || new Date(row.delivered_at) > new Date(existing.lastDeliveryAt)) {
        existing.lastDeliveryAt = row.delivered_at;
      }
    } else {
      planteurMap.set(planteur.id, {
        id: planteur.id,
        name: planteur.name,
        code: planteur.code,
        totalDeliveries: 1,
        totalWeightKg: Number(row.weight_kg),
        totalAmountXAF: Number(row.total_amount),
        village: planteur.localite ?? null,
        lastDeliveryAt: row.delivered_at,
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
    .select('chef_planteur_id, planteur_id, delivered_at, weight_kg, total_amount');

  if (cooperativeId) {
    query = query.eq('cooperative_id', cooperativeId);
  }
  if (dateFrom) {
    query = query.gte('delivered_at', `${dateFrom}T00:00:00`);
  }
  if (dateTo) {
    query = query.lte('delivered_at', `${dateTo}T23:59:59`);
  }

  const { data: deliveries, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch top chef planteurs: ${error.message}`);
  }

  const deliveryRows = (deliveries || []) as DeliveryChefRow[];

  const planteurIdsNeedingChef = [
    ...new Set(
      deliveryRows
        .filter((row) => !row.chef_planteur_id && row.planteur_id)
        .map((row) => row.planteur_id)
    ),
  ];

  const planteurChefMap = new Map<string, string>();
  if (planteurIdsNeedingChef.length > 0) {
    const { data: planteurs } = await supabase
      .from('planteurs')
      .select('id, chef_planteur_id')
      .in('id', planteurIdsNeedingChef);

    for (const planteur of (planteurs || []) as PlanteurChefRow[]) {
      if (planteur.chef_planteur_id) {
        planteurChefMap.set(planteur.id, planteur.chef_planteur_id);
      }
    }
  }

  const chefIds = [
    ...new Set(
      deliveryRows
        .map((row) => row.chef_planteur_id || planteurChefMap.get(row.planteur_id))
        .filter((id): id is string => Boolean(id))
    ),
  ];

  if (chefIds.length === 0) {
    return [];
  }

  const { data: chefs, error: chefsError } = await supabase
    .from('chef_planteurs')
    .select('id, name, code, validation_status')
    .in('id', chefIds);

  if (chefsError) {
    throw new Error(`Failed to fetch chef planteurs for ranking: ${chefsError.message}`);
  }

  const chefLookup = new Map(((chefs || []) as ChefLookupRow[]).map((chef) => [chef.id, chef]));
  const chefMap = new Map<string, TopPerformer>();

  for (const row of deliveryRows) {
    const chefId = row.chef_planteur_id || planteurChefMap.get(row.planteur_id);
    if (!chefId) continue;

    const chef = chefLookup.get(chefId);
    if (!chef) continue;

    const existing = chefMap.get(chef.id);
    if (existing) {
      existing.totalDeliveries += 1;
      existing.totalWeightKg += Number(row.weight_kg);
      existing.totalAmountXAF += Number(row.total_amount);
      if (!existing.lastDeliveryAt || new Date(row.delivered_at) > new Date(existing.lastDeliveryAt)) {
        existing.lastDeliveryAt = row.delivered_at;
      }
    } else {
      chefMap.set(chef.id, {
        id: chef.id,
        name: chef.name,
        code: chef.code,
        totalDeliveries: 1,
        totalWeightKg: Number(row.weight_kg),
        totalAmountXAF: Number(row.total_amount),
        validationStatus: chef.validation_status ?? null,
        lastDeliveryAt: row.delivered_at,
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
  period: 'all' | 'today' | 'week' | 'month' | 'year' | 'custom' = 'all',
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
  totalParcelles: number;
  derniereLivraisonAujourdhui?: string | null;
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

  // Count total parcelles (active, non-archived)
  // Note: parcelles don't have cooperative_id directly, they link via planteur
  let parcellesCount = 0;
  
  if (cooperativeId) {
    // Use a different approach: query planteurs first to get their IDs
    const { data: planteurIds } = await supabase
      .from('planteurs')
      .select('id')
      .eq('cooperative_id', cooperativeId);
    
    if (planteurIds && planteurIds.length > 0) {
      const { count } = await supabase
        .from('parcelles')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true)
        .in('planteur_id', planteurIds.map((p: any) => p.id));
      parcellesCount = count || 0;
    }
  } else {
    // No cooperative filter, count all active parcelles
    const { count } = await supabase
      .from('parcelles')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);
    parcellesCount = count || 0;
  }

  // Get today's deliveries using RPC (includes NULL cooperative deliveries)
  const params: GetDashboardMetricsAllParams = {
    p_cooperative_id: cooperativeId || null,
    p_date_from: today,
    p_date_to: today,
  };
  
  const todayMetricsQuery = supabase.rpc('get_dashboard_metrics_all', params as any);
  let latestDeliveryTodayQuery = supabase
    .from('deliveries')
    .select('delivered_at')
    .gte('delivered_at', `${today}T00:00:00`)
    .lte('delivered_at', `${today}T23:59:59`)
    .order('delivered_at', { ascending: false })
    .limit(1);

  if (cooperativeId) {
    latestDeliveryTodayQuery = latestDeliveryTodayQuery.eq('cooperative_id', cooperativeId);
  }

  const [planteursResult, chefsResult, pendingResult, todayResult, latestDeliveryTodayResult] = await Promise.all([
    planteursQuery,
    chefPlanteursQuery,
    pendingChefsQuery,
    todayMetricsQuery,
    latestDeliveryTodayQuery,
  ]);

  const todayData: GetDashboardMetricsAllResult = (todayResult.data as any)?.[0] || { 
    total_deliveries: 0, 
    total_weight_kg: 0,
    total_amount_xaf: 0
  };

  return {
    planteursActifs: planteursResult.count || 0,
    chefPlanteursActifs: chefsResult.count || 0,
    chefPlanteursEnAttente: pendingResult.count || 0,
    livraisonsAujourdhui: Number(todayData.total_deliveries),
    poidsAujourdhui: Math.round(Number(todayData.total_weight_kg) * 100) / 100,
    totalParcelles: parcellesCount,
    derniereLivraisonAujourdhui:
      (latestDeliveryTodayResult.data?.[0] as { delivered_at: string } | undefined)?.delivered_at ?? null,
  };
}

async function getESGMetrics(filters: DashboardFilters = {}): Promise<ESGMetrics> {
  const supabase = createClient();
  const { cooperativeId, dateFrom, dateTo } = filters;

  let deliveriesTraceabilityQuery = supabase
    .from('deliveries')
    .select('id, planteur_id, chef_planteur_id, delivered_at');

  if (cooperativeId) {
    deliveriesTraceabilityQuery = deliveriesTraceabilityQuery.eq('cooperative_id', cooperativeId);
  }
  if (dateFrom) {
    deliveriesTraceabilityQuery = deliveriesTraceabilityQuery.gte('delivered_at', dateFrom);
  }
  if (dateTo) {
    deliveriesTraceabilityQuery = deliveriesTraceabilityQuery.lte('delivered_at', dateTo);
  }

  let chefPlanteursQuery = supabase
    .from('chef_planteurs')
    .select('id, validation_status');
  if (cooperativeId) {
    chefPlanteursQuery = chefPlanteursQuery.eq('cooperative_id', cooperativeId);
  }

  const deforestationQuery = supabase
    .from('deforestation_events')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  // Parcelles are filtered by cooperative through planteurs relationship
  let parcellesRows: Array<{ conformity_status: string | null; risk_flags: unknown }> = [];
  if (cooperativeId) {
    const { data: planteurIds } = await supabase
      .from('planteurs')
      .select('id')
      .eq('cooperative_id', cooperativeId);

    const ids = (planteurIds || []).map((p: { id: string }) => p.id);
    if (ids.length > 0) {
      const { data: parcellesData } = await (supabase as any)
        .from('parcelles')
        .select('conformity_status, risk_flags')
        .eq('is_active', true)
        .in('planteur_id', ids);
      parcellesRows = (parcellesData || []) as Array<{ conformity_status: string | null; risk_flags: unknown }>;
    }
  } else {
    const { data: parcellesData } = await (supabase as any)
      .from('parcelles')
      .select('conformity_status, risk_flags')
      .eq('is_active', true);
    parcellesRows = (parcellesData || []) as Array<{ conformity_status: string | null; risk_flags: unknown }>;
  }

  const [deliveriesResult, chefsResult, deforestationResult] = await Promise.all([
    deliveriesTraceabilityQuery,
    chefPlanteursQuery,
    deforestationQuery,
  ]);

  const deliveriesRows = (deliveriesResult.data || []) as Array<{
    id: string;
    planteur_id: string | null;
    chef_planteur_id: string | null;
  }>;
  const totalDeliveries = deliveriesRows.length;
  const traceableDeliveries = deliveriesRows.filter((d) => d.planteur_id && d.chef_planteur_id).length;

  const chefsRows = (chefsResult.data || []) as Array<{ validation_status: 'pending' | 'validated' | 'rejected' }>;
  const totalChefs = chefsRows.length;
  const verifiedChefs = chefsRows.filter((c) => c.validation_status === 'validated').length;

  const totalParcelles = parcellesRows.length;
  const conformesParcelles = parcellesRows.filter((p) => p.conformity_status === 'conforme').length;
  const parcellesARisque = parcellesRows.filter((p) => {
    if (!p.risk_flags || typeof p.risk_flags !== 'object') return false;
    const flags = p.risk_flags as Record<string, unknown>;
    const deforestation = flags.deforestation as { flag?: boolean } | undefined;
    const zoneProtegee = flags.zone_protegee as { flag?: boolean } | undefined;
    const overlap = flags.overlap as { flag?: boolean } | undefined;
    return Boolean(deforestation?.flag || zoneProtegee?.flag || overlap?.flag);
  }).length;

  const conformitePct = totalParcelles > 0 ? Math.round((conformesParcelles / totalParcelles) * 1000) / 10 : 0;
  const risquePct = totalParcelles > 0 ? Math.round((parcellesARisque / totalParcelles) * 1000) / 10 : 0;
  const verificationPct = totalChefs > 0 ? Math.round((verifiedChefs / totalChefs) * 1000) / 10 : 0;
  const traceabilityPct = totalDeliveries > 0 ? Math.round((traceableDeliveries / totalDeliveries) * 1000) / 10 : 0;

  return {
    totalParcelles,
    conformesParcelles,
    conformitePct,
    parcellesARisque,
    risquePct,
    pendingDeforestationEvents: deforestationResult.count || 0,
    verifiedChefPlanteurs: verifiedChefs,
    verificationPct,
    traceableDeliveries,
    traceabilityPct,
  };
}

export interface UninvoicedReceiptsCount {
  total: number;
  notInvoiced: number;
  partiallyInvoiced: number;
}

export interface ReceiptPipelineStats {
  totalReceipts: number;
  uninvoicedDeliveries: number;
  fullyInvoicedReceipts: number;
  invoicedPct: number;
}

type ReceiptPipelineRow = {
  id: string;
  cooperative_id: string | null;
  receipt_deliveries: Array<{
    delivery: {
      invoice_status: string | null;
    } | null;
  }>;
};

async function fetchReceiptPipelineRows(cooperativeId?: string): Promise<ReceiptPipelineRow[]> {
  const supabase = createClient();

  let query = supabase
    .from('collection_receipts')
    .select(`
      id,
      cooperative_id,
      receipt_deliveries(
        delivery:deliveries!receipt_deliveries_delivery_id_fkey(invoice_status)
      )
    `);

  if (cooperativeId) {
    query = query.eq('cooperative_id', cooperativeId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch receipt pipeline stats: ${error.message}`);
  }

  return (data || []) as unknown as ReceiptPipelineRow[];
}

async function getUninvoicedReceiptsCount(
  cooperativeId?: string
): Promise<UninvoicedReceiptsCount> {
  const rows = await fetchReceiptPipelineRows(cooperativeId);

  let notInvoiced = 0;
  let partiallyInvoiced = 0;

  for (const row of rows) {
    const deliveries = extractLinkedDeliveries(row.receipt_deliveries);
    const status = deriveReceiptInvoiceStatus(deliveries);
    if (status === 'not_invoiced') notInvoiced += 1;
    if (status === 'partially_invoiced') partiallyInvoiced += 1;
  }

  return {
    total: notInvoiced + partiallyInvoiced,
    notInvoiced,
    partiallyInvoiced,
  };
}

async function getReceiptPipelineStats(
  cooperativeId?: string
): Promise<ReceiptPipelineStats> {
  const rows = await fetchReceiptPipelineRows(cooperativeId);

  let fullyInvoicedReceipts = 0;
  let uninvoicedDeliveries = 0;

  for (const row of rows) {
    const deliveries = extractLinkedDeliveries(row.receipt_deliveries);
    const status = deriveReceiptInvoiceStatus(deliveries);
    if (status === 'invoiced') fullyInvoicedReceipts += 1;
    uninvoicedDeliveries += deliveries.filter((d) => d.invoice_status !== 'invoiced').length;
  }

  const totalReceipts = rows.length;
  const invoicedPct =
    totalReceipts > 0
      ? Math.round((fullyInvoicedReceipts / totalReceipts) * 1000) / 10
      : 0;

  return {
    totalReceipts,
    uninvoicedDeliveries,
    fullyInvoicedReceipts,
    invoicedPct,
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
  getESGMetrics,
  getUninvoicedReceiptsCount,
  getReceiptPipelineStats,
  buildDashboardFilters,
};
