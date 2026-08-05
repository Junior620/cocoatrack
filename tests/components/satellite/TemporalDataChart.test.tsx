/**
 * Unit tests for TemporalDataChart (lecture métier)
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TemporalDataChart } from '@/components/satellite/TemporalDataChart';
import type { TemporalDataPoint } from '@/lib/satellite/types/index';

vi.mock('recharts', () => ({
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: any) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  ReferenceLine: () => <div data-testid="reference-line" />,
  ReferenceArea: () => <div data-testid="reference-area" />,
  Dot: () => <div data-testid="dot" />,
  Legend: () => <div data-testid="legend" />,
}));

describe('TemporalDataChart', () => {
  const mockTimeline: TemporalDataPoint[] = [
    {
      date: new Date('2024-01-01'),
      ndvi: 0.65,
      cloudCover: 10,
      healthStatus: 'good',
      hasSignificantChange: false,
      imageryQuality: 'good',
    },
    {
      date: new Date('2024-02-01'),
      ndvi: 0.72,
      cloudCover: 15,
      healthStatus: 'excellent',
      hasSignificantChange: false,
      imageryQuality: 'good',
    },
    {
      date: new Date('2024-03-01'),
      ndvi: 0.55,
      cloudCover: 20,
      healthStatus: 'fair',
      hasSignificantChange: true,
      imageryQuality: 'good',
    },
    {
      date: new Date('2024-04-01'),
      ndvi: 0.68,
      cloudCover: 12,
      healthStatus: 'good',
      hasSignificantChange: false,
      imageryQuality: 'good',
    },
  ];

  const selectedDate = new Date('2024-02-01');

  describe('Rendering States', () => {
    it('should render loading state', () => {
      render(
        <TemporalDataChart
          timeline={[]}
          selectedDate={selectedDate}
          loading={true}
        />
      );
      expect(screen.getByText(/chargement du graphique/i)).toBeInTheDocument();
    });

    it('should render error state', () => {
      render(
        <TemporalDataChart
          timeline={[]}
          selectedDate={selectedDate}
          error={new Error('Failed to load data')}
        />
      );
      expect(screen.getByText(/erreur de chargement/i)).toBeInTheDocument();
      expect(screen.getByText('Failed to load data')).toBeInTheDocument();
    });

    it('should render empty state when timeline is empty', () => {
      render(
        <TemporalDataChart timeline={[]} selectedDate={selectedDate} />
      );
      expect(
        screen.getByText(/aucune donnée temporelle disponible/i)
      ).toBeInTheDocument();
    });

    it('should render chart with valid data', () => {
      render(
        <TemporalDataChart
          timeline={mockTimeline}
          selectedDate={selectedDate}
        />
      );
      expect(
        screen.getByText(/évolution satellitaire de la parcelle/i)
      ).toBeInTheDocument();
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });
  });

  describe('Summary cards', () => {
    it('shows current NDVI and confidence', () => {
      render(
        <TemporalDataChart
          timeline={mockTimeline}
          selectedDate={selectedDate}
        />
      );
      expect(screen.getByText(/NDVI actuel/i)).toBeInTheDocument();
      expect(screen.getByText(/Confiance/i)).toBeInTheDocument();
      expect(screen.getByText('0.68')).toBeInTheDocument(); // last NDVI
    });
  });

  describe('Index selector', () => {
    it('defaults to NDVI with métier labels', () => {
      render(
        <TemporalDataChart
          timeline={mockTimeline}
          selectedDate={selectedDate}
        />
      );
      expect(screen.getByText(/Vigueur de la végétation/i)).toBeInTheDocument();
      expect(screen.getByText(/Humidité de la végétation/i)).toBeInTheDocument();
    });
  });

  describe('Trend Calculation', () => {
    it('should show improving trend when NDVI increases', () => {
      const improvingTimeline: TemporalDataPoint[] = [
        {
          date: new Date('2024-01-01'),
          ndvi: 0.5,
          cloudCover: 10,
          healthStatus: 'fair',
          hasSignificantChange: false,
        },
        {
          date: new Date('2024-02-01'),
          ndvi: 0.65,
          cloudCover: 10,
          healthStatus: 'good',
          hasSignificantChange: false,
        },
      ];
      render(
        <TemporalDataChart
          timeline={improvingTimeline}
          selectedDate={improvingTimeline[0].date}
        />
      );
      expect(screen.getByText(/en amélioration/i)).toBeInTheDocument();
    });

    it('should show declining trend when NDVI decreases', () => {
      const decliningTimeline: TemporalDataPoint[] = [
        {
          date: new Date('2024-01-01'),
          ndvi: 0.7,
          cloudCover: 10,
          healthStatus: 'excellent',
          hasSignificantChange: false,
        },
        {
          date: new Date('2024-02-01'),
          ndvi: 0.5,
          cloudCover: 10,
          healthStatus: 'fair',
          hasSignificantChange: false,
        },
      ];
      render(
        <TemporalDataChart
          timeline={decliningTimeline}
          selectedDate={decliningTimeline[0].date}
        />
      );
      expect(screen.getByText(/en baisse/i)).toBeInTheDocument();
    });

    it('should show stable trend when NDVI change is small', () => {
      const stableTimeline: TemporalDataPoint[] = [
        {
          date: new Date('2024-01-01'),
          ndvi: 0.65,
          cloudCover: 10,
          healthStatus: 'good',
          hasSignificantChange: false,
        },
        {
          date: new Date('2024-02-01'),
          ndvi: 0.67,
          cloudCover: 10,
          healthStatus: 'good',
          hasSignificantChange: false,
        },
      ];
      render(
        <TemporalDataChart
          timeline={stableTimeline}
          selectedDate={stableTimeline[0].date}
        />
      );
      expect(screen.getByText(/stable/i)).toBeInTheDocument();
    });
  });

  describe('Significant Change Markers', () => {
    it('shows chronologie when markers enabled and changes exist', () => {
      render(
        <TemporalDataChart
          timeline={mockTimeline}
          selectedDate={selectedDate}
          showChangeMarkers={true}
        />
      );
      expect(
        screen.getByText(/chronologie des variations ndvi/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/baisse importante/i)).toBeInTheDocument();
    });

    it('hides chronologie when no changes', () => {
      const noChanges = mockTimeline.map((p) => ({
        ...p,
        hasSignificantChange: false,
      }));
      render(
        <TemporalDataChart
          timeline={noChanges}
          selectedDate={selectedDate}
          showChangeMarkers={true}
        />
      );
      expect(
        screen.queryByText(/chronologie des variations ndvi/i)
      ).not.toBeInTheDocument();
    });

    it('hides chronologie when markers disabled', () => {
      render(
        <TemporalDataChart
          timeline={mockTimeline}
          selectedDate={selectedDate}
          showChangeMarkers={false}
        />
      );
      expect(
        screen.queryByText(/chronologie des variations ndvi/i)
      ).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading structure', () => {
      render(
        <TemporalDataChart
          timeline={mockTimeline}
          selectedDate={selectedDate}
        />
      );
      expect(
        screen.getByRole('heading', {
          name: /évolution satellitaire de la parcelle/i,
        })
      ).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <TemporalDataChart
          timeline={mockTimeline}
          selectedDate={selectedDate}
          className="custom-class"
        />
      );
      expect(container.querySelector('.custom-class')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle single data point', () => {
      const singlePoint: TemporalDataPoint[] = [
        {
          date: new Date('2024-01-01'),
          ndvi: 0.65,
          cloudCover: 10,
          healthStatus: 'good',
          hasSignificantChange: false,
        },
      ];
      render(
        <TemporalDataChart
          timeline={singlePoint}
          selectedDate={singlePoint[0].date}
        />
      );
      expect(
        screen.getByText(/évolution satellitaire de la parcelle/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/stable/i)).toBeInTheDocument();
    });

    it('should handle extreme NDVI values', () => {
      const extremeTimeline: TemporalDataPoint[] = [
        {
          date: new Date('2024-01-01'),
          ndvi: -0.1,
          cloudCover: 10,
          healthStatus: 'critical',
          hasSignificantChange: false,
        },
        {
          date: new Date('2024-02-01'),
          ndvi: 1.0,
          cloudCover: 10,
          healthStatus: 'excellent',
          hasSignificantChange: true,
        },
      ];
      render(
        <TemporalDataChart
          timeline={extremeTimeline}
          selectedDate={extremeTimeline[0].date}
        />
      );
      expect(
        screen.getByText(/évolution satellitaire de la parcelle/i)
      ).toBeInTheDocument();
    });
  });
});
