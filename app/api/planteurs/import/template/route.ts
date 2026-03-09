// CocoaTrack V2 - Planteurs Import Template API Route
// GET /api/planteurs/import/template - Download CSV template for planteur import

import { NextRequest, NextResponse } from 'next/server';
import { addSecurityHeaders } from '@/lib/security/middleware';

/**
 * GET /api/planteurs/import/template
 * 
 * Generate and download a CSV template with correct headers and example data.
 * 
 * Requirements: 9.5
 */
export async function GET(request: NextRequest) {
  try {
    // Define CSV headers
    const headers = ['nom', 'prénoms', 'CNI', 'téléphone', 'superficie'];
    
    // Define example rows with sample data
    const exampleRows = [
      ['Konan', 'Yao', 'CI123456', '+2250701234567', '5.5'],
      ['Kouassi', 'Marie', 'CI789012', '+2250709876543', '3.2'],
      ['Tra Bi', 'Jean', '', '+2250701111111', ''],
    ];
    
    // Build CSV content
    const csvLines = [
      headers.join(','),
      ...exampleRows.map(row => row.join(','))
    ];
    const csvContent = csvLines.join('\n');
    
    // Create response with CSV content
    const response = new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="planteurs_import_template.csv"',
      },
    });
    
    // Add security headers
    addSecurityHeaders(response);
    
    return response;
  } catch (error) {
    console.error('[planteurs/import/template] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      {
        error_code: 'INTERNAL_ERROR',
        message: 'Une erreur interne s\'est produite',
        details: { reason: errorMessage },
      },
      { status: 500 }
    );
  }
}
