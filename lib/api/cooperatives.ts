// CocoaTrack V2 - Cooperatives API
// Client-side API functions for cooperative operations with aggregated stats

import { createClient } from '@/lib/supabase/client';
import {
  deriveReceiptInvoiceStatus,
  extractLinkedDeliveries,
} from '@/lib/utils/receipt-invoice-status';
import type { CollectionReceiptListItem } from '@/lib/api/receipts';
import { CAMEROON_REGIONS, type CameroonRegion } from '@/types/parcelles';

export interface RegionOption {
  id: string;
  name: string;
}

export interface CooperativeStats {
  id: string;
  name: string;
  code: string | null;
  region_id: string | null;
  region: string | null;
  address: string | null;
  phone: string | null;
  nb_planteurs: number;
  nb_fournisseurs: number;
  total_membres: number;
  total_charge_kg: number;
  total_decharge_kg: number;
  pertes_kg: number;
  pourcentage_pertes: number;
  receipts_to_invoice: number;
}

export interface CooperativeDetail extends CooperativeStats {
  planteurs: Array<{
    id: string;
    name: string;
    code: string;
    phone: string | null;
    region: string | null;
    departement: string | null;
    localite: string | null;
  }>;
  fournisseurs: Array<{
    id: string;
    name: string;
    code: string;
    phone: string | null;
    region: string | null;
    departement: string | null;
    localite: string | null;
  }>;
}

export interface CooperativeGlobalStats {
  total_cooperatives: number;
  total_membres: number;
  total_production_kg: number;
}

export interface CooperativeOperationalSummary {
  receipts: {
    total: number;
    toInvoice: number;
    partiallyInvoiced: number;
    fullyInvoiced: number;
  };
  deliveries: {
    total: number;
    uninvoiced: number;
    totalWeightKg: number;
    totalAmountXAF: number;
  };
  invoices: {
    total: number;
    draft: number;
    recent: Array<{ id: string; code: string; status: string; total_amount: number }>;
  };
  pipeline: {
    invoicedPct: number;
    uninvoicedDeliveries: number;
  };
  recentReceipts: CollectionReceiptListItem[];
}

type CoopRow = {
  id: string;
  name: string;
  code: string | null;
  region_id: string | null;
  address: string | null;
  phone: string | null;
  regions?: { name: string } | null;
};

function countByCoop(rows: Array<{ cooperative_id: string | null }>): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    if (!row.cooperative_id) continue;
    map.set(row.cooperative_id, (map.get(row.cooperative_id) ?? 0) + 1);
  }
  return map;
}

function deliveryStatsByCoop(
  rows: Array<{ cooperative_id: string | null; weight_loaded_kg: number | null; weight_kg: number | null }>
): Map<string, { charge: number; decharge: number }> {
  const map = new Map<string, { charge: number; decharge: number }>();
  for (const row of rows) {
    if (!row.cooperative_id) continue;
    const cur = map.get(row.cooperative_id) ?? { charge: 0, decharge: 0 };
    cur.charge += Number(row.weight_loaded_kg) || 0;
    cur.decharge += Number(row.weight_kg) || 0;
    map.set(row.cooperative_id, cur);
  }
  return map;
}

function receiptsToInvoiceByCoop(
  rows: Array<{
    cooperative_id: string;
    receipt_deliveries: Array<{ delivery: { invoice_status: string | null } | null }>;
  }>
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const deliveries = extractLinkedDeliveries(row.receipt_deliveries);
    const status = deriveReceiptInvoiceStatus(deliveries);
    if (status === 'not_invoiced' || status === 'partially_invoiced') {
      map.set(row.cooperative_id, (map.get(row.cooperative_id) ?? 0) + 1);
    }
  }
  return map;
}

