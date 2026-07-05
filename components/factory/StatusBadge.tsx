import type {
  FactoryReceiptStatus,
  TransformationOrderStatus,
  QualityDecision,
} from '@/types/factory';
import {
  RECEIPT_STATUS_LABELS,
  ORDER_STATUS_LABELS,
} from '@/types/factory';

const STATUS_COLORS: Record<string, string> = {
  pending_qc: 'bg-gray-100 text-gray-700',
  accepted: 'bg-green-100 text-green-800',
  accepted_with_reserve: 'bg-yellow-100 text-yellow-800',
  rejected: 'bg-red-100 text-red-800',
  stored: 'bg-blue-100 text-blue-800',
  draft: 'bg-gray-100 text-gray-600',
  planned: 'bg-indigo-100 text-indigo-800',
  in_progress: 'bg-orange-100 text-orange-800',
  completed: 'bg-green-100 text-green-800',
  validated: 'bg-green-100 text-green-900',
  cancelled: 'bg-red-100 text-red-800',
  conforme: 'bg-green-100 text-green-800',
  non_conforme: 'bg-red-100 text-red-800',
  rejete: 'bg-red-100 text-red-800',
  a_retraiter: 'bg-orange-100 text-orange-800',
};

export function FactoryStatusBadge({
  status,
  type = 'receipt',
}: {
  status: string;
  type?: 'receipt' | 'order' | 'quality';
}) {
  let label = status;
  if (type === 'receipt') label = RECEIPT_STATUS_LABELS[status as FactoryReceiptStatus] ?? status;
  if (type === 'order') label = ORDER_STATUS_LABELS[status as TransformationOrderStatus] ?? status;

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-700'}`}
    >
      {label}
    </span>
  );
}

export function QualityDecisionBadge({ decision }: { decision: QualityDecision | string | null }) {
  if (!decision) return null;
  const labels: Record<string, string> = {
    conforme: 'Conforme',
    non_conforme: 'Non conforme',
    a_retraiter: 'À retraiter',
    rejete: 'Rejeté',
    accepted_with_reserve: 'Sous réserve',
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[decision] ?? 'bg-gray-100'}`}
    >
      {labels[decision] ?? decision}
    </span>
  );
}
