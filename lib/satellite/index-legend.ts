/**
 * Unified business legend for satellite indices (one sentence).
 */

export function buildIndexLegendSentence(opts: {
  meanNdvi: number | null;
  meanEvi: number | null;
  meanNdmi: number | null;
  meanNdwi: number | null;
  meanSavi: number | null;
  saviRelevant?: boolean;
  imageryQuality?: 'good' | 'acceptable' | 'degraded' | null;
}): string {
  const quality = opts.imageryQuality ?? null;
  if (quality === 'degraded') {
    return 'Image trop nuageuse ce mois — indices hydriques / eau / sol peu fiables ; se fier surtout au NDVI avec prudence.';
  }

  const parts: string[] = [];
  if (opts.meanNdvi != null) {
    parts.push(
      opts.meanNdvi >= 0.55
        ? 'verdure correcte (NDVI)'
        : opts.meanNdvi >= 0.45
          ? 'verdure moyenne (NDVI)'
          : 'verdure faible (NDVI)'
    );
  }
  if (opts.meanEvi != null) {
    parts.push(
      opts.meanEvi >= 0.35
        ? 'canopée/photosynthèse OK (EVI)'
        : 'canopée sous tension (EVI)'
    );
  }
  if (opts.meanNdmi != null) {
    parts.push(
      opts.meanNdmi >= 0.12
        ? 'humidité foliaire OK (NDMI)'
        : 'stress hydrique possible (NDMI)'
    );
  }
  if (opts.meanNdwi != null) {
    parts.push(
      opts.meanNdwi >= 0.05
        ? 'surface humide / eau (NDWI)'
        : 'peu d’eau de surface (NDWI)'
    );
  }
  if (opts.saviRelevant && opts.meanSavi != null) {
    parts.push(
      opts.meanSavi >= 0.35
        ? 'biomasse OK malgré sol (SAVI)'
        : 'biomasse limitée / sol visible (SAVI)'
    );
  }

  if (parts.length === 0) return 'Pas encore assez d’indices pour une lecture métier.';
  return `Lecture : ${parts.join(' · ')}.`;
}

/** Whether a complementary index should be visually muted */
export function isIndexUnreliable(
  imageryQuality: 'good' | 'acceptable' | 'degraded' | null | undefined
): boolean {
  return imageryQuality === 'degraded';
}
