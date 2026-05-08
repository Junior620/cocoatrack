/**
 * Property-Based Tests for KML Generation
 * 
 * Tests correctness properties for KML export functionality using fast-check.
 * 
 * Properties tested:
 * - Property 13: KML structure and content
 * - Property 14: Batch KML completeness
 * - Property 15: KML specification compliance
 * - Property 16: Time-enabled KML structure
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ExportService } from '@/lib/satellite/services/export.service';
import type { 
  KMLExportData, 
  ParcelleKMLData 
} from '@/lib/satellite/services/export.service';
import type { 
  KMLExportOptions, 
  NDVIResult, 
  TemporalDataPoint,
  HealthStatus 
} from '@/lib/satellite/types';
import type { MultiPolygon } from 'geojson';

// ============================================================================
// Arbitraries (Generators)
// ============================================================================

/**
 * Generate valid coordinates for a polygon ring
 * Ensures the ring is closed (first and last coordinates are the same)
 */
const coordinateRingArb = fc.array(
  fc.tuple(
    fc.double({ min: -180, max: 180, noNaN: true }), // longitude
    fc.double({ min: -90, max: 90, noNaN: true })    // latitude
  ),
  { minLength: 4, maxLength: 20 }
).map(coords => {
  // Ensure ring is closed
  const closedCoords = [...coords];
  closedCoords.push(coords[0]);
  return closedCoords;
});

/**
 * Generate a valid MultiPolygon geometry
 */
const multiPolygonArb: fc.Arbitrary<MultiPolygon> = fc.array(
  fc.array(coordinateRingArb, { minLength: 1, maxLength: 3 }), // polygon with optional holes
  { minLength: 1, maxLength: 3 }
).map(polygons => ({
  type: 'MultiPolygon',
  coordinates: polygons
}));

/**
 * Generate a valid health status
 */
const healthStatusArb: fc.Arbitrary<HealthStatus> = fc.constantFrom(
  'excellent',
  'good',
  'fair',
  'poor',
  'critical'
);

/**
 * Generate a valid parcelle for KML export
 */
const parcelleKMLDataArb: fc.Arbitrary<ParcelleKMLData> = fc.record({
  id: fc.uuid(),
  code: fc.option(fc.stringMatching(/^[A-Z0-9-]{3,10}$/), { nil: null }),
  label: fc.option(fc.string({ minLength: 3, maxLength: 50 }), { nil: null }),
  village: fc.option(fc.string({ minLength: 3, maxLength: 50 }), { nil: null }),
  region: fc.option(fc.constantFrom('Centre', 'Littoral', 'Ouest', 'Sud'), { nil: null }),
  geometry: multiPolygonArb,
  surface_hectares: fc.double({ min: 0.1, max: 100, noNaN: true, noDefaultInfinity: true }),
  planteur_name: fc.option(fc.string({ minLength: 3, maxLength: 50 }), { nil: null })
});

/**
 * Generate a valid NDVI result
 */
const ndviResultArb: fc.Arbitrary<NDVIResult> = fc.record({
  id: fc.uuid(),
  parcelleId: fc.uuid(),
  imageryId: fc.option(fc.uuid(), { nil: null }),
  calculationDate: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }),
  meanNDVI: fc.double({ min: -1, max: 1, noNaN: true, noDefaultInfinity: true }),
  minNDVI: fc.double({ min: -1, max: 1, noNaN: true, noDefaultInfinity: true }),
  maxNDVI: fc.double({ min: -1, max: 1, noNaN: true, noDefaultInfinity: true }),
  stdDevNDVI: fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
  healthStatus: healthStatusArb,
  ndviRasterUrl: fc.option(fc.webUrl(), { nil: null }),
  createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') })
});

/**
 * Generate a valid temporal data point
 */
const temporalDataPointArb: fc.Arbitrary<TemporalDataPoint> = fc.record({
  date: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }),
  ndvi: fc.double({ min: -1, max: 1, noNaN: true, noDefaultInfinity: true }),
  cloudCover: fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
  healthStatus: healthStatusArb,
  hasSignificantChange: fc.boolean()
});

/**
 * Generate KML export options
 */
