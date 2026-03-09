// CocoaTrack V2 - Planteur Duplicate Detector Tests
// Unit tests for duplicate detection service

import { describe, it, expect } from 'vitest';

import { normalizePlanteurName } from '../planteur-duplicate-detector';

describe('normalizePlanteurName', () => {
  it('should normalize basic names', () => {
    expect(normalizePlanteurName('Konan Yao')).toBe('konan yao');
    expect(normalizePlanteurName('KONAN YAO')).toBe('konan yao');
    expect(normalizePlanteurName('konan yao')).toBe('konan yao');
  });

  it('should trim whitespace', () => {
    expect(normalizePlanteurName('  Konan Yao  ')).toBe('konan yao');
    expect(normalizePlanteurName('Konan  Yao')).toBe('konan yao');
    expect(normalizePlanteurName('  Konan   Yao  ')).toBe('konan yao');
  });

  it('should handle empty and null inputs', () => {
    expect(normalizePlanteurName('')).toBe('');
    expect(normalizePlanteurName('   ')).toBe('');
    expect(normalizePlanteurName(null)).toBe('');
    expect(normalizePlanteurName(undefined)).toBe('');
  });

  it('should collapse multiple spaces', () => {
    expect(normalizePlanteurName('Konan    Yao')).toBe('konan yao');
    expect(normalizePlanteurName('Konan     Bi     Tra')).toBe('konan bi tra');
  });

  it('should handle single word names', () => {
    expect(normalizePlanteurName('Konan')).toBe('konan');
    expect(normalizePlanteurName('KONAN')).toBe('konan');
  });

  it('should handle names with special characters', () => {
    // Note: Client-side normalization doesn't remove accents
    // The database function handles that
    expect(normalizePlanteurName('Kônàn Yâô')).toBe('kônàn yâô');
    expect(normalizePlanteurName("N'Guessan")).toBe("n'guessan");
  });
});
