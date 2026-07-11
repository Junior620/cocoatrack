/**
 * GET /api/satellite/tiles/direct?url={encodedGEEUrl}&z={z}&x={x}&y={y}
 *
 * Proxy for GEE tile URLs that already contain the token (urlFormat from newer SDK).
 * The urlFormat template has {z}/{x}/{y} placeholders that Leaflet replaces,
 * but since the URL contains auth tokens we proxy it to avoid CORS.
 *
 * However, Leaflet replaces {z}/{x}/{y} in the URL before fetching, so we
 * receive the already-substituted URL and just need to proxy it.
 */

import { NextRequest, NextResponse } from 'next/server';

const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

export async function GET(request: NextRequest) {
  const urlParam = request.nextUrl.searchParams.get('url');

  if (!urlParam) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  const geeUrl = decodeURIComponent(urlParam);

  // Validate it's a GEE URL
  if (!geeUrl.startsWith('https://earthengine.googleapis.com/')) {
    return NextResponse.json({ error: 'Invalid GEE URL' }, { status: 400 });
  }

  try {
    const response = await fetch(geeUrl);

    if (!response.ok) {
      return new NextResponse(TRANSPARENT_PNG, {
        status: 200,
        headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' },
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
    console.error('[Tile Proxy Direct] Failed:', error);
    return new NextResponse(TRANSPARENT_PNG, {
      status: 200,
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-cache' },
    });
  }
}
