'use client';

// CocoaTrack V2 - Error Boundary Component
// Catches and handles React errors in component tree
// Requirements: 7.1, 7.4, 7.5

import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary Component
 * 
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI instead of crashing.
 * 
 * Requirements:
 * - 7.1: Handle errors gracefully with user-friendly messages
 * - 7.4: Handle timeout and network errors
 * - 7.5: Maintain application state on error
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  reset = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }

      // Default fallback UI
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg border border-red-200 p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="p-2 bg-red-100 rounded-full">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Une erreur s'est produite
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Nous sommes désolés, quelque chose s'est mal passé. Veuillez réessayer.
                </p>
                {process.env.NODE_ENV === 'development' && (
                  <details className="mb-4">
                    <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                      Détails de l'erreur (développement uniquement)
                    </summary>
                    <pre className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded overflow-auto max-h-32">
                      {this.state.error.message}
                      {'\n\n'}
                      {this.state.error.stack}
                    </pre>
                  </details>
                )}
                <button
                  onClick={this.reset}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
                >
                  <RefreshCw className="h-4 w-4" />
                  Réessayer
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Default error fallback component for bulk assignment operations
 */
export function BulkAssignmentErrorFallback({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  // Determine error type and provide specific guidance
  const isNetworkError = error.message.includes('fetch') || 
                         error.message.includes('network') ||
                         error.message.includes('connexion');
  
  const isTimeoutError = error.message.includes('timeout') ||
                         error.message.includes('délai');
  
  const isDatabaseError = error.message.includes('database') ||
                          error.message.includes('base de données');

  let errorTitle = 'Erreur lors de l\'assignation';
  let errorMessage = 'Une erreur inattendue s\'est produite. Veuillez réessayer.';
  let actionText = 'Réessayer';

  if (isNetworkError) {
    errorTitle = 'Erreur de connexion';
    errorMessage = 'Impossible de se connecter au serveur. Vérifiez votre connexion internet et réessayez.';
  } else if (isTimeoutError) {
    errorTitle = 'Délai d\'attente dépassé';
    errorMessage = 'L\'opération a pris trop de temps. Essayez avec moins de planteurs ou réessayez plus tard.';
  } else if (isDatabaseError) {
    errorTitle = 'Erreur de base de données';
    errorMessage = 'Impossible d\'accéder à la base de données. Veuillez réessayer dans quelques instants.';
  }

  return (
    <div className="p-6 bg-white rounded-lg border border-red-200">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <div className="p-2 bg-red-100 rounded-full">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-gray-900 mb-1">
            {errorTitle}
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            {errorMessage}
          </p>
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            {actionText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ErrorBoundary;
