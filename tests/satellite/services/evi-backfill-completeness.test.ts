/**
 * Unit tests: month completeness for EVI backfill + batch helpers.
 */

import { describe, it, expect } from 'vitest';
import {
  isMonthCompleteWithEvi,
  getBatchHealthStatus,
  classifyImageryQuality,
  geeMonthWindow,
  CLOUD_COVER_MAX,
  CLOUD_COVER_FALLBACK,
} from '@/lib/satellite/services/ndvi-batch.service';
import { buildMonthlyTargets } from '@/lib/satellite/jobs/evi-backfill.job';
import { interpretNdviEviGap, NDVI_EVI_GAP_TIERS } from '@/lib/satellite/evi-alerts';

describe('EVI+NDMI+NDWI+SAVI backfill completeness', () => {
  it('treats NDVI-only legacy rows as incomplete', () => {
    expect(
      isMonthCompleteWithEvi([
        {
          acquisition_date: '2024-06-10',
          mean_evi: null,
          mean_ndmi: null,
          mean_ndwi: null,
          mean_savi: null,
        },
      ])
    ).toBe(false);
  });

  it('treats EVI without NDMI as incomplete', () => {
    expect(
      isMonthCompleteWithEvi([
        {
          acquisition_date: '2024-06-10',
          mean_evi: 0.35,
          mean_ndmi: null,
          mean_ndwi: 0.01,
          mean_savi: 0.2,
        },
      ])
    ).toBe(false);
  });

  it('treats EVI+NDMI without NDWI as incomplete', () => {
    expect(
      isMonthCompleteWithEvi([
        {
          acquisition_date: '2024-06-10',
          mean_evi: 0.35,
          mean_ndmi: 0.12,
          mean_ndwi: null,
          mean_savi: 0.2,
        },
      ])
    ).toBe(false);
  });

  it('treats EVI+NDMI+NDWI without SAVI as incomplete', () => {
    expect(
      isMonthCompleteWithEvi([
        {
          acquisition_date: '2024-06-10',
          mean_evi: 0.35,
          mean_ndmi: 0.12,
          mean_ndwi: -0.05,
          mean_savi: null,
        },
      ])
    ).toBe(false);
  });

  it('treats month complete when at least one row has EVI, NDMI, NDWI and SAVI', () => {
    expect(
      isMonthCompleteWithEvi([
        {
          acquisition_date: null,
          mean_evi: null,
          mean_ndmi: null,
          mean_ndwi: null,
          mean_savi: null,
        },
        {
          acquisition_date: '2024-06-10',
          mean_evi: 0.35,
          mean_ndmi: 0.12,
          mean_ndwi: -0.05,
          mean_savi: 0.22,
        },
      ])
    ).toBe(true);
  });

  it('treats full indices without acquisition as complete (after sibling repair)', () => {
    expect(
      isMonthCompleteWithEvi([
        {
          acquisition_date: null,
          mean_evi: 0.35,
          mean_ndmi: 0.1,
          mean_ndwi: -0.02,
          mean_savi: 0.2,
        },
      ])
    ).toBe(true);
  });
});

describe('getBatchHealthStatus (DB check constraint)', () => {
  it('never returns moderate — only fair/good/excellent/poor/critical', () => {
    const allowed = new Set(['excellent', 'good', 'fair', 'poor', 'critical']);
    for (const ndvi of [-0.1, 0, 0.2, 0.35, 0.5, 0.6, 0.7, 0.9]) {
      expect(allowed.has(getBatchHealthStatus(ndvi))).toBe(true);
    }
  });

  it('maps mid-range NDVI to fair (not moderate)', () => {
    expect(getBatchHealthStatus(0.5)).toBe('fair');
    expect(getBatchHealthStatus(0.27)).toBe('critical');
  });
});

describe('GEE UTC month windows', () => {
  it('uses exclusive end on 1st of next month (UTC)', () => {
    // Local July 31 noon UTC construction via Date.UTC
    const july = new Date(Date.UTC(2026, 7, 0, 12)); // last day of July
    const { startISO, endISO } = geeMonthWindow(july);
    expect(startISO).toBe('2026-07-01');
    expect(endISO).toBe('2026-08-01');
  });

  it('buildMonthlyTargets aligns with calendar months', () => {
    const now = new Date(Date.UTC(2026, 7, 5)); // Aug 5 2026
    const dates = buildMonthlyTargets(3, now);
    expect(dates).toHaveLength(3);
    expect(dates[0].getUTCMonth()).toBe(7); // August
    expect(dates[1].getUTCMonth()).toBe(6); // July
    expect(dates[2].getUTCMonth()).toBe(5); // June
  });
});

describe('imagery quality from cloud cover', () => {
  it('classifies good / acceptable / degraded', () => {
    expect(classifyImageryQuality(40, false)).toBe('good');
    expect(classifyImageryQuality(85, true)).toBe('acceptable');
    expect(classifyImageryQuality(96, true)).toBe('degraded');
    expect(CLOUD_COVER_MAX).toBe(80);
    expect(CLOUD_COVER_FALLBACK).toBe(95);
  });
});

describe('NDVI−EVI gap tiers', () => {
  it('exposes dense / bare tiers for legend', () => {
    expect(interpretNdviEviGap(0.2).key).toBe('dense');
    expect(interpretNdviEviGap(0.01).key).toBe('bare_or_stress');
    expect(NDVI_EVI_GAP_TIERS.length).toBeGreaterThanOrEqual(4);
  });
});
