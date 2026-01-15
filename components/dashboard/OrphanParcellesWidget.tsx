'use client';

// CocoaTrack V2 - Orphan Parcelles Widget
// Dashboard widget showing count of orphan parcelles with link to parcelles view
// @see Requirements 6.4

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { MapPin, AlertTriangle, ChevronRight, CheckCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface OrphanParcellesStats {
  orphan_count: number;
  orphan_surface_ha: number;
}

interface OrphanParcellesWidgetProps {
  cooperativeId?: string;
}

function WidgetSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 bg-gray-200 rounded-xl" />
        <div className="flex-1">
          <div className="h-4 w-24 bg-gray-200 rounded mb-2" />
          <div className="h-3 w-32 bg-gray-200 rounded" />
        </div>
      </div>
    </div>
  );
}

export function OrphanParcellesWidget({ cooperativeId }: OrphanParcellesWidgetProps) {
  const [stats, setStats] = useState<OrphanParcellesStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOrphanStats() {
      const supabase = createClient();

      try {
        // Query for orphan parcelles (planteur_id IS NULL)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error: queryError } = await (supabase as any)
          .from('parcelles')
          .select('surface_hectares')
          .eq('is_active', true)
          .is('planteur_id', null);

        if (queryError) {
          throw new Error(queryError.message);
        }

        const typedData = (data || []) as Array<{ surface_hectares: number | null }>;
        const orphanCount = typedData.length;
        const orphanSurface = typedData.reduce(
          (sum, p) => sum + (Number(p.surface_hectares) || 0),
          0
        );

        setStats({
          orphan_count: orphanCount,
          orphan_surface_ha: Math.round(orphanSurface * 100) / 100,
        });
      } catch (err) {
        console.error('Error fetching orphan parcelles stats:', err);
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
      } finally {
        setLoading(false);
      }
    }

    fetchOrphanStats();
  }, [cooperativeId]);

  // Don't render anything if loading
  if (loading) {
    return (
      <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
        <WidgetSkeleton />
      </div>
    );
  }

  // Don't render if error or no orphan parcelles
  if (error || !stats || stats.orphan_count === 0) {
    return null;
  }

  // Render widget only if orphan_count > 0
  return (
    <Link href="/parcelles?view=by-planteur">
      <div className="rounded-xl bg-amber-50 p-4 shadow-sm border border-amber-200 hover:shadow-md transition-all cursor-pointer group">
        <div className="flex items-center gap-4">
          {/* Icon */}
          <div className="p-3 rounded-xl bg-amber-100">
            <MapPin className="h-6 w-6 text-amber-600" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-semibold text-amber-800">
                Parcelles non assignées
              </span>
            </div>
            <p className="text-xs text-amber-700 mt-1">
              {stats.orphan_count} parcelle{stats.orphan_count > 1 ? 's' : ''} ({stats.orphan_surface_ha.toFixed(1)} ha) sans planteur
            </p>
          </div>

          {/* Arrow */}
          <ChevronRight className="h-5 w-5 text-amber-400 group-hover:text-amber-600 transition-colors" />
        </div>
      </div>
    </Link>
  );
}
