'use client';

// CocoaTrack V2 - Alerts Widget (Enhanced with real data)
// Shows important alerts from planteurs and chef_planteurs

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { 
  AlertTriangle, 
  Clock, 
  FileWarning, 
  TrendingDown, 
  ChevronRight, 
  CheckCircle,
  Users,
  Scale,
  Calendar
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Alert {
  id: string;
  type: 'warning' | 'danger' | 'info';
  title: string;
  description: string;
  href?: string;
  count?: number;
  icon?: React.ReactNode;
}

interface AlertsWidgetProps {
  loading?: boolean;
  cooperativeId?: string;
}

const alertStyles = {
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-500',
  },
  danger: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    iconBg: 'bg-red-100',
    iconColor: 'text-red-500',
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-500',
  },
};

function AlertsSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="animate-pulse flex items-start gap-3 p-3 rounded-lg bg-gray-50">
          <div className="h-10 w-10 bg-gray-200 rounded-lg" />
          <div className="flex-1">
            <div className="h-4 w-32 bg-gray-200 rounded mb-2" />
            <div className="h-3 w-48 bg-gray-200 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyAlerts() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="p-3 rounded-full bg-emerald-100 mb-3">
        <CheckCircle className="h-8 w-8 text-emerald-600" />
      </div>
      <p className="text-sm font-medium text-gray-900">Tout est en ordre !</p>
      <p className="text-xs text-gray-500 mt-1">Aucune alerte pour le moment</p>
    </div>
  );
}

