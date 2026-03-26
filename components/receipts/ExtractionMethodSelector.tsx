'use client';

import { useState } from 'react';
import { FileText, Wand2, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import type { ParsedReceipt } from '@/types/receipts';

export type ExtractionMethod = 'manual' | 'ocr';

export interface ExtractionMethodSelectorProps {
  pdfUrl: string;
  onMethodSelected: (method: ExtractionMethod) => void;
  onDataExtracted: (data: ParsedReceipt) => void;
  ocrAvailable?: boolean;
  className?: string;
}

type ExtractionState = 'idle' | 'extracting' | 'success' | 'error';

export function ExtractionMethodSelector({
  pdfUrl,
  onMethodSelected,
  onDataExtracted,
  ocrAvailable = true,
  className = '',
}: ExtractionMethodSelectorProps) {
  const [selectedMethod, setSelectedMethod] = useState<ExtractionMethod>('manual');
  const [extractionState, setExtractionState] = useState<ExtractionState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleMethodChange = async (method: ExtractionMethod) => {
    setSelectedMethod(method);
    setErrorMessage(null);

    if (method === 'manual') {
      setExtractionState('idle');
      onMethodSelected('manual');
      return;
    }

    // OCR selected — trigger extraction
    setExtractionState('extracting');
    onMethodSelected('ocr');

    try {
      const extractResponse = await fetch('/api/receipts/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfUrl }),
        signal: AbortSignal.timeout(35000),
      });

      if (!extractResponse.ok) {
        const err = await extractResponse.json().catch(() => ({}));
        throw new Error(err?.error?.message || 'Extraction OCR échouée');
      }

      const { text } = await extractResponse.json();

      if (!text?.trim()) {
        throw new Error('Aucun texte extrait du document');
      }

      const parseResponse = await fetch('/api/receipts/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!parseResponse.ok) {
        const err = await parseResponse.json().catch(() => ({}));
        throw new Error(err?.error?.message || 'Analyse du texte échouée');
      }

      const parsedData: ParsedReceipt = await parseResponse.json();

      setExtractionState('success');
      onDataExtracted(parsedData);
    } catch (err) {
      const isTimeout =
        err instanceof Error &&
        (err.message.includes('timeout') || err.name === 'AbortError' || err.name === 'TimeoutError');

      const message = isTimeout
        ? 'Extraction trop longue. Veuillez utiliser la saisie manuelle'
        : err instanceof Error && err.message
        ? err.message
        : 'Extraction impossible. Veuillez saisir manuellement';

      setExtractionState('error');
      setErrorMessage(message);

      // Fall back to manual on error
      setSelectedMethod('manual');
      onMethodSelected('manual');
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <p className="text-sm font-medium text-gray-700">
        Méthode d&apos;extraction des données
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Manual entry option */}
        <button
          type="button"
          onClick={() => handleMethodChange('manual')}
          disabled={extractionState === 'extracting'}
          className={`flex items-start gap-3 p-4 rounded-lg border-2 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            selectedMethod === 'manual'
              ? 'border-blue-600 bg-blue-50'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
          aria-pressed={selectedMethod === 'manual'}
        >
          <FileText
            className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
              selectedMethod === 'manual' ? 'text-blue-600' : 'text-gray-400'
            }`}
          />
          <div>
            <p className={`text-sm font-medium ${selectedMethod === 'manual' ? 'text-blue-700' : 'text-gray-700'}`}>
              Saisie manuelle
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Saisissez les informations manuellement
            </p>
          </div>
        </button>

        {/* OCR option */}
        {ocrAvailable && (
          <button
            type="button"
            onClick={() => handleMethodChange('ocr')}
            disabled={extractionState === 'extracting'}
            className={`flex items-start gap-3 p-4 rounded-lg border-2 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              selectedMethod === 'ocr'
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
            aria-pressed={selectedMethod === 'ocr'}
          >
            {extractionState === 'extracting' ? (
              <Loader2 className="w-5 h-5 mt-0.5 flex-shrink-0 text-blue-600 animate-spin" />
            ) : extractionState === 'success' && selectedMethod === 'ocr' ? (
              <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-green-600" />
            ) : (
              <Wand2
                className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                  selectedMethod === 'ocr' ? 'text-blue-600' : 'text-gray-400'
                }`}
              />
            )}
            <div>
              <p className={`text-sm font-medium ${selectedMethod === 'ocr' ? 'text-blue-700' : 'text-gray-700'}`}>
                Extraction automatique (OCR)
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {extractionState === 'extracting'
                  ? 'Extraction en cours...'
                  : 'Extraction automatique des données'}
              </p>
            </div>
          </button>
        )}
      </div>

      {/* Loading indicator */}
      {extractionState === 'extracting' && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <Loader2 className="w-4 h-4 text-blue-600 animate-spin flex-shrink-0" />
          <p className="text-sm text-blue-700">Extraction en cours...</p>
        </div>
      )}

      {/* Success indicator */}
      {extractionState === 'success' && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
          <p className="text-sm text-green-700">
            Extraction réussie. Vérifiez et corrigez les données si nécessaire.
          </p>
        </div>
      )}

      {/* Error message */}
      {extractionState === 'error' && errorMessage && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{errorMessage}</p>
        </div>
      )}

      {/* OCR unavailable message (Requirement 10.4) */}
      {!ocrAvailable && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700">
            Service OCR temporairement indisponible. Veuillez utiliser la saisie manuelle
          </p>
        </div>
      )}
    </div>
  );
}
