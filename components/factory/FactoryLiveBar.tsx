'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, Radio } from 'lucide-react';
import { OnlineStatus } from '@/components/ui/OnlineStatus';

function formatRelativeTime(date: Date): string {
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 15) return "à l'instant";
  if (sec < 60) return `il y a ${sec} s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  return `il y a ${h} h`;
}

export interface FactoryLiveChip {
  label: string;
  value: string;
}

export function FactoryLiveBar({
  lastUpdated,
  isRefreshing,
  onRefresh,
  chips,
  useDemo,
}: {
  lastUpdated: Date;
  isRefreshing?: boolean;
  onRefresh: () => void;
  chips: FactoryLiveChip[];
  useDemo?: boolean;
}) {
  const [, tick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <Radio className="h-3.5 w-3.5" />
          Temps réel
          {useDemo && <span className="font-normal text-emerald-600/80">(démo)</span>}
        </span>

        <OnlineStatus showLabel size="sm" />

        <span className="text-xs text-gray-500">
          Mis à jour {formatRelativeTime(lastUpdated)}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {chips.map((chip) => (
          <span
            key={chip.label}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-1 text-xs text-gray-700"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            <span className="text-gray-500">{chip.label}</span>
            <span className="font-semibold tabular-nums text-gray-900">{chip.value}</span>
          </span>
        ))}

        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
          title="Actualiser"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>
    </div>
  );
}