const kmlExportOptionsArb: fc.Arbitrary<KMLExportOptions> = fc.record({
  includeTemporal: fc.boolean(),
  includeNDVI: fc.boolean(),
  includeDeforestation: fc.boolean(),
  startDate: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') })),
  endDate: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') })),
  format: fc.constantFrom('kml', 'kmz')
});

/**
 * Generate complete KML export data
 */
const kmlExportDataArb: fc.Arbitrary<KMLExportData> = fc.record({
  parcelle: parcelleKMLDataArb,
  ndvi: fc.option(ndviResultArb),
  deforestation: fc.option(fc.array(fc.record({
    id: fc.uuid(),
    parcelleId: fc.uuid(),
    baselineDate: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }),
    detectionDate: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }),
    baselineNDVI: fc.double({ min: -1, max: 1, noNaN: true, noDefaultInfinity: true }),
    currentNDVI: fc.double({ min: -1, max: 1, noNaN: true, noDefaultInfinity: true }),
    ndviChange: fc.double({ min: -2, max: 0, noNaN: true, noDefaultInfinity: true }),
    affectedAreaHectares: fc.double({ min: 0.5, max: 50, noNaN: true, noDefaultInfinity: true }),
    affectedAreaPercent: fc.double({ min: 1, max: 100, noNaN: true, noDefaultInfinity: true }),
    status: fc.constantFrom('pending', 'acknowledged', 'disputed', 'resolved'),
    acknowledgedBy: fc.option(fc.uuid(), { nil: null }),
    acknowledgedAt: fc.option(fc.date(), { nil: null }),
    acknowledgmentNotes: fc.option(fc.string(), { nil: null }),
    disputedBy: fc.option(fc.uuid(), { nil: null }),
    disputedAt: fc.option(fc.date(), { nil: null }),
    disputeReason: fc.option(fc.string(), { nil: null }),
    createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }),
    updatedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') })
  }), { minLength: 0, maxLength: 5 })),
  temporal: fc.option(fc.array(temporalDataPointArb, { minLength: 1, maxLength: 24 }))
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse KML XML and extract key elements
 */
function parseKML(kml: string) {
  return {
    hasXMLDeclaration: kml.startsWith('<?xml'),
    hasKMLNamespace: kml.includes('xmlns="http://www.opengis.net/kml/2.2"'),
    hasDocument: kml.includes('<Document>') && kml.includes('</Document>'),
    placemarkCount: (kml.match(/<Placemark>/g) || []).length,
    hasStyles: kml.includes('<Style id='),
    hasCoordinates: kml.includes('<coordinates>'),
    hasDescription: kml.includes('<description>'),
    hasName: kml.includes('<name>'),
    hasTimeStamp: kml.includes('<TimeStamp>'),
    hasTimeSpan: kml.includes('<TimeSpan>'),
    hasFolder: kml.includes('<Folder>'),
    hasPolygon: kml.includes('<Polygon>'),
    hasMultiGeometry: kml.includes('<MultiGeometry>')
  };
}

/**
 * Extract all Placemark elements from KML
 */
function extractPlacemarks(kml: string): string[] {
  const placemarkRegex = /<Placemark>[\s\S]*?<\/Placemark>/g;
  return kml.match(placemarkRegex) || [];
}

/**
 * Extract metadata from a Placemark
 */
function extractPlacemarkMetadata(placemark: string) {
  const nameMatch = placemark.match(/<name>(.*?)<\/name>/);
  const descriptionMatch = placemark.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/);
  const styleUrlMatch = placemark.match(/<styleUrl>(.*?)<\/styleUrl>/);
  const coordinatesMatch = placemark.match(/<coordinates>([\s\S]*?)<\/coordinates>/);
  const timeStampMatch = placemark.match(/<when>(.*?)<\/when>/);
  
  return {
    name: nameMatch ? nameMatch[1] : null,
    description: descriptionMatch ? descriptionMatch[1] : null,
    styleUrl: styleUrlMatch ? styleUrlMatch[1] : null,
    hasCoordinates: !!coordinatesMatch,
    timeStamp: timeStampMatch ? timeStampMatch[1] : null
  };
}

