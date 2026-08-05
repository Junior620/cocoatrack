/**
 * Cocoa seasonality (West / Central Africa — Cameroon, Côte d’Ivoire).
 *
 * Approximate calendar (no CHIRPS yet):
 * - Dry: Nov–Mar — NDMI drops are more common → raise drop thresholds
 * - Rainy: Apr–Oct — same drop is more concerning → lower thresholds
 * - Transition months (Apr, Nov) use midpoint multipliers
 */

export type CocoaSeason = 'dry' | 'rainy' | 'transition';

export interface SeasonContext {
  season: CocoaSeason;
  month: number; // 1–12
  labelFr: string;
  /** Multiplier applied to NDMI drop watch/alert thresholds (>1 = less sensitive) */
  ndmiDropThresholdMultiplier: number;
  /** Short hint for UI messages */
  hintFr: string;
}

/**
 * Map calendar month (1–12) to cocoa season.
 */
export function getCocoaSeason(month: number): CocoaSeason {
  if (month >= 11 || month <= 3) return 'dry';
  if (month === 4 || month === 10) return 'transition';
  return 'rainy';
}

/**
 * Season context for a date (defaults to today).
 */
export function getCocoaSeasonContext(date: Date = new Date()): SeasonContext {
  const month = date.getUTCMonth() + 1;
  const season = getCocoaSeason(month);

  if (season === 'dry') {
    return {
      season,
      month,
      labelFr: 'Saison sèche',
      ndmiDropThresholdMultiplier: 1.35,
      hintFr:
        'En saison sèche, une baisse de NDMI est plus fréquente — seuils d’alerte relevés.',
    };
  }

  if (season === 'transition') {
    return {
      season,
      month,
      labelFr: 'Transition saisonnière',
      ndmiDropThresholdMultiplier: 1.0,
      hintFr: 'Période de transition — seuils NDMI standards.',
    };
  }

  return {
    season,
    month,
    labelFr: 'Saison des pluies',
    ndmiDropThresholdMultiplier: 0.85,
    hintFr:
      'En saison des pluies, une baisse de NDMI est plus préoccupante — seuils plus sensibles.',
  };
}
