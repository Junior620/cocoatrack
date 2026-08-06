import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  PackagingUnit,
  PackagingUnitType,
  OnccGrade,
  StorageLocation,
  StorageZone,
} from '@/types/usinage';
import { resolveFactorySiteId } from './factory-context';
import { assertLotOperable } from './lot-guards';
import { changeLotStatus } from './lot-service';

type UntypedDb = SupabaseClient<any, 'public', any>;

export async function listStorageZones(supabase: UntypedDb, userId: string) {
  const siteId = await resolveFactorySiteId(supabase, userId);
  const { data, error } = await supabase
    .from('storage_zones')
    .select('*')
    .eq('factory_site_id', siteId)
    .eq('is_active', true)
    .order('code');
  if (error) throw new Error(error.message);
  return (data ?? []) as StorageZone[];
}

export async function listStorageLocations(supabase: UntypedDb, userId: string) {
  const siteId = await resolveFactorySiteId(supabase, userId);
  const { data, error } = await supabase
    .from('storage_locations')
    .select('*, zone:storage_zones(*)')
    .eq('factory_site_id', siteId)
    .eq('is_active', true)
    .order('code');
  if (error) throw new Error(error.message);
  return (data ?? []) as StorageLocation[];
}

export async function createStorageZone(
  supabase: UntypedDb,
  userId: string,
  input: { code: string; name: string; zone_type?: string; warehouse_id?: string | null }
) {
  const siteId = await resolveFactorySiteId(supabase, userId);
  const { data, error } = await supabase
    .from('storage_zones')
    .insert({
      factory_site_id: siteId,
      code: input.code,
      name: input.name,
      zone_type: input.zone_type ?? 'general',
      warehouse_id: input.warehouse_id ?? null,
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as StorageZone;
}

export async function createStorageLocation(
  supabase: UntypedDb,
  userId: string,
  input: {
    zone_id: string;
    code: string;
    aisle?: string | null;
    row_label?: string | null;
    bin?: string | null;
    capacity_kg?: number | null;
  }
) {
  const siteId = await resolveFactorySiteId(supabase, userId);
  const qr = `LOC-${siteId.slice(0, 8)}-${input.code}`.toUpperCase();
  const { data, error } = await supabase
    .from('storage_locations')
    .insert({
      factory_site_id: siteId,
      zone_id: input.zone_id,
      code: input.code,
      aisle: input.aisle ?? null,
      row_label: input.row_label ?? null,
      bin: input.bin ?? null,
      capacity_kg: input.capacity_kg ?? null,
      qr_code: qr,
    })
    .select('*, zone:storage_zones(*)')
    .single();
  if (error) throw new Error(error.message);
  return data as StorageLocation;
}

export async function moveLotToLocation(
  supabase: UntypedDb,
  userId: string,
  lotId: string,
  locationId: string
) {
  await assertLotOperable(supabase, lotId);
  const lot = (
    await supabase.from('cocoa_lots').select('factory_site_id, storage_location_id').eq('id', lotId).single()
  ).data;

  await supabase
    .from('cocoa_lots')
    .update({ storage_location_id: locationId, status: 'stored' })
    .eq('id', lotId);

  if (lot) {
    await supabase.from('traceability_events').insert({
      factory_site_id: lot.factory_site_id,
      event_type: 'ObjectEvent',
      lot_id: lotId,
      why_biz_step: 'storing',
      where_location_id: locationId,
      actor_id: userId,
      payload: { from_location_id: lot.storage_location_id, to_location_id: locationId },
    });
  }
}

export async function createPackagingUnits(
  supabase: UntypedDb,
  userId: string,
  input: {
    lot_id: string;
    unit_type?: PackagingUnitType;
    count: number;
    net_weight_kg_each: number;
    tare_kg?: number | null;
    oncc_grade?: OnccGrade | null;
    campaign_year?: number | null;
    storage_location_id?: string | null;
    parent_unit_id?: string | null;
  }
): Promise<PackagingUnit[]> {
  await assertLotOperable(supabase, input.lot_id);
  const siteId = await resolveFactorySiteId(supabase, userId);
  const { data: lot } = await supabase
    .from('cocoa_lots')
    .select('lot_number, campaign_year, oncc_grade')
    .eq('id', input.lot_id)
    .single();

  const units: PackagingUnit[] = [];
  const ts = Date.now().toString(36).toUpperCase();

  for (let i = 1; i <= input.count; i++) {
    const unitNumber = `${lot?.lot_number ?? 'LOT'}-S${String(i).padStart(3, '0')}-${ts}`;
    const qr = `QR-${unitNumber}`;
    const { data, error } = await supabase
      .from('packaging_units')
      .insert({
        factory_site_id: siteId,
        lot_id: input.lot_id,
        unit_type: input.unit_type ?? 'bag',
        unit_number: unitNumber,
        qr_code: qr,
        parent_unit_id: input.parent_unit_id ?? null,
        net_weight_kg: input.net_weight_kg_each,
        tare_kg: input.tare_kg ?? null,
        gross_weight_kg:
          input.tare_kg != null ? input.net_weight_kg_each + input.tare_kg : input.net_weight_kg_each,
        oncc_grade: input.oncc_grade ?? (lot?.oncc_grade as OnccGrade | null) ?? null,
        campaign_year: input.campaign_year ?? lot?.campaign_year ?? new Date().getFullYear(),
        storage_location_id: input.storage_location_id ?? null,
        packaged_by: userId,
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    units.push(data as PackagingUnit);
  }

  await changeLotStatus(supabase, userId, input.lot_id, 'packaged', `${input.count} unité(s) conditionnées`);
  return units;
}

export async function listPackagingByLot(supabase: UntypedDb, lotId: string) {
  const { data, error } = await supabase
    .from('packaging_units')
    .select('*')
    .eq('lot_id', lotId)
    .order('unit_number');
  if (error) throw new Error(error.message);
  return (data ?? []) as PackagingUnit[];
}
