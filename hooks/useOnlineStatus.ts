/**
 * useOnlineStatus Hook
 * 
 * Detects and tracks the browser's online/offline status.
 * Uses the Navigator.onLine API and listens to online/offline events.
 * 
 * This hook is essential for implementing offline-first features,
 * allowing the application to gracefully handle network connectivity changes.
 * 
 * Requirements: Task 6.3.3 - Offline mode for NDVI
 */

import { useState, useEffect } from 'react';

/**
 * Hook return value
 */
interface UseOnlineStatusReturn {
  /** Whether the browser is currently online */
  isOnline: boolean;
  /** Whether the browser is currently offline */
  isOffline: boolean;
}

/**
 * useOnlineStatus Hook
 * 
 * Monitors the browser's network connectivity status and provides
 * real-time updates when the status changes.
 * 
 * The hook uses:
 * - `navigator.onLine` to get the initial online status
 * - `online` event to detect when connectivity is restored
 * - `offline` event to detect when connectivity is lost
 * 
 * Note: `navigator.onLine` is not 100% reliable across all browsers
 * and network conditions. It indicates whether the browser has a
 * network connection, but not necessarily internet access.
 * 
 * @returns Object with isOnline and isOffline boolean flags
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isOnline, isOffline } = useOnlineStatus();
 * 
 *   if (isOffline) {
 *     return <div>You are offline. Some features may be limited.</div>;
 *   }
 * 
 *   return <div>You are online.</div>;
 * }
 * ```
 */
export function useOnlineStatus(): UseOnlineStatusReturn {
  // Initialize with current online status
  // Use a function to avoid SSR issues (navigator is not available on server)
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    // Check if we're in a browser environment
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      return navigator.onLine;
    }
    // Default to online for SSR
    return true;
  });

  useEffect(() => {
    // Only run in browser environment
    if (typeof window === 'undefined') {
      return;
    }

    /**
     * Handle online event
     * Fired when the browser gains network connectivity
     */
    const handleOnline = () => {
      console.log('[useOnlineStatus] Network connection restored');
      setIsOnline(true);
    };

    /**
     * Handle offline event
     * Fired when the browser loses network connectivity
     */
    const handleOffline = () => {
      console.log('[useOnlineStatus] Network connection lost');
      setIsOnline(false);
    };

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Cleanup event listeners on unmount
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    isOnline,
    isOffline: !isOnline,
  };
}
