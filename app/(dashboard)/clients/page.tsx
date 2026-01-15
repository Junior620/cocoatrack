'use client';

// CocoaTrack V2 - Clients List Page
// List all clients with search and filters

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { 
  Building2, 
  Plus, 
  Search, 
  Globe,
  Mail,
  Phone,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { clientsApi, type Client } from '@/lib/api/clients';

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  useEffect(() => {
    loadClients();
  }, [showInactive]);

  const loadClients = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await clientsApi.getClients({
        is_active: showInactive ? undefined : true,
      });
      setClients(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = useMemo(() => {
    if (!searchQuery) return clients;
    const query = searchQuery.toLowerCase();
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.code.toLowerCase().includes(query) ||
        (c.country && c.country.toLowerCase().includes(query)) ||
        (c.city && c.city.toLowerCase().includes(query))
    );
  }, [clients, searchQuery]);

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce client ?')) return;
    
    try {
      await clientsApi.deleteClient(id);
      setClients((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    }
  };

  if (loading && clients.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-500 mt-1">
            Gestion des clients finaux et acheteurs
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/clients/recap"
            className="inline-flex items-center gap-2 px-4 py-2 text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
          >
            <Eye className="h-4 w-4" />
            Récap Clients
          </Link>
          <Link
            href="/clients/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nouveau Client
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par nom, code, pays..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            Afficher les inactifs
          </label>

          <button
            onClick={loadClients}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClients.length === 0 ? (
          <div className="col-span-full bg-white rounded-xl p-12 text-center text-gray-500">
            {searchQuery ? 'Aucun client trouvé' : 'Aucun client enregistré'}
          </div>
        ) : (
          filteredClients.map((client) => (
            <div
              key={client.id}
              className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary-50 rounded-lg">
                    <Building2 className="h-5 w-5 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{client.name}</h3>
                    <p className="text-sm text-gray-500">{client.code}</p>
                  </div>
                </div>

                {/* Status & Menu */}
                <div className="flex items-center gap-2">
                  {client.is_active ? (
                    <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                      <CheckCircle className="h-3 w-3" />
                      Actif
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                      <XCircle className="h-3 w-3" />
                      Inactif
                    </span>
                  )}

                  <div className="relative">
                    <button
                      onClick={() => setOpenMenu(openMenu === client.id ? null : client.id)}
                      className="p-1 text-gray-400 hover:text-gray-600 rounded"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>

                    {openMenu === client.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
                        <div className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-100 z-20 py-1">
                          <Link
                            href={`/clients/${client.id}`}
                            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <Eye className="h-4 w-4" />
                            Voir détails
                          </Link>
                          <Link
                            href={`/clients/${client.id}/edit`}
                            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <Edit className="h-4 w-4" />
                            Modifier
                          </Link>
                          <button
                            onClick={() => {
                              setOpenMenu(null);
                              handleDelete(client.id);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                            Supprimer
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="mt-4 space-y-2 text-sm">
                {(client.country || client.city) && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Globe className="h-4 w-4 text-gray-400" />
                    {[client.city, client.country].filter(Boolean).join(', ')}
                  </div>
                )}
                {client.contact_email && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Mail className="h-4 w-4 text-gray-400" />
                    {client.contact_email}
                  </div>
                )}
                {client.contact_phone && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone className="h-4 w-4 text-gray-400" />
                    {client.contact_phone}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <Link
                  href={`/clients/${client.id}`}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  Voir les contrats →
                </Link>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Summary */}
      {filteredClients.length > 0 && (
        <div className="text-sm text-gray-500 text-center">
          {filteredClients.length} client{filteredClients.length > 1 ? 's' : ''} affiché{filteredClients.length > 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
