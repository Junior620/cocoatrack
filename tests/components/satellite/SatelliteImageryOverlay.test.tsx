/**
 * Component Tests for SatelliteImageryOverlay
 * 
 * This test suite validates the SatelliteImageryOverlay component behavior including:
 * - Component rendering
 * - Loading state display
 * - Error state display with retry functionality
 * - Opacity control functionality
 * - Imagery data display
 * - API integration
 * 
 * Task: 1.5.5 - Write component tests
 * Spec: .kiro/specs/satellite-imagery-analysis/tasks.md
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { SatelliteImageryOverlay } from '@/components/satellite/SatelliteImageryOverlay';
import type { ImageryData } from '@/lib/satellite/types';

// Mock fetch globally
global.fetch = vi.fn();

describe('SatelliteImageryOverlay Component', () => {
  // Mock imagery data for testing
  const mockImageryData: ImageryData = {
    id: 'test-imagery-id-001',
    parcelleId: 'parcelle-test-123',
    acquisitionDate: new Date('2024-01-15T10:30:00Z'),
    cloudCoverPercent: 15.5,
    satelliteSource: 'sentinel-2',
    tileUrl: 'https://storage.example.com/satellite-imagery/tile-001.png',
    bounds: [-10.5, -10.5, 10.5, 10.5],
    resolutionMeters: 10,
    createdAt: new Date('2024-01-16T08:00:00Z'),
  };

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up after each test
    cleanup();
  });

  describe('Component Rendering', () => {
    it('should render without crashing', () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise(() => {})
      );

      const { container } = render(
        <SatelliteImageryOverlay parcelleId="parcelle-123" />
      );

      expect(container.querySelector('.satellite-imagery-overlay')).toBeInTheDocument();
    });

    it('should render with all required props', () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise(() => {})
      );

      const onOpacityChange = vi.fn();
      const onError = vi.fn();
      const onImageryLoaded = vi.fn();

      render(
        <SatelliteImageryOverlay
          parcelleId="parcelle-123"
          date={new Date('2024-01-15')}
          opacity={0.8}
          onOpacityChange={onOpacityChange}
          onError={onError}
          onImageryLoaded={onImageryLoaded}
          cloudCoverThreshold={25}
        />
      );

      expect(screen.getByText(/Chargement de l'imagerie satellite/i)).toBeInTheDocument();
    });

    it('should not render when parcelleId is empty', () => {
      const { container } = render(
        <SatelliteImageryOverlay parcelleId="" />
      );

      // Should render the container but not trigger fetch
      expect(container.querySelector('.satellite-imagery-overlay')).toBeInTheDocument();
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Loading State Display', () => {
    it('should display loading spinner when fetching imagery', () => {
      // Mock fetch to never resolve (simulates loading state)
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise(() => {})
      );

      render(<SatelliteImageryOverlay parcelleId="parcelle-123" />);

      // Check for loading text
      expect(screen.getByText(/Chargement de l'imagerie satellite/i)).toBeInTheDocument();
    });

    it('should show loading spinner with correct styling', () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise(() => {})
      );

      const { container } = render(
        <SatelliteImageryOverlay parcelleId="parcelle-123" />
      );

      // Check for spinner element with animation class
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
      expect(spinner).toHaveClass('h-12', 'w-12', 'rounded-full');
    });

    it('should display loading state immediately on mount', () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise(() => {})
      );

      const { container } = render(
        <SatelliteImageryOverlay parcelleId="parcelle-123" />
      );

      // Loading state should be visible immediately
      const loadingContainer = container.querySelector('.z-\\[1000\\]');
      expect(loadingContainer).toBeInTheDocument();
    });

    it('should hide loading state after successful fetch', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ imagery: mockImageryData }),
      });

      render(<SatelliteImageryOverlay parcelleId="parcelle-123" />);

      // Initially loading
      expect(screen.getByText(/Chargement de l'imagerie satellite/i)).toBeInTheDocument();

      // Wait for loading to disappear
      await waitFor(() => {
        expect(screen.queryByText(/Chargement de l'imagerie satellite/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Error State Display', () => {
    it('should display error message when fetch fails', async () => {
      const errorMessage = 'Failed to fetch imagery: Network error';
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error(errorMessage)
      );

      render(<SatelliteImageryOverlay parcelleId="parcelle-123" />);

      await waitFor(() => {
        expect(screen.getByText(/Erreur de chargement/i)).toBeInTheDocument();
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
    });

    it('should display error icon in error state', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Test error')
      );

      const { container } = render(
        <SatelliteImageryOverlay parcelleId="parcelle-123" />
      );

      await waitFor(() => {
        const errorIcon = container.querySelector('.text-red-600');
        expect(errorIcon).toBeInTheDocument();
      });
    });

    it('should display retry button in error state', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Network error')
      );

      render(<SatelliteImageryOverlay parcelleId="parcelle-123" />);

      await waitFor(() => {
        const retryButton = screen.getByRole('button', { name: /Réessayer/i });
        expect(retryButton).toBeInTheDocument();
        expect(retryButton).toHaveClass('bg-blue-600');
      });
    });

    it('should retry fetch when retry button is clicked', async () => {
      // First call fails
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Network error')
      );

      render(<SatelliteImageryOverlay parcelleId="parcelle-123" />);

      await waitFor(() => {
        expect(screen.getByText(/Erreur de chargement/i)).toBeInTheDocument();
      });

      // Second call succeeds
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ imagery: mockImageryData }),
      });

      const retryButton = screen.getByRole('button', { name: /Réessayer/i });
      fireEvent.click(retryButton);

      // Error should disappear
      await waitFor(() => {
        expect(screen.queryByText(/Erreur de chargement/i)).not.toBeInTheDocument();
      });

      // Imagery controls should appear
      await waitFor(() => {
        expect(screen.getByText(/Imagerie Satellite/i)).toBeInTheDocument();
      });
    });

    it('should call onError callback when error occurs', async () => {
      const onError = vi.fn();
      const error = new Error('Test error message');
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);

      render(
        <SatelliteImageryOverlay parcelleId="parcelle-123" onError={onError} />
      );

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(error);
        expect(onError).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle API error responses with error messages', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'Imagery unavailable for this date' }),
      });

      render(<SatelliteImageryOverlay parcelleId="parcelle-123" />);

      await waitFor(() => {
        expect(screen.getByText(/Imagery unavailable for this date/i)).toBeInTheDocument();
      });
    });

    it('should handle API error responses without error messages', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request',
        json: async () => ({}),
      });

      render(<SatelliteImageryOverlay parcelleId="parcelle-123" />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to fetch imagery: Bad Request/i)).toBeInTheDocument();
      });
    });

    it('should not show loading state when in error state', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Test error')
      );

      render(<SatelliteImageryOverlay parcelleId="parcelle-123" />);

      await waitFor(() => {
        expect(screen.getByText(/Erreur de chargement/i)).toBeInTheDocument();
      });

      // Loading spinner should not be visible
      expect(screen.queryByText(/Chargement de l'imagerie satellite/i)).not.toBeInTheDocument();
    });
  });

  describe('Opacity Control', () => {
    it('should display opacity slider when imagery loads', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ imagery: mockImageryData }),
      });

      render(<SatelliteImageryOverlay parcelleId="parcelle-123" />);

      await waitFor(() => {
        const slider = screen.getByLabelText(/Opacité/i);
        expect(slider).toBeInTheDocument();
        expect(slider).toHaveAttribute('type', 'range');
      });
    });

    it('should initialize opacity slider with default value', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ imagery: mockImageryData }),
      });

      render(<SatelliteImageryOverlay parcelleId="parcelle-123" />);

      await waitFor(() => {
        const slider = screen.getByLabelText(/Opacité/i) as HTMLInputElement;
        expect(slider.value).toBe('70'); // Default is 0.7 * 100
      });
    });

    it('should initialize opacity slider with custom initial value', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ imagery: mockImageryData }),
      });

      render(
        <SatelliteImageryOverlay parcelleId="parcelle-123" opacity={0.5} />
      );

      await waitFor(() => {
        const slider = screen.getByLabelText(/Opacité/i) as HTMLInputElement;
        expect(slider.value).toBe('50');
        expect(screen.getByText(/50%/i)).toBeInTheDocument();
      });
    });

    it('should update opacity display when slider changes', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ imagery: mockImageryData }),
      });

      render(<SatelliteImageryOverlay parcelleId="parcelle-123" opacity={0.7} />);

      await waitFor(() => {
        expect(screen.getByText(/70%/i)).toBeInTheDocument();
      });

      const slider = screen.getByLabelText(/Opacité/i);
      fireEvent.change(slider, { target: { value: '85' } });

      await waitFor(() => {
        expect(screen.getByText(/85%/i)).toBeInTheDocument();
      });
    });

    it('should call onOpacityChange callback when opacity changes', async () => {
      const onOpacityChange = vi.fn();
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ imagery: mockImageryData }),
      });

      render(
        <SatelliteImageryOverlay
          parcelleId="parcelle-123"
          onOpacityChange={onOpacityChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/Opacité/i)).toBeInTheDocument();
      });

      const slider = screen.getByLabelText(/Opacité/i);
      fireEvent.change(slider, { target: { value: '60' } });

      expect(onOpacityChange).toHaveBeenCalledWith(0.6);
      expect(onOpacityChange).toHaveBeenCalledTimes(1);
    });

    it('should handle opacity slider at minimum value (0%)', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ imagery: mockImageryData }),
      });

      render(<SatelliteImageryOverlay parcelleId="parcelle-123" />);

      await waitFor(() => {
        expect(screen.getByLabelText(/Opacité/i)).toBeInTheDocument();
      });

      const slider = screen.getByLabelText(/Opacité/i);
      fireEvent.change(slider, { target: { value: '0' } });

      await waitFor(() => {
        expect(screen.getByText(/0%/i)).toBeInTheDocument();
      });
    });

    it('should handle opacity slider at maximum value (100%)', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ imagery: mockImageryData }),
      });

      render(<SatelliteImageryOverlay parcelleId="parcelle-123" />);

      await waitFor(() => {
        expect(screen.getByLabelText(/Opacité/i)).toBeInTheDocument();
      });

      const slider = screen.getByLabelText(/Opacité/i);
      fireEvent.change(slider, { target: { value: '100' } });

      await waitFor(() => {
        expect(screen.getByText(/100%/i)).toBeInTheDocument();
      });
    });

    it('should have correct slider attributes', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ imagery: mockImageryData }),
      });

      render(<SatelliteImageryOverlay parcelleId="parcelle-123" />);

      await waitFor(() => {
        const slider = screen.getByLabelText(/Opacité/i);
        expect(slider).toHaveAttribute('type', 'range');
        expect(slider).toHaveAttribute('min', '0');
        expect(slider).toHaveAttribute('max', '100');
        expect(slider).toHaveAttribute('id', 'opacity-slider');
      });
    });
  });

  describe('Imagery Data Display', () => {
    it('should display imagery controls when data loads successfully', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ imagery: mockImageryData }),
      });

      render(<SatelliteImageryOverlay parcelleId="parcelle-123" />);

      await waitFor(() => {
        expect(screen.getByText(/Imagerie Satellite/i)).toBeInTheDocument();
      });
    });

    it('should display formatted acquisition date', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ imagery: mockImageryData }),
      });

      render(<SatelliteImageryOverlay parcelleId="parcelle-123" />);

      await waitFor(() => {
        // Date should be formatted in French locale
        expect(screen.getByText(/15 janvier 2024/i)).toBeInTheDocument();
      });
    });

    it('should display cloud cover percentage', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ imagery: mockImageryData }),
      });

      render(<SatelliteImageryOverlay parcelleId="parcelle-123" />);

      await waitFor(() => {
        expect(screen.getByText(/Couverture nuageuse: 15.5%/i)).toBeInTheDocument();
      });
    });

    it('should display satellite source', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ imagery: mockImageryData }),
      });

      render(<SatelliteImageryOverlay parcelleId="parcelle-123" />);

      await waitFor(() => {
        expect(screen.getByText(/Sentinel-2/i)).toBeInTheDocument();
      });
    });

    it('should display resolution in meters', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ imagery: mockImageryData }),
      });

      render(<SatelliteImageryOverlay parcelleId="parcelle-123" />);

      await waitFor(() => {
        expect(screen.getByText(/10m/i)).toBeInTheDocument();
      });
    });

    it('should call onImageryLoaded callback when imagery loads', async () => {
      const onImageryLoaded = vi.fn();
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ imagery: mockImageryData }),
      });

      render(
        <SatelliteImageryOverlay
          parcelleId="parcelle-123"
          onImageryLoaded={onImageryLoaded}
        />
      );

      await waitFor(() => {
        expect(onImageryLoaded).toHaveBeenCalledWith(
          expect.objectContaining({
            id: mockImageryData.id,
            parcelleId: mockImageryData.parcelleId,
            cloudCoverPercent: mockImageryData.cloudCoverPercent,
            satelliteSource: mockImageryData.satelliteSource,
          })
        );
        expect(onImageryLoaded).toHaveBeenCalledTimes(1);
      });
    });

    it('should not display imagery controls when loading', () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise(() => {})
      );

      render(<SatelliteImageryOverlay parcelleId="parcelle-123" />);

      // Should show loading text, not imagery controls
      expect(screen.getByText(/Chargement de l'imagerie satellite/i)).toBeInTheDocument();
      expect(screen.queryByLabelText(/Opacité/i)).not.toBeInTheDocument();
    });

    it('should not display imagery controls when in error state', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Test error')
      );

      render(<SatelliteImageryOverlay parcelleId="parcelle-123" />);

      await waitFor(() => {
        expect(screen.getByText(/Erreur de chargement/i)).toBeInTheDocument();
      });

      expect(screen.queryByText(/Imagerie Satellite/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/Opacité/i)).not.toBeInTheDocument();
    });
  });

  describe('API Integration', () => {
    it('should call API with correct parcelle ID', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ imagery: mockImageryData }),
      });

      render(<SatelliteImageryOverlay parcelleId="parcelle-456" />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('parcelleId=parcelle-456')
        );
      });
    });

    it('should call API with default cloud cover threshold', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ imagery: mockImageryData }),
      });

      render(<SatelliteImageryOverlay parcelleId="parcelle-123" />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('cloudCoverThreshold=20')
        );
      });
    });

    it('should call API with custom cloud cover threshold', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ imagery: mockImageryData }),
      });

      render(
        <SatelliteImageryOverlay
          parcelleId="parcelle-123"
          cloudCoverThreshold={30}
        />
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('cloudCoverThreshold=30')
        );
      });
    });

    it('should include date parameter when provided', async () => {
      const testDate = new Date('2024-02-20T12:00:00Z');
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ imagery: mockImageryData }),
      });

      render(
        <SatelliteImageryOverlay parcelleId="parcelle-123" date={testDate} />
      );

      await waitFor(() => {
        const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
        // Check that the URL contains the date parameter (URL-encoded)
        expect(fetchCall).toContain('date=');
        expect(fetchCall).toContain(encodeURIComponent(testDate.toISOString()));
      });
    });

    it('should not include date parameter when not provided', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ imagery: mockImageryData }),
      });

      render(<SatelliteImageryOverlay parcelleId="parcelle-123" />);

      await waitFor(() => {
        const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(fetchCall).not.toContain('date=');
      });
    });

    it('should call correct API endpoint', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ imagery: mockImageryData }),
      });

      render(<SatelliteImageryOverlay parcelleId="parcelle-123" />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/satellite/imagery')
        );
      });
    });

    it('should refetch when parcelleId changes', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({ imagery: mockImageryData }),
      });

      const { rerender } = render(
        <SatelliteImageryOverlay parcelleId="parcelle-123" />
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      // Change parcelle ID
      rerender(<SatelliteImageryOverlay parcelleId="parcelle-456" />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
        expect(global.fetch).toHaveBeenLastCalledWith(
          expect.stringContaining('parcelleId=parcelle-456')
        );
      });
    });

    it('should refetch when date changes', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({ imagery: mockImageryData }),
      });

      const date1 = new Date('2024-01-15');
      const { rerender } = render(
        <SatelliteImageryOverlay parcelleId="parcelle-123" date={date1} />
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      // Change date
      const date2 = new Date('2024-02-15');
      rerender(
        <SatelliteImageryOverlay parcelleId="parcelle-123" date={date2} />
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });
    });

    it('should refetch when cloudCoverThreshold changes', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({ imagery: mockImageryData }),
      });

      const { rerender } = render(
        <SatelliteImageryOverlay
          parcelleId="parcelle-123"
          cloudCoverThreshold={20}
        />
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      // Change threshold
      rerender(
        <SatelliteImageryOverlay
          parcelleId="parcelle-123"
          cloudCoverThreshold={30}
        />
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle imagery with 0% cloud cover', async () => {
      const clearImagery = { ...mockImageryData, cloudCoverPercent: 0 };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ imagery: clearImagery }),
      });

      render(<SatelliteImageryOverlay parcelleId="parcelle-123" />);

      await waitFor(() => {
        expect(screen.getByText(/Couverture nuageuse: 0.0%/i)).toBeInTheDocument();
      });
    });

    it('should handle imagery with 100% cloud cover', async () => {
      const cloudyImagery = { ...mockImageryData, cloudCoverPercent: 100 };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ imagery: cloudyImagery }),
      });

      render(<SatelliteImageryOverlay parcelleId="parcelle-123" />);

      await waitFor(() => {
        expect(screen.getByText(/Couverture nuageuse: 100.0%/i)).toBeInTheDocument();
      });
    });

    it('should handle very long parcelle IDs', async () => {
      const longId = 'parcelle-' + 'a'.repeat(100);
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ imagery: mockImageryData }),
      });

      render(<SatelliteImageryOverlay parcelleId={longId} />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining(`parcelleId=${longId}`)
        );
      });
    });

    it('should handle dates far in the past', async () => {
      const oldDate = new Date('2020-01-01');
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ imagery: mockImageryData }),
      });

      render(
        <SatelliteImageryOverlay parcelleId="parcelle-123" date={oldDate} />
      );

      await waitFor(() => {
        const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
        // Check that the URL contains the date parameter (URL-encoded)
        expect(fetchCall).toContain('date=');
        expect(fetchCall).toContain(encodeURIComponent(oldDate.toISOString()));
      });
    });

    it('should handle network timeout errors', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Network request timed out')
      );

      render(<SatelliteImageryOverlay parcelleId="parcelle-123" />);

      await waitFor(() => {
        expect(screen.getByText(/Network request timed out/i)).toBeInTheDocument();
      });
    });
  });
});
