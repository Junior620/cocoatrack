/**
 * GET /api/planteurs/[id]/traceability
 * Résumé traçabilité agrégé pour Planteur 360 (1 requête côté client).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ndviService } from '@/lib/satellite/services/ndvi.service';
import type { HealthStatus } from '@/lib/satellite/types';
import type {
  PlanteurTraceabilitySummary,
  TraceabilityTimelineEvent,
} from '@/types/planteur-traceability';

const CACHE_HEADERS = {
  'Cache-Control': 'private, max-age=300, stale-while-revalidate=600',
};

function errorResponse(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: planteurId } = await context.params;
    if (!z.string().uuid().safeParse(planteurId).success) {
      return errorResponse('ID planteur invalide', 400);
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Non authentifié', 401);
    }

    const { data: planteur, error: planteurError } = await supabase
      .from('planteurs')
      .select(
        `
        id, name, code, created_at, updated_at,
        created_by_profile:profiles!planteurs_created_by_fkey(full_name)
      `
      )
      .eq('id', planteurId)
      .maybeSingle();

    if (planteurError || !planteur) {
      return errorResponse('Planteur non trouvé', 404);
    }

    const planteurRow = planteur as {
      id: string;
      name: string;
      code: string;
      created_at: string;
      updated_at: string;
      created_by_profile: { full_name: string } | null;
    };

    const [parcellesRes, deliveriesRes, receiptsRes, auditRes] = await Promise.all([
      supabase
        .from('parcelles')
        .select('id, code, label, source, conformity_status, surface_hectares, created_at, created_by, import_file_id')
        .eq('planteur_id', planteurId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('deliveries')
        .select('id, code, delivered_at, weight_kg, total_amount, quality_grade, payment_status, notes')
        .eq('planteur_id', planteurId)
        .order('delivered_at', { ascending: false })
        .limit(50),
      supabase
        .from('collection_receipts')
        .select(
          'id, receipt_number, contract_number, transaction_date, amount_paid, campaign, created_at, receipt_deliveries(delivery:deliveries(id, weight_kg, total_amount))'
        )
        .eq('planteur_id', planteurId)
        .order('transaction_date', { ascending: false })
        .limit(30),
      supabase.rpc('get_audit_logs_with_actor' as never, {
        p_table_name: 'planteurs',
        p_row_id: planteurId,
        p_actor_id: null,
        p_action: null,
        p_start_date: null,
        p_end_date: null,
        p_limit: 15,
        p_offset: 0,
      } as never),
    ]);

    const parcelles = (parcellesRes.data || []) as Array<{
      id: string;
      code: string;
      label: string | null;
      source: string;
      conformity_status: string;
      surface_hectares: number;
      created_at: string;
      created_by: string | null;
      import_file_id: string | null;
    }>;

    const deliveries = (deliveriesRes.data || []) as Array<{
      id: string;
      code: string;
      delivered_at: string;
      weight_kg: number;
      total_amount: number;
      quality_grade: string | null;
      payment_status: string | null;
      notes: string | null;
    }>;

    const receipts = (receiptsRes.data || []) as Array<{
      id: string;
      receipt_number: string;
      contract_number: string;
      transaction_date: string;
      amount_paid: number | null;
      campaign: string;
      created_at: string;
      receipt_deliveries: Array<{ delivery: { id: string; weight_kg: number; total_amount: number } | null }>;
    }>;

    const auditLogs = ((auditRes as { data: Array<{ id: string; action: string; created_at: string; actor_name: string; table_name: string }> | null }).data || []);

    const parcelIds = parcelles.map((p) => p.id);

    let ndviSummary: PlanteurTraceabilitySummary['ndviSummary'] = [];
    let deforestationSummary: PlanteurTraceabilitySummary['deforestationSummary'] = [];

    if (parcelIds.length > 0) {
      const { data: ndviRows } = await supabase
        .from('ndvi_results')
        .select('parcelle_id, mean_ndvi, health_status, calculation_date')
        .in('parcelle_id', parcelIds)
        .order('calculation_date', { ascending: false })
        .limit(parcelIds.length * 2);

      const latestNdvi = new Map<string, { parcelle_id: string; mean_ndvi: number; health_status: string; calculation_date: string }>();
      for (const row of ndviRows || []) {
        const r = row as { parcelle_id: string; mean_ndvi: number; health_status: string; calculation_date: string };
        if (!latestNdvi.has(r.parcelle_id)) latestNdvi.set(r.parcelle_id, r);
      }

      ndviSummary = parcelles
        .filter((p) => latestNdvi.has(p.id))
        .map((p) => {
          const n = latestNdvi.get(p.id)!;
          return {
            parcelleId: p.id,
            parcelleCode: p.code,
            meanNDVI: Number(n.mean_ndvi),
            healthStatus: n.health_status,
            lastCalculationDate: n.calculation_date,
          };
        });

      const { data: defEvents } = await supabase
        .from('deforestation_events')
        .select('parcelle_id, status, detection_date, affected_area_percent')
        .in('parcelle_id', parcelIds)
        .order('detection_date', { ascending: false })
        .limit(parcelIds.length * 2);

      const latestDef = new Map<string, { status: string; detection_date: string; affected_area_percent: number }>();
      for (const ev of defEvents || []) {
        const e = ev as { parcelle_id: string; status: string; detection_date: string; affected_area_percent: number };
        if (!latestDef.has(e.parcelle_id)) latestDef.set(e.parcelle_id, e);
      }

      deforestationSummary = parcelles
        .filter((p) => latestDef.has(p.id))
        .map((p) => {
          const d = latestDef.get(p.id)!;
          return {
            parcelleId: p.id,
            parcelleCode: p.code,
            status: d.status,
            detectionDate: d.detection_date,
            affectedPercent: Number(d.affected_area_percent),
          };
        });
    }

    const timeline: TraceabilityTimelineEvent[] = [];

    timeline.push({
      id: `planteur-${planteurRow.id}`,
      type: 'planteur_created',
      date: planteurRow.created_at,
      title: 'Planteur enregistré',
      subtitle: planteurRow.name,
      actorName: planteurRow.created_by_profile?.full_name ?? undefined,
      source: 'manuel',
    });

    for (const p of parcelles) {
      timeline.push({
        id: `parcelle-${p.id}`,
        type: 'parcelle',
        date: p.created_at,
        title: `Parcelle ${p.code}`,
        subtitle: p.label || undefined,
        volumeKg: undefined,
        status: p.conformity_status,
        source: p.import_file_id ? `import (${p.source})` : p.source,
        link: `/parcelles/${p.id}`,
        meta: { surface_ha: p.surface_hectares },
      });
    }

    for (const r of receipts) {
      const linkedWeight = (r.receipt_deliveries || []).reduce(
        (sum, rd) => sum + Number(rd.delivery?.weight_kg || 0),
        0
      );
      timeline.push({
        id: `receipt-${r.id}`,
        type: 'receipt',
        date: r.transaction_date,
        title: `Reçu ${r.receipt_number}`,
        subtitle: r.campaign,
        contractNumber: r.contract_number,
        volumeKg: linkedWeight,
        amountXaf: r.amount_paid ?? undefined,
        link: `/receipts/${r.id}`,
      });
    }

    for (const d of deliveries) {
      timeline.push({
        id: `delivery-${d.id}`,
        type: 'delivery',
        date: d.delivered_at,
        title: `Livraison ${d.code}`,
        volumeKg: Number(d.weight_kg),
        amountXaf: Number(d.total_amount),
        status: d.payment_status ?? undefined,
        link: `/deliveries/${d.id}`,
      });
    }

    for (const n of ndviSummary) {
      timeline.push({
        id: `ndvi-${n.parcelleId}`,
        type: 'ndvi',
        date: n.lastCalculationDate,
        title: `Analyse NDVI · ${n.parcelleCode}`,
        subtitle: ndviService.getRecommendation(n.healthStatus as HealthStatus),
        status: n.healthStatus,
        meta: { meanNDVI: n.meanNDVI },
        link: `/parcelles/${n.parcelleId}`,
      });
    }

    for (const d of deforestationSummary) {
      timeline.push({
        id: `def-${d.parcelleId}-${d.detectionDate}`,
        type: 'deforestation',
        date: d.detectionDate,
        title: `Alerte déforestation · ${d.parcelleCode}`,
        status: d.status,
        meta: { affectedPercent: d.affectedPercent },
        link: `/parcelles/${d.parcelleId}`,
      });
    }

    for (const log of auditLogs) {
      timeline.push({
        id: `audit-${log.id}`,
        type: 'audit',
        date: log.created_at,
        title: `Audit · ${log.action}`,
        actorName: log.actor_name,
        source: log.table_name,
      });
    }

    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const totalWeightKg = deliveries.reduce((s, d) => s + Number(d.weight_kg), 0);
    const totalAmountXaf = deliveries.reduce((s, d) => s + Number(d.total_amount), 0);

    const summary: PlanteurTraceabilitySummary = {
      planteur: {
        id: planteurRow.id,
        name: planteurRow.name,
        code: planteurRow.code,
        created_at: planteurRow.created_at,
        created_by_name: planteurRow.created_by_profile?.full_name ?? null,
        updated_at: planteurRow.updated_at,
      },
      stats: {
        parcelles: parcelles.length,
        deliveries: deliveries.length,
        receipts: receipts.length,
        totalWeightKg,
        totalAmountXaf,
        ndviAnalyzed: ndviSummary.length,
        deforestationAlerts: deforestationSummary.filter((d) => d.status === 'pending').length,
      },
      timeline: timeline.slice(0, 80),
      chain: {
        nodes: [
          { id: 'planteur', label: planteurRow.name, type: 'planteur' },
          { id: 'parcelles', label: 'Parcelles', type: 'parcelle', count: parcelles.length },
          { id: 'deliveries', label: 'Livraisons', type: 'delivery', count: deliveries.length },
          { id: 'receipts', label: 'Reçus / contrats', type: 'receipt', count: receipts.length },
        ],
        edges: [
          { from: 'planteur', to: 'parcelles', label: `${parcelles.length} parcelle(s)` },
          { from: 'parcelles', to: 'deliveries', label: `${deliveries.length} livraison(s)` },
          { from: 'deliveries', to: 'receipts', label: `${receipts.length} reçu(s)` },
        ],
      },
      ndviSummary,
      deforestationSummary,
    };

    return NextResponse.json({ success: true, data: summary }, { headers: CACHE_HEADERS });
  } catch (err) {
    console.error('[traceability planteur]', err);
    return errorResponse(err instanceof Error ? err.message : 'Erreur serveur', 500);
  }
}
