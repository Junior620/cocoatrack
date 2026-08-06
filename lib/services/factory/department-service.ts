import type { SupabaseClient } from '@supabase/supabase-js';
import type { FactoryDepartment } from '@/types/usinage';
import { MVP_FACTORY_DEPARTMENTS, FACTORY_DEPARTMENT_LABELS } from '@/types/usinage';
import { resolveFactorySiteId } from './factory-context';

type UntypedDb = SupabaseClient<any, 'public', any>;

export { MVP_FACTORY_DEPARTMENTS, FACTORY_DEPARTMENT_LABELS };

export async function listSiteStaff(supabase: UntypedDb, userId: string) {
  const siteId = await resolveFactorySiteId(supabase, userId);
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, factory_department, can_solo_validate_lot, is_active')
    .eq('factory_site_id', siteId)
    .order('full_name');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function updateStaffDepartment(
  supabase: UntypedDb,
  profileId: string,
  input: {
    factory_department?: FactoryDepartment | null;
    can_solo_validate_lot?: boolean;
  }
) {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      factory_department: input.factory_department ?? null,
      can_solo_validate_lot: input.can_solo_validate_lot ?? false,
    })
    .eq('id', profileId)
    .select('id, full_name, factory_department, can_solo_validate_lot')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/** Qui peut faire quoi par département MVP */
export const DEPARTMENT_CAPABILITIES: Record<
  FactoryDepartment,
  { can_receive: boolean; can_qc: boolean; can_process: boolean; can_store: boolean; can_ship: boolean; can_validate: boolean }
> = {
  direction: {
    can_receive: false,
    can_qc: false,
    can_process: false,
    can_store: false,
    can_ship: false,
    can_validate: true,
  },
  reception: {
    can_receive: true,
    can_qc: false,
    can_process: false,
    can_store: false,
    can_ship: false,
    can_validate: false,
  },
  qualite: {
    can_receive: false,
    can_qc: true,
    can_process: false,
    can_store: false,
    can_ship: false,
    can_validate: false,
  },
  tracabilite: {
    can_receive: false,
    can_qc: false,
    can_process: false,
    can_store: false,
    can_ship: false,
    can_validate: true,
  },
  usinage: {
    can_receive: false,
    can_qc: false,
    can_process: true,
    can_store: false,
    can_ship: false,
    can_validate: false,
  },
  magasin: {
    can_receive: false,
    can_qc: false,
    can_process: false,
    can_store: true,
    can_ship: false,
    can_validate: false,
  },
  logistique: {
    can_receive: false,
    can_qc: false,
    can_process: false,
    can_store: false,
    can_ship: true,
    can_validate: false,
  },
  approvisionnement: {
    can_receive: true,
    can_qc: false,
    can_process: false,
    can_store: false,
    can_ship: false,
    can_validate: false,
  },
  maintenance: {
    can_receive: false,
    can_qc: false,
    can_process: false,
    can_store: false,
    can_ship: false,
    can_validate: false,
  },
  qhse: {
    can_receive: false,
    can_qc: true,
    can_process: false,
    can_store: false,
    can_ship: false,
    can_validate: false,
  },
  commercial: {
    can_receive: false,
    can_qc: false,
    can_process: false,
    can_store: false,
    can_ship: true,
    can_validate: false,
  },
  finance: {
    can_receive: false,
    can_qc: false,
    can_process: false,
    can_store: false,
    can_ship: false,
    can_validate: false,
  },
  informatique: {
    can_receive: false,
    can_qc: false,
    can_process: false,
    can_store: false,
    can_ship: false,
    can_validate: false,
  },
  audit: {
    can_receive: false,
    can_qc: false,
    can_process: false,
    can_store: false,
    can_ship: false,
    can_validate: true,
  },
};
