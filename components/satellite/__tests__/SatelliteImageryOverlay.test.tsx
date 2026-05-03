/**
 * Tests for SatelliteImageryOverlay component
 * 
 * Tests cover:
 * - Component rendering
 * - Loading state display
 * - Error state display with retry button
 * - Opacity control functionality
 * - Imagery data display
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SatelliteImageryOverlay } from '../SatelliteImageryOverlay';
import type { ImageryData } from '@/lib/satellite/types';

// Mock fetch globally
global.fetch = vi.fn();

describe('SatelliteImageryOverlay', () => {
  const mockImageryData: ImageryData = {
    id: 'test-imagery-1',
    parcelleId: 'parcelle-123',
    acquisitionDate: new Date('2024-01-15'),
    cloudCoverPercent: 15.5,
    satelliteSource: 'sentinel-2',
    tileUrl: 'https://example.com/tile.png',
    bounds: [-10, -10, 10, 10],
    resolutionMeters: 10,
    createdAt: new Date('2024-01-16'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should display loading spinner when fetching imagery', () => {
      // Mock fetch to never resolve
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise(() => {})
      );

      render(<SatelliteImageryOverlay parcelleId="parcelle-123" />);

      expect(screen.getByText(/Chargement de l'imagerie satellite/i)).toBeInTheDocument();
    });

    it('should show loading state immediately on mount', () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise(() => {})
      );

      const { container } = render(
        <SatelliteImageryOverlay parcelleId="parcelle-123" />
      );

      const loadingSpinner = container.querySelector('.animate-spin');
      expect(loadingSpinner).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should display error message when fetch fails', async () => {
      const errorMessage = 'Failed to fetch imagery: Network error';
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error(errorMessage));

      render(<SatelliteImageryOverlay parcelleId="parcelle-123" />);

      await waitFor(() => {
        expect(screen.getByText(/Erreur de chargement/i)).toBeInTheDocument();
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
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
      });
    });

    it('should retry fetch when retry button is clicked', async () => {
      // First call fails
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Network error')
      );

      render(
        <SatelliteImageryOverlay parcelleId="parcelle-123" />
      );

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

      await waitFor(() => {
        expect(screen.queryByText(/Erreur de chargement/i)).not.toBeInTheDocument();
      });
    });

    it('should call onError callback when error occurs', async () => {
      const onError = vi.fn();
      const error = new Error('Test error');
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);

      render(
        <SatelliteImageryOverlay parcelleId="parcelle-123" onError={onError} />
      );

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(error);
      });
    });
  });

  describe('Success State', () => {
    it('should display imagery controls when data loads successfully', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ imagery: mockImageryData }),
      });

      render(<SatelliteImageryOverlay parcelleId="parcelle-123" />);

      await waitFor(() => {
        expect(screen.getByText(/Imagerie Satellite/i)).toBeInTheDocument();
        expect(screen.getByText(/15 janvier 2024/i)).toBeInTheDocument();
        expect(screen.getByText(/Couverture nuageuse: 15.5%/i)).toBeInTheDocument();
      });
    });

    it('should display opacity slider', async () => {
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
          })
        );
      });
    });
  });

  describe('Opacity Control', () => {
    it('should update opacity when slider changes', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ imagery: mockImageryData }),
      });

      render(<SatelliteImageryOverlay parcelleId="parcelle-123" opacity={0.7} />);

      await waitFor(() => {
        const slider = screen.getByLabelText(/Opacité/i) as HTMLInputElement;
        expect(slider.value).toBe('70');
      });

      const slider = screen.getByLabelText(/Opacité/i);
      fireEvent.change(slider, { target: { value: '50' } });

      await waitFor(() => {
        expect(screen.getByText(/50%/i)).toBeInTheDocument();
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
      fireEvent.change(slider, { target: { value: '80' } });

      expect(onOpacityChange).toHaveBeenCalledWith(0.8);
    });

    it('should display initial opacity value', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ imagery: mockImageryData }),
      });

      render(<SatelliteImageryOverlay parcelleId="parcelle-123" opacity={0.5} />);

      await waitFor(() => {
        expect(screen.getByText(/50%/i)).toBeInTheDocument();
      });
    });
  });

  describe('API Integration', () => {
    it('should call API with correct parameters', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ imagery: mockImageryData }),
      });

      render(
        <SatelliteImageryOverlay
          parcelleId="parcelle-123"
          cloudCoverThreshold={25}
        />
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/satellite/imagery')
        );
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('parcelleId=parcelle-123')
        );
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('cloudCoverThreshold=25')
        );
      });
    });

    it('should include date parameter when provided', async () => {
      const testDate = new Date('2024-01-15');
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ imagery: mockImageryData }),
      });

      render(
        <SatelliteImageryOverlay parcelleId="parcelle-123" date={testDate} />
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining(`date=${testDate.toISOString()}`)
        );
      });
    });
  });

  describe('Imagery Information Display', () => {
    it('should display satellite source and resolution', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ imagery: mockImageryData }),
      });

      render(<SatelliteImageryOverlay parcelleId="parcelle-123" />);

      await waitFor(() => {
        expect(screen.getByText(/Sentinel-2/i)).toBeInTheDocument();
        expect(screen.getByText(/10m/i)).toBeInTheDocument();
      });
    });
  });
});
