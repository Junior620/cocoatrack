/**
 * Tests for NDVI/EVI curve interpretation (cocoa)
 */

import { describe, it, expect } from 'vitest';
import { interpretNdviEviCurves } from '@/lib/satellite/curve-interpretation';

describe('interpretNdviEviCurves', () => {
  it('flags incomplete when no EVI', () => {
    const r = interpretNdviEviCurves([
      { date: '2024-01-01', ndvi: 0.6, evi: null },
      { date: '2024-02-01', ndvi: 0.61, evi: null },
    ]);
    expect(r.verdict).toBe('incomplete');
    expect(r.title).toMatch(/partielle|NDVI/i);
  });

  it('detects early stress when EVI drops and NDVI flat', () => {
    const r = interpretNdviEviCurves([
      { date: '2024-01-01', ndvi: 0.62, evi: 0.42 },
      { date: '2024-02-01', ndvi: 0.61, evi: 0.32 },
    ]);
    expect(['watch', 'stress']).toContain(r.verdict);
    expect(r.bullets.some((b) => /EVI/i.test(b))).toBe(true);
  });

  it('reports healthy when both indices stable and good', () => {
    const r = interpretNdviEviCurves([
      { date: '2024-01-01', ndvi: 0.6, evi: 0.4 },
      { date: '2024-02-01', ndvi: 0.61, evi: 0.41 },
      { date: '2024-03-01', ndvi: 0.62, evi: 0.42 },
    ]);
    expect(['healthy', 'recovering']).toContain(r.verdict);
    expect(r.howToRead.length).toBeGreaterThan(2);
    expect(r.recommendation.length).toBeGreaterThan(10);
    expect(r.agentActions.length).toBeGreaterThan(0);
    expect(r.gapHint.length).toBeGreaterThan(5);
  });

  it('provides field-agent actions on stress', () => {
    const r = interpretNdviEviCurves([
      { date: '2024-01-01', ndvi: 0.62, evi: 0.42 },
      { date: '2024-02-01', ndvi: 0.61, evi: 0.28 },
    ]);
    expect(r.agentActions.some((a) => /terrain|Visite|hydrique/i.test(a))).toBe(
      true
    );
  });

  it('exposes ndmiAlert and detects early dry', () => {
    const r = interpretNdviEviCurves([
      { date: '2024-06-01', ndvi: 0.62, evi: 0.4, ndmi: 0.25 },
      { date: '2024-07-01', ndvi: 0.61, evi: 0.39, ndmi: 0.15 },
    ]);
    expect(r.ndmiAlert).toBeDefined();
    expect(r.ndmiAlert.code).toBe('ndmi_early_dry');
    expect(r.combinedAlert).toBeDefined();
    expect(r.bullets.some((b) => /NDMI|humidité|hydrique/i.test(b))).toBe(true);
  });

  it('raises dual canopy+hydric when both drop', () => {
    const r = interpretNdviEviCurves([
      { date: '2024-06-01', ndvi: 0.62, evi: 0.42, ndmi: 0.25 },
      { date: '2024-07-01', ndvi: 0.61, evi: 0.3, ndmi: 0.12 },
    ]);
    expect(r.combinedAlert.code).toBe('canopy_and_hydric');
    expect(r.verdict).toBe('stress');
  });
});
