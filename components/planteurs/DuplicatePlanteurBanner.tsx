'use client';

import Link from 'next/link';
import { AlertTriangle, UserPlus } from 'lucide-react';

export interface DuplicatePlanteurInfo {
  existing_planteur_id: string;
  existing_planteur_name: string;
  existing_planteur_code: string;
  match_type: 'exact' | 'normalized';
}

interface DuplicatePlanteurBannerProps {
  duplicate: DuplicatePlanteurInfo;
  onReuse?: () => void;
  onContinue?: () => void;
}

/**
 * Affiche un doublon probable et propose réutilisation ou création.
 */
export function DuplicatePlanteurBanner({
  duplicate,
  onReuse,
  onContinue,
}: DuplicatePlanteurBannerProps) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-900">Doublon probable détecté</p>
          <p className="mt-1 text-sm text-amber-800">
            Un planteur similaire existe déjà :{' '}
            <strong>{duplicate.existing_planteur_name}</strong> ({duplicate.existing_planteur_code})
            {duplicate.match_type === 'normalized' && (
              <span className="text-amber-700"> — correspondance normalisée (accents/casse)</span>
            )}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`/planteurs/${duplicate.existing_planteur_id}`}
              className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-amber-900 ring-1 ring-amber-300 hover:bg-amber-100"
            >
              Voir le planteur existant
            </Link>
            {onReuse && (
              <button
                type="button"
                onClick={onReuse}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700"
              >
                <UserPlus className="h-4 w-4" />
                Réutiliser ce planteur
              </button>
            )}
            {onContinue && (
              <button
                type="button"
                onClick={onContinue}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100"
              >
                Créer quand même
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
