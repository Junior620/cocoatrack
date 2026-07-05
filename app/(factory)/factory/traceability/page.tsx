'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useFactoryTraceability } from '@/lib/hooks/useFactory';
import Link from 'next/link';

function TraceabilityContent() {
  const searchParams = useSearchParams();
  const initialLot = searchParams.get('lot') || '';
  const initialOutput = searchParams.get('output') || '';
  const [lot, setLot] = useState(initialLot);
  const [output, setOutput] = useState(initialOutput);
  const [query, setQuery] = useState<{ lot?: string; output?: string }>(
    initialLot ? { lot: initialLot } : initialOutput ? { output: initialOutput } : {}
  );

  const { data, isLoading, error } = useFactoryTraceability(query);

  const search = () => {
    if (lot.trim()) setQuery({ lot: lot.trim() });
    else if (output.trim()) setQuery({ output: output.trim() });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#5C4033]">Traçabilité industrielle</h1>
      <p className="text-sm text-[#8B6914]">
        Lot entrant → produits finis, ou produit fini → origine amont
      </p>

      <div className="rounded-xl border border-[#d4c4b0] bg-white p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            Lot fèves / réception
            <input className="mt-1 w-full rounded border px-3 py-2" value={lot} onChange={(e) => setLot(e.target.value)} placeholder="SCPB-2026-045" />
          </label>
          <label className="text-sm">
            Lot produit fini
            <input className="mt-1 w-full rounded border px-3 py-2" value={output} onChange={(e) => setOutput(e.target.value)} placeholder="OUT-BEURRE-001" />
          </label>
        </div>
        <button type="button" onClick={search} className="mt-3 rounded-lg bg-[#5C4033] px-4 py-2 text-sm text-white">
          Rechercher
        </button>
      </div>

      {error && <div className="rounded-lg bg-red-50 p-4 text-red-700">{error.message}</div>}
      {isLoading && <p>Recherche…</p>}

      {data && (
        <div className="space-y-4">
          {data.receipt && (
            <ChainBlock title="Réception usine">
              <p><strong>{(data.receipt as { receipt_number?: string }).receipt_number}</strong></p>
              <p className="text-sm">Poids : {Number((data.receipt as { received_weight_kg?: number }).received_weight_kg).toFixed(0)} kg</p>
              <Link href={`/factory/receipts/${(data.receipt as { id: string }).id}`} className="text-sm text-[#5C4033] hover:underline">Voir fiche →</Link>
            </ChainBlock>
          )}

          {data.cooperatives && data.cooperatives.length > 0 && (
            <ChainBlock title="Coopérative d'origine">
              {data.cooperatives.map((c) => (
                <p key={c!.id}>{c!.name}</p>
              ))}
            </ChainBlock>
          )}

          {data.quality_control && (
            <ChainBlock title="Contrôle qualité">
              <p>Décision : {(data.quality_control as { decision?: string }).decision}</p>
            </ChainBlock>
          )}

          {data.orders && data.orders.length > 0 && (
            <ChainBlock title="Ordres de transformation">
              {(data.orders as Array<{ id: string; order_number: string; actual_yield_rate?: number }>).map((o) => (
                <div key={o.id} className="flex justify-between text-sm">
                  <Link href={`/factory/orders/${o.id}`} className="text-[#5C4033] hover:underline">{o.order_number}</Link>
                  {o.actual_yield_rate != null && <span>{Number(o.actual_yield_rate).toFixed(1)}%</span>}
                </div>
              ))}
            </ChainBlock>
          )}

          {data.outputs && data.outputs.length > 0 && (
            <ChainBlock title="Produits dérivés">
              {(data.outputs as Array<{ product_name: string; output_lot_number: string; quantity_produced_kg: number }>).map((o, i) => (
                <p key={i} className="text-sm">{o.product_name} · {o.output_lot_number} · {Number(o.quantity_produced_kg).toFixed(2)} kg</p>
              ))}
            </ChainBlock>
          )}

          {!data.receipt && !data.outputs?.length && query.lot && (
            <p className="text-gray-500">Aucun résultat pour ce lot.</p>
          )}
        </div>
      )}
    </div>
  );
}

function ChainBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#d4c4b0] bg-white p-4">
      <h2 className="mb-2 font-semibold text-[#5C4033]">{title}</h2>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

export default function FactoryTraceabilityPage() {
  return (
    <Suspense fallback={<p>Chargement…</p>}>
      <TraceabilityContent />
    </Suspense>
  );
}
