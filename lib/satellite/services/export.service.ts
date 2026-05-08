/**
 * Export Service
 * 
 * Handles KML export, certification report generation, and CSV export
 * for satellite imagery analysis data.
 */

import type { MultiPolygon } from 'geojson';
import type { 
  KMLExportOptions, 
  NDVIResult, 
  DeforestationEvent,
  TemporalDataPoint,
  HealthStatus,
  ImageryData,
  YieldPrediction,
  ReportOptions
} from '../types';
import { ndviToHex } from '../utils/ndvi-colors';
import {
  type ReportTemplate,
  createDefaultTemplate,
  getLocalizedStrings,
  hexToRGB,
  getStatusColor,
  getStatusText,
  formatDate as templateFormatDate,
  formatTime,
} from '../templates/report-templates';

/**
 * Parcelle data required for KML export
 */
export interface ParcelleKMLData {
  id: string;
  code: string | null;
  label: string | null;
  village: string | null;
  region: string | null;
  geometry: MultiPolygon;
  surface_hectares: number;
  planteur_name?: string | null;
}

/**
 * Complete data package for KML export
 */
export interface KMLExportData {
  parcelle: ParcelleKMLData;
  ndvi?: NDVIResult;
  deforestation?: DeforestationEvent[];
  temporal?: TemporalDataPoint[];
}

/**
 * Export Service Class
 * 
 * Provides methods for exporting satellite data in various formats:
 * - KML/KMZ for Google Earth visualization
 * - CSV for temporal data analysis
 * - PDF certification reports (future implementation)
 */
export class ExportService {
  /**
   * Maximum recommended KML file size in bytes (10MB)
   * Files larger than this should be split or compressed to KMZ
   */
  private readonly MAX_KML_SIZE = 10 * 1024 * 1024;

  /**
   * Export parcelle data as KML file
   * 
   * @param data - Parcelle and satellite data to export
   * @param options - Export options (temporal, NDVI, deforestation)
   * @returns KML file content as string
   */
  async exportKML(
    data: KMLExportData[],
    options: KMLExportOptions
  ): Promise<string> {
    const kmlHeader = this.generateKMLHeader();
    
    // For batch exports (multiple parcelles), organize into folders
    let kmlContent: string;
    if (data.length > 1) {
      kmlContent = this.generateBatchKML(data, options);
    } else {
      // Single parcelle - no folder needed
      kmlContent = data.map(item => 
        this.generatePlacemark(item, options)
      ).join('\n');
    }
    
    const kmlFooter = this.generateKMLFooter();

    return `${kmlHeader}${kmlContent}${kmlFooter}`;
  }

  /**
   * Generate organized KML structure for batch export
   * 
   * Organizes parcelles into folders by region for better navigation
   * in Google Earth. Optimizes file size by sharing styles and reducing
   * redundant data.
   * 
   * @param data - Array of parcelle data to export
   * @param options - Export options
   * @returns KML content with folder structure
   */
  private generateBatchKML(
    data: KMLExportData[],
    options: KMLExportOptions
  ): string {
    // Group parcelles by region for folder organization
    const parcellesByRegion = this.groupParcellesByRegion(data);
    
    let kml = '';
    
    // If all parcelles are in the same region or no region info, create a single folder
    if (parcellesByRegion.size === 1 || 
        (parcellesByRegion.size === 2 && parcellesByRegion.has('unknown'))) {
      kml += `    <Folder>
      <name>Parcelles (${data.length})</name>
      <description><![CDATA[Export de ${data.length} parcelle(s) avec analyse satellite]]></description>
      <open>1</open>
`;
      
      data.forEach(item => {
        kml += this.generatePlacemark(item, options);
      });
      
      kml += `    </Folder>
`;
    } else {
      // Multiple regions - create a folder per region
      const sortedRegions = Array.from(parcellesByRegion.keys()).sort();
      
      sortedRegions.forEach(region => {
        const regionParcelles = parcellesByRegion.get(region) || [];
        const regionName = region === 'unknown' ? 'Sans Région' : region;
        
        kml += `    <Folder>
      <name>${this.escapeXML(regionName)} (${regionParcelles.length})</name>
      <description><![CDATA[${regionParcelles.length} parcelle(s) dans la région ${this.escapeXML(regionName)}]]></description>
      <open>${region === 'unknown' ? '0' : '1'}</open>
`;
        
        regionParcelles.forEach(item => {
          kml += this.generatePlacemark(item, options);
        });
        
        kml += `    </Folder>
`;
      });
    }
    
    return kml;
  }

  /**
   * Group parcelles by region for folder organization
   * 
   * @param data - Array of parcelle data
   * @returns Map of region name to parcelle data
   */
  private groupParcellesByRegion(
    data: KMLExportData[]
  ): Map<string, KMLExportData[]> {
    const grouped = new Map<string, KMLExportData[]>();
    
    data.forEach(item => {
      const region = item.parcelle.region || 'unknown';
      
      if (!grouped.has(region)) {
        grouped.set(region, []);
      }
      
      grouped.get(region)!.push(item);
    });
    
    return grouped;
  }

  /**
   * Estimate KML file size for batch export
   * 
   * Provides rough estimate to help determine if compression or splitting is needed.
   * 
   * @param data - Array of parcelle data
   * @param options - Export options
   * @returns Estimated file size in bytes
   */
  estimateKMLSize(data: KMLExportData[], options: KMLExportOptions): number {
    // Base overhead: XML declaration, KML header, styles, footer
    let estimatedSize = 2000; // ~2KB base
    
    // Style definitions (5 health statuses × ~200 bytes each)
    estimatedSize += 1000;
    
    data.forEach(item => {
      // Estimate per parcelle
      let parcelleSize = 0;
      
      // Placemark structure overhead
      parcelleSize += 500;
      
      // Geometry coordinates (estimate ~50 bytes per coordinate pair)
      const coordCount = this.estimateCoordinateCount(item.parcelle.geometry);
      parcelleSize += coordCount * 50;
      
      // Description HTML (varies by options)
      parcelleSize += 1000; // Base description
      
      if (options.includeNDVI && item.ndvi) {
        parcelleSize += 500; // NDVI section
      }
      
      if (options.includeDeforestation && item.deforestation) {
        parcelleSize += item.deforestation.length * 400; // Per alert
      }
      
      if (options.includeTemporal && item.temporal) {
        // Temporal data creates multiple placemarks
        parcelleSize += item.temporal.length * (coordCount * 50 + 800);
      }
      
      estimatedSize += parcelleSize;
    });
    
    // Add folder structure overhead for batch exports
    if (data.length > 1) {
      const regionCount = this.groupParcellesByRegion(data).size;
      estimatedSize += regionCount * 300; // Folder tags
    }
    
    return estimatedSize;
  }

  /**
   * Estimate number of coordinate pairs in a MultiPolygon
   * 
   * @param geometry - MultiPolygon geometry
   * @returns Estimated coordinate count
   */
  private estimateCoordinateCount(geometry: MultiPolygon): number {
    let count = 0;
    
    geometry.coordinates.forEach(polygon => {
      polygon.forEach(ring => {
        count += ring.length;
      });
    });
    
    return count;
  }

