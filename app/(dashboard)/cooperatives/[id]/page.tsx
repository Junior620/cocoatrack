'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Building2,
  Users,
  UsersRound,
  Package,
  AlertTriangle,
  ArrowLeft,
  Phone,
  MapPin,
  Edit,
} from 'lucide-react';

import { useAuth } from '@/lib/auth';
import { PageTransition, AnimatedSection } from '@/components/dashboard';
import { CooperativeOperationalHub } from '@/components/cooperatives/CooperativeOperationalHub';
import {
  useCooperativeDetail,
  useCooperativeOperationalSummary,
} from '@/lib/hooks/useCooperatives';

function formatWeight(kg: number | null | undefined): string {
  if (kg === null || kg === undefined) return '-';
  return `${kg.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} kg`;
}

function getLossLevel(percentage: number): { color: string; bgColor: string; label: string } {
  if (percentage <= 5) return { color: 'text-green-700', bgColor: 'bg-green-100', label: 'Faible' };
  if (percentage <= 10) return { color: 'text-orange-700', bgColor: 'bg-orange-100', label: 'Moyen' };
  return { color: 'text-red-700', bgColor: 'bg-red-100', label: 'Élevé' };
}

export default function CooperativeDetailPage() {
  const params = useParams();
  const cooperativeId = params.id as string;
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const canImport =
    user && (user.role === 'manager' || user.role === 'admin' || user.role === 'agent');

  const { data: cooperative, isLoading: detailLoading, error: detailError, refetch } =
    useCooperativeDetail(cooperativeId);
  const { data: operational, isLoading: opLoading } =
    useCooperativeOperationalSummary(cooperativeId);

  if (detailLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="mb-6 h-8 w-48 rounded bg-gray-200" />
          <div className="mb-6 grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-gray-200" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (detailError || !cooperative) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <p className="text-sm text-red-700">
          {detailError instanceof Error ? detailError.message : 'Coopérative non trouvée'}
        </p>
        <Link href="/cooperatives" className="mt-2 text-sm text-red-600 underline">
          Retour à la liste
        </Link>
      </div>
    );
  }

  const lossLevel = getLossLevel(cooperative.pourcentage_pertes);

  return (
    <PageTransition className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/cooperatives"
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{cooperative.name}</h1>
            {cooperative.code && (
              <p className="text-sm text-gray-500">{cooperative.code}</p>
            )}
            {cooperative.region && (
              <p className="text-sm text-gray-500">{cooperative.region}</p>
            )}
          </div>
        </div>
        {isAdmin && (
          <Link
            href="/cooperatives"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Edit className="h-4 w-4" />
            Modifier (liste)
          </Link>
        )}
      </div>

      <AnimatedSection animation="fadeUp" delay={0.1}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{cooperative.nb_planteurs}</p>
                <p className="text-sm text-gray-500">Planteurs</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <UsersRound className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{cooperative.nb_fournisseurs}</p>
                <p className="text-sm text-gray-500">Fournisseurs</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <Package className="h-5 w-5 text-amber-600" />
              <div>
                <p className="text-2xl font-bold">{formatWeight(cooperative.total_decharge_kg)}</p>
                <p className="text-sm text-gray-500">Production</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <AlertTriangle className={`h-5 w-5 ${lossLevel.color}`} />
              <div>
                <p className={`text-2xl font-bold ${lossLevel.color}`}>
                  {cooperative.pourcentage_pertes.toFixed(1)}%
                </p>
                <p className="text-sm text-gray-500">Pertes ({lossLevel.label})</p>
              </div>
            </div>
          </div>
        </div>
      </AnimatedSection>

      <AnimatedSection animation="fadeUp" delay={0.15}>
        <CooperativeOperationalHub
          cooperativeId={cooperativeId}
          cooperativeName={cooperative.name}
          summary={operational ?? null}
          loading={opLoading}
          canImport={!!canImport}
          onImportComplete={() => refetch()}
        />
      </AnimatedSection>

      <div className="grid gap-6 lg:grid-cols-2">
        <AnimatedSection animation="fadeUp" delay={0.2}>
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <Users className="h-5 w-5" />
              Planteurs ({cooperative.planteurs.length})
            </h2>
            {cooperative.planteurs.length === 0 ? (
              <p className="text-sm text-gray-500">Aucun planteur rattaché.</p>
            ) : (
              <ul className="max-h-64 divide-y divide-gray-100 overflow-y-auto">
                {cooperative.planteurs.map((planteur) => (
                  <li key={planteur.id} className="py-3">
                    <Link
                      href={`/planteurs/${planteur.id}`}
                      className="font-medium text-primary-600 hover:text-primary-800"
                    >
                      {planteur.name}
                    </Link>
                    <p className="text-xs text-gray-500">
                      {planteur.code}
                      {planteur.localite ? ` · ${planteur.localite}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </AnimatedSection>

        <AnimatedSection animation="fadeUp" delay={0.25}>
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <UsersRound className="h-5 w-5" />
              Fournisseurs ({cooperative.fournisseurs.length})
            </h2>
            {cooperative.fournisseurs.length === 0 ? (
              <p className="text-sm text-gray-500">Aucun fournisseur rattaché.</p>
            ) : (
              <ul className="max-h-64 divide-y divide-gray-100 overflow-y-auto">
                {cooperative.fournisseurs.map((f) => (
                  <li key={f.id} className="py-3">
                    <Link
                      href={`/chef-planteurs/${f.id}`}
                      className="font-medium text-primary-600 hover:text-primary-800"
                    >
                      {f.name}
                    </Link>
                    <p className="text-xs text-gray-500">{f.code}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </AnimatedSection>
      </div>

      {(cooperative.address || cooperative.phone || cooperative.region) && (
        <AnimatedSection animation="fadeUp" delay={0.3}>
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <Building2 className="h-5 w-5" />
              Informations
            </h2>
            <dl className="grid gap-4 sm:grid-cols-3">
              {cooperative.region && (
                <div>
                  <dt className="text-sm text-gray-500">Région</dt>
                  <dd className="font-medium text-gray-900">{cooperative.region}</dd>
                </div>
              )}
              {cooperative.phone && (
                <div className="flex items-start gap-2">
                  <Phone className="mt-0.5 h-4 w-4 text-gray-400" />
                  <div>
                    <dt className="text-sm text-gray-500">Téléphone</dt>
                    <dd className="font-medium text-gray-900">{cooperative.phone}</dd>
                  </div>
                </div>
              )}
              {cooperative.address && (
                <div className="flex items-start gap-2 sm:col-span-2">
                  <MapPin className="mt-0.5 h-4 w-4 text-gray-400" />
                  <div>
                    <dt className="text-sm text-gray-500">Adresse</dt>
                    <dd className="font-medium text-gray-900">{cooperative.address}</dd>
                  </div>
                </div>
              )}
            </dl>
          </div>
        </AnimatedSection>
      )}
    </PageTransition>
  );
}
