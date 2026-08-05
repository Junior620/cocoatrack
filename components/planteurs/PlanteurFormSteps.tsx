'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FORM_STEPS, type FormStepId } from '@/lib/planteurs/profile-completeness';

interface PlanteurFormStepsProps {
  currentStep: FormStepId;
  onStepClick?: (step: FormStepId) => void;
  className?: string;
}

export function PlanteurFormSteps({ currentStep, onStepClick, className }: PlanteurFormStepsProps) {
  const currentIndex = FORM_STEPS.findIndex((s) => s.id === currentStep);

  return (
    <nav aria-label="Étapes du formulaire" className={cn('mb-6', className)}>
      <ol className="flex flex-wrap items-center gap-2">
        {FORM_STEPS.map((step, index) => {
          const isActive = step.id === currentStep;
          const isDone = index < currentIndex;
          const clickable = onStepClick && index <= currentIndex;

          return (
            <li key={step.id} className="flex items-center gap-2">
              {index > 0 && <span className="hidden h-px w-4 bg-gray-200 sm:block" />}
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onStepClick?.(step.id)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                  isActive && 'bg-primary-100 text-primary-800 ring-1 ring-primary-300',
                  isDone && !isActive && 'bg-green-50 text-green-700',
                  !isActive && !isDone && 'bg-gray-50 text-gray-500',
                  clickable && 'hover:bg-primary-50 cursor-pointer',
                  !clickable && 'cursor-default'
                )}
              >
                <span
                  className={cn(
                    'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold',
                    isActive && 'bg-primary-600 text-white',
                    isDone && !isActive && 'bg-green-600 text-white',
                    !isActive && !isDone && 'bg-gray-200 text-gray-600'
                  )}
                >
                  {isDone && !isActive ? <Check className="h-3 w-3" /> : index + 1}
                </span>
                {step.label}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