function mapCoopToStats(
  coop: CoopRow,
  nbPlanteurs: number,
  nbFournisseurs: number,
  deliveryStats: { charge: number; decharge: number },
  receiptsToInvoice: number
): CooperativeStats {
  const pertesKg = deliveryStats.charge - deliveryStats.decharge;
  const pourcentagePertes =
    deliveryStats.charge > 0 ? (pertesKg / deliveryStats.charge) * 100 : 0;

  return {
    id: coop.id,
    name: coop.name,
    code: coop.code,
    region_id: coop.region_id,
    region: coop.regions?.name ?? null,
    address: coop.address,
    phone: coop.phone,
    nb_planteurs: nbPlanteurs,
    nb_fournisseurs: nbFournisseurs,
    total_membres: nbPlanteurs + nbFournisseurs,
    total_charge_kg: deliveryStats.charge,
    total_decharge_kg: deliveryStats.decharge,
    pertes_kg: pertesKg,
    pourcentage_pertes: Math.round(pourcentagePertes * 100) / 100,
    receipts_to_invoice: receiptsToInvoice,
  };
}

export const cooperativesApi = {
  async listRegions(): Promise<RegionOption[]> {
    const supabase = createClient();
    const { data, error } = await supabase.from('regions').select('id, name');
    if (error) throw new Error(`Failed to fetch regions: ${error.message}`);

    const allowed = new Set<string>(CAMEROON_REGIONS);
    return ((data || []) as RegionOption[])
      .filter((r) => allowed.has(r.name))
      .sort(
        (a, b) =>
          CAMEROON_REGIONS.indexOf(a.name as CameroonRegion) -
          CAMEROON_REGIONS.indexOf(b.name as CameroonRegion)
      );
  },

  async getGlobalStats(cooperativeId?: string): Promise<CooperativeGlobalStats> {
    const supabase = createClient();

    let coopQuery = supabase.from('cooperatives').select('*', { count: 'exact', head: true });
    if (cooperativeId) coopQuery = coopQuery.eq('id', cooperativeId);

    let planteursQuery = supabase.from('planteurs').select('*', { count: 'exact', head: true });
    if (cooperativeId) planteursQuery = planteursQuery.eq('cooperative_id', cooperativeId);

    let fournisseursQuery = supabase
      .from('chef_planteurs')
      .select('*', { count: 'exact', head: true });
    if (cooperativeId) fournisseursQuery = fournisseursQuery.eq('cooperative_id', cooperativeId);

    let deliveriesQuery = supabase.from('deliveries').select('weight_kg');
    if (cooperativeId) deliveriesQuery = deliveriesQuery.eq('cooperative_id', cooperativeId);

    const [
      { count: totalCooperatives },
      { count: totalPlanteurs },
      { count: totalFournisseurs },
      { data: productionData },
    ] = await Promise.all([coopQuery, planteursQuery, fournisseursQuery, deliveriesQuery]);

    const totalProduction = (productionData || []).reduce(
      (sum, d) => sum + (Number((d as { weight_kg: number }).weight_kg) || 0),
      0
    );

    return {
      total_cooperatives: totalCooperatives || 0,
      total_membres: (totalPlanteurs || 0) + (totalFournisseurs || 0),
      total_production_kg: totalProduction,
    };
  },

  async listWithStats(cooperativeId?: string): Promise<CooperativeStats[]> {
    const supabase = createClient();

    let coopQuery = supabase
      .from('cooperatives')
      .select('id, name, code, region_id, address, phone, regions(name)')
      .order('name');
    if (cooperativeId) coopQuery = coopQuery.eq('id', cooperativeId);

    const { data: cooperatives, error: coopError } = await coopQuery;
    if (coopError) throw new Error(`Failed to fetch cooperatives: ${coopError.message}`);

    const coops = (cooperatives || []) as unknown as CoopRow[];
    if (coops.length === 0) return [];

    const coopIds = coops.map((c) => c.id);

    const [
      { data: planteurRows },
      { data: fournisseurRows },
      { data: deliveryRows },
      { data: receiptRows },
    ] = await Promise.all([
      supabase.from('planteurs').select('cooperative_id').in('cooperative_id', coopIds),
      supabase.from('chef_planteurs').select('cooperative_id').in('cooperative_id', coopIds),
      supabase.from('deliveries').select('cooperative_id, weight_loaded_kg, weight_kg').in('cooperative_id', coopIds),
      supabase
        .from('collection_receipts')
        .select(`
          cooperative_id,
          receipt_deliveries(
            delivery:deliveries!receipt_deliveries_delivery_id_fkey(invoice_status)
          )
        `)
        .in('cooperative_id', coopIds),
    ]);

    const planteurCounts = countByCoop((planteurRows || []) as Array<{ cooperative_id: string | null }>);
    const fournisseurCounts = countByCoop((fournisseurRows || []) as Array<{ cooperative_id: string | null }>);
    const deliveryStatsMap = deliveryStatsByCoop(
      (deliveryRows || []) as Array<{
        cooperative_id: string | null;
        weight_loaded_kg: number | null;
        weight_kg: number | null;
      }>
    );
    const receiptInvoiceMap = receiptsToInvoiceByCoop(
      (receiptRows || []) as Array<{
        cooperative_id: string;
        receipt_deliveries: Array<{ delivery: { invoice_status: string | null } | null }>;
      }>
    );

    return coops.map((coop) =>
      mapCoopToStats(
        coop,
        planteurCounts.get(coop.id) ?? 0,
        fournisseurCounts.get(coop.id) ?? 0,
        deliveryStatsMap.get(coop.id) ?? { charge: 0, decharge: 0 },
        receiptInvoiceMap.get(coop.id) ?? 0
      )
    );
  },

  async getDetail(id: string): Promise<CooperativeDetail | null> {
    const stats = await this.listWithStats(id);
    if (stats.length === 0) return null;

    const supabase = createClient();
    const [{ data: planteurs }, { data: fournisseurs }] = await Promise.all([
      supabase
        .from('planteurs')
        .select('id, name, code, phone, region, departement, localite')
        .eq('cooperative_id', id)
        .order('name'),
      supabase
        .from('chef_planteurs')
        .select('id, name, code, phone, region, departement, localite')
        .eq('cooperative_id', id)
        .order('name'),
    ]);

    const base = stats[0];
    return {
      ...base,
      planteurs: (planteurs || []).map((p: Record<string, unknown>) => ({
        id: p.id as string,
        name: p.name as string,
        code: p.code as string,
        phone: (p.phone as string | null) ?? null,
        region: (p.region as string | null) ?? null,
        departement: (p.departement as string | null) ?? null,
        localite: (p.localite as string | null) ?? null,
      })),
      fournisseurs: (fournisseurs || []).map((f: Record<string, unknown>) => ({
        id: f.id as string,
        name: f.name as string,
        code: f.code as string,
        phone: (f.phone as string | null) ?? null,
        region: (f.region as string | null) ?? null,
        departement: (f.departement as string | null) ?? null,
        localite: (f.localite as string | null) ?? null,
      })),
    };
  },

  async getOperationalSummary(cooperativeId: string): Promise<CooperativeOperationalSummary> {
    const supabase = createClient();

    const [
      { data: receiptRows },
      { data: deliveryRows },
      { count: invoiceTotal },
      { count: invoiceDraft },
      { data: recentInvoices },
      { data: recentReceiptsRaw },
    ] = await Promise.all([
      supabase
        .from('collection_receipts')
        .select(`
          id,
          receipt_deliveries(
            delivery:deliveries!receipt_deliveries_delivery_id_fkey(invoice_status)
          )
        `)
        .eq('cooperative_id', cooperativeId),
      supabase
        .from('deliveries')
        .select('invoice_status, weight_kg, total_amount')
        .eq('cooperative_id', cooperativeId),
      supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('cooperative_id', cooperativeId),
      supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('cooperative_id', cooperativeId)
        .eq('status', 'draft'),
      supabase
        .from('invoices')
        .select('id, code, status, total_amount')
        .eq('cooperative_id', cooperativeId)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('collection_receipts')
        .select(
          `
          id, receipt_number, contract_number, campaign, transaction_date,
          cooperative_id, planteur_id, chef_planteur_id, payment_mode,
          amount_paid, balance, extraction_method, created_at, pdf_url,
          cooperative:cooperatives!collection_receipts_cooperative_id_fkey(id, name, code),
          planteur:planteurs!collection_receipts_planteur_id_fkey(id, name, code),
          chef_planteur:chef_planteurs!collection_receipts_chef_planteur_id_fkey(id, name, code),
          receipt_deliveries(
            delivery:deliveries!receipt_deliveries_delivery_id_fkey(
              id, code, weight_kg, total_amount, invoice_status, invoice_id,
              invoice:invoices!deliveries_invoice_id_fkey(id, code)
            )
          )
        `
        )
        .eq('cooperative_id', cooperativeId)
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    let notInvoiced = 0;
    let partiallyInvoiced = 0;
    let fullyInvoiced = 0;

    for (const row of receiptRows || []) {
      const deliveries = extractLinkedDeliveries(
        (row as { receipt_deliveries: Array<{ delivery: { invoice_status: string | null } | null }> })
          .receipt_deliveries
      );
      const status = deriveReceiptInvoiceStatus(deliveries);
      if (status === 'not_invoiced') notInvoiced += 1;
      else if (status === 'partially_invoiced') partiallyInvoiced += 1;
      else if (status === 'invoiced') fullyInvoiced += 1;
    }

    const deliveries = deliveryRows || [];
    const uninvoicedDeliveries = deliveries.filter(
      (d: { invoice_status: string | null }) => d.invoice_status !== 'invoiced'
    ).length;
    const totalWeightKg = deliveries.reduce(
      (s: number, d: { weight_kg: number }) => s + Number(d.weight_kg),
      0
    );
    const totalAmountXAF = deliveries.reduce(
      (s: number, d: { total_amount: number }) => s + Number(d.total_amount),
      0
    );

    const totalReceipts = (receiptRows || []).length;
    const invoicedPct =
      totalReceipts > 0 ? Math.round((fullyInvoiced / totalReceipts) * 1000) / 10 : 0;

    return {
      receipts: {
        total: totalReceipts,
        toInvoice: notInvoiced + partiallyInvoiced,
        partiallyInvoiced,
        fullyInvoiced,
      },
      deliveries: {
        total: deliveries.length,
        uninvoiced: uninvoicedDeliveries,
        totalWeightKg,
        totalAmountXAF,
      },
      invoices: {
        total: invoiceTotal || 0,
        draft: invoiceDraft || 0,
        recent: (recentInvoices || []) as Array<{
          id: string;
          code: string;
          status: string;
          total_amount: number;
        }>,
      },
      pipeline: { invoicedPct, uninvoicedDeliveries },
      recentReceipts: (recentReceiptsRaw || []) as unknown as CollectionReceiptListItem[],
    };
  },

  async getNames(): Promise<string[]> {
    const supabase = createClient();
    const { data, error } = await supabase.from('cooperatives').select('name').order('name');
    if (error) throw new Error(`Failed to fetch cooperative names: ${error.message}`);
    return (data || []).map((c: { name: string }) => c.name);
  },

  async search(
    query: string,
    limit: number = 10
  ): Promise<Array<{ id: string; name: string; code: string | null }>> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('cooperatives')
      .select('id, name, code')
      .ilike('name', `%${query}%`)
      .limit(limit);
    if (error) throw new Error(`Failed to search cooperatives: ${error.message}`);
    return (data || []) as Array<{ id: string; name: string; code: string | null }>;
  },

  async create(data: {
    name: string;
    code?: string;
    region_id?: string;
    address?: string;
    phone?: string;
  }): Promise<{ id: string; name: string; code: string | null }> {
    const supabase = createClient();
    const code = data.code || `COOP${Date.now().toString().slice(-6)}`;

    let regionId = data.region_id;
    if (!regionId) {
      const { data: centreRegion } = await supabase
        .from('regions')
        .select('id')
        .eq('name', 'Centre')
        .maybeSingle();
      if (centreRegion) {
        regionId = (centreRegion as { id: string }).id;
      } else {
        const { data: fallbackRegion } = await supabase.from('regions').select('id').limit(1).maybeSingle();
        if (!fallbackRegion) {
          throw new Error(
            "Aucune région camerounaise disponible. Exécutez la migration des régions du Cameroun."
          );
        }
        regionId = (fallbackRegion as { id: string }).id;
      }
    }

    const { data: newCoop, error } = await supabase
      .from('cooperatives')
      .insert({
        name: data.name,
        code,
        region_id: regionId,
        address: data.address || null,
        phone: data.phone || null,
      } as never)
      .select('id, name, code')
      .single();

    if (error) throw new Error(`Failed to create cooperative: ${error.message}`);
    return newCoop as { id: string; name: string; code: string | null };
  },

  async update(
    id: string,
    data: { name?: string; code?: string; region_id?: string; address?: string; phone?: string }
  ): Promise<void> {
    const supabase = createClient();
    const updateData: Record<string, string | null> = {};
    if (data.name) updateData.name = data.name;
    if (data.code !== undefined) updateData.code = data.code || null;
    if (data.region_id !== undefined) updateData.region_id = data.region_id || null;
    if (data.address !== undefined) updateData.address = data.address || null;
    if (data.phone !== undefined) updateData.phone = data.phone || null;

    const { error } = await supabase.from('cooperatives').update(updateData as never).eq('id', id);
    if (error) throw new Error(`Échec de la mise à jour : ${error.message}`);
  },

  async delete(id: string): Promise<void> {
    const supabase = createClient();

    const [
      { data: profiles },
      { count: planteursCount },
      { count: fournisseursCount },
      { count: deliveriesCount },
      { count: receiptsCount },
      { count: invoicesCount },
      { count: warehousesCount },
    ] = await Promise.all([
      supabase.from('profiles').select('id, full_name').eq('cooperative_id', id),
      supabase.from('planteurs').select('*', { count: 'exact', head: true }).eq('cooperative_id', id),
      supabase.from('chef_planteurs').select('*', { count: 'exact', head: true }).eq('cooperative_id', id),
      supabase.from('deliveries').select('*', { count: 'exact', head: true }).eq('cooperative_id', id),
      supabase.from('collection_receipts').select('*', { count: 'exact', head: true }).eq('cooperative_id', id),
      supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('cooperative_id', id),
      supabase.from('warehouses').select('*', { count: 'exact', head: true }).eq('cooperative_id', id),
    ]);

    const blockingDeps: string[] = [];
    if (planteursCount && planteursCount > 0) blockingDeps.push(`${planteursCount} planteur(s)`);
    if (fournisseursCount && fournisseursCount > 0)
      blockingDeps.push(`${fournisseursCount} fournisseur(s)`);
    if (deliveriesCount && deliveriesCount > 0) blockingDeps.push(`${deliveriesCount} livraison(s)`);
    if (receiptsCount && receiptsCount > 0) blockingDeps.push(`${receiptsCount} reçu(s)`);
    if (invoicesCount && invoicesCount > 0) blockingDeps.push(`${invoicesCount} facture(s)`);
    if (warehousesCount && warehousesCount > 0) blockingDeps.push(`${warehousesCount} entrepôt(s)`);

    if (blockingDeps.length > 0) {
      throw new Error(
        `Impossible de supprimer cette coopérative car elle est liée à : ${blockingDeps.join(', ')}. ` +
          `Veuillez d'abord supprimer ou réassigner ces éléments.`
      );
    }

    if (profiles && profiles.length > 0) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ cooperative_id: null } as never)
        .eq('cooperative_id', id);
      if (updateError) {
        throw new Error(`Échec de la mise à jour des utilisateurs : ${updateError.message}`);
      }
    }

    const { error } = await supabase.from('cooperatives').delete().eq('id', id);
    if (error) throw new Error(`Échec de la suppression : ${error.message}`);
  },
};
