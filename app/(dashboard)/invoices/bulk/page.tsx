'use client';

// CocoaTrack V2 - Bulk Invoice Generation Page
// Allows managers to generate invoices for multiple cooperatives at once

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth, hasPermission } from '@/lib/auth';
import { invoicesApi } from '@/lib/api/invoices';
import { createClient } from '@/lib/supabase/client';
import type { Invoice } from '@/types/database.gen';

interface Cooperative {
  id: string;
  name: string;
  code: string;
}

interface GenerationResult {
  cooperativeId: string;
  cooperativeName: string;
  success: boolean;
  invoice?: Invoice;
  error?: string;
}

export default function BulkGenerateInvoicesPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [cooperatives, setCooperatives] = useState<Cooperative[]>([]);
  const [selectedCooperatives, setSelectedCooperatives] = useState<Set<string>>(new Set());
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<GenerationResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const canCreate = user && hasPermission(user.role, 'invoices:create');
  const isAdmin = user?.role === 'admin';

  // Fetch cooperatives
  useEffect(() => {
    const fetchCooperatives = async () => {
      setLoading(true);
      const supabase = createClient();
      
      let query = supabase
        .from('cooperatives')
        .select('id, name, code')
        .order('name');

      // Non-admin users can only see their own cooperative
      if (!isAdmin && user?.cooperative_id) {
        query = query.eq('id', user.cooperative_id);
      }

      const { data, error } = await query;

      if (!error && data) {
        setCooperatives(data);
      }
      setLoading(false);
    };

    fetchCooperatives();
  }, [isAdmin, user?.cooperative_id]);

  // Toggle cooperative selection
  const toggleCooperative = (id: string) => {
    const newSelected = new Set(selectedCooperatives);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedCooperatives(newSelected);
  };

  // Select/deselect all
  const toggleAll = () => {
    if (selectedCooperatives.size === cooperatives.length) {
      setSelectedCooperatives(new Set());
    } else {
      setSelectedCooperatives(new Set(cooperatives.map(c => c.id)));
    }
  };

  // Generate invoices
  const handleGenerate = async () => {
    if (selectedCooperatives.size === 0) {
      setError('Veuillez sélectionner au moins une coopérative');
      return;
    }

    if (!periodStart || !periodEnd) {
      setError('Veuillez sélectionner une période');
      return;
    }

    if (new Date(periodStart) > new Date(periodEnd)) {
      setError('La date de début doit être antérieure à la date de fin');
      return;
    }

    setGenerating(true);
    setError(null);
    setResults([]);

    const generationResults: GenerationResult[] = [];

    for (const cooperativeId of selectedCooperatives) {
      const cooperative = cooperatives.find(c => c.id === cooperativeId);
      
      try {
        const invoice = await invoicesApi.generateFromDeliveries({
          cooperative_id: cooperativeId,
          period_start: periodStart,
          period_end: periodEnd,
        });

        generationResults.push({
          cooperativeId,
          cooperativeName: cooperative?.name || cooperativeId,
          success: true,
          invoice,
        });
      } catch (err) {
        generationResults.push({
          cooperativeId,
          cooperativeName: cooperative?.name || cooperativeId,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }

      // Update results progressively
      setResults([...generationResults]);
    }

    setGenerating(false);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  // Can proceed
  const canProceed = selectedCooperatives.size > 0 && periodStart && periodEnd && new Date(periodStart) <= new Date(periodEnd);

  // Count results
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;

  if (!canCreate) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <p className="text-sm text-red-700">Vous n'avez pas la permission de générer des factures.</p>
        <Link href="/invoices" className="mt-2 inline-block text-sm text-red-600 hover:underline">
          ← Retour aux factures
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/invoices" className="text-gray-400 hover:text-gray-600">
          <ArrowLeftIcon className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Génération en masse</h1>
          <p className="mt-1 text-sm text-gray-500">
            Générer des factures pour plusieurs coopératives
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Period Selection */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="text-lg font-semibold text-gray-900">Période</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="periodStart" className="block text-sm font-medium text-gray-700">
              Date de début
            </label>
            <input
              type="date"
              id="periodStart"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              disabled={generating}
              className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-gray-100"
            />
          </div>
          <div>
            <label htmlFor="periodEnd" className="block text-sm font-medium text-gray-700">
              Date de fin
            </label>
            <input
              type="date"
              id="periodEnd"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              disabled={generating}
              className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-gray-100"
            />
          </div>
        </div>
      </div>

      {/* Cooperatives Selection */}
      <div className="rounded-lg bg-white shadow">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Coopératives ({selectedCooperatives.size} sélectionnée{selectedCooperatives.size > 1 ? 's' : ''})
          </h2>
          {isAdmin && (
            <button
              onClick={toggleAll}
              disabled={generating}
              className="text-sm text-primary-600 hover:text-primary-900 disabled:opacity-50"
            >
              {selectedCooperatives.size === cooperatives.length ? 'Tout désélectionner' : 'Tout sélectionner'}
            </button>
          )}
        </div>

        {loading ? (
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 rounded bg-gray-200" />
              ))}
            </div>
          </div>
        ) : cooperatives.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">
            Aucune coopérative disponible
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {cooperatives.map((cooperative) => (
              <div
                key={cooperative.id}
                className={`flex items-center gap-4 px-6 py-4 cursor-pointer hover:bg-gray-50 ${
                  selectedCooperatives.has(cooperative.id) ? 'bg-primary-50' : ''
                }`}
                onClick={() => !generating && toggleCooperative(cooperative.id)}
              >
                <input
                  type="checkbox"
                  checked={selectedCooperatives.has(cooperative.id)}
                  onChange={() => toggleCooperative(cooperative.id)}
                  disabled={generating}
                  onClick={(e) => e.stopPropagation()}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:opacity-50"
                />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{cooperative.name}</p>
                  <p className="text-sm text-gray-500">{cooperative.code}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="rounded-lg bg-white shadow">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Résultats ({successCount} succès, {failureCount} échec{failureCount > 1 ? 's' : ''})
            </h2>
          </div>
          <div className="divide-y divide-gray-200">
            {results.map((result) => (
              <div key={result.cooperativeId} className="flex items-center gap-4 px-6 py-4">
                {result.success ? (
                  <CheckCircleIcon className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircleIcon className="h-5 w-5 text-red-500" />
                )}
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{result.cooperativeName}</p>
                  {result.success && result.invoice ? (
                    <Link
                      href={`/invoices/${result.invoice.id}`}
                      className="text-sm text-primary-600 hover:text-primary-900"
                    >
                      {result.invoice.code} →
                    </Link>
                  ) : (
                    <p className="text-sm text-red-600">{result.error}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-4">
        <Link
          href="/invoices"
          className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Annuler
        </Link>
        <button
          onClick={handleGenerate}
          disabled={!canProceed || generating}
          className="inline-flex items-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {generating ? (
            <>
              <SpinnerIcon className="mr-2 h-4 w-4 animate-spin" />
              Génération en cours...
            </>
          ) : (
            <>
              <DocumentIcon className="mr-2 h-4 w-4" />
              Générer les factures
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// Icons
function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function XCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
