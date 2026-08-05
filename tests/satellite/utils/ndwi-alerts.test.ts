/**
 * Tests for NDWI surface-wetness early alerts (McFeeters)
 */

import { describe, it, expect } from 'vitest';
import {
  detectNDWIEarlyAlert,
  NDWI_RISE_WATCH,
  NDWI_RISE_ALERT,
  NDWI_HIGH_THRESHOLD,
} from '@/lib/satellite/ndwi-alerts';
import { interpretNDWILevel } from '@/lib/satellite/ndwi-levels';

describe('detectNDWIEarlyAlert', () => {
  it('detects early wet when NDWI rises and NDVI is stable', () => {
    const alert = detectNDWIEarlyAlert([
      { date: '2024-01-15', ndvi: 0.62, ndwi: 0.0 },
      { date: '2024-02-15', ndvi: 0.61, ndwi: NDWI_RISE_ALERT },
    ]);
    expect(alert.level).toBe('alert');
    expect(alert.code).toBe('ndwi_early_wet');
    expect(alert.ndwiChange!).toBeGreaterThanOrEqual(NDWI_RISE_ALERT);
  });

  it('uses watch for moderate NDWI rise with stable NDVI', () => {
    const alert = detectNDWIEarlyAlert([
      { date: '2024-01-15', ndvi: 0.6, ndwi: 0.0 },
      { date: '2024-02-15', ndvi: 0.6, ndwi: NDWI_RISE_WATCH + 0.001 },
    ]);
    expect(alert.level).toBe('watch');
    expect(alert.code).toBe('ndwi_early_wet');
  });

  it('returns none when both indices stable', () => {
    const alert = detectNDWIEarlyAlert([
      { date: '2024-01-15', ndvi: 0.6, ndwi: -0.05 },
      { date: '2024-02-15', ndvi: 0.61, ndwi: -0.04 },
    ]);
    expect(alert.level).toBe('none');
  });

  it('handles missing NDWI series', () => {
    const alert = detectNDWIEarlyAlert([
      { date: '2024-01-15', ndvi: 0.6, ndwi: null },
    ]);
    expect(alert.level).toBe('none');
    expect(alert.code).toBe('none');
  });

  it('flags high NDWI when above threshold', () => {
    const alert = detectNDWIEarlyAlert([
      { date: '2024-01-15', ndvi: 0.55, ndwi: NDWI_HIGH_THRESHOLD + 0.05 },
    ]);
    expect(alert.level).toBe('watch');
    expect(alert.code).toBe('ndwi_high');
  });
});

describe('interpretNDWILevel', () => {
  it('maps water / wet / normal / dry bands', () => {
    expect(interpretNDWILevel(0.25).band).toBe('water');
    expect(interpretNDWILevel(0.08).band).toBe('wet');
    expect(interpretNDWILevel(0.0).band).toBe('normal');
    expect(interpretNDWILevel(-0.2).band).toBe('dry');
    expect(interpretNDWILevel(null).band).toBe('unknown');
  });
});
