/**
 * Tests — visit priority, SAVI plantation gate, NDMI calibration, index legend
 */

import { describe, expect, it } from 'vitest';
import { shouldShowSavi } from '@/lib/satellite/savi-context';
import { detectSAVIEarlyAlert } from '@/lib/satellite/savi-alerts';
import { calibrateNdmiThresholdsFromFeedback } from '@/lib/satellite/ndmi-calibration';
import { applyRegionalNdmiThresholds } from '@/lib/satellite/regional-thresholds';
import { NDMI_THRESHOLDS_CACAO } from '@/lib/satellite/ndmi-alerts';
import { buildIndexLegendSentence, isIndexUnreliable } from '@/lib/satellite/index-legend';
import { computeVisitPriority } from '@/lib/satellite/visit-priority';
import { combineVegetationAlerts } from '@/lib/satellite/combined-alerts';
import { calculatePixelNDRE } from '@/lib/satellite/ndre';
import { compareEviToVillage } from '@/lib/satellite/village-index';

describe('shouldShowSavi plantation gate', () => {
  it('shows SAVI for young stands even with high NDVI', () => {
    const year = new Date().getFullYear() - 3;
    expect(
      shouldShowSavi({
        meanNdvi: 0.7,
        meanEvi: 0.5,
        anneePlantation: year,
      })
    ).toBe(true);
  });

  it('shows SAVI for low density', () => {
    expect(
      shouldShowSavi({
        meanNdvi: 0.7,
        meanEvi: 0.5,
        densiteArbresHa: 500,
      })
    ).toBe(true);
  });

  it('hides SAVI on mature dense when NDVI high', () => {
    expect(
      shouldShowSavi({
        meanNdvi: 0.7,
        meanEvi: 0.5,
        anneePlantation: 2005,
        densiteArbresHa: 1200,
      })
    ).toBe(false);
  });
});

describe('detectSAVIEarlyAlert', () => {
  it('returns none when not relevant', () => {
    const alert = detectSAVIEarlyAlert(
      [{ date: '2026-01-01', savi: 0.1 }],
      { meanNdvi: 0.7, meanEvi: 0.5 }
    );
    expect(alert.level).toBe('none');
  });

  it('alerts on very low SAVI for young stand', () => {
    const year = new Date().getFullYear() - 2;
    const alert = detectSAVIEarlyAlert(
      [
        { date: '2026-01-01', savi: 0.25 },
        { date: '2026-02-01', savi: 0.15 },
      ],
      { meanNdvi: 0.4, anneePlantation: year }
    );
    expect(alert.level).toBe('alert');
  });
});

describe('NDMI calibration + regional', () => {
  it('raises thresholds when false positives dominate', () => {
    const cal = calibrateNdmiThresholdsFromFeedback(NDMI_THRESHOLDS_CACAO, {
      confirmed: 1,
      falsePositive: 8,
      unsure: 1,
    });
    expect(cal.dropWatch).toBeGreaterThan(NDMI_THRESHOLDS_CACAO.dropWatch);
  });

  it('tweaks by elevation', () => {
    const high = applyRegionalNdmiThresholds(NDMI_THRESHOLDS_CACAO, {
      elevationMeters: 900,
    });
    expect(high.dropWatch).toBeLessThan(NDMI_THRESHOLDS_CACAO.dropWatch);
  });
});

describe('index legend + quality', () => {
  it('warns when imagery degraded', () => {
    const s = buildIndexLegendSentence({
      meanNdvi: 0.6,
      meanEvi: 0.4,
      meanNdmi: 0.2,
      meanNdwi: 0,
      meanSavi: null,
      imageryQuality: 'degraded',
    });
    expect(s).toMatch(/nuageuse|dégrad/i);
    expect(isIndexUnreliable('degraded')).toBe(true);
  });
});

describe('visit priority', () => {
  it('ranks dual EVI+NDMI high', () => {
    const evi = {
      level: 'alert' as const,
      code: 'evi_drop' as const,
      messageFr: 'evi',
      messageEn: 'evi',
      eviChange: -0.1,
      ndviChange: 0,
      ndviEviGap: 0.1,
      windowMonths: 1,
    };
    const ndmi = {
      level: 'alert' as const,
      code: 'ndmi_drop' as const,
      messageFr: 'ndmi',
      messageEn: 'ndmi',
      ndmiChange: -0.1,
      ndviChange: 0,
      windowMonths: 1,
    };
    const combined = combineVegetationAlerts(evi, ndmi);
    const visit = computeVisitPriority({
      combined,
      ndwiAlert: {
        level: 'none',
        code: 'none',
        messageFr: '',
        messageEn: '',
        ndwiChange: null,
        ndviChange: null,
        windowMonths: 0,
      },
    });
    expect(visit.rank).toBe('high');
    expect(visit.score).toBeGreaterThanOrEqual(50);
  });
});

describe('NDRE formula', () => {
  it('computes (nir-re)/(nir+re)', () => {
    // reflectance 0–1 style
    expect(calculatePixelNDRE(0.4, 0.2)).toBeCloseTo(0.3333, 3);
  });
});

describe('village EVI compare', () => {
  it('flags below median', () => {
    const c = compareEviToVillage(0.25, 'TestVillage', [0.4, 0.42, 0.38, 0.41]);
    expect(c?.band).toBe('below');
  });
});
