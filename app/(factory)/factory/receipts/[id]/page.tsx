'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useFactoryReceipt } from '@/lib/hooks/useFactory';
import { FactoryStatusBadge } from '@/components/factory/StatusBadge';
import { QualityDecisionBadge } from '@/components/factory/StatusBadge';

export default function FactoryReceiptDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: receipt, isLoading, error } = useFactoryReceipt(id);

  if (isLoading) return <p>Chargement…</p>;
  if (error || !receipt) {
    return <div className="text-red-600">{error?.message || 'Réception introuvable'}</div>;
  }

  const weightDiff =
    receipt.declared_weight_kg != null
      ? Number(receipt.received_weight_kg) - Number(receipt.declared_weight_kg)
      : null;

  return (
    <div className="space-y-6">
      <Link href="/factory/receipts" className="text-sm text-[#8B6914] hover:underline">← Réceptions</Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#5C4033]">{receipt.receipt_number}</h1>
          <p className="text-sm text-gray-500">
            Reçu le {new Date(receipt.received_date).toLocaleDateString('fr-FR')}
          </p>
        </div>
        <FactoryStatusBadge status={receipt.status} type="receipt" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <InfoCard title="Origine">
          <p>{receipt.cooperative?.name || receipt.supplier_name || '-'}</p>
          <p className="text-sm text-gray-500">Lot : {receipt.upstream_lot_number || '-'}</p>
          {receipt.waybill && (
            <Link href={`/deliveries/waybills/${receipt.waybill.id}`} className="text-sm text-[#5C4033] hover:underline">
              LV : {receipt.waybill.code}
            </Link>
          )}
        </InfoCard>
        <InfoCard title="Transport">
          <p>Document : {receipt.transport_document_number || '-'}</p>
          <p>Véhicule : {receipt.vehicle_number || '-'}</p>
          <p>Chauffeur : {receipt.driver_name || '-'}</p>
        </InfoCard>
        <InfoCard title="Poids">
          <p>
            Reçu (net) : <strong>{Number(receipt.received_weight_kg).toFixed(2)} kg</strong>
          </p>
          {receipt.gross_weight_kg != null && (
            <p>Brut : {Number(receipt.gross_weight_kg).toFixed(2)} kg</p>
          )}
          {receipt.tare_kg != null && (
            <p>Tare : {Number(receipt.tare_kg).toFixed(2)} kg</p>
          )}
          <p>
            Annoncé :{' '}
            {receipt.declared_weight_kg != null
              ? `${Number(receipt.declared_weight_kg).toFixed(2)} kg`
              : '-'}
          </p>
          {weightDiff != null && (
            <p
              className={
                Math.abs(weightDiff) > Number(receipt.declared_weight_kg) * 0.05
                  ? 'text-orange-600'
                  : 'text-green-600'
              }
            >
              Écart : {weightDiff > 0 ? '+' : ''}
              {weightDiff.toFixed(2)} kg
            </p>
          )}
          <p>Sacs : {receipt.bag_count ?? '-'}</p>
        </InfoCard>
        {receipt.quality_control && (
          <InfoCard title="Contrôle qualité">
            <QualityDecisionBadge decision={receipt.quality_control.decision ?? null} />
            <p className="mt-2 text-sm">
              Humidité : {receipt.quality_control.moisture_rate ?? '-'} %
            </p>
            {receipt.quality_control.oncc_grade && (
              <p className="text-sm">Grade ONCC : {receipt.quality_control.oncc_grade}</p>
            )}
          </InfoCard>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {receipt.status === 'pending_qc' && (
          <Link
            href={`/factory/quality?receipt=${receipt.id}`}
            className="inline-block rounded-lg bg-[#5C4033] px-4 py-2 text-sm font-medium text-white"
          >
            Contrôler la qualité →
          </Link>
        )}
        {receipt.cocoa_lot_id && (
          <Link
            href={`/factory/lots/passport?id=${encodeURIComponent(receipt.cocoa_lot_id)}`}
            className="inline-block rounded-lg border border-[#5C4033] px-4 py-2 text-sm font-medium text-[#5C4033]"
          >
            Voir passeport lot
          </Link>
        )}
        {receipt.upstream_lot_number && (
          <Link
            href={`/factory/lots/passport?lot=${encodeURIComponent(receipt.upstream_lot_number)}`}
            className="inline-block rounded-lg border border-[#d4c4b0] px-4 py-2 text-sm text-[#5C4033]"
          >
            Passeport (n° amont)
          </Link>
        )}
      </div>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#d4c4b0] bg-white p-4">
      <h2 className="mb-2 font-semibold text-[#5C4033]">{title}</h2>
      <div className="space-y-1 text-sm text-gray-700">{children}</div>
    </div>
  );
}
