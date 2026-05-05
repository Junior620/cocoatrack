/**
 * NDVI Color Mapping Utility
 * 
 * Maps NDVI values (-1 to 1) to RGB colors using a color-blind friendly gradient.
 * The color scheme is designed to be accessible for users with color vision deficiencies.
 */

export interface RGBColor {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
}

export interface RGBAColor extends RGBColor {
  a: number; // 0-1 (alpha/opacity)
}

/**
 * NDVI color thresholds and corresponding RGB values
 * Using color-blind friendly palette (tested with deuteranopia and protanopia simulators)
 */
const NDVI_COLOR_STOPS = [
  { threshold: 0.0, color: { r: 165, g: 42, b: 42 } },    // Brown (very poor vegetation)
  { threshold: 0.2, color: { r: 230, g: 97, b: 0 } },     // Orange (poor vegetation)
  { threshold: 0.4, color: { r: 255, g: 193, b: 7 } },    // Yellow (moderate vegetation)
  { threshold: 0.6, color: { r: 146, g: 208, b: 80 } },   // Light green (good vegetation)
  { threshold: 0.8, color: { r: 56, g: 168, b: 0 } },     // Green (very good vegetation)
  { threshold: 1.0, color: { r: 34, g: 139, b: 34 } },    // Dark green (excellent vegetation)
] as const;

/**
 * Maps an NDVI value to an RGB color using linear interpolation between color stops.
 * 
 * @param ndvi - NDVI value in range [-1, 1]
 * @returns RGB color object with values in range [0, 255]
 * 
 * @example
 * ```typescript
 * const color = ndviToRGB(0.75);
 * // Returns { r: 101, g: 188, b: 40 } (interpolated between light green and green)
 * ```
 */
export function ndviToRGB(ndvi: number): RGBColor {
  // Handle NaN by treating it as minimum value
  const validNDVI = isNaN(ndvi) ? -1 : ndvi;
  
  // Clamp NDVI to valid range [-1, 1]
  const clampedNDVI = Math.max(-1, Math.min(1, validNDVI));
  
  // Handle negative NDVI values (water, bare soil, etc.) - map to brown
  if (clampedNDVI < 0) {
    return { ...NDVI_COLOR_STOPS[0].color };
  }
  
  // Find the two color stops to interpolate between
  let lowerStop: { threshold: number; color: RGBColor } = NDVI_COLOR_STOPS[0];
  let upperStop: { threshold: number; color: RGBColor } = NDVI_COLOR_STOPS[1];
  
  for (let i = 0; i < NDVI_COLOR_STOPS.length - 1; i++) {
    if (clampedNDVI >= NDVI_COLOR_STOPS[i].threshold && 
        clampedNDVI <= NDVI_COLOR_STOPS[i + 1].threshold) {
      lowerStop = NDVI_COLOR_STOPS[i];
      upperStop = NDVI_COLOR_STOPS[i + 1];
      break;
    }
  }
  
  // Handle exact match with upper threshold
  if (clampedNDVI === 1.0) {
    return { ...NDVI_COLOR_STOPS[NDVI_COLOR_STOPS.length - 1].color };
  }
  
  // Calculate interpolation factor (0 to 1)
  const range = upperStop.threshold - lowerStop.threshold;
  const factor = range === 0 ? 0 : (clampedNDVI - lowerStop.threshold) / range;
  
  // Linear interpolation between colors
  return {
    r: Math.round(lowerStop.color.r + (upperStop.color.r - lowerStop.color.r) * factor),
    g: Math.round(lowerStop.color.g + (upperStop.color.g - lowerStop.color.g) * factor),
    b: Math.round(lowerStop.color.b + (upperStop.color.b - lowerStop.color.b) * factor),
  };
}

/**
 * Maps an NDVI value to an RGBA color with specified opacity.
 * 
 * @param ndvi - NDVI value in range [-1, 1]
 * @param alpha - Opacity value in range [0, 1], defaults to 1.0
 * @returns RGBA color object
 */
export function ndviToRGBA(ndvi: number, alpha: number = 1.0): RGBAColor {
  const rgb = ndviToRGB(ndvi);
  return {
    ...rgb,
    a: Math.max(0, Math.min(1, alpha)),
  };
}

/**
 * Converts an RGB color to a CSS rgb() string.
 * 
 * @param color - RGB color object
 * @returns CSS rgb string, e.g., "rgb(255, 0, 0)"
 */
export function rgbToString(color: RGBColor): string {
  return `rgb(${color.r}, ${color.g}, ${color.b})`;
}

/**
 * Converts an RGBA color to a CSS rgba() string.
 * 
 * @param color - RGBA color object
 * @returns CSS rgba string, e.g., "rgba(255, 0, 0, 0.5)"
 */
export function rgbaToString(color: RGBAColor): string {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;
}

/**
 * Converts an RGB color to a hexadecimal color string.
 * 
 * @param color - RGB color object
 * @returns Hex color string, e.g., "#ff0000"
 */
