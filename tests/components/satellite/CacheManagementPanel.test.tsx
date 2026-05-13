/**
 * Tests for CacheManagementPanel Component
 * 
 * Requirements: Task 6.1.5
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CacheManagementPanel } from '@/components/satellite/CacheManagementPanel';
import { useCacheManagement } from '@/hooks/satellite/useCacheManagement';

// Mock the useCacheManagement hook
vi.mock('@/hooks/satellite/useCacheManagement');

const mockUseCacheManagement = useCacheManagement as any;

describe('CacheManagementPanel', () => {
  const mockStats = {
    totalEntries: 15,
    totalSizeBytes: 2048000, // ~2 MB
    uniqueParcelles: 8,
    entriesByType: {
      imagery: 8,
      ndvi: 5,
      bands: 2,
    },
    oldestEntry: new Date('2024-01-01'),
    newestEntry: new Date('2024-01-10'),
  };

  const mockHookReturn = {
    stats: mockStats,
    loading: false,
    error: null,
    refreshStats: vi.fn(),
    clearAllCache: vi.fn(),
    clearParcelleCache: vi.fn(),
    clearExpiredCache: vi.fn(),
    getParcelleCacheInfo: vi.fn(),
    getCacheStatus: vi.fn(),
    cacheHitRate: 60,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCacheManagement.mockReturnValue(mockHookReturn);
    global.confirm = vi.fn(() => true) as any;
  });

  describe('Rendering', () => {
    it('should render cache statistics', () => {
      render(<CacheManagementPanel />);

      expect(screen.getByText('Cache Management')).toBeInTheDocument();
      expect(screen.getByText('15')).toBeInTheDocument(); // Total entries
      expect(screen.getByText('1.95 MB')).toBeInTheDocument(); // Cache size
      expect(screen.getByText('8')).toBeInTheDocument(); // Cached parcelles
      expect(screen.getByText('60%')).toBeInTheDocument(); // Hit rate
    });

    it('should render loading state', () => {
      mockUseCacheManagement.mockReturnValue({
        ...mockHookReturn,
        stats: null,
        loading: true,
      });

      render(<CacheManagementPanel />);

      expect(screen.getByText('Loading cache statistics...')).toBeInTheDocument();
    });

    it('should render error state', () => {
      mockUseCacheManagement.mockReturnValue({
        ...mockHookReturn,
        stats: null,
        error: 'Failed to load cache',
      });

      render(<CacheManagementPanel />);

      expect(screen.getByText(/Error loading cache statistics/)).toBeInTheDocument();
      expect(screen.getByText(/Failed to load cache/)).toBeInTheDocument();
    });

    it('should render detailed statistics when showDetails is true', () => {
      render(<CacheManagementPanel showDetails />);

      expect(screen.getByText('Entries by Type')).toBeInTheDocument();
      expect(screen.getByText('Cache Age')).toBeInTheDocument();
      expect(screen.getByText('Cache Status')).toBeInTheDocument();
    });

    it('should not render detailed statistics when showDetails is false', () => {
      render(<CacheManagementPanel showDetails={false} />);

      expect(screen.queryByText('Entries by Type')).not.toBeInTheDocument();
      expect(screen.queryByText('Cache Age')).not.toBeInTheDocument();
    });
  });

  describe('Actions', () => {
    it('should refresh cache stats when refresh button is clicked', async () => {
      render(<CacheManagementPanel />);

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(mockHookReturn.refreshStats).toHaveBeenCalledTimes(1);
      });
    });

    it('should clear all cache when clear all button is clicked', async () => {
      mockHookReturn.clearAllCache.mockResolvedValue(true);

      render(<CacheManagementPanel />);

      const clearAllButton = screen.getByRole('button', { name: /clear all cache/i });
      fireEvent.click(clearAllButton);

      expect(global.confirm).toHaveBeenCalledWith(
        'Are you sure you want to clear all cached satellite data? This cannot be undone.'
      );

      await waitFor(() => {
        expect(mockHookReturn.clearAllCache).toHaveBeenCalledTimes(1);
      });
    });

    it('should not clear cache if user cancels confirmation', async () => {
      global.confirm = vi.fn(() => false) as any;

      render(<CacheManagementPanel />);

      const clearAllButton = screen.getByRole('button', { name: /clear all cache/i });
      fireEvent.click(clearAllButton);

      expect(global.confirm).toHaveBeenCalled();
      expect(mockHookReturn.clearAllCache).not.toHaveBeenCalled();
    });

    it('should clear expired cache when clear expired button is clicked', async () => {
      mockHookReturn.clearExpiredCache.mockResolvedValue(3);

      render(<CacheManagementPanel />);

      const clearExpiredButton = screen.getByRole('button', { name: /clear expired/i });
      fireEvent.click(clearExpiredButton);

      await waitFor(() => {
        expect(mockHookReturn.clearExpiredCache).toHaveBeenCalledTimes(1);
      });
    });

    it('should clear parcelle cache when parcelleId is provided', async () => {
      mockHookReturn.clearParcelleCache.mockResolvedValue(true);

      render(<CacheManagementPanel parcelleId="parcelle-123" />);

      const clearParcelleButton = screen.getByRole('button', { name: /clear this parcelle/i });
      fireEvent.click(clearParcelleButton);

      expect(global.confirm).toHaveBeenCalledWith(
        'Are you sure you want to clear cached data for this parcelle?'
      );

      await waitFor(() => {
        expect(mockHookReturn.clearParcelleCache).toHaveBeenCalledWith('parcelle-123');
      });
    });

    it('should not show clear parcelle button when parcelleId is not provided', () => {
      render(<CacheManagementPanel />);

      expect(screen.queryByRole('button', { name: /clear this parcelle/i })).not.toBeInTheDocument();
    });

    it('should disable clear all button when cache is empty', () => {
      mockUseCacheManagement.mockReturnValue({
        ...mockHookReturn,
        stats: {
          ...mockStats,
          totalEntries: 0,
        },
      });

      render(<CacheManagementPanel />);

      const clearAllButton = screen.getByRole('button', { name: /clear all cache/i });
      expect(clearAllButton).toBeDisabled();
    });
  });

  describe('Callbacks', () => {
    it('should call onCacheCleared callback when cache is cleared', async () => {
      const onCacheCleared = jest.fn();
      mockHookReturn.clearAllCache.mockResolvedValue(true);

      render(<CacheManagementPanel onCacheCleared={onCacheCleared} />);

      const clearAllButton = screen.getByRole('button', { name: /clear all cache/i });
      fireEvent.click(clearAllButton);

      await waitFor(() => {
        expect(onCacheCleared).toHaveBeenCalledTimes(1);
      });
    });

    it('should call onCacheRefreshed callback when cache is refreshed', async () => {
      const onCacheRefreshed = jest.fn();

      render(<CacheManagementPanel onCacheRefreshed={onCacheRefreshed} />);

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(onCacheRefreshed).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Cache Status Display', () => {
    it('should show healthy status when cache is below 40 parcelles', () => {
      mockUseCacheManagement.mockReturnValue({
        ...mockHookReturn,
        stats: {
          ...mockStats,
          uniqueParcelles: 30,
        },
      });

      render(<CacheManagementPanel showDetails />);

      expect(screen.getByText('Healthy')).toBeInTheDocument();
      expect(screen.getByText('20 parcelle slots available')).toBeInTheDocument();
    });

    it('should show near limit status when cache is between 40-47 parcelles', () => {
      mockUseCacheManagement.mockReturnValue({
        ...mockHookReturn,
        stats: {
          ...mockStats,
          uniqueParcelles: 45,
        },
      });

      render(<CacheManagementPanel showDetails />);

      expect(screen.getByText('Near Limit')).toBeInTheDocument();
      expect(screen.getByText('5 parcelle slots available')).toBeInTheDocument();
    });

    it('should show at capacity status when cache is at or above 48 parcelles', () => {
      mockUseCacheManagement.mockReturnValue({
        ...mockHookReturn,
        stats: {
          ...mockStats,
          uniqueParcelles: 50,
        },
      });

      render(<CacheManagementPanel showDetails />);

      expect(screen.getByText('At Capacity')).toBeInTheDocument();
      expect(screen.getByText('0 parcelle slots available')).toBeInTheDocument();
    });

    it('should display cache hit rate with correct color', () => {
      // High hit rate (green)
      mockUseCacheManagement.mockReturnValue({
        ...mockHookReturn,
        cacheHitRate: 80,
      });

      const { rerender } = render(<CacheManagementPanel />);
      let hitRateElement = screen.getByText('80%');
      expect(hitRateElement).toHaveClass('text-green-600');

      // Medium hit rate (yellow)
      mockUseCacheManagement.mockReturnValue({
        ...mockHookReturn,
        cacheHitRate: 50,
      });

      rerender(<CacheManagementPanel />);
      hitRateElement = screen.getByText('50%');
      expect(hitRateElement).toHaveClass('text-yellow-600');

      // Low hit rate (red)
      mockUseCacheManagement.mockReturnValue({
        ...mockHookReturn,
        cacheHitRate: 20,
      });

      rerender(<CacheManagementPanel />);
      hitRateElement = screen.getByText('20%');
      expect(hitRateElement).toHaveClass('text-red-600');
    });
  });

  describe('Entries by Type', () => {
    it('should display breakdown of entries by type', () => {
      render(<CacheManagementPanel showDetails />);

      expect(screen.getByText('Imagery:')).toBeInTheDocument();
      expect(screen.getByText('NDVI:')).toBeInTheDocument();
      expect(screen.getByText('Bands:')).toBeInTheDocument();

      // Check counts
      const imageryCount = screen.getByText('8');
      const ndviCount = screen.getByText('5');
      const bandsCount = screen.getByText('2');

      expect(imageryCount).toBeInTheDocument();
      expect(ndviCount).toBeInTheDocument();
      expect(bandsCount).toBeInTheDocument();
    });
  });
});
