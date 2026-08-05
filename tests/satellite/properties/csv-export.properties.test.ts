/**
 * Property-Based Tests for CSV Export
 * 
 * This file implements property-based testing for CSV serialization logic using fast-check.
 * Property-based testing validates that certain properties hold true across a wide range
 * of randomly generated inputs, providing stronger correctness guarantees than example-based tests.
 * 
 * Properties tested:
 * - Property 8: Temporal CSV serialization
 * 
 * Requirements: Task 3.4.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  convertTemporalDataToCSV,
  generateTemporalCSVFilename,
  type TemporalCSVDataPoint,
} from '@/lib/satellite/utils/csv-export';

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
const EPSILON = 1e-4; // 4 decimal places precision for CSV

// ============================================================================
// Custom Arbitraries
// ============================================================================

/**
 * Arbitrary for generating valid dates within a reasonable range
 * Range: 2020-01-01 to 2030-12-31
 * Filters out invalid dates (NaN)
 */
const dateArbitrary = fc
  .date({
    min: new Date('2020-01-01'),
    max: new Date('2030-12-31'),
  })
  .filter(date => !isNaN(date.getTime()));

/**
 * Arbitrary for generating NDVI values in valid range [-1, 1]
 */
const ndviValueArbitrary = fc.double({ min: -1, max: 1, noNaN: true });

/**
 * Arbitrary for generating health status values
 */
const healthStatusArbitrary = fc.constantFrom(
  'excellent',
  'good',
  'fair',
  'poor',
  'critical'
) as fc.Arbitrary<'excellent' | 'good' | 'fair' | 'poor' | 'critical'>;

/**
 * Arbitrary for generating temporal CSV data points
 */
const temporalCSVDataPointArbitrary = fc.record({
  date: dateArbitrary,
  ndvi: ndviValueArbitrary,
  cloudCover: fc.double({ min: 0, max: 100, noNaN: true }),
  healthStatus: healthStatusArbitrary,
  hasSignificantChange: fc.boolean(),
  minNDVI: fc.option(ndviValueArbitrary, { nil: undefined }),
  maxNDVI: fc.option(ndviValueArbitrary, { nil: undefined }),
}) as fc.Arbitrary<TemporalCSVDataPoint>;

/**
 * Arbitrary for generating arrays of temporal CSV data points
 * Ensures dates are sorted in ascending order
 */
const temporalTimelineArbitrary = fc
  .array(temporalCSVDataPointArbitrary, { minLength: 0, maxLength: 50 })
  .map(points => {
    // Sort by date ascending
    return points.sort((a, b) => a.date.getTime() - b.date.getTime());
  });

/**
 * Arbitrary for generating parcelle IDs (UUIDs)
 */
const parcelleIdArbitrary = fc.uuid();

/**
 * Arbitrary for generating date ranges (start date before end date)
 */
const dateRangeArbitrary = fc
  .tuple(dateArbitrary, dateArbitrary)
  .map(([date1, date2]) => {
    // Ensure start date is before end date
    const start = date1 < date2 ? date1 : date2;
    const end = date1 < date2 ? date2 : date1;
    return { start, end };
  });

// ============================================================================
// Property 8: Temporal CSV Serialization
// ============================================================================

