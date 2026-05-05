/**
 * Unit tests for NDVI color mapping utility
 */

import { describe, it, expect } from 'vitest';
import {
  ndviToRGB,
  ndviToRGBA,
  rgbToString,
  rgbaToString,
  rgbToHex,
  ndviToColorString,
  getColorStops,
  getNDVIGradient,
  type RGBColor,
  type RGBAColor,
} from '@/lib/satellite/utils/ndvi-colors';

describe('ndviToRGB', () => {
  it('should map NDVI 0.0 to brown (very poor vegetation)', () => {
    const color = ndviToRGB(0.0);
    expect(color).toEqual({ r: 165, g: 42, b: 42 });
  });

  it('should map NDVI 0.2 to orange (poor vegetation)', () => {
    const color = ndviToRGB(0.2);
    expect(color).toEqual({ r: 230, g: 97, b: 0 });
  });

  it('should map NDVI 0.4 to yellow (moderate vegetation)', () => {
    const color = ndviToRGB(0.4);
    expect(color).toEqual({ r: 255, g: 193, b: 7 });
  });

  it('should map NDVI 0.6 to light green (good vegetation)', () => {
    const color = ndviToRGB(0.6);
    expect(color).toEqual({ r: 146, g: 208, b: 80 });
  });

  it('should map NDVI 0.8 to green (very good vegetation)', () => {
    const color = ndviToRGB(0.8);
    expect(color).toEqual({ r: 56, g: 168, b: 0 });
  });

  it('should map NDVI 1.0 to dark green (excellent vegetation)', () => {
    const color = ndviToRGB(1.0);
    expect(color).toEqual({ r: 34, g: 139, b: 34 });
  });

  it('should interpolate between color stops', () => {
    // Test midpoint between 0.6 (light green) and 0.8 (green)
    const color = ndviToRGB(0.7);
    
    // Expected: average of light green (146, 208, 80) and green (56, 168, 0)
    expect(color.r).toBe(101); // (146 + 56) / 2
    expect(color.g).toBe(188); // (208 + 168) / 2
    expect(color.b).toBe(40);  // (80 + 0) / 2
  });

  it('should handle negative NDVI values (water, bare soil)', () => {
    const color = ndviToRGB(-0.5);
    // Should map to brown (first color stop)
    expect(color).toEqual({ r: 165, g: 42, b: 42 });
  });

  it('should clamp NDVI values above 1.0', () => {
    const color = ndviToRGB(1.5);
    // Should map to dark green (last color stop)
    expect(color).toEqual({ r: 34, g: 139, b: 34 });
  });

  it('should clamp NDVI values below -1.0', () => {
    const color = ndviToRGB(-2.0);
    // Should map to brown (first color stop)
    expect(color).toEqual({ r: 165, g: 42, b: 42 });
  });

  it('should return RGB values in valid range [0, 255]', () => {
    const testValues = [-1, -0.5, 0, 0.25, 0.5, 0.75, 1, 1.5];
    
    testValues.forEach(ndvi => {
      const color = ndviToRGB(ndvi);
      expect(color.r).toBeGreaterThanOrEqual(0);
      expect(color.r).toBeLessThanOrEqual(255);
      expect(color.g).toBeGreaterThanOrEqual(0);
      expect(color.g).toBeLessThanOrEqual(255);
      expect(color.b).toBeGreaterThanOrEqual(0);
      expect(color.b).toBeLessThanOrEqual(255);
    });
  });

  it('should produce consistent colors for same NDVI value', () => {
    const color1 = ndviToRGB(0.75);
    const color2 = ndviToRGB(0.75);
    expect(color1).toEqual(color2);
  });
});

describe('ndviToRGBA', () => {
  it('should add alpha channel with default opacity 1.0', () => {
    const color = ndviToRGBA(0.5);
    expect(color.a).toBe(1.0);
    expect(color.r).toBeDefined();
    expect(color.g).toBeDefined();
    expect(color.b).toBeDefined();
  });

  it('should add alpha channel with custom opacity', () => {
    const color = ndviToRGBA(0.5, 0.7);
    expect(color.a).toBe(0.7);
  });

  it('should clamp alpha to [0, 1] range', () => {
    const color1 = ndviToRGBA(0.5, -0.5);
    expect(color1.a).toBe(0);

    const color2 = ndviToRGBA(0.5, 1.5);
    expect(color2.a).toBe(1);
  });

  it('should preserve RGB values from ndviToRGB', () => {
    const rgb = ndviToRGB(0.75);
    const rgba = ndviToRGBA(0.75, 0.8);
    
    expect(rgba.r).toBe(rgb.r);
    expect(rgba.g).toBe(rgb.g);
    expect(rgba.b).toBe(rgb.b);
  });
});

