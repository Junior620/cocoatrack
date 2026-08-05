/**
 * EVI cacao thresholds & early-warning signals.
 *
 * health_status stays NDVI-based. EVI is a complementary early stress indicator
 * for dense cocoa canopy (agroforestry), where NDVI often saturates.
 */

export type EVIAlertLevel = 'none' | 'watch' | 'alert';

export interface EVISeriesPoint {
  date: Date | string;
  ndvi: number;
  evi: number | null;
}

export interface EVIAlert {
  level: EVIAlertLevel;
  code: 'evi_drop' | 'evi_early_stress' | 'evi_low' | 'none';
  messageFr: string;
  messageEn: string;
  /** Absolute EVI change over the window (negative = decline) */
  eviChange: number | null;
  /** Absolute NDVI change over the same window */
  ndviChange: number | null;
  /** NDVI − EVI gap (higher ≈ denser / more saturated canopy) */
  ndviEviGap: number | null;
  windowMonths: number;
}

/** Absolute EVI drop over 1–2 months → watch / alert */
export const EVI_DROP_WATCH = 0.04;
export const EVI_DROP_ALERT = 0.08;

/** Absolute EVI level considered low for cocoa under shade */
export const EVI_LOW_THRESHOLD = 0.25;

/** NDVI considered "stable" when |ΔNDVI| below this while EVI drops */
export const NDVI_STABLE_EPSILON = 0.03;

/** Typical NDVI−EVI gap for dense cocoa canopy */
export const NDVI_EVI_GAP_DENSE = 0.15;

/** Gap tiers for legend / agent reading */
export const NDVI_EVI_GAP_TIERS = [
  {
    min: 0.15,
    key: 'dense' as const,
    labelFr: 'Canopée dense / NDVI saturé',
    labelEn: 'Dense canopy / NDVI saturating',
    hintFr: 'EVI plus fiable que NDVI pour détecter un stress sous ombrage.',
  },
  {
    min: 0.08,
    key: 'moderate' as const,
    labelFr: 'Couvert modéré à dense',
    labelEn: 'Moderate to dense cover',
    hintFr: 'Écart normal pour cacao agroforestier.',
  },
  {
    min: 0.03,
    key: 'light' as const,
    labelFr: 'Couvert léger / ombrage faible',
    labelEn: 'Light cover / low shade',
    hintFr: 'Peu de saturation NDVI — les deux indices se suivent.',
  },
  {
    min: -Infinity,
    key: 'bare_or_stress' as const,
    labelFr: 'Sol nu, jeune plant ou stress fort',
    labelEn: 'Bare soil, young plant or strong stress',
    hintFr: 'Écart très faible ou négatif : vérifier peuplement et sanitaire.',
  },
] as const;

/**
 * NDVI − EVI gap. Positive and large → NDVI saturating / dense canopy.
 */
export function calculateNdviEviGap(
  ndvi: number | null | undefined,
  evi: number | null | undefined
): number | null {
  if (ndvi == null || evi == null || isNaN(ndvi) || isNaN(evi)) return null;
  return ndvi - evi;
}

function toDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d);
}

export function interpretNdviEviGap(gap: number | null): {
  labelFr: string;
  labelEn: string;
  key: (typeof NDVI_EVI_GAP_TIERS)[number]['key'] | 'unavailable';
  hintFr: string;
} {
  if (gap == null) {
    return {
      labelFr: 'Écart indisponible',
      labelEn: 'Gap unavailable',
      key: 'unavailable',
      hintFr: 'Complétez l’EVI pour interpréter la canopée.',
    };
  }
  for (const tier of NDVI_EVI_GAP_TIERS) {
    if (gap >= tier.min) {
      return {
        labelFr: tier.labelFr,
        labelEn: tier.labelEn,
        key: tier.key,
        hintFr: tier.hintFr,
      };
    }
  }
  const last = NDVI_EVI_GAP_TIERS[NDVI_EVI_GAP_TIERS.length - 1];
  return {
    labelFr: last.labelFr,
    labelEn: last.labelEn,
    key: last.key,
    hintFr: last.hintFr,
  };
}

/**
 * Detect early EVI stress from a chronological series (oldest → newest).
 * Uses the last 2 points when available (≈ 1–2 months for monthly data).
 */
