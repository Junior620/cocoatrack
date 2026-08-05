/**
 * Tests for EVI early-warning alerts (cocoa)
 */

import { describe, it, expect } from 'vitest';
import {
  detectEVIEarlyAlert,
  calculateNdviEviGap,
  interpretNdviEviGap,
  EVI_DROP_WATCH,
  EVI_DROP_ALERT,
  NDVI_EVI_GAP_DENSE,
} from '@/lib/satellite/evi-alerts';

describe('calculateNdviEviGap', () => {
  it('returns NDVI − EVI', () => {
    expect(calculateNdviEviGap(0.7, 0.45)).toBeCloseTo(0.25);
  });

  it('returns null when EVI missing', () => {
    expect(calculateNdviEviGap(0.7, null)).toBeNull();
  });
});

describe('interpretNdviEviGap', () => {
  it('flags dense canopy', () => {
    expect(interpretNdviEviGap(NDVI_EVI_GAP_DENSE).labelFr).toMatch(/dense/i);
  });
});

describe('detectEVIEarlyAlert', () => {
  it('detects early stress when EVI drops and NDVI is stable', () => {
    const alert = detectEVIEarlyAlert([
      { date: '2024-01-15', ndvi: 0.62, evi: 0.42 },
      { date: '2024-02-15', ndvi: 0.61, evi: 0.42 - EVI_DROP_ALERT },
    ]);
    expect(alert.level).toBe('alert');
    expect(alert.code).toBe('evi_early_stress');
    expect(alert.eviChange!).toBeLessThanOrEqual(-EVI_DROP_ALERT);
  });

  it('uses watch for moderate EVI drop with stable NDVI', () => {
    const alert = detectEVIEarlyAlert([
      { date: '2024-01-15', ndvi: 0.6, evi: 0.4 },
      { date: '2024-02-15', ndvi: 0.6, evi: 0.4 - EVI_DROP_WATCH - 0.001 },
    ]);
    expect(alert.level).toBe('watch');
    expect(alert.code).toBe('evi_early_stress');
  });

  it('returns none when both indices stable', () => {
    const alert = detectEVIEarlyAlert([
      { date: '2024-01-15', ndvi: 0.6, evi: 0.4 },
      { date: '2024-02-15', ndvi: 0.61, evi: 0.41 },
    ]);
    expect(alert.level).toBe('none');
  });

  it('handles missing EVI series', () => {
    const alert = detectEVIEarlyAlert([
      { date: '2024-01-15', ndvi: 0.6, evi: null },
    ]);
    expect(alert.level).toBe('none');
    expect(alert.code).toBe('none');
  });
});
