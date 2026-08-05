/**
 * Unified field-visit priority queue.
 * One score from EVI∩NDMI + NDWI surface + SAVI (young/sparse) + NDRE.
 */

import type { CombinedVegetationAlert } from './combined-alerts';
import type { NDWIAlert } from './ndwi-alerts';
import type { SAVIAlert } from './savi-alerts';
import type { NDREAlert } from './ndre-alerts';

export type VisitPriorityRank = 'none' | 'low' | 'medium' | 'high';

export interface VisitPriorityInput {
  combined: CombinedVegetationAlert;
  ndwiAlert: NDWIAlert;
  saviAlert?: SAVIAlert | null;
  ndreAlert?: NDREAlert | null;
  imageryQuality?: 'good' | 'acceptable' | 'degraded' | null;
}

export interface VisitPriorityResult {
  rank: VisitPriorityRank;
  /** Higher = see sooner (0–100) */
  score: number;
  reasons: string[];
  messageFr: string;
}

function alertRank(level: string): number {
  if (level === 'alert') return 2;
  if (level === 'watch') return 1;
  return 0;
}

/**
 * Build a single « à voir cette semaine » priority from complementary signals.
 */
export function computeVisitPriority(
  input: VisitPriorityInput
): VisitPriorityResult {
  const reasons: string[] = [];
  let score = 0;
  const degraded = input.imageryQuality === 'degraded';

  const combined = input.combined;
  if (combined.visitPriority === 'high' || combined.level === 'alert') {
    score += 50;
    reasons.push('Double signal EVI∩NDMI');
  } else if (combined.visitPriority === 'medium' || combined.level === 'watch') {
    score += 28;
    reasons.push(
      combined.code === 'canopy_and_hydric'
        ? 'Surveillance EVI∩NDMI'
        : combined.code === 'canopy_only'
          ? 'Canopée (EVI)'
          : 'Hydrique (NDMI)'
    );
  }

  if (!degraded && input.ndwiAlert.level !== 'none') {
    const boost = input.ndwiAlert.level === 'alert' ? 18 : 10;
    score += boost;
    reasons.push('Eau de surface (NDWI)');
  }

  if (!degraded && input.saviAlert && input.saviAlert.level !== 'none') {
    const boost = input.saviAlert.level === 'alert' ? 16 : 8;
    score += boost;
    reasons.push('Reprise / jeunes (SAVI)');
  }

  if (!degraded && input.ndreAlert && input.ndreAlert.level !== 'none') {
    const boost = input.ndreAlert.level === 'alert' ? 14 : 7;
    score += boost;
    reasons.push('Chlorophylle (NDRE)');
  }

  if (degraded) {
    score = Math.max(0, Math.round(score * 0.55));
    reasons.push('Image dégradée — priorité réduite');
  }

  score = Math.min(100, score);

  let rank: VisitPriorityRank = 'none';
  if (score >= 55) rank = 'high';
  else if (score >= 28) rank = 'medium';
  else if (score >= 10) rank = 'low';

  // Floor: never lower than combined.visitPriority when it was set
  if (combined.visitPriority === 'high' && rank !== 'high') rank = 'high';
  if (combined.visitPriority === 'medium' && rank === 'none') rank = 'medium';
  if (
    combined.visitPriority === 'none' &&
    alertRank(input.ndwiAlert.level) >= 2 &&
    rank === 'none'
  ) {
    rank = 'medium';
  }

  const messageFr =
    rank === 'none'
      ? 'Pas de visite prioritaire cette semaine.'
      : rank === 'high'
        ? `Priorité haute (${reasons.slice(0, 3).join(' · ')}).`
        : rank === 'medium'
          ? `À planifier (${reasons.slice(0, 3).join(' · ')}).`
          : `Surveillance légère (${reasons.slice(0, 2).join(' · ')}).`;

  return { rank, score, reasons, messageFr };
}

export function visitPrioritySortKey(rank: string, score = 0): number {
  const base =
    rank === 'high' ? 300 : rank === 'medium' ? 200 : rank === 'low' ? 100 : 0;
  return base + score;
}
