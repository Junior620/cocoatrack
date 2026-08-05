/**
 * Adjust NDMI thresholds from field-agent feedback (false positives → stricter).
 */

import type { NDMIThresholds } from './ndmi-alerts';
import { NDMI_THRESHOLDS_CACAO } from './ndmi-alerts';

export type FeedbackVerdict = 'confirmed' | 'false_positive' | 'unsure';

export interface FeedbackAgg {
  confirmed: number;
  falsePositive: number;
  unsure: number;
}

/**
 * If false positives dominate for NDMI, raise drop thresholds (harder to alert).
 * If confirmed dominate, slightly lower (more sensitive).
 */
export function calibrateNdmiThresholdsFromFeedback(
  base: NDMIThresholds = NDMI_THRESHOLDS_CACAO,
  agg: FeedbackAgg
): NDMIThresholds {
  const total = agg.confirmed + agg.falsePositive + agg.unsure;
  if (total < 5) return { ...base };

  const fpRate = agg.falsePositive / total;
  const confRate = agg.confirmed / total;

  let factor = 1;
  if (fpRate >= 0.4) factor = 1.25; // fewer alerts
  else if (fpRate >= 0.25) factor = 1.12;
  else if (confRate >= 0.5 && fpRate < 0.15) factor = 0.9; // more sensitive

  return {
    ...base,
    dropWatch: base.dropWatch * factor,
    dropAlert: base.dropAlert * factor,
    low: base.low * (factor > 1 ? Math.min(factor, 1.15) : factor),
  };
}
