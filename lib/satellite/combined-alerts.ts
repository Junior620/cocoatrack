/**
 * Combined early alerts: EVI (canopy) ∩ NDMI (hydric).
 *
 * When both drop while NDVI stays relatively stable → high visit priority.
 */

import type { EVIAlert } from './evi-alerts';
import type { NDMIAlert } from './ndmi-alerts';

export type CombinedAlertLevel = 'none' | 'watch' | 'alert';

export type CombinedAlertCode =
  | 'none'
  | 'canopy_only'
  | 'hydric_only'
  | 'canopy_and_hydric';

export interface CombinedVegetationAlert {
  level: CombinedAlertLevel;
  code: CombinedAlertCode;
  /** Field-agent priority */
  visitPriority: 'none' | 'medium' | 'high';
  messageFr: string;
  messageEn: string;
  sources: Array<'evi' | 'ndmi'>;
  eviLevel: CombinedAlertLevel;
  ndmiLevel: CombinedAlertLevel;
}

function levelRank(level: CombinedAlertLevel): number {
  if (level === 'alert') return 2;
  if (level === 'watch') return 1;
  return 0;
}

function maxLevel(
  a: CombinedAlertLevel,
  b: CombinedAlertLevel
): CombinedAlertLevel {
  return levelRank(a) >= levelRank(b) ? a : b;
}

/**
 * Merge EVI + NDMI early alerts into one agent-facing signal.
 */
export function combineVegetationAlerts(
  eviAlert: EVIAlert,
  ndmiAlert: NDMIAlert
): CombinedVegetationAlert {
  const eviLevel = eviAlert.level as CombinedAlertLevel;
  const ndmiLevel = ndmiAlert.level as CombinedAlertLevel;
  const sources: Array<'evi' | 'ndmi'> = [];
  if (eviLevel !== 'none') sources.push('evi');
  if (ndmiLevel !== 'none') sources.push('ndmi');

  if (sources.length === 0) {
    return {
      level: 'none',
      code: 'none',
      visitPriority: 'none',
      messageFr: 'Pas d’alerte précoce canopée ni hydrique.',
      messageEn: 'No early canopy or hydric alert.',
      sources: [],
      eviLevel,
      ndmiLevel,
    };
  }

  const both = sources.length === 2;
  const level = maxLevel(eviLevel, ndmiLevel);

  if (both) {
    const high =
      eviLevel === 'alert' || ndmiLevel === 'alert' ? 'alert' : 'watch';
    return {
      level: high,
      code: 'canopy_and_hydric',
      visitPriority: high === 'alert' ? 'high' : 'medium',
      messageFr:
        high === 'alert'
          ? 'Double signal : EVI (canopée) et NDMI (humidité) en baisse alors que le NDVI peut rester stable. Priorité visite haute.'
          : 'Double signal de surveillance : canopée (EVI) et humidité (NDMI). Planifier une observation terrain.',
      messageEn:
        high === 'alert'
          ? 'Dual signal: EVI (canopy) and NDMI (moisture) declining while NDVI may stay flat. High visit priority.'
          : 'Dual watch: canopy (EVI) and moisture (NDMI). Schedule a field check.',
      sources,
      eviLevel,
      ndmiLevel,
    };
  }

  if (sources[0] === 'evi') {
    return {
      level: eviLevel,
      code: 'canopy_only',
      visitPriority: eviLevel === 'alert' ? 'high' : 'medium',
      messageFr: eviAlert.messageFr,
      messageEn: eviAlert.messageEn,
      sources,
      eviLevel,
      ndmiLevel,
    };
  }

  return {
    level: ndmiLevel,
    code: 'hydric_only',
    visitPriority: ndmiLevel === 'alert' ? 'high' : 'medium',
    messageFr: ndmiAlert.messageFr,
    messageEn: ndmiAlert.messageEn,
    sources,
    eviLevel,
    ndmiLevel,
  };
}
