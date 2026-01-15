// CocoaTrack V2 - Signed URL Hook
// Hook for fetching and caching signed URLs for photos

import { useState, useEffect, useCallback } from 'react';

interface SignedUrlState {
  url: string | null;
  loading: boolean;
  error: string | null;
}

// Simple in-memory cache for signed URLs
const urlCache = new Map<string, { url: string; expiresAt: number }>();

/**
 * Hook to fetch a signed URL for a photo
 * Caches URLs to avoid unnecessary API calls
 */
export function useSignedUrl(path: string | null): SignedUrlState {
  const [state, setState] = useState<SignedUrlState>({
    url: null,
    loading: false,
    error: null,
  });

  const fetchSignedUrl = useCallback(async () => {
    if (!path) {
      setState({ url: null, loading: false, error: null });
      return;
    }

    // Check cache first
    const cached = urlCache.get(path);
    if (cached && cached.expiresAt > Date.now()) {
      setState({ url: cached.url, loading: false, error: null });
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch(`/api/photos/signed?path=${encodeURIComponent(path)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch signed URL');
      }

      // Cache the URL (expire 5 minutes before actual expiry for safety)
      const expiresAt = Date.now() + (data.expiresIn - 300) * 1000;
      urlCache.set(path, { url: data.url, expiresAt });

      setState({ url: data.url, loading: false, error: null });
    } catch (err) {
      setState({
        url: null,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch signed URL',
      });
    }
  }, [path]);

  useEffect(() => {
    fetchSignedUrl();
  }, [fetchSignedUrl]);

  return state;
}

/**
 * Hook to fetch multiple signed URLs
 */
export function useSignedUrls(paths: string[]): Map<string, SignedUrlState> {
  const [states, setStates] = useState<Map<string, SignedUrlState>>(new Map());

  useEffect(() => {
    const fetchAll = async () => {
      const newStates = new Map<string, SignedUrlState>();

      await Promise.all(
        paths.map(async (path) => {
          // Check cache first
          const cached = urlCache.get(path);
          if (cached && cached.expiresAt > Date.now()) {
            newStates.set(path, { url: cached.url, loading: false, error: null });
            return;
          }

          newStates.set(path, { url: null, loading: true, error: null });

          try {
            const response = await fetch(`/api/photos/signed?path=${encodeURIComponent(path)}`);
            const data = await response.json();

            if (!response.ok) {
              throw new Error(data.error || 'Failed to fetch signed URL');
            }

            // Cache the URL
            const expiresAt = Date.now() + (data.expiresIn - 300) * 1000;
            urlCache.set(path, { url: data.url, expiresAt });

            newStates.set(path, { url: data.url, loading: false, error: null });
          } catch (err) {
            newStates.set(path, {
              url: null,
              loading: false,
              error: err instanceof Error ? err.message : 'Failed to fetch signed URL',
            });
          }
        })
      );

      setStates(newStates);
    };

    if (paths.length > 0) {
      fetchAll();
    }
  }, [JSON.stringify(paths)]);

  return states;
}

/**
 * Clear the URL cache (useful for testing or when photos are deleted)
 */
export function clearSignedUrlCache(): void {
  urlCache.clear();
}

/**
 * Remove a specific path from the cache
 */
export function invalidateSignedUrl(path: string): void {
  urlCache.delete(path);
}
