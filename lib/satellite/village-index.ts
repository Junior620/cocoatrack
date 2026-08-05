/**
 * Generic village median comparison (EVI / SAVI / etc.)
 */

export type VillageIndexDeltaBand =
  | 'above'
  | 'similar'
  | 'below'
  | 'insufficient';

export interface VillageIndexComparison {
  index: string;
  village: string;
  sampleSize: number;
  villageMedian: number | null;
  parcelleValue: number;
  delta: number | null;
  band: VillageIndexDeltaBand;
  labelFr: string;
  hintFr: string;
}

export const VILLAGE_INDEX_SIMILAR_EPSILON = 0.03;

function median(values: number[]): number | null {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

export function compareIndexToVillage(
  indexName: string,
  parcelleValue: number,
  village: string | null | undefined,
  peerValues: number[],
  labels: {
    aboveFr: string;
    belowFr: string;
    similarFr: string;
    unitHint?: string;
  }
): VillageIndexComparison | null {
  if (!village || !village.trim()) return null;
  if (!Number.isFinite(parcelleValue)) return null;

  const peers = peerValues.filter((v) => Number.isFinite(v));
  const villageMedian = median(peers);

  if (villageMedian == null || peers.length < 2) {
    return {
      index: indexName,
      village: village.trim(),
      sampleSize: peers.length,
      villageMedian,
      parcelleValue,
      delta: null,
      band: 'insufficient',
      labelFr: `Comparaison village ${indexName} insuffisante`,
      hintFr: `Pas assez de parcelles du village avec ${indexName} ce mois-ci.`,
    };
  }

  const delta = parcelleValue - villageMedian;
  let band: VillageIndexDeltaBand = 'similar';
  if (delta > VILLAGE_INDEX_SIMILAR_EPSILON) band = 'above';
  else if (delta < -VILLAGE_INDEX_SIMILAR_EPSILON) band = 'below';

  const labelFr =
    band === 'above'
      ? labels.aboveFr
      : band === 'below'
        ? labels.belowFr
        : labels.similarFr;

  const hintFr =
    band === 'below'
      ? `${indexName} ${delta.toFixed(3)} sous la médiane village (${villageMedian.toFixed(3)}, n=${peers.length}).${labels.unitHint ? ` ${labels.unitHint}` : ''}`
      : band === 'above'
        ? `${indexName} ${delta >= 0 ? '+' : ''}${delta.toFixed(3)} au-dessus de la médiane (${villageMedian.toFixed(3)}, n=${peers.length}).`
        : `Écart faible vs médiane village (${villageMedian.toFixed(3)}, n=${peers.length}).`;

  return {
    index: indexName,
    village: village.trim(),
    sampleSize: peers.length,
    villageMedian,
    parcelleValue,
    delta,
    band,
    labelFr,
    hintFr,
  };
}

export function compareEviToVillage(
  parcelleEVI: number,
  village: string | null | undefined,
  peerValues: number[]
) {
  return compareIndexToVillage('EVI', parcelleEVI, village, peerValues, {
    aboveFr: 'Canopée plus vigoureuse que le village',
    belowFr: 'Canopée plus faible que le village',
    similarFr: 'Proche de la médiane village (EVI)',
    unitHint: 'Prioriser une visite canopée.',
  });
}

export function compareSaviToVillage(
  parcelleSAVI: number,
  village: string | null | undefined,
  peerValues: number[]
) {
  return compareIndexToVillage('SAVI', parcelleSAVI, village, peerValues, {
    aboveFr: 'Biomasse (sol) au-dessus du village',
    belowFr: 'Biomasse (sol) sous le village',
    similarFr: 'Proche de la médiane village (SAVI)',
    unitHint: 'Vérifier densification / survie.',
  });
}