export function AlertsWidget({ loading: externalLoading = false, cooperativeId }: AlertsWidgetProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAlerts() {
      const supabase = createClient();
      const newAlerts: Alert[] = [];

      try {
        // 1. Check for pending chef_planteurs validations
        let pendingQuery = supabase
          .from('chef_planteurs')
          .select('id', { count: 'exact', head: true })
          .eq('validation_status', 'pending');
        
        if (cooperativeId) {
          pendingQuery = pendingQuery.eq('cooperative_id', cooperativeId);
        }
        
        const { count: pendingCount } = await pendingQuery;
        
        if (pendingCount && pendingCount > 0) {
          newAlerts.push({
            id: 'pending-validations',
            type: 'info',
            title: 'Validations en attente',
            description: `${pendingCount} fournisseur${pendingCount > 1 ? 's' : ''} en attente de validation`,
            href: '/chef-planteurs?validation_status=pending',
            count: pendingCount,
            icon: <Clock className="h-5 w-5" />,
          });
        }

        // 2. Check for expiring contracts (next 30 days)
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        const today = new Date().toISOString().split('T')[0];
        const futureDate = thirtyDaysFromNow.toISOString().split('T')[0];

        let expiringQuery = supabase
          .from('chef_planteurs')
          .select('id', { count: 'exact', head: true })
          .eq('validation_status', 'validated')
          .gte('contract_end', today)
          .lte('contract_end', futureDate);
        
        if (cooperativeId) {
          expiringQuery = expiringQuery.eq('cooperative_id', cooperativeId);
        }
        
        const { count: expiringCount } = await expiringQuery;
        
        if (expiringCount && expiringCount > 0) {
          newAlerts.push({
            id: 'expiring-contracts',
            type: 'warning',
            title: 'Contrats expirant bientôt',
            description: `${expiringCount} contrat${expiringCount > 1 ? 's' : ''} expire${expiringCount > 1 ? 'nt' : ''} dans les 30 prochains jours`,
            href: '/chef-planteurs',
            count: expiringCount,
            icon: <Calendar className="h-5 w-5" />,
          });
        }

        // 3. Try to check for capacity alerts using the view (if available)
        try {
          // Check chef_planteurs near capacity (>90%)
          let capacityQuery = supabase
            .from('chef_planteurs_with_stats')
            .select('id', { count: 'exact', head: true })
            .gte('pourcentage_utilise', 90);
          
          if (cooperativeId) {
            capacityQuery = capacityQuery.eq('cooperative_id', cooperativeId);
          }
          
          const { count: capacityCount, error: capacityError } = await capacityQuery;
          
          if (!capacityError && capacityCount && capacityCount > 0) {
            newAlerts.push({
              id: 'capacity-alerts',
              type: 'danger',
              title: 'Capacité critique',
              description: `${capacityCount} fournisseur${capacityCount > 1 ? 's' : ''} à plus de 90% de capacité`,
              href: '/chef-planteurs',
              count: capacityCount,
              icon: <Scale className="h-5 w-5" />,
            });
          }

          // Check planteurs with high losses (>10%)
          let lossesQuery = supabase
            .from('planteurs_with_stats')
            .select('id', { count: 'exact', head: true })
            .gt('pourcentage_pertes', 10);
          
          if (cooperativeId) {
            lossesQuery = lossesQuery.eq('cooperative_id', cooperativeId);
          }
          
          const { count: lossesCount, error: lossesError } = await lossesQuery;
          
          if (!lossesError && lossesCount && lossesCount > 0) {
            newAlerts.push({
              id: 'high-losses',
              type: 'danger',
              title: 'Pertes élevées',
              description: `${lossesCount} planteur${lossesCount > 1 ? 's' : ''} avec plus de 10% de pertes`,
              href: '/planteurs',
              count: lossesCount,
              icon: <TrendingDown className="h-5 w-5" />,
            });
          }

          // Check planteurs near production limit (>90%)
          let limitQuery = supabase
            .from('planteurs_with_stats')
            .select('id', { count: 'exact', head: true })
            .gte('pourcentage_utilise', 90);
          
          if (cooperativeId) {
            limitQuery = limitQuery.eq('cooperative_id', cooperativeId);
          }
          
          const { count: limitCount, error: limitError } = await limitQuery;
          
          if (!limitError && limitCount && limitCount > 0) {
            newAlerts.push({
              id: 'production-limit',
              type: 'warning',
              title: 'Limite de production',
              description: `${limitCount} planteur${limitCount > 1 ? 's' : ''} proche${limitCount > 1 ? 's' : ''} de la limite`,
              href: '/planteurs',
              count: limitCount,
              icon: <AlertTriangle className="h-5 w-5" />,
            });
          }
        } catch (viewError) {
          // Views might not exist yet, skip these alerts
          console.warn('Stats views not available for alerts');
        }

        // 4. Check for inactive planteurs
        let inactiveQuery = supabase
          .from('planteurs')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', false);
        
        if (cooperativeId) {
          inactiveQuery = inactiveQuery.eq('cooperative_id', cooperativeId);
        }
        
        const { count: inactiveCount } = await inactiveQuery;
        
        if (inactiveCount && inactiveCount > 5) {
          newAlerts.push({
            id: 'inactive-planteurs',
            type: 'info',
            title: 'Planteurs inactifs',
            description: `${inactiveCount} planteur${inactiveCount > 1 ? 's' : ''} marqué${inactiveCount > 1 ? 's' : ''} comme inactif${inactiveCount > 1 ? 's' : ''}`,
            href: '/planteurs?is_active=false',
            count: inactiveCount,
            icon: <Users className="h-5 w-5" />,
          });
        }

        // Sort alerts by severity (danger first, then warning, then info)
        const severityOrder = { danger: 0, warning: 1, info: 2 };
        newAlerts.sort((a, b) => severityOrder[a.type] - severityOrder[b.type]);

        setAlerts(newAlerts);
      } catch (error) {
        console.error('Error fetching alerts:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchAlerts();
  }, [cooperativeId]);

  const isLoading = loading || externalLoading;

  if (isLoading) {
    return (
      <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Alertes & Rappels</h3>
        <AlertsSkeleton />
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Alertes & Rappels</h3>
        {alerts.length > 0 && (
          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
            alerts.some(a => a.type === 'danger') 
              ? 'bg-red-100 text-red-600' 
              : alerts.some(a => a.type === 'warning')
              ? 'bg-amber-100 text-amber-600'
              : 'bg-blue-100 text-blue-600'
          }`}>
            {alerts.length}
          </span>
        )}
      </div>

      {alerts.length === 0 ? (
        <EmptyAlerts />
      ) : (
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {alerts.map((alert) => {
            const style = alertStyles[alert.type];
            const content = (
              <div className={`flex items-start gap-3 p-3 rounded-xl ${style.bg} border ${style.border} transition-all hover:shadow-sm`}>
                <div className={`p-2 rounded-lg ${style.iconBg}`}>
                  <span className={style.iconColor}>
                    {alert.icon || <AlertTriangle className="h-5 w-5" />}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">{alert.title}</p>
                    {alert.count && (
                      <span className="px-1.5 py-0.5 text-xs font-semibold bg-white/80 text-gray-700 rounded">
                        {alert.count}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">{alert.description}</p>
                </div>
                {alert.href && (
                  <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
                )}
              </div>
            );

            return alert.href ? (
              <Link key={alert.id} href={alert.href}>
                {content}
              </Link>
            ) : (
              <div key={alert.id}>{content}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
