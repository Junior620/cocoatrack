# Satellite Utility Functions

This directory contains utility functions for satellite imagery analysis in CocoaTrack.

## NDVI Color Mapping (`ndvi-colors.ts`)

The NDVI color mapping utility provides functions to convert NDVI (Normalized Difference Vegetation Index) values to colors for visualization.

### Features

- **Color-blind friendly palette**: Designed to be accessible for users with color vision deficiencies
- **Smooth interpolation**: Linear interpolation between color stops for smooth gradients
- **Multiple output formats**: RGB, RGBA, hex, and CSS strings
- **Edge case handling**: Gracefully handles NaN, Infinity, and out-of-range values
- **Legend support**: Functions to generate color stops and gradients for UI legends

### Color Scale

The NDVI color scale maps vegetation health to colors:

| NDVI Range | Color | Health Status | RGB Value |
|------------|-------|---------------|-----------|
| < 0.0 | Brown | Water/Bare Soil | `rgb(165, 42, 42)` |
| 0.0 - 0.2 | Brown | Very Poor | `rgb(165, 42, 42)` |
| 0.2 - 0.4 | Orange | Poor | `rgb(230, 97, 0)` |
| 0.4 - 0.6 | Yellow | Moderate | `rgb(255, 193, 7)` |
| 0.6 - 0.8 | Light Green | Good | `rgb(146, 208, 80)` |
| 0.8 - 1.0 | Green | Very Good | `rgb(56, 168, 0)` |
| 1.0 | Dark Green | Excellent | `rgb(34, 139, 34)` |

### Usage Examples

#### Basic Color Conversion

```typescript
import { ndviToRGB, ndviToColorString } from '@/lib/satellite/utils/ndvi-colors';

// Get RGB color object
const rgb = ndviToRGB(0.75);
// { r: 101, g: 188, b: 40 }

// Get hex color string
const hex = ndviToColorString(0.75, 'hex');
// "#65bc28"

// Get RGB string for CSS
const rgbString = ndviToColorString(0.75, 'rgb');
// "rgb(101, 188, 40)"

// Get RGBA with transparency
const rgba = ndviToColorString(0.75, 'rgba', 0.7);
// "rgba(101, 188, 40, 0.7)"
```

#### Creating a Legend

```typescript
import { getColorStops, rgbToHex } from '@/lib/satellite/utils/ndvi-colors';

function NDVILegend() {
  const stops = getColorStops();
  
  return (
    <div className="space-y-2">
      {stops.map(stop => (
        <div key={stop.threshold} className="flex items-center gap-2">
          <div 
            style={{ backgroundColor: rgbToHex(stop.color) }}
            className="w-6 h-6 rounded"
          />
          <span>{stop.label} (NDVI: {stop.threshold.toFixed(1)})</span>
        </div>
      ))}
    </div>
  );
}
```

#### Creating a Gradient Background

```typescript
import { getNDVIGradient } from '@/lib/satellite/utils/ndvi-colors';

function NDVISlider() {
  const gradient = getNDVIGradient('to right');
  
  return (
    <div 
      style={{ background: gradient }}
      className="h-4 rounded-full"
    />
  );
}
```

#### Map Overlay Visualization

```typescript
import { ndviToRGBA } from '@/lib/satellite/utils/ndvi-colors';

function renderNDVIOverlay(ndviData: number[][], canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  
  ndviData.forEach((row, y) => {
    row.forEach((ndvi, x) => {
      const color = ndviToRGBA(ndvi, 0.7);
      ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;
      ctx.fillRect(x, y, 1, 1);
    });
  });
}
```

### API Reference

#### `ndviToRGB(ndvi: number): RGBColor`

Converts an NDVI value to an RGB color object.

- **Parameters**: `ndvi` - NDVI value in range [-1, 1]
- **Returns**: RGB color object with r, g, b values in range [0, 255]
- **Edge cases**: Clamps values outside [-1, 1], treats NaN as -1

#### `ndviToRGBA(ndvi: number, alpha?: number): RGBAColor`

Converts an NDVI value to an RGBA color object with opacity.

- **Parameters**: 
  - `ndvi` - NDVI value in range [-1, 1]
  - `alpha` - Opacity in range [0, 1], defaults to 1.0
- **Returns**: RGBA color object with r, g, b, a values

#### `ndviToColorString(ndvi: number, format?: 'rgb' | 'rgba' | 'hex', alpha?: number): string`

Converts an NDVI value to a CSS color string.

- **Parameters**:
  - `ndvi` - NDVI value in range [-1, 1]
  - `format` - Output format, defaults to 'hex'
  - `alpha` - Opacity for rgba format, defaults to 1.0
- **Returns**: CSS color string

#### `rgbToString(color: RGBColor): string`

Converts an RGB color object to a CSS rgb() string.

#### `rgbaToString(color: RGBAColor): string`

Converts an RGBA color object to a CSS rgba() string.

#### `rgbToHex(color: RGBColor): string`

Converts an RGB color object to a hexadecimal color string.

#### `getColorStops(): ReadonlyArray<{ threshold: number; color: RGBColor; label: string }>`

Returns the NDVI color stops for creating legends.

- **Returns**: Array of color stops with thresholds, colors, and labels

#### `getNDVIGradient(direction?: string): string`

Generates a CSS linear-gradient string for the NDVI color scale.

- **Parameters**: `direction` - CSS gradient direction, defaults to 'to right'
- **Returns**: CSS linear-gradient string

### Color-Blind Accessibility

The color palette has been designed to be distinguishable for users with common color vision deficiencies:

- **Deuteranopia** (red-green color blindness): Colors maintain sufficient contrast
- **Protanopia** (red-green color blindness): Colors remain distinguishable
- **Tritanopia** (blue-yellow color blindness): Colors are clearly differentiated

The palette uses a combination of hue, saturation, and brightness changes to ensure accessibility.

### Testing

Comprehensive unit tests are available in `tests/satellite/utils/ndvi-colors.test.ts`:

```bash
npm test -- tests/satellite/utils/ndvi-colors.test.ts
```

Tests cover:
- Color mapping accuracy for all NDVI ranges
- Interpolation between color stops
- Edge case handling (NaN, Infinity, out-of-range values)
- Format conversion (RGB, RGBA, hex, CSS strings)
- Color-blind friendliness verification

### Performance Considerations

- Color calculations use simple arithmetic operations (O(1) complexity)
- No external dependencies
- Suitable for real-time rendering of large datasets
- Color stops are pre-defined constants (no runtime computation)

### Related Files

- Implementation: `lib/satellite/utils/ndvi-colors.ts`
- Tests: `tests/satellite/utils/ndvi-colors.test.ts`
- Examples: `lib/satellite/utils/ndvi-colors.example.ts`
- Design specification: `.kiro/specs/satellite-imagery-analysis/design.md`
