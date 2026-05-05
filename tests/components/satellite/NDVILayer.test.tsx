import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NDVILayer } from '@/components/satellite/NDVILayer';
import type { NDVIResult } from '@/lib/satellite/types';
import * as ndviColors from '@/lib/satellite/utils/ndvi-colors';

// Mock fetch globally
global.fetch = vi.fn();

describe('NDVILayer', () => {
  const mockNDVIResult: NDVIResult = {
    id: 'ndvi-123',
    parcelleId: 'parcelle-456',
    imageryId: 'imagery-789',
    calculationDate: new Date('2024-05-01T10:00:00Z'),
    meanNDVI: 0.75,
    minNDVI: 0.45,
    maxNDVI: 0.92,
    stdDevNDVI: 0.12,
    healthStatus: 'good',
    ndviRasterUrl: 'https://example.com/ndvi-raster.tif',
    createdAt: new Date('2024-05-01T10:05:00Z'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Component Rendering', () => {
    it('renders without crashing', () => {
      render(<NDVILayer parcelleId="test-parcelle" />);
      expect(screen.getByText('Calcul du NDVI en cours...')).toBeInTheDocument();
    });

    it('shows loading state initially', () => {
      render(<NDVILayer parcelleId="test-parcelle" />);
      expect(screen.getByText('Calcul du NDVI en cours...')).toBeInTheDocument();
      // Loading spinner is present
      const loadingContainer = screen.getByText('Calcul du NDVI en cours...').parentElement;
      expect(loadingContainer).toBeInTheDocument();
    });

    it('renders with custom date prop', () => {
      const customDate = new Date('2024-03-15');
      render(<NDVILayer parcelleId="test-parcelle" date={customDate} />);
      expect(screen.getByText('Calcul du NDVI en cours...')).toBeInTheDocument();
    });

    it('renders with showLegend prop set to false', () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ndvi: mockNDVIResult }),
      });

      render(<NDVILayer parcelleId="test-parcelle" showLegend={false} />);
      expect(screen.getByText('Calcul du NDVI en cours...')).toBeInTheDocument();
    });
  });

  describe('NDVI Calculation', () => {
    it('calls API endpoint with correct parameters', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ndvi: mockNDVIResult }),
      });

      render(<NDVILayer parcelleId="test-parcelle-123" />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/satellite/ndvi',
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              parcelleId: 'test-parcelle-123',
              forceRecalculate: false,
            }),
          })
        );
      });
    });

    it('includes date in API request when provided', async () => {
      const testDate = new Date('2024-04-15T12:00:00Z');
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ndvi: mockNDVIResult }),
      });

      render(<NDVILayer parcelleId="test-parcelle" date={testDate} />);

      await waitFor(() => {
        const calls = (global.fetch as any).mock.calls;
        expect(calls.length).toBeGreaterThan(0);
        const body = JSON.parse(calls[0][1].body);
        expect(body.parcelleId).toBe('test-parcelle');
        expect(body.date).toBe(testDate.toISOString());
        expect(body.forceRecalculate).toBe(false);
      });
    });

    it('includes forceRecalculate flag when set to true', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ndvi: mockNDVIResult }),
      });

      render(<NDVILayer parcelleId="test-parcelle" forceRecalculate={true} />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/satellite/ndvi',
          expect.objectContaining({
            body: JSON.stringify({
              parcelleId: 'test-parcelle',
              forceRecalculate: true,
            }),
          })
        );
      });
    });

    it('displays NDVI results after successful calculation', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ndvi: mockNDVIResult }),
      });

      render(<NDVILayer parcelleId="test-parcelle" />);

      await waitFor(() => {
        expect(screen.getByText('Analyse NDVI')).toBeInTheDocument();
      });

      expect(screen.getByText('0.750')).toBeInTheDocument(); // Mean NDVI
      expect(screen.getByText('0.450')).toBeInTheDocument(); // Min NDVI
      expect(screen.getByText('0.920')).toBeInTheDocument(); // Max NDVI
      expect(screen.getByText('0.120')).toBeInTheDocument(); // Std Dev
    });

    it('calls onNDVICalculated callback on success', async () => {
      const onNDVICalculated = vi.fn();
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ndvi: mockNDVIResult }),
      });

      render(
        <NDVILayer
          parcelleId="test-parcelle"
          onNDVICalculated={onNDVICalculated}
        />
      );

      await waitFor(() => {
        expect(onNDVICalculated).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'ndvi-123',
            parcelleId: 'parcelle-456',
            meanNDVI: 0.75,
          })
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error message when API call fails', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'Failed to calculate NDVI' }),
      });

      render(<NDVILayer parcelleId="test-parcelle" />);

      await waitFor(() => {
        expect(screen.getByText('Erreur de calcul NDVI')).toBeInTheDocument();
        expect(screen.getByText('Failed to calculate NDVI')).toBeInTheDocument();
      });
    });

    it('displays generic error message when error response has no message', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request',
        json: async () => ({}),
      });

      render(<NDVILayer parcelleId="test-parcelle" />);

      await waitFor(() => {
        expect(
          screen.getByText('Failed to calculate NDVI: Bad Request')
        ).toBeInTheDocument();
      });
    });

    it('handles network errors gracefully', async () => {
      (global.fetch as any).mockRejectedValueOnce(
        new Error('Network connection failed')
      );

      render(<NDVILayer parcelleId="test-parcelle" />);

      await waitFor(() => {
        expect(screen.getByText('Erreur de calcul NDVI')).toBeInTheDocument();
        expect(screen.getByText('Network connection failed')).toBeInTheDocument();
      });
    });

    it('calls onError callback when error occurs', async () => {
      const onError = vi.fn();
      const testError = new Error('Test error');
      (global.fetch as any).mockRejectedValueOnce(testError);

      render(<NDVILayer parcelleId="test-parcelle" onError={onError} />);

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(expect.any(Error));
        expect(onError.mock.calls[0][0].message).toBe('Test error');
      });
    });

    it('shows retry button in error state', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Test error'));

      render(<NDVILayer parcelleId="test-parcelle" />);

      await waitFor(() => {
        expect(screen.getByText('Réessayer')).toBeInTheDocument();
      });
    });

    it('retries calculation when retry button is clicked', async () => {
      // First call fails
      (global.fetch as any).mockRejectedValueOnce(new Error('First attempt failed'));

      render(<NDVILayer parcelleId="test-parcelle" />);

      await waitFor(() => {
        expect(screen.getByText('Réessayer')).toBeInTheDocument();
      });

      // Second call succeeds
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ndvi: mockNDVIResult }),
      });

      const retryButton = screen.getByText('Réessayer');
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText('Analyse NDVI')).toBeInTheDocument();
      });

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Health Status Display', () => {
    it('displays excellent health status correctly', async () => {
      const excellentNDVI = { ...mockNDVIResult, healthStatus: 'excellent' as const };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ndvi: excellentNDVI }),
      });

      render(<NDVILayer parcelleId="test-parcelle" />);

      await waitFor(() => {
        expect(screen.getByText(/État: Excellent/i)).toBeInTheDocument();
      });
    });

    it('displays good health status correctly', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ndvi: mockNDVIResult }),
      });

      render(<NDVILayer parcelleId="test-parcelle" />);

      await waitFor(() => {
        expect(screen.getByText(/État: Bon/i)).toBeInTheDocument();
      });
    });

    it('displays fair health status correctly', async () => {
      const fairNDVI = { ...mockNDVIResult, healthStatus: 'fair' as const };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ndvi: fairNDVI }),
      });

      render(<NDVILayer parcelleId="test-parcelle" />);

      await waitFor(() => {
        expect(screen.getByText(/État: Moyen/i)).toBeInTheDocument();
      });
    });

    it('displays poor health status correctly', async () => {
      const poorNDVI = { ...mockNDVIResult, healthStatus: 'poor' as const };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ndvi: poorNDVI }),
      });

      render(<NDVILayer parcelleId="test-parcelle" />);

      await waitFor(() => {
        expect(screen.getByText(/État: Faible/i)).toBeInTheDocument();
      });
    });

    it('displays critical health status correctly', async () => {
      const criticalNDVI = { ...mockNDVIResult, healthStatus: 'critical' as const };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ndvi: criticalNDVI }),
      });

      render(<NDVILayer parcelleId="test-parcelle" />);

      await waitFor(() => {
        expect(screen.getByText(/État: Critique/i)).toBeInTheDocument();
      });
    });
  });

  describe('Color Mapping', () => {
    it('uses ndviToHex for health status color indicator', async () => {
      const ndviToHexSpy = vi.spyOn(ndviColors, 'ndviToHex');
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ndvi: mockNDVIResult }),
      });

      render(<NDVILayer parcelleId="test-parcelle" />);

      await waitFor(() => {
        expect(ndviToHexSpy).toHaveBeenCalledWith(0.75);
      });

      ndviToHexSpy.mockRestore();
    });

    it('displays color indicator with correct NDVI color', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ndvi: mockNDVIResult }),
      });

      render(<NDVILayer parcelleId="test-parcelle" />);

      await waitFor(() => {
        const colorIndicator = screen.getByText(/État: Bon/i).previousSibling;
        expect(colorIndicator).toBeInTheDocument();
      });
    });
  });

  describe('Legend Display', () => {
    it('displays legend when showLegend is true (default)', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ndvi: mockNDVIResult }),
      });

      render(<NDVILayer parcelleId="test-parcelle" />);

      await waitFor(() => {
        expect(screen.getByText('Légende NDVI')).toBeInTheDocument();
      });
    });

    it('hides legend when showLegend is false', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ndvi: mockNDVIResult }),
      });

      render(<NDVILayer parcelleId="test-parcelle" showLegend={false} />);

      await waitFor(() => {
        expect(screen.getByText('Analyse NDVI')).toBeInTheDocument();
      });

      expect(screen.queryByText('Légende NDVI')).not.toBeInTheDocument();
    });

    it('displays all legend color ranges', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ndvi: mockNDVIResult }),
      });

      render(<NDVILayer parcelleId="test-parcelle" />);

      await waitFor(() => {
        expect(screen.getByText('Légende NDVI')).toBeInTheDocument();
      });

      // Check for legend labels (based on getNDVILegendColors output)
      expect(screen.getByText('Very Poor')).toBeInTheDocument();
      expect(screen.getByText('Poor')).toBeInTheDocument();
      expect(screen.getByText('Moderate')).toBeInTheDocument();
      expect(screen.getByText('Good')).toBeInTheDocument();
      expect(screen.getByText('Very Good')).toBeInTheDocument();
      expect(screen.getByText('Excellent')).toBeInTheDocument();
    });

    it('displays legend info note', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ndvi: mockNDVIResult }),
      });

      render(<NDVILayer parcelleId="test-parcelle" />);

      await waitFor(() => {
        expect(
          screen.getByText(/Le NDVI mesure la santé de la végétation/i)
        ).toBeInTheDocument();
      });
    });

    it('calls getNDVILegendColors to generate legend', async () => {
      const getLegendColorsSpy = vi.spyOn(ndviColors, 'getNDVILegendColors');
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ndvi: mockNDVIResult }),
      });

      render(<NDVILayer parcelleId="test-parcelle" />);

      await waitFor(() => {
        expect(getLegendColorsSpy).toHaveBeenCalled();
      });

      getLegendColorsSpy.mockRestore();
    });
  });

  describe('Date Formatting', () => {
    it('formats calculation date in French locale', async () => {
      const testDate = new Date('2024-05-15T14:30:00Z');
      const ndviWithDate = { ...mockNDVIResult, calculationDate: testDate };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ndvi: ndviWithDate }),
      });

      render(<NDVILayer parcelleId="test-parcelle" />);

      await waitFor(() => {
        // French date format: "15 mai 2024"
        expect(screen.getByText(/mai 2024/i)).toBeInTheDocument();
      });
    });
  });

  describe('Recalculate Button', () => {
    it('displays recalculate button when NDVI is loaded', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ndvi: mockNDVIResult }),
      });

      render(<NDVILayer parcelleId="test-parcelle" />);

      await waitFor(() => {
        expect(screen.getByText('Recalculer')).toBeInTheDocument();
      });
    });

    it('triggers recalculation when recalculate button is clicked', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ndvi: mockNDVIResult }),
      });

      render(<NDVILayer parcelleId="test-parcelle" />);

      await waitFor(() => {
        expect(screen.getByText('Recalculer')).toBeInTheDocument();
      });

      // Mock second calculation
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ndvi: { ...mockNDVIResult, meanNDVI: 0.82 } }),
      });

      const recalculateButton = screen.getByText('Recalculer');
      fireEvent.click(recalculateButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('NDVI Statistics Display', () => {
    it('displays all NDVI statistics with correct precision', async () => {
      const ndviWithStats = {
        ...mockNDVIResult,
        meanNDVI: 0.7543,
        minNDVI: 0.4521,
        maxNDVI: 0.9234,
        stdDevNDVI: 0.1234,
      };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ndvi: ndviWithStats }),
      });

      render(<NDVILayer parcelleId="test-parcelle" />);

      await waitFor(() => {
        expect(screen.getByText('0.754')).toBeInTheDocument(); // Mean (3 decimals)
        expect(screen.getByText('0.452')).toBeInTheDocument(); // Min (3 decimals)
        expect(screen.getByText('0.923')).toBeInTheDocument(); // Max (3 decimals)
        expect(screen.getByText('0.123')).toBeInTheDocument(); // Std Dev (3 decimals)
      });
    });

    it('displays NDVI statistic labels in French', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ndvi: mockNDVIResult }),
      });

      render(<NDVILayer parcelleId="test-parcelle" />);

      await waitFor(() => {
        expect(screen.getByText('NDVI Moyen:')).toBeInTheDocument();
        expect(screen.getByText('NDVI Min:')).toBeInTheDocument();
        expect(screen.getByText('NDVI Max:')).toBeInTheDocument();
        expect(screen.getByText('Écart-type:')).toBeInTheDocument();
      });
    });
  });

  describe('Component Lifecycle', () => {
    it('recalculates NDVI when parcelleId changes', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ndvi: mockNDVIResult }),
      });

      const { rerender } = render(<NDVILayer parcelleId="parcelle-1" />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      // Change parcelleId
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ndvi: mockNDVIResult }),
      });

      rerender(<NDVILayer parcelleId="parcelle-2" />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });
    });

    it('recalculates NDVI when date changes', async () => {
      const date1 = new Date('2024-04-01');
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ndvi: mockNDVIResult }),
      });

      const { rerender } = render(
        <NDVILayer parcelleId="test-parcelle" date={date1} />
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      // Change date
      const date2 = new Date('2024-05-01');
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ndvi: mockNDVIResult }),
      });

      rerender(<NDVILayer parcelleId="test-parcelle" date={date2} />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });
    });

    it('recalculates NDVI when forceRecalculate changes', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ndvi: mockNDVIResult }),
      });

      const { rerender } = render(
        <NDVILayer parcelleId="test-parcelle" forceRecalculate={false} />
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      // Change forceRecalculate
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ndvi: mockNDVIResult }),
      });

      rerender(<NDVILayer parcelleId="test-parcelle" forceRecalculate={true} />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });
    });
  });
});
