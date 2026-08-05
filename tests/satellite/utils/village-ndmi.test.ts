/**
 * Village NDMI comparison helper
 */

import { describe, it, expect } from 'vitest';
import { compareNdmiToVillage } from '@/lib/satellite/village-ndmi';

describe('compareNdmiToVillage', () => {
  it('returns null without village', () => {
    expect(compareNdmiToVillage(0.2, null, [0.1, 0.2])).toBeNull();
  });

  it('flags insufficient sample', () => {
    const r = compareNdmiToVillage(0.2, 'Akak', [0.18]);
    expect(r!.band).toBe('insufficient');
  });

  it('detects below village median', () => {
    const r = compareNdmiToVillage(0.1, 'Akak', [0.1, 0.2, 0.22, 0.24]);
    expect(r!.band).toBe('below');
    expect(r!.labelFr).toMatch(/sec/i);
    expect(r!.villageMedianNDMI).not.toBeNull();
  });

  it('detects similar to median', () => {
    const r = compareNdmiToVillage(0.2, 'Akak', [0.18, 0.2, 0.22]);
    expect(r!.band).toBe('similar');
  });
});
