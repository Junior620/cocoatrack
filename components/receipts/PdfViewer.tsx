'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Download, AlertCircle } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Set worker path for PDF.js — use the locally bundled worker to avoid CDN dependency
if (typeof window !== 'undefined') {
  // Use the worker bundled with pdfjs-dist via Next.js
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
}

interface PdfViewerProps {
  pdfUrl: string;
  className?: string;
}

type ZoomLevel = 50 | 75 | 100 | 125 | 150 | 200;

export function PdfViewer({ pdfUrl, className = '' }: PdfViewerProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [zoom, setZoom] = useState<ZoomLevel>(100);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);

  // Load PDF document
  useEffect(() => {
    const loadPdf = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // If the URL points to Supabase Storage, get a signed URL first
        let urlToLoad = pdfUrl;
        if (pdfUrl.includes('/storage/v1/object/')) {
          const res = await fetch(
            `/api/receipts/signed-url?path=${encodeURIComponent(pdfUrl)}`
          );
          if (res.ok) {
            const json = await res.json();
            urlToLoad = json.signedUrl;
          }
        }

        const loadingTask = pdfjsLib.getDocument(urlToLoad);
        const pdf = await loadingTask.promise;
        
        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
        setIsLoading(false);
      } catch (err) {
        console.error('Error loading PDF:', err);
        setError('Impossible de charger le PDF. Veuillez réessayer.');
        setIsLoading(false);
      }
    };

    if (pdfUrl) {
      loadPdf();
    }

    return () => {
      if (pdfDoc) {
        pdfDoc.destroy();
      }
    };
  }, [pdfUrl]);

  // Render current page
  useEffect(() => {
    const renderPage = async () => {
      if (!pdfDoc || !canvasRef.current) return;

      // Cancel any in-progress render before starting a new one
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }

      try {
        const page = await pdfDoc.getPage(currentPage);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext('2d');
        if (!context) return;

        const viewport = page.getViewport({ scale: zoom / 100 });
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const task = page.render({
          canvasContext: context,
          viewport: viewport,
          canvas: canvas,
        });
        renderTaskRef.current = task;

        await task.promise;
        renderTaskRef.current = null;
      } catch (err: unknown) {
        // Ignore cancellation errors — they're expected when renders are cancelled
        if (err instanceof Error && err.name === 'RenderingCancelledException') return;
        console.error('Error rendering page:', err);
        setError('Erreur lors du rendu de la page');
      }
    };

    renderPage();

    return () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
    };
  }, [pdfDoc, currentPage, zoom]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setZoom((prev) => {
      const levels: ZoomLevel[] = [50, 75, 100, 125, 150, 200];
      const currentIndex = levels.indexOf(prev);
      return currentIndex < levels.length - 1 ? levels[currentIndex + 1] : prev;
    });
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => {
      const levels: ZoomLevel[] = [50, 75, 100, 125, 150, 200];
      const currentIndex = levels.indexOf(prev);
      return currentIndex > 0 ? levels[currentIndex - 1] : prev;
    });
  }, []);

  // Page navigation
  const handlePreviousPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  }, []);

  const handleNextPage = useCallback(() => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  }, [totalPages]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          handlePreviousPage();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleNextPage();
          break;
        case '+':
        case '=':
          e.preventDefault();
          handleZoomIn();
          break;
        case '-':
        case '_':
          e.preventDefault();
          handleZoomOut();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePreviousPage, handleNextPage, handleZoomIn, handleZoomOut]);

  // Download PDF
  const handleDownload = useCallback(() => {
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = 'recu_collecte.pdf';
    link.click();
  }, [pdfUrl]);

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center bg-gray-50 border border-gray-200 rounded-lg p-8 ${className}`}>
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <p className="text-gray-700 text-center mb-4">{error}</p>
        <a
          href={pdfUrl}
          download
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          Télécharger le PDF
        </a>
      </div>
    );
  }

  return (
    <div className={`flex flex-col bg-white border border-gray-200 rounded-lg overflow-hidden ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
        {/* Page navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePreviousPage}
            disabled={currentPage === 1 || isLoading}
            className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Page précédente"
            title="Page précédente (←)"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <span className="text-sm text-gray-700 min-w-[80px] text-center">
            {isLoading ? '...' : `${currentPage} / ${totalPages}`}
          </span>
          
          <button
            onClick={handleNextPage}
            disabled={currentPage === totalPages || isLoading}
            className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Page suivante"
            title="Page suivante (→)"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            disabled={zoom === 50 || isLoading}
            className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Zoom arrière"
            title="Zoom arrière (-)"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          
          <span className="text-sm text-gray-700 min-w-[60px] text-center font-medium">
            {zoom}%
          </span>
          
          <button
            onClick={handleZoomIn}
            disabled={zoom === 200 || isLoading}
            className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Zoom avant"
            title="Zoom avant (+)"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
        </div>

        {/* Download button */}
        <button
          onClick={handleDownload}
          className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
          aria-label="Télécharger le PDF"
          title="Télécharger le PDF"
        >
          <Download className="w-5 h-5" />
        </button>
      </div>

      {/* PDF Canvas */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-gray-100 p-4"
        style={{ minHeight: '400px' }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Chargement du PDF...</p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <canvas
              ref={canvasRef}
              className="shadow-lg bg-white"
              style={{ maxWidth: '100%', height: 'auto' }}
            />
          </div>
        )}
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
        Raccourcis: ← → (pages) | + - (zoom)
      </div>
    </div>
  );
}
