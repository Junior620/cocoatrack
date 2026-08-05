/**
 * NDMI cacao thresholds & early hydric-stress signals.
 *
 * health_status stays NDVI-based. NDMI complements EVI:
 * - EVI → canopy / photosynthetic stress under dense shade
 * - NDMI → foliar moisture / water stress (SWIR)
 *
 * V2: cacao-tuned defaults + seasonality + 2–3 month lookback.
 */

import { getCocoaSeasonContext, type SeasonContext } from './seasonality';

export type NDMIAlertLevel = 'none' | 'watch' | 'alert';

export interface NDMISeriesPoint {
  date: Date | string;
  ndvi: number;
  ndmi: number | null;
}

export interface NDMIThresholds {
  dropWatch: number;
  dropAlert: number;
  low: number;
  ndviStableEpsilon: number;
}

/**
 * Cacao-calibrated defaults (refine with 20–50 field notes).
 * Slightly earlier than V1 (low 0.05, alert drop 0.07).
 */
export const NDMI_THRESHOLDS_CACAO: NDMIThresholds = {
  dropWatch: 0.04,
  dropAlert: 0.07,
  low: 0.05,
  ndviStableEpsilon: 0.03,
};

/** @deprecated use NDMI_THRESHOLDS_CACAO.dropWatch */
export const NDMI_DROP_WATCH = NDMI_THRESHOLDS_CACAO.dropWatch;
/** @deprecated use NDMI_THRESHOLDS_CACAO.dropAlert */
export const NDMI_DROP_ALERT = NDMI_THRESHOLDS_CACAO.dropAlert;
/** @deprecated use NDMI_THRESHOLDS_CACAO.low */
export const NDMI_LOW_THRESHOLD = NDMI_THRESHOLDS_CACAO.low;
/** @deprecated use NDMI_THRESHOLDS_CACAO.ndviStableEpsilon */
export const NDVI_STABLE_EPSILON_FOR_NDMI =
  NDMI_THRESHOLDS_CACAO.ndviStableEpsilon;

export interface NDMIAlert {
  level: NDMIAlertLevel;
  code: 'ndmi_drop' | 'ndmi_early_dry' | 'ndmi_low' | 'none';
  messageFr: string;
  messageEn: string;
  ndmiChange: number | null;
  ndviChange: number | null;
  windowMonths: number;
  season?: SeasonContext['season'];
  seasonLabelFr?: string;
  thresholdsUsed?: NDMIThresholds;
}

export interface DetectNDMIOptions {
  /** Override base thresholds (before season multiplier) */
  thresholds?: NDMIThresholds;
  /** Apply cocoa season multiplier (default true) */
  applySeasonality?: boolean;
  /** Reference date for season (default: latest point) */
  asOf?: Date;
  /**
   * Prefer lookback of 2 months when available (else 1).
   * Reduces noise from a single mediocre image.
   */
  preferMultiMonth?: boolean;
}

function toDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d);
}

export function resolveNDMIThresholds(
  asOf: Date,
  base: NDMIThresholds = NDMI_THRESHOLDS_CACAO,
  applySeasonality = true
): { thresholds: NDMIThresholds; season: SeasonContext } {
  const season = getCocoaSeasonContext(asOf);
  if (!applySeasonality) {
    return { thresholds: { ...base }, season };
  }
  const m = season.ndmiDropThresholdMultiplier;
  return {
    season,
    thresholds: {
      ...base,
      dropWatch: base.dropWatch * m,
      dropAlert: base.dropAlert * m,
    },
  };
}

/**
 * Detect early hydric stress from a chronological series (oldest → newest).
 */
