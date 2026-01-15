// CocoaTrack V2 - Parcelles Export API Route
// GET /api/parcelles/export - Export parcelles to CSV or XLSX format

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { applyRateLimit } from '@/lib/security/middleware';
import {
  parcelleFiltersSchema,
  type ParcelleFiltersOutput,
} from '@/lib/validations/parcelle';
import type { Certification, ConformityStatus } from '@/types/parcelles';
import {
  PARCELLE_LIMITS,
  CERTIFICATION_LABELS,
  CONFORMITY_STATUS_LABELS,
  PARCELLE_SOURCE_LABELS,
} from '@/types/parcelles';
import {
  unauthorizedResponse,
  validationErrorResponse,
  limitExceededResponse,
  handleErrorResponse,
  toNextResponse,
  createParcelleError,
  ParcelleErrorCodes,
} from '@/lib/errors/parcelle-errors';
import * as XLSX from 'xlsx';

/**
 * Raw row type from list_parcelles RPC function
 */
interface ListParcellesRow {
  id: string;
  planteur_id: string;
  code: string;
  label: string | null;
  village: string | null;
  geometry_geojson: Record<string, unknown>;
  centroid_lat: number;
  centroid_lng: number;
  surface_hectares: number;
  certifications: string[];
  conformity_status: string;
  risk_flags: Record<string, unknown>;
  source: string;
  import_file_id: string | null;
  feature_hash: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  planteur_name: string;
  planteur_code: string;
  planteur_cooperative_id: string;
  total_count: number;
}

/**
 * Export row data structure
 */
interface ExportRow {
  identifiant: string;
  planteur: string;
  village: string;
  hectares: string;
  certificats: string;
  statut: string;
  centroid_lat: string;
  centroid_lng: string;
  source: string;
}

/**
 * Column headers for export (French labels)
 */
const EXPORT_HEADERS = {
  identifiant: 'Identifiant',
  planteur: 'Planteur',
  village: 'Village',
  hectares: 'Hectares',
  certificats: 'Certificats',
  statut: 'Statut',
  centroid_lat: 'Latitude',
  centroid_lng: 'Longitude',
  source: 'Source',
};

/**
 * Generate XLSX blob from export data
 */
function generateXlsxBuffer(data: ExportRow[]): Uint8Array {
  const headers = Object.values(EXPORT_HEADERS);
  
  const rows = data.map((row) => [
    row.identifiant,
    row.planteur,
    row.village,
    row.hectares,
    row.certificats,
    row.statut,
    row.centroid_lat,
    row.centroid_lng,
    row.source,
  ]);
  
  const sheetData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  
  ws['!cols'] = [
    { wch: 15 },
    { wch: 25 },
    { wch: 20 },
    { wch: 12 },
    { wch: 30 },
    { wch: 20 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
  ];
  
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Parcelles');
  
  return new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
}

/**
 * Generate CSV string from export data
 */
function generateCsvString(data: ExportRow[]): string {
  const headers = Object.values(EXPORT_HEADERS);
  
  const escapeCSV = (value: string): string => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };
  
  const lines: string[] = [];
  lines.push(headers.map(escapeCSV).join(','));
  
  for (const row of data) {
    const values = [
      row.identifiant,
      row.planteur,
      row.village,
      row.hectares,
      row.certificats,
      row.statut,
      row.centroid_lat,
      row.centroid_lng,
      row.source,
    ];
    lines.push(values.map(escapeCSV).join(','));
  }
  
  return '\uFEFF' + lines.join('\r\n');
}

/**
 * GET /api/parcelles/export
 * 
 * Export parcelles to CSV or XLSX format.
 */
