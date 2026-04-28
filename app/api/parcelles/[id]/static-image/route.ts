// CocoaTrack V2 - Generate Static Image API Route
// Generate high-resolution static images of parcelles using Mapbox Static Images API

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { CONFORMITY_STATUS_COLORS } from '@/types/parcelles';

const MAPBOX_STATIC_API_URL = 'https://api.mapbox.com/styles/v1';

/**
 * GET /api/parcelles/[id]/static-image
 * Generate a static satellite image of a parcelle with overlay
 * 
 * Query params:
 * - width: Image width (default: 800, max: 1280)
 * - height: Image height (default: 600, max: 1280)
 * - retina: Use @2x for high-DPI displays (default: true)
 * - style: Map style (default: satellite-v9)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { id: parcelleId } = await params;
    const { searchParams } = new URL(request.url);

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get Mapbox access token
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!mapboxToken) {
      return NextResponse.json(
        { error: 'Mapbox access token not configured' },
        { status: 500 }
      );
    }

    // Parse query parameters
    const width = Math.min(parseInt(searchParams.get('width') || '800'), 1280);
    const height = Math.min(parseInt(searchParams.get('height') || '600'), 1280);
    const retina = searchParams.get('retina') !== 'false';
    const style = searchParams.get('style') || 'satellite-v9';

    // Fetch parcelle
    const { data, error: fetchError } = await supabase
      .from('parcelles')
      .select('id, code, geometry, conformity_status')
      .eq('id', parcelleId)
      .single();

    if (fetchError || !data) {
      return NextResponse.json(
        { error: 'Parcelle not found' },
        { status: 404 }
      );
    }

    // Type assertion for parcelle
    type ParcelleData = {
      id: string;
      code: string | null;
      geometry: { type: string; coordinates: number[][][][] };
      conformity_status: string;
    };

    const parcelle = data as ParcelleData;

    if (!parcelle.geometry || !parcelle.geometry.coordinates) {
      return NextResponse.json(
        { error: 'Parcelle has no geometry' },
        { status: 400 }
      );
    }

    // Get color based on conformity status
    const color = CONFORMITY_STATUS_COLORS[parcelle.conformity_status as keyof typeof CONFORMITY_STATUS_COLORS] || '#6FAF3D';
    const hexColor = color.replace('#', '%23'); // URL encode the # symbol

    // Build GeoJSON overlay
    // Mapbox expects coordinates in [lng, lat] format (which is what we have)
    const geojson = {
      type: 'Feature',
      geometry: {
        type: parcelle.geometry.type,
        coordinates: parcelle.geometry.coordinates,
      },
      properties: {
        stroke: hexColor,
        'stroke-width': 3,
        'stroke-opacity': 1,
        fill: hexColor,
        'fill-opacity': 0.35,
      },
    };

    // Encode GeoJSON as URI component
    const geojsonEncoded = encodeURIComponent(JSON.stringify(geojson));

    // Build Mapbox Static Images API URL
    // Format: /styles/v1/{username}/{style_id}/static/geojson({geojson})/auto/{width}x{height}{@2x}
    const retinaParam = retina ? '@2x' : '';
    const imageUrl = `${MAPBOX_STATIC_API_URL}/mapbox/${style}/static/geojson(${geojsonEncoded})/auto/${width}x${height}${retinaParam}?access_token=${mapboxToken}&attribution=false&logo=false`;

    // Fetch the image from Mapbox
    const imageResponse = await fetch(imageUrl);

    if (!imageResponse.ok) {
      const errorText = await imageResponse.text();
      console.error('Mapbox Static Images API error:', errorText);
      return NextResponse.json(
        { error: `Mapbox API error: ${imageResponse.statusText}` },
        { status: imageResponse.status }
      );
    }

    // Get the image buffer
    const imageBuffer = await imageResponse.arrayBuffer();

    // Return the image with appropriate headers
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `inline; filename="parcelle-${parcelle.code || parcelleId}.png"`,
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
      },
    });

  } catch (error) {
    console.error('Error generating static image:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate static image' },
      { status: 500 }
    );
  }
}
