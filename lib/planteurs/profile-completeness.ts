/**
 * Calcul de complétude du profil planteur (pour formulaire guidé).
 */

export interface PlanteurProfileField {
  key: string;
  label: string;
  weight: number;
}

export const PLANTEUR_PROFILE_FIELDS: PlanteurProfileField[] = [
  { key: 'name', label: 'Nom', weight: 15 },
  { key: 'phone', label: 'Téléphone', weight: 10 },
  { key: 'cni', label: 'CNI', weight: 10 },
  { key: 'chef_planteur_id', label: 'Chef planteur', weight: 15 },
  { key: 'cooperative', label: 'Coopérative', weight: 10 },
  { key: 'localite', label: 'Village / localité', weight: 10 },
  { key: 'region', label: 'Région', weight: 5 },
  { key: 'departement', label: 'Département', weight: 5 },
  { key: 'statut_plantation', label: 'Statut plantation', weight: 5 },
  { key: 'superficie_hectares', label: 'Superficie', weight: 5 },
  { key: 'latitude', label: 'Coordonnées GPS', weight: 5 },
  { key: 'longitude', label: 'Coordonnées GPS', weight: 5 },
];

export type PlanteurFormLike = Record<string, unknown>;

function isFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return !Number.isNaN(value) && value > 0;
  return true;
}

export interface ProfileCompletenessResult {
  percentage: number;
  filledCount: number;
  totalWeight: number;
  filledWeight: number;
  missing: string[];
  missingLabels: string[];
}

/** GPS compte comme un seul champ rempli si lat+lng présents. */
export function computeProfileCompleteness(form: PlanteurFormLike): ProfileCompletenessResult {
  const missing: string[] = [];
  const missingLabels: string[] = [];
  let filledWeight = 0;
  let totalWeight = 0;

  const gpsFilled =
    isFilled(form.latitude) && isFilled(form.longitude);

  for (const field of PLANTEUR_PROFILE_FIELDS) {
    if (field.key === 'longitude') continue;

    totalWeight += field.weight;

    let filled = false;
    if (field.key === 'latitude') {
      filled = gpsFilled;
    } else {
      filled = isFilled(form[field.key]);
    }

    if (filled) {
      filledWeight += field.weight;
      if (field.key === 'latitude' && PLANTEUR_PROFILE_FIELDS.some((f) => f.key === 'longitude')) {
        filledWeight += PLANTEUR_PROFILE_FIELDS.find((f) => f.key === 'longitude')!.weight;
      }
    } else if (field.key !== 'latitude') {
      missing.push(field.key);
      missingLabels.push(field.label);
    } else if (!gpsFilled) {
      missing.push('latitude');
      missingLabels.push('Coordonnées GPS');
    }
  }

  const percentage = totalWeight > 0 ? Math.round((filledWeight / totalWeight) * 100) : 0;

  return {
    percentage,
    filledCount: PLANTEUR_PROFILE_FIELDS.length - missing.length,
    totalWeight,
    filledWeight,
    missing,
    missingLabels: [...new Set(missingLabels)],
  };
}

export const FORM_STEPS = [
  { id: 'identity', label: 'Identité', fields: ['name', 'phone', 'cni', 'code'] },
  { id: 'location', label: 'Localisation', fields: ['region', 'departement', 'localite', 'latitude', 'longitude'] },
  { id: 'organisation', label: 'Organisation', fields: ['cooperative', 'chef_planteur_id', 'statut_plantation', 'superficie_hectares'] },
  { id: 'parcelles', label: 'Parcelles', fields: [] },
  { id: 'review', label: 'Validation', fields: [] },
] as const;

export type FormStepId = (typeof FORM_STEPS)[number]['id'];