export async function GET(request: NextRequest) {
  // Apply rate limiting
  const { allowed, response: rateLimitResponse } = applyRateLimit(request, 'api');
  if (!allowed && rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Create Supabase client
    const supabase = await createServerSupabaseClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return unauthorizedResponse();
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    
    // Get format parameter (default to csv)
    const format = searchParams.get('format') || 'csv';
    if (format !== 'csv' && format !== 'xlsx') {
      return validationErrorResponse('format', 'Must be "csv" or "xlsx"');
    }

    // Extract filter parameters
    const rawFilters: Record<string, unknown> = {};

    if (searchParams.has('planteur_id')) {
      rawFilters.planteur_id = searchParams.get('planteur_id');
    }
    if (searchParams.has('conformity_status')) {
      rawFilters.conformity_status = searchParams.get('conformity_status');
    }
    if (searchParams.has('certification')) {
      rawFilters.certification = searchParams.get('certification');
    }
    if (searchParams.has('village')) {
      rawFilters.village = searchParams.get('village');
    }
    if (searchParams.has('source')) {
      rawFilters.source = searchParams.get('source');
    }
    if (searchParams.has('import_file_id')) {
      rawFilters.import_file_id = searchParams.get('import_file_id');
    }
    if (searchParams.has('search')) {
      rawFilters.search = searchParams.get('search');
    }
    if (searchParams.has('bbox')) {
      rawFilters.bbox = searchParams.get('bbox');
    }
    if (searchParams.has('is_active')) {
      rawFilters.is_active = searchParams.get('is_active') === 'true';
    }

    // For export, we use max export rows as page size
    rawFilters.page = 1;
    rawFilters.pageSize = PARCELLE_LIMITS.MAX_EXPORT_ROWS;

    // Validate filters with Zod schema
    const parseResult = parcelleFiltersSchema.safeParse(rawFilters);
    
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0];
      return validationErrorResponse(firstError.path.join('.'), firstError.message);
    }

    const validatedFilters = parseResult.data as ParcelleFiltersOutput;
    
    const {
      planteur_id,
      conformity_status,
      certification,
      village,
      source,
      import_file_id,
      search,
      bbox,
      is_active,
    } = validatedFilters;

    // Prepare RPC parameters for export
    const rpcParams: Record<string, unknown> = {
      p_is_active: is_active,
      p_page: 1,
      p_page_size: PARCELLE_LIMITS.MAX_EXPORT_ROWS,
      p_simplify: false,
    };

    // Add optional filters
    if (planteur_id) {
      rpcParams.p_planteur_id = planteur_id;
    }
    if (conformity_status) {
      rpcParams.p_conformity_status = conformity_status;
    }
    if (certification) {
      rpcParams.p_certification = certification;
    }
    if (village) {
      rpcParams.p_village = village;
    }
    if (source) {
      rpcParams.p_source = source;
    }
    if (import_file_id) {
      rpcParams.p_import_file_id = import_file_id;
    }
    if (search) {
      rpcParams.p_search = search;
    }
    
    if (bbox) {
      rpcParams.p_bbox_min_lng = bbox.minLng;
      rpcParams.p_bbox_min_lat = bbox.minLat;
      rpcParams.p_bbox_max_lng = bbox.maxLng;
      rpcParams.p_bbox_max_lat = bbox.maxLat;
    }

    // Call the RPC function
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await supabase.rpc('list_parcelles', rpcParams as any);

    if (error) {
      console.error('Error fetching parcelles for export:', error);
      return toNextResponse(createParcelleError(
        ParcelleErrorCodes.INTERNAL_ERROR,
        'Failed to fetch parcelles for export',
        { reason: error.message }
      ));
    }

    const rows = (data || []) as ListParcellesRow[];
    
    // Check if total exceeds limit
    const total = rows.length > 0 ? rows[0].total_count : 0;
    if (total > PARCELLE_LIMITS.MAX_EXPORT_ROWS) {
      return limitExceededResponse(PARCELLE_LIMITS.MAX_EXPORT_ROWS, total, 'export_rows');
    }

    // Transform rows to export format
    const exportData: ExportRow[] = rows.map((row) => ({
      identifiant: row.code,
      planteur: row.planteur_name,
      village: row.village || '',
      hectares: Number(row.surface_hectares).toFixed(4),
      certificats: (row.certifications || [])
        .map((cert: string) => CERTIFICATION_LABELS[cert as Certification] || cert)
        .join(', '),
      statut: CONFORMITY_STATUS_LABELS[row.conformity_status as ConformityStatus] || row.conformity_status,
      centroid_lat: row.centroid_lat?.toFixed(6) || '',
      centroid_lng: row.centroid_lng?.toFixed(6) || '',
      source: PARCELLE_SOURCE_LABELS[row.source as keyof typeof PARCELLE_SOURCE_LABELS] || row.source,
    }));

    // Generate file based on format
    let fileBlob: Blob;
    let contentType: string;
    let filename: string;
    const timestamp = new Date().toISOString().split('T')[0];

    if (format === 'xlsx') {
      const xlsxData = generateXlsxBuffer(exportData);
      const arrayBuffer = xlsxData.buffer.slice(xlsxData.byteOffset, xlsxData.byteOffset + xlsxData.byteLength) as ArrayBuffer;
      fileBlob = new Blob([arrayBuffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      filename = `parcelles_export_${timestamp}.xlsx`;
    } else {
      const csvContent = generateCsvString(exportData);
      fileBlob = new Blob([csvContent], { type: 'text/csv; charset=utf-8' });
      contentType = 'text/csv; charset=utf-8';
      filename = `parcelles_export_${timestamp}.csv`;
    }

    // Create response with file download
    const response = new Response(fileBlob, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(fileBlob.size),
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      },
    });

    return response;
  } catch (error) {
    return handleErrorResponse(error, 'GET /api/parcelles/export');
  }
}
