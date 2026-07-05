import type { YieldIndicator } from '@/types/factory';

export interface YieldCalculation {
  totalInputKg: number;
  totalOutputKg: number;
  totalLossKg: number;
  globalYieldPct: number;
  lossRatePct: number;
  productYields: Array<{ name: string; quantityKg: number; yieldPct: number }>;
  expectedYieldPct: number | null;
  yieldDelta: number | null;
  indicator: YieldIndicator;
}

export function calculateYield(params: {
  inputs: Array<{ quantity_kg: number }>;
  outputs: Array<{ product_name: string; quantity_kg: number }>;
  losses: Array<{ quantity_kg: number }>;
  expectedYieldPct?: number | null;
  tolerancePct?: number;
}): YieldCalculation {
  const totalInputKg = params.inputs.reduce((s, i) => s + Number(i.quantity_kg), 0);
  const totalOutputKg = params.outputs.reduce((s, o) => s + Number(o.quantity_kg), 0);
  const totalLossKg = params.losses.reduce((s, l) => s + Number(l.quantity_kg), 0);

  const globalYieldPct = totalInputKg > 0 ? (totalOutputKg / totalInputKg) * 100 : 0;
  const lossRatePct = totalInputKg > 0 ? (totalLossKg / totalInputKg) * 100 : 0;

  const productYields = params.outputs.map((o) => ({
    name: o.product_name,
    quantityKg: Number(o.quantity_kg),
    yieldPct: totalInputKg > 0 ? (Number(o.quantity_kg) / totalInputKg) * 100 : 0,
  }));

  const expected = params.expectedYieldPct ?? null;
  const tolerance = params.tolerancePct ?? 5;
  const yieldDelta = expected != null ? globalYieldPct - expected : null;

  let indicator: YieldIndicator = 'green';
  if (expected != null && globalYieldPct < expected - tolerance) {
    indicator = globalYieldPct < expected - tolerance * 2 ? 'red' : 'orange';
  }

  return {
    totalInputKg,
    totalOutputKg,
    totalLossKg,
    globalYieldPct,
    lossRatePct,
    productYields,
    expectedYieldPct: expected,
    yieldDelta,
    indicator,
  };
}

export function getYieldIndicator(
  actualPct: number,
  expectedPct: number | null,
  tolerancePct = 5
): YieldIndicator {
  if (expectedPct == null) return 'green';
  if (actualPct >= expectedPct - tolerancePct) return 'green';
  if (actualPct >= expectedPct - tolerancePct * 2) return 'orange';
  return 'red';
}