  /**
   * Check if KML export should be compressed to KMZ
   * 
   * @param data - Array of parcelle data
   * @param options - Export options
   * @returns True if compression is recommended
   */
  shouldCompressToKMZ(data: KMLExportData[], options: KMLExportOptions): boolean {
    const estimatedSize = this.estimateKMLSize(data, options);
    return estimatedSize > this.MAX_KML_SIZE;
  }

  /**
   * Get optimization recommendations for large exports
   * 
   * @param data - Array of parcelle data
   * @param options - Export options
   * @returns Optimization recommendations
   */
  getOptimizationRecommendations(
    data: KMLExportData[],
    options: KMLExportOptions
  ): {
    estimatedSize: number;
    shouldCompress: boolean;
    recommendations: string[];
  } {
    const estimatedSize = this.estimateKMLSize(data, options);
    const shouldCompress = estimatedSize > this.MAX_KML_SIZE;
    const recommendations: string[] = [];
    
    if (shouldCompress) {
      recommendations.push('Compress to KMZ format to reduce file size');
    }
    
    if (data.length > 50) {
      recommendations.push('Consider splitting export into multiple files by region');
    }
    
    if (options.includeTemporal && data.some(d => d.temporal && d.temporal.length > 12)) {
      recommendations.push('Reduce temporal data points to reduce file size');
    }
    
    if (estimatedSize > this.MAX_KML_SIZE * 2) {
      recommendations.push('File size is very large - strongly recommend splitting into smaller exports');
    }
    
    return {
      estimatedSize,
      shouldCompress,
      recommendations,
    };
  }

  /**
   * Generate KML header with namespace declarations
   */
  private generateKMLHeader(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2">
  <Document>
    <name>CocoaTrack - Satellite Analysis Export</name>
    <description>Parcelle data with NDVI analysis and deforestation detection</description>
    ${this.generateStyles()}
`;
  }

  /**
   * Generate KML footer
   */
  private generateKMLFooter(): string {
    return `  </Document>
</kml>`;
  }

  /**
   * Generate KML styles for different health status levels
   */
  private generateStyles(): string {
    const healthStatuses: HealthStatus[] = ['excellent', 'good', 'fair', 'poor', 'critical'];
    
    return healthStatuses.map(status => {
      const ndviValue = this.getRepresentativeNDVI(status);
      const color = ndviToHex(ndviValue);
      const kmlColor = this.hexToKMLColor(color);
      
      return `    <Style id="style_${status}">
      <LineStyle>
        <color>ff000000</color>
        <width>2</width>
      </LineStyle>
      <PolyStyle>
        <color>${kmlColor}</color>
        <fill>1</fill>
        <outline>1</outline>
      </PolyStyle>
    </Style>`;
    }).join('\n');
  }

  /**
   * Get representative NDVI value for a health status
   */
  private getRepresentativeNDVI(status: HealthStatus): number {
    const ndviMap: Record<HealthStatus, number> = {
      excellent: 0.85,
      good: 0.65,
      fair: 0.55,
      poor: 0.40,
      critical: 0.15,
    };
    return ndviMap[status];
  }

  /**
   * Convert hex color to KML color format (AABBGGRR)
   * KML uses ABGR format with alpha channel
   */
  private hexToKMLColor(hex: string, alpha: number = 0.7): string {
    // Remove # if present
    const cleanHex = hex.replace('#', '');
    
    // Extract RGB components
    const r = cleanHex.substring(0, 2);
    const g = cleanHex.substring(2, 4);
    const b = cleanHex.substring(4, 6);
    
    // Convert alpha (0-1) to hex (00-FF)
    const alphaHex = Math.round(alpha * 255).toString(16).padStart(2, '0');
    
    // KML format: AABBGGRR
    return `${alphaHex}${b}${g}${r}`;
  }

  /**
   * Generate a KML Placemark for a single parcelle
   * 
   * If temporal data is included, generates multiple placemarks with TimeStamp elements
   * for time-enabled visualization in Google Earth.
   */
  private generatePlacemark(
    data: KMLExportData,
    options: KMLExportOptions
  ): string {
    const { parcelle, ndvi, deforestation, temporal } = data;
    
    // If temporal data is included, generate time-enabled placemarks
    if (options.includeTemporal && temporal && temporal.length > 0) {
      return this.generateTemporalPlacemarks(data, options);
    }
    
    // Otherwise, generate a single placemark
    return this.generateSinglePlacemark(data, options);
  }

  /**
   * Generate a single KML Placemark (non-temporal)
   */
  private generateSinglePlacemark(
    data: KMLExportData,
    options: KMLExportOptions
  ): string {
    const { parcelle, ndvi } = data;
    
    // Determine style based on health status
    const styleUrl = ndvi 
      ? `#style_${ndvi.healthStatus}` 
      : '#style_fair';
    
    // Generate description with metadata
    const description = this.generateDescription(data, options);
    
    // Generate coordinates from geometry
    const coordinates = this.generateCoordinates(parcelle.geometry);
    
    // Generate name
    const name = this.generateParcelName(parcelle);
    
    const placemark = `    <Placemark>
      <name>${this.escapeXML(name)}</name>
      <description><![CDATA[${description}]]></description>
      <styleUrl>${styleUrl}</styleUrl>
      <MultiGeometry>
${coordinates}
      </MultiGeometry>
    </Placemark>
`;

    return placemark;
  }

  /**
   * Generate multiple time-enabled KML Placemarks for temporal visualization
   * 
   * Creates one placemark per temporal data point with TimeStamp elements,
   * allowing Google Earth to display the parcelle's evolution over time.
   * 
   * Temporal data is automatically sorted chronologically to ensure proper
   * time-enabled visualization in Google Earth.
   */
  private generateTemporalPlacemarks(
    data: KMLExportData,
    options: KMLExportOptions
  ): string {
    const { parcelle, temporal } = data;
    
    if (!temporal || temporal.length === 0) {
      return this.generateSinglePlacemark(data, options);
    }
    
    // Sort temporal data chronologically to ensure proper time-enabled visualization
    const sortedTemporal = [...temporal].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    const name = this.generateParcelName(parcelle);
    const coordinates = this.generateCoordinates(parcelle.geometry);
    
    // Create a folder to group temporal placemarks
    let kml = `    <Folder>
      <name>${this.escapeXML(name)} - Temporal Analysis</name>
      <description><![CDATA[Time-enabled visualization showing NDVI evolution from ${this.formatDate(sortedTemporal[0].date)} to ${this.formatDate(sortedTemporal[sortedTemporal.length - 1].date)}]]></description>
      <open>0</open>
`;

    // Generate a placemark for each temporal data point
    sortedTemporal.forEach((point, index) => {
      const styleUrl = `#style_${point.healthStatus}`;
      const timestamp = this.formatISO8601(point.date);
      const pointDescription = this.generateTemporalPointDescription(parcelle, point, index, sortedTemporal.length);
      
      kml += `      <Placemark>
        <name>${this.escapeXML(name)} - ${this.formatDate(point.date)}</name>
        <description><![CDATA[${pointDescription}]]></description>
        <styleUrl>${styleUrl}</styleUrl>
        <TimeStamp>
          <when>${timestamp}</when>
        </TimeStamp>
        <MultiGeometry>
${coordinates}
        </MultiGeometry>
      </Placemark>
`;
    });

    kml += `    </Folder>
`;

    return kml;
  }