export function detectNDMIEarlyAlert(
  series: NDMISeriesPoint[],
  options: DetectNDMIOptions = {}
): NDMIAlert {
  const {
    thresholds: baseThresholds = NDMI_THRESHOLDS_CACAO,
    applySeasonality = true,
    preferMultiMonth = true,
  } = options;

  const withNdmi = series
    .filter((p) => p.ndmi != null && !isNaN(Number(p.ndmi)) && !isNaN(p.ndvi))
    .map((p) => ({
      date: toDate(p.date),
      ndvi: p.ndvi,
      ndmi: Number(p.ndmi),
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (withNdmi.length === 0) {
    return {
      level: 'none',
      code: 'none',
      messageFr: 'Pas encore de données NDMI.',
      messageEn: 'No NDMI data yet.',
      ndmiChange: null,
      ndviChange: null,
      windowMonths: 0,
    };
  }

  const latest = withNdmi[withNdmi.length - 1];
  const asOf = options.asOf ?? latest.date;
  const { thresholds, season } = resolveNDMIThresholds(
    asOf,
    baseThresholds,
    applySeasonality
  );

  const seasonSuffix = ` (${season.labelFr})`;

  if (withNdmi.length >= 2) {
    // Prefer 2-month lookback when we have ≥3 points
    const prevIdx =
      preferMultiMonth && withNdmi.length >= 3
        ? withNdmi.length - 3
        : withNdmi.length - 2;
    const prev = withNdmi[prevIdx];
    const ndmiChange = latest.ndmi - prev.ndmi;
    const ndviChange = latest.ndvi - prev.ndvi;
    const windowMonths = Math.max(
      1,
      Math.round(
        (latest.date.getTime() - prev.date.getTime()) /
          (30 * 24 * 60 * 60 * 1000)
      )
    );

    const baseAlert = {
      ndmiChange,
      ndviChange,
      windowMonths,
      season: season.season,
      seasonLabelFr: season.labelFr,
      thresholdsUsed: thresholds,
    };

    // Early dry: NDMI drops while NDVI stays flat
    if (
      ndmiChange <= -thresholds.dropWatch &&
      Math.abs(ndviChange) < thresholds.ndviStableEpsilon
    ) {
      const level: NDMIAlertLevel =
        ndmiChange <= -thresholds.dropAlert ? 'alert' : 'watch';
      return {
        ...baseAlert,
        level,
        code: 'ndmi_early_dry',
        messageFr:
          level === 'alert'
            ? `Alerte hydrique${seasonSuffix} : humidité foliaire (NDMI) en forte baisse (${ndmiChange.toFixed(3)} / ~${windowMonths} mois) alors que le NDVI reste stable. Stress hydrique probable.`
            : `Surveillance hydrique${seasonSuffix} : NDMI en baisse (${ndmiChange.toFixed(3)}) alors que le NDVI est stable. Signal précoce possible.`,
        messageEn:
          level === 'alert'
            ? `Hydric alert${seasonSuffix}: foliar moisture (NDMI) dropping sharply (${ndmiChange.toFixed(3)} / ~${windowMonths} mo) while NDVI is stable.`
            : `Hydric watch${seasonSuffix}: NDMI declining (${ndmiChange.toFixed(3)}) while NDVI is stable.`,
      };
    }

    if (ndmiChange <= -thresholds.dropAlert) {
      return {
        ...baseAlert,
        level: 'alert',
        code: 'ndmi_drop',
        messageFr: `NDMI en forte baisse (${ndmiChange.toFixed(3)} sur ~${windowMonths} mois)${seasonSuffix}. Vérifier irrigation et disponibilité en eau.`,
        messageEn: `Sharp NDMI drop (${ndmiChange.toFixed(3)} over ~${windowMonths} months)${seasonSuffix}. Check irrigation and water availability.`,
      };
    }

    if (ndmiChange <= -thresholds.dropWatch) {
      return {
        ...baseAlert,
        level: 'watch',
        code: 'ndmi_drop',
        messageFr: `NDMI en baisse modérée (${ndmiChange.toFixed(3)})${seasonSuffix}. À surveiller le mois prochain.`,
        messageEn: `Moderate NDMI decline (${ndmiChange.toFixed(3)})${seasonSuffix}. Monitor next month.`,
      };
    }

    if (latest.ndmi < thresholds.low) {
      return {
        ...baseAlert,
        level: 'watch',
        code: 'ndmi_low',
        messageFr: `NDMI bas (${latest.ndmi.toFixed(3)})${seasonSuffix}. Humidité foliaire faible — risque hydrique.`,
        messageEn: `Low NDMI (${latest.ndmi.toFixed(3)})${seasonSuffix}. Low foliar moisture — hydric risk.`,
      };
    }

    return {
      ...baseAlert,
      level: 'none',
      code: 'none',
      messageFr: `NDMI stable${seasonSuffix} — pas d’alerte hydrique précoce.`,
      messageEn: `NDMI stable${seasonSuffix} — no early hydric warning.`,
    };
  }

  if (latest.ndmi < thresholds.low) {
    return {
      level: 'watch',
      code: 'ndmi_low',
      messageFr: `NDMI bas (${latest.ndmi.toFixed(3)})${seasonSuffix}. Historique insuffisant pour une tendance.`,
      messageEn: `Low NDMI (${latest.ndmi.toFixed(3)})${seasonSuffix}. Insufficient history for a trend.`,
      ndmiChange: null,
      ndviChange: null,
      windowMonths: 0,
      season: season.season,
      seasonLabelFr: season.labelFr,
      thresholdsUsed: thresholds,
    };
  }

  return {
    level: 'none',
    code: 'none',
    messageFr: `NDMI disponible${seasonSuffix} — historique trop court pour une alerte tendance.`,
    messageEn: `NDMI available${seasonSuffix} — history too short for a trend alert.`,
    ndmiChange: null,
    ndviChange: null,
    windowMonths: 0,
    season: season.season,
    seasonLabelFr: season.labelFr,
    thresholdsUsed: thresholds,
  };
}
