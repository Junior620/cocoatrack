/**
 * Human-readable NDMI moisture bands for cocoa UI.
 */

export type NDMIMoistureBand = 'ok' | 'watch' | 'dry' | 'unknown';

export interface NDMIMoistureInterpretation {
  band: NDMIMoistureBand;
  labelFr: string;
  hintFr: string;
  toneClass: string;
}

/** Calibrated cocoa foliar-moisture bands (V2 defaults; refine with field notes) */
export const NDMI_BAND_OK_MIN = 0.12;
export const NDMI_BAND_WATCH_MIN = 0.05;

export function interpretNDMILevel(
  ndmi: number | null | undefined
): NDMIMoistureInterpretation {
  if (ndmi == null || isNaN(Number(ndmi))) {
    return {
      band: 'unknown',
      labelFr: 'NDMI indisponible',
      hintFr: 'Compléter via Historique GEE.',
      toneClass: 'border-gray-100 bg-gray-50 text-gray-700',
    };
  }

  const v = Number(ndmi);
  if (v >= NDMI_BAND_OK_MIN) {
    return {
      band: 'ok',
      labelFr: 'Humidité OK',
      hintFr: 'Humidité foliaire dans une plage confortable pour le cacao.',
      toneClass: 'border-emerald-100 bg-emerald-50 text-emerald-900',
    };
  }
  if (v >= NDMI_BAND_WATCH_MIN) {
    return {
      band: 'watch',
      labelFr: 'Surveillance',
      hintFr: 'Humidité foliaire moyenne — surveiller irrigation et ombrage.',
      toneClass: 'border-amber-100 bg-amber-50 text-amber-950',
    };
  }
  return {
    band: 'dry',
    labelFr: 'Sec',
    hintFr: 'Humidité foliaire basse — risque de stress hydrique.',
    toneClass: 'border-orange-200 bg-orange-50 text-orange-950',
  };
}