export function rgbToHex(color: RGBColor): string {
  const toHex = (value: number) => {
    const hex = Math.round(value).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
}

/**
 * Maps an NDVI value directly to a CSS color string.
 * 
 * @param ndvi - NDVI value in range [-1, 1]
 * @param format - Output format: 'rgb', 'rgba', or 'hex'
 * @param alpha - Opacity for rgba format (0-1), defaults to 1.0
 * @returns CSS color string
 * 
 * @example
 * ```typescript
 * ndviToColorString(0.75, 'hex'); // "#65bc28"
 * ndviToColorString(0.75, 'rgb'); // "rgb(101, 188, 40)"
 * ndviToColorString(0.75, 'rgba', 0.8); // "rgba(101, 188, 40, 0.8)"
 * ```
 */
export function ndviToColorString(
  ndvi: number,
  format: 'rgb' | 'rgba' | 'hex' = 'hex',
  alpha: number = 1.0
): string {
  if (format === 'rgba') {
    const rgba = ndviToRGBA(ndvi, alpha);
    return rgbaToString(rgba);
  }
  
  const rgb = ndviToRGB(ndvi);
  
  if (format === 'rgb') {
    return rgbToString(rgb);
  }
  
  return rgbToHex(rgb);
}

/**
 * Gets the color stops for creating a gradient legend.
 * Useful for displaying NDVI color scale in UI.
 * 
 * @returns Array of color stops with NDVI thresholds and colors
 */
export function getColorStops(): ReadonlyArray<{ threshold: number; color: RGBColor; label: string }> {
  return [
    { threshold: 0.0, color: NDVI_COLOR_STOPS[0].color, label: 'Very Poor' },
    { threshold: 0.2, color: NDVI_COLOR_STOPS[1].color, label: 'Poor' },
    { threshold: 0.4, color: NDVI_COLOR_STOPS[2].color, label: 'Moderate' },
    { threshold: 0.6, color: NDVI_COLOR_STOPS[3].color, label: 'Good' },
    { threshold: 0.8, color: NDVI_COLOR_STOPS[4].color, label: 'Very Good' },
    { threshold: 1.0, color: NDVI_COLOR_STOPS[5].color, label: 'Excellent' },
  ];
}

/**
 * Generates a CSS linear gradient string for NDVI color scale.
 * Useful for creating gradient backgrounds in legends.
 * 
 * @param direction - CSS gradient direction, defaults to 'to right'
 * @returns CSS linear-gradient string
 * 
 * @example
 * ```typescript
 * const gradient = getNDVIGradient();
 * // "linear-gradient(to right, #a52a2a 0%, #e66100 20%, ...)"
 * ```
 */
export function getNDVIGradient(direction: string = 'to right'): string {
  const stops = NDVI_COLOR_STOPS.map((stop) => {
    const percentage = (stop.threshold * 100).toFixed(0);
    const hex = rgbToHex(stop.color);
    return `${hex} ${percentage}%`;
  }).join(', ');
  
  return `linear-gradient(${direction}, ${stops})`;
}

/**
 * Maps an NDVI value directly to a hexadecimal color string.
 * Convenience function that combines ndviToRGB and rgbToHex.
 * 
 * @param ndvi - NDVI value in range [-1, 1]
 * @returns Hex color string, e.g., "#65bc28"
 * 
 * @example
 * ```typescript
 * const color = ndviToHex(0.75);
 * // Returns "#65bc28" (interpolated green color)
 * ```
 */
export function ndviToHex(ndvi: number): string {
  const rgb = ndviToRGB(ndvi);
  return rgbToHex(rgb);
}

/**
 * Color range definition for NDVI legend display
 */
export interface NDVIColorRange {
  min: number;
  max: number;
  color: string;
  label: string;
}

/**
 * Gets the NDVI color ranges for legend display.
 * Returns an array of color ranges with labels suitable for UI legends.
 * 
 * @returns Array of NDVI color ranges with min/max values, colors, and labels
 * 
 * @example
 * ```typescript
 * const ranges = getNDVILegendColors();
 * // Returns array of ranges like:
 * // [{ min: 0.0, max: 0.2, color: '#a52a2a', label: 'Very Poor' }, ...]
 * ```
 */
export function getNDVILegendColors(): NDVIColorRange[] {
  const stops = getColorStops();
  const ranges: NDVIColorRange[] = [];
  
  for (let i = 0; i < stops.length - 1; i++) {
    ranges.push({
      min: stops[i].threshold,
      max: stops[i + 1].threshold,
      color: rgbToHex(stops[i].color),
      label: stops[i].label,
    });
  }
  
  // Add the final range
  const lastStop = stops[stops.length - 1];
  ranges.push({
    min: stops[stops.length - 2].threshold,
    max: lastStop.threshold,
    color: rgbToHex(lastStop.color),
    label: lastStop.label,
  });
  
  return ranges;
}
