/**
 * Tests for YieldPredictionDisplay Component
 * 
 * Task 5.5.4: Add yield prediction to parcelle detail page
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import YieldPredictionDisplay from '@/components/satellite/YieldPredictionDisplay';

// Mock fetch globally
global.fetch = vi.fn();

describe('YieldPredictionDisplay', () => {
  const mockParcelleId = '123e4567-e89b-12d3-a456-426614174000';
  const mockCooperativeAverage = 500;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    (global.fetch as any).mockImplementation(() =>
      new Promise(() => {}) // Never resolves to keep loading state
    );

    render(<YieldPredictionDisplay parcelleId={mockParcelleId} />);

    expect(screen.getByText('Prévision de Rendement')).toBeInTheDocument();
    expect(screen.getByText('Chargement de la prévision...')).toBeInTheDocument();
  });

  it('renders empty state when no prediction exists', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Not found' }),
    });

    render(<YieldPredictionDisplay parcelleId={mockParcelleId} canEdit={true} />);

    await waitFor(() => {
      expect(screen.getByText('Aucune prévision de rendement disponible')).toBeInTheDocument();
    });

    expect(screen.getByText('Générer Prévision')).toBeInTheDocument();
  });

  it('renders prediction data correctly', async () => {
    const mockPrediction = {
      id: 'pred-123',
      parcelleId: mockParcelleId,
      predictionDate: new Date('2024-01-15'),
      harvestSeason: '2024-Q4',
      predictedYieldKgPerHa: 520,
      confidenceLevel: 'high',
      confidenceIntervalLower: 480,
      confidenceIntervalUpper: 560,
      modelVersion: 'v1.0',
      inputFeatures: {
        meanNDVI: 0.75,
        ndviTrend: 0.02,
        historicalYield: [450, 480, 500],
        surfaceHectares: 2.5,
      },
      actualYieldKgPerHa: null,
      createdAt: new Date('2024-01-15'),
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: { prediction: mockPrediction },
      }),
    });

    render(
      <YieldPredictionDisplay
        parcelleId={mockParcelleId}
        cooperativeAverage={mockCooperativeAverage}
        canEdit={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('520')).toBeInTheDocument();
    });

    expect(screen.getByText('Rendement Prévu')).toBeInTheDocument();
    expect(screen.getByText(/Confiance: Élevée/)).toBeInTheDocument();
    expect(screen.getByText('2024-Q4')).toBeInTheDocument();
  });

  it('displays comparison with cooperative average', async () => {
    const mockPrediction = {
      id: 'pred-123',
      parcelleId: mockParcelleId,
      predictionDate: new Date('2024-01-15'),
      harvestSeason: '2024-Q4',
      predictedYieldKgPerHa: 550, // Above average
      confidenceLevel: 'high',
      confidenceIntervalLower: 510,
      confidenceIntervalUpper: 590,
      modelVersion: 'v1.0',
      inputFeatures: {
        meanNDVI: 0.75,
        ndviTrend: 0.02,
        historicalYield: [],
        surfaceHectares: 2.5,
      },
      actualYieldKgPerHa: null,
      createdAt: new Date('2024-01-15'),
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: { prediction: mockPrediction },
      }),
    });

    render(
      <YieldPredictionDisplay
        parcelleId={mockParcelleId}
        cooperativeAverage={mockCooperativeAverage}
        canEdit={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Comparaison avec la Moyenne Coopérative')).toBeInTheDocument();
    });

    expect(screen.getByText('500 kg/ha')).toBeInTheDocument(); // Cooperative average
    expect(screen.getByText('+50 kg/ha')).toBeInTheDocument(); // Difference
  });

  it('displays actual yield when recorded', async () => {
    const mockPrediction = {
      id: 'pred-123',
      parcelleId: mockParcelleId,
      predictionDate: new Date('2024-01-15'),
      harvestSeason: '2024-Q4',
      predictedYieldKgPerHa: 520,
      confidenceLevel: 'high',
      confidenceIntervalLower: 480,
      confidenceIntervalUpper: 560,
      modelVersion: 'v1.0',
      inputFeatures: {
        meanNDVI: 0.75,
        ndviTrend: 0.02,
        historicalYield: [],
        surfaceHectares: 2.5,
      },
      actualYieldKgPerHa: 530, // Actual yield recorded
      createdAt: new Date('2024-01-15'),
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: { prediction: mockPrediction },
      }),
    });

    render(<YieldPredictionDisplay parcelleId={mockParcelleId} canEdit={false} />);

    await waitFor(() => {
      expect(screen.getByText('Rendement Réel Enregistré')).toBeInTheDocument();
    });

    expect(screen.getByText('530 kg/ha')).toBeInTheDocument();
    expect(screen.getByText(/Écart:/)).toBeInTheDocument();
  });

  it('shows actual yield form when canEdit is true and no actual yield', async () => {
    const mockPrediction = {
      id: 'pred-123',
      parcelleId: mockParcelleId,
      predictionDate: new Date('2024-01-15'),
      harvestSeason: '2024-Q4',
      predictedYieldKgPerHa: 520,
      confidenceLevel: 'high',
      confidenceIntervalLower: 480,
      confidenceIntervalUpper: 560,
      modelVersion: 'v1.0',
      inputFeatures: {
        meanNDVI: 0.75,
        ndviTrend: 0.02,
        historicalYield: [],
        surfaceHectares: 2.5,
      },
      actualYieldKgPerHa: null,
      createdAt: new Date('2024-01-15'),
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: { prediction: mockPrediction },
      }),
    });

    render(<YieldPredictionDisplay parcelleId={mockParcelleId} canEdit={true} />);

    await waitFor(() => {
      expect(screen.getByText('+ Enregistrer le Rendement Réel')).toBeInTheDocument();
    });
  });

  it('handles error state correctly', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    render(<YieldPredictionDisplay parcelleId={mockParcelleId} />);

    await waitFor(() => {
      expect(screen.getByText('Erreur de chargement')).toBeInTheDocument();
    });

    expect(screen.getByText('Network error')).toBeInTheDocument();
    expect(screen.getByText('Réessayer')).toBeInTheDocument();
  });

  it('generates new prediction when button clicked', async () => {
    // First call returns 404 (no prediction)
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Not found' }),
    });

    render(<YieldPredictionDisplay parcelleId={mockParcelleId} canEdit={true} />);

    await waitFor(() => {
      expect(screen.getByText('Générer Prévision')).toBeInTheDocument();
    });

    // Mock POST request to generate prediction
    const mockNewPrediction = {
      id: 'pred-new',
      parcelleId: mockParcelleId,
      predictionDate: new Date(),
      harvestSeason: '2024-Q4',
      predictedYieldKgPerHa: 520,
      confidenceLevel: 'medium',
      confidenceIntervalLower: 480,
      confidenceIntervalUpper: 560,
      modelVersion: 'v1.0',
      inputFeatures: {
        meanNDVI: 0.75,
        ndviTrend: 0.02,
        historicalYield: [],
        surfaceHectares: 2.5,
      },
      actualYieldKgPerHa: null,
      createdAt: new Date(),
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: { prediction: mockNewPrediction },
      }),
    });

    const generateButton = screen.getByText('Générer Prévision');
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(screen.getByText('520')).toBeInTheDocument();
    });
  });

  it('displays confidence level with correct styling', async () => {
    const testCases = [
      { level: 'high', label: 'Élevée' },
      { level: 'medium', label: 'Moyenne' },
      { level: 'low', label: 'Faible' },
    ];

    for (const testCase of testCases) {
      vi.clearAllMocks();

      const mockPrediction = {
        id: 'pred-123',
        parcelleId: mockParcelleId,
        predictionDate: new Date('2024-01-15'),
        harvestSeason: '2024-Q4',
        predictedYieldKgPerHa: 520,
        confidenceLevel: testCase.level,
        confidenceIntervalLower: 480,
        confidenceIntervalUpper: 560,
        modelVersion: 'v1.0',
        inputFeatures: {
          meanNDVI: 0.75,
          ndviTrend: 0.02,
          historicalYield: [],
          surfaceHectares: 2.5,
        },
        actualYieldKgPerHa: null,
        createdAt: new Date('2024-01-15'),
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { prediction: mockPrediction },
        }),
      });

      const { unmount } = render(<YieldPredictionDisplay parcelleId={mockParcelleId} />);

      await waitFor(() => {
        expect(screen.getByText(`Confiance: ${testCase.label}`)).toBeInTheDocument();
      });

      unmount();
    }
  });
});
