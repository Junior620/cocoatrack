'use client';

// CocoaTrack V2 - Conformity Info Bubble Component
// Displays missing data for parcelle conformity status
// Shows what information is needed to achieve "conforme" status

import { useState, useRef, useEffect } from 'react';
import type { ParcelleWithPlanteur, ConformityStatus } from '@/types/parcelles';
import { CONFORMITY_STATUS_LABELS, CONFORMITY_STATUS_COLORS } from '@/types/parcelles';

/**
 * Conformity criteria checklist
 * These are the data points that contribute to conformity status
 */
interface ConformityCriteria {
  hasPlanteur: boolean;
  hasVillage: boolean;
  hasValidArea: boolean;
  hasCertifications: boolean;
  hasGeometry: boolean;
  hasCode: boolean;
}

/**
 * Analyze a parcelle and determine what data is missing for conformity
 */
function analyzeConformity(parcelle: ParcelleWithPlanteur): {
  criteria: ConformityCriteria;
  missingItems: string[];
  presentItems: string[];
  completionPercentage: number;
} {
  const criteria: ConformityCriteria = {
    hasPlanteur: !!parcelle.planteur_id && !!parcelle.planteur?.name,
    hasVillage: !!parcelle.village && parcelle.village.trim() !== '',
    hasValidArea: parcelle.surface_hectares > 0,
    hasCertifications: parcelle.certifications && parcelle.certifications.length > 0,
    hasGeometry: !!parcelle.geometry,
    hasCode: !!parcelle.code && parcelle.code.trim() !== '',
  };

  const missingItems: string[] = [];
  const presentItems: string[] = [];

  // Check each criterion
  if (criteria.hasPlanteur) {
    presentItems.push('Planteur assigné');
  } else {
    missingItems.push('Planteur non assigné');
  }

  if (criteria.hasVillage) {
    presentItems.push('Village renseigné');
  } else {
    missingItems.push('Village manquant');
  }

  if (criteria.hasValidArea) {
    presentItems.push('Surface calculée');
  } else {
    missingItems.push('Surface invalide');
  }

  if (criteria.hasCertifications) {
    presentItems.push('Certifications ajoutées');
  } else {
    missingItems.push('Aucune certification');
  }

  if (criteria.hasGeometry) {
    presentItems.push('Géométrie disponible');
  } else {
    missingItems.push('Géométrie manquante');
  }

  if (criteria.hasCode) {
    presentItems.push('Code parcelle');
  } else {
    missingItems.push('Code manquant');
  }

  // Calculate completion percentage
  const totalCriteria = Object.keys(criteria).length;
  const metCriteria = Object.values(criteria).filter(Boolean).length;
  const completionPercentage = Math.round((metCriteria / totalCriteria) * 100);

  return { criteria, missingItems, presentItems, completionPercentage };
}

/**
 * Get recommendation based on conformity status
 */
function getStatusRecommendation(status: ConformityStatus, missingItems: string[]): string {
  switch (status) {
    case 'conforme':
      return 'Cette parcelle est conforme. Toutes les informations essentielles sont présentes.';
    case 'en_cours':
      return `Vérification en cours. ${missingItems.length} élément(s) à compléter pour atteindre la conformité.`;
    case 'non_conforme':
      return 'Cette parcelle a été marquée comme non conforme. Veuillez vérifier les données et corriger les problèmes identifiés.';
    case 'informations_manquantes':
      return `Informations manquantes. ${missingItems.length} élément(s) doivent être ajoutés.`;
    default:
      return 'Statut inconnu.';
  }
}

interface ConformityInfoBubbleProps {
  parcelle: ParcelleWithPlanteur;
  className?: string;
}

export function ConformityInfoBubble({ parcelle, className = '' }: ConformityInfoBubbleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const bubbleRef = useRef<HTMLDivElement>(null);

  // Close bubble when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (bubbleRef.current && !bubbleRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { missingItems, presentItems, completionPercentage } = analyzeConformity(parcelle);
  const recommendation = getStatusRecommendation(parcelle.conformity_status, missingItems);
  const statusColor = CONFORMITY_STATUS_COLORS[parcelle.conformity_status];

  return (
    <div className={`relative inline-block ${className}`} ref={bubbleRef}>
      {/* Info Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors"
        title="Voir les détails de conformité"
        aria-label="Informations de conformité"
      >
        <InfoIcon className="w-3.5 h-3.5" />
      </button>

      {/* Info Bubble Popup */}
      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-2 w-80 rounded-lg bg-white shadow-xl ring-1 ring-black ring-opacity-5 animate-in fade-in slide-in-from-top-1 duration-200">
          {/* Header */}
          <div 
            className="px-4 py-3 rounded-t-lg border-b"
            style={{ backgroundColor: `${statusColor}10` }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">
                Détails de conformité
              </h3>
              <span 
                className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ 
                  backgroundColor: `${statusColor}20`,
                  color: statusColor 
                }}
              >
                {CONFORMITY_STATUS_LABELS[parcelle.conformity_status]}
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-600">{recommendation}</p>
          </div>

          {/* Progress Bar */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
              <span>Complétude des données</span>
              <span className="font-medium">{completionPercentage}%</span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-300"
                style={{ 
                  width: `${completionPercentage}%`,
                  backgroundColor: completionPercentage === 100 ? '#10B981' : 
                                   completionPercentage >= 70 ? '#F59E0B' : '#EF4444'
                }}
              />
            </div>
          </div>

          {/* Missing Items */}
          {missingItems.length > 0 && (
            <div className="px-4 py-3 border-b border-gray-100">
              <h4 className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2">
                Données manquantes ({missingItems.length})
              </h4>
              <ul className="space-y-1.5">
                {missingItems.map((item, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm text-gray-700">
                    <XCircleIcon className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Present Items */}
          {presentItems.length > 0 && (
            <div className="px-4 py-3">
              <h4 className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">
                Données présentes ({presentItems.length})
              </h4>
              <ul className="space-y-1.5">
                {presentItems.map((item, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm text-gray-700">
                    <CheckCircleIcon className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Footer Note */}
          <div className="px-4 py-2 bg-gray-50 rounded-b-lg border-t border-gray-100">
            <p className="text-xs text-gray-500 italic">
              Le statut de conformité doit être vérifié par un agent de terrain.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Icons
function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function XCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

export default ConformityInfoBubble;
