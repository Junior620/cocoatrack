/**
 * NDWI cacao thresholds — surface water / prolonged wetness signals.
 *
 * health_status stays NDVI-based. NDWI complements NDMI:
 * - NDMI → foliar moisture (SWIR)
 * - NDWI → surface water / wet soil (Green−NIR)
 */

export type NDWIAlertLevel = 'none' | 'watch' | 'alert';

export interface NDWISeriesPoint {
  date: Date | string;
  ndvi: number;
  ndwi: number | null;
}

export interface NDWIThresholds {
  /** Absolute NDWI rise over 1–2 months → wetter */
  riseWatch: number;
  riseAlert: number;
  /** Absolute level considered high (surface water / flooding risk) */
  high: number;
  ndviStableEpsilon: number;
}

export const NDWI_THRESHOLDS_CACAO: NDWIThresholds = {
  riseWatch: 0.04,
  riseAlert: 0.08,
  high: 0.1,
  ndviStableEpsilon: 0.03,
};

export const NDWI_RISE_WATCH = NDWI_THRESHOLDS_CACAO.riseWatch;
export const NDWI_RISE_ALERT = NDWI_THRESHOLDS_CACAO.riseAlert;
export const NDWI_HIGH_THRESHOLD = NDWI_THRESHOLDS_CACAO.high;

export interface NDWIAlert {
  level: NDWIAlertLevel;
  code: 'ndwi_rise' | 'ndwi_early_wet' | 'ndwi_high' | 'none';
  messageFr: string;
  messageEn: string;
  ndwiChange: number | null;
  ndviChange: number | null;
  windowMonths: number;
}

function toDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d);
}

/**
 * Detect early surface-wetness / flood signal (oldest → newest).
 */
export function detectNDWIEarlyAlert(
  series: NDWISeriesPoint[],
  thresholds: NDWIThresholds = NDWI_THRESHOLDS_CACAO
): NDWIAlert {
  const withNdwi = series
    .filter((p) => p.ndwi != null && !isNaN(Number(p.ndwi)) && !isNaN(p.ndvi))
    .map((p) => ({
      date: toDate(p.date),
      ndvi: p.ndvi,
      ndwi: Number(p.ndwi),
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (withNdwi.length === 0) {
    return {
      level: 'none',
      code: 'none',
      messageFr: 'Pas encore de données NDWI.',
      messageEn: 'No NDWI data yet.',
      ndwiChange: null,
      ndviChange: null,
      windowMonths: 0,
    };
  }

  const latest = withNdwi[withNdwi.length - 1];

  if (withNdwi.length >= 2) {
    const prev = withNdwi[withNdwi.length - 2];
    const ndwiChange = latest.ndwi - prev.ndwi;
    const ndviChange = latest.ndvi - prev.ndvi;
    const windowMonths = Math.max(
      1,
      Math.round(
        (latest.date.getTime() - prev.date.getTime()) /
          (30 * 24 * 60 * 60 * 1000)
      )
    );

    // Early wet: NDWI rises while NDVI stays flat
    if (
      ndwiChange >= thresholds.riseWatch &&
      Math.abs(ndviChange) < thresholds.ndviStableEpsilon
    ) {
      const level: NDWIAlertLevel =
        ndwiChange >= thresholds.riseAlert ? 'alert' : 'watch';
      return {
        level,
        code: 'ndwi_early_wet',
        messageFr:
          level === 'alert'
            ? `Alerte humidité de surface : NDWI en forte hausse (${ndwiChange.toFixed(3)}) alors que le NDVI reste stable. Eau stagnante / inondation possible.`
            : `Surveillance : NDWI en hausse (${ndwiChange.toFixed(3)}) alors que le NDVI est stable. Zone plus humide en surface.`,
        messageEn:
          level === 'alert'
            ? `Surface-wetness alert: NDWI rising sharply (${ndwiChange.toFixed(3)}) while NDVI is stable. Possible standing water / flooding.`
            : `Watch: NDWI rising (${ndwiChange.toFixed(3)}) while NDVI is stable. Wetter surface conditions.`,
        ndwiChange,
        ndviChange,
        windowMonths,
      };
    }

    if (ndwiChange >= thresholds.riseAlert) {
      return {
        level: 'alert',
        code: 'ndwi_rise',
        messageFr: `NDWI en forte hausse (${ndwiChange.toFixed(3)} sur ~${windowMonths} mois). Vérifier drainage et bas-fonds.`,
        messageEn: `Sharp NDWI rise (${ndwiChange.toFixed(3)} over ~${windowMonths} months). Check drainage and low-lying areas.`,
        ndwiChange,
        ndviChange,
        windowMonths,
      };
    }

    if (ndwiChange >= thresholds.riseWatch) {
      return {
        level: 'watch',
        code: 'ndwi_rise',
        messageFr: `NDWI en hausse modérée (${ndwiChange.toFixed(3)}). À surveiller le mois prochain.`,
        messageEn: `Moderate NDWI rise (${ndwiChange.toFixed(3)}). Monitor next month.`,
        ndwiChange,
        ndviChange,
        windowMonths,
      };
    }

    if (latest.ndwi >= thresholds.high) {
      return {
        level: 'watch',
        code: 'ndwi_high',
        messageFr: `NDWI élevé (${latest.ndwi.toFixed(3)}). Surface très humide ou eau libre — vérifier drainage.`,
        messageEn: `High NDWI (${latest.ndwi.toFixed(3)}). Very wet surface or open water — check drainage.`,
        ndwiChange,
        ndviChange,
        windowMonths,
      };
    }

    return {
      level: 'none',
      code: 'none',
      messageFr: 'NDWI stable — pas d’alerte eau de surface.',
      messageEn: 'NDWI stable — no surface-water warning.',
      ndwiChange,
      ndviChange,
      windowMonths,
    };
  }

  if (latest.ndwi >= thresholds.high) {
    return {
      level: 'watch',
      code: 'ndwi_high',
      messageFr: `NDWI élevé (${latest.ndwi.toFixed(3)}). Historique insuffisant pour une tendance.`,
      messageEn: `High NDWI (${latest.ndwi.toFixed(3)}). Insufficient history for a trend.`,
      ndwiChange: null,
      ndviChange: null,
      windowMonths: 0,
    };
  }

  return {
    level: 'none',
    code: 'none',
    messageFr: 'NDWI disponible — historique trop court pour une alerte tendance.',
    messageEn: 'NDWI available — history too short for a trend alert.',
    ndwiChange: null,
    ndviChange: null,
    windowMonths: 0,
  };
}
