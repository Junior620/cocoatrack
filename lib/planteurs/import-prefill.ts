/**
 * Pré-remplissage du formulaire planteur depuis les attributs d'un import géo (KML/Shapefile/GeoJSON).
 */

import type { ParsedFeature } from '@/types/parcelles';
import type { CreatePlanteurInput } from '@/lib/validations/planteur';

/** Correspondances nom de champ DBF/KML → champ planteur */
const PLANTEUR_FIELD_ALIASES: Record<keyof Pick<CreatePlanteurInput, 'name' | 'code' | 'localite' | 'region' | 'departement' | 'phone' | 'cni'>, string[]> = {
  name: ['name', 'nom', 'planteur', 'planteur_name', 'farmer', 'owner', 'proprietaire', 'propriétaire', 'label'],
  code: ['code', 'planteur_code', 'id', 'ref', 'reference', 'numero', 'numéro'],
  localite: ['localite', 'localité', 'village', 'commune', 'lieu', 'locality', 'town'],
  region: ['region', 'région', 'province', 'state'],
  departement: ['departement', 'département', 'dept', 'district', 'county'],
  phone: ['phone', 'telephone', 'téléphone', 'tel', 'mobile', 'gsm'],
  cni: ['cni', 'id_card', 'carte', 'identite', 'identité', 'national_id'],
};

export interface PlanteurPrefillMapping {
  name_field?: string;
  code_field?: string;
  localite_field?: string;
  region_field?: string;
  departement_field?: string;
  phone_field?: string;
  cni_field?: string;
}

export interface PlanteurPrefillResult {
  values: Partial<CreatePlanteurInput>;
  mapping: PlanteurPrefillMapping;
  confidence: 'high' | 'medium' | 'low';
  sourceFeatureIndex: number;
}

function normalizeKey(key: string): string {
  return key.toLowerCase().trim().replace(/\s+/g, '_');
}

function findMatchingField(
  dbfKeys: string[],
  aliases: string[]
): string | undefined {
  const normalized = dbfKeys.map((k) => ({ original: k, norm: normalizeKey(k) }));
  for (const alias of aliases) {
    const match = normalized.find((k) => k.norm === alias || k.norm.includes(alias));
    if (match) return match.original;
  }
  return undefined;
}

function getAttributeValue(feature: ParsedFeature, fieldName: string | undefined): string | null {
  if (!fieldName) return null;
  const attrs = feature.dbf_attributes || {};
  const val = attrs[fieldName];
  if (val === null || val === undefined) return null;
  const str = String(val).trim();
  return str.length > 0 ? str : null;
}

/**
 * Analyse les features importées et propose un pré-remplissage du formulaire planteur.
 * Utilise la première feature valide contenant un nom détectable.
 */
export function suggestPlanteurPrefillFromImport(
  features: ParsedFeature[]
): PlanteurPrefillResult | null {
  if (!features.length) return null;

  const validFeatures = features.filter((f) => f.validation.ok && !f.is_duplicate);
  const candidates = validFeatures.length > 0 ? validFeatures : features;

  for (let i = 0; i < candidates.length; i++) {
    const feature = candidates[i];
    const dbfKeys = Object.keys(feature.dbf_attributes || {});
    if (dbfKeys.length === 0) continue;

    const mapping: PlanteurPrefillMapping = {
      name_field: findMatchingField(dbfKeys, PLANTEUR_FIELD_ALIASES.name),
      code_field: findMatchingField(dbfKeys, PLANTEUR_FIELD_ALIASES.code),
      localite_field: findMatchingField(dbfKeys, PLANTEUR_FIELD_ALIASES.localite),
      region_field: findMatchingField(dbfKeys, PLANTEUR_FIELD_ALIASES.region),
      departement_field: findMatchingField(dbfKeys, PLANTEUR_FIELD_ALIASES.departement),
      phone_field: findMatchingField(dbfKeys, PLANTEUR_FIELD_ALIASES.phone),
      cni_field: findMatchingField(dbfKeys, PLANTEUR_FIELD_ALIASES.cni),
    };

    const name = getAttributeValue(feature, mapping.name_field);
    if (!name) continue;

    const values: Partial<CreatePlanteurInput> = {
      name,
      code: getAttributeValue(feature, mapping.code_field) || undefined,
      localite: getAttributeValue(feature, mapping.localite_field),
      region: getAttributeValue(feature, mapping.region_field),
      departement: getAttributeValue(feature, mapping.departement_field),
      phone: getAttributeValue(feature, mapping.phone_field),
      cni: getAttributeValue(feature, mapping.cni_field),
    };

    const mappedCount = Object.values(mapping).filter(Boolean).length;
    const confidence: PlanteurPrefillResult['confidence'] =
      mappedCount >= 3 ? 'high' : mappedCount >= 2 ? 'medium' : 'low';

    return { values, mapping, confidence, sourceFeatureIndex: i };
  }

  return null;
}
