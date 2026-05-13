'use client';

/**
 * Interactive API Documentation Page
 *
 * Renders Swagger UI for the CocoaTrack Satellite Imagery API.
 * Accessible at /api-docs
 *
 * Swagger UI is loaded from CDN to avoid adding a new npm dependency.
 */

import { useEffect } from 'react';
import Head from 'next/head';

export default function ApiDocsPage() {
  useEffect(() => {
    // Dynamically load Swagger UI from CDN after mount
    const loadSwaggerUI = async () => {
      // Load CSS
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css';
      document.head.appendChild(link);

      // Load JS
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js';
      script.onload = () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const SwaggerUIBundle = (window as any).SwaggerUIBundle;
        if (SwaggerUIBundle) {
          SwaggerUIBundle({
            url: '/api/satellite/openapi',
            dom_id: '#swagger-ui',
            presets: [
              SwaggerUIBundle.presets.apis,
              SwaggerUIBundle.SwaggerUIStandalonePreset,
            ],
            layout: 'BaseLayout',
            deepLinking: true,
            displayRequestDuration: true,
            filter: true,
            tryItOutEnabled: true,
            requestInterceptor: (request: Record<string, unknown>) => {
              // Ensure credentials (session cookies) are sent with requests
              request.credentials = 'include';
              return request;
            },
          });
        }
      };
      document.body.appendChild(script);
    };

    loadSwaggerUI();
  }, []);

  return (
    <>
      <div className="min-h-screen bg-white">
        {/* Header */}
        <div className="border-b border-gray-200 bg-white px-6 py-4">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-700">
                <svg
                  className="h-5 w-5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">
                  CocoaTrack API Docs
                </h1>
                <p className="text-sm text-gray-500">Satellite Imagery API — v1.0.0</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="/api/satellite/openapi"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                OpenAPI JSON
              </a>
              <a
                href="/"
                className="flex items-center gap-1.5 rounded-md bg-green-700 px-3 py-1.5 text-sm text-white hover:bg-green-800"
              >
                ← Back to app
              </a>
            </div>
          </div>
        </div>

        {/* Info banner */}
        <div className="border-b border-blue-100 bg-blue-50 px-6 py-3">
          <div className="mx-auto max-w-7xl">
            <p className="text-sm text-blue-800">
              <strong>Authentication:</strong> All endpoints require a valid Supabase session.
              Log in to the app first, then use &quot;Try it out&quot; — session cookies are sent
              automatically.
            </p>
          </div>
        </div>

        {/* Swagger UI container */}
        <div id="swagger-ui" className="mx-auto max-w-7xl px-4 py-6" />

        {/* Loading state shown before Swagger UI initialises */}
        <noscript>
          <div className="flex min-h-[60vh] items-center justify-center">
            <p className="text-gray-500">
              JavaScript is required to display the interactive API documentation.
            </p>
          </div>
        </noscript>
      </div>

      {/* Swagger UI style overrides */}
      <style>{`
        /* Align Swagger UI with CocoaTrack design */
        .swagger-ui .topbar { display: none; }
        .swagger-ui .info { margin: 0 0 24px; }
        .swagger-ui .info .title { font-size: 1.5rem; color: #111827; }
        .swagger-ui .scheme-container { background: #f9fafb; padding: 12px 16px; border-radius: 8px; }
        .swagger-ui .opblock.opblock-get .opblock-summary-method { background: #2563eb; }
        .swagger-ui .opblock.opblock-post .opblock-summary-method { background: #16a34a; }
        .swagger-ui .opblock.opblock-patch .opblock-summary-method { background: #d97706; }
        .swagger-ui .opblock.opblock-delete .opblock-summary-method { background: #dc2626; }
        .swagger-ui .btn.execute { background: #15803d; border-color: #15803d; }
        .swagger-ui .btn.execute:hover { background: #166534; }
        .swagger-ui select, .swagger-ui input[type=text], .swagger-ui textarea {
          border-radius: 6px;
        }
      `}</style>
    </>
  );
}