describe('Property 8: Temporal CSV Serialization', () => {
  /**
   * Property 8.1: CSV contains all data points
   * 
   * For any temporal NDVI dataset containing dates, NDVI values, and change metrics,
   * the generated CSV SHALL include all data points with correct formatting.
   * 
   * This validates that no data is lost during serialization.
   */
  it('should include all data points in CSV output', () => {
    fc.assert(
      fc.property(temporalTimelineArbitrary, timeline => {
        const csv = convertTemporalDataToCSV(timeline);
        const lines = csv.split('\n').filter(line => line.length > 0);

        // Number of data lines should equal timeline length
        // (plus 1 for header)
        const expectedLines = timeline.length > 0 ? timeline.length + 1 : 1;
        expect(lines.length).toBe(expectedLines);

        return true;
      }),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 8.2: CSV has correct header format
   * 
   * For any temporal dataset, the generated CSV SHALL include a header row
   * with the exact columns: date, mean_ndvi, min_ndvi, max_ndvi, change_from_previous.
   * 
   * This validates the CSV structure matches the specification.
   */
  it('should include correct header row', () => {
    fc.assert(
      fc.property(temporalTimelineArbitrary, timeline => {
        const csv = convertTemporalDataToCSV(timeline);
        const lines = csv.split('\n');

        // First line should be the header
        expect(lines[0]).toBe('date,mean_ndvi,mean_evi,mean_ndmi,mean_ndwi,mean_savi,min_ndvi,max_ndvi,change_from_previous');

        return true;
      }),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 8.3: CSV without headers omits header row
   * 
   * For any temporal dataset, when includeHeaders is false,
   * the generated CSV SHALL NOT include a header row.
   * 
   * This validates the header inclusion option works correctly.
   */
  it('should omit header row when includeHeaders is false', () => {
    fc.assert(
      fc.property(temporalTimelineArbitrary, timeline => {
        const csv = convertTemporalDataToCSV(timeline, false);
        const lines = csv.split('\n').filter(line => line.length > 0);

        // Should not contain header
        expect(csv).not.toContain('date,mean_ndvi');

        // Number of lines should equal timeline length (no header)
        expect(lines.length).toBe(timeline.length);

        return true;
      }),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 8.4: Each CSV row has exactly 9 columns
   * 
   * For any temporal dataset, each data row in the CSV SHALL have
   * exactly 8 comma-separated values (date, mean_ndvi, mean_evi, min_ndvi, max_ndvi, change_from_previous).
   * 
   * This validates the CSV column structure is consistent.
   */
  it('should have exactly 9 columns per data row', () => {
    fc.assert(
      fc.property(temporalTimelineArbitrary, timeline => {
        if (timeline.length === 0) {
          return true; // Skip empty timelines
        }

        const csv = convertTemporalDataToCSV(timeline);
        const lines = csv.split('\n').filter(line => line.length > 0);

        // Check each data row (skip header)
        for (let i = 1; i < lines.length; i++) {
          const columns = lines[i].split(',');
          expect(columns.length).toBe(9);
        }

        return true;
      }),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 8.5: Dates are formatted as YYYY-MM-DD
   * 
   * For any temporal dataset, all dates in the CSV SHALL be formatted
   * as ISO 8601 date strings (YYYY-MM-DD).
   * 
   * This validates date formatting consistency.
   */
  it('should format dates as YYYY-MM-DD', () => {
    fc.assert(
      fc.property(temporalTimelineArbitrary, timeline => {
        if (timeline.length === 0) {
          return true; // Skip empty timelines
        }

        const csv = convertTemporalDataToCSV(timeline);
        const lines = csv.split('\n').filter(line => line.length > 0);

        // ISO date regex: YYYY-MM-DD
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

        // Check each data row (skip header)
        for (let i = 1; i < lines.length; i++) {
          const columns = lines[i].split(',');
          const dateStr = columns[0];
          expect(dateRegex.test(dateStr)).toBe(true);
        }

        return true;
      }),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 8.6: NDVI values are formatted to 4 decimal places
   * 
   * For any temporal dataset, all NDVI values (mean, min, max, change)
   * SHALL be formatted to exactly 4 decimal places.
   * 
   * This validates numeric precision formatting.
   */
  it('should format NDVI values to 4 decimal places', () => {
    fc.assert(
      fc.property(temporalTimelineArbitrary, timeline => {
        if (timeline.length === 0) {
          return true; // Skip empty timelines
        }

        const csv = convertTemporalDataToCSV(timeline);
        const lines = csv.split('\n').filter(line => line.length > 0);

        // Regex for 4 decimal places: optional minus, digits, dot, exactly 4 digits
        const decimalRegex = /^-?\d+\.\d{4}$/;

        // Check each data row (skip header)
        for (let i = 1; i < lines.length; i++) {
          const columns = lines[i].split(',');
          const meanNDVI = columns[1];
          const minNDVI = columns[6];
          const maxNDVI = columns[7];
          const change = columns[8];

          expect(decimalRegex.test(meanNDVI)).toBe(true);
          expect(decimalRegex.test(minNDVI)).toBe(true);
          expect(decimalRegex.test(maxNDVI)).toBe(true);
          expect(decimalRegex.test(change)).toBe(true);
        }

        return true;
      }),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 8.7: First data point has zero change
   * 
   * For any temporal dataset with at least one data point,
   * the first data point SHALL have change_from_previous = 0.0000.
   * 
   * This validates the baseline change calculation.
   */
  it('should set first data point change to 0.0000', () => {
    fc.assert(
      fc.property(temporalTimelineArbitrary, timeline => {
        if (timeline.length === 0) {
          return true; // Skip empty timelines
        }

        const csv = convertTemporalDataToCSV(timeline);
        const lines = csv.split('\n').filter(line => line.length > 0);

        // Check first data row (index 1, after header)
        const firstDataRow = lines[1];
        const columns = firstDataRow.split(',');
        const change = columns[8];

        expect(change).toBe('0.0000');

        return true;
      }),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 8.8: Change calculation is correct
   * 
   * For any temporal dataset, the change_from_previous value SHALL equal
   * (current NDVI - previous NDVI) for all data points after the first.
   * 
   * This validates the change calculation formula.
   */
  it('should calculate change_from_previous correctly', () => {
    fc.assert(
      fc.property(temporalTimelineArbitrary, timeline => {
        if (timeline.length < 2) {
          return true; // Need at least 2 points for change
        }

        const csv = convertTemporalDataToCSV(timeline);
        const lines = csv.split('\n').filter(line => line.length > 0);

        // Check each data row after the first (skip header and first data row)
        for (let i = 2; i < lines.length; i++) {
          const columns = lines[i].split(',');
          const currentNDVI = parseFloat(columns[1]);
          const change = parseFloat(columns[8]);

          // Get previous NDVI from previous row
          const previousColumns = lines[i - 1].split(',');
          const previousNDVI = parseFloat(previousColumns[1]);

          // Calculate expected change
          const expectedChange = currentNDVI - previousNDVI;

          // Verify change is correct (within floating-point precision)
          expect(Math.abs(change - expectedChange)).toBeLessThan(EPSILON);
        }

        return true;
      }),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 8.9: Min NDVI defaults to mean when not provided
   * 
   * For any temporal dataset where minNDVI is undefined,
   * the min_ndvi column SHALL equal the mean_ndvi value.
   * 
   * This validates the default value behavior.
   */
  it('should use mean NDVI as min when minNDVI is undefined', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            date: dateArbitrary,
            ndvi: ndviValueArbitrary,
            cloudCover: fc.double({ min: 0, max: 100, noNaN: true }),
            healthStatus: healthStatusArbitrary,
            hasSignificantChange: fc.boolean(),
            // Explicitly set minNDVI to undefined
            minNDVI: fc.constant(undefined),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        timeline => {
          const csv = convertTemporalDataToCSV(timeline as TemporalCSVDataPoint[]);
          const lines = csv.split('\n').filter(line => line.length > 0);

          // Check each data row (skip header)
          for (let i = 1; i < lines.length; i++) {
            const columns = lines[i].split(',');
            const meanNDVI = columns[1];
            const minNDVI = columns[6];

            // Min should equal mean when not provided
            expect(minNDVI).toBe(meanNDVI);
          }

          return true;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 8.10: Max NDVI defaults to mean when not provided
   * 
   * For any temporal dataset where maxNDVI is undefined,
   * the max_ndvi column SHALL equal the mean_ndvi value.
   * 
   * This validates the default value behavior.
   */
  it('should use mean NDVI as max when maxNDVI is undefined', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            date: dateArbitrary,
            ndvi: ndviValueArbitrary,
            cloudCover: fc.double({ min: 0, max: 100, noNaN: true }),
            healthStatus: healthStatusArbitrary,
            hasSignificantChange: fc.boolean(),
            // Explicitly set maxNDVI to undefined
            maxNDVI: fc.constant(undefined),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        timeline => {
          const csv = convertTemporalDataToCSV(timeline as TemporalCSVDataPoint[]);
          const lines = csv.split('\n').filter(line => line.length > 0);

          // Check each data row (skip header)
          for (let i = 1; i < lines.length; i++) {
            const columns = lines[i].split(',');
            const meanNDVI = columns[1];
            const maxNDVI = columns[7];

            // Max should equal mean when not provided
            expect(maxNDVI).toBe(meanNDVI);
          }

          return true;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 8.11: Empty timeline produces header-only CSV
   * 
   * For an empty temporal dataset, the generated CSV SHALL contain
   * only the header row (when includeHeaders is true).
   * 
   * This validates empty dataset handling.
   */
  it('should produce header-only CSV for empty timeline', () => {
    const emptyTimeline: TemporalCSVDataPoint[] = [];
    const csv = convertTemporalDataToCSV(emptyTimeline);

    expect(csv).toBe('date,mean_ndvi,mean_evi,mean_ndmi,mean_ndwi,mean_savi,min_ndvi,max_ndvi,change_from_previous\n');
  });

  /**
   * Property 8.12: Empty timeline with no headers produces empty string
   * 
   * For an empty temporal dataset with includeHeaders = false,
   * the generated CSV SHALL be an empty string.
   * 
   * This validates empty dataset handling without headers.
   */
  it('should produce empty string for empty timeline without headers', () => {
    const emptyTimeline: TemporalCSVDataPoint[] = [];
    const csv = convertTemporalDataToCSV(emptyTimeline, false);

    expect(csv).toBe('');
  });

  /**
   * Property 8.13: CSV is deterministic
   * 
   * For any temporal dataset, generating CSV multiple times
   * SHALL produce identical results.
   * 
   * This validates that CSV generation is deterministic and has no side effects.
   */
  it('should produce identical CSV when called multiple times', () => {
    fc.assert(
      fc.property(temporalTimelineArbitrary, timeline => {
        const csv1 = convertTemporalDataToCSV(timeline);
        const csv2 = convertTemporalDataToCSV(timeline);

        expect(csv1).toBe(csv2);

        return true;
      }),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 8.14: CSV rows are in chronological order
   * 
   * For any temporal dataset, the CSV rows SHALL be in the same order
   * as the input timeline (chronological order).
   * 
   * This validates that row order is preserved.
   */
  it('should preserve chronological order of data points', () => {
    fc.assert(
      fc.property(temporalTimelineArbitrary, timeline => {
        if (timeline.length < 2) {
          return true; // Need at least 2 points to check order
        }

        const csv = convertTemporalDataToCSV(timeline);
        const lines = csv.split('\n').filter(line => line.length > 0);

        // Check that dates are in ascending order (skip header)
        for (let i = 2; i < lines.length; i++) {
          const currentDate = lines[i].split(',')[0];
          const previousDate = lines[i - 1].split(',')[0];

          // Current date should be >= previous date
          expect(currentDate >= previousDate).toBe(true);
        }

        return true;
      }),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 8.15: Mean NDVI matches input data
   * 
   * For any temporal dataset, the mean_ndvi column SHALL match
   * the ndvi value from the input data point.
   * 
   * This validates data integrity during serialization.
   */
  it('should preserve mean NDVI values from input data', () => {
    fc.assert(
      fc.property(temporalTimelineArbitrary, timeline => {
        if (timeline.length === 0) {
          return true; // Skip empty timelines
        }

        const csv = convertTemporalDataToCSV(timeline);
        const lines = csv.split('\n').filter(line => line.length > 0);

        // Check each data row (skip header)
        for (let i = 1; i < lines.length; i++) {
          const columns = lines[i].split(',');
          const csvMeanNDVI = parseFloat(columns[1]);
          const inputNDVI = timeline[i - 1].ndvi;

          // CSV value should match input (within rounding precision)
          expect(Math.abs(csvMeanNDVI - inputNDVI)).toBeLessThan(EPSILON);
        }

        return true;
      }),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 8.16: Dates match input data
   * 
   * For any temporal dataset, the date column SHALL match
   * the date from the input data point (formatted as YYYY-MM-DD).
   * 
   * This validates date preservation during serialization.
   */
  it('should preserve dates from input data', () => {
    fc.assert(
      fc.property(temporalTimelineArbitrary, timeline => {
        if (timeline.length === 0) {
          return true; // Skip empty timelines
        }

        const csv = convertTemporalDataToCSV(timeline);
        const lines = csv.split('\n').filter(line => line.length > 0);

        // Check each data row (skip header)
        for (let i = 1; i < lines.length; i++) {
          const columns = lines[i].split(',');
          const csvDate = columns[0];
          const inputDate = timeline[i - 1].date;
          const expectedDate = inputDate.toISOString().split('T')[0];

          expect(csvDate).toBe(expectedDate);
        }

        return true;
      }),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 8.17: No trailing commas in CSV rows
   * 
   * For any temporal dataset, no CSV row SHALL end with a comma.
   * 
   * This validates proper CSV formatting.
   */
  it('should not have trailing commas in CSV rows', () => {
    fc.assert(
      fc.property(temporalTimelineArbitrary, timeline => {
        const csv = convertTemporalDataToCSV(timeline);
        const lines = csv.split('\n').filter(line => line.length > 0);

        // Check each line
        for (const line of lines) {
          expect(line.endsWith(',')).toBe(false);
        }

        return true;
      }),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property 8.18: CSV ends with newline when data exists
   * 
   * For any non-empty temporal dataset, the CSV string SHALL NOT end
   * with a newline character (rows are joined with \n, not terminated).
   * 
   * This validates CSV termination behavior.
   */
  it('should not end with newline for non-empty data', () => {
    fc.assert(
      fc.property(
        fc.array(temporalCSVDataPointArbitrary, { minLength: 1, maxLength: 10 }),
        timeline => {
          const csv = convertTemporalDataToCSV(timeline);

          // CSV should not end with newline
          expect(csv.endsWith('\n')).toBe(false);

          return true;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });
});

// ============================================================================
// Filename Generation Properties
// ============================================================================

describe('CSV Filename Generation Properties', () => {
  /**
   * Property: Filename contains parcelle ID prefix
   * 
   * For any parcelle ID and date range, the generated filename
   * SHALL contain the first 8 characters of the parcelle ID.
   */
  it('should include first 8 characters of parcelle ID', () => {
    fc.assert(
      fc.property(parcelleIdArbitrary, dateRangeArbitrary, (parcelleId, { start, end }) => {
        const filename = generateTemporalCSVFilename(parcelleId, start, end);

        const expectedPrefix = parcelleId.substring(0, 8);
        expect(filename).toContain(expectedPrefix);

        return true;
      }),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property: Filename contains date range
   * 
   * For any parcelle ID and date range, the generated filename
   * SHALL contain both start and end dates in YYYY-MM-DD format.
   */
  it('should include start and end dates in YYYY-MM-DD format', () => {
    fc.assert(
      fc.property(parcelleIdArbitrary, dateRangeArbitrary, (parcelleId, { start, end }) => {
        const filename = generateTemporalCSVFilename(parcelleId, start, end);

        const startStr = start.toISOString().split('T')[0];
        const endStr = end.toISOString().split('T')[0];

        expect(filename).toContain(startStr);
        expect(filename).toContain(endStr);

        return true;
      }),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property: Filename has .csv extension
   * 
   * For any parcelle ID and date range, the generated filename
   * SHALL end with the .csv extension.
   */
  it('should end with .csv extension', () => {
    fc.assert(
      fc.property(parcelleIdArbitrary, dateRangeArbitrary, (parcelleId, { start, end }) => {
        const filename = generateTemporalCSVFilename(parcelleId, start, end);

        expect(filename.endsWith('.csv')).toBe(true);

        return true;
      }),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property: Filename format is consistent
   * 
   * For any parcelle ID and date range, the generated filename
   * SHALL follow the format: temporal-ndvi-{id}-{start}-to-{end}.csv
   */
  it('should follow consistent format pattern', () => {
    fc.assert(
      fc.property(parcelleIdArbitrary, dateRangeArbitrary, (parcelleId, { start, end }) => {
        const filename = generateTemporalCSVFilename(parcelleId, start, end);

        // Regex pattern: temporal-ndvi-{8chars}-{date}-to-{date}.csv
        const pattern = /^temporal-ndvi-[a-f0-9]{8}-\d{4}-\d{2}-\d{2}-to-\d{4}-\d{2}-\d{2}\.csv$/;
        expect(pattern.test(filename)).toBe(true);

        return true;
      }),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property: Filename is deterministic
   * 
   * For any parcelle ID and date range, generating the filename
   * multiple times SHALL produce identical results.
   */
  it('should produce identical filename when called multiple times', () => {
    fc.assert(
      fc.property(parcelleIdArbitrary, dateRangeArbitrary, (parcelleId, { start, end }) => {
        const filename1 = generateTemporalCSVFilename(parcelleId, start, end);
        const filename2 = generateTemporalCSVFilename(parcelleId, start, end);

        expect(filename1).toBe(filename2);

        return true;
      }),
      { numRuns: NUM_RUNS }
    );
  });
});
