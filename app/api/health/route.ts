const HEALTH_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
};

export async function GET(): Promise<Response> {
  return Response.json(
    { status: 'ok', timestamp: new Date().toISOString() },
    { headers: HEALTH_HEADERS }
  );
}

export async function HEAD(): Promise<Response> {
  return new Response(null, {
    status: 200,
    headers: HEALTH_HEADERS,
  });
}
