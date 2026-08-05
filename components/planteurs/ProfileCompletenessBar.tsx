'use client';

import { cn } from '@/lib/utils';
import type { ProfileCompletenessResult } from '@/lib/planteurs/profile-completeness';

interface ProfileCompletenessBarProps {
  completeness: ProfileCompletenessResult;
  className?: string;
}

export function ProfileCompletenessBar({ completeness, className }: ProfileCompletenessBarProps) {
  const { percentage, missingLabels } = completeness;

  const barColor =
    percentage >= 80 ? 'bg-green-500' : percentage >= 60 ? 'bg-primary-500' : 'bg-orange-500';

  return (
    <div
      className={cn('rounded-lg border border-gray-200 bg-white p-4', className)}
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            Profil {percentage}% complété
          </p>
          {missingLabels.length > 0 ? (
            <p className="mt-1 text-xs text-gray-500">
              Manque : {missingLabels.slice(0, 5).join(', ')}
              {missingLabels.length > 5 ? ` (+${missingLabels.length - 5})` : ''}
            </p>
          ) : (
            <p className="mt-1 text-xs text-green-600">Profil complet</p>
          )}
        </div>
        <span className="text-2xl font-bold tabular-nums text-gray-900">{percentage}%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
        <div
          className={cn('h-full rounded-full transition-all duration-300', barColor)}
          style={{ width: `${Math.min(100, percentage)}%` }}
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
}
