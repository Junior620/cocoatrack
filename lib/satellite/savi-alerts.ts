/**
 * SAVI early alert — weak recovery / low biomass on young or sparse stands.
 * Only meaningful when shouldShowSavi is true.
 */

import {
  SAVI_BAND_FAIR_MIN,
  SAVI_BAND_GOOD_MIN,
  shouldShowSavi,
} from './savi-context';

export type SAVIAlertLevel = 'none' | 'watch' | 'alert';

export interface SAVIAlert {
  level: SAVIAlertLevel;
  code: 'savi_weak_recovery' | 'savi_low' | 'none';
  messageFr: string;
  messageEn: string;
}

export interface SAVISeriesPoint {
  date: Date | string;
  savi: number | null;
}

/**
 * Detect weak recovery: absolute low SAVI, or flat/declining series while young/sparse.
 */
export function detectSAVIEarlyAlert(
  series: SAVISeriesPoint[],
  context: {
    meanNdvi: number | null;
    meanEvi?: number | null;
    anneePlantation?: number | null;
    densiteArbresHa?: number | null;
  }
): SAVIAlert {
  if (
    !shouldShowSavi({
      meanNdvi: context.meanNdvi,
      meanEvi: context.meanEvi,
      anneePlantation: context.anneePlantation,
      densiteArbresHa: context.densiteArbresHa,
    })
  ) {
    return {
      level: 'none',
      code: 'none',
      messageFr: 'SAVI non pertinent sur cette canopée (peuplement dense).',
      messageEn: 'SAVI not relevant for this dense canopy.',
    };
  }

  const withSavi = series
    .filter((p) => p.savi != null && !isNaN(Number(p.savi)))
    .map((p) => ({
      date: p.date instanceof Date ? p.date : new Date(p.date),
      savi: Number(p.savi),
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (withSavi.length === 0) {
    return {
      level: 'none',
      code: 'none',
      messageFr: 'Pas encore de données SAVI.',
      messageEn: 'No SAVI data yet.',
    };
  }

  const latest = withSavi[withSavi.length - 1];

  if (latest.savi < SAVI_BAND_FAIR_MIN) {
    return {
      level: 'alert',
      code: 'savi_low',
      messageFr: `SAVI très bas (${latest.savi.toFixed(3)}) sur peuplement clair/jeune — vérifier survie et densification.`,
      messageEn: `Very low SAVI (${latest.savi.toFixed(3)}) on sparse/young stand — check survival and densification.`,
    };
  }

  if (withSavi.length >= 2) {
    const prev = withSavi[withSavi.length - 2];
    const change = latest.savi - prev.savi;
    if (change <= 0.01 && latest.savi < SAVI_BAND_GOOD_MIN) {
      return {
        level: 'watch',
        code: 'savi_weak_recovery',
        messageFr: `Reprise faible (SAVI ${latest.savi.toFixed(3)}, Δ ${change >= 0 ? '+' : ''}${change.toFixed(3)}) — surveiller le mois prochain.`,
        messageEn: `Weak recovery (SAVI ${latest.savi.toFixed(3)}, Δ ${change >= 0 ? '+' : ''}${change.toFixed(3)}) — monitor next month.`,
      };
    }
  }

  if (latest.savi < SAVI_BAND_GOOD_MIN) {
    return {
      level: 'watch',
      code: 'savi_low',
      messageFr: `SAVI moyen (${latest.savi.toFixed(3)}) — biomasse encore limitée pour un peuplement clair.`,
      messageEn: `Moderate SAVI (${latest.savi.toFixed(3)}) — limited biomass for a sparse stand.`,
    };
  }

  return {
    level: 'none',
    code: 'none',
    messageFr: 'SAVI OK pour un peuplement clair/jeune.',
    messageEn: 'SAVI OK for sparse/young stand.',
  };
}
