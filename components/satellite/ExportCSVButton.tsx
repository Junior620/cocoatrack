/**
 * Export CSV Button Component
 * 
 * Provides a button to export temporal NDVI data as CSV file.
 * Handles authentication, loading states, and error handling.
 */

'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface ExportCSVButtonProps {
  parcelleId: string;
  parcelleCode?: string;
  startDate?: Date;
  endDate?: Date;
  className?: string;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Button component to export temporal NDVI data as CSV
 * 
 * Features:
 * - Automatic authentication handling
 * - Loading state with spinner
 * - Error handling with user-friendly messages
 * - Automatic file download
 * - Optional date range filtering
 */
export function ExportCSVButton({
  parcelleId,
  parcelleCode,
  startDate,
  endDate,
  className = '',
  variant = 'outline',
  size = 'md',
}: ExportCSVButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      setError(null);

      // Get authenticated Supabase client
      const supabase = createClient();
      const {
        data: { session },
        error: authError,
      } = await supabase.auth.getSession();

      if (authError || !session) {
        setError('Vous devez être connecté pour exporter les données');
        return;
      }

      // Build query parameters
      const params = new URLSearchParams({ parcelleId });
      if (startDate) {
        params.append('startDate', startDate.toISOString().split('T')[0]);
      }
      if (endDate) {
        params.append('endDate', endDate.toISOString().split('T')[0]);
      }

      // Fetch CSV data
      const response = await fetch(`/api/satellite/export/csv?${params}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Échec de l\'export');
      }

      // Get filename from Content-Disposition header or generate default
      const contentDisposition = response.headers.get('content-disposition');
      let filename = `ndvi-export-${parcelleCode || parcelleId.substring(0, 8)}.csv`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error exporting CSV:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'export');
    } finally {
      setIsExporting(false);
    }
  };

  // Determine button styles based on variant and size
  const baseStyles = 'inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variantStyles = {
    primary: 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500',
    secondary: 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500',
    outline: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-green-500',
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm rounded',
    md: 'px-4 py-2 text-base rounded-md',
    lg: 'px-6 py-3 text-lg rounded-lg',
  };

  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleExport}
        disabled={isExporting}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        title="Exporter les données NDVI en CSV"
      >
        {isExporting ? (
          <>
            <svg
              className={`animate-spin -ml-1 mr-2 ${iconSizes[size]}`}
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Export en cours...
          </>
        ) : (
          <>
            <Download className={`-ml-1 mr-2 ${iconSizes[size]}`} />
            Exporter CSV
          </>
        )}
      </button>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </div>
      )}
    </div>
  );
}
