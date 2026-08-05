/**
 * Human-readable NDWI surface-wetness bands for cocoa UI.
 */

export type NDWIWetnessBand = 'dry' | 'normal' | 'wet' | 'water' | 'unknown';

export interface NDWIWetnessInterpretation {
  band: NDWIWetnessBand;
  labelFr: string;
  hintFr: string;
  toneClass: string;
}

/** McFeeters NDWI bands (cocoa / tropical — refine with field notes) */
export const NDWI_BAND_WATER_MIN = 0.2;
export const NDWI_BAND_WET_MIN = 0.05;
export const NDWI_BAND_NORMAL_MIN = -0.1;

export function interpretNDWILevel(
  ndwi: number | null | undefined
): NDWIWetnessInterpretation {
  if (ndwi == null || isNaN(Number(ndwi))) {
    return {
      band: 'unknown',
      labelFr: 'NDWI indisponible',
      hintFr: 'Compléter via Historique GEE.',
      toneClass: 'border-gray-100 bg-gray-50 text-gray-700',
    };
  }

  const v = Number(ndwi);
  if (v >= NDWI_BAND_WATER_MIN) {
    return {
      band: 'water',
      labelFr: 'Eau libre',
      hintFr: 'Signal fort d’eau de surface — inondation / mare / drainage.',
      toneClass: 'border-blue-200 bg-blue-50 text-blue-950',
    };
  }
  if (v >= NDWI_BAND_WET_MIN) {
    return {
      band: 'wet',
      labelFr: 'Surface humide',
      hintFr: 'Sol / bas-fonds humides — surveiller le drainage.',
      toneClass: 'border-sky-100 bg-sky-50 text-sky-950',
    };
  }
  if (v >= NDWI_BAND_NORMAL_MIN) {
    return {
      band: 'normal',
      labelFr: 'Surface normale',
      hintFr: 'Pas de signal d’eau libre dominant.',
      toneClass: 'border-slate-100 bg-slate-50 text-slate-800',
    };
  }
  return {
    band: 'dry',
    labelFr: 'Surface sèche',
    hintFr: 'Peu d’eau de surface détectée (végétation / sol sec).',
    toneClass: 'border-amber-100 bg-amber-50 text-amber-950',
  };
}
