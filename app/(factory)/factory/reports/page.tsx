'use client';

import Link from 'next/link';
import { factoryApi } from '@/lib/api/factory';

const REPORTS = [
  { type: 'production', label: 'Rapport de production', desc: 'Ordres de transformation' },
  { type: 'yields', label: 'Rapport de rendement', desc: 'Rendements réels vs théoriques' },
  { type: 'stocks', label: 'Rapport de stock', desc: 'Niveaux de stock actuels' },
  { type: 'traceability', label: 'Rapport traçabilité', desc: 'Réceptions et lots amont' },
] as const;

export default function FactoryReportsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#5C4033]">Rapports usine</h1>
      <div className="grid gap-4 md:grid-cols-2">
        {REPORTS.map((r) => (
          <div key={r.type} className="rounded-xl border border-[#d4c4b0] bg-white p-5">
            <h2 className="font-semibold text-[#5C4033]">{r.label}</h2>
            <p className="mt-1 text-sm text-gray-500">{r.desc}</p>
            <div className="mt-4 flex gap-2">
              <a
                href={factoryApi.exportReportCsv(r.type)}
                className="rounded-lg border border-[#5C4033] px-3 py-1.5 text-sm text-[#5C4033] hover:bg-[#faf6f1]"
              >
                Export CSV
              </a>
            </div>
          </div>
        ))}
      </div>
      <Link href="/factory/traceability" className="text-sm text-[#8B6914] hover:underline">
        Recherche traçabilité interactive →
      </Link>
    </div>
  );
}
