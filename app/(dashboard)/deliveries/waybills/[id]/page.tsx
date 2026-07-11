'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { ExternalLink, FileText } from 'lucide-react';

import { useAuth, hasPermission } from '@/lib/auth';
import { waybillsApi } from '@/lib/api/waybills';
import { DeliveriesSubNav } from '@/components/deliveries/DeliveriesSubNav';
import { DeliveryPicker } from '@/components/waybills/DeliveryPicker';
import { useInvalidateWaybills, useLinkedDeliveryIds, useWaybillDetail } from '@/lib/hooks/useWaybills';

const PdfViewer = dynamic(
  () => import('@/components/receipts/PdfViewer').then((m) => m.PdfViewer),
  { ssr: false, loading: () => <p className="text-sm text-gray-500">Chargement du document…</p> }
);

export default function WaybillDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { user } = useAuth();
  const canEdit = user && hasPermission(user.role, 'deliveries:update');

  const { data: waybill, isLoading, error, refetch } = useWaybillDetail(id);
  const { data: linkedIds = new Set<string>() } = useLinkedDeliveryIds();
  const invalidate = useInvalidateWaybills();

  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [editDeliveries, setEditDeliveries] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    if (waybill?.document_storage_path) {
      waybillsApi.getDocumentUrl(id).then(setDocumentUrl);
    }
  }, [waybill?.document_storage_path, id]);

  useEffect(() => {
    if (waybill) {
      setSelectedIds(new Set(waybill.deliveries.map((d) => d.delivery_id)));
    }
  }, [waybill]);

  const excludedForPicker = new Set(
    [...linkedIds].filter(
      (did) => !waybill?.deliveries.some((d) => d.delivery_id === did)
    )
  );

  const handleSaveLinks = async () => {
    setSaving(true);
    setLinkError(null);
    try {
      await waybillsApi.linkDeliveries(id, Array.from(selectedIds));
      setEditDeliveries(false);
      invalidate();
      refetch();
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  if (isLoading) {
    return <p className="text-sm text-gray-500">Chargement…</p>;
  }

  if (error || !waybill) {
    return (
      <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
        Lettre de voiture introuvable
      </div>
    );
  }

  const weightGap =
    waybill.total_weight_kg && waybill.linked_weight_kg > 0
      ? Math.abs(waybill.linked_weight_kg - Number(waybill.total_weight_kg)) /
        Number(waybill.total_weight_kg)
      : 0;

  return (
    <div className="space-y-6">
      <DeliveriesSubNav />

      <div>
        <Link href="/deliveries/waybills" className="text-sm text-gray-500 hover:text-gray-700">
          ← Retour
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">{waybill.code}</h1>
        {waybill.lot_number && (
          <p className="text-sm text-gray-500">Lot {waybill.lot_number}</p>
        )}
      </div>

      {weightGap > 0.05 && (
        <div className="rounded-md bg-amber-50 p-4 text-sm text-amber-800">
          Écart de poids &gt; 5 % entre la LV ({Number(waybill.total_weight_kg).toLocaleString('fr-FR')} kg)
          et les livraisons liées ({waybill.linked_weight_kg.toLocaleString('fr-FR')} kg).
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="text-lg font-medium">Informations transport</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Date chargement</dt>
              <dd className="font-medium">{formatDate(waybill.loading_date)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Trajet</dt>
              <dd className="text-right font-medium">
                {[waybill.origin_location, waybill.destination_location].filter(Boolean).join(' → ') || '-'}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Expéditeur</dt>
              <dd>{waybill.sender_name || '-'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Destinataire</dt>
              <dd>{waybill.recipient_name || '-'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Transporteur</dt>
              <dd>{waybill.carrier_name || '-'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Camion / Chauffeur</dt>
              <dd>
                {[waybill.vehicle_plate, waybill.driver_name].filter(Boolean).join(' · ') || '-'}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Sacs / Poids LV</dt>
              <dd>
                {waybill.sack_count ?? '-'} sacs ·{' '}
                {waybill.total_weight_kg != null
                  ? `${Number(waybill.total_weight_kg).toLocaleString('fr-FR')} kg`
                  : '-'}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="flex items-center gap-2 text-lg font-medium">
            <FileText className="h-5 w-5" />
            Document scanné
          </h2>
          {!waybill.document_storage_path && (
            <p className="mt-4 text-sm text-gray-500">Aucun document attaché</p>
          )}
          {documentUrl && waybill.document_mime_type?.startsWith('image/') && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={documentUrl} alt="Lettre de voiture" className="mt-4 max-h-96 rounded border" />
          )}
          {documentUrl && waybill.document_mime_type === 'application/pdf' && (
            <div className="mt-4 h-96 overflow-hidden rounded border">
              <PdfViewer pdfUrl={documentUrl} className="h-full" />
            </div>
          )}
          {documentUrl && (
            <a
              href={documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-sm text-primary-600 hover:underline"
            >
              Ouvrir / télécharger <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">
            Livraisons ({waybill.delivery_count})
          </h2>
          {canEdit && !editDeliveries && (
            <button
              type="button"
              onClick={() => setEditDeliveries(true)}
              className="text-sm font-medium text-primary-600 hover:text-primary-800"
            >
              Modifier les liens
            </button>
          )}
        </div>

        {editDeliveries ? (
          <div className="mt-4 space-y-4">
            {linkError && (
              <p className="text-sm text-red-600">{linkError}</p>
            )}
            <DeliveryPicker
              cooperativeId={waybill.cooperative_id ?? undefined}
              excludedIds={excludedForPicker}
              selectedIds={selectedIds}
              onChange={setSelectedIds}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSaveLinks}
                disabled={saving}
                className="rounded-md bg-primary-600 px-3 py-1.5 text-sm text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditDeliveries(false);
                  setSelectedIds(new Set(waybill.deliveries.map((d) => d.delivery_id)));
                }}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700"
              >
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-gray-100">
            {waybill.deliveries.length === 0 && (
              <li className="py-3 text-sm text-gray-500">Aucune livraison liée</li>
            )}
            {waybill.deliveries.map((link) => (
              <li key={link.id} className="flex items-center justify-between py-3">
                <div>
                  <Link
                    href={`/deliveries/${link.delivery_id}`}
                    className="font-medium text-primary-600 hover:underline"
                  >
                    {link.delivery?.code || link.delivery_id}
                  </Link>
                  <p className="text-xs text-gray-500">
                    {link.delivery?.planteur?.name} ·{' '}
                    {link.delivery?.weight_kg != null
                      ? `${Number(link.delivery.weight_kg).toLocaleString('fr-FR')} kg`
                      : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
