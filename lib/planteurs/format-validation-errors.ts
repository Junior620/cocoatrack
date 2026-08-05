/**
 * Messages de validation Zod en français avec suggestions contextuelles.
 */

import type { ZodError } from 'zod';

const FIELD_LABELS: Record<string, string> = {
  name: 'Nom',
  code: 'Code',
  phone: 'Téléphone',
  cni: 'CNI',
  chef_planteur_id: 'Chef planteur',
  cooperative: 'Coopérative',
  region: 'Région',
  departement: 'Département',
  localite: 'Village / localité',
  statut_plantation: 'Statut plantation',
  superficie_hectares: 'Superficie',
  latitude: 'Latitude',
  longitude: 'Longitude',
};

const MESSAGE_TRANSLATIONS: Record<string, string> = {
  'Invalid UUID format': 'Identifiant invalide',
  'Invalid uuid': 'Identifiant invalide',
  'Invalid phone number format': 'Numéro de téléphone invalide (format Cameroun attendu, ex: +2376XXXXXXXX)',
  'CNI must be at least 5 characters': 'La CNI doit contenir au moins 5 caractères',
  'CNI must be at most 20 characters': 'La CNI ne peut pas dépasser 20 caractères',
  'Name must be at least 2 characters': 'Le nom doit contenir au moins 2 caractères',
  'Name must be at most 100 characters': 'Le nom ne peut pas dépasser 100 caractères',
  'Required': 'Ce champ est requis',
};

const FIELD_SUGGESTIONS: Record<string, string> = {
  chef_planteur_id:
    'Sélectionnez un chef planteur appartenant à la même coopérative que le planteur.',
  phone: 'Utilisez le format +237 suivi de 9 chiffres (ex: +237612345678).',
  cni: 'Saisissez le numéro figurant sur la carte nationale d\'identité.',
  cooperative: 'Choisissez la coopérative du planteur ou créez-en une nouvelle.',
};

function translateMessage(message: string, field: string): string {
  if (MESSAGE_TRANSLATIONS[message]) {
    return MESSAGE_TRANSLATIONS[message];
  }
  if (message.includes('chef') && message.toLowerCase().includes('cooperative')) {
    return 'Ce chef planteur n\'appartient pas à la même coopérative.';
  }
  if (message.includes('Coopérative')) return message;
  const label = FIELD_LABELS[field] || field;
  return `${label} : ${message}`;
}

export interface FormattedFieldError {
  field: string;
  label: string;
  message: string;
  suggestion?: string;
}

export function formatPlanteurValidationErrors(error: ZodError): {
  fieldErrors: Record<string, string>;
  details: FormattedFieldError[];
} {
  const fieldErrors: Record<string, string> = {};
  const details: FormattedFieldError[] = [];

  for (const err of error.errors) {
    const field = String(err.path[0] ?? 'form');
    const label = FIELD_LABELS[field] || field;
    const message = translateMessage(err.message, field);
    const suggestion = FIELD_SUGGESTIONS[field];

    fieldErrors[field] = message;
    details.push({ field, label, message, suggestion });
  }

  return { fieldErrors, details };
}
