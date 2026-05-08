/**
 * API Route: Export Temporal NDVI Data as CSV
 * 
 * GET /api/satellite/export/csv?parcelleId=xxx&startDate=xxx&endDate=xxx
 * POST /api/satellite/export/csv (body: { parcelleId, startDate, endDate })
 * 
 * Exports temporal NDVI data for a parcelle as CSV file with full statistics.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { exportService } from '@/lib/satellite/services/export.service';
import type { NDVIResult } from '@/lib/satellite/types';
import { z } from 'zod';

/**
 * Request body schema for POST endpoint
 */
const ExportCSVSchema = z.object({
  parcelleId: z.string().uuid('Invalid parcelleId format'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

/**
 * Shared logic for CSV export (used by both GET and POST)
 */
async function handleCSVExport(
  parcelleId: string,
  startDateStr: string | null | undefined,
  endDateStr: string | null | undefined
): Promise<NextResponse> {
  const supabase = await createServerSupabaseClient();

  // Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Check if user has access to this parcelle
  const { data: parcelle, error: parcelleError } = await supabase
    .from('parcelles')
    .select('id, code, label')
    .eq('id', parcelleId)
    .single();

  if (parcelleError || !parcelle) {
    return NextResponse.json(
      { error: 'Parcelle not found or access denied' },
      { status: 404 }
    );
  }

  // Type assertion for parcelle
  const parcelleData = parcelle as { id: string; code: string | null; label: string | null };

  // Build query for NDVI results
  let query = supabase
    .from('ndvi_results')
    .select('*')
    .eq('parcelle_id', parcelleId)
    .order('calculation_date', { ascending: true });

  // Apply date filters if provided
  if (startDateStr) {
    const startDate = new Date(startDateStr);
    if (isNaN(startDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid startDate format' },
        { status: 400 }
      );
    }
    query = query.gte('calculation_date', startDate.toISOString());
  }

  if (endDateStr) {
    const endDate = new Date(endDateStr);
    if (isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid endDate format' },
        { status: 400 }
      );
    }
    query = query.lte('calculation_date', endDate.toISOString());
  }

  // Fetch NDVI results
  const { data: ndviResultsRaw, error: ndviError } = await query;

  if (ndviError) {
    console.error('Error fetching NDVI results:', ndviError);
    return NextResponse.json(
      { error: 'Failed to fetch NDVI data' },
      { status: 500 }
    );
  }

  if (!ndviResultsRaw || ndviResultsRaw.length === 0) {
    return NextResponse.json(
      { error: 'No NDVI data found for this parcelle in the specified date range' },
      { status: 404 }
    );
  }

  // Transform database rows to NDVIResult objects
  const ndviResults: NDVIResult[] = ndviResultsRaw.map((row: any) => ({
    id: row.id,
    parcelleId: row.parcelle_id,
    imageryId: row.imagery_id,
    calculationDate: new Date(row.calculation_date),
    meanNDVI: row.mean_ndvi,
    minNDVI: row.min_ndvi,
    maxNDVI: row.max_ndvi,
    stdDevNDVI: row.std_dev_ndvi,
    healthStatus: row.health_status as 'excellent' | 'good' | 'fair' | 'poor' | 'critical',
    ndviRasterUrl: row.ndvi_raster_url,
    createdAt: new Date(row.created_at),
  }));

  // Generate CSV
  const csv = await exportService.exportTemporalCSVWithStats(parcelleId, ndviResults);

  // Generate filename
  const parcelleCode = parcelleData.code || parcelleData.label || parcelleId.substring(0, 8);
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `ndvi-temporal-${parcelleCode}-${dateStr}.csv`;

  // Return CSV with appropriate headers
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}

/**
 * POST handler for CSV export
 * 
 * Body parameters:
 * - parcelleId: UUID of the parcelle (required)
 * - startDate: ISO date string for start of range (optional)
 * - endDate: ISO date string for end of range (optional)
 * 
 * Returns CSV file as text/csv with appropriate headers
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validation = ExportCSVSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request body',
          details: validation.error.errors 
        },
        { status: 400 }
      );
    }

    const { parcelleId, startDate, endDate } = validation.data;

    // Use shared logic
    return await handleCSVExport(parcelleId, startDate, endDate);
  } catch (error) {
    console.error('Error in CSV export (POST):', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET handler for CSV export
 * 
 * Query parameters:
 * - parcelleId: UUID of the parcelle (required)
 * - startDate: ISO date string for start of range (optional)
 * - endDate: ISO date string for end of range (optional)
 * 
 * Returns CSV file as text/csv with appropriate headers
 */
export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const parcelleId = searchParams.get('parcelleId');
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    // Validate required parameters
    if (!parcelleId) {
      return NextResponse.json(
        { error: 'Missing required parameter: parcelleId' },
        { status: 400 }
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(parcelleId)) {
      return NextResponse.json(
        { error: 'Invalid parcelleId format' },
        { status: 400 }
      );
    }

    // Use shared logic
    return await handleCSVExport(parcelleId, startDateStr, endDateStr);
  } catch (error) {
    console.error('Error in CSV export (GET):', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
