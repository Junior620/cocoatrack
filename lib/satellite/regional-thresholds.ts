/**
 * Regional / elevation tweaks for cocoa satellite thresholds.
 */

import type { NDMIThresholds } from './ndmi-alerts';
import { NDMI_THRESHOLDS_CACAO } from './ndmi-alerts';

export interface RegionalContext {
  region?: string | null;
  elevationMeters?: number | null;
}

/**
 * Higher elevation → slightly more sensitive hydric thresholds (drier air / cooler nights).
 * Coastal / lowland → slightly less sensitive.
 */
export function applyRegionalNdmiThresholds(
  base: NDMIThresholds = NDMI_THRESHOLDS_CACAO,
  ctx: RegionalContext = {}
): NDMIThresholds {
  let factor = 1;
  const elev = ctx.elevationMeters;
  if (elev != null && Number.isFinite(elev)) {
    if (elev >= 800) factor = 0.92;
    else if (elev <= 200) factor = 1.08;
  }

  const region = (ctx.region || '').toLowerCase();
  if (region.includes('ghana') || region.includes('ashanti')) {
    factor *= 1.05;
  } else if (
    region.includes('côte') ||
    region.includes('cote') ||
    region.includes("d'ivoire") ||
    region.includes('ivoire')
  ) {
    factor *= 1.0;
  }

  return {
    ...base,
    dropWatch: base.dropWatch * factor,
    dropAlert: base.dropAlert * factor,
    low: base.low * factor,
  };
}
