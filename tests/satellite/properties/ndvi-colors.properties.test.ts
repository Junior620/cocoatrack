/**
 * Property-Based Tests for NDVI Color Mapping
 * 
 * This file implements property-based testing for NDVI color mapping logic using fast-check.
 * Property-based testing validates that certain properties hold true across a wide range
 * of randomly generated inputs, providing stronger correctness guarantees than example-based tests.
 * 
 * Properties tested:
 * - Property 3: NDVI color mapping correctness
 * 
 * Requirements: Task 2.3.6
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
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

// ============================================================================
// Test Configuration
// ============================================================================

/**
 * Number of iterations for property-based tests
 * Higher values provide stronger guarantees but take longer to run
 */
const NUM_RUNS = 100;

/**
 * Epsilon for floating-point comparisons
 * Accounts for floating-point arithmetic precision issues
 */
const EPSILON = 1e-10;

/**
 * NDVI color thresholds as defined in the design document
 */
const COLOR_RANGES = [
  { min: -1.0, max: 0.0, label: 'Very Poor', colorName: 'brown' },
  { min: 0.0, max: 0.2, label: 'Very Poor', colorName: 'brown' },
  { min: 0.2, max: 0.4, label: 'Poor', colorName: 'orange' },
  { min: 0.4, max: 0.6, label: 'Moderate', colorName: 'yellow' },
  { min: 0.6, max: 0.8, label: 'Good', colorName: 'light green' },
  { min: 0.8, max: 1.0, label: 'Very Good/Excellent', colorName: 'green/dark green' },
] as const;

/**
 * Expected RGB color stops from the implementation
 */
const EXPECTED_COLOR_STOPS = [
  { threshold: 0.0, color: { r: 165, g: 42, b: 42 } },    // Brown
  { threshold: 0.2, color: { r: 230, g: 97, b: 0 } },     // Orange
  { threshold: 0.4, color: { r: 255, g: 193, b: 7 } },    // Yellow
  { threshold: 0.6, color: { r: 146, g: 208, b: 80 } },   // Light green
  { threshold: 0.8, color: { r: 56, g: 168, b: 0 } },     // Green
  { threshold: 1.0, color: { r: 34, g: 139, b: 34 } },    // Dark green
] as const;

// ============================================================================
// Custom Arbitraries
// ============================================================================

/**
 * Arbitrary for generating valid NDVI values in range [-1, 1]
 */
const ndviValueArbitrary = fc.double({ min: -1, max: 1, noNaN: true });

/**
 * Arbitrary for generating NDVI values including edge cases
 */
const ndviWithEdgeCasesArbitrary = fc.oneof(
  ndviValueArbitrary,
  fc.constantFrom(-1.0, 0.0, 0.2, 0.4, 0.6, 0.8, 1.0), // Exact thresholds
  fc.constant(NaN)
);

/**
 * Arbitrary for generating alpha values in range [0, 1]
 */
const alphaValueArbitrary = fc.double({ min: 0, max: 1, noNaN: true });

/**
 * Arbitrary for generating RGB color values (0-255)
 */
const rgbComponentArbitrary = fc.integer({ min: 0, max: 255 });

// ============================================================================
// Property 3: NDVI Color Mapping Correctness
// ============================================================================

