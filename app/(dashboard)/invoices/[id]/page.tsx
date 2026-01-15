'use client';

// CocoaTrack V2 - Invoice Detail Page
// Displays invoice details with associated deliveries

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { useAuth, hasPermission } from '@/lib/auth';
import { invoicesApi } from '@/lib/api/invoices';
import { downloadInvoicePdf, uploadInvoicePdf } from '@/lib/services/pdf-service';
import { createClient } from '@/lib/supabase/client';
import type { InvoiceWithRelations, InvoiceDelivery, InvoiceSummary, InvoiceStatus } from '@/lib/validations/invoice';

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const invoiceId = params.id as string;

  const [invoice, setInvoice] = useState<InvoiceWithRelations | null>(null);
  const [deliveries, setDeliveries] = useState<InvoiceDelivery[]>([]);
  const [summary, setSummary] = useState<InvoiceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const canUpdate = user && hasPermission(user.role, 'invoices:update');
  const canExport = user && hasPermission(user.role, 'export:pdf');

  // Fetch invoice data
  const fetchInvoice = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [invoiceData, deliveriesData, summaryData] = await Promise.all([
        invoicesApi.get(invoiceId),
        invoicesApi.getDeliveries(invoiceId),
        invoicesApi.getSummary(invoiceId),
      ]);

      if (!invoiceData) {
        setError('Facture non trouvée');
        return;
      }

      setInvoice(invoiceData);
      setDeliveries(deliveriesData);
      setSummary(summaryData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch invoice');
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  // Update invoice status
  const handleStatusChange = async (newStatus: InvoiceStatus) => {
    if (!invoice) return;
    
    setUpdating(true);
    try {
      const updated = await invoicesApi.updateStatus(invoice.id, newStatus);
      setInvoice({ ...invoice, ...updated });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  // Generate and download PDF
  const handleDownloadPdf = async () => {
    if (!invoice || !summary) return;
    
    setGeneratingPdf(true);
    try {
      await downloadInvoicePdf({
        invoice,
        deliveries,
        summary,
        companyName: 'CocoaTrack',
        companyAddress: 'Cameroun',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate PDF');
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Generate and upload PDF to storage
  const handleGenerateAndUploadPdf = async () => {
    if (!invoice || !summary) return;
    
    setGeneratingPdf(true);
    try {
      const supabase = createClient();
      const pdfPath = await uploadInvoicePdf(
        {
          invoice,
          deliveries,
          summary,
          companyName: 'CocoaTrack',
          companyAddress: 'Cameroun',
        },
        supabase
      );
      
      // Update invoice with PDF path
      const updated = await invoicesApi.setPdfPath(invoice.id, pdfPath);
      setInvoice({ ...invoice, ...updated });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate and upload PDF');
    } finally {
      setGeneratingPdf(false);
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
      month: '2-digit',
      year: 'numeric',
    });
  };

  // Get status badge color
  const getStatusColor = (status: InvoiceStatus) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'sent':
        return 'bg-blue-100 text-blue-800';
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Get status label
  const getStatusLabel = (status: InvoiceStatus) => {
    switch (status) {
      case 'paid':
        return 'Payée';
      case 'sent':
        return 'Envoyée';
      case 'draft':
        return 'Brouillon';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 w-1/3 rounded bg-gray-200" />
          <div className="mt-4 h-4 w-1/2 rounded bg-gray-200" />
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg bg-white p-6 shadow">
              <div className="h-4 w-1/2 rounded bg-gray-200" />
              <div className="mt-2 h-8 w-3/4 rounded bg-gray-200" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <p className="text-sm text-red-700">{error || 'Facture non trouvée'}</p>
        <Link href="/invoices" className="mt-2 inline-block text-sm text-red-600 hover:underline">
          ← Retour aux factures
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/invoices" className="text-gray-400 hover:text-gray-600">
              <ArrowLeftIcon className="h-5 w-5" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">{invoice.code}</h1>
            <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${getStatusColor(invoice.status)}`}>
              {getStatusLabel(invoice.status)}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {invoice.planteur ? (
              <>Planteur: {invoice.planteur.name} ({invoice.planteur.code})</>
            ) : invoice.chef_planteur ? (
              <>Fournisseur: {invoice.chef_planteur.name} ({invoice.chef_planteur.code})</>
            ) : invoice.cooperative ? (
              <>{invoice.cooperative.name}</>
            ) : null}
            {' • '}Période: {formatDate(invoice.period_start)} - {formatDate(invoice.period_end)}
          </p>
        </div>
        <div className="flex gap-2">
          {canUpdate && invoice.status === 'draft' && (
            <button
              onClick={() => handleStatusChange('sent')}
              disabled={updating}
              className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <SendIcon className="mr-2 h-4 w-4" />
              Marquer envoyée
            </button>
          )}
          {canUpdate && invoice.status === 'sent' && (
            <button
              onClick={() => handleStatusChange('paid')}
              disabled={updating}
              className="inline-flex items-center rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              <CheckIcon className="mr-2 h-4 w-4" />
              Marquer payée
            </button>
          )}
          {canExport && invoice.pdf_path && (
            <a
              href={invoice.pdf_path}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <DownloadIcon className="mr-2 h-4 w-4" />
              Télécharger PDF
            </a>
          )}
          {canExport && !invoice.pdf_path && (
            <button
              onClick={handleDownloadPdf}
              disabled={generatingPdf}
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {generatingPdf ? (
                <>
                  <SpinnerIcon className="mr-2 h-4 w-4 animate-spin" />
                  Génération...
                </>
              ) : (
                <>
                  <DownloadIcon className="mr-2 h-4 w-4" />
                  Générer PDF
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-4">
        <div className="rounded-lg bg-white p-6 shadow">
          <p className="text-sm font-medium text-gray-500">Livraisons</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{summary?.total_deliveries || 0}</p>
        </div>
        <div className="rounded-lg bg-white p-6 shadow">
          <p className="text-sm font-medium text-gray-500">Poids total</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {(summary?.total_weight_kg || 0).toFixed(2)} <span className="text-lg font-normal text-gray-500">kg</span>
          </p>
        </div>
        <div className="rounded-lg bg-white p-6 shadow">
          <p className="text-sm font-medium text-gray-500">Montant total</p>
          <p className="mt-2 text-3xl font-bold text-primary-600">
            {formatCurrency(summary?.total_amount_xaf || 0)}
          </p>
        </div>
        <div className="rounded-lg bg-white p-6 shadow">
          <p className="text-sm font-medium text-gray-500">Prix moyen/kg</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {formatCurrency(summary?.average_price_per_kg || 0)}
          </p>
        </div>
      </div>

      {/* Quality Distribution */}
      {summary && (
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="text-lg font-semibold text-gray-900">Répartition par qualité</h2>
          <div className="mt-4 flex gap-8">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-sm font-semibold text-green-800">
                A
              </span>
              <span className="text-gray-900">{summary.deliveries_by_grade.A} livraisons</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-800">
                B
              </span>
              <span className="text-gray-900">{summary.deliveries_by_grade.B} livraisons</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-sm font-semibold text-orange-800">
                C
              </span>
              <span className="text-gray-900">{summary.deliveries_by_grade.C} livraisons</span>
            </div>
          </div>
        </div>
      )}

      {/* Deliveries Table */}
      <div className="rounded-lg bg-white shadow">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Livraisons incluses</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Code
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Planteur
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Poids (kg)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Prix/kg
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {deliveries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500">
                    Aucune livraison associée
                  </td>
                </tr>
              ) : (
                deliveries.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4">
                      <Link
                        href={`/deliveries/${item.delivery_id}`}
                        className="font-medium text-primary-600 hover:text-primary-900"
                      >
                        {item.delivery?.code || '-'}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {item.delivery?.delivered_at ? formatDate(item.delivery.delivered_at) : '-'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="text-sm text-gray-900">{item.delivery?.planteur?.name || '-'}</div>
                      <div className="text-xs text-gray-500">{item.delivery?.planteur?.code}</div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                      {item.delivery?.weight_kg ? Number(item.delivery.weight_kg).toFixed(2) : '-'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                      {item.delivery?.price_per_kg ? formatCurrency(Number(item.delivery.price_per_kg)) : '-'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      {item.delivery?.total_amount ? formatCurrency(Number(item.delivery.total_amount)) : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Info */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="text-lg font-semibold text-gray-900">Informations</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-gray-500">Créée par</dt>
            <dd className="mt-1 text-sm text-gray-900">{invoice.created_by_profile?.full_name || '-'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Date de création</dt>
            <dd className="mt-1 text-sm text-gray-900">{formatDate(invoice.created_at)}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Dernière modification</dt>
            <dd className="mt-1 text-sm text-gray-900">{formatDate(invoice.updated_at)}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Type de facturation</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {invoice.planteur ? 'Planteur' : invoice.chef_planteur ? 'Fournisseur' : 'Coopérative'}
            </dd>
          </div>
          {invoice.cooperative && (
            <div>
              <dt className="text-sm font-medium text-gray-500">Coopérative</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {invoice.cooperative.name} ({invoice.cooperative.code})
              </dd>
            </div>
          )}
          {invoice.chef_planteur && (
            <div>
              <dt className="text-sm font-medium text-gray-500">Fournisseur (Chef Planteur)</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {invoice.chef_planteur.name} ({invoice.chef_planteur.code})
              </dd>
            </div>
          )}
          {invoice.planteur && (
            <div>
              <dt className="text-sm font-medium text-gray-500">Planteur</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {invoice.planteur.name} ({invoice.planteur.code})
              </dd>
            </div>
          )}
        </dl>
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

function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
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
