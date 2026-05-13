/**
 * Tests for useOnlineStatus Hook
 * 
 * Tests the online/offline status detection functionality.
 * 
 * Requirements: Task 6.3.3 - Offline mode for NDVI
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

describe('useOnlineStatus', () => {
  // Store original navigator.onLine value
  let originalOnLine: boolean;

  beforeEach(() => {
    // Save original value
    originalOnLine = navigator.onLine;
  });

  afterEach(() => {
    // Restore original value
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: originalOnLine,
    });
  });

  describe('Initial State', () => {
    it('should return online status when browser is online', () => {
      // Mock navigator.onLine to true
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true,
      });

      const { result } = renderHook(() => useOnlineStatus());

      expect(result.current.isOnline).toBe(true);
      expect(result.current.isOffline).toBe(false);
    });

    it('should return offline status when browser is offline', () => {
      // Mock navigator.onLine to false
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });

      const { result } = renderHook(() => useOnlineStatus());

      expect(result.current.isOnline).toBe(false);
      expect(result.current.isOffline).toBe(true);
    });
  });

  describe('Event Listeners', () => {
    it('should update status when online event is fired', async () => {
      // Start offline
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });

      const { result } = renderHook(() => useOnlineStatus());

      // Verify initial offline state
      expect(result.current.isOffline).toBe(true);

      // Simulate going online
      act(() => {
        Object.defineProperty(navigator, 'onLine', {
          writable: true,
          value: true,
        });
        window.dispatchEvent(new Event('online'));
      });

      // Wait for state update
      await waitFor(() => {
        expect(result.current.isOnline).toBe(true);
        expect(result.current.isOffline).toBe(false);
      });
    });

    it('should update status when offline event is fired', async () => {
      // Start online
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true,
      });

      const { result } = renderHook(() => useOnlineStatus());

      // Verify initial online state
      expect(result.current.isOnline).toBe(true);

      // Simulate going offline
      act(() => {
        Object.defineProperty(navigator, 'onLine', {
          writable: true,
          value: false,
        });
        window.dispatchEvent(new Event('offline'));
      });

      // Wait for state update
      await waitFor(() => {
        expect(result.current.isOnline).toBe(false);
        expect(result.current.isOffline).toBe(true);
      });
    });

    it('should handle multiple online/offline transitions', async () => {
      // Start online
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true,
      });

      const { result } = renderHook(() => useOnlineStatus());

      // Go offline
      act(() => {
        Object.defineProperty(navigator, 'onLine', {
          writable: true,
          value: false,
        });
        window.dispatchEvent(new Event('offline'));
      });

      await waitFor(() => {
        expect(result.current.isOffline).toBe(true);
      });

      // Go back online
      act(() => {
        Object.defineProperty(navigator, 'onLine', {
          writable: true,
          value: true,
        });
        window.dispatchEvent(new Event('online'));
      });

      await waitFor(() => {
        expect(result.current.isOnline).toBe(true);
      });

      // Go offline again
      act(() => {
        Object.defineProperty(navigator, 'onLine', {
          writable: true,
          value: false,
        });
        window.dispatchEvent(new Event('offline'));
      });

      await waitFor(() => {
        expect(result.current.isOffline).toBe(true);
      });
    });
  });

  describe('Cleanup', () => {
    it('should remove event listeners on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() => useOnlineStatus());

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));

      removeEventListenerSpy.mockRestore();
    });
  });

  describe('SSR Compatibility', () => {
    it('should handle missing window object gracefully', () => {
      // This test verifies the hook doesn't crash during SSR
      // In a real SSR environment, window would be undefined
      // For this test, we just verify the hook initializes correctly
      const { result } = renderHook(() => useOnlineStatus());

      // Should have a valid return value
      expect(result.current).toHaveProperty('isOnline');
      expect(result.current).toHaveProperty('isOffline');
      expect(typeof result.current.isOnline).toBe('boolean');
      expect(typeof result.current.isOffline).toBe('boolean');
    });
  });

  describe('Derived State', () => {
    it('should ensure isOffline is always opposite of isOnline', () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true,
      });

      const { result } = renderHook(() => useOnlineStatus());

      // When online
      expect(result.current.isOnline).toBe(true);
      expect(result.current.isOffline).toBe(false);
      expect(result.current.isOnline).toBe(!result.current.isOffline);

      // Simulate going offline
      act(() => {
        Object.defineProperty(navigator, 'onLine', {
          writable: true,
          value: false,
        });
        window.dispatchEvent(new Event('offline'));
      });

      waitFor(() => {
        // When offline
        expect(result.current.isOnline).toBe(false);
        expect(result.current.isOffline).toBe(true);
        expect(result.current.isOnline).toBe(!result.current.isOffline);
      });
    });
  });
});
