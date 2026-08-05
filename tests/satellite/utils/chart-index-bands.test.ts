import { describe, expect, it } from 'vitest';
import {
  classifyNdviDelta,
  confidenceFromQuality,
  getIndexBands,
  estimateValidPixelsPercent,
} from '@/lib/satellite/chart-index-bands';

describe('classifyNdviDelta', () => {
  it('labels critical drop', () => {
    expect(classifyNdviDelta(-0.52).labelFr).toBe('Baisse critique');
    expect(classifyNdviDelta(-0.52).direction).toBe('down');
  });

  it('labels strong improvement', () => {
    expect(classifyNdviDelta(0.58).labelFr).toBe('Forte amélioration');
    expect(classifyNdviDelta(0.58).direction).toBe('up');
  });
});

describe('confidenceFromQuality', () => {
  it('marks degraded as faible', () => {
    expect(confidenceFromQuality('degraded', 96).labelFr).toBe('Faible');
  });

  it('marks good as bonne', () => {
    expect(confidenceFromQuality('good', 12).labelFr).toBe('Bonne');
  });
});

describe('getIndexBands', () => {
  it('returns ndvi bands', () => {
    expect(getIndexBands('ndvi').length).toBeGreaterThanOrEqual(3);
  });
});

describe('estimateValidPixelsPercent', () => {
  it('proxies from cloud cover', () => {
    expect(estimateValidPixelsPercent(18)).toBe(82);
  });
});
