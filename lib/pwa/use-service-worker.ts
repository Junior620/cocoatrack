// CocoaTrack V2 - Service Worker React Hook
// Requirements: REQ-SW-001, REQ-SW-002

'use client';

import { useEffect, useState, useCallback } from 'react';

import {
  registerServiceWorker,
  skipWaiting,
  isPWA,
  cacheReferentialData,
} from './service-worker';
import { getSWUpdateManager, type SWUpdateState, type SafetyCheckResult } from './sw-update-manager';

export interface ServiceWorkerState {
  isSupported: boolean;
  isRegistered: boolean;
  isUpdateAvailable: boolean;
  isPWA: boolean;
  isLoading: boolean;
  error: Error | null;
  updateState: SWUpdateState;
  currentVersion: string | null;
}

export interface UseServiceWorkerReturn extends ServiceWorkerState {
  update: () => Promise<void>;
  forceUpdate: () => Promise<void>;
  dismissUpdate: (days?: number) => void;
  checkForUpdate: () => Promise<boolean>;
  canSafelyUpdate: () => Promise<SafetyCheckResult>;
  shouldShowUpdateNotification: () => boolean;
  cacheData: (urls: string[]) => Promise<void>;
}

/**
 * React hook for managing service worker state and updates
 * Integrates with SWUpdateManager for safe updates
 */
export function useServiceWorker(): UseServiceWorkerReturn {
  const [state, setState] = useState<ServiceWorkerState>({
    isSupported: false,
    isRegistered: false,
    isUpdateAvailable: false,
    isPWA: false,
    isLoading: true,
    error: null,
    updateState: 'idle',
    currentVersion: null,
  });

  useEffect(() => {
    // Check support
    const supported =
      typeof window !== 'undefined' && 'serviceWorker' in navigator;

    setState((prev) => ({
      ...prev,
      isSupported: supported,
      isPWA: isPWA(),
    }));

    if (!supported) {
      setState((prev) => ({ ...prev, isLoading: false }));
      return;
    }

    // Get update manager instance
    const updateManager = getSWUpdateManager();

    // Register service worker
    registerServiceWorker()
      .then((wb) => {
        setState((prev) => ({
          ...prev,
          isRegistered: wb !== null,
          isLoading: false,
          currentVersion: updateManager.getCurrentVersion(),
        }));
      })
      .catch((error) => {
        setState((prev) => ({
          ...prev,
          error: error as Error,
          isLoading: false,
        }));
      });

    // Listen for update available event
    const handleUpdateAvailable = () => {
      setState((prev) => ({ 
        ...prev, 
        isUpdateAvailable: true,
        updateState: 'update_available',
      }));
    };

    window.addEventListener('sw-update-available', handleUpdateAvailable);

    return () => {
      window.removeEventListener('sw-update-available', handleUpdateAvailable);
    };
  }, []);

  const update = useCallback(async () => {
    const updateManager = getSWUpdateManager();
    try {
      await updateManager.applyUpdate();
      setState((prev) => ({ ...prev, isUpdateAvailable: false, updateState: 'activating' }));
    } catch (error) {
      console.error('Failed to apply update:', error);
      throw error;
    }
  }, []);

  const forceUpdate = useCallback(async () => {
    const updateManager = getSWUpdateManager();
    await updateManager.forceUpdate();
    setState((prev) => ({ ...prev, isUpdateAvailable: false, updateState: 'activating' }));
  }, []);

  const dismissUpdate = useCallback((days: number = 1) => {
    const updateManager = getSWUpdateManager();
    updateManager.dismissUpdate(days);
    setState((prev) => ({ ...prev, isUpdateAvailable: false }));
  }, []);

  const checkForUpdate = useCallback(async (): Promise<boolean> => {
    const updateManager = getSWUpdateManager();
    setState((prev) => ({ ...prev, updateState: 'checking' }));
    const hasUpdate = await updateManager.checkForUpdate();
    setState((prev) => ({ 
      ...prev, 
      isUpdateAvailable: hasUpdate,
      updateState: hasUpdate ? 'update_available' : 'idle',
    }));
    return hasUpdate;
  }, []);

  const canSafelyUpdate = useCallback(async (): Promise<SafetyCheckResult> => {
    const updateManager = getSWUpdateManager();
    return updateManager.canSafelyUpdate();
  }, []);

  const shouldShowUpdateNotification = useCallback((): boolean => {
    const updateManager = getSWUpdateManager();
    return updateManager.shouldShowUpdateNotification();
  }, []);

  const cacheData = useCallback(async (urls: string[]) => {
    await cacheReferentialData(urls);
  }, []);

  return {
    ...state,
    update,
    forceUpdate,
    dismissUpdate,
    checkForUpdate,
    canSafelyUpdate,
    shouldShowUpdateNotification,
    cacheData,
  };
}
