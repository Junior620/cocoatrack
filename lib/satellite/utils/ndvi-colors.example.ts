/**
 * Example usage of NDVI color mapping utility
 * 
 * This file demonstrates how to use the NDVI color mapping functions
 * in various scenarios within the CocoaTrack application.
 */

import {
  ndviToRGB,
  ndviToRGBA,
  ndviToColorString,
  getColorStops,
  getNDVIGradient,
  rgbToHex,
} from './ndvi-colors';

// Example 1: Basic NDVI to color conversion
console.log('Example 1: Basic NDVI to RGB conversion');
console.log('NDVI 0.75 →', ndviToRGB(0.75));
// Output: { r: 101, g: 188, b: 40 }

// Example 2: Get color as hex string for CSS
console.log('\nExample 2: NDVI to hex color string');
const hexColor = ndviToColorString(0.65, 'hex');
console.log('NDVI 0.65 → Hex:', hexColor);
// Output: "#7bc838"
// Usage in CSS: background-color: #7bc838;

// Example 3: Get color as RGB string for CSS
console.log('\nExample 3: NDVI to RGB string');
const rgbString = ndviToColorString(0.45, 'rgb');
console.log('NDVI 0.45 → RGB:', rgbString);
// Output: "rgb(200, 200, 43)"
// Usage in CSS: color: rgb(200, 200, 43);

// Example 4: Get color with transparency (RGBA)
console.log('\nExample 4: NDVI to RGBA with transparency');
const rgbaString = ndviToColorString(0.55, 'rgba', 0.7);
console.log('NDVI 0.55 → RGBA:', rgbaString);
// Output: "rgba(177, 200, 63, 0.7)"
// Usage in CSS: background-color: rgba(177, 200, 63, 0.7);

// Example 5: Create a legend with color stops
console.log('\nExample 5: Color stops for legend');
const stops = getColorStops();
stops.forEach(stop => {
  const hex = rgbToHex(stop.color);
  console.log(`NDVI ${stop.threshold.toFixed(1)}: ${hex} (${stop.label})`);
});
// Output:
// NDVI 0.0: #a52a2a (Very Poor)
// NDVI 0.2: #e66100 (Poor)
// NDVI 0.4: #ffc107 (Moderate)
// NDVI 0.6: #92d050 (Good)
// NDVI 0.8: #38a800 (Very Good)
// NDVI 1.0: #228b22 (Excellent)

// Example 6: Create CSS gradient for legend background
console.log('\nExample 6: CSS gradient for legend');
const gradient = getNDVIGradient('to right');
console.log('Gradient:', gradient);
// Output: "linear-gradient(to right, #a52a2a 0%, #e66100 20%, ...)"
// Usage in CSS: background: linear-gradient(to right, #a52a2a 0%, ...);

// Example 7: Map multiple NDVI values for a parcelle
console.log('\nExample 7: Color mapping for parcelle pixels');
const parcelleNDVIValues = [0.45, 0.62, 0.78, 0.55, 0.68];
const colors = parcelleNDVIValues.map(ndvi => ({
  ndvi,
  color: ndviToColorString(ndvi, 'hex'),
}));
console.log('Parcelle NDVI colors:', colors);
// Output: Array of { ndvi, color } objects

// Example 8: Handle edge cases
console.log('\nExample 8: Edge case handling');
console.log('Negative NDVI (water):', ndviToColorString(-0.3, 'hex'));
console.log('NDVI > 1.0 (clamped):', ndviToColorString(1.5, 'hex'));
console.log('NaN (treated as minimum):', ndviToColorString(NaN, 'hex'));
// All edge cases are handled gracefully

// Example 9: React component usage (pseudo-code)
console.log('\nExample 9: React component usage');
console.log(`
// In a React component:
import { ndviToColorString } from '@/lib/satellite/utils/ndvi-colors';

function NDVIBadge({ ndvi }: { ndvi: number }) {
  const backgroundColor = ndviToColorString(ndvi, 'hex');
  
  return (
    <div 
      style={{ backgroundColor }}
      className="px-3 py-1 rounded-full text-white"
    >
      NDVI: {ndvi.toFixed(2)}
    </div>
  );
}
`);

// Example 10: Leaflet map overlay usage (pseudo-code)
console.log('\nExample 10: Leaflet map overlay');
console.log(`
// In a Leaflet map component:
import { ndviToRGBA } from '@/lib/satellite/utils/ndvi-colors';

function createNDVIOverlay(ndviData: number[][]) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  ndviData.forEach((row, y) => {
    row.forEach((ndvi, x) => {
      const color = ndviToRGBA(ndvi, 0.7);
      ctx.fillStyle = \`rgba(\${color.r}, \${color.g}, \${color.b}, \${color.a})\`;
      ctx.fillRect(x, y, 1, 1);
    });
  });
  
  return canvas;
}
`);

// Example 11: Color legend component (pseudo-code)
console.log('\nExample 11: Color legend component');
console.log(`
// In a legend component:
import { getColorStops, rgbToHex } from '@/lib/satellite/utils/ndvi-colors';

function NDVILegend() {
  const stops = getColorStops();
  
  return (
    <div className="flex flex-col gap-2">
      <h3>NDVI Health Status</h3>
      {stops.map(stop => (
        <div key={stop.threshold} className="flex items-center gap-2">
          <div 
            style={{ backgroundColor: rgbToHex(stop.color) }}
            className="w-6 h-6 rounded"
          />
          <span>{stop.label} ({stop.threshold.toFixed(1)})</span>
        </div>
      ))}
    </div>
  );
}
`);

// Example 12: Gradient background for slider
console.log('\nExample 12: Gradient background for temporal slider');
console.log(`
// In a temporal slider component:
import { getNDVIGradient } from '@/lib/satellite/utils/ndvi-colors';

function TemporalSlider() {
  const gradient = getNDVIGradient('to right');
  
  return (
    <div 
      style={{ background: gradient }}
      className="h-2 rounded-full"
    >
      {/* Slider thumb */}
    </div>
  );
}
`);

export {};
