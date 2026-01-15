'use client';

// CocoaTrack V2 - Cooperative Detail Page
// Shows cooperative details with members list and stats

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { 
  Building2, 
  Users, 
  UsersRound, 
  Package, 
  AlertTriangle,
  ArrowLeft,
  Phone,
  MapPin,
} from 'lucide-react';

import { cooperativesApi, type CooperativeDetail } from '@/lib/api/cooperatives';
import { PageTransition, AnimatedSection } from '@/components/dashboard';

// Format weight with locale
function formatWeight(kg: number | null | undefined): string {
  if (kg === null || kg === undefined) return '-';
  return `${kg.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} kg`;
}

// Get loss level color
function getLossLevel(percentage: number): { color: string; bgColor: string; label: string } {
  if (percentage <= 5) {
    return { color: 'text-green-700', bgColor: 'bg-green-100', label: 'Faible' };
  } else if (percentage <= 10) {
    return { color: 'text-orange-700', bgColor: 'bg-orange-100', label: 'Moyen' };
  } else {
    return { color: 'text-red-700', bgColor: 'bg-red-100', label: 'Élevé' };
  }
}

export default function CooperativeDetailPage() {
  const params = useParams();
  const cooperativeId = params.id as string;

  const [cooperative, setCooperative] = useState<CooperativeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await cooperativesApi.getDetail(cooperativeId);
      setCooperative(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec du chargement');
    } finally {
      setLoading(false);
    }
  }, [cooperativeId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-gray-200 rounded mb-6" />
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-xl" />
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !cooperative) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 p-6">
        <p className="text-sm text-red-700">{error || 'Coopérative non trouvée'}</p>
        <Link href="/cooperatives" className="mt-2 text-sm text-red-600 underline">
          Retour à la liste
        </Link>
      </div>
    );
  }

  const lossLevel = getLossLevel(cooperative.pourcentage_pertes);

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link 
          href="/cooperatives" 
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-gray-500" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 rounded-xl">
            <Building2 className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{cooperative.name}</h1>
            {cooperative.code && (
              <p className="text-sm text-gray-500">{cooperative.code}</p>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <AnimatedSection animation="fadeUp" delay={0.1}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Users className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{cooperative.nb_planteurs}</p>
                <p className="text-xs text-gray-500">Planteurs</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <UsersRound className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{cooperative.nb_fournisseurs}</p>
                <p className="text-xs text-gray-500">Fournisseurs</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Package className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{formatWeight(cooperative.total_decharge_kg)}</p>
                <p className="text-xs text-gray-500">Production</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${lossLevel.bgColor}`}>
                <AlertTriangle className={`h-5 w-5 ${lossLevel.color}`} />
              </div>
              <div>
                <p className={`text-2xl font-bold ${lossLevel.color}`}>
                  {cooperative.pourcentage_pertes.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500">Pertes</p>
              </div>
            </div>
          </div>
        </div>
      </AnimatedSection>

      {/* Members Lists */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Planteurs List */}
        <AnimatedSection animation="fadeUp" delay={0.2}>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
              <h2 className="flex items-center gap-2 font-semibold text-gray-900">
                <Users className="h-5 w-5 text-green-600" />
                Planteurs ({cooperative.planteurs.length})
              </h2>
            </div>
            <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
              {cooperative.planteurs.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  Aucun planteur dans cette coopérative
                </div>
              ) : (
                cooperative.planteurs.map((planteur) => (
                  <Link
                    key={planteur.id}
                    href={`/planteurs/${planteur.id}`}
                    className="block px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{planteur.name}</p>
                        <p className="text-xs text-gray-500">{planteur.code}</p>
                      </div>
                      <div className="text-right text-sm">
                        {planteur.phone && (
                          <div className="flex items-center gap-1 text-gray-500">
                            <Phone className="h-3 w-3" />
                            {planteur.phone}
                          </div>
                        )}
                        {planteur.localite && (
                          <div className="flex items-center gap-1 text-gray-400 text-xs">
                            <MapPin className="h-3 w-3" />
                            {planteur.localite}
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </AnimatedSection>

        {/* Fournisseurs List */}
        <AnimatedSection animation="fadeUp" delay={0.25}>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
              <h2 className="flex items-center gap-2 font-semibold text-gray-900">
                <UsersRound className="h-5 w-5 text-purple-600" />
                Fournisseurs ({cooperative.fournisseurs.length})
              </h2>
            </div>
            <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
              {cooperative.fournisseurs.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  Aucun fournisseur dans cette coopérative
                </div>
              ) : (
                cooperative.fournisseurs.map((fournisseur) => (
                  <Link
                    key={fournisseur.id}
                    href={`/chef-planteurs/${fournisseur.id}`}
                    className="block px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{fournisseur.name}</p>
                        <p className="text-xs text-gray-500">{fournisseur.code}</p>
                      </div>
                      <div className="text-right text-sm">
                        {fournisseur.phone && (
                          <div className="flex items-center gap-1 text-gray-500">
                            <Phone className="h-3 w-3" />
                            {fournisseur.phone}
                          </div>
                        )}
                        {fournisseur.localite && (
                          <div className="flex items-center gap-1 text-gray-400 text-xs">
                            <MapPin className="h-3 w-3" />
                            {fournisseur.localite}
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </AnimatedSection>
      </div>

      {/* Additional Info */}
      {(cooperative.address || cooperative.phone || cooperative.region) && (
        <AnimatedSection animation="fadeUp" delay={0.3}>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h2 className="font-semibold text-gray-900 mb-4">Informations</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {cooperative.region && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Région</p>
                  <p className="font-medium text-gray-900">{cooperative.region}</p>
                </div>
              )}
              {cooperative.phone && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Téléphone</p>
                  <p className="font-medium text-gray-900">{cooperative.phone}</p>
                </div>
              )}
              {cooperative.address && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Adresse</p>
                  <p className="font-medium text-gray-900">{cooperative.address}</p>
                </div>
              )}
            </div>
          </div>
        </AnimatedSection>
      )}
    </PageTransition>
  );
}
