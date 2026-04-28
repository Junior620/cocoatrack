// CocoaTrack V2 - Calculate Elevation API Route
// Calculate elevation and slope for a parcelle using Google Elevation API

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const GOOGLE_ELEVATION_API_URL = 'https://maps.googleapis.com/maps/api/elevation/json';

interface ElevationResult {
  elevation: number;
  location: {
    lat: number;
    lng: number;
  };
  resolution: number;
}

interface ElevationResponse {
  results: ElevationResult[];
  status: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { id: parcelleId } = await params;

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get Google Maps API key
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Google Maps API key not configured' },
        { status: 500 }
      );
    }

    // Fetch parcelle
    const { data, error: fetchError } = await supabase
      .from('parcelles')
      .select('id, code, geometry, centroid, surface_hectares')
      .eq('id', parcelleId)
      .single();

    if (fetchError || !data) {
      return NextResponse.json(
        { error: 'Parcelle not found' },
        { status: 404 }
      );
    }

    // Type assertion for parcelle with geometry
    type ParcelleWithGeometry = {
      id: string;
      code: string | null;
      geometry: { type: string; coordinates: number[][][] | number[][][][] };
      centroid: { lat: number; lng: number };
      surface_hectares: number;
    };

    const parcelle = data as ParcelleWithGeometry;

    if (!parcelle.geometry || !parcelle.geometry.coordinates) {
      return NextResponse.json(
        { error: 'Parcelle has no geometry' },
        { status: 400 }
      );
    }

    // Extract sample points from parcelle geometry
    // For Polygon: coordinates[0] is the outer ring
    // For MultiPolygon: coordinates[0][0] is the first polygon's outer ring
    const coords: number[][] = (parcelle.geometry.type === 'Polygon'
      ? parcelle.geometry.coordinates[0]
      : parcelle.geometry.coordinates[0][0]) as number[][];

    // Sample points: take every Nth point to stay within API limits
    // Google Elevation API allows up to 512 locations per request
    const maxPoints = 20; // Use 20 points for good coverage without excessive API calls
    const step = Math.max(1, Math.floor(coords.length / maxPoints));
    const samplePoints: number[][] = coords.filter((_: number[], index: number) => index % step === 0);

    // Format locations for Google Elevation API
    // Coordinates are stored as [lng, lat] but API expects lat,lng
    const locations = samplePoints
      .map((coord: number[]) => `${coord[1]},${coord[0]}`)
      .join('|');

    // Call Google Elevation API
    const elevationUrl = `${GOOGLE_ELEVATION_API_URL}?locations=${locations}&key=${apiKey}`;
    const response = await fetch(elevationUrl);
    
    if (!response.ok) {
      throw new Error(`Google Elevation API error: ${response.statusText}`);
    }

    const elevationData: ElevationResponse = await response.json();

    if (elevationData.status !== 'OK' || !elevationData.results || elevationData.results.length === 0) {
      return NextResponse.json(
        { error: `Elevation API error: ${elevationData.status}` },
        { status: 500 }
      );
    }

    // Calculate average elevation
    const elevations = elevationData.results.map(r => r.elevation);
    const avgElevation = elevations.reduce((sum, e) => sum + e, 0) / elevations.length;
    const minElevation = Math.min(...elevations);
    const maxElevation = Math.max(...elevations);

    // Calculate slope (simplified: max elevation difference / distance)
    // For more accurate slope, we'd need to calculate distances between points
    const elevationRange = maxElevation - minElevation;
    
    // Estimate parcelle diameter from area (assuming roughly circular)
    // This is a rough approximation for slope calculation
    const { data: parcelleWithArea } = await supabase
      .from('parcelles')
      .select('surface_hectares')
      .eq('id', parcelleId)
      .single();
    
    const areaM2 = ((parcelleWithArea as { surface_hectares: number } | null)?.surface_hectares || 1) * 10000; // hectares to m²
    const estimatedDiameter = Math.sqrt(areaM2 / Math.PI) * 2; // meters
    
    // Slope = (elevation change / horizontal distance) * 100
    const slopePercent = estimatedDiameter > 0 
      ? (elevationRange / estimatedDiameter) * 100 
      : 0;

    // Update parcelle with elevation data
    // Using type assertion to bypass Supabase type checking for new columns
    const supabaseAny = supabase as any;
    const { error: updateError } = await supabaseAny
      .from('parcelles')
      .update({
        elevation_meters: Math.round(avgElevation * 100) / 100, // Round to 2 decimals
        slope_percent: Math.round(slopePercent * 100) / 100, // Round to 2 decimals
        elevation_calculated_at: new Date().toISOString(),
      })
      .eq('id', parcelleId);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      data: {
        elevation_meters: Math.round(avgElevation * 100) / 100,
        slope_percent: Math.round(slopePercent * 100) / 100,
        min_elevation: Math.round(minElevation * 100) / 100,
        max_elevation: Math.round(maxElevation * 100) / 100,
        points_sampled: elevationData.results.length,
      },
    });

  } catch (error) {
    console.error('Error calculating elevation:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to calculate elevation' },
      { status: 500 }
    );
  }
}