describe('rgbToString', () => {
  it('should convert RGB to CSS rgb() string', () => {
    const color: RGBColor = { r: 255, g: 128, b: 64 };
    expect(rgbToString(color)).toBe('rgb(255, 128, 64)');
  });

  it('should handle edge case values', () => {
    const color1: RGBColor = { r: 0, g: 0, b: 0 };
    expect(rgbToString(color1)).toBe('rgb(0, 0, 0)');

    const color2: RGBColor = { r: 255, g: 255, b: 255 };
    expect(rgbToString(color2)).toBe('rgb(255, 255, 255)');
  });
});

describe('rgbaToString', () => {
  it('should convert RGBA to CSS rgba() string', () => {
    const color: RGBAColor = { r: 255, g: 128, b: 64, a: 0.5 };
    expect(rgbaToString(color)).toBe('rgba(255, 128, 64, 0.5)');
  });

  it('should handle alpha values', () => {
    const color1: RGBAColor = { r: 100, g: 150, b: 200, a: 0 };
    expect(rgbaToString(color1)).toBe('rgba(100, 150, 200, 0)');

    const color2: RGBAColor = { r: 100, g: 150, b: 200, a: 1 };
    expect(rgbaToString(color2)).toBe('rgba(100, 150, 200, 1)');
  });
});

describe('rgbToHex', () => {
  it('should convert RGB to hexadecimal string', () => {
    const color: RGBColor = { r: 255, g: 128, b: 64 };
    expect(rgbToHex(color)).toBe('#ff8040');
  });

  it('should handle single-digit hex values with leading zero', () => {
    const color: RGBColor = { r: 15, g: 8, b: 3 };
    expect(rgbToHex(color)).toBe('#0f0803');
  });

  it('should handle edge cases', () => {
    const black: RGBColor = { r: 0, g: 0, b: 0 };
    expect(rgbToHex(black)).toBe('#000000');

    const white: RGBColor = { r: 255, g: 255, b: 255 };
    expect(rgbToHex(white)).toBe('#ffffff');
  });

  it('should produce lowercase hex strings', () => {
    const color: RGBColor = { r: 170, g: 187, b: 204 };
    const hex = rgbToHex(color);
    expect(hex).toBe(hex.toLowerCase());
  });
});

