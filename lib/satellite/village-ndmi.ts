/**
 * Compare a parcelle NDMI to the village median for the same month.
 */

export type VillageNdmiDeltaBand =
  | 'above'
  | 'similar'
  | 'below'
  | 'insufficient';

export interface VillageNdmiComparison {
  village: string;
  sampleSize: number;
  villageMedianNDMI: number | null;
  parcelleNDMI: number;
  delta: number | null;
  band: VillageNdmiDeltaBand;
  labelFr: string;
  hintFr: string;
}

/** Absolute delta vs village median considered "similar" */
export const VILLAGE_NDMI_SIMILAR_EPSILON = 0.03;

function median(values: number[]): number | null {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Build village comparison from peer NDMI values (same village, same month).
 * Requires ≥ 2 peers besides the parcelle itself ideally; min sampleSize 2 total.
 */
export function compareNdmiToVillage(
  parcelleNDMI: number,
  village: string | null | undefined,
  peerNdmiValues: number[]
): VillageNdmiComparison | null {
  if (!village || !village.trim()) return null;
  if (!Number.isFinite(parcelleNDMI)) return null;

  const peers = peerNdmiValues.filter((v) => Number.isFinite(v));
  const villageMedianNDMI = median(peers);

  if (villageMedianNDMI == null || peers.length < 2) {
    return {
      village: village.trim(),
      sampleSize: peers.length,
      villageMedianNDMI,
      parcelleNDMI,
      delta: null,
      band: 'insufficient',
      labelFr: 'Comparaison village insuffisante',
      hintFr:
        'Pas assez de parcelles du village avec NDMI ce mois-ci pour comparer.',
    };
  }

  const delta = parcelleNDMI - villageMedianNDMI;
  let band: VillageNdmiDeltaBand = 'similar';
  if (delta > VILLAGE_NDMI_SIMILAR_EPSILON) band = 'above';
  else if (delta < -VILLAGE_NDMI_SIMILAR_EPSILON) band = 'below';

  const labelFr =
    band === 'above'
      ? 'Plus humide que le village'
      : band === 'below'
        ? 'Plus sec que le village'
        : 'Proche de la médiane village';

  const hintFr =
    band === 'below'
      ? `NDMI ${delta.toFixed(3)} sous la médiane du village (${villageMedianNDMI.toFixed(3)}, n=${peers.length}). Prioriser une visite hydrique.`
      : band === 'above'
        ? `NDMI ${delta >= 0 ? '+' : ''}${delta.toFixed(3)} au-dessus de la médiane village (${villageMedianNDMI.toFixed(3)}, n=${peers.length}).`
        : `Écart faible vs médiane village (${villageMedianNDMI.toFixed(3)}, n=${peers.length}).`;

  return {
    village: village.trim(),
    sampleSize: peers.length,
    villageMedianNDMI,
    parcelleNDMI,
    delta,
    band,
    labelFr,
    hintFr,
  };
}
