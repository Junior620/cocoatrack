'use client';

// ReportDownloadLink Component
// Displays a download link for generated certification reports

import { Download, ExternalLink, CheckCircle } from 'lucide-react';

interface ReportDownloadLinkProps {
  reportUrl: string;
  parcelleCode: string;
  onClose?: () => void;
}

export default function ReportDownloadLink({
  reportUrl,
  parcelleCode,
  onClose,
}: ReportDownloadLinkProps) {
  const handleDownload = () => {
    // Open the report URL in a new tab
    window.open(reportUrl, '_blank');
  };

  return (
    <div className="rounded-lg border border-green-200 bg-green-50 p-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <CheckCircle className="h-6 w-6 text-green-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-green-900">
            Rapport généré avec succès
          </h3>
          <p className="mt-1 text-sm text-green-700">
            Le rapport de certification pour la parcelle <strong>{parcelleCode}</strong> est prêt.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
            >
              <Download className="h-4 w-4" />
              Télécharger le rapport
            </button>
            <a
              href={reportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-green-600 bg-white px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-50 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Ouvrir dans un nouvel onglet
            </a>
            {onClose && (
              <button
                onClick={onClose}
                className="text-sm font-medium text-green-700 hover:text-green-800 transition-colors"
              >
                Fermer
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