describe('ndviToColorString', () => {
  it('should return hex format by default', () => {
    const color = ndviToColorString(0.5);
    expect(color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('should return rgb format when specified', () => {
    const color = ndviToColorString(0.5, 'rgb');
    expect(color).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
  });

  it('should return rgba format when specified', () => {
    const color = ndviToColorString(0.5, 'rgba', 0.8);
    expect(color).toMatch(/^rgba\(\d+, \d+, \d+, 0\.8\)$/);
  });

  it('should use default alpha of 1.0 for rgba', () => {
    const color = ndviToColorString(0.5, 'rgba');
    expect(color).toMatch(/^rgba\(\d+, \d+, \d+, 1\)$/);
  });

  it('should produce consistent output for same inputs', () => {
    const color1 = ndviToColorString(0.75, 'hex');
    const color2 = ndviToColorString(0.75, 'hex');
    expect(color1).toBe(color2);
  });
});

describe('getColorStops', () => {
  it('should return 6 color stops', () => {
    const stops = getColorStops();
    expect(stops).toHaveLength(6);
  });

  it('should have correct threshold values', () => {
    const stops = getColorStops();
    expect(stops[0].threshold).toBe(0.0);
    expect(stops[1].threshold).toBe(0.2);
    expect(stops[2].threshold).toBe(0.4);
    expect(stops[3].threshold).toBe(0.6);
    expect(stops[4].threshold).toBe(0.8);
    expect(stops[5].threshold).toBe(1.0);
  });

  it('should have labels for each stop', () => {
    const stops = getColorStops();
    stops.forEach(stop => {
      expect(stop.label).toBeDefined();
      expect(typeof stop.label).toBe('string');
      expect(stop.label.length).toBeGreaterThan(0);
    });
  });

  it('should have valid RGB colors for each stop', () => {
    const stops = getColorStops();
    stops.forEach(stop => {
      expect(stop.color.r).toBeGreaterThanOrEqual(0);
      expect(stop.color.r).toBeLessThanOrEqual(255);
      expect(stop.color.g).toBeGreaterThanOrEqual(0);
      expect(stop.color.g).toBeLessThanOrEqual(255);
      expect(stop.color.b).toBeGreaterThanOrEqual(0);
      expect(stop.color.b).toBeLessThanOrEqual(255);
    });
  });

  it('should return readonly array', () => {
    const stops = getColorStops();
    // TypeScript will enforce readonly at compile time
    expect(Array.isArray(stops)).toBe(true);
  });
});

describe('getNDVIGradient', () => {
  it('should return CSS linear-gradient string', () => {
    const gradient = getNDVIGradient();
    expect(gradient).toMatch(/^linear-gradient\(to right, #[0-9a-f]{6} \d+%, .+\)$/);
  });

  it('should use default direction "to right"', () => {
    const gradient = getNDVIGradient();
    expect(gradient).toContain('to right');
  });

  it('should accept custom direction', () => {
    const gradient = getNDVIGradient('to bottom');
    expect(gradient).toContain('to bottom');
  });

  it('should include all color stops', () => {
    const gradient = getNDVIGradient();
    // Should have 6 color stops (0%, 20%, 40%, 60%, 80%, 100%)
    const percentages = gradient.match(/\d+%/g);
    expect(percentages).toHaveLength(6);
  });

  it('should have correct percentage values', () => {
    const gradient = getNDVIGradient();
    expect(gradient).toContain('0%');
    expect(gradient).toContain('20%');
    expect(gradient).toContain('40%');
    expect(gradient).toContain('60%');
    expect(gradient).toContain('80%');
    expect(gradient).toContain('100%');
  });
});

describe('Color-blind friendliness', () => {
  it('should use distinct colors for each range', () => {
    const colors = [
      ndviToRGB(0.1),  // Brown/Orange range
      ndviToRGB(0.3),  // Orange/Yellow range
      ndviToRGB(0.5),  // Yellow/Light green range
      ndviToRGB(0.7),  // Light green/Green range
      ndviToRGB(0.9),  // Green/Dark green range
    ];

    // Check that colors are sufficiently different
    // (simple check: at least one channel differs by > 50)
    for (let i = 0; i < colors.length - 1; i++) {
      const diff = Math.max(
        Math.abs(colors[i].r - colors[i + 1].r),
        Math.abs(colors[i].g - colors[i + 1].g),
        Math.abs(colors[i].b - colors[i + 1].b)
      );
      expect(diff).toBeGreaterThan(50);
    }
  });
});

describe('Edge cases and error handling', () => {
  it('should handle NaN gracefully', () => {
    const color = ndviToRGB(NaN);
    // NaN should be clamped to -1 (minimum)
    expect(color).toEqual({ r: 165, g: 42, b: 42 });
  });

  it('should handle Infinity gracefully', () => {
    const color1 = ndviToRGB(Infinity);
    expect(color1).toEqual({ r: 34, g: 139, b: 34 }); // Clamped to 1.0

    const color2 = ndviToRGB(-Infinity);
    expect(color2).toEqual({ r: 165, g: 42, b: 42 }); // Clamped to -1.0
  });

  it('should handle very small differences in NDVI', () => {
    const color1 = ndviToRGB(0.5);
    const color2 = ndviToRGB(0.5000001);
    
    // Colors should be very similar (within 1 unit per channel)
    expect(Math.abs(color1.r - color2.r)).toBeLessThanOrEqual(1);
    expect(Math.abs(color1.g - color2.g)).toBeLessThanOrEqual(1);
    expect(Math.abs(color1.b - color2.b)).toBeLessThanOrEqual(1);
  });
});