  /**
   * Generate description for a single temporal data point
   */
  private generateTemporalPointDescription(
    parcelle: ParcelleKMLData,
    point: TemporalDataPoint,
    index: number,
    totalPoints: number
  ): string {
    let html = '<div style="font-family: Arial, sans-serif; font-size: 12px;">';
    
    html += `<h3 style="margin: 0 0 10px 0; color: #2d5016;">Point ${index + 1} de ${totalPoints}</h3>`;
    html += `<p style="margin: 5px 0;"><strong>Date:</strong> ${this.formatDate(point.date)}</p>`;
    
    html += '<h4 style="margin: 10px 0 5px 0; color: #2d5016;">Analyse NDVI</h4>';
    html += '<table style="width: 100%; border-collapse: collapse;">';
    html += `<tr><td style="padding: 4px; font-weight: bold;">NDVI:</td><td style="padding: 4px;">${point.ndvi.toFixed(3)}</td></tr>`;
    html += `<tr><td style="padding: 4px; font-weight: bold;">État de Santé:</td><td style="padding: 4px;">${this.translateHealthStatus(point.healthStatus)}</td></tr>`;
    html += `<tr><td style="padding: 4px; font-weight: bold;">Couverture Nuageuse:</td><td style="padding: 4px;">${point.cloudCover.toFixed(1)}%</td></tr>`;
    
    if (point.hasSignificantChange) {
      html += `<tr><td colspan="2" style="padding: 4px; color: #E68A1F; font-weight: bold;">⚠ Changement significatif détecté</td></tr>`;
    }
    
    html += '</table>';
    
    html += '<h4 style="margin: 10px 0 5px 0; color: #2d5016;">Informations de la Parcelle</h4>';
    html += '<table style="width: 100%; border-collapse: collapse;">';
    
    if (parcelle.code) {
      html += `<tr><td style="padding: 4px; font-weight: bold;">Code:</td><td style="padding: 4px;">${this.escapeXML(parcelle.code)}</td></tr>`;
    }
    
    html += `<tr><td style="padding: 4px; font-weight: bold;">Surface:</td><td style="padding: 4px;">${parcelle.surface_hectares.toFixed(2)} ha</td></tr>`;
    
    if (parcelle.village) {
      html += `<tr><td style="padding: 4px; font-weight: bold;">Village:</td><td style="padding: 4px;">${this.escapeXML(parcelle.village)}</td></tr>`;
    }
    
    html += '</table>';
    html += '</div>';
    
    return html;
  }

  /**
   * Format date as ISO 8601 timestamp for KML TimeStamp elements
   * 
   * @param date - Date to format
   * @returns ISO 8601 formatted string (YYYY-MM-DDTHH:MM:SSZ)
   */
  private formatISO8601(date: Date): string {
    return new Date(date).toISOString();
  }

  /**
   * Generate parcelle name for KML display
   */
  private generateParcelName(parcelle: ParcelleKMLData): string {
    const parts: string[] = [];
    
    if (parcelle.code) {
      parts.push(parcelle.code);
    }
    
    if (parcelle.label) {
      parts.push(parcelle.label);
    }
    
    if (parts.length === 0) {
      parts.push(`Parcelle ${parcelle.id.substring(0, 8)}`);
    }
    
    return parts.join(' - ');
  }

  /**
   * Generate HTML description with metadata
   */
  private generateDescription(
    data: KMLExportData,
    options: KMLExportOptions
  ): string {
    const { parcelle, ndvi, deforestation, temporal } = data;
    
    let html = '<div style="font-family: Arial, sans-serif; font-size: 12px;">';
    
    // Basic parcelle information
    html += '<h3 style="margin: 0 0 10px 0; color: #2d5016;">Informations de la Parcelle</h3>';
    html += '<table style="width: 100%; border-collapse: collapse;">';
    
    if (parcelle.code) {
      html += `<tr><td style="padding: 4px; font-weight: bold;">Code:</td><td style="padding: 4px;">${this.escapeXML(parcelle.code)}</td></tr>`;
    }
    
    if (parcelle.label) {
      html += `<tr><td style="padding: 4px; font-weight: bold;">Label:</td><td style="padding: 4px;">${this.escapeXML(parcelle.label)}</td></tr>`;
    }
    
    if (parcelle.village) {
      html += `<tr><td style="padding: 4px; font-weight: bold;">Village:</td><td style="padding: 4px;">${this.escapeXML(parcelle.village)}</td></tr>`;
    }
    
    if (parcelle.region) {
      html += `<tr><td style="padding: 4px; font-weight: bold;">Région:</td><td style="padding: 4px;">${this.escapeXML(parcelle.region)}</td></tr>`;
    }
    
    html += `<tr><td style="padding: 4px; font-weight: bold;">Surface:</td><td style="padding: 4px;">${parcelle.surface_hectares.toFixed(2)} ha</td></tr>`;
    
    if (parcelle.planteur_name) {
      html += `<tr><td style="padding: 4px; font-weight: bold;">Planteur:</td><td style="padding: 4px;">${this.escapeXML(parcelle.planteur_name)}</td></tr>`;
    }
    
    html += '</table>';
    
    // NDVI information
    if (options.includeNDVI && ndvi) {
      html += '<h3 style="margin: 15px 0 10px 0; color: #2d5016;">Analyse NDVI</h3>';
      html += '<table style="width: 100%; border-collapse: collapse;">';
      html += `<tr><td style="padding: 4px; font-weight: bold;">NDVI Moyen:</td><td style="padding: 4px;">${ndvi.meanNDVI.toFixed(3)}</td></tr>`;
      html += `<tr><td style="padding: 4px; font-weight: bold;">NDVI Min:</td><td style="padding: 4px;">${ndvi.minNDVI.toFixed(3)}</td></tr>`;
      html += `<tr><td style="padding: 4px; font-weight: bold;">NDVI Max:</td><td style="padding: 4px;">${ndvi.maxNDVI.toFixed(3)}</td></tr>`;
      html += `<tr><td style="padding: 4px; font-weight: bold;">Écart-type:</td><td style="padding: 4px;">${ndvi.stdDevNDVI.toFixed(3)}</td></tr>`;
      html += `<tr><td style="padding: 4px; font-weight: bold;">État de Santé:</td><td style="padding: 4px;">${this.translateHealthStatus(ndvi.healthStatus)}</td></tr>`;
      html += `<tr><td style="padding: 4px; font-weight: bold;">Date d'Analyse:</td><td style="padding: 4px;">${this.formatDate(ndvi.calculationDate)}</td></tr>`;
      html += '</table>';
    }
    
    // Deforestation alerts
    if (options.includeDeforestation && deforestation && deforestation.length > 0) {
      html += '<h3 style="margin: 15px 0 10px 0; color: #ef4444;">Alertes de Déforestation</h3>';
      html += `<p style="margin: 5px 0; color: #ef4444; font-weight: bold;">${deforestation.length} alerte(s) détectée(s)</p>`;
      
      deforestation.forEach((alert, index) => {
        html += `<div style="margin: 10px 0; padding: 8px; background-color: #fee; border-left: 3px solid #ef4444;">`;
        html += `<p style="margin: 0 0 5px 0; font-weight: bold;">Alerte ${index + 1}</p>`;
        html += `<p style="margin: 2px 0; font-size: 11px;">Date de détection: ${this.formatDate(alert.detectionDate)}</p>`;
        html += `<p style="margin: 2px 0; font-size: 11px;">Changement NDVI: ${alert.ndviChange.toFixed(3)}</p>`;
        html += `<p style="margin: 2px 0; font-size: 11px;">Zone affectée: ${alert.affectedAreaHectares.toFixed(2)} ha (${alert.affectedAreaPercent.toFixed(1)}%)</p>`;
        html += `<p style="margin: 2px 0; font-size: 11px;">Statut: ${this.translateAlertStatus(alert.status)}</p>`;
        html += `</div>`;
      });
    }
    
    // Temporal data summary
    if (options.includeTemporal && temporal && temporal.length > 0) {
      html += '<h3 style="margin: 15px 0 10px 0; color: #2d5016;">Analyse Temporelle</h3>';
      html += `<p style="margin: 5px 0;">Période: ${this.formatDate(temporal[0].date)} - ${this.formatDate(temporal[temporal.length - 1].date)}</p>`;
      html += `<p style="margin: 5px 0;">Points de données: ${temporal.length}</p>`;
      
      const avgNDVI = temporal.reduce((sum, point) => sum + point.ndvi, 0) / temporal.length;
      html += `<p style="margin: 5px 0;">NDVI moyen: ${avgNDVI.toFixed(3)}</p>`;
      
      const significantChanges = temporal.filter(point => point.hasSignificantChange).length;
      if (significantChanges > 0) {
        html += `<p style="margin: 5px 0; color: #E68A1F; font-weight: bold;">${significantChanges} changement(s) significatif(s) détecté(s)</p>`;
      }
    }
    
    html += '</div>';
    
    return html;
  }

