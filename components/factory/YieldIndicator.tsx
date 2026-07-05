import type { YieldIndicator } from '@/types/factory';

const STYLES: Record<YieldIndicator, string> = {
  green: 'text-green-700 bg-green-50 border-green-200',
  orange: 'text-orange-700 bg-orange-50 border-orange-200',
  red: 'text-red-700 bg-red-50 border-red-200',
};

const LABELS: Record<YieldIndicator, string> = {
  green: 'Conforme',
  orange: 'Attention',
  red: 'Anormal',
};

export function YieldIndicatorBadge({
  indicator,
  yieldPct,
  expectedPct,
}: {
  indicator: YieldIndicator;
  yieldPct?: number;
  expectedPct?: number | null;
}) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${STYLES[indicator]}`}>
      <p className="text-xs font-medium uppercase">{LABELS[indicator]}</p>
      {yieldPct != null && (
        <p className="text-lg font-bold">{yieldPct.toFixed(1)}%</p>
      )}
      {expectedPct != null && (
        <p className="text-xs opacity-80">Attendu : {expectedPct.toFixed(1)}%</p>
      )}
    </div>
  );
}

export function getYieldIndicatorFromValues(
  actual: number,
  expected: number | null,
  tolerance = 5
): YieldIndicator {
  if (expected == null) return 'green';
  if (actual >= expected - tolerance) return 'green';
  if (actual >= expected - tolerance * 2) return 'orange';
  return 'red';
}