/**
 * Check if description contains required metadata fields
 */
function descriptionContainsMetadata(
  description: string,
  parcelle: ParcelleKMLData,
  includeNDVI: boolean,
  ndvi?: NDVIResult
): boolean {
  // Check for surface area (always required)
  const hasSurface = description.includes('Surface') && 
                     description.includes(parcelle.surface_hectares.toFixed(2));
  
  if (!hasSurface) return false;
  
  // Check for NDVI data if included
  if (includeNDVI && ndvi) {
    const hasMeanNDVI = description.includes('NDVI Moyen') && 
                        description.includes(ndvi.meanNDVI.toFixed(3));
    const hasHealthStatus = description.includes('État de Santé');
    
    if (!hasMeanNDVI || !hasHealthStatus) return false;
  }
  
  return true;
}

/**
 * Validate ISO 8601 timestamp format
 */
function isValidISO8601(timestamp: string): boolean {
  // ISO 8601 format: YYYY-MM-DDTHH:MM:SS.sssZ or YYYY-MM-DDTHH:MM:SSZ
  const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
  return iso8601Regex.test(timestamp);
}

/**
 * Check if KML is well-formed XML
 */
function isWellFormedXML(kml: string): boolean {
  try {
    // Basic checks for well-formed XML
    const hasMatchingTags = (tag: string) => {
      const openCount = (kml.match(new RegExp(`<${tag}[\\s>]`, 'g')) || []).length;
      const closeCount = (kml.match(new RegExp(`</${tag}>`, 'g')) || []).length;
      return openCount === closeCount && openCount > 0;
    };
    
    // Check essential KML tags
    return hasMatchingTags('kml') &&
           hasMatchingTags('Document');
  } catch {
    return false;
  }
}

// ============================================================================
// Property 13: KML Structure and Content
// ============================================================================