  /**
   * Generate KML coordinates from MultiPolygon geometry
   * 
   * Optimizes coordinate precision to reduce file size while maintaining
   * accuracy suitable for agricultural parcelles (±1 meter precision).
   * 
   * @param geometry - MultiPolygon geometry
   * @param precision - Decimal places for coordinates (default: 6 for ~10cm precision)
   * @returns KML coordinates string
   */
  private generateCoordinates(geometry: MultiPolygon, precision: number = 6): string {
    let kml = '';
    
    // MultiPolygon is an array of Polygons
    geometry.coordinates.forEach((polygon) => {
      kml += '        <Polygon>\n';
      
      // Each polygon has an outer boundary and optional inner boundaries (holes)
      polygon.forEach((ring, ringIndex) => {
        const boundaryType = ringIndex === 0 ? 'outerBoundaryIs' : 'innerBoundaryIs';
        kml += `          <${boundaryType}>\n`;
        kml += '            <LinearRing>\n';
        kml += '              <coordinates>\n';
        
        // Convert coordinates to KML format (lon,lat,alt) with optimized precision
        const coordString = ring.map(coord => {
          const [lon, lat] = coord;
          // Round to specified precision to reduce file size
          const roundedLon = this.roundToPrecision(lon, precision);
          const roundedLat = this.roundToPrecision(lat, precision);
          return `${roundedLon},${roundedLat},0`;
        }).join(' ');
        
        kml += `                ${coordString}\n`;
        kml += '              </coordinates>\n';
        kml += '            </LinearRing>\n';
        kml += `          </${boundaryType}>\n`;
      });
      
      kml += '        </Polygon>\n';
    });
    
    return kml;
  }

  /**
   * Round number to specified decimal precision
   * 
   * @param value - Number to round
   * @param precision - Number of decimal places
   * @returns Rounded number
   */
  private roundToPrecision(value: number, precision: number): number {
    const multiplier = Math.pow(10, precision);
    return Math.round(value * multiplier) / multiplier;
  }

  /**
   * Escape XML special characters
   */
  private escapeXML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Format date for display
   */
  private formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  /**
   * Translate health status to French
   */
  private translateHealthStatus(status: HealthStatus): string {
    const translations: Record<HealthStatus, string> = {
      excellent: 'Excellent',
      good: 'Bon',
      fair: 'Moyen',
      poor: 'Faible',
      critical: 'Critique',
    };
    return translations[status];
  }

  /**
   * Translate alert status to French
   */
  private translateAlertStatus(status: string): string {
    const translations: Record<string, string> = {
      pending: 'En attente',
      acknowledged: 'Reconnu',
      disputed: 'Contesté',
      resolved: 'Résolu',
    };
    return translations[status] || status;
  }

  /**
   * Export temporal NDVI data as CSV (simple version with single NDVI value)
   * 
   * @param parcelleId - Parcelle identifier
   * @param temporal - Temporal data points
   * @returns CSV content as string
   */
  async exportTemporalCSV(
    parcelleId: string,
    temporal: TemporalDataPoint[]
  ): Promise<string> {
    // CSV header
    let csv = 'Date,NDVI,Cloud Cover (%),Health Status,Significant Change\n';
    
    // Add data rows
    temporal.forEach(point => {
      const date = new Date(point.date).toISOString().split('T')[0];
      const ndvi = point.ndvi.toFixed(4);
      const cloudCover = point.cloudCover.toFixed(2);
      const healthStatus = point.healthStatus;
      const significantChange = point.hasSignificantChange ? 'Yes' : 'No';
      
      csv += `${date},${ndvi},${cloudCover},${healthStatus},${significantChange}\n`;
    });
    
    return csv;
  }

  /**
   * Export temporal NDVI data as CSV with full statistics
   * 
   * This method generates a comprehensive CSV export with all NDVI statistics
   * including mean, min, max, standard deviation, health status, and change metrics.
   * 
   * @param parcelleId - Parcelle identifier
   * @param ndviResults - Array of NDVI results with full statistics
   * @returns CSV content as string with all required columns
   */
  async exportTemporalCSVWithStats(
    parcelleId: string,
    ndviResults: NDVIResult[]
  ): Promise<string> {
    // Sort by calculation date to ensure chronological order
    const sortedResults = [...ndviResults].sort(
      (a, b) => new Date(a.calculationDate).getTime() - new Date(b.calculationDate).getTime()
    );

    // CSV header with all required columns
    const headers = [
      'date',
      'mean_ndvi',
      'min_ndvi',
      'max_ndvi',
      'std_dev',
      'health_status',
      'change_from_previous'
    ];
    let csv = headers.join(',') + '\n';
    
    // Add data rows
    sortedResults.forEach((result, index) => {
      // Format date as YYYY-MM-DD
      const date = this.formatDateISO(result.calculationDate);
      
      // Format NDVI values with 4 decimal places
      const meanNDVI = this.formatNumber(result.meanNDVI, 4);
      const minNDVI = this.formatNumber(result.minNDVI, 4);
      const maxNDVI = this.formatNumber(result.maxNDVI, 4);
      const stdDev = this.formatNumber(result.stdDevNDVI, 4);
      
      // Health status
      const healthStatus = result.healthStatus;
      
      // Calculate change from previous (0 for first entry)
      let changeFromPrevious = '0.0000';
      if (index > 0) {
        const change = result.meanNDVI - sortedResults[index - 1].meanNDVI;
        changeFromPrevious = this.formatNumber(change, 4);
      }
      
      // Build CSV row
      const row = [
        date,
        meanNDVI,
        minNDVI,
        maxNDVI,
        stdDev,
        healthStatus,
        changeFromPrevious
      ];
      
      csv += row.join(',') + '\n';
    });
    
    return csv;
  }

