/**
 * GET /api/satellite/tiles/[mapId]/[z]/[x]/[y]
 *
 * Proxy route for Google Earth Engine map tiles.
 * Next.js 16: params is a Promise and must be awaited.
 *
 * The mapId is encoded as base64url to safely pass the full GEE map path
 * (e.g. "projects/earthengine-legacy/maps/abc123") as a single URL segment,
 * avoiding issues with Next.js dynamic routing and slash normalization.
 *
 * If no token is provided in the query string, generates one via
 * the service account OAuth flow (for newer GEE SDK versions).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/satellite/utils/gee-auth';

const GEE_TILES_BASE = 'https://earthengine.googleapis.com/v1';

// Cache the OAuth token in module scope, reused across tile requests
let cachedOAuthToken: string | null = null;
let tokenCachedAt = 0;
const TOKEN_CACHE_MS = 50 * 60 * 1000; // 50 minutes (tokens last 60 min)

// 1x1 transparent PNG fallback for missing/failed tiles
const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

/**
 * Fetch a GEE tile and proxy it back to the client.
 */
async function fetchAndProxyTile(
  tileUrl: string,
  bearerToken: string,
  z: string,
  x: string,
  y: string
): Promise<NextResponse> {
  try {
    const response = await fetch(tileUrl, {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return new NextResponse(TRANSPARENT_PNG, {
          status: 200,
          headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' },
        });
      }
      console.error(`[Tile Proxy] GEE returned ${response.status} for tile ${z}/${x}/${y}`);
      return new NextResponse(TRANSPARENT_PNG, {
        status: 200,
        headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-cache' },
      });
    }

    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') ?? 'image/png';

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error(`[Tile Proxy] Failed to fetch tile ${z}/${x}/${y}:`, error);
    return new NextResponse(TRANSPARENT_PNG, {
      status: 200,
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-cache' },
    });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mapId: string; z: string; x: string; y: string }> }
) {
  // Next.js 16: await params before accessing properties
  const { mapId: encodedMapId, z, x, y } = await params;
  const tokenParam = request.nextUrl.searchParams.get('token');

  if (!encodedMapId || !z || !x || !y) {
    return NextResponse.json({ error: 'Missing tile parameters' }, { status: 400 });
  }

  // Decode the mapId, encoded as base64url to avoid slash issues in Next.js routing
  // e.g. base64url("projects/earthengine-legacy/maps/abc123") → single URL segment
  let decodedMapId: string;
  try {
    const decoded = Buffer.from(encodedMapId, 'base64url').toString('utf8');
    // Validate it looks like a GEE map path
    if (decoded.includes('projects/') || decoded.includes('maps/')) {
      decodedMapId = decoded;
    } else {
      // Fallback: legacy percent-encoded mapId
      decodedMapId = decodeURIComponent(encodedMapId);
    }
  } catch {
    // Fallback: legacy percent-encoded mapId
    decodedMapId = decodeURIComponent(encodedMapId);
  }

  console.log(`[Tile Proxy] Serving tile ${z}/${x}/${y} for mapId: ${decodedMapId.substring(0, 80)}`);

  // Resolve bearer token: use provided token or generate via service account OAuth
  let bearerToken: string;
  if (tokenParam && tokenParam.length > 0) {
    bearerToken = decodeURIComponent(tokenParam);
  } else {
    // Token not provided, use cached OAuth token or generate a new one
    const now = Date.now();
    if (!cachedOAuthToken || now - tokenCachedAt > TOKEN_CACHE_MS) {
      try {
        cachedOAuthToken = await getAccessToken();
        tokenCachedAt = now;
      } catch (err) {
        console.error('[Tile Proxy] Failed to get access token:', err);
        return new NextResponse(TRANSPARENT_PNG, {
          status: 200,
          headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-cache' },
        });
      }
    }
    bearerToken = cachedOAuthToken!;
  }

  // Build GEE tile URL
  // decodedMapId is the full path: "projects/earthengine-legacy/maps/abc123-def456"
  const tileUrl = `${GEE_TILES_BASE}/${decodedMapId}/tiles/${z}/${x}/${y}`;

  return fetchAndProxyTile(tileUrl, bearerToken, z, x, y);
}
