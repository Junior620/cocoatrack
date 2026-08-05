/**
 * Tests for SAVI contextual display (sparse canopy proxy)
 */

import { describe, it, expect } from 'vitest';
import {
  shouldShowSavi,
  interpretSAVILevel,
  SAVI_SPARSE_NDVI_MAX,
  SAVI_SPARSE_GAP_MAX,
} from '@/lib/satellite/savi-context';

describe('shouldShowSavi', () => {
  it('shows when NDVI is below sparse threshold', () => {
    expect(
      shouldShowSavi({ meanNdvi: SAVI_SPARSE_NDVI_MAX - 0.01, meanEvi: 0.35 })
    ).toBe(true);
  });

  it('shows when NDVI−EVI gap is below sparse gap max', () => {
    expect(
      shouldShowSavi({
        meanNdvi: 0.6,
        meanEvi: 0.6 - SAVI_SPARSE_GAP_MAX + 0.001,
      })
    ).toBe(true);
  });

  it('hides on dense canopy (high NDVI and large NDVI−EVI gap)', () => {
    expect(shouldShowSavi({ meanNdvi: 0.7, meanEvi: 0.5 })).toBe(false);
  });

  it('hides when NDVI missing', () => {
    expect(shouldShowSavi({ meanNdvi: null, meanEvi: 0.3 })).toBe(false);
  });
});

describe('interpretSAVILevel', () => {
  it('maps good / fair / low / unknown', () => {
    expect(interpretSAVILevel(0.4).band).toBe('good');
    expect(interpretSAVILevel(0.25).band).toBe('fair');
    expect(interpretSAVILevel(0.1).band).toBe('low');
    expect(interpretSAVILevel(null).band).toBe('unknown');
  });
});