  /**
   * Format date as ISO 8601 date string (YYYY-MM-DD)
   * 
   * @param date - Date to format
   * @returns ISO date string
   */
  private formatDateISO(date: Date): string {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Format number with specified decimal places
   * 
   * @param value - Number to format
   * @param decimals - Number of decimal places
   * @returns Formatted number string
   */
  private formatNumber(value: number, decimals: number): string {
    return value.toFixed(decimals);
  }

  /**
   * Calculate NDVI change from previous point
   * 
   * @param temporal - Temporal data points
   * @returns Array with change values
   */
  private calculateNDVIChanges(temporal: TemporalDataPoint[]): number[] {
    const changes: number[] = [0]; // First point has no previous
    
    for (let i = 1; i < temporal.length; i++) {
      const change = temporal[i].ndvi - temporal[i - 1].ndvi;
      changes.push(change);
    }
    
    return changes;
  }

  /**
   * Export temporal NDVI data as CSV with change metrics
   * 
   * @param parcelleId - Parcelle identifier
   * @param temporal - Temporal data points
   * @returns CSV content with change metrics
   */
  async exportTemporalCSVWithChanges(
    parcelleId: string,
    temporal: TemporalDataPoint[]
  ): Promise<string> {
    const changes = this.calculateNDVIChanges(temporal);
    
    // CSV header
    let csv = 'Date,NDVI,Cloud Cover (%),Health Status,Significant Change,Change from Previous\n';
    
    // Add data rows
    temporal.forEach((point, index) => {
      const date = new Date(point.date).toISOString().split('T')[0];
      const ndvi = point.ndvi.toFixed(4);
      const cloudCover = point.cloudCover.toFixed(2);
      const healthStatus = point.healthStatus;
      const significantChange = point.hasSignificantChange ? 'Yes' : 'No';
      const change = changes[index].toFixed(4);
      
      csv += `${date},${ndvi},${cloudCover},${healthStatus},${significantChange},${change}\n`;
    });
    
    return csv;
  }

  /**
   * Generate certification report as PDF
   * 
   * Creates a comprehensive PDF report for EUDR compliance certification,
   * including parcelle details, deforestation analysis, NDVI trends,
   * before/after imagery comparison, and compliance status.
   * 
   * @param data - Complete data package for report generation
   * @param options - Report generation options
   * @param template - Optional custom report template (uses default if not provided)
   * @returns Promise resolving to PDF file URL in Supabase Storage
   */
  async generateCertificationReport(
    data: CertificationReportData,
    options: ReportOptions,
    template?: ReportTemplate
  ): Promise<string> {
    // Use provided template or create default
    const reportTemplate = template || createDefaultTemplate(options.language);
    const strings = getLocalizedStrings(reportTemplate.language);
    
    // Dynamic import to reduce bundle size
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    
    // Create new PDF document (A4 size)
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });
    
    // Set document metadata
    doc.setProperties({
      title: `${strings.reportTitle} - ${data.parcelle.code || data.parcelle.id}`,
      subject: 'EUDR Compliance Certification',
      author: reportTemplate.branding.companyName,
      keywords: 'EUDR, deforestation, NDVI, certification',
      creator: `${reportTemplate.branding.companyName} ${strings.systemName}`,
    });
    
    let yPosition = reportTemplate.layout.pageMargin; // Current Y position for content
    
    // Add header with branding
    yPosition = this.addPDFHeader(doc, yPosition, reportTemplate, strings);
    
    // Add parcelle information section
    yPosition = this.addParcelleInfoSection(doc, data.parcelle, yPosition, reportTemplate, strings);
    
    // Add compliance status indicator
    yPosition = this.addComplianceStatusSection(
      doc,
      data.complianceStatus,
      data.deforestation,
      yPosition,
      reportTemplate,
      strings
    );
    
    // Add NDVI trend section if requested
    if (options.includeNDVITrend && data.ndviTrend) {
      yPosition = this.addNDVITrendSection(doc, data.ndviTrend, yPosition, options.language);
    }
    
    // Add deforestation analysis section
    if (data.deforestation && data.deforestation.length > 0) {
      yPosition = this.addDeforestationAnalysisSection(
        doc,
        data.deforestation,
        yPosition,
        options.language
      );
    }
    
    // Add before/after imagery comparison if requested
    if (options.includeBeforeAfter && data.baselineImagery && data.currentImagery) {
      yPosition = this.addBeforeAfterSection(
        doc,
        data.baselineImagery,
        data.currentImagery,
        options.baselineDate,
        yPosition,
        options.language
      );
    }
    
    // Add yield prediction if requested
    if (options.includeYieldPrediction && data.yieldPrediction) {
      yPosition = this.addYieldPredictionSection(
        doc,
        data.yieldPrediction,
        yPosition,
        options.language
      );
    }
    
    // Add digital signature with timestamp
    yPosition = this.addDigitalSignature(doc, data.generatedBy, yPosition, options.language);
    
    // Add footer to all pages
    this.addPDFFooter(doc, options.language);
    
    // Generate PDF as blob
    const pdfBlob = doc.output('blob');
    
    // Upload to Supabase Storage
    const fileName = `certification-report-${data.parcelle.id}-${Date.now()}.pdf`;
    const storageUrl = await this.uploadPDFToStorage(pdfBlob, fileName);
    
