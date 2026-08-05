/**
 * Tests for NDMI early hydric-stress alerts (cocoa) — V2 thresholds + season
 */

import { describe, it, expect } from 'vitest';
import {
  detectNDMIEarlyAlert,
  NDMI_DROP_WATCH,
  NDMI_DROP_ALERT,
  NDMI_THRESHOLDS_CACAO,
  resolveNDMIThresholds,
} from '@/lib/satellite/ndmi-alerts';
import { getCocoaSeason, getCocoaSeasonContext } from '@/lib/satellite/seasonality';
import { combineVegetationAlerts } from '@/lib/satellite/combined-alerts';
import { detectEVIEarlyAlert, EVI_DROP_ALERT } from '@/lib/satellite/evi-alerts';
import { interpretNDMILevel } from '@/lib/satellite/ndmi-levels';

const noSeason = { applySeasonality: false as const, preferMultiMonth: false as const };

describe('detectNDMIEarlyAlert (calibrated, no season)', () => {
  it('detects early dry when NDMI drops and NDVI is stable', () => {
    const alert = detectNDMIEarlyAlert(
      [
        { date: '2024-01-15', ndvi: 0.62, ndmi: 0.25 },
        { date: '2024-02-15', ndvi: 0.61, ndmi: 0.25 - NDMI_DROP_ALERT },
      ],
      noSeason
    );
    expect(alert.level).toBe('alert');
    expect(alert.code).toBe('ndmi_early_dry');
    expect(alert.ndmiChange!).toBeLessThanOrEqual(-NDMI_DROP_ALERT);
  });

  it('uses watch for moderate NDMI drop with stable NDVI', () => {
    const alert = detectNDMIEarlyAlert(
      [
        { date: '2024-01-15', ndvi: 0.6, ndmi: 0.2 },
        { date: '2024-02-15', ndvi: 0.6, ndmi: 0.2 - NDMI_DROP_WATCH - 0.001 },
      ],
      noSeason
    );
    expect(alert.level).toBe('watch');
    expect(alert.code).toBe('ndmi_early_dry');
  });

  it('returns none when both indices stable', () => {
    const alert = detectNDMIEarlyAlert(
      [
        { date: '2024-01-15', ndvi: 0.6, ndmi: 0.2 },
        { date: '2024-02-15', ndvi: 0.61, ndmi: 0.21 },
      ],
      noSeason
    );
    expect(alert.level).toBe('none');
  });

  it('handles missing NDMI series', () => {
    const alert = detectNDMIEarlyAlert(
      [{ date: '2024-01-15', ndvi: 0.6, ndmi: null }],
      noSeason
    );
    expect(alert.level).toBe('none');
    expect(alert.code).toBe('none');
  });

  it('flags low NDMI when below calibrated threshold', () => {
    const alert = detectNDMIEarlyAlert(
      [{ date: '2024-01-15', ndvi: 0.55, ndmi: 0.02 }],
      noSeason
    );
    expect(alert.level).toBe('watch');
    expect(alert.code).toBe('ndmi_low');
    expect(NDMI_THRESHOLDS_CACAO.low).toBe(0.05);
  });
});

describe('seasonality', () => {
  it('maps dry / rainy months', () => {
    expect(getCocoaSeason(1)).toBe('dry');
    expect(getCocoaSeason(7)).toBe('rainy');
    expect(getCocoaSeason(4)).toBe('transition');
  });

  it('raises NDMI drop thresholds in dry season', () => {
    const dry = resolveNDMIThresholds(new Date(Date.UTC(2024, 0, 15))); // Jan
    const rainy = resolveNDMIThresholds(new Date(Date.UTC(2024, 6, 15))); // Jul
    expect(dry.season.season).toBe('dry');
    expect(rainy.season.season).toBe('rainy');
    expect(dry.thresholds.dropWatch).toBeGreaterThan(rainy.thresholds.dropWatch);
  });

  it('is less sensitive to same drop in dry season', () => {
    const series = [
      { date: '2024-01-15', ndvi: 0.6, ndmi: 0.2 },
      { date: '2024-02-15', ndvi: 0.6, ndmi: 0.2 - 0.05 },
    ];
    const dryAlert = detectNDMIEarlyAlert(series, {
      preferMultiMonth: false,
      asOf: new Date('2024-02-15'),
    });
    const rainyAlert = detectNDMIEarlyAlert(
      [
        { date: '2024-06-15', ndvi: 0.6, ndmi: 0.2 },
        { date: '2024-07-15', ndvi: 0.6, ndmi: 0.2 - 0.05 },
      ],
      { preferMultiMonth: false, asOf: new Date('2024-07-15') }
    );
    // -0.05: dry watch threshold ~0.054 → may be none; rainy watch ~0.034 → watch/alert
    expect(levelRank(rainyAlert.level)).toBeGreaterThanOrEqual(
      levelRank(dryAlert.level)
    );
  });
});

function levelRank(l: string): number {
  if (l === 'alert') return 2;
  if (l === 'watch') return 1;
  return 0;
}

describe('combineVegetationAlerts', () => {
  it('flags canopy_and_hydric when both fire', () => {
    const evi = detectEVIEarlyAlert([
      { date: '2024-01-15', ndvi: 0.62, evi: 0.42 },
      { date: '2024-02-15', ndvi: 0.61, evi: 0.42 - EVI_DROP_ALERT },
    ]);
    const ndmi = detectNDMIEarlyAlert(
      [
        { date: '2024-01-15', ndvi: 0.62, ndmi: 0.25 },
        { date: '2024-02-15', ndvi: 0.61, ndmi: 0.25 - NDMI_DROP_ALERT },
      ],
      noSeason
    );
    const combined = combineVegetationAlerts(evi, ndmi);
    expect(combined.code).toBe('canopy_and_hydric');
    expect(combined.visitPriority).toBe('high');
    expect(combined.level).toBe('alert');
  });
});

describe('interpretNDMILevel', () => {
  it('bands moisture OK / watch / dry', () => {
    expect(interpretNDMILevel(0.2).band).toBe('ok');
    expect(interpretNDMILevel(0.08).band).toBe('watch');
    expect(interpretNDMILevel(0.01).band).toBe('dry');
  });
});

describe('getCocoaSeasonContext', () => {
  it('returns french label', () => {
    expect(getCocoaSeasonContext(new Date('2024-01-10')).labelFr).toMatch(
      /sèche/i
    );
  });
});
