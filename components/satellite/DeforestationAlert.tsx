'use client';

import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Calendar, TrendingDown, MapPin, X } from 'lucide-react';
import type { DeforestationEvent } from '@/lib/satellite/types';

interface DeforestationAlertProps {
  alert: DeforestationEvent;
  onAcknowledge?: (alertId: string, notes: string) => void;
  onDispute?: (alertId: string, reason: string) => void;
  className?: string;
}

/**
 * DeforestationAlert Component
 * 
 * Displays deforestation alerts with before/after comparison and action buttons.
 * Allows users to acknowledge or dispute detected deforestation events.
 * 
 * Features:
 * - Alert details (date, area, NDVI change)
 * - Before/after imagery comparison
 * - Acknowledge and dispute actions
 * - Modal for acknowledgment notes
 * 
 * Requirements: 4.4, 4.5, 4.6, 4.7
 */
export default function DeforestationAlert({
  alert,
  onAcknowledge,
  onDispute,
  className = '',
}: DeforestationAlertProps) {
  const [showAcknowledgeModal, setShowAcknowledgeModal] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Status color mapping
  const statusColors = {
    pending: 'border-amber-300 bg-amber-50',
    acknowledged: 'border-green-300 bg-green-50',
    disputed: 'border-red-300 bg-red-50',
    resolved: 'border-gray-300 bg-gray-50',
  };

  // Status icon mapping
  const getStatusIcon = () => {
    switch (alert.status) {
      case 'acknowledged':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'disputed':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'resolved':
        return <CheckCircle className="h-5 w-5 text-gray-600" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-amber-600" />;
    }
  };

  // Status label mapping (French)
  const statusLabels = {
    pending: 'En attente',
    acknowledged: 'Reconnu',
    disputed: 'Contesté',
    resolved: 'Résolu',
  };

  // Format date for display
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Handle acknowledge submission
  const handleAcknowledgeSubmit = async () => {
    if (!onAcknowledge || !notes.trim()) return;

    setIsSubmitting(true);
    try {
      await onAcknowledge(alert.id, notes);
      setShowAcknowledgeModal(false);
      setNotes('');
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle dispute submission
  const handleDisputeSubmit = async () => {
    if (!onDispute || !reason.trim()) return;

    setIsSubmitting(true);
    try {
      await onDispute(alert.id, reason);
      setShowDisputeModal(false);
      setReason('');
    } catch (error) {
      console.error('Failed to dispute alert:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div
        className={`
          rounded-lg border-2 p-4
          ${statusColors[alert.status]}
          ${className}
        `}
        role="alert"
        aria-live="polite"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                Alerte de déforestation
              </h3>
              <p className="text-sm text-gray-600">
                Statut : {statusLabels[alert.status]}
              </p>
            </div>
          </div>
        </div>

        {/* Alert Details */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <Calendar className="h-4 w-4 text-gray-500" />
            <span>
              <strong>Détection :</strong> {formatDate(alert.detectionDate)}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-700">
            <Calendar className="h-4 w-4 text-gray-500" />
            <span>
              <strong>Référence :</strong> {formatDate(alert.baselineDate)}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-700">
            <MapPin className="h-4 w-4 text-gray-500" />
            <span>
              <strong>Surface affectée :</strong> {alert.affectedAreaHectares.toFixed(2)} ha
              ({alert.affectedAreaPercent.toFixed(1)}%)
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-700">
            <TrendingDown className="h-4 w-4 text-gray-500" />
            <span>
              <strong>Changement NDVI :</strong> {alert.ndviChange.toFixed(3)}
              {' '}({alert.baselineNDVI.toFixed(3)} → {alert.currentNDVI.toFixed(3)})
            </span>
          </div>
        </div>

        {/* Before/After Comparison */}
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">
            Comparaison avant/après
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-600">
                Avant ({formatDate(alert.baselineDate)})
              </p>
              <div className="aspect-video bg-gray-200 rounded-lg flex items-center justify-center">
                <p className="text-xs text-gray-500">
                  NDVI: {alert.baselineNDVI.toFixed(3)}
                </p>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-600">
                Après ({formatDate(alert.detectionDate)})
              </p>
              <div className="aspect-video bg-gray-200 rounded-lg flex items-center justify-center">
                <p className="text-xs text-gray-500">
                  NDVI: {alert.currentNDVI.toFixed(3)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Acknowledgment/Dispute Info */}
        {alert.status === 'acknowledged' && alert.acknowledgmentNotes && (
          <div className="mb-4 p-3 bg-green-100 rounded-lg">
            <p className="text-sm font-medium text-green-900 mb-1">
              Reconnu par {alert.acknowledgedBy || 'Utilisateur'}
            </p>
            <p className="text-sm text-green-800">
              {alert.acknowledgmentNotes}
            </p>
            {alert.acknowledgedAt && (
              <p className="text-xs text-green-700 mt-1">
                Le {formatDate(alert.acknowledgedAt)}
              </p>
            )}
          </div>
        )}

        {alert.status === 'disputed' && alert.disputeReason && (
          <div className="mb-4 p-3 bg-red-100 rounded-lg">
            <p className="text-sm font-medium text-red-900 mb-1">
              Contesté par {alert.disputedBy || 'Utilisateur'}
            </p>
            <p className="text-sm text-red-800">
              {alert.disputeReason}
            </p>
            {alert.disputedAt && (
              <p className="text-xs text-red-700 mt-1">
                Le {formatDate(alert.disputedAt)}
              </p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        {alert.status === 'pending' && (onAcknowledge || onDispute) && (
          <div className="flex gap-3">
            {onAcknowledge && (
              <button
                onClick={() => setShowAcknowledgeModal(true)}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors"
              >
                Reconnaître
              </button>
            )}
            {onDispute && (
              <button
                onClick={() => setShowDisputeModal(true)}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
              >
                Contester
              </button>
            )}
          </div>
        )}
      </div>

      {/* Acknowledge Modal */}
      {showAcknowledgeModal && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-[60]"
            aria-hidden="true"
            onClick={() => setShowAcknowledgeModal(false)}
          />

          {/* Modal */}
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="acknowledge-modal-title"
            className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
              {/* Header */}
              <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                  <div>
                    <h3 id="acknowledge-modal-title" className="text-base font-semibold text-gray-900">
                      Reconnaître l'alerte
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Ajoutez des notes pour expliquer la reconnaissance
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAcknowledgeModal(false)}
                  className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label="Fermer"
                >
                  <X className="h-4 w-4 text-gray-500" />
                </button>
              </div>

              {/* Content */}
              <div className="px-6 py-4">
                <label htmlFor="acknowledge-notes" className="block text-sm font-medium text-gray-700 mb-2">
                  Notes de reconnaissance
                </label>
                <textarea
                  id="acknowledge-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Expliquez pourquoi vous reconnaissez cette alerte..."
                  required
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 px-6 pb-6 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAcknowledgeModal(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleAcknowledgeSubmit}
                  disabled={!notes.trim() || isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Envoi...' : 'Reconnaître'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Dispute Modal */}
      {showDisputeModal && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-[60]"
            aria-hidden="true"
            onClick={() => setShowDisputeModal(false)}
          />

          {/* Modal */}
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="dispute-modal-title"
            className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
              {/* Header */}
              <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <XCircle className="h-6 w-6 text-red-600" />
                  <div>
                    <h3 id="dispute-modal-title" className="text-base font-semibold text-gray-900">
                      Contester l'alerte
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Expliquez pourquoi vous contestez cette détection
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDisputeModal(false)}
                  className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label="Fermer"
                >
                  <X className="h-4 w-4 text-gray-500" />
                </button>
              </div>

              {/* Content */}
              <div className="px-6 py-4">
                <label htmlFor="dispute-reason" className="block text-sm font-medium text-gray-700 mb-2">
                  Raison de la contestation
                </label>
                <textarea
                  id="dispute-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Expliquez pourquoi cette détection est incorrecte..."
                  required
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 px-6 pb-6 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDisputeModal(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleDisputeSubmit}
                  disabled={!reason.trim() || isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Envoi...' : 'Contester'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
