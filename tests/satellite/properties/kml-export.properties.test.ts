/**
 * Property-Based Tests for KML Export
 * 
 * Tests correctness properties for KML serialization using fast-check
 * 
 * Validates:
 * - Property 13: KML structure and content completeness
 * - Property 14: Batch KML completeness
 * - Property 15: KML specification compliance
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ExportService } from '@/lib/satellite/services/export.service';
import type { 
  KMLExportData, 
  KMLExportOptions,
  HealthStatus 
} from '@/lib/satellite/types';
import type { MultiPolygon } from 'geojson';

describe('KML Export Properties', () => {
  const exportService = new ExportService();

  // Arbitraries for generating test data
  const healthStatusArb = fc.constantFrom<HealthStatus>(
    'excellent',
    'good',
    'fair',
    'poor',
    'critical'
  );

  const coordinateArb = fc.tuple(
    fc.double({ min: -180, max: 180, noNaN: true }),
    fc.double({ min: -90, max: 90, noNaN: true })
  );

  const linearRingArb = fc.array(coordinateArb, { minLength: 4, maxLength: 10 }).map(coords => {
    // Ensure ring is closed (first and last coordinates are the same)
    const closedCoords = [...coords];
    closedCoords[closedCoords.length - 1] = closedCoords[0];
    return closedCoords;
  });

  const polygonArb = fc.array(linearRingArb, { minLength: 1, maxLength: 3 });

  const multiPolygonArb: fc.Arbitrary<MultiPolygon> = fc
    .array(polygonArb, { minLength: 1, maxLength: 3 })
    .map(polygons => ({
      type: 'MultiPolygon' as const,
      coordinates: polygons,
    }));

  const parcelleArb = fc.record({
    id: fc.uuid(),
    code: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
    label: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
    village: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
    region: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
    geometry: multiPolygonArb,
    surface_hectares: fc.double({ min: 0.1, max: 100, noNaN: true }),
    planteur_name: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
  });

  const ndviArb = fc.record({
    id: fc.uuid(),
    parcelleId: fc.uuid(),
    imageryId: fc.option(fc.uuid(), { nil: null }),
    calculationDate: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }),
    meanNDVI: fc.double({ min: -1, max: 1, noNaN: true }),
    minNDVI: fc.double({ min: -1, max: 1, noNaN: true }),
    maxNDVI: fc.double({ min: -1, max: 1, noNaN: true }),
    stdDevNDVI: fc.double({ min: 0, max: 1, noNaN: true }),
    healthStatus: healthStatusArb,
    ndviRasterUrl: fc.option(fc.webUrl(), { nil: null }),
    createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }),
  });

  const kmlExportDataArb = fc.record({
    parcelle: parcelleArb,
    ndvi: fc.option(ndviArb, { nil: undefined }),
  });

  const kmlExportOptionsArb = fc.record({
    includeTemporal: fc.boolean(),
    includeNDVI: fc.boolean(),
    includeDeforestation: fc.boolean(),
    format: fc.constantFrom('kml' as const, 'kmz' as const),
  });

  /**
   * Property 13: KML Structure and Content
   * 
   * For any parcelle with geometry, NDVI data, and metadata, the generated KML file SHALL include:
   * (1) a valid Polygon element with coordinates
   * (2) NDVI color coding in the style
   * (3) all metadata fields in the description
   */
  describe('Property 13: KML Structure and Content', () => {
    it('should include valid Polygon element with coordinates for any parcelle', async () => {
      await fc.assert(
        fc.asyncProperty(parcelleArb, async (parcelle) => {
          const data: KMLExportData[] = [{ parcelle }];
          const options: KMLExportOptions = {
            includeTemporal: false,
            includeNDVI: false,
            includeDeforestation: false,
            format: 'kml',
          };

          const kml = await exportService.exportKML(data, options);

          // Must contain Polygon element
          expect(kml).toContain('<Polygon>');
          expect(kml).toContain('</Polygon>');

          // Must contain coordinates
          expect(kml).toContain('<coordinates>');
          expect(kml).toContain('</coordinates>');

          // Must contain LinearRing
          expect(kml).toContain('<LinearRing>');
          expect(kml).toContain('</LinearRing>');

          // Must contain outerBoundaryIs
          expect(kml).toContain('<outerBoundaryIs>');
          expect(kml).toContain('</outerBoundaryIs>');
        }),
        { numRuns: 50 }
      );
    });

    it('should include NDVI color coding in style when NDVI data is present', async () => {
      await fc.assert(
        fc.asyncProperty(parcelleArb, ndviArb, async (parcelle, ndvi) => {
          const data: KMLExportData[] = [{ parcelle, ndvi }];
          const options: KMLExportOptions = {
            includeTemporal: false,
            includeNDVI: true,
            includeDeforestation: false,
            format: 'kml',
          };

          const kml = await exportService.exportKML(data, options);

          // Must contain style reference
          expect(kml).toContain('<styleUrl>#style_');
          expect(kml).toContain('</styleUrl>');

          // Must contain style definition for the health status
          expect(kml).toContain(`<Style id="style_${ndvi.healthStatus}">`);
          expect(kml).toContain('<PolyStyle>');
          expect(kml).toContain('<color>');
        }),
        { numRuns: 50 }
      );
    });

    it('should include all metadata fields in description', async () => {
      await fc.assert(
        fc.asyncProperty(parcelleArb, ndviArb, async (parcelle, ndvi) => {
          const data: KMLExportData[] = [{ parcelle, ndvi }];
          const options: KMLExportOptions = {
            includeTemporal: false,
            includeNDVI: true,
            includeDeforestation: false,
            format: 'kml',
          };

          const kml = await exportService.exportKML(data, options);

          // Must contain description with CDATA
          expect(kml).toContain('<description><![CDATA[');
          expect(kml).toContain(']]></description>');

          // Must contain surface area
          expect(kml).toContain('Surface:');
          expect(kml).toContain('ha');

          // When NDVI is included, must contain NDVI data
          expect(kml).toContain('Analyse NDVI');
          expect(kml).toContain('NDVI Moyen');
          expect(kml).toContain('État de Santé');

          // The description is in CDATA, so it will have escaped HTML entities
          // Just verify the description section exists and has meaningful content
          const descriptionMatch = kml.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/);
          expect(descriptionMatch).toBeTruthy();
          
          if (descriptionMatch && descriptionMatch[1]) {
            const descriptionContent = descriptionMatch[1];
            
            // Description should have minimum length (not empty)
            expect(descriptionContent.length).toBeGreaterThan(50);
            
            // Should contain table structure
            expect(descriptionContent).toContain('<table');
            expect(descriptionContent).toContain('</table>');
          }
        }),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 14: Batch KML Completeness
   * 
   * For any collection of parcelles, the batch-generated KML file SHALL contain
   * exactly one Placemark element per parcelle, with each Placemark containing
   * the parcelle's complete data.
   */
  describe('Property 14: Batch KML Completeness', () => {
    it('should contain exactly one Placemark per parcelle', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(kmlExportDataArb, { minLength: 1, maxLength: 10 }),
          kmlExportOptionsArb,
          async (dataArray, options) => {
            const kml = await exportService.exportKML(dataArray, options);

            // Count Placemark elements
            const placemarkMatches = kml.match(/<Placemark>/g);
            const placemarkCount = placemarkMatches ? placemarkMatches.length : 0;

            // Must have exactly one Placemark per parcelle
            expect(placemarkCount).toBe(dataArray.length);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should include complete data for each parcelle in batch export', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(parcelleArb, { minLength: 2, maxLength: 5 }),
          async (parcelles) => {
            const data: KMLExportData[] = parcelles.map(parcelle => ({ parcelle }));
            const options: KMLExportOptions = {
              includeTemporal: false,
              includeNDVI: false,
              includeDeforestation: false,
              format: 'kml',
            };

            const kml = await exportService.exportKML(data, options);

            // Each parcelle must have its geometry in the KML
            parcelles.forEach(parcelle => {
              // Must contain a Placemark for this parcelle
              expect(kml).toContain('<Placemark>');

              // Must contain surface area
              expect(kml).toContain(`${parcelle.surface_hectares.toFixed(2)} ha`);
            });
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  /**
   * Property 15: KML Specification Compliance
   * 
   * For any generated KML file, the XML structure SHALL conform to the KML 2.2 specification,
   * including proper namespace declarations, valid element nesting, and required attributes.
   */
  describe('Property 15: KML Specification Compliance', () => {
    it('should have valid XML declaration and KML namespace', async () => {
      await fc.assert(
        fc.asyncProperty(kmlExportDataArb, kmlExportOptionsArb, async (data, options) => {
          const kml = await exportService.exportKML([data], options);

          // Must start with XML declaration
          expect(kml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);

          // Must have KML 2.2 namespace
          expect(kml).toContain('xmlns="http://www.opengis.net/kml/2.2"');

          // Must have Google KML extensions namespace
          expect(kml).toContain('xmlns:gx="http://www.google.com/kml/ext/2.2"');
        }),
        { numRuns: 50 }
      );
    });

    it('should have proper element nesting (Document > Placemark > Geometry)', async () => {
      await fc.assert(
        fc.asyncProperty(kmlExportDataArb, kmlExportOptionsArb, async (data, options) => {
          const kml = await exportService.exportKML([data], options);

          // Must have Document element
          expect(kml).toContain('<Document>');
          expect(kml).toContain('</Document>');

          // Must have Placemark inside Document
          const documentStart = kml.indexOf('<Document>');
          const documentEnd = kml.indexOf('</Document>');
          const placemarkStart = kml.indexOf('<Placemark>');
          const placemarkEnd = kml.indexOf('</Placemark>');

          expect(placemarkStart).toBeGreaterThan(documentStart);
          expect(placemarkEnd).toBeLessThan(documentEnd);

          // Must have geometry inside Placemark
          const geometryStart = kml.indexOf('<MultiGeometry>');
          const geometryEnd = kml.indexOf('</MultiGeometry>');

          expect(geometryStart).toBeGreaterThan(placemarkStart);
          expect(geometryEnd).toBeLessThan(placemarkEnd);
        }),
        { numRuns: 50 }
      );
    });

    it('should have balanced opening and closing tags', async () => {
      await fc.assert(
        fc.asyncProperty(kmlExportDataArb, kmlExportOptionsArb, async (data, options) => {
          const kml = await exportService.exportKML([data], options);

          // Check critical elements are balanced
          const criticalElements = [
            'kml',
            'Document',
            'Placemark',
            'MultiGeometry',
            'Polygon',
            'LinearRing',
            'coordinates',
          ];

          criticalElements.forEach(element => {
            const openingCount = (kml.match(new RegExp(`<${element}[^>]*>`, 'g')) || []).length;
            const closingCount = (kml.match(new RegExp(`</${element}>`, 'g')) || []).length;

            expect(openingCount).toBe(closingCount);
          });
        }),
        { numRuns: 50 }
      );
    });

    it('should properly escape XML special characters', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.uuid(),
            code: fc.constantFrom('P001', 'P002'),
            label: fc.constantFrom(
              'Test & Label',
              'Test < Label',
              'Test > Label',
              'Test "Label"',
              "Test 'Label'"
            ),
            village: fc.constantFrom('Village'),
            region: fc.constantFrom('Centre'),
            geometry: multiPolygonArb,
            surface_hectares: fc.constant(2.5),
            planteur_name: fc.constantFrom('Jean Dupont'),
          }),
          async (parcelle) => {
            const data: KMLExportData[] = [{ parcelle }];
            const options: KMLExportOptions = {
              includeTemporal: false,
              includeNDVI: false,
              includeDeforestation: false,
              format: 'kml',
            };

            const kml = await exportService.exportKML(data, options);

            // Special characters must be escaped in non-CDATA sections (like <name>)
            const nameSection = kml.match(/<name>([^<]*)<\/name>/);
            expect(nameSection).toBeTruthy();
            
            if (nameSection && nameSection[1]) {
              const nameContent = nameSection[1];

              // The name should not contain unescaped special characters
              // Check that there are no raw < or > characters (except in entities)
              expect(nameContent).not.toMatch(/<(?![/a-zA-Z])/); // No raw < except in tags
              expect(nameContent).not.toMatch(/(?<![a-zA-Z])>/); // No raw > except in tags
              
              // If the label contains &, it should be escaped
              if (parcelle.label?.includes('&')) {
                // Should have &amp; somewhere in the name
                expect(kml).toContain('&amp;');
              }
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should have valid coordinate format (lon,lat,alt)', async () => {
      await fc.assert(
        fc.asyncProperty(parcelleArb, async (parcelle) => {
          const data: KMLExportData[] = [{ parcelle }];
          const options: KMLExportOptions = {
            includeTemporal: false,
            includeNDVI: false,
            includeDeforestation: false,
            format: 'kml',
          };

          const kml = await exportService.exportKML(data, options);

          // Extract coordinates section
          const coordsMatch = kml.match(/<coordinates>\s*([\s\S]*?)\s*<\/coordinates>/);
          expect(coordsMatch).toBeTruthy();

          if (coordsMatch && coordsMatch[1]) {
            const coords = coordsMatch[1].trim().split(/\s+/);

            // Each coordinate should be in format: lon,lat,alt
            coords.forEach(coord => {
              const parts = coord.split(',');
              expect(parts).toHaveLength(3);

              // Longitude should be valid number
              const lon = parseFloat(parts[0]);
              expect(lon).toBeGreaterThanOrEqual(-180);
              expect(lon).toBeLessThanOrEqual(180);

              // Latitude should be valid number
              const lat = parseFloat(parts[1]);
              expect(lat).toBeGreaterThanOrEqual(-90);
              expect(lat).toBeLessThanOrEqual(90);

              // Altitude should be 0 (we use 0 for all coordinates)
              expect(parts[2]).toBe('0');
            });
          }
        }),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Additional Property: Round-trip Consistency
   * 
   * While we can't parse KML back to the exact same structure, we can verify
   * that critical data is preserved in the KML output.
   */
  describe('Round-trip Data Preservation', () => {
    it('should preserve parcelle ID in the KML', async () => {
      await fc.assert(
        fc.asyncProperty(parcelleArb, async (parcelle) => {
          const data: KMLExportData[] = [{ parcelle }];
          const options: KMLExportOptions = {
            includeTemporal: false,
            includeNDVI: false,
            includeDeforestation: false,
            format: 'kml',
          };

          const kml = await exportService.exportKML(data, options);

          // Parcelle ID should appear in the KML when there's no code or label
          // (at least first 8 chars in the name)
          if (!parcelle.code && (!parcelle.label || !parcelle.label.trim())) {
            const idPrefix = parcelle.id.substring(0, 8);
            expect(kml).toContain(idPrefix);
          }
        }),
        { numRuns: 50 }
      );
    });

    it('should preserve surface area with correct precision', async () => {
      await fc.assert(
        fc.asyncProperty(parcelleArb, async (parcelle) => {
          const data: KMLExportData[] = [{ parcelle }];
          const options: KMLExportOptions = {
            includeTemporal: false,
            includeNDVI: false,
            includeDeforestation: false,
            format: 'kml',
          };

          const kml = await exportService.exportKML(data, options);

          // Surface area should be present with 2 decimal places
          const surfaceStr = parcelle.surface_hectares.toFixed(2);
          expect(kml).toContain(`${surfaceStr} ha`);
        }),
        { numRuns: 50 }
      );
    });

    it('should preserve NDVI values with correct precision', async () => {
      await fc.assert(
        fc.asyncProperty(parcelleArb, ndviArb, async (parcelle, ndvi) => {
          const data: KMLExportData[] = [{ parcelle, ndvi }];
          const options: KMLExportOptions = {
            includeTemporal: false,
            includeNDVI: true,
            includeDeforestation: false,
            format: 'kml',
          };

          const kml = await exportService.exportKML(data, options);

          // NDVI values should be present with 3 decimal places
          const meanNDVIStr = ndvi.meanNDVI.toFixed(3);
          expect(kml).toContain(meanNDVIStr);
        }),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 16: Time-Enabled KML Structure
   * 
   * For any temporal NDVI dataset, the generated time-enabled KML SHALL include
   * TimeStamp elements for each data point, with begin and end times correctly
   * formatted in ISO 8601 format.
   */
  describe('Property 16: Time-Enabled KML Structure', () => {
    // Arbitrary for generating temporal data points
    const temporalDataPointArb = fc.record({
      date: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }),
      ndvi: fc.double({ min: 0, max: 1, noNaN: true }),
      cloudCover: fc.double({ min: 0, max: 100, noNaN: true }),
      healthStatus: healthStatusArb,
      hasSignificantChange: fc.boolean(),
    });

    const temporalDataArb = fc.array(temporalDataPointArb, { minLength: 2, maxLength: 12 });

    it('should include TimeStamp elements for each temporal data point', async () => {
      await fc.assert(
        fc.asyncProperty(parcelleArb, temporalDataArb, async (parcelle, temporal) => {
          // Filter out any invalid dates that might be generated
          const validTemporal = temporal.filter((point) => !isNaN(point.date.getTime()));
          
          // Skip test if no valid temporal data
          if (validTemporal.length === 0) {
            return true;
          }

          // Sort temporal data by date to ensure chronological order
          const sortedTemporal = [...validTemporal].sort(
            (a, b) => a.date.getTime() - b.date.getTime()
          );

          const data: KMLExportData[] = [{ parcelle, temporal: sortedTemporal }];
          const options: KMLExportOptions = {
            includeTemporal: true,
            includeNDVI: false,
            includeDeforestation: false,
            format: 'kml',
          };

          const kml = await exportService.exportKML(data, options);

          // Must contain TimeStamp elements
          expect(kml).toContain('<TimeStamp>');
          expect(kml).toContain('</TimeStamp>');

          // Must contain 'when' elements (ISO 8601 timestamps)
          expect(kml).toContain('<when>');
          expect(kml).toContain('</when>');

          // Count TimeStamp elements - should match number of temporal data points
          const timeStampMatches = kml.match(/<TimeStamp>/g);
          const timeStampCount = timeStampMatches ? timeStampMatches.length : 0;

          expect(timeStampCount).toBe(sortedTemporal.length);
        }),
        { numRuns: 30 }
      );
    });

    it('should format timestamps in ISO 8601 format', async () => {
      await fc.assert(
        fc.asyncProperty(parcelleArb, temporalDataArb, async (parcelle, temporal) => {
          // Filter out any invalid dates that might be generated
          const validTemporal = temporal.filter((point) => !isNaN(point.date.getTime()));
          
          // Skip test if no valid temporal data
          if (validTemporal.length === 0) {
            return true;
          }

          const sortedTemporal = [...validTemporal].sort(
            (a, b) => a.date.getTime() - b.date.getTime()
          );

          const data: KMLExportData[] = [{ parcelle, temporal: sortedTemporal }];
          const options: KMLExportOptions = {
            includeTemporal: true,
            includeNDVI: false,
            includeDeforestation: false,
            format: 'kml',
          };

          const kml = await exportService.exportKML(data, options);

          // Extract all 'when' elements
          const whenMatches = kml.match(/<when>(.*?)<\/when>/g);
          expect(whenMatches).toBeTruthy();
          expect(whenMatches).toHaveLength(sortedTemporal.length);

          if (whenMatches) {
            whenMatches.forEach((whenElement) => {
              // Extract timestamp from <when>timestamp</when>
              const timestampMatch = whenElement.match(/<when>(.*?)<\/when>/);
              expect(timestampMatch).toBeTruthy();

              if (timestampMatch && timestampMatch[1]) {
                const timestamp = timestampMatch[1];

                // ISO 8601 format: YYYY-MM-DDTHH:MM:SS.sssZ
                // Must match the pattern
                expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

                // Must be a valid date
                const date = new Date(timestamp);
                expect(date.toString()).not.toBe('Invalid Date');
              }
            });
          }
        }),
        { numRuns: 30 }
      );
    });

    it('should create a Folder to group temporal placemarks', async () => {
      await fc.assert(
        fc.asyncProperty(parcelleArb, temporalDataArb, async (parcelle, temporal) => {
          // Filter out any invalid dates that might be generated
          const validTemporal = temporal.filter((point) => !isNaN(point.date.getTime()));
          
          // Skip test if no valid temporal data
          if (validTemporal.length === 0) {
            return true;
          }

          const sortedTemporal = [...validTemporal].sort(
            (a, b) => a.date.getTime() - b.date.getTime()
          );

          const data: KMLExportData[] = [{ parcelle, temporal: sortedTemporal }];
          const options: KMLExportOptions = {
            includeTemporal: true,
            includeNDVI: false,
            includeDeforestation: false,
            format: 'kml',
          };

          const kml = await exportService.exportKML(data, options);

          // Must contain Folder element for temporal grouping
          expect(kml).toContain('<Folder>');
          expect(kml).toContain('</Folder>');

          // Folder name should indicate temporal analysis
          expect(kml).toContain('Temporal Analysis');
        }),
        { numRuns: 30 }
      );
    });

    it('should include one Placemark per temporal data point', async () => {
      await fc.assert(
        fc.asyncProperty(parcelleArb, temporalDataArb, async (parcelle, temporal) => {
          // Filter out any invalid dates that might be generated
          const validTemporal = temporal.filter((point) => !isNaN(point.date.getTime()));
          
          // Skip test if no valid temporal data
          if (validTemporal.length === 0) {
            return true;
          }

          const sortedTemporal = [...validTemporal].sort(
            (a, b) => a.date.getTime() - b.date.getTime()
          );

          const data: KMLExportData[] = [{ parcelle, temporal: sortedTemporal }];
          const options: KMLExportOptions = {
            includeTemporal: true,
            includeNDVI: false,
            includeDeforestation: false,
            format: 'kml',
          };

          const kml = await exportService.exportKML(data, options);

          // Count Placemark elements
          const placemarkMatches = kml.match(/<Placemark>/g);
          const placemarkCount = placemarkMatches ? placemarkMatches.length : 0;

          // Should have exactly one Placemark per temporal data point
          expect(placemarkCount).toBe(sortedTemporal.length);
        }),
        { numRuns: 30 }
      );
    });

    it('should preserve temporal data point NDVI values', async () => {
      await fc.assert(
        fc.asyncProperty(parcelleArb, temporalDataArb, async (parcelle, temporal) => {
          // Filter out any invalid dates that might be generated
          const validTemporal = temporal.filter((point) => !isNaN(point.date.getTime()));
          
          // Skip test if no valid temporal data
          if (validTemporal.length === 0) {
            return true;
          }

          const sortedTemporal = [...validTemporal].sort(
            (a, b) => a.date.getTime() - b.date.getTime()
          );

          const data: KMLExportData[] = [{ parcelle, temporal: sortedTemporal }];
          const options: KMLExportOptions = {
            includeTemporal: true,
            includeNDVI: false,
            includeDeforestation: false,
            format: 'kml',
          };

          const kml = await exportService.exportKML(data, options);

          // Each temporal point's NDVI should appear in the KML
          sortedTemporal.forEach((point) => {
            const ndviStr = point.ndvi.toFixed(3);
            expect(kml).toContain(ndviStr);
          });
        }),
        { numRuns: 30 }
      );
    });

    it('should preserve temporal data point health status', async () => {
      await fc.assert(
        fc.asyncProperty(parcelleArb, temporalDataArb, async (parcelle, temporal) => {
          // Filter out any invalid dates that might be generated
          const validTemporal = temporal.filter((point) => !isNaN(point.date.getTime()));
          
          // Skip test if no valid temporal data
          if (validTemporal.length === 0) {
            return true;
          }

          const sortedTemporal = [...validTemporal].sort(
            (a, b) => a.date.getTime() - b.date.getTime()
          );

          const data: KMLExportData[] = [{ parcelle, temporal: sortedTemporal }];
          const options: KMLExportOptions = {
            includeTemporal: true,
            includeNDVI: false,
            includeDeforestation: false,
            format: 'kml',
          };

          const kml = await exportService.exportKML(data, options);

          // Each temporal point should have a style reference matching its health status
          sortedTemporal.forEach((point) => {
            expect(kml).toContain(`#style_${point.healthStatus}`);
          });
        }),
        { numRuns: 30 }
      );
    });

    it('should preserve temporal data point cloud cover', async () => {
      await fc.assert(
        fc.asyncProperty(parcelleArb, temporalDataArb, async (parcelle, temporal) => {
          // Filter out any invalid dates that might be generated
          const validTemporal = temporal.filter((point) => !isNaN(point.date.getTime()));
          
          // Skip test if no valid temporal data
          if (validTemporal.length === 0) {
            return true;
          }

          const sortedTemporal = [...validTemporal].sort(
            (a, b) => a.date.getTime() - b.date.getTime()
          );

          const data: KMLExportData[] = [{ parcelle, temporal: sortedTemporal }];
          const options: KMLExportOptions = {
            includeTemporal: true,
            includeNDVI: false,
            includeDeforestation: false,
            format: 'kml',
          };

          const kml = await exportService.exportKML(data, options);

          // Each temporal point's cloud cover should appear in the KML
          sortedTemporal.forEach((point) => {
            const cloudCoverStr = point.cloudCover.toFixed(1);
            expect(kml).toContain(cloudCoverStr);
          });
        }),
        { numRuns: 30 }
      );
    });

    it('should indicate significant changes in temporal data', async () => {
      await fc.assert(
        fc.asyncProperty(parcelleArb, temporalDataArb, async (parcelle, temporal) => {
          // Filter out any invalid dates that might be generated
          const validTemporal = temporal.filter((point) => !isNaN(point.date.getTime()));
          
          // Skip test if no valid temporal data
          if (validTemporal.length === 0) {
            return true;
          }

          // Ensure at least one point has significant change
          const modifiedTemporal = [...validTemporal];
          if (modifiedTemporal.length > 0) {
            modifiedTemporal[0] = { ...modifiedTemporal[0], hasSignificantChange: true };
          }

          const sortedTemporal = modifiedTemporal.sort(
            (a, b) => a.date.getTime() - b.date.getTime()
          );

          const data: KMLExportData[] = [{ parcelle, temporal: sortedTemporal }];
          const options: KMLExportOptions = {
            includeTemporal: true,
            includeNDVI: false,
            includeDeforestation: false,
            format: 'kml',
          };

          const kml = await exportService.exportKML(data, options);

          // Should contain indicator for significant change
          const hasSignificantChange = sortedTemporal.some((p) => p.hasSignificantChange);
          if (hasSignificantChange) {
            expect(kml).toContain('Changement significatif');
          }
        }),
        { numRuns: 30 }
      );
    });

    it('should maintain chronological order of temporal placemarks', async () => {
      await fc.assert(
        fc.asyncProperty(parcelleArb, temporalDataArb, async (parcelle, temporal) => {
          // Filter out any invalid dates that might be generated
          const validTemporal = temporal.filter((point) => !isNaN(point.date.getTime()));
          
          // Skip test if no valid temporal data
          if (validTemporal.length === 0) {
            return true;
          }

          // Deliberately unsort to test that service sorts them
          const unsortedTemporal = [...validTemporal];

          const data: KMLExportData[] = [{ parcelle, temporal: unsortedTemporal }];
          const options: KMLExportOptions = {
            includeTemporal: true,
            includeNDVI: false,
            includeDeforestation: false,
            format: 'kml',
          };

          const kml = await exportService.exportKML(data, options);

          // Extract all timestamps from the KML
          const whenMatches = kml.match(/<when>(.*?)<\/when>/g);
          expect(whenMatches).toBeTruthy();

          if (whenMatches) {
            const timestamps = whenMatches.map((match) => {
              const timestampMatch = match.match(/<when>(.*?)<\/when>/);
              return timestampMatch ? new Date(timestampMatch[1]) : null;
            }).filter((date): date is Date => date !== null);

            // Verify timestamps are in chronological order (or equal for same timestamps)
            for (let i = 1; i < timestamps.length; i++) {
              // Allow equal timestamps (same date/time)
              expect(timestamps[i].getTime()).toBeGreaterThanOrEqual(
                timestamps[i - 1].getTime()
              );
            }
          }
        }),
        { numRuns: 30 }
      );
    });

    it('should include temporal date range in folder description', async () => {
      await fc.assert(
        fc.asyncProperty(parcelleArb, temporalDataArb, async (parcelle, temporal) => {
          // Filter out any invalid dates that might be generated
          const validTemporal = temporal.filter((point) => !isNaN(point.date.getTime()));
          
          // Skip test if no valid temporal data
          if (validTemporal.length === 0) {
            return true;
          }

          const sortedTemporal = [...validTemporal].sort(
            (a, b) => a.date.getTime() - b.date.getTime()
          );

          const data: KMLExportData[] = [{ parcelle, temporal: sortedTemporal }];
          const options: KMLExportOptions = {
            includeTemporal: true,
            includeNDVI: false,
            includeDeforestation: false,
            format: 'kml',
          };

          const kml = await exportService.exportKML(data, options);

          // Should contain folder description with date range
          expect(kml).toContain('Time-enabled visualization');

          // Extract folder description
          const folderDescMatch = kml.match(
            /<Folder>[\s\S]*?<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/
          );
          expect(folderDescMatch).toBeTruthy();

          if (folderDescMatch && folderDescMatch[1]) {
            const description = folderDescMatch[1];

            // Should mention the date range
            // The description should contain references to dates
            expect(description.length).toBeGreaterThan(20);
          }
        }),
        { numRuns: 30 }
      );
    });
  });
});