export function detectEVIEarlyAlert(series: EVISeriesPoint[]): EVIAlert {
  const withEvi = series
    .filter((p) => p.evi != null && !isNaN(Number(p.evi)) && !isNaN(p.ndvi))
    .map((p) => ({
      date: toDate(p.date),
      ndvi: p.ndvi,
      evi: Number(p.evi),
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (withEvi.length === 0) {
    return {
      level: 'none',
      code: 'none',
      messageFr: 'Pas encore de données EVI.',
      messageEn: 'No EVI data yet.',
      eviChange: null,
      ndviChange: null,
      ndviEviGap: null,
      windowMonths: 0,
    };
  }

  const latest = withEvi[withEvi.length - 1];
  const gap = calculateNdviEviGap(latest.ndvi, latest.evi);

  if (withEvi.length >= 2) {
    const prev = withEvi[withEvi.length - 2];
    const eviChange = latest.evi - prev.evi;
    const ndviChange = latest.ndvi - prev.ndvi;
    const windowMonths = Math.max(
      1,
      Math.round(
        (latest.date.getTime() - prev.date.getTime()) /
          (30 * 24 * 60 * 60 * 1000)
      )
    );

    // Early stress: EVI drops while NDVI stays flat (NDVI saturation masking stress)
    if (
      eviChange <= -EVI_DROP_WATCH &&
      Math.abs(ndviChange) < NDVI_STABLE_EPSILON
    ) {
      const level: EVIAlertLevel =
        eviChange <= -EVI_DROP_ALERT ? 'alert' : 'watch';
      return {
        level,
        code: 'evi_early_stress',
        messageFr:
          level === 'alert'
            ? `Alerte précoce : EVI en forte baisse (${eviChange.toFixed(3)}) alors que le NDVI reste stable. Stress hydrique ou nutritionnel probable sous canopée dense.`
            : `Surveillance : EVI en baisse (${eviChange.toFixed(3)}) alors que le NDVI est stable. Signal précoce de stress possible.`,
        messageEn:
          level === 'alert'
            ? `Early alert: EVI dropping sharply (${eviChange.toFixed(3)}) while NDVI is stable. Likely water/nutrient stress under dense canopy.`
            : `Watch: EVI declining (${eviChange.toFixed(3)}) while NDVI is stable. Possible early stress signal.`,
        eviChange,
        ndviChange,
        ndviEviGap: gap,
        windowMonths,
      };
    }

    // Plain EVI drop (even if NDVI also moves)
    if (eviChange <= -EVI_DROP_ALERT) {
      return {
        level: 'alert',
        code: 'evi_drop',
        messageFr: `EVI en forte baisse (${eviChange.toFixed(3)} sur ~${windowMonths} mois). Vérifier irrigation, ombrage et sanitaire.`,
        messageEn: `Sharp EVI drop (${eviChange.toFixed(3)} over ~${windowMonths} months). Check irrigation, shade and plant health.`,
        eviChange,
        ndviChange,
        ndviEviGap: gap,
        windowMonths,
      };
    }

    if (eviChange <= -EVI_DROP_WATCH) {
      return {
        level: 'watch',
        code: 'evi_drop',
        messageFr: `EVI en baisse modérée (${eviChange.toFixed(3)}). À surveiller le mois prochain.`,
        messageEn: `Moderate EVI decline (${eviChange.toFixed(3)}). Monitor next month.`,
        eviChange,
        ndviChange,
        ndviEviGap: gap,
        windowMonths,
      };
    }

    if (latest.evi < EVI_LOW_THRESHOLD) {
      return {
        level: 'watch',
        code: 'evi_low',
        messageFr: `EVI bas (${latest.evi.toFixed(3)}). Couvert végétal faible ou stress prolongé.`,
        messageEn: `Low EVI (${latest.evi.toFixed(3)}). Weak cover or prolonged stress.`,
        eviChange,
        ndviChange,
        ndviEviGap: gap,
        windowMonths,
      };
    }

    return {
      level: 'none',
      code: 'none',
      messageFr: 'EVI stable — pas d’alerte précoce.',
      messageEn: 'EVI stable — no early warning.',
      eviChange,
      ndviChange,
      ndviEviGap: gap,
      windowMonths,
    };
  }

  // Single point
  if (latest.evi < EVI_LOW_THRESHOLD) {
    return {
      level: 'watch',
      code: 'evi_low',
      messageFr: `EVI bas (${latest.evi.toFixed(3)}). Historique insuffisant pour une tendance.`,
      messageEn: `Low EVI (${latest.evi.toFixed(3)}). Insufficient history for a trend.`,
      eviChange: null,
      ndviChange: null,
      ndviEviGap: gap,
      windowMonths: 0,
    };
  }

  return {
    level: 'none',
    code: 'none',
    messageFr: 'EVI disponible — historique trop court pour une alerte tendance.',
    messageEn: 'EVI available — history too short for a trend alert.',
    eviChange: null,
    ndviChange: null,
    ndviEviGap: gap,
    windowMonths: 0,
  };
}
