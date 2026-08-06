import type { SupabaseClient } from '@supabase/supabase-js';
import type { GradeRule, OnccGrade } from '@/types/usinage';
import { resolveFactorySiteId } from './factory-context';

type UntypedDb = SupabaseClient<any, 'public', any>;

export interface GradeEvaluationInput {
  moisture_rate?: number | null;
  mold_rate?: number | null;
  slate_rate?: number | null;
  insect_rate?: number | null;
  foreign_matter_rate?: number | null;
  smoke_odor?: boolean | null;
  mold_odor?: boolean | null;
  chemical_odor?: boolean | null;
}

export interface GradeEvaluationResult {
  suggested_grade: OnccGrade;
  block: boolean;
  alerts: string[];
  rule: GradeRule | null;
}

const DEFAULT_RULE: Omit<GradeRule, 'id' | 'factory_site_id' | 'name' | 'campaign_year' | 'version' | 'is_active' | 'rules_json'> = {
  moisture_target_max: 7.5,
  moisture_alert_max: 8,
  moisture_block_above: 8,
  mold_max_pct: 3,
  slate_max_pct: 8,
  insect_max_pct: 2,
  foreign_matter_max_pct: 0.5,
  mass_balance_tolerance_pct: 2,
};

export async function getActiveGradeRule(
  supabase: UntypedDb,
  userId: string,
  campaignYear?: number
): Promise<GradeRule | null> {
  const siteId = await resolveFactorySiteId(supabase, userId);
  let query = supabase
    .from('grade_rules')
    .select('*')
    .eq('factory_site_id', siteId)
    .eq('is_active', true)
    .order('version', { ascending: false })
    .limit(1);

  if (campaignYear) query = query.eq('campaign_year', campaignYear);

  const { data } = await query.maybeSingle();
  return data as GradeRule | null;
}

export async function ensureDefaultGradeRule(
  supabase: UntypedDb,
  userId: string
): Promise<GradeRule> {
  const existing = await getActiveGradeRule(supabase, userId);
  if (existing) return existing;

  const siteId = await resolveFactorySiteId(supabase, userId);
  const year = new Date().getFullYear();
  const { data, error } = await supabase
    .from('grade_rules')
    .insert({
      factory_site_id: siteId,
      name: `ONCC ${year}`,
      campaign_year: year,
      version: 1,
      is_active: true,
      ...DEFAULT_RULE,
      created_by: userId,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as GradeRule;
}

export function evaluateGrade(
  input: GradeEvaluationInput,
  rule?: GradeRule | null
): GradeEvaluationResult {
  const r = rule ?? ({ ...DEFAULT_RULE, id: '', factory_site_id: '', name: 'default', campaign_year: null, version: 1, is_active: true, rules_json: {} } as GradeRule);
  const alerts: string[] = [];
  let block = false;

  if (input.smoke_odor || input.mold_odor || input.chemical_odor) {
    alerts.push('Odeur anormale détectée');
    return { suggested_grade: 'rebut', block: true, alerts, rule: rule ?? null };
  }

  const moisture = input.moisture_rate ?? null;
  if (moisture != null && moisture > r.moisture_block_above) {
    alerts.push(`Humidité ${moisture}% > seuil blocage ${r.moisture_block_above}%`);
    block = true;
  } else if (moisture != null && moisture > r.moisture_alert_max) {
    alerts.push(`Humidité ${moisture}% > alerte ${r.moisture_alert_max}%`);
  }

  const mold = input.mold_rate ?? 0;
  const slate = input.slate_rate ?? 0;
  const insect = input.insect_rate ?? 0;
  const foreign = input.foreign_matter_rate ?? 0;

  if (mold > r.mold_max_pct) alerts.push(`Moisissure ${mold}% > ${r.mold_max_pct}%`);
  if (slate > r.slate_max_pct) alerts.push(`Ardoise ${slate}% > ${r.slate_max_pct}%`);
  if (insect > r.insect_max_pct) alerts.push(`Insectes ${insect}% > ${r.insect_max_pct}%`);
  if (foreign > r.foreign_matter_max_pct) {
    alerts.push(`Matières étrangères ${foreign}% > ${r.foreign_matter_max_pct}%`);
  }

  let suggested_grade: OnccGrade = 'grade_i';
  if (block || mold > r.mold_max_pct * 1.5 || foreign > r.foreign_matter_max_pct * 2) {
    suggested_grade = 'hors_standard';
  } else if (
    mold > r.mold_max_pct ||
    slate > r.slate_max_pct ||
    insect > r.insect_max_pct ||
    (moisture != null && moisture > r.moisture_target_max)
  ) {
    suggested_grade = 'grade_ii';
  }

  return { suggested_grade, block, alerts, rule: rule ?? null };
}

export function checkMassBalance(
  inputKg: number,
  outputKg: number,
  wasteKg: number,
  tolerancePct = 2
): { ok: boolean; deltaKg: number; allowedKg: number } {
  const deltaKg = Math.abs(inputKg - (outputKg + wasteKg));
  const allowedKg = inputKg * (tolerancePct / 100);
  return { ok: deltaKg <= allowedKg, deltaKg, allowedKg };
}
