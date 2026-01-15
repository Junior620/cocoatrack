'use client';

// CocoaTrack V2 - Client Detail Page
// Shows client info, contracts, and shipments

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Building2, 
  Globe, 
  Mail, 
  Phone, 
  Edit,
  FileText,
  Package,
  Plus,
  RefreshCw,
  CheckCircle,
  Clock,
  TrendingUp,
  Truck,
} from 'lucide-react';
import { clientsApi, type ClientWithStats, type ClientContract, type ClientShipment } from '@/lib/api/clients';
import { CONTRACT_STATUS_LABELS, SHIPMENT_STATUS_LABELS } from '@/lib/validations/client';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ClientDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const [client, setClient] = useState<ClientWithStats | null>(null);
  const [contracts, setContracts] = useState<ClientContract[]>([]);
  const [shipments, setShipments] = useState<ClientShipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'contracts' | 'shipments'>('contracts');

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [clientData, contractsData, shipmentsData] = await Promise.all([
        clientsApi.getClientWithStats(id),
        clientsApi.getContracts({ client_id: id }),
        clientsApi.getShipments({ client_id: id }),
      ]);

      if (!clientData) {
        setError('Client non trouvé');
        return;
      }

      setClient(clientData);
      setContracts(contractsData);
      setShipments(shipmentsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'delivered':
        return 'bg-green-100 text-green-700';
      case 'completed':
        return 'bg-blue-100 text-blue-700';
      case 'in_transit':
      case 'pending':
        return 'bg-yellow-100 text-yellow-700';
      case 'draft':
        return 'bg-gray-100 text-gray-700';
      case 'cancelled':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="space-y-4">
        <Link
          href="/clients"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour aux clients
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
          {error || 'Client non trouvé'}
        </div>
      </div>
    );
  }

  const pctCompleted = client.total_contracted_kg > 0
    ? Math.round((client.total_shipped_kg / client.total_contracted_kg) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link
            href="/clients"
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary-100 rounded-xl">
              <Building2 className="h-8 w-8 text-primary-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
              <p className="text-gray-500">{client.code}</p>
            </div>
          </div>
        </div>

        <Link
          href={`/clients/${id}/edit`}
          className="inline-flex items-center gap-2 px-4 py-2 text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
        >
          <Edit className="h-4 w-4" />
          Modifier
        </Link>
      </div>

      {/* Info & Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Client Info */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-900 mb-4">Informations</h2>
          <div className="space-y-3 text-sm">
            {(client.country || client.city) && (
              <div className="flex items-center gap-3 text-gray-600">
                <Globe className="h-4 w-4 text-gray-400" />
                {[client.city, client.country].filter(Boolean).join(', ')}
              </div>
            )}
            {client.contact_email && (
              <div className="flex items-center gap-3 text-gray-600">
                <Mail className="h-4 w-4 text-gray-400" />
                {client.contact_email}
              </div>
            )}
            {client.contact_phone && (
              <div className="flex items-center gap-3 text-gray-600">
                <Phone className="h-4 w-4 text-gray-400" />
                {client.contact_phone}
              </div>
            )}
            {client.contact_name && (
              <div className="text-gray-600">
                <span className="text-gray-400">Contact:</span> {client.contact_name}
              </div>
            )}
            {client.notes && (
              <div className="pt-2 border-t border-gray-100 text-gray-600">
                {client.notes}
              </div>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
              <FileText className="h-4 w-4" />
              Contrats
            </div>
            <p className="text-2xl font-bold text-gray-900">{client.contracts_count}</p>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
              <Package className="h-4 w-4" />
              Contracté
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {client.total_contracted_kg.toLocaleString('fr-FR')}
              <span className="text-sm font-normal text-gray-500 ml-1">kg</span>
            </p>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
              <CheckCircle className="h-4 w-4" />
              Livré
            </div>
            <p className="text-2xl font-bold text-green-600">
              {client.total_shipped_kg.toLocaleString('fr-FR')}
              <span className="text-sm font-normal text-gray-500 ml-1">kg</span>
            </p>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
              <TrendingUp className="h-4 w-4" />
              Progression
            </div>
            <p className="text-2xl font-bold text-primary-600">{pctCompleted}%</p>
            <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary-500 transition-all"
                style={{ width: `${Math.min(100, pctCompleted)}%` }}
              />
            </div>
          </div>
        </div>
      </div>


      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="border-b border-gray-100">
          <div className="flex">
            <button
              onClick={() => setActiveTab('contracts')}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'contracts'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <FileText className="h-4 w-4" />
              Contrats ({contracts.length})
            </button>
            <button
              onClick={() => setActiveTab('shipments')}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'shipments'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Truck className="h-4 w-4" />
              Expéditions ({shipments.length})
            </button>
          </div>
        </div>

        {/* Contracts Tab */}
        {activeTab === 'contracts' && (
          <div>
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-medium text-gray-900">Contrats</h3>
              <Link
                href={`/clients/${id}/contracts/new`}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Nouveau contrat
              </Link>
            </div>

            {contracts.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                Aucun contrat enregistré
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {contracts.map((contract) => (
                  <div key={contract.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{contract.code}</span>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(contract.status)}`}>
                            {CONTRACT_STATUS_LABELS[contract.status]}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          Saison {contract.season} • {contract.cooperative?.name || '-'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">
                          {Number(contract.quantity_contracted_kg).toLocaleString('fr-FR')} kg
                        </p>
                        {contract.price_per_kg && (
                          <p className="text-sm text-gray-500">
                            {Number(contract.price_per_kg).toLocaleString('fr-FR')} FCFA/kg
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(contract.start_date).toLocaleDateString('fr-FR')} - {new Date(contract.end_date).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Shipments Tab */}
        {activeTab === 'shipments' && (
          <div>
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-medium text-gray-900">Expéditions</h3>
              <Link
                href={`/clients/${id}/shipments/new`}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Nouvelle expédition
              </Link>
            </div>

            {shipments.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                Aucune expédition enregistrée
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {shipments.map((shipment) => (
                  <div key={shipment.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{shipment.code}</span>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(shipment.status)}`}>
                            {SHIPMENT_STATUS_LABELS[shipment.status]}
                          </span>
                          <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                            Grade {shipment.quality_grade}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          Contrat: {shipment.contract?.code || '-'} • {shipment.cooperative?.name || '-'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">
                          {Number(shipment.quantity_kg).toLocaleString('fr-FR')} kg
                        </p>
                        <p className="text-sm text-gray-500">
                          {new Date(shipment.shipped_at).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                    </div>
                    {(shipment.transport_mode || shipment.destination_port) && (
                      <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                        {shipment.transport_mode && (
                          <span className="flex items-center gap-1">
                            <Truck className="h-3 w-3" />
                            {shipment.transport_mode}
                          </span>
                        )}
                        {shipment.destination_port && (
                          <span>→ {shipment.destination_port}</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
