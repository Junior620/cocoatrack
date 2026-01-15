'use client';

// CocoaTrack V2 - Delivery Detail Page
// Displays delivery details with photos

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { useAuth, hasPermission } from '@/lib/auth';
import { deliveriesApi } from '@/lib/api/deliveries';
import type { DeliveryWithRelations, UpdateDeliveryInput } from '@/lib/validations/delivery';
import type { QualityGrade, PaymentStatus } from '@/types';

export default function DeliveryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const deliveryId = params.id as string;

  const [delivery, setDelivery] = useState<DeliveryWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const canEdit = user && hasPermission(user.role, 'deliveries:update');

  // Fetch delivery
  const fetchDelivery = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await deliveriesApi.get(deliveryId);
      if (!result) {
        setError('Livraison non trouvée');
      } else {
        setDelivery(result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch delivery');
    } finally {
      setLoading(false);
    }
  }, [deliveryId]);

  useEffect(() => {
    fetchDelivery();
  }, [fetchDelivery]);

  // Handle update
  const handleUpdate = async (data: UpdateDeliveryInput) => {
    setSaving(true);
    setError(null);
    try {
      const updated = await deliveriesApi.update(deliveryId, data);
      setDelivery({ ...delivery!, ...updated });
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update delivery');
    } finally {
      setSaving(false);
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' XAF';
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get payment status badge color
  const getPaymentStatusColor = (status: PaymentStatus) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'partial':
        return 'bg-yellow-100 text-yellow-800';
      case 'pending':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Get quality grade badge color
  const getQualityGradeColor = (grade: QualityGrade) => {
    switch (grade) {
      case 'A':
        return 'bg-green-100 text-green-800';
      case 'B':
        return 'bg-blue-100 text-blue-800';
      case 'C':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 w-1/4 rounded bg-gray-200" />
          <div className="mt-4 h-64 rounded bg-gray-200" />
        </div>
      </div>
    );
  }

  if (error || !delivery) {
    return (
      <div className="space-y-6">
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">{error || 'Livraison non trouvée'}</p>
        </div>
        <Link
          href="/deliveries"
          className="text-primary-600 hover:text-primary-900"
        >
          ← Retour aux livraisons
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/deliveries"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Retour aux livraisons
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">
            Livraison {delivery.code}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Créée le {formatDate(delivery.created_at)}
          </p>
        </div>
        {canEdit && !isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="inline-flex items-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            Modifier
          </button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Main content */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Delivery details */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="text-lg font-medium text-gray-900">Détails de la livraison</h2>
          
          <dl className="mt-4 space-y-4">
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Date de livraison</dt>
              <dd className="text-sm font-medium text-gray-900">
                {formatDate(delivery.delivered_at)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Poids</dt>
              <dd className="text-sm font-medium text-gray-900">
                {Number(delivery.weight_kg).toFixed(2)} kg
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Prix par kg</dt>
              <dd className="text-sm font-medium text-gray-900">
                {formatCurrency(Number(delivery.price_per_kg))}
              </dd>
            </div>
            <div className="flex justify-between border-t pt-4">
              <dt className="text-sm font-medium text-gray-900">Total</dt>
              <dd className="text-lg font-bold text-primary-600">
                {formatCurrency(Number(delivery.total_amount))}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Qualité</dt>
              <dd>
                <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getQualityGradeColor(delivery.quality_grade)}`}>
                  Grade {delivery.quality_grade}
                </span>
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Statut paiement</dt>
              <dd>
                <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getPaymentStatusColor(delivery.payment_status)}`}>
                  {delivery.payment_status === 'paid' ? 'Payé' : 
                   delivery.payment_status === 'partial' ? 'Partiel' : 'En attente'}
                </span>
              </dd>
            </div>
            {delivery.payment_amount_paid > 0 && (
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Montant payé</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {formatCurrency(Number(delivery.payment_amount_paid))}
                </dd>
              </div>
            )}
            {delivery.notes && (
              <div className="border-t pt-4">
                <dt className="text-sm text-gray-500">Notes</dt>
                <dd className="mt-1 text-sm text-gray-900">{delivery.notes}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Related entities */}
        <div className="space-y-6">
          {/* Planteur */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="text-lg font-medium text-gray-900">Planteur</h2>
            {delivery.planteur ? (
              <div className="mt-4">
                <p className="font-medium text-gray-900">{delivery.planteur.name}</p>
                <p className="text-sm text-gray-500">Code: {delivery.planteur.code}</p>
                <Link
                  href={`/planteurs/${delivery.planteur_id}`}
                  className="mt-2 inline-block text-sm text-primary-600 hover:text-primary-900"
                >
                  Voir le planteur →
                </Link>
              </div>
            ) : (
              <p className="mt-4 text-sm text-gray-500">-</p>
            )}
          </div>

          {/* Chef Planteur */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="text-lg font-medium text-gray-900">Chef Planteur</h2>
            {delivery.chef_planteur ? (
              <div className="mt-4">
                <p className="font-medium text-gray-900">{delivery.chef_planteur.name}</p>
                <p className="text-sm text-gray-500">Code: {delivery.chef_planteur.code}</p>
                <Link
                  href={`/chef-planteurs/${delivery.chef_planteur_id}`}
                  className="mt-2 inline-block text-sm text-primary-600 hover:text-primary-900"
                >
                  Voir le chef planteur →
                </Link>
              </div>
            ) : (
              <p className="mt-4 text-sm text-gray-500">-</p>
            )}
          </div>

          {/* Warehouse */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="text-lg font-medium text-gray-900">Entrepôt</h2>
            {delivery.warehouse ? (
              <div className="mt-4">
                <p className="font-medium text-gray-900">{delivery.warehouse.name}</p>
                <p className="text-sm text-gray-500">Code: {delivery.warehouse.code}</p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-gray-500">-</p>
            )}
          </div>
        </div>
      </div>

      {/* Photos section */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="text-lg font-medium text-gray-900">Photos</h2>
        {delivery.photos && delivery.photos.length > 0 ? (
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {delivery.photos.map((photo) => (
              <div key={photo.id} className="relative aspect-square overflow-hidden rounded-lg bg-gray-100">
                {/* Photo will be loaded via signed URL */}
                <div className="flex h-full items-center justify-center text-sm text-gray-500">
                  {photo.file_name}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-gray-500">Aucune photo</p>
        )}
      </div>

      {/* Edit modal */}
      {isEditing && (
        <EditDeliveryModal
          delivery={delivery}
          onSave={handleUpdate}
          onCancel={() => setIsEditing(false)}
          saving={saving}
        />
      )}
    </div>
  );
}

// Edit modal component
function EditDeliveryModal({
  delivery,
  onSave,
  onCancel,
  saving,
}: {
  delivery: DeliveryWithRelations;
  onSave: (data: UpdateDeliveryInput) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [formData, setFormData] = useState<UpdateDeliveryInput>({
    weight_kg: Number(delivery.weight_kg),
    price_per_kg: Number(delivery.price_per_kg),
    quality_grade: delivery.quality_grade,
    payment_status: delivery.payment_status,
    payment_amount_paid: Number(delivery.payment_amount_paid),
    notes: delivery.notes || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-lg font-medium text-gray-900">Modifier la livraison</h2>
        
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Poids (kg)</label>
            <input
              type="number"
              step="0.01"
              value={formData.weight_kg}
              onChange={(e) => setFormData({ ...formData, weight_kg: parseFloat(e.target.value) })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Prix par kg (XAF)</label>
            <input
              type="number"
              step="0.01"
              value={formData.price_per_kg}
              onChange={(e) => setFormData({ ...formData, price_per_kg: parseFloat(e.target.value) })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Qualité</label>
            <select
              value={formData.quality_grade}
              onChange={(e) => setFormData({ ...formData, quality_grade: e.target.value as QualityGrade })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="A">Grade A</option>
              <option value="B">Grade B</option>
              <option value="C">Grade C</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Statut paiement</label>
            <select
              value={formData.payment_status}
              onChange={(e) => setFormData({ ...formData, payment_status: e.target.value as PaymentStatus })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="pending">En attente</option>
              <option value="partial">Partiel</option>
              <option value="paid">Payé</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
