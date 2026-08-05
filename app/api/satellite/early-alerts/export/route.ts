/**
 * GET /api/satellite/early-alerts/export
 *
 * Coop CSV export of visit-priority alerts + latest indices (réunions).
 * Query mirrors early-alerts: type, level, limit
 */

import { NextRequest, NextResponse } from 'next/server';

function csvEscape(value: string | number | null | undefined): string {
  if (value == null) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const origin = url.origin;
    const qs = url.searchParams.toString();
    const cookie = request.headers.get('cookie') || '';

    const res = await fetch(
      `${origin}/api/satellite/early-alerts?${qs || 'type=visits&level=any&limit=300'}`,
      {
        headers: {
          cookie,
          accept: 'application/json',
        },
        cache: 'no-store',
      }
    );

    const json = await res.json();
    if (!res.ok || !json.success) {
      return NextResponse.json(
        {
          success: false,
          error: json.error || 'Export failed',
          code: json.code || 'EXPORT_ERROR',
        },
        { status: res.status || 500 }
      );
    }

    const alerts = (json.data?.alerts || []) as Array<Record<string, unknown>>;
    const headers = [
      'parcelle_id',
      'code',
      'label',
      'village',
      'annee_plantation',
      'densite_arbres_ha',
      'visit_priority',
      'visit_score',
      'visit_reasons',
      'message',
      'evi_level',
      'ndmi_level',
      'ndwi_level',
      'savi_level',
      'ndre_level',
      'mean_ndvi',
      'mean_evi',
      'mean_ndmi',
      'mean_ndwi',
      'mean_savi',
      'mean_ndre',
      'imagery_quality',
    ];

    const lines = [headers.join(',')];
    for (const a of alerts) {
      lines.push(
        [
          csvEscape(a.parcelleId as string),
          csvEscape(a.code as string | null),
          csvEscape(a.label as string | null),
          csvEscape(a.village as string | null),
          csvEscape(a.anneePlantation as number | null),
          csvEscape(a.densiteArbresHa as number | null),
          csvEscape(a.visitPriority as string),
          csvEscape(a.visitScore as number),
          csvEscape(
            Array.isArray(a.visitReasons)
              ? (a.visitReasons as string[]).join(' | ')
              : ''
          ),
          csvEscape(a.messageFr as string),
          csvEscape(a.eviLevel as string),
          csvEscape(a.ndmiLevel as string),
          csvEscape(a.ndwiLevel as string),
          csvEscape(a.saviLevel as string),
          csvEscape(a.ndreLevel as string),
          csvEscape(a.meanNDVI as number | null),
          csvEscape(a.meanEVI as number | null),
          csvEscape(a.meanNDMI as number | null),
          csvEscape(a.meanNDWI as number | null),
          csvEscape(a.meanSAVI as number | null),
          csvEscape(a.meanNDRE as number | null),
          csvEscape(a.imageryQuality as string | null),
        ].join(',')
      );
    }

    const month = new Date().toISOString().slice(0, 7);
    const body = lines.join('\n') + '\n';

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="alertes-visite-${month}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[early-alerts/export]', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
