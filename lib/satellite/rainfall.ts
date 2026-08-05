/**
 * Rainfall context for hydric alerts (CHIRPS via Google Earth Engine).
 *
 * Sum of daily precip over the last N days at the parcelle centroid.
 * Falls back to season-only context if GEE/CHIRPS unavailable.
 */

import { getEE, evaluateEE } from './utils/gee-sdk';
import { getCocoaSeasonContext, type SeasonContext } from './seasonality';

export type RainBand = 'dry' | 'normal' | 'wet' | 'unknown';

export interface RainfallContext {
  source: 'chirps' | 'season_only';
  days: number;
  precipMm: number | null;
  band: RainBand;
  labelFr: string;
  hintFr: string;
  season: SeasonContext;
  /** How rainfall modulates NDMI alert reading */
  ndmiInterpretationFr: string;
}

/** Rough cocoa-region 30-day totals (mm) — refine with local climatology */
export const RAIN_30D_DRY_MAX_MM = 40;
export const RAIN_30D_WET_MIN_MM = 120;

export function classifyRainBand(precipMm: number | null): RainBand {
  if (precipMm == null || !Number.isFinite(precipMm)) return 'unknown';
  if (precipMm < RAIN_30D_DRY_MAX_MM) return 'dry';
  if (precipMm >= RAIN_30D_WET_MIN_MM) return 'wet';
  return 'normal';
}

export function buildRainfallContext(
  precipMm: number | null,
  source: 'chirps' | 'season_only',
  days = 30,
  asOf: Date = new Date()
): RainfallContext {
  const season = getCocoaSeasonContext(asOf);
  const band = source === 'chirps' ? classifyRainBand(precipMm) : 'unknown';

  if (source === 'season_only' || band === 'unknown') {
    return {
      source: 'season_only',
      days,
      precipMm: null,
      band: 'unknown',
      labelFr: `Contexte saisonnier — ${season.labelFr}`,
      hintFr: season.hintFr,
      season,
      ndmiInterpretationFr:
        season.season === 'dry'
          ? 'Saison sèche : une baisse NDMI est plus fréquente — croiser avec le terrain.'
          : season.season === 'rainy'
            ? 'Saison des pluies : une baisse NDMI est plus préoccupante malgré les pluies attendues.'
            : 'Transition : interpréter le NDMI avec prudence.',
    };
  }

  const labelFr =
    band === 'dry'
      ? `Pluie faible (${precipMm!.toFixed(0)} mm / ${days} j)`
      : band === 'wet'
        ? `Pluie abondante (${precipMm!.toFixed(0)} mm / ${days} j)`
        : `Pluie normale (${precipMm!.toFixed(0)} mm / ${days} j)`;

  const ndmiInterpretationFr =
    band === 'dry'
      ? 'Peu de pluie récente : la baisse NDMI est cohérente avec un stress hydrique.'
      : band === 'wet'
        ? 'Pluie récente : si le NDMI baisse quand même, vérifier drainage, racines ou maladie.'
        : 'Pluie dans la normale : le signal NDMI reste un bon indicateur hydrique.';

  return {
    source: 'chirps',
    days,
    precipMm,
    band,
    labelFr,
    hintFr: `CHIRPS · somme ${days} jours (Sentinel/GEE).`,
    season,
    ndmiInterpretationFr,
  };
}

/**
 * Fetch CHIRPS 30-day precipitation sum at lon/lat (degrees).
 */
export async function fetchChirpsPrecipMm(
  lon: number,
  lat: number,
  days = 30,
  asOf: Date = new Date()
): Promise<number | null> {
  try {
    const ee = await getEE();
    const end = ee.Date(asOf.toISOString().slice(0, 10));
    const start = end.advance(-days, 'day');
    const point = ee.Geometry.Point([lon, lat]);

    const chirps = ee
      .ImageCollection('UCSB-CHG/CHIRPS/DAILY')
      .filterDate(start, end)
      .filterBounds(point)
      .select('precipitation');

    const sum = chirps.sum();
    const result = await evaluateEE<{ precipitation?: number }>(
      sum.reduceRegion({
        reducer: ee.Reducer.mean(),
        geometry: point,
        scale: 5566, // ~0.05° CHIRPS
        maxPixels: 1e7,
      })
    );

    const v = result?.precipitation;
    return v != null && Number.isFinite(Number(v)) ? Number(v) : null;
  } catch (err) {
    console.warn('[CHIRPS] fetch failed, falling back to season:', err);
    return null;
  }
}

/**
 * Rainfall context for a point; never throws.
 */
export async function getRainfallContextForPoint(
  lon: number | null | undefined,
  lat: number | null | undefined,
  days = 30,
  asOf: Date = new Date()
): Promise<RainfallContext> {
  if (lon == null || lat == null || !Number.isFinite(lon) || !Number.isFinite(lat)) {
    return buildRainfallContext(null, 'season_only', days, asOf);
  }

  const precip = await fetchChirpsPrecipMm(lon, lat, days, asOf);
  if (precip == null) {
    return buildRainfallContext(null, 'season_only', days, asOf);
  }
  return buildRainfallContext(precip, 'chirps', days, asOf);
}
