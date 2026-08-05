/**
 * NDRE levels & early alert (chlorophyll / nutrition under dense canopy).
 */

export type NDREAlertLevel = 'none' | 'watch' | 'alert';

export interface NDREAlert {
  level: NDREAlertLevel;
  code: 'ndre_drop' | 'ndre_low' | 'none';
  messageFr: string;
  messageEn: string;
}

export const NDRE_LOW = 0.2;
export const NDRE_DROP_WATCH = 0.04;
export const NDRE_DROP_ALERT = 0.07;
export const NDRE_BAND_OK_MIN = 0.28;

export function interpretNDRELevel(ndre: number | null | undefined): {
  band: 'low' | 'watch' | 'ok' | 'unknown';
  labelFr: string;
  hintFr: string;
} {
  if (ndre == null || isNaN(Number(ndre))) {
    return {
      band: 'unknown',
      labelFr: 'NDRE indisponible',
      hintFr: 'Compléter via Historique GEE (B5+B8A).',
    };
  }
  const v = Number(ndre);
  if (v >= NDRE_BAND_OK_MIN) {
    return {
      band: 'ok',
      labelFr: 'Chlorophylle OK',
      hintFr: 'Signal red-edge correct sous canopée.',
    };
  }
  if (v >= NDRE_LOW) {
    return {
      band: 'watch',
      labelFr: 'Chlorophylle faible',
      hintFr: 'Possible stress nutritionnel — croiser avec EVI.',
    };
  }
  return {
    band: 'low',
    labelFr: 'Chlorophylle très faible',
    hintFr: 'Vérifier fertilisation / sanitaire.',
  };
}

export function detectNDREEarlyAlert(
  series: Array<{ date: Date | string; ndvi: number; ndre: number | null }>
): NDREAlert {
  const pts = series
    .filter((p) => p.ndre != null && !isNaN(Number(p.ndre)))
    .map((p) => ({
      date: p.date instanceof Date ? p.date : new Date(p.date),
      ndre: Number(p.ndre),
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (pts.length === 0) {
    return {
      level: 'none',
      code: 'none',
      messageFr: 'Pas encore de données NDRE.',
      messageEn: 'No NDRE data yet.',
    };
  }

  const latest = pts[pts.length - 1];
  if (pts.length >= 2) {
    const prev = pts[pts.length - 2];
    const drop = prev.ndre - latest.ndre;
    if (drop >= NDRE_DROP_ALERT) {
      return {
        level: 'alert',
        code: 'ndre_drop',
        messageFr: `NDRE en forte baisse (−${drop.toFixed(3)}) — stress chlorophylle possible.`,
        messageEn: `Sharp NDRE drop (−${drop.toFixed(3)}) — possible chlorophyll stress.`,
      };
    }
    if (drop >= NDRE_DROP_WATCH) {
      return {
        level: 'watch',
        code: 'ndre_drop',
        messageFr: `NDRE en baisse (−${drop.toFixed(3)}) — surveiller nutrition.`,
        messageEn: `NDRE declining (−${drop.toFixed(3)}) — monitor nutrition.`,
      };
    }
  }

  if (latest.ndre < NDRE_LOW) {
    return {
      level: 'watch',
      code: 'ndre_low',
      messageFr: `NDRE bas (${latest.ndre.toFixed(3)}) — vérifier fertilisation.`,
      messageEn: `Low NDRE (${latest.ndre.toFixed(3)}) — check fertilization.`,
    };
  }

  return {
    level: 'none',
    code: 'none',
    messageFr: 'NDRE stable.',
    messageEn: 'NDRE stable.',
  };
}
