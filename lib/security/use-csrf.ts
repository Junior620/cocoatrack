'use client';

// CocoaTrack V2 - CSRF Hook
// Client-side hook for CSRF token management

import { useState, useEffect, useCallback } from 'react';

const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_STORAGE_KEY = 'csrf_token';

/**
 * Hook to manage CSRF token on the client
 */
export function useCSRF() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch CSRF token on mount
  useEffect(() => {
    fetchToken();
  }, []);

  const fetchToken = async () => {
    try {
      // Try to get from session storage first
      const cached = sessionStorage.getItem(CSRF_STORAGE_KEY);
      if (cached) {
        setToken(cached);
        setLoading(false);
        return;
      }

      // Fetch new token from API
      const response = await fetch('/api/csrf', { method: 'GET' });
      if (response.ok) {
        const data = await response.json();
        setToken(data.token);
        sessionStorage.setItem(CSRF_STORAGE_KEY, data.token);
      }
    } catch (error) {
      console.error('Failed to fetch CSRF token:', error);
    } finally {
      setLoading(false);
    }
  };

  // Refresh token
  const refreshToken = useCallback(async () => {
    sessionStorage.removeItem(CSRF_STORAGE_KEY);
    await fetchToken();
  }, []);

  // Get headers with CSRF token
  const getHeaders = useCallback((): Record<string, string> => {
    if (!token) return {};
    return { [CSRF_HEADER_NAME]: token };
  }, [token]);

  // Enhanced fetch with CSRF token
  const secureFetch = useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      const headers = new Headers(options.headers);
      
      // Add CSRF token for non-GET requests
      if (token && options.method && !['GET', 'HEAD', 'OPTIONS'].includes(options.method.toUpperCase())) {
        headers.set(CSRF_HEADER_NAME, token);
      }

      const response = await fetch(url, { ...options, headers });

      // If we get a 403, try refreshing the token
      if (response.status === 403) {
        const data = await response.clone().json().catch(() => ({}));
        if (data.message?.includes('CSRF')) {
          await refreshToken();
        }
      }

      return response;
    },
    [token, refreshToken]
  );

  return {
    token,
    loading,
    refreshToken,
    getHeaders,
    secureFetch,
  };
}

/**
 * Add CSRF token to fetch options
 */
export function withCSRFToken(
  options: RequestInit = {},
  token: string | null
): RequestInit {
  if (!token) return options;
  
  const headers = new Headers(options.headers);
  headers.set(CSRF_HEADER_NAME, token);
  
  return { ...options, headers };
}
