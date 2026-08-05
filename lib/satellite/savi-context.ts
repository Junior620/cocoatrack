/**
 * SAVI contextual display — show when canopy is sparse / soil-biased,
 * or when plantation metadata says young / low density.
 *
 * Priority:
 * 1. annee_plantation → age < SAVI_YOUNG_MAX_AGE_YEARS
 * 2. densite_arbres_ha → density < SAVI_LOW_DENSITY_MAX
 * 3. Spectral proxy: NDVI < 0.45 OR NDVI−EVI gap < 0.03
 */

export const SAVI_SPARSE_NDVI_MAX = 0.45;
export const SAVI_SPARSE_GAP_MAX = 0.03;
/** Show SAVI for stands younger than this (years) */
export const SAVI_YOUNG_MAX_AGE_YEARS = 7;
/** Trees/ha below this → soil visible / sparse stand */
export const SAVI_LOW_DENSITY_MAX = 800;

export const SAVI_BAND_GOOD_MIN = 0.35;
export const SAVI_BAND_FAIR_MIN = 0.2;

export type SAVILevelBand = 'low' | 'fair' | 'good' | 'unknown';

export interface SAVILevelInterpretation {
  band: SAVILevelBand;
  labelFr: string;
  hintFr: string;
  toneClass: string;
}

export function plantationAgeYears(
  anneePlantation: number | null | undefined,
  asOf: Date = new Date()
): number | null {
  if (anneePlantation == null || !Number.isFinite(anneePlantation)) return null;
  const age = asOf.getFullYear() - Math.floor(Number(anneePlantation));
  return age >= 0 && age < 200 ? age : null;
}

/**
 * Whether SAVI is useful to show for this parcelle / period.
 */
export function shouldShowSavi(opts: {
  meanNdvi: number | null | undefined;
  meanEvi?: number | null | undefined;
  anneePlantation?: number | null | undefined;
  densiteArbresHa?: number | null | undefined;
  asOf?: Date;
}): boolean {
  const age = plantationAgeYears(opts.anneePlantation, opts.asOf);
  if (age != null && age < SAVI_YOUNG_MAX_AGE_YEARS) return true;

  const densite = opts.densiteArbresHa;
  if (densite != null && Number.isFinite(densite) && densite < SAVI_LOW_DENSITY_MAX) {
    return true;
  }

  const ndvi = opts.meanNdvi;
  if (ndvi == null || isNaN(Number(ndvi))) return false;

  const n = Number(ndvi);
  if (n < SAVI_SPARSE_NDVI_MAX) return true;

  const evi = opts.meanEvi;
  if (evi != null && !isNaN(Number(evi))) {
    const gap = n - Number(evi);
    if (gap < SAVI_SPARSE_GAP_MAX) return true;
  }

  return false;
}

/**
 * Human bands for young / sparse stands (not dense shade cocoa).
 */
export function interpretSAVILevel(
  savi: number | null | undefined
): SAVILevelInterpretation {
  if (savi == null || isNaN(Number(savi))) {
    return {
      band: 'unknown',
      labelFr: 'SAVI indisponible',
      hintFr: 'Compléter via Historique GEE.',
      toneClass: 'border-gray-100 bg-gray-50 text-gray-700',
    };
  }

  const v = Number(savi);
  if (v >= SAVI_BAND_GOOD_MIN) {
    return {
      band: 'good',
      labelFr: 'Biomasse correcte',
      hintFr: 'Signal végétation correct malgré sol visible — reprise / peuplement OK.',
      toneClass: 'border-emerald-100 bg-emerald-50 text-emerald-950',
    };
  }
  if (v >= SAVI_BAND_FAIR_MIN) {
    return {
      band: 'fair',
      labelFr: 'Biomasse moyenne',
      hintFr: 'Peuplement clair ou jeune — surveiller densification et survie.',
      toneClass: 'border-lime-100 bg-lime-50 text-lime-950',
    };
  }
  return {
    band: 'low',
    labelFr: 'Biomasse faible',
    hintFr: 'Sol dominant ou plants peu développés — vérifier replantation / peuplement.',
    toneClass: 'border-orange-100 bg-orange-50 text-orange-950',
  };
}