describe('Property 3: NDVI Color Mapping Correctness', () => {
  /**
   * Property 3.1: RGB components are in valid range [0, 255]
   * 
   * For any valid NDVI value, the returned RGB color components
   * must be integers in the range [0, 255].
   * 
   * This validates that color values are valid for CSS/display purposes.
   */
  it('should produce RGB values in range [0, 255] for all NDVI inputs', () => {
    fc.assert(
      fc.property(ndviValueArbitrary, (ndvi) => {
        const color = ndviToRGB(ndvi);

        // All RGB components must be in valid range
        expect(color.r).toBeGreaterThanOrEqual(0);
        expect(color.r).toBeLessThanOrEqual(255);
        expect(color.g).toBeGreaterThanOrEqual(0);
        expect(color.g).toBeLessThanOrEqual(255);
        expect(color.b).toBeGreaterThanOrEqual(0);
        expect(color.b).toBeLessThanOrEqual(255);

        // RGB components should be integers (after rounding)
        expect(Number.isInteger(color.r)).toBe(true);
        expect(Number.isInteger(color.g)).toBe(true);
        expect(Number.isInteger(color.b)).toBe(true);

        return true;
      }),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 3.2: RGBA alpha component is in valid range [0, 1]
   * 
   * For any valid NDVI value and alpha value, the returned RGBA color
   * must have alpha component clamped to [0, 1].
   * 
   * This validates proper alpha channel handling.
   */
  it('should produce RGBA with alpha in range [0, 1]', () => {
    fc.assert(
      fc.property(
        ndviValueArbitrary,
        fc.double({ min: -2, max: 2 }), // Test values outside valid range
        (ndvi, alpha) => {
          const color = ndviToRGBA(ndvi, alpha);

          // Alpha must be clamped to [0, 1]
          expect(color.a).toBeGreaterThanOrEqual(0);
          expect(color.a).toBeLessThanOrEqual(1);

          return true;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 3.3: Exact threshold values map to expected colors
   * 
   * For NDVI values exactly at color stop thresholds (0.0, 0.2, 0.4, 0.6, 0.8, 1.0),
   * the returned color should match the expected color stop.
   * 
   * This validates that threshold boundaries are correctly implemented.
   */
  it('should map exact threshold values to expected colors', () => {
    EXPECTED_COLOR_STOPS.forEach((stop) => {
      const color = ndviToRGB(stop.threshold);

      // Color should match expected stop color (allowing small rounding differences)
      expect(Math.abs(color.r - stop.color.r)).toBeLessThanOrEqual(1);
      expect(Math.abs(color.g - stop.color.g)).toBeLessThanOrEqual(1);
      expect(Math.abs(color.b - stop.color.b)).toBeLessThanOrEqual(1);
    });
  });

  /**
   * Property 3.4: Negative NDVI values map to brown color
   * 
   * For any NDVI value < 0 (water, bare soil, etc.), the returned color
   * should be the brown color (first color stop).
   * 
   * This validates proper handling of negative NDVI values.
   */
  it('should map negative NDVI values to brown color', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1, max: -0.001, noNaN: true }),
        (ndvi) => {
          const color = ndviToRGB(ndvi);
          const expectedColor = EXPECTED_COLOR_STOPS[0].color;

          // Color should match brown (first stop)
          expect(color.r).toBe(expectedColor.r);
          expect(color.g).toBe(expectedColor.g);
          expect(color.b).toBe(expectedColor.b);

          return true;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 3.5: NDVI values are clamped to [-1, 1] range
   * 
   * For any NDVI value outside the valid range [-1, 1], the function
   * should clamp it and return a valid color.
   * 
   * This validates proper input validation and clamping.
   */
  it('should clamp NDVI values outside [-1, 1] range', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -10, max: 10, noNaN: true }),
        (ndvi) => {
          const color = ndviToRGB(ndvi);

          // Should return valid RGB color regardless of input
          expect(color.r).toBeGreaterThanOrEqual(0);
          expect(color.r).toBeLessThanOrEqual(255);
          expect(color.g).toBeGreaterThanOrEqual(0);
          expect(color.g).toBeLessThanOrEqual(255);
          expect(color.b).toBeGreaterThanOrEqual(0);
          expect(color.b).toBeLessThanOrEqual(255);

          // Values > 1 should map to dark green (last stop)
          if (ndvi > 1) {
            const expectedColor = EXPECTED_COLOR_STOPS[EXPECTED_COLOR_STOPS.length - 1].color;
            expect(Math.abs(color.r - expectedColor.r)).toBeLessThanOrEqual(1);
            expect(Math.abs(color.g - expectedColor.g)).toBeLessThanOrEqual(1);
            expect(Math.abs(color.b - expectedColor.b)).toBeLessThanOrEqual(1);
          }

          // Values < -1 should map to brown (first stop)
          if (ndvi < -1) {
            const expectedColor = EXPECTED_COLOR_STOPS[0].color;
            expect(color.r).toBe(expectedColor.r);
            expect(color.g).toBe(expectedColor.g);
            expect(color.b).toBe(expectedColor.b);
          }

          return true;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 3.6: NaN NDVI values are handled gracefully
   * 
   * For NaN NDVI input, the function should return a valid color
   * (treating NaN as minimum value).
   * 
   * This validates proper handling of invalid/missing data.
   */
  it('should handle NaN NDVI values by treating as minimum', () => {
    const color = ndviToRGB(NaN);
    const expectedColor = EXPECTED_COLOR_STOPS[0].color;

    // NaN should map to brown (first stop, minimum value)
    expect(color.r).toBe(expectedColor.r);
    expect(color.g).toBe(expectedColor.g);
    expect(color.b).toBe(expectedColor.b);
  });

  /**
   * Property 3.7: Color interpolation is monotonic
   * 
   * For any two NDVI values within the same color range, where ndvi1 < ndvi2,
   * the interpolated colors should show a smooth transition.
   * 
   * This validates that interpolation produces smooth gradients.
   */
  it('should produce smooth color interpolation within ranges', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 0.99, noNaN: true }),
        fc.double({ min: 0.01, max: 0.1, noNaN: true }),
        (ndvi1, delta) => {
          const ndvi2 = Math.min(1.0, ndvi1 + delta);

          // Skip if they're in different color ranges
          const range1 = Math.floor(ndvi1 / 0.2);
          const range2 = Math.floor(ndvi2 / 0.2);
          if (range1 !== range2) {
            return true;
          }

          const color1 = ndviToRGB(ndvi1);
          const color2 = ndviToRGB(ndvi2);

          // Colors should be different (unless at exact same value)
          if (Math.abs(ndvi2 - ndvi1) > EPSILON) {
            const colorDiff = Math.abs(color1.r - color2.r) +
                            Math.abs(color1.g - color2.g) +
                            Math.abs(color1.b - color2.b);
            expect(colorDiff).toBeGreaterThan(0);
          }

          return true;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 3.8: RGB to string conversion produces valid CSS
   * 
   * For any RGB color, the string conversion should produce a valid
   * CSS rgb() string with correct format.
   * 
   * This validates the CSS string generation.
   */
  it('should convert RGB to valid CSS rgb() string', () => {
    fc.assert(
      fc.property(
        rgbComponentArbitrary,
        rgbComponentArbitrary,
        rgbComponentArbitrary,
        (r, g, b) => {
          const color: RGBColor = { r, g, b };
          const cssString = rgbToString(color);

          // Should match rgb(r, g, b) format
          const expectedString = `rgb(${r}, ${g}, ${b})`;
          expect(cssString).toBe(expectedString);

          // Should be parseable by CSS
          expect(cssString).toMatch(/^rgb\(\d+, \d+, \d+\)$/);

          return true;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 3.9: RGBA to string conversion produces valid CSS
   * 
   * For any RGBA color, the string conversion should produce a valid
   * CSS rgba() string with correct format.
   * 
   * This validates the CSS RGBA string generation.
   */
  it('should convert RGBA to valid CSS rgba() string', () => {
    fc.assert(
      fc.property(
        rgbComponentArbitrary,
        rgbComponentArbitrary,
        rgbComponentArbitrary,
        alphaValueArbitrary,
        (r, g, b, a) => {
          const color: RGBAColor = { r, g, b, a };
          const cssString = rgbaToString(color);

          // Should match rgba(r, g, b, a) format
          const expectedString = `rgba(${r}, ${g}, ${b}, ${a})`;
          expect(cssString).toBe(expectedString);

          // Should be parseable by CSS (including scientific notation for very small values)
          expect(cssString).toMatch(/^rgba\(\d+, \d+, \d+, [\d.e+-]+\)$/);

          return true;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 3.10: RGB to hex conversion produces valid hex color
   * 
   * For any RGB color, the hex conversion should produce a valid
   * 6-digit hex color string starting with #.
   * 
   * This validates the hex color generation.
   */
  it('should convert RGB to valid hex color string', () => {
    fc.assert(
      fc.property(
        rgbComponentArbitrary,
        rgbComponentArbitrary,
        rgbComponentArbitrary,
        (r, g, b) => {
          const color: RGBColor = { r, g, b };
          const hexString = rgbToHex(color);

          // Should start with # and have 6 hex digits
          expect(hexString).toMatch(/^#[0-9a-f]{6}$/);

          // Should be convertible back to RGB
          const parsedR = parseInt(hexString.slice(1, 3), 16);
          const parsedG = parseInt(hexString.slice(3, 5), 16);
          const parsedB = parseInt(hexString.slice(5, 7), 16);

          expect(parsedR).toBe(r);
          expect(parsedG).toBe(g);
          expect(parsedB).toBe(b);

          return true;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 3.11: ndviToColorString produces correct format
   * 
   * For any NDVI value, the color string conversion should produce
   * the correct format based on the specified format parameter.
   * 
   * This validates the unified color string generation function.
   */
  it('should produce correct color string format based on format parameter', () => {
    fc.assert(
      fc.property(
        ndviValueArbitrary,
        fc.constantFrom('rgb', 'rgba', 'hex'),
        alphaValueArbitrary,
        (ndvi, format, alpha) => {
          const colorString = ndviToColorString(ndvi, format as 'rgb' | 'rgba' | 'hex', alpha);

          if (format === 'rgb') {
            expect(colorString).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
          } else if (format === 'rgba') {
            // Allow scientific notation for very small alpha values
            expect(colorString).toMatch(/^rgba\(\d+, \d+, \d+, [\d.e+-]+\)$/);
          } else if (format === 'hex') {
            expect(colorString).toMatch(/^#[0-9a-f]{6}$/);
          }

          return true;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 3.12: Color stops are correctly ordered
   * 
   * The color stops returned by getColorStops() should be in ascending
   * order by threshold value.
   * 
   * This validates the color stop configuration.
   */
  it('should return color stops in ascending threshold order', () => {
    const colorStops = getColorStops();

    // Should have 6 color stops
    expect(colorStops.length).toBe(6);

    // Thresholds should be in ascending order
    for (let i = 0; i < colorStops.length - 1; i++) {
      expect(colorStops[i].threshold).toBeLessThan(colorStops[i + 1].threshold);
    }

    // First threshold should be 0.0
    expect(colorStops[0].threshold).toBe(0.0);

    // Last threshold should be 1.0
    expect(colorStops[colorStops.length - 1].threshold).toBe(1.0);
  });

  /**
   * Property 3.13: Color stops have valid RGB values
   * 
   * All color stops should have RGB values in the valid range [0, 255].
   * 
   * This validates the color stop color values.
   */
  it('should have valid RGB values in all color stops', () => {
    const colorStops = getColorStops();

    colorStops.forEach((stop) => {
      expect(stop.color.r).toBeGreaterThanOrEqual(0);
      expect(stop.color.r).toBeLessThanOrEqual(255);
      expect(stop.color.g).toBeGreaterThanOrEqual(0);
      expect(stop.color.g).toBeLessThanOrEqual(255);
      expect(stop.color.b).toBeGreaterThanOrEqual(0);
      expect(stop.color.b).toBeLessThanOrEqual(255);
    });
  });

  /**
   * Property 3.14: NDVI gradient string is valid CSS
   * 
   * The gradient string returned by getNDVIGradient() should be a valid
   * CSS linear-gradient string.
   * 
   * This validates the gradient generation for legends.
   */
  it('should produce valid CSS linear-gradient string', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('to right', 'to left', 'to top', 'to bottom', '90deg', '180deg'),
        (direction) => {
          const gradient = getNDVIGradient(direction);

          // Should start with linear-gradient
          expect(gradient).toMatch(/^linear-gradient\(/);

          // Should contain the direction
          expect(gradient).toContain(direction);

          // Should contain hex colors
          expect(gradient).toMatch(/#[0-9a-f]{6}/);

          // Should contain percentages
          expect(gradient).toMatch(/\d+%/);

          return true;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 3.15: Color mapping is deterministic
   * 
   * For any NDVI value, calling ndviToRGB multiple times should
   * produce identical results.
   * 
   * This validates that color mapping has no side effects.
   */
  it('should produce identical colors when called multiple times', () => {
    fc.assert(
      fc.property(ndviValueArbitrary, (ndvi) => {
        const color1 = ndviToRGB(ndvi);
        const color2 = ndviToRGB(ndvi);

        expect(color1.r).toBe(color2.r);
        expect(color1.g).toBe(color2.g);
        expect(color1.b).toBe(color2.b);

        return true;
      }),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 3.16: RGBA preserves RGB values
   * 
   * For any NDVI value, the RGB components of ndviToRGBA should match
   * the RGB components from ndviToRGB.
   * 
   * This validates that RGBA conversion doesn't alter RGB values.
   */
  it('should preserve RGB values when converting to RGBA', () => {
    fc.assert(
      fc.property(
        ndviValueArbitrary,
        alphaValueArbitrary,
        (ndvi, alpha) => {
          const rgb = ndviToRGB(ndvi);
          const rgba = ndviToRGBA(ndvi, alpha);

          expect(rgba.r).toBe(rgb.r);
          expect(rgba.g).toBe(rgb.g);
          expect(rgba.b).toBe(rgb.b);

          return true;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 3.17: Color ranges are correctly mapped
   * 
   * For NDVI values in specific ranges, the colors should fall within
   * the expected color families (brown, orange, yellow, green shades).
   * 
   * This validates the overall color scheme correctness.
   */
  it('should map NDVI ranges to appropriate color families', () => {
    // Test brown range (< 0.2)
    const brownColor = ndviToRGB(0.1);
    expect(brownColor.r).toBeGreaterThan(brownColor.g); // Brown/orange has more red

    // Test yellow range (0.4)
    const yellowColor = ndviToRGB(0.5);
    expect(yellowColor.r).toBeGreaterThan(200); // Yellow has high red
    expect(yellowColor.g).toBeGreaterThan(150); // Yellow has high green

    // Test green range (0.8)
    const greenColor = ndviToRGB(0.9);
    expect(greenColor.g).toBeGreaterThan(greenColor.r); // Green has more green than red
    expect(greenColor.g).toBeGreaterThan(greenColor.b); // Green has more green than blue
  });

  /**
   * Property 3.18: Hex conversion round-trip preserves values
   * 
   * For any RGB color, converting to hex and back should preserve
   * the original RGB values.
   * 
   * This validates the hex conversion is lossless.
   */
  it('should preserve RGB values in hex round-trip conversion', () => {
    fc.assert(
      fc.property(
        rgbComponentArbitrary,
        rgbComponentArbitrary,
        rgbComponentArbitrary,
        (r, g, b) => {
          const color: RGBColor = { r, g, b };
          const hexString = rgbToHex(color);

          // Parse back from hex
          const parsedR = parseInt(hexString.slice(1, 3), 16);
          const parsedG = parseInt(hexString.slice(3, 5), 16);
          const parsedB = parseInt(hexString.slice(5, 7), 16);

          expect(parsedR).toBe(r);
          expect(parsedG).toBe(g);
          expect(parsedB).toBe(b);

          return true;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 3.19: Default alpha value is 1.0
   * 
   * When calling ndviToRGBA without specifying alpha, the default
   * alpha value should be 1.0 (fully opaque).
   * 
   * This validates the default parameter behavior.
   */
  it('should use alpha=1.0 as default for RGBA conversion', () => {
    fc.assert(
      fc.property(ndviValueArbitrary, (ndvi) => {
        const rgba = ndviToRGBA(ndvi);

        expect(rgba.a).toBe(1.0);

        return true;
      }),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 3.20: Color stops match expected thresholds
   * 
   * The color stops should match the documented NDVI thresholds:
   * 0.0, 0.2, 0.4, 0.6, 0.8, 1.0
   * 
   * This validates the color stop configuration matches requirements.
   */
  it('should have color stops at documented threshold values', () => {
    const colorStops = getColorStops();
    const expectedThresholds = [0.0, 0.2, 0.4, 0.6, 0.8, 1.0];

    expect(colorStops.length).toBe(expectedThresholds.length);

    colorStops.forEach((stop, index) => {
      expect(stop.threshold).toBe(expectedThresholds[index]);
    });
  });
});
