/**
 * PdfViewer Component Example
 * 
 * This example demonstrates how to use the PdfViewer component
 * to display PDF receipts in the receipt import workflow.
 */

'use client';

import { PdfViewer } from './PdfViewer';

export function PdfViewerExample() {
  // Example PDF URL (replace with actual Supabase Storage URL)
  const examplePdfUrl = 'https://example.com/sample-receipt.pdf';

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Aperçu du Reçu de Collecte</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PDF Viewer */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Document PDF</h2>
          <PdfViewer 
            pdfUrl={examplePdfUrl}
            className="h-[600px]"
          />
        </div>

        {/* Form would go here */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Informations du Reçu</h2>
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <p className="text-gray-600">
              Le formulaire de saisie des informations du reçu sera affiché ici.
            </p>
            <p className="text-gray-600 mt-2">
              L'utilisateur peut consulter le PDF à gauche tout en remplissant le formulaire.
            </p>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-3">Fonctionnalités du Viewer</h3>
        <ul className="space-y-2 text-sm text-gray-700">
          <li>✓ Zoom avant/arrière (50% à 200%)</li>
          <li>✓ Navigation native du PDF (pages, défilement)</li>
          <li>✓ Raccourcis clavier: + / - pour le zoom</li>
          <li>✓ Téléchargement du PDF</li>
          <li>✓ Gestion des erreurs de chargement</li>
          <li>✓ Indicateur de chargement</li>
          <li>✓ Responsive et adaptatif</li>
        </ul>
      </div>
    </div>
  );
}
