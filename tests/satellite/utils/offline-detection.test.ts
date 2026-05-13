/**
 * Tests for Offline Detection Utility
 * 
 * Requirements: Task 6.3.2
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isOnline,
  isOffline,
  getNetworkStatus,
  onNetworkStatusChange,
  isCacheStale,
  getCacheAgeString,
  formatCacheDate,
} from '@/lib/satellite/utils/offline-detection';

describe('Offline Detection Utility', () => {
  describe('isOnline', () => {
    it('should return true when navigator.onLine is true', () => {
      // Mock navigator.onLine
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true,
      });

      expect(isOnline()).toBe(true);
    });

    it('should return false when navigator.onLine is false', () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });

      expect(isOffline()).toBe(true);
      expect(isOnline()).toBe(false);
    });
  });

  describe('getNetworkStatus', () => {
    it('should return "online" when navigator.onLine is true', () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true,
      });

      expect(getNetworkStatus()).toBe('online');
    });

    it('should return "offline" when navigator.onLine is false', () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });

      expect(getNetworkStatus()).toBe('offline');
    });
  });

  describe('onNetworkStatusChange', () => {
    let cleanup: (() => void) | null = null;

    afterEach(() => {
      if (cleanup) {
        cleanup();
        cleanup = null;
      }
    });

    it('should call callback when online event fires', () => {
      const callback = vi.fn();
      cleanup = onNetworkStatusChange(callback);

      // Simulate online event
      window.dispatchEvent(new Event('online'));

      expect(callback).toHaveBeenCalledWith('online');
    });

    it('should call callback when offline event fires', () => {
      const callback = vi.fn();
      cleanup = onNetworkStatusChange(callback);

      // Simulate offline event
      window.dispatchEvent(new Event('offline'));

      expect(callback).toHaveBeenCalledWith('offline');
    });

    it('should remove event listeners when cleanup is called', () => {
      const callback = vi.fn();
      cleanup = onNetworkStatusChange(callback);

      // Call cleanup
      cleanup();
      cleanup = null;

      // Simulate events after cleanup
      window.dispatchEvent(new Event('online'));
      window.dispatchEvent(new Event('offline'));

      // Callback should not be called
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('isCacheStale', () => {
    it('should return false for data cached less than 30 days ago', () => {
      const cacheDate = new Date();
      cacheDate.setDate(cacheDate.getDate() - 15); // 15 days ago

      expect(isCacheStale(cacheDate)).toBe(false);
    });

    it('should return true for data cached more than 30 days ago', () => {
      const cacheDate = new Date();
      cacheDate.setDate(cacheDate.getDate() - 35); // 35 days ago

      expect(isCacheStale(cacheDate)).toBe(true);
    });

    it('should return false for data cached exactly 30 days ago', () => {
      const cacheDate = new Date();
      cacheDate.setDate(cacheDate.getDate() - 30); // Exactly 30 days ago

      expect(isCacheStale(cacheDate)).toBe(false);
    });

    it('should support custom stale threshold', () => {
      const cacheDate = new Date();
      cacheDate.setDate(cacheDate.getDate() - 10); // 10 days ago

      expect(isCacheStale(cacheDate, 7)).toBe(true); // Stale after 7 days
      expect(isCacheStale(cacheDate, 15)).toBe(false); // Not stale after 15 days
    });
  });

  describe('getCacheAgeString', () => {
    it('should return "just now" for very recent cache', () => {
      const cacheDate = new Date();
      expect(getCacheAgeString(cacheDate)).toBe('just now');
    });

    it('should return minutes for cache less than 1 hour old', () => {
      const cacheDate = new Date();
      cacheDate.setMinutes(cacheDate.getMinutes() - 30); // 30 minutes ago

      expect(getCacheAgeString(cacheDate)).toBe('30 minutes ago');
    });

    it('should return hours for cache less than 1 day old', () => {
      const cacheDate = new Date();
      cacheDate.setHours(cacheDate.getHours() - 5); // 5 hours ago

      expect(getCacheAgeString(cacheDate)).toBe('5 hours ago');
    });

    it('should return days for cache less than 1 week old', () => {
      const cacheDate = new Date();
      cacheDate.setDate(cacheDate.getDate() - 3); // 3 days ago

      expect(getCacheAgeString(cacheDate)).toBe('3 days ago');
    });

    it('should return weeks for cache less than 1 month old', () => {
      const cacheDate = new Date();
      cacheDate.setDate(cacheDate.getDate() - 14); // 2 weeks ago

      expect(getCacheAgeString(cacheDate)).toBe('2 weeks ago');
    });

    it('should return months for cache more than 1 month old', () => {
      const cacheDate = new Date();
      cacheDate.setDate(cacheDate.getDate() - 60); // ~2 months ago

      const result = getCacheAgeString(cacheDate);
      // Should be either 1 or 2 months depending on exact calculation
      expect(result).toMatch(/[12] months? ago/);
    });

    it('should use singular form for 1 unit', () => {
      const oneMinuteAgo = new Date();
      oneMinuteAgo.setMinutes(oneMinuteAgo.getMinutes() - 1);
      expect(getCacheAgeString(oneMinuteAgo)).toBe('1 minute ago');

      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);
      expect(getCacheAgeString(oneHourAgo)).toBe('1 hour ago');

      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      expect(getCacheAgeString(oneDayAgo)).toBe('1 day ago');

      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      expect(getCacheAgeString(oneWeekAgo)).toBe('1 week ago');

      const oneMonthAgo = new Date();
      oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
      expect(getCacheAgeString(oneMonthAgo)).toBe('1 month ago');
    });
  });

  describe('formatCacheDate', () => {
    it('should format date in readable format', () => {
      const cacheDate = new Date('2024-01-15T10:30:00Z');
      const formatted = formatCacheDate(cacheDate);

      // Format should include month, day, year, and time
      // Note: Time may vary based on timezone
      expect(formatted).toMatch(/Jan/);
      expect(formatted).toMatch(/15/);
      expect(formatted).toMatch(/2024/);
      expect(formatted).toMatch(/\d{1,2}:\d{2}/); // Match any time format
    });

    it('should handle different dates correctly', () => {
      const dates = [
        new Date('2024-12-25T15:45:00Z'),
        new Date('2023-06-01T08:00:00Z'),
        new Date('2024-03-10T23:59:00Z'),
      ];

      dates.forEach((date) => {
        const formatted = formatCacheDate(date);
        expect(formatted).toBeTruthy();
        expect(typeof formatted).toBe('string');
      });
    });
  });
});
