'use client';

// CocoaTrack V2 - Static Image Button Component
// Button to generate and download high-resolution static images of parcelles

import { useState } from 'react';
import { Image as ImageIcon, Download, Loader2, AlertCircle, ZoomIn } from 'lucide-react';

interface StaticImageButtonProps {
  parcelleId: string;
  parcelleCode: string | null;
}

export default function StaticImageButton({ parcelleId, parcelleCode }: StaticImageButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateImageUrl = (width: number = 800, height: number = 600, retina: boolean = true) => {
    const params = new URLSearchParams({
      width: width.toString(),
      height: height.toString(),
      retina: retina.toString(),
    });
    return `/api/parcelles/${parcelleId}/static-image?${params}`;
  };

  const handleViewImage = () => {
    setError(null);
    const url = generateImageUrl(800, 600, true);
    setImageUrl(url);
    setShowModal(true);
  };

  const handleDownload = async (width: number = 1280, height: number = 960) => {
    setIsLoading(true);
    setError(null);

    try {
      const url = generateImageUrl(width, height, true);
      
      // Fetch the image
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to generate image');
      }

      // Create a blob from the response
      const blob = await response.blob();
      
      // Create an image element to load the blob
      const img = new Image();
      const imageUrl = URL.createObjectURL(blob);
      
      img.onload = () => {
        // Create a canvas to add GPS coordinates overlay
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          throw new Error('Failed to get canvas context');
        }
        
        // Draw the original image
        ctx.drawImage(img, 0, 0);
        
        // Add semi-transparent background for text
        const padding = 20;
        const textHeight = 80;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, canvas.height - textHeight, canvas.width, textHeight);
        
        // Add GPS coordinates text
        ctx.fillStyle = 'white';
        ctx.font = 'bold 24px monospace';
        ctx.textAlign = 'left';
        
        // Get GPS coordinates from the API (we'll need to fetch parcelle data)
        fetch(`/api/parcelles/${parcelleId}`)
          .then(res => res.json())
          .then(data => {
            const lat = data.centroid.lat.toFixed(6);
            const lng = data.centroid.lng.toFixed(6);
            const code = data.code || parcelleId;
            
            // Draw parcelle code
            ctx.fillText(`Parcelle: ${code}`, padding, canvas.height - textHeight + 30);
            
            // Draw GPS coordinates
            ctx.font = '20px monospace';
            ctx.fillText(`GPS: ${lat}°N, ${lng}°E`, padding, canvas.height - textHeight + 60);
            
            // Convert canvas to blob and download
            canvas.toBlob((finalBlob) => {
              if (!finalBlob) {
                throw new Error('Failed to create final image');
              }
              
              const downloadUrl = URL.createObjectURL(finalBlob);
              const link = document.createElement('a');
              link.href = downloadUrl;
              link.download = `parcelle-${code}-gps.png`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(downloadUrl);
              URL.revokeObjectURL(imageUrl);
              setIsLoading(false);
            }, 'image/png');
          })
          .catch(err => {
            console.error('Error fetching parcelle data:', err);
            // Fallback: download without GPS overlay
            const downloadUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = `parcelle-${parcelleCode || parcelleId}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(downloadUrl);
            setIsLoading(false);
          });
      };
      
      img.onerror = () => {
        throw new Error('Failed to load image');
      };
      
      img.src = imageUrl;

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download image');
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="flex gap-2">
        {/* View Button */}
        <button
          onClick={handleViewImage}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Voir l'image satellite de la parcelle"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ImageIcon className="h-4 w-4" />
          )}
          Image Satellite
        </button>

        {/* Quick Download Button */}
        <button
          onClick={() => handleDownload(1280, 960)}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Télécharger l'image haute résolution"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
        </button>
      </div>

      {error && (
        <div className="mt-2 flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Image Preview Modal */}
      {showModal && imageUrl && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-75 p-4">
          <div className="relative bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b bg-gray-50">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold">
                  Image Satellite{parcelleCode ? ` - Parcelle ${parcelleCode}` : ''}
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Image Container */}
            <div className="p-4 overflow-auto max-h-[calc(90vh-140px)]">
              <img
                src={imageUrl}
                alt={`Parcelle ${parcelleCode || parcelleId}`}
                className="w-full h-auto rounded-lg"
                onError={() => setError('Failed to load image')}
              />
            </div>

            {/* Footer with Download Options */}
            <div className="flex items-center justify-between p-4 border-t bg-gray-50">
              <div className="text-sm text-gray-600">
                <p className="font-medium">Options de téléchargement :</p>
                <p className="text-xs text-gray-500">Images haute résolution pour impression et présentations</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleDownload(800, 600)}
                  disabled={isLoading}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
                  title="800x600 pixels - Idéal pour emails et web"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Standard
                </button>
                <button
                  onClick={() => handleDownload(1280, 960)}
                  disabled={isLoading}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  title="1280x960 pixels @2x - Idéal pour rapports PDF et PowerPoint"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  HD
                </button>
                <button
                  onClick={() => handleDownload(1280, 1280)}
                  disabled={isLoading}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                  title="1280x1280 pixels @2x (2560x2560) - Idéal pour impression grand format"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Ultra HD
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
