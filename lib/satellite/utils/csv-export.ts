/**
 * CSV Export Utilities for Temporal NDVI Data
 * 
 * Provides functions to convert temporal NDVI data into CSV format
 * for download and external analysis.
 * 
 * Requirements: Task 3.4.3
 * - Generate CSV with columns: date, mean_ndvi, min_ndvi, max_ndvi, change_from_previous
 * - Trigger download in browser
 */

import type { TemporalDataPoint } from '@/lib/satellite/types';

/**
 * Extended temporal data point with additional statistics for CSV export
 */
export interface TemporalCSVDataPoint extends TemporalDataPoint {
  minNDVI?: number;
  maxNDVI?: number;
  changeFromPrevious?: number;
}

/**
 * Convert temporal NDVI data to CSV format
 * 
 * @param timeline - Array of temporal data points
 * @param includeHeaders - Whether to include CSV headers (default: true)
 * @returns CSV string with headers and data rows
 */
export function convertTemporalDataToCSV(
  timeline: TemporalCSVDataPoint[],
  includeHeaders: boolean = true
): string {
  if (!timeline || timeline.length === 0) {
    return includeHeaders ? 'date,mean_ndvi,min_ndvi,max_ndvi,change_from_previous\n' : '';
  }

  const rows: string[] = [];

  // Add headers
  if (includeHeaders) {
    rows.push('date,mean_ndvi,min_ndvi,max_ndvi,change_from_previous');
  }

  // Add data rows
  timeline.forEach((point, index) => {
    const date = point.date instanceof Date 
      ? point.date.toISOString().split('T')[0] 
      : new Date(point.date).toISOString().split('T')[0];
    
    const meanNDVI = point.ndvi.toFixed(4);
    const minNDVI = point.minNDVI !== undefined ? point.minNDVI.toFixed(4) : meanNDVI;
    const maxNDVI = point.maxNDVI !== undefined ? point.maxNDVI.toFixed(4) : meanNDVI;
    
    // Calculate change from previous
    let changeFromPrevious = '';
    if (index > 0) {
      const previousNDVI = timeline[index - 1].ndvi;
      const change = point.ndvi - previousNDVI;
      changeFromPrevious = change.toFixed(4);
    } else {
      changeFromPrevious = '0.0000'; // First data point has no previous
    }

    rows.push(`${date},${meanNDVI},${minNDVI},${maxNDVI},${changeFromPrevious}`);
  });

  return rows.join('\n');
}

/**
 * Trigger CSV download in browser
 * 
 * @param csvContent - CSV content as string
 * @param filename - Filename for the download (default: temporal-ndvi-data.csv)
 */
export function downloadCSV(csvContent: string, filename: string = 'temporal-ndvi-data.csv'): void {
  // Create a Blob from the CSV content
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

  // Create a temporary download link
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  // Append to body, click, and remove
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up the URL object
  URL.revokeObjectURL(url);
}

/**
 * Generate filename for temporal CSV export
 * 
 * @param parcelleId - Parcelle ID
 * @param startDate - Start date of the temporal range
 * @param endDate - End date of the temporal range
 * @returns Formatted filename
 */
export function generateTemporalCSVFilename(
  parcelleId: string,
  startDate: Date,
  endDate: Date
): string {
  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];
  const parcelleSuffix = parcelleId.substring(0, 8);
  
  return `temporal-ndvi-${parcelleSuffix}-${startStr}-to-${endStr}.csv`;
}

/**
 * Export temporal data as CSV and trigger download
 * 
 * @param timeline - Array of temporal data points
 * @param parcelleId - Parcelle ID for filename generation
 * @param startDate - Start date of the temporal range
 * @param endDate - End date of the temporal range
 */
export function exportTemporalDataAsCSV(
  timeline: TemporalCSVDataPoint[],
  parcelleId: string,
  startDate: Date,
  endDate: Date
): void {
  const csvContent = convertTemporalDataToCSV(timeline);
  const filename = generateTemporalCSVFilename(parcelleId, startDate, endDate);
  downloadCSV(csvContent, filename);
}
