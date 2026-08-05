/**
 * GET /api/satellite/early-alerts
 *
 * Coop-level visit-priority queue + complementary alerts
 * (EVI / NDMI / NDWI / SAVI / NDRE / combined).
 *
 * Query:
 * - type: ndmi | evi | ndwi | savi | ndre | combined | visits | any
 * - level: watch | alert | any
 * - limit: 1–300 (default 150)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { detectEVIEarlyAlert } from '@/lib/satellite/evi-alerts';
import { detectNDMIEarlyAlert } from '@/lib/satellite/ndmi-alerts';
import { detectNDWIEarlyAlert } from '@/lib/satellite/ndwi-alerts';
import { detectSAVIEarlyAlert } from '@/lib/satellite/savi-alerts';
import { detectNDREEarlyAlert } from '@/lib/satellite/ndre-alerts';
import { combineVegetationAlerts } from '@/lib/satellite/combined-alerts';
import {
  computeVisitPriority,
  visitPrioritySortKey,
} from '@/lib/satellite/visit-priority';
import { getCocoaSeasonContext } from '@/lib/satellite/seasonality';
import { calibrateNdmiThresholdsFromFeedback } from '@/lib/satellite/ndmi-calibration';
import { applyRegionalNdmiThresholds } from '@/lib/satellite/regional-thresholds';
import { NDMI_THRESHOLDS_CACAO } from '@/lib/satellite/ndmi-alerts';

const QuerySchema = z.object({
  type: z
    .enum(['ndmi', 'evi', 'ndwi', 'savi', 'ndre', 'combined', 'visits', 'any'])
    .default('any'),
  level: z.enum(['watch', 'alert', 'any']).default('any'),
  limit: z.coerce.number().int().min(1).max(300).default(150),
});

type SeriesPoint = {
  parcelle_id: string;
  calculation_date: string;
  mean_ndvi: number;
  mean_evi: number | null;
  mean_ndmi: number | null;
  mean_ndwi: number | null;
  mean_savi: number | null;
  mean_ndre: number | null;
  imagery_quality: 'good' | 'acceptable' | 'degraded' | null;
};

function errorResponse(message: string, status: number, code?: string) {
  return NextResponse.json(
    { success: false, error: message, code: code || 'UNKNOWN_ERROR' },
    { status }
  );
}

function levelMatches(
  level: 'none' | 'watch' | 'alert',
  filter: 'watch' | 'alert' | 'any'
): boolean {
  if (level === 'none') return false;
  if (filter === 'any') return true;
  if (filter === 'alert') return level === 'alert';
  return level === 'watch' || level === 'alert';
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = QuerySchema.safeParse({
      type: searchParams.get('type') ?? 'any',
      level: searchParams.get('level') ?? 'any',
      limit: searchParams.get('limit') ?? '150',
    });

    if (!parsed.success) {
      return errorResponse(
        parsed.error.errors.map((e) => e.message).join(', '),
        400,
        'VALIDATION_ERROR'
      );
    }

    const { type, level, limit } = parsed.data;
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Authentication required', 401, 'UNAUTHORIZED');
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, cooperative_id')
      .eq('id', user.id)
      .maybeSingle();

    const role = (profile as { role?: string } | null)?.role;
    const cooperativeId = (profile as { cooperative_id?: string | null } | null)
      ?.cooperative_id;

    if (!role) {
      return errorResponse('Profile not found', 403, 'FORBIDDEN');
    }

    let list: Array<{
      id: string;
      code: string | null;
      label: string | null;
      village: string | null;
      planteur_id: string | null;
      annee_plantation: number | null;
      densite_arbres_ha: number | null;
      region: string | null;
      elevation_meters: number | null;
    }> = [];

    const selectCols =
      'id, code, label, village, planteur_id, annee_plantation, densite_arbres_ha, elevation_meters';

    if (role === 'admin') {
      const { data: parcelles, error: parcelleError } = await (supabase as any)
        .from('parcelles')
        .select(selectCols)
        .eq('is_active', true)
        .limit(limit);

      if (parcelleError) {
        console.error('[early-alerts] parcelles', parcelleError);
        return errorResponse('Failed to load parcelles', 500, 'DB_ERROR');
      }
      list = ((parcelles || []) as Array<Record<string, unknown>>).map((p) => ({
        id: String(p.id),
        code: (p.code as string | null) ?? null,
        label: (p.label as string | null) ?? null,
        village: (p.village as string | null) ?? null,
        planteur_id: (p.planteur_id as string | null) ?? null,
        annee_plantation: (p.annee_plantation as number | null) ?? null,
        densite_arbres_ha:
          p.densite_arbres_ha != null ? Number(p.densite_arbres_ha) : null,
        region: null,
        elevation_meters:
          p.elevation_meters != null ? Number(p.elevation_meters) : null,
      }));
    } else {
      if (!cooperativeId) {
        return errorResponse('No cooperative assigned', 403, 'FORBIDDEN');
      }

      const { data: planteurs, error: planteurError } = await supabase
        .from('planteurs')
        .select('id')
        .eq('cooperative_id', cooperativeId);

      if (planteurError) {
        console.error('[early-alerts] planteurs', planteurError);
        return errorResponse('Failed to load planteurs', 500, 'DB_ERROR');
      }

      const planteurIds = ((planteurs || []) as Array<{ id: string }>).map(
        (p) => p.id
      );
      if (planteurIds.length === 0) {
        return NextResponse.json({
          success: true,
          data: {
            season: getCocoaSeasonContext(),
            alerts: [],
            scanned: 0,
            counts: {
              alert: 0,
              watch: 0,
              combined: 0,
              hydric: 0,
              canopy: 0,
              surfaceWet: 0,
              savi: 0,
              ndre: 0,
              visitsHigh: 0,
            },
          },
        });
      }

      const { data: parcelles, error: parcelleError } = await (supabase as any)
        .from('parcelles')
        .select(selectCols)
        .eq('is_active', true)
        .in('planteur_id', planteurIds)
        .limit(limit);

      if (parcelleError) {
        console.error('[early-alerts] parcelles', parcelleError);
        return errorResponse('Failed to load parcelles', 500, 'DB_ERROR');
      }
      list = ((parcelles || []) as Array<Record<string, unknown>>).map((p) => ({
        id: String(p.id),
        code: (p.code as string | null) ?? null,
        label: (p.label as string | null) ?? null,
        village: (p.village as string | null) ?? null,
        planteur_id: (p.planteur_id as string | null) ?? null,
        annee_plantation: (p.annee_plantation as number | null) ?? null,
        densite_arbres_ha:
          p.densite_arbres_ha != null ? Number(p.densite_arbres_ha) : null,
        region: null,
        elevation_meters:
          p.elevation_meters != null ? Number(p.elevation_meters) : null,
      }));
    }

    if (list.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          season: getCocoaSeasonContext(),
          alerts: [],
          scanned: 0,
          counts: {
            alert: 0,
            watch: 0,
            combined: 0,
            hydric: 0,
            canopy: 0,
            surfaceWet: 0,
            savi: 0,
            ndre: 0,
            visitsHigh: 0,
          },
        },
      });
    }

    const ids = list.map((p) => p.id);
    const since = new Date();
    since.setUTCMonth(since.getUTCMonth() - 5);

    // Coop NDMI feedback → calibrate thresholds
    let feedbackAgg = { confirmed: 0, falsePositive: 0, unsure: 0 };
    try {
      const { data: fbRows } = await (supabase as any)
        .from('satellite_alert_feedback')
        .select('verdict')
        .eq('alert_kind', 'ndmi')
        .gte(
          'created_at',
          new Date(Date.now() - 180 * 24 * 3600 * 1000).toISOString()
        )
        .limit(500);
      for (const row of (fbRows || []) as Array<{ verdict: string }>) {
        if (row.verdict === 'true_positive') feedbackAgg.confirmed += 1;
        else if (row.verdict === 'false_positive') feedbackAgg.falsePositive += 1;
        else feedbackAgg.unsure += 1;
      }
    } catch {
      /* table may be missing */
    }

    const calibratedBase = calibrateNdmiThresholdsFromFeedback(
      NDMI_THRESHOLDS_CACAO,
      feedbackAgg
    );

    const { data: rows, error: ndviError } = await supabase
      .from('ndvi_results')
      .select(
        'parcelle_id, calculation_date, mean_ndvi, mean_evi, mean_ndmi, mean_ndwi, mean_savi, mean_ndre, imagery_quality'
      )
      .in('parcelle_id', ids)
      .gte('calculation_date', since.toISOString())
      .order('calculation_date', { ascending: true });

    if (ndviError) {
      console.error('[early-alerts] ndvi_results', ndviError);
      return errorResponse('Failed to load NDVI series', 500, 'DB_ERROR');
    }

    const byParcelle = new Map<string, SeriesPoint[]>();
    for (const row of (rows || []) as SeriesPoint[]) {
      const arr = byParcelle.get(row.parcelle_id) || [];
      arr.push(row);
      byParcelle.set(row.parcelle_id, arr);
    }

    const parcelleMeta = new Map(list.map((p) => [p.id, p]));
    const alerts: Array<{
      parcelleId: string;
      code: string | null;
      label: string | null;
      village: string | null;
      anneePlantation: number | null;
      densiteArbresHa: number | null;
      eviLevel: string;
      ndmiLevel: string;
      ndwiLevel: string;
      saviLevel: string;
      ndreLevel: string;
      combinedCode: string;
      combinedLevel: string;
      visitPriority: string;
      visitScore: number;
      visitReasons: string[];
      messageFr: string;
      meanNDVI: number | null;
      meanEVI: number | null;
      meanNDMI: number | null;
      meanNDWI: number | null;
      meanSAVI: number | null;
      meanNDRE: number | null;
      imageryQuality: string | null;
    }> = [];

    const counts = {
      alert: 0,
      watch: 0,
      combined: 0,
      hydric: 0,
      canopy: 0,
      surfaceWet: 0,
      savi: 0,
      ndre: 0,
      visitsHigh: 0,
    };

    for (const [parcelleId, seriesRows] of byParcelle) {
      const meta = parcelleMeta.get(parcelleId);
      const series = seriesRows.map((r) => ({
        date: r.calculation_date,
        ndvi: Number(r.mean_ndvi),
        evi: r.mean_evi != null ? Number(r.mean_evi) : null,
        ndmi: r.mean_ndmi != null ? Number(r.mean_ndmi) : null,
        ndwi: r.mean_ndwi != null ? Number(r.mean_ndwi) : null,
        savi: r.mean_savi != null ? Number(r.mean_savi) : null,
        ndre: r.mean_ndre != null ? Number(r.mean_ndre) : null,
      }));

      const latest = seriesRows[seriesRows.length - 1];
      const latestNdvi = latest ? Number(latest.mean_ndvi) : null;
      const latestEvi =
        latest?.mean_evi != null ? Number(latest.mean_evi) : null;

      const regional = applyRegionalNdmiThresholds(calibratedBase, {
        region: meta?.region,
        elevationMeters:
          meta?.elevation_meters != null
            ? Number(meta.elevation_meters)
            : null,
      });

      const eviAlert = detectEVIEarlyAlert(series);
      const ndmiAlert = detectNDMIEarlyAlert(series, {
        thresholds: regional,
      });
      const ndwiAlert = detectNDWIEarlyAlert(series);
      const saviAlert = detectSAVIEarlyAlert(
        series.map((p) => ({ date: p.date, savi: p.savi })),
        {
          meanNdvi: latestNdvi,
          meanEvi: latestEvi,
          anneePlantation: meta?.annee_plantation ?? null,
          densiteArbresHa:
            meta?.densite_arbres_ha != null
              ? Number(meta.densite_arbres_ha)
              : null,
        }
      );
      const ndreAlert = detectNDREEarlyAlert(
        series.map((p) => ({
          date: p.date,
          ndvi: p.ndvi,
          ndre: p.ndre,
        }))
      );
      const combined = combineVegetationAlerts(eviAlert, ndmiAlert);
      const visit = computeVisitPriority({
        combined,
        ndwiAlert,
        saviAlert,
        ndreAlert,
        imageryQuality: latest?.imagery_quality ?? null,
      });

      let include = false;
      if (type === 'any' || type === 'visits') {
        include =
          visit.rank !== 'none' &&
          (level === 'any' ||
            (level === 'alert' && visit.rank === 'high') ||
            (level === 'watch' &&
              (visit.rank === 'medium' || visit.rank === 'high' || visit.rank === 'low')));
        if (type === 'any') {
          include =
            include ||
            levelMatches(combined.level, level) ||
            levelMatches(ndwiAlert.level, level) ||
            levelMatches(saviAlert.level, level) ||
            levelMatches(ndreAlert.level, level);
        }
      } else if (type === 'ndmi') {
        include = levelMatches(ndmiAlert.level, level);
      } else if (type === 'evi') {
        include = levelMatches(eviAlert.level, level);
      } else if (type === 'ndwi') {
        include = levelMatches(ndwiAlert.level, level);
      } else if (type === 'savi') {
        include = levelMatches(saviAlert.level, level);
      } else if (type === 'ndre') {
        include = levelMatches(ndreAlert.level, level);
      } else if (type === 'combined') {
        include =
          combined.code === 'canopy_and_hydric' &&
          levelMatches(combined.level, level);
      }

      if (!include) continue;

      const effectiveLevel =
        visit.rank === 'high'
          ? 'alert'
          : visit.rank === 'medium' || visit.rank === 'low'
            ? 'watch'
            : combined.level !== 'none'
              ? combined.level
              : ndwiAlert.level !== 'none'
                ? ndwiAlert.level
                : saviAlert.level !== 'none'
                  ? saviAlert.level
                  : ndreAlert.level;

      if (effectiveLevel === 'alert') counts.alert += 1;
      else if (effectiveLevel === 'watch') counts.watch += 1;
      if (combined.code === 'canopy_and_hydric') counts.combined += 1;
      if (ndmiAlert.level !== 'none') counts.hydric += 1;
      if (eviAlert.level !== 'none') counts.canopy += 1;
      if (ndwiAlert.level !== 'none') counts.surfaceWet += 1;
      if (saviAlert.level !== 'none') counts.savi += 1;
      if (ndreAlert.level !== 'none') counts.ndre += 1;
      if (visit.rank === 'high') counts.visitsHigh += 1;

      alerts.push({
        parcelleId,
        code: meta?.code ?? null,
        label: meta?.label ?? null,
        village: meta?.village ?? null,
        anneePlantation: meta?.annee_plantation ?? null,
        densiteArbresHa:
          meta?.densite_arbres_ha != null
            ? Number(meta.densite_arbres_ha)
            : null,
        eviLevel: eviAlert.level,
        ndmiLevel: ndmiAlert.level,
        ndwiLevel: ndwiAlert.level,
        saviLevel: saviAlert.level,
        ndreLevel: ndreAlert.level,
        combinedCode:
          combined.level !== 'none' ? combined.code : visit.reasons[0] || 'none',
        combinedLevel: effectiveLevel,
        visitPriority: visit.rank,
        visitScore: visit.score,
        visitReasons: visit.reasons,
        messageFr: visit.messageFr !== 'Pas de visite prioritaire cette semaine.'
          ? visit.messageFr
          : combined.level !== 'none'
            ? combined.messageFr
            : ndwiAlert.level !== 'none'
              ? ndwiAlert.messageFr
              : saviAlert.level !== 'none'
                ? saviAlert.messageFr
                : ndreAlert.messageFr,
        meanNDVI: latestNdvi,
        meanEVI: latestEvi,
        meanNDMI: latest?.mean_ndmi != null ? Number(latest.mean_ndmi) : null,
        meanNDWI: latest?.mean_ndwi != null ? Number(latest.mean_ndwi) : null,
        meanSAVI: latest?.mean_savi != null ? Number(latest.mean_savi) : null,
        meanNDRE: latest?.mean_ndre != null ? Number(latest.mean_ndre) : null,
        imageryQuality: latest?.imagery_quality ?? null,
      });
    }

    alerts.sort(
      (a, b) =>
        visitPrioritySortKey(b.visitPriority, b.visitScore) -
        visitPrioritySortKey(a.visitPriority, a.visitScore)
    );

    return NextResponse.json({
      success: true,
      data: {
        season: getCocoaSeasonContext(),
        alerts,
        scanned: list.length,
        counts,
        calibration: {
          ndmiFeedback: feedbackAgg,
          sampleSize:
            feedbackAgg.confirmed +
            feedbackAgg.falsePositive +
            feedbackAgg.unsure,
        },
      },
    });
  } catch (error) {
    console.error('[early-alerts]', error);
    return errorResponse('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
