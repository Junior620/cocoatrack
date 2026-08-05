/**
 * Rainfall context classification (CHIRPS / season fallback)
 */

import { describe, it, expect } from 'vitest';
import {
  classifyRainBand,
  buildRainfallContext,
  RAIN_30D_DRY_MAX_MM,
  RAIN_30D_WET_MIN_MM,
} from '@/lib/satellite/rainfall';

describe('classifyRainBand', () => {
  it('classifies dry / normal / wet', () => {
    expect(classifyRainBand(10)).toBe('dry');
    expect(classifyRainBand(RAIN_30D_DRY_MAX_MM)).toBe('normal');
    expect(classifyRainBand(RAIN_30D_WET_MIN_MM)).toBe('wet');
  });
});

describe('buildRainfallContext', () => {
  it('falls back to season_only', () => {
    const ctx = buildRainfallContext(null, 'season_only', 30, new Date('2024-01-15'));
    expect(ctx.source).toBe('season_only');
    expect(ctx.season.season).toBe('dry');
    expect(ctx.ndmiInterpretationFr.length).toBeGreaterThan(10);
  });

  it('interprets dry chirps with hydric coherence', () => {
    const ctx = buildRainfallContext(20, 'chirps', 30, new Date('2024-07-15'));
    expect(ctx.band).toBe('dry');
    expect(ctx.ndmiInterpretationFr).toMatch(/stress hydrique|cohérente/i);
  });
});