describe('Property 13: KML Structure and Content', () => {
  const exportService = new ExportService();
  
  it('should generate KML with valid Polygon element and coordinates for any parcelle', () => {
    fc.assert(
      fc.asyncProperty(
        kmlExportDataArb,
        kmlExportOptionsArb,
        async (data, options) => {
          // Generate KML
          const kml = await exportService.exportKML([data], options);
          
          // Parse KML structure
          const parsed = parseKML(kml);
          
          // Verify Polygon element exists
          expect(parsed.hasPolygon).toBe(true);
          
          // Verify coordinates exist
          expect(parsed.hasCoordinates).toBe(true);
          
          // Verify MultiGeometry wrapper exists
          expect(parsed.hasMultiGeometry).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should include NDVI color coding in style when NDVI data is present', () => {
    fc.assert(
      fc.asyncProperty(
        kmlExportDataArb.filter(data => data.ndvi !== undefined),
        kmlExportOptionsArb.map(opts => ({ ...opts, includeNDVI: true })),
        async (data, options) => {
          // Generate KML
          const kml = await exportService.exportKML([data], options);
          
          // Extract placemarks
          const placemarks = extractPlacemarks(kml);
          expect(placemarks.length).toBeGreaterThan(0);
          
          // Check first placemark has style reference
          const metadata = extractPlacemarkMetadata(placemarks[0]);
          expect(metadata.styleUrl).toBeTruthy();
          expect(metadata.styleUrl).toMatch(/^#style_(excellent|good|fair|poor|critical)$/);
          
          // Verify style definition exists in KML
          const styleId = metadata.styleUrl!.substring(1); // Remove #
          expect(kml).toContain(`<Style id="${styleId}">`);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should include all required metadata fields in description', () => {
    fc.assert(
      fc.asyncProperty(
        kmlExportDataArb,
        kmlExportOptionsArb,
        async (data, options) => {
          // Generate KML
          const kml = await exportService.exportKML([data], options);
          
          // Extract placemarks
          const placemarks = extractPlacemarks(kml);
          expect(placemarks.length).toBeGreaterThan(0);
          
          // Check first placemark metadata
          const metadata = extractPlacemarkMetadata(placemarks[0]);
          
          // Verify name exists
          expect(metadata.name).toBeTruthy();
          
          // Verify description exists
          expect(metadata.description).toBeTruthy();
          
          // Verify description contains required metadata
          const hasRequiredMetadata = descriptionContainsMetadata(
            metadata.description!,
            data.parcelle,
            options.includeNDVI,
            data.ndvi
          );
          expect(hasRequiredMetadata).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Property 14: Batch KML Completeness
// ============================================================================

describe('Property 14: Batch KML Completeness', () => {
  const exportService = new ExportService();
  
  it('should contain exactly one Placemark per parcelle in batch export (non-temporal)', () => {
    fc.assert(
      fc.asyncProperty(
        fc.array(kmlExportDataArb, { minLength: 2, maxLength: 10 }),
        kmlExportOptionsArb.map(opts => ({ ...opts, includeTemporal: false })),
        async (dataArray, options) => {
          // Generate batch KML
          const kml = await exportService.exportKML(dataArray, options);
          
          // Parse KML structure
          const parsed = parseKML(kml);
          
          // Count placemarks (excluding temporal folders)
          const placemarks = extractPlacemarks(kml);
          
          // For non-temporal exports, should have exactly one placemark per parcelle
          expect(placemarks.length).toBe(dataArray.length);
        }
      ),
      { numRuns: 50 }
    );
  });
  
  it('should include complete data for each parcelle in batch export', () => {
    fc.assert(
      fc.asyncProperty(
        fc.array(kmlExportDataArb, { minLength: 2, maxLength: 5 }),
        kmlExportOptionsArb.map(opts => ({ ...opts, includeTemporal: false })),
        async (dataArray, options) => {
          // Generate batch KML
          const kml = await exportService.exportKML(dataArray, options);
          
          // Extract placemarks
          const placemarks = extractPlacemarks(kml);
          
          // Verify each parcelle has a corresponding placemark with complete data
          dataArray.forEach((data, index) => {
            const placemark = placemarks[index];
            expect(placemark).toBeTruthy();
            
            const metadata = extractPlacemarkMetadata(placemark);
            
            // Verify name exists
            expect(metadata.name).toBeTruthy();
            
            // Verify coordinates exist
            expect(metadata.hasCoordinates).toBe(true);
            
            // Verify description contains metadata
            expect(metadata.description).toBeTruthy();
            const hasRequiredMetadata = descriptionContainsMetadata(
              metadata.description!,
              data.parcelle,
              options.includeNDVI,
              data.ndvi
            );
            expect(hasRequiredMetadata).toBe(true);
          });
        }
      ),
      { numRuns: 50 }
    );
  });
  
  it('should organize batch exports into folders when multiple parcelles exist', () => {
    fc.assert(
      fc.asyncProperty(
        fc.array(kmlExportDataArb, { minLength: 2, maxLength: 10 }),
        kmlExportOptionsArb.map(opts => ({ ...opts, includeTemporal: false })),
        async (dataArray, options) => {
          // Generate batch KML
          const kml = await exportService.exportKML(dataArray, options);
          
          // Parse KML structure
          const parsed = parseKML(kml);
          
          // Batch exports should have folder structure
          expect(parsed.hasFolder).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Property 15: KML Specification Compliance
// ============================================================================

describe('Property 15: KML Specification Compliance', () => {
  const exportService = new ExportService();
  
  it('should include proper XML declaration and KML 2.2 namespace', () => {
    fc.assert(
      fc.asyncProperty(
        kmlExportDataArb,
        kmlExportOptionsArb,
        async (data, options) => {
          // Generate KML
          const kml = await exportService.exportKML([data], options);
          
          // Parse KML structure
          const parsed = parseKML(kml);
          
          // Verify XML declaration
          expect(parsed.hasXMLDeclaration).toBe(true);
          expect(kml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
          
          // Verify KML 2.2 namespace
          expect(parsed.hasKMLNamespace).toBe(true);
          expect(kml).toContain('xmlns="http://www.opengis.net/kml/2.2"');
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should have valid element nesting (Document contains Placemarks)', () => {
    fc.assert(
      fc.asyncProperty(
        kmlExportDataArb,
        kmlExportOptionsArb,
        async (data, options) => {
          // Generate KML
          const kml = await exportService.exportKML([data], options);
          
          // Parse KML structure
          const parsed = parseKML(kml);
          
          // Verify Document element exists
          expect(parsed.hasDocument).toBe(true);
          
          // Verify Placemarks exist
          expect(parsed.placemarkCount).toBeGreaterThan(0);
          
          // Verify basic XML well-formedness
          expect(isWellFormedXML(kml)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should include required Style elements with proper structure', () => {
    fc.assert(
      fc.asyncProperty(
        kmlExportDataArb,
        kmlExportOptionsArb,
        async (data, options) => {
          // Generate KML
          const kml = await exportService.exportKML([data], options);
          
          // Parse KML structure
          const parsed = parseKML(kml);
          
          // Verify styles exist
          expect(parsed.hasStyles).toBe(true);
          
          // Verify all health status styles are defined
          const healthStatuses = ['excellent', 'good', 'fair', 'poor', 'critical'];
          healthStatuses.forEach(status => {
            expect(kml).toContain(`<Style id="style_${status}">`);
            expect(kml).toContain('</Style>');
          });
          
          // Verify style elements contain LineStyle and PolyStyle
          expect(kml).toContain('<LineStyle>');
          expect(kml).toContain('<PolyStyle>');
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should properly escape XML special characters in text content', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          parcelle: fc.record({
            id: fc.uuid(),
            code: fc.option(fc.stringMatching(/^[A-Z0-9-]{3,10}$/), { nil: null }),
            label: fc.constantFrom(
              'Test & Label',
              'Test < Label',
              'Test > Label',
              'Test "Quote" Label',
              "Test 'Apostrophe' Label"
            ),
            village: fc.option(fc.string({ minLength: 3, maxLength: 50 }), { nil: null }),
            region: fc.option(fc.constantFrom('Centre', 'Littoral', 'Ouest', 'Sud'), { nil: null }),
            geometry: multiPolygonArb,
            surface_hectares: fc.double({ min: 0.1, max: 100, noNaN: true, noDefaultInfinity: true }),
            planteur_name: fc.option(fc.string({ minLength: 3, maxLength: 50 }), { nil: null })
          }),
          ndvi: fc.option(ndviResultArb),
          deforestation: fc.constant(undefined),
          temporal: fc.constant(undefined)
        }),
        kmlExportOptionsArb,
        async (data, options) => {
          // Generate KML
          const kml = await exportService.exportKML([data], options);
          
          // Verify special characters are escaped in name elements
          const nameMatch = kml.match(/<name>(.*?)<\/name>/);
          if (nameMatch && data.parcelle.label) {
            const nameContent = nameMatch[1];
            
            // Should not contain unescaped special characters
            expect(nameContent).not.toContain('&');
            expect(nameContent).not.toContain('<');
            expect(nameContent).not.toContain('>');
            
            // Should contain escaped versions if original had special chars
            if (data.parcelle.label.includes('&')) {
              expect(nameContent).toContain('&amp;');
            }
            if (data.parcelle.label.includes('<')) {
              expect(nameContent).toContain('&lt;');
            }
            if (data.parcelle.label.includes('>')) {
              expect(nameContent).toContain('&gt;');
            }
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Property 16: Time-Enabled KML Structure
// ============================================================================

describe('Property 16: Time-Enabled KML Structure', () => {
  const exportService = new ExportService();
  
  it('should include TimeStamp elements for each temporal data point', () => {
    fc.assert(
      fc.asyncProperty(
        kmlExportDataArb.filter(data => data.temporal && data.temporal.length > 0),
        kmlExportOptionsArb.map(opts => ({ ...opts, includeTemporal: true })),
        async (data, options) => {
          // Skip if temporal data is undefined (shouldn't happen with filter, but be safe)
          if (!data.temporal || data.temporal.length === 0) return true;
          
          // Generate KML
          const kml = await exportService.exportKML([data], options);
          
          // Parse KML structure
          const parsed = parseKML(kml);
          
          // Verify TimeStamp elements exist
          expect(parsed.hasTimeStamp).toBe(true);
          
          // Count TimeStamp elements
          const timeStampCount = (kml.match(/<TimeStamp>/g) || []).length;
          
          // Should have one TimeStamp per temporal data point
          expect(timeStampCount).toBe(data.temporal.length);
        }
      ),
      { numRuns: 50 }
    );
  });
  
  it('should format timestamps in ISO 8601 format', () => {
    fc.assert(
      fc.asyncProperty(
        kmlExportDataArb.filter(data => data.temporal && data.temporal.length > 0),
        kmlExportOptionsArb.map(opts => ({ ...opts, includeTemporal: true })),
        async (data, options) => {
          // Skip if temporal data is undefined
          if (!data.temporal || data.temporal.length === 0) return true;
          
          // Generate KML
          const kml = await exportService.exportKML([data], options);
          
          // Extract all timestamps
          const timestampRegex = /<when>(.*?)<\/when>/g;
          const timestamps = [...kml.matchAll(timestampRegex)].map(match => match[1]);
          
          // Verify each timestamp is in ISO 8601 format
          timestamps.forEach(timestamp => {
            expect(isValidISO8601(timestamp)).toBe(true);
          });
          
          // Verify we have the expected number of timestamps
          expect(timestamps.length).toBe(data.temporal.length);
        }
      ),
      { numRuns: 50 }
    );
  });
  
  it('should create one Placemark per temporal data point with correct date', () => {
    fc.assert(
      fc.asyncProperty(
        kmlExportDataArb.filter(data => data.temporal && data.temporal.length > 0),
        kmlExportOptionsArb.map(opts => ({ ...opts, includeTemporal: true })),
        async (data, options) => {
          // Skip if temporal data is undefined
          if (!data.temporal || data.temporal.length === 0) return true;
          
          // Generate KML
          const kml = await exportService.exportKML([data], options);
          
          // Extract placemarks
          const placemarks = extractPlacemarks(kml);
          
          // Should have one placemark per temporal point
          expect(placemarks.length).toBe(data.temporal.length);
          
          // Verify each placemark has a timestamp
          placemarks.forEach(placemark => {
            const metadata = extractPlacemarkMetadata(placemark);
            expect(metadata.timeStamp).toBeTruthy();
            expect(isValidISO8601(metadata.timeStamp!)).toBe(true);
          });
        }
      ),
      { numRuns: 50 }
    );
  });
  
  it('should organize temporal placemarks in a Folder', () => {
    fc.assert(
      fc.asyncProperty(
        kmlExportDataArb.filter(data => data.temporal && data.temporal.length > 0),
        kmlExportOptionsArb.map(opts => ({ ...opts, includeTemporal: true })),
        async (data, options) => {
          // Skip if temporal data is undefined
          if (!data.temporal || data.temporal.length === 0) return true;
          
          // Generate KML
          const kml = await exportService.exportKML([data], options);
          
          // Parse KML structure
          const parsed = parseKML(kml);
          
          // Temporal exports should have folder structure
          expect(parsed.hasFolder).toBe(true);
          
          // Verify folder contains "Temporal Analysis" in name
          expect(kml).toContain('Temporal Analysis');
        }
      ),
      { numRuns: 50 }
    );
  });
  
  it('should sort temporal data chronologically in time-enabled KML', () => {
    fc.assert(
      fc.asyncProperty(
        kmlExportDataArb.filter(data => data.temporal && data.temporal.length > 1),
        kmlExportOptionsArb.map(opts => ({ ...opts, includeTemporal: true })),
        async (data, options) => {
          // Skip if temporal data is undefined or has less than 2 points
          if (!data.temporal || data.temporal.length < 2) return true;
          
          // Generate KML
          const kml = await exportService.exportKML([data], options);
          
          // Extract all timestamps
          const timestampRegex = /<when>(.*?)<\/when>/g;
          const timestamps = [...kml.matchAll(timestampRegex)].map(match => match[1]);
          
          // Convert to Date objects
          const dates = timestamps.map(ts => new Date(ts));
          
          // Verify chronological order
          for (let i = 1; i < dates.length; i++) {
            expect(dates[i].getTime()).toBeGreaterThanOrEqual(dates[i - 1].getTime());
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
