'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  FileText,
  Leaf,
  Loader2,
  MapPin,
  Package,
  RefreshCw,
  Truck,
  User,
} from 'lucide-react';

import { usePlanteurTraceability } from '@/hooks/usePlanteurTraceability';
import type { TraceabilityEventType, TraceabilityTimelineEvent } from '@/types/planteur-traceability';
import { CONFORMITY_STATUS_LABELS } from '@/types/parcelles';

interface PlanteurTraceabilityTabProps {
  planteurId: string;
  planteurName?: string;
}

const EVENT_ICONS: Record<TraceabilityEventType, React.ReactNode> = {
  planteur_created: <User className="h-4 w-4" />,
  parcelle: <MapPin className="h-4 w-4" />,
  delivery: <Truck className="h-4 w-4" />,
  receipt: <FileText className="h-4 w-4" />,
  waybill: <Package className="h-4 w-4" />,
  ndvi: <Leaf className="h-4 w-4" />,
  deforestation: <AlertTriangle className="h-4 w-4" />,
  audit: <FileText className="h-4 w-4" />,
};

const EVENT_COLORS: Record<TraceabilityEventType, string> = {
  planteur_created: 'bg-blue-100 text-blue-700',
  parcelle: 'bg-green-100 text-green-700',
  delivery: 'bg-orange-100 text-orange-700',
  receipt: 'bg-purple-100 text-purple-700',
  waybill: 'bg-indigo-100 text-indigo-700',
  ndvi: 'bg-emerald-100 text-emerald-700',
  deforestation: 'bg-red-100 text-red-700',
  audit: 'bg-gray-100 text-gray-700',
};

function TimelineItem({ event }: { event: TraceabilityTimelineEvent }) {
  const icon = EVENT_ICONS[event.type];
  const color = EVENT_COLORS[event.type];

  const content = (
    <div className="flex gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3 transition hover:bg-white hover:shadow-sm">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${color}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="text-sm font-medium text-gray-900">{event.title}</p>
          <time className="text-xs text-gray-500">
            {new Date(event.date).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </time>
        </div>
        {event.subtitle && <p className="mt-0.5 text-xs text-gray-600">{event.subtitle}</p>}
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
          {event.contractNumber && <span>Contrat {event.contractNumber}</span>}
          {event.volumeKg != null && <span>{event.volumeKg.toLocaleString()} kg</span>}
          {event.amountXaf != null && <span>{event.amountXaf.toLocaleString()} XAF</span>}
          {event.status && (
            <span>
              {event.type === 'parcelle'
                ? CONFORMITY_STATUS_LABELS[event.status as keyof typeof CONFORMITY_STATUS_LABELS] ||
                  event.status
                : event.status}
            </span>
          )}
          {event.source && <span>Source: {event.source}</span>}
          {event.actorName && <span>Par {event.actorName}</span>}
        </div>
      </div>
    </div>
  );

  if (event.link) {
    return (
      <Link href={event.link} className="block">
        {content}
      </Link>
    );
  }
  return content;
}

export function PlanteurTraceabilityTab({ planteurId, planteurName }: PlanteurTraceabilityTabProps) {
  const { data, isLoading, error, refetch, isFetching } = usePlanteurTraceability(planteurId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-gray-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Chargement de la traçabilité…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <p className="text-sm text-red-700">
          {error instanceof Error ? error.message : 'Erreur de chargement'}
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-2 text-sm text-red-600 underline"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Planteur 360</h2>
          <p className="mt-1 text-sm text-gray-500">
            Traçabilité unifiée{planteurName ? ` · ${planteurName}` : ''}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Créé le {new Date(data.planteur.created_at).toLocaleDateString('fr-FR')}
            {data.planteur.created_by_name ? ` · ${data.planteur.created_by_name}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Rafraîchir
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Parcelles', value: data.stats.parcelles },
          { label: 'Livraisons', value: data.stats.deliveries },
          { label: 'Reçus', value: data.stats.receipts },
          { label: 'Poids total', value: `${data.stats.totalWeightKg.toLocaleString()} kg` },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className="text-lg font-semibold text-gray-900">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Chaîne simplifiée */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-gray-900">Chaîne de traçabilité</h3>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          {data.chain.nodes.map((node, i) => (
            <span key={node.id} className="inline-flex items-center gap-2">
              {i > 0 && <span className="text-gray-300">→</span>}
              <span className="rounded-full bg-primary-50 px-3 py-1 font-medium text-primary-800">
                {node.label}
                {node.count != null ? ` (${node.count})` : ''}
              </span>
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Timeline */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Timeline</h3>
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {data.timeline.length === 0 ? (
              <p className="text-sm text-gray-500">Aucun événement.</p>
            ) : (
              data.timeline.map((event) => <TimelineItem key={event.id} event={event} />)
            )}
          </div>
        </div>

        {/* Analyses */}
        <div className="space-y-4">
          <div>
            <h3 className="mb-3 text-sm font-semibold text-gray-900">Analyses NDVI</h3>
            {data.ndviSummary.length === 0 ? (
              <p className="text-sm text-gray-500">Aucune analyse NDVI.</p>
            ) : (
              <div className="space-y-2">
                {data.ndviSummary.slice(0, 8).map((n) => (
                  <Link
                    key={n.parcelleId}
                    href={`/parcelles/${n.parcelleId}`}
                    className="flex items-center justify-between rounded-lg bg-gray-50 p-3 hover:bg-white hover:shadow-sm"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{n.parcelleCode}</p>
                      <p className="text-xs text-gray-500">{n.healthStatus}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{n.meanNDVI.toFixed(3)}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(n.lastCalculationDate).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-gray-900">Alertes déforestation</h3>
            {data.deforestationSummary.length === 0 ? (
              <p className="text-sm text-gray-500">Aucune alerte.</p>
            ) : (
              <div className="space-y-2">
                {data.deforestationSummary.slice(0, 8).map((d) => (
                  <Link
                    key={`${d.parcelleId}-${d.detectionDate}`}
                    href={`/parcelles/${d.parcelleId}`}
                    className="flex items-center justify-between rounded-lg bg-red-50 p-3 hover:bg-red-100/50"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{d.parcelleCode}</p>
                      <p className="text-xs text-red-700">{d.status}</p>
                    </div>
                    <p className="text-xs text-gray-500">
                      {new Date(d.detectionDate).toLocaleDateString('fr-FR')}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