    return storageUrl;
  }

  /**
   * Add PDF header with logo and title
   */
  private addPDFHeader(doc: any, yPosition: number, template: ReportTemplate, strings: any): number {
    const pageWidth = doc.internal.pageSize.getWidth();
    const primaryColor = hexToRGB(template.colors.primary);
    
    // Add logo if provided
    if (template.branding.logoUrl) {
      // Note: In production, you would load and add the actual logo image
      // doc.addImage(logoData, 'PNG', 20, yPosition, logoWidth, logoHeight);
      // yPosition += logoHeight + 5;
    }
    
    // Add company name
    doc.setFontSize(10);
    doc.setFont(template.fonts.body, 'normal');
    doc.setTextColor(...primaryColor);
    doc.text(template.branding.companyName, pageWidth - 20, yPosition, { align: 'right' });
    
    if (template.branding.tagline) {
      yPosition += 5;
      doc.setFontSize(8);
      doc.text(template.branding.tagline, pageWidth - 20, yPosition, { align: 'right' });
    }
    
    yPosition += 10;
    
    // Reset text color
    doc.setTextColor(0, 0, 0);
    
    // Add title
    doc.setFontSize(20);
    doc.setFont(template.fonts.heading, 'bold');
    doc.setTextColor(...primaryColor);
    doc.text(strings.reportTitle, pageWidth / 2, yPosition, { align: 'center' });
    
    yPosition += 10;
    
    // Add subtitle
    doc.setFontSize(12);
    doc.setFont(template.fonts.body, 'normal');
    const textColor = hexToRGB(template.colors.text);
    doc.setTextColor(...textColor);
    doc.text(strings.reportSubtitle, pageWidth / 2, yPosition, { align: 'center' });
    
    yPosition += 15;
    
    // Add horizontal line
    doc.setLineWidth(0.5);
    doc.setDrawColor(...primaryColor);
    doc.line(template.layout.pageMargin, yPosition, pageWidth - template.layout.pageMargin, yPosition);
    
    // Reset colors
    doc.setTextColor(0, 0, 0);
    doc.setDrawColor(0, 0, 0);
    
    return yPosition + template.layout.sectionSpacing;
  }

  /**
   * Add parcelle information section
   */
  private addParcelleInfoSection(
    doc: any,
    parcelle: CertificationReportData['parcelle'],
    yPosition: number,
    template: ReportTemplate,
    strings: any
  ): number {
    const pageWidth = doc.internal.pageSize.getWidth();
    const primaryColor = hexToRGB(template.colors.primary);
    
    // Section title
    doc.setFontSize(14);
    doc.setFont(template.fonts.heading, 'bold');
    doc.setTextColor(...primaryColor);
    doc.text(strings.parcelleInfoTitle, template.layout.pageMargin, yPosition);
    
    // Reset text color
    doc.setTextColor(0, 0, 0);
    
    yPosition += 8;
    
    // Prepare table data
    const headers = [[strings.code || 'Field', strings.surfaceArea || 'Value']];
    
    const rows: string[][] = [];
    
    if (parcelle.code) {
      rows.push([strings.code, parcelle.code]);
    }
    
    if (parcelle.label) {
      rows.push([strings.label, parcelle.label]);
    }
    
    rows.push([
      strings.surfaceArea,
      `${parcelle.surface_hectares.toFixed(2)} ha`
    ]);
    
    if (parcelle.village) {
      rows.push([strings.village, parcelle.village]);
    }
    
    if (parcelle.region) {
      rows.push([strings.region, parcelle.region]);
    }
    
    if (parcelle.planteur_name) {
      rows.push([strings.farmer, parcelle.planteur_name]);
    }
    
    // Add table using autoTable
    (doc as any).autoTable({
      startY: yPosition,
      head: headers,
      body: rows,
      theme: 'grid',
      headStyles: { 
        fillColor: primaryColor,
        textColor: 255,
        font: template.fonts.heading,
      },
      margin: { 
        left: template.layout.pageMargin, 
        right: template.layout.pageMargin 
      },
      styles: { 
        fontSize: 10,
        font: template.fonts.body,
      },
    });
    
    return (doc as any).lastAutoTable.finalY + template.layout.sectionSpacing;
  }

  /**
   * Add compliance status section with visual indicator
   */
  private addComplianceStatusSection(
    doc: any,
    complianceStatus: 'compliant' | 'non-compliant' | 'requires-review',
    deforestation: DeforestationEvent[] | undefined,
    yPosition: number,
    template: ReportTemplate,
    strings: any
  ): number {
    const pageWidth = doc.internal.pageSize.getWidth();
    const primaryColor = hexToRGB(template.colors.primary);
    
    // Check if we need a new page
    if (yPosition > 240) {
      doc.addPage();
      yPosition = template.layout.pageMargin;
    }
    
    // Section title
    doc.setFontSize(14);
    doc.setFont(template.fonts.heading, 'bold');
    doc.setTextColor(...primaryColor);
    doc.text(strings.complianceStatusTitle, template.layout.pageMargin, yPosition);
    
    // Reset text color
    doc.setTextColor(0, 0, 0);
    
    yPosition += 10;
    
    // Determine status color and text using template
    const statusColor = getStatusColor(complianceStatus, template.colors);
    const statusText = getStatusText(complianceStatus, strings);
    
    // Draw status box
    doc.setFillColor(...statusColor);
    doc.roundedRect(
      template.layout.pageMargin, 
      yPosition, 
      pageWidth - (template.layout.pageMargin * 2), 
      15, 
      3, 
      3, 
      'F'
    );
    
    // Add status text
    doc.setFontSize(16);
    doc.setFont(template.fonts.heading, 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(statusText, pageWidth / 2, yPosition + 10, { align: 'center' });
    
    // Reset text color
    doc.setTextColor(0, 0, 0);
    
    yPosition += 20;
    
    // Add compliance details
    doc.setFontSize(10);
    doc.setFont(template.fonts.body, 'normal');
    
    const alertCount = deforestation?.length || 0;
    const pendingAlerts = deforestation?.filter(d => d.status === 'pending').length || 0;
    
    const detailsText = `${strings.alertsDetected}: ${alertCount} (${pendingAlerts} ${strings.pendingAlerts})`;
    
    doc.text(detailsText, template.layout.pageMargin, yPosition);
    
    yPosition += 8;
    
    // Add declaration statement
    if (complianceStatus === 'compliant') {
      doc.setFont(template.fonts.body, 'italic');
      const declaration = strings.complianceDeclaration;
      
      const splitDeclaration = doc.splitTextToSize(
        declaration, 
        pageWidth - (template.layout.pageMargin * 2)
      );
      doc.text(splitDeclaration, template.layout.pageMargin, yPosition);
      yPosition += splitDeclaration.length * 5;
    }
    
    return yPosition + template.layout.sectionSpacing;
  }

  /**
   * Add NDVI trend section with statistics
   */
  private addNDVITrendSection(
    doc: any,
    ndviTrend: TemporalDataPoint[],
    yPosition: number,
    language: 'fr' | 'en'
  ): number {
    // Check if we need a new page
    if (yPosition > 220) {
      doc.addPage();
      yPosition = 20;
    }
    
    // Section title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    const sectionTitle = language === 'fr' 
      ? 'Évolution NDVI' 
      : 'NDVI Trend';
    doc.text(sectionTitle, 20, yPosition);
    
    yPosition += 8;
    
    // Calculate statistics
    const avgNDVI = ndviTrend.reduce((sum, point) => sum + point.ndvi, 0) / ndviTrend.length;
    const minNDVI = Math.min(...ndviTrend.map(p => p.ndvi));
    const maxNDVI = Math.max(...ndviTrend.map(p => p.ndvi));
    const significantChanges = ndviTrend.filter(p => p.hasSignificantChange).length;
    
    // Prepare table data
    const headers = language === 'fr' 
      ? [['Métrique', 'Valeur']]
      : [['Metric', 'Value']];
    
    const rows = [
      [
        language === 'fr' ? 'Période' : 'Period',
        `${this.formatDate(ndviTrend[0].date)} - ${this.formatDate(ndviTrend[ndviTrend.length - 1].date)}`
      ],
      [
        language === 'fr' ? 'Points de données' : 'Data Points',
        ndviTrend.length.toString()
      ],
      [
        language === 'fr' ? 'NDVI moyen' : 'Average NDVI',
        avgNDVI.toFixed(3)
      ],
      [
        language === 'fr' ? 'NDVI minimum' : 'Minimum NDVI',
        minNDVI.toFixed(3)
      ],
      [
        language === 'fr' ? 'NDVI maximum' : 'Maximum NDVI',
        maxNDVI.toFixed(3)
      ],
      [
        language === 'fr' ? 'Changements significatifs' : 'Significant Changes',
        significantChanges.toString()
      ],
    ];
    
    // Add table
    (doc as any).autoTable({
      startY: yPosition,
      head: headers,
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [45, 80, 22], textColor: 255 },
      margin: { left: 20, right: 20 },
      styles: { fontSize: 10 },
    });
    
    return (doc as any).lastAutoTable.finalY + 10;
  }

  /**
   * Add deforestation analysis section
   */
  private addDeforestationAnalysisSection(
    doc: any,
    deforestation: DeforestationEvent[],
    yPosition: number,
    language: 'fr' | 'en'
  ): number {
    // Check if we need a new page
    if (yPosition > 200) {
      doc.addPage();
      yPosition = 20;
    }
    
    // Section title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    const sectionTitle = language === 'fr' 
      ? 'Analyse de Déforestation' 
      : 'Deforestation Analysis';
    doc.text(sectionTitle, 20, yPosition);
    
    yPosition += 8;
    
    // Prepare table data
    const headers = language === 'fr'
      ? [['Date', 'Changement NDVI', 'Zone Affectée', 'Statut']]
      : [['Date', 'NDVI Change', 'Affected Area', 'Status']];
    
    const rows = deforestation.map(alert => [
      this.formatDate(alert.detectionDate),
      alert.ndviChange.toFixed(3),
      `${alert.affectedAreaHectares.toFixed(2)} ha (${alert.affectedAreaPercent.toFixed(1)}%)`,
      this.translateAlertStatus(alert.status)
    ]);
    
    // Add table
    (doc as any).autoTable({
      startY: yPosition,
      head: headers,
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [239, 68, 68], textColor: 255 },
      margin: { left: 20, right: 20 },
      styles: { fontSize: 9 },
    });
    
    return (doc as any).lastAutoTable.finalY + 10;
  }

  /**
   * Add before/after imagery comparison section
   */
  private addBeforeAfterSection(
    doc: any,
    baselineImagery: ImageryData,
    currentImagery: ImageryData,
    baselineDate: Date,
    yPosition: number,
    language: 'fr' | 'en'
  ): number {
    // Check if we need a new page
    if (yPosition > 220) {
      doc.addPage();
      yPosition = 20;
    }
    
    // Section title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    const sectionTitle = language === 'fr' 
      ? 'Comparaison Avant/Après' 
      : 'Before/After Comparison';
    doc.text(sectionTitle, 20, yPosition);
    
    yPosition += 8;
    
    // Add comparison details
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    const baselineText = language === 'fr'
      ? `Date de référence EUDR: ${this.formatDate(baselineDate)}`
      : `EUDR Baseline Date: ${this.formatDate(baselineDate)}`;
    doc.text(baselineText, 20, yPosition);
    yPosition += 6;
    
    const baselineAcqText = language === 'fr'
      ? `Imagerie de référence: ${this.formatDate(baselineImagery.acquisitionDate)} (Couverture nuageuse: ${baselineImagery.cloudCoverPercent.toFixed(1)}%)`
      : `Baseline Imagery: ${this.formatDate(baselineImagery.acquisitionDate)} (Cloud cover: ${baselineImagery.cloudCoverPercent.toFixed(1)}%)`;
    doc.text(baselineAcqText, 20, yPosition);
    yPosition += 6;
    
    const currentAcqText = language === 'fr'
      ? `Imagerie actuelle: ${this.formatDate(currentImagery.acquisitionDate)} (Couverture nuageuse: ${currentImagery.cloudCoverPercent.toFixed(1)}%)`
      : `Current Imagery: ${this.formatDate(currentImagery.acquisitionDate)} (Cloud cover: ${currentImagery.cloudCoverPercent.toFixed(1)}%)`;
    doc.text(currentAcqText, 20, yPosition);
    yPosition += 10;
    
    // Note about imagery URLs
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    const note = language === 'fr'
      ? 'Note: Les images satellite sont disponibles via les URLs stockées dans le système.'
      : 'Note: Satellite imagery is available via URLs stored in the system.';
    doc.text(note, 20, yPosition);
    
    return yPosition + 10;
  }

  /**
   * Add yield prediction section
   */
  private addYieldPredictionSection(
    doc: any,
    yieldPrediction: YieldPrediction,
    yPosition: number,
    language: 'fr' | 'en'
  ): number {
    // Check if we need a new page
    if (yPosition > 220) {
      doc.addPage();
      yPosition = 20;
    }
    
    // Section title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    const sectionTitle = language === 'fr' 
      ? 'Prévision de Rendement' 
      : 'Yield Prediction';
    doc.text(sectionTitle, 20, yPosition);
    
    yPosition += 8;
    
    // Prepare table data
    const headers = language === 'fr' 
      ? [['Métrique', 'Valeur']]
      : [['Metric', 'Value']];
    
    const confidenceText = language === 'fr'
      ? { high: 'Élevée', medium: 'Moyenne', low: 'Faible' }
      : { high: 'High', medium: 'Medium', low: 'Low' };
    
    const rows = [
      [
        language === 'fr' ? 'Saison de récolte' : 'Harvest Season',
        yieldPrediction.harvestSeason
      ],
      [
        language === 'fr' ? 'Rendement prévu' : 'Predicted Yield',
        `${yieldPrediction.predictedYieldKgPerHa.toFixed(2)} kg/ha`
      ],
      [
        language === 'fr' ? 'Niveau de confiance' : 'Confidence Level',
        confidenceText[yieldPrediction.confidenceLevel]
      ],
      [
        language === 'fr' ? 'Intervalle de confiance' : 'Confidence Interval',
        `${yieldPrediction.confidenceIntervalLower.toFixed(2)} - ${yieldPrediction.confidenceIntervalUpper.toFixed(2)} kg/ha`
      ],
      [
        language === 'fr' ? 'Version du modèle' : 'Model Version',
        yieldPrediction.modelVersion
      ],
    ];
    
    // Add table
    (doc as any).autoTable({
      startY: yPosition,
      head: headers,
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [45, 80, 22], textColor: 255 },
      margin: { left: 20, right: 20 },
      styles: { fontSize: 10 },
    });
    
    return (doc as any).lastAutoTable.finalY + 10;
  }

  /**
   * Add digital signature with timestamp
   */
  private addDigitalSignature(
    doc: any,
    generatedBy: string,
    yPosition: number,
    language: 'fr' | 'en'
  ): number {
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Position signature near bottom of page
    if (yPosition > pageHeight - 40) {
      doc.addPage();
      yPosition = 20;
    } else {
      yPosition = Math.max(yPosition, pageHeight - 40);
    }
    
    // Add horizontal line
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setLineWidth(0.3);
    doc.line(20, yPosition, pageWidth - 20, yPosition);
    
    yPosition += 8;
    
    // Add signature text
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    
    const timestamp = new Date().toISOString();
    const signatureText = language === 'fr'
      ? `Rapport généré le ${this.formatDate(new Date())} à ${new Date().toLocaleTimeString('fr-FR')}`
      : `Report generated on ${this.formatDate(new Date())} at ${new Date().toLocaleTimeString('en-US')}`;
    
    doc.text(signatureText, 20, yPosition);
    yPosition += 5;
    
    const generatedByText = language === 'fr'
      ? `Généré par: ${generatedBy}`
      : `Generated by: ${generatedBy}`;
    doc.text(generatedByText, 20, yPosition);
    yPosition += 5;
    
    // Add digital signature hash (simplified)
    const signatureHash = this.generateSignatureHash(timestamp, generatedBy);
    const hashText = language === 'fr'
      ? `Signature numérique: ${signatureHash}`
      : `Digital signature: ${signatureHash}`;
    doc.setFontSize(8);
    doc.setFont('courier', 'normal');
    doc.text(hashText, 20, yPosition);
    
    return yPosition + 10;
  }

  /**
   * Add footer to all pages
   */
  private addPDFFooter(doc: any, language: 'fr' | 'en'): void {
    const pageCount = doc.internal.getNumberOfPages();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      
      // Add page number
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(128, 128, 128);
      
      const pageText = language === 'fr'
        ? `Page ${i} sur ${pageCount}`
        : `Page ${i} of ${pageCount}`;
      
      doc.text(pageText, pageWidth / 2, pageHeight - 10, { align: 'center' });
      
      // Add CocoaTrack branding
      doc.setFontSize(8);
      doc.text('CocoaTrack - Satellite Analysis System', 20, pageHeight - 10);
      
      // Reset text color
      doc.setTextColor(0, 0, 0);
    }
  }

  /**
   * Generate a simple signature hash for the report
   */
  private generateSignatureHash(timestamp: string, generatedBy: string): string {
    // Simple hash generation (in production, use proper cryptographic signing)
    const data = `${timestamp}-${generatedBy}`;
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
  }

  /**
   * Upload PDF blob to Supabase Storage
   */
  private async uploadPDFToStorage(pdfBlob: Blob, fileName: string): Promise<string> {
    // This is a placeholder - actual implementation would use Supabase client
    // For now, return a mock URL
    // In production, this would upload to the 'certification-reports' bucket
    
    // Example implementation:
    // const { data, error } = await supabase.storage
    //   .from('certification-reports')
    //   .upload(fileName, pdfBlob, {
    //     contentType: 'application/pdf',
    //     cacheControl: '3600',
    //   });
    //
    // if (error) throw error;
    // return data.path;
    
    return `/storage/certification-reports/${fileName}`;
  }

  /**
   * Generate certification reports for multiple parcelles and package as ZIP
   * 
   * Creates individual PDF reports for each parcelle and packages them into
   * a single ZIP archive for batch download. Provides progress callback for
   * UI progress indicators.
   * 
   * @param dataArray - Array of certification report data for multiple parcelles
   * @param options - Report generation options (applied to all reports)
   * @param template - Optional custom report template
   * @param onProgress - Optional callback for progress updates (current, total)
   * @returns Promise resolving to ZIP file URL in Supabase Storage
   */
  async generateBatchCertificationReports(
    dataArray: CertificationReportData[],
    options: ReportOptions,
    template?: ReportTemplate,
    onProgress?: (current: number, total: number) => void
  ): Promise<string> {
    // Dynamic import JSZip to reduce bundle size
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    
    const total = dataArray.length;
    const reportTemplate = template || createDefaultTemplate(options.language);
    
    // Generate reports for each parcelle
    for (let i = 0; i < dataArray.length; i++) {
      const data = dataArray[i];
      
      // Report progress
      if (onProgress) {
        onProgress(i + 1, total);
      }
      
      // Generate PDF for this parcelle
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      
      // Set document metadata
      const strings = getLocalizedStrings(reportTemplate.language);
      doc.setProperties({
        title: `${strings.reportTitle} - ${data.parcelle.code || data.parcelle.id}`,
        subject: 'EUDR Compliance Certification',
        author: reportTemplate.branding.companyName,
        keywords: 'EUDR, deforestation, NDVI, certification',
        creator: `${reportTemplate.branding.companyName} ${strings.systemName}`,
      });
      
      let yPosition = reportTemplate.layout.pageMargin;
      
      // Add all report sections
      yPosition = this.addPDFHeader(doc, yPosition, reportTemplate, strings);
      yPosition = this.addParcelleInfoSection(doc, data.parcelle, yPosition, reportTemplate, strings);
      yPosition = this.addComplianceStatusSection(
        doc,
        data.complianceStatus,
        data.deforestation,
        yPosition,
        reportTemplate,
        strings
      );
      
      if (options.includeNDVITrend && data.ndviTrend) {
        yPosition = this.addNDVITrendSection(doc, data.ndviTrend, yPosition, options.language);
      }
      
      if (data.deforestation && data.deforestation.length > 0) {
        yPosition = this.addDeforestationAnalysisSection(
          doc,
          data.deforestation,
          yPosition,
          options.language
        );
      }
      
      if (options.includeBeforeAfter && data.baselineImagery && data.currentImagery) {
        yPosition = this.addBeforeAfterSection(
          doc,
          data.baselineImagery,
          data.currentImagery,
          options.baselineDate,
          yPosition,
          options.language
        );
      }
      
      if (options.includeYieldPrediction && data.yieldPrediction) {
        yPosition = this.addYieldPredictionSection(
          doc,
          data.yieldPrediction,
          yPosition,
          options.language
        );
      }
      
      yPosition = this.addDigitalSignature(doc, data.generatedBy, yPosition, options.language);
      this.addPDFFooter(doc, options.language);
      
      // Generate PDF as blob
      const pdfBlob = doc.output('blob');
      
      // Create filename for this parcelle
      const parcelleIdentifier = data.parcelle.code || data.parcelle.id.substring(0, 8);
      const sanitizedIdentifier = parcelleIdentifier.replace(/[^a-zA-Z0-9-_]/g, '_');
      const fileName = `certification-report-${sanitizedIdentifier}.pdf`;
      
      // Add to ZIP archive
      zip.file(fileName, pdfBlob);
    }
    
    // Generate ZIP file
    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 6, // Balanced compression (1-9, where 9 is maximum)
      },
    });
    
    // Upload ZIP to Supabase Storage
    const timestamp = Date.now();
    const zipFileName = `batch-certification-reports-${timestamp}.zip`;
    const zipUrl = await this.uploadZIPToStorage(zipBlob, zipFileName);
    
    return zipUrl;
  }

  /**
   * Upload ZIP blob to Supabase Storage
   * 
   * @param zipBlob - ZIP file blob
   * @param fileName - File name for storage
   * @returns Storage URL
   */
  private async uploadZIPToStorage(zipBlob: Blob, fileName: string): Promise<string> {
    // This is a placeholder - actual implementation would use Supabase client
    // For now, return a mock URL
    // In production, this would upload to the 'certification-reports' bucket
    
    // Example implementation:
    // const { data, error } = await supabase.storage
    //   .from('certification-reports')
    //   .upload(fileName, zipBlob, {
    //     contentType: 'application/zip',
    //     cacheControl: '3600',
    //   });
    //
    // if (error) throw error;
    // return data.path;
    
    return `/storage/certification-reports/${fileName}`;
  }
}

/**
 * Data required for certification report generation
 */
export interface CertificationReportData {
  parcelle: ParcelleKMLData;
  complianceStatus: 'compliant' | 'non-compliant' | 'requires-review';
  deforestation?: DeforestationEvent[];
  ndviTrend?: TemporalDataPoint[];
  baselineImagery?: ImageryData;
  currentImagery?: ImageryData;
  yieldPrediction?: YieldPrediction;
  generatedBy: string; // User ID or name
}

/**
 * Singleton instance of ExportService
 */
export const exportService = new ExportService();
