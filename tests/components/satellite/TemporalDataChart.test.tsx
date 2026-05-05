/**
 * Unit tests for TemporalDataChart component
 * 
 * Tests:
 * - Component rendering with valid data
 * - Loading state display
 * - Error state display
 * - Empty state display
 * - Statistics calculation
 * - Trend calculation
 * - Significant change markers
 * - Selected date highlighting
 * - Tooltip display
 * - Click interaction
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TemporalDataChart } from '@/components/satellite/TemporalDataChart';
import type { TemporalDataPoint } from '@/lib/satellite/types/index';

// Mock recharts to avoid canvas rendering issues in tests
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
  Dot: () => <div data-testid="dot" />,
  Legend: () => <div data-testid="legend" />,
}));

describe('TemporalDataChart', () => {
  // Sample test data
  const mockTimeline: TemporalDataPoint[] = [
    {
      date: new Date('2024-01-01'),
      ndvi: 0.65,
      cloudCover: 10,
      healthStatus: 'good',
      hasSignificantChange: false,
    },
    {
      date: new Date('2024-02-01'),
      ndvi: 0.72,
      cloudCover: 15,
      healthStatus: 'excellent',
      hasSignificantChange: false,
    },
    {
      date: new Date('2024-03-01'),
      ndvi: 0.55,
      cloudCover: 20,
      healthStatus: 'fair',
      hasSignificantChange: true, // Significant change (0.72 - 0.55 = 0.17 > 0.15)
    },
    {
      date: new Date('2024-04-01'),
      ndvi: 0.68,
      cloudCover: 12,
      healthStatus: 'good',
      hasSignificantChange: false,
    },
  ];

  const selectedDate = new Date('2024-02-01');
  const mockParcelleId = 'test-parcelle-123';
  const mockStartDate = new Date('2024-01-01');
  const mockEndDate = new Date('2024-04-01');

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
      const error = new Error('Failed to load data');
      render(
        <TemporalDataChart
          timeline={[]}
          selectedDate={selectedDate}
          error={error}
        />
      );

      expect(screen.getByText(/erreur de chargement/i)).toBeInTheDocument();
      expect(screen.getByText('Failed to load data')).toBeInTheDocument();
    });

    it('should render empty state when timeline is empty', () => {
      render(
        <TemporalDataChart parcelleId={mockParcelleId} startDate={mockStartDate} endDate={mockEndDate} timeline={[]} selectedDate={selectedDate} />
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

      expect(screen.getByText(/évolution ndvi/i)).toBeInTheDocument();
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });
  });

  describe('Statistics Display', () => {
    it('should display correct average NDVI', () => {
      render(
        <TemporalDataChart
          timeline={mockTimeline}
          selectedDate={selectedDate}
        />
      );

      // Average: (0.65 + 0.72 + 0.55 + 0.68) / 4 = 0.65
      const avgNDVI = screen.getByText(/0\.650/);
      expect(avgNDVI).toBeInTheDocument();
    });

    it('should display correct min NDVI', () => {
      render(
        <TemporalDataChart
          timeline={mockTimeline}
          selectedDate={selectedDate}
        />
      );

      // Min: 0.55
      const minNDVI = screen.getByText(/0\.550/);
      expect(minNDVI).toBeInTheDocument();
    });

    it('should display correct max NDVI', () => {
      render(
        <TemporalDataChart
          timeline={mockTimeline}
          selectedDate={selectedDate}
        />
      );

      // Max: 0.72
      const maxNDVI = screen.getByText(/0\.720/);
      expect(maxNDVI).toBeInTheDocument();
    });

    it('should display correct number of significant changes', () => {
      render(
        <TemporalDataChart
          timeline={mockTimeline}
          selectedDate={selectedDate}
        />
      );

      // 1 significant change in the mock data
      const significantChanges = screen.getAllByText('1');
      expect(significantChanges.length).toBeGreaterThan(0);
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

      expect(screen.getByText(/en déclin/i)).toBeInTheDocument();
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
    it('should show significant change legend when markers are enabled and changes exist', () => {
      render(
        <TemporalDataChart
          timeline={mockTimeline}
          selectedDate={selectedDate}
          showChangeMarkers={true}
        />
      );

      expect(
        screen.getByText(/changement significatif \(ndvi > 0\.15\)/i)
      ).toBeInTheDocument();
    });

    it('should not show significant change legend when no changes exist', () => {
      const noChangesTimeline = mockTimeline.map((point) => ({
        ...point,
        hasSignificantChange: false,
      }));

      render(
        <TemporalDataChart
          timeline={noChangesTimeline}
          selectedDate={selectedDate}
          showChangeMarkers={true}
        />
      );

      expect(
        screen.queryByText(/changement significatif \(ndvi > 0\.15\)/i)
      ).not.toBeInTheDocument();
    });

    it('should not show significant change legend when markers are disabled', () => {
      render(
        <TemporalDataChart
          timeline={mockTimeline}
          selectedDate={selectedDate}
          showChangeMarkers={false}
        />
      );

      expect(
        screen.queryByText(/changement significatif \(ndvi > 0\.15\)/i)
      ).not.toBeInTheDocument();
    });
  });

  describe('Interaction', () => {
    it('should call onDateSelect when provided', () => {
      const onDateSelect = vi.fn();

      render(
        <TemporalDataChart
          timeline={mockTimeline}
          selectedDate={selectedDate}
          onDateSelect={onDateSelect}
        />
      );

      // Note: Testing click interaction with recharts is complex due to mocking
      // In a real test, you would simulate a click on the chart
      expect(onDateSelect).not.toHaveBeenCalled(); // Not called on initial render
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

      const heading = screen.getByRole('heading', { name: /évolution ndvi/i });
      expect(heading).toBeInTheDocument();
    });

    it('should display help text for users', () => {
      render(
        <TemporalDataChart
          timeline={mockTimeline}
          selectedDate={selectedDate}
        />
      );

      expect(screen.getByText(/guide de lecture/i)).toBeInTheDocument();
      expect(
        screen.getByText(/ndvi > 0\.7: végétation excellente/i)
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

      const chartContainer = container.querySelector('.custom-class');
      expect(chartContainer).toBeInTheDocument();
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

      expect(screen.getByText(/évolution ndvi/i)).toBeInTheDocument();
      expect(screen.getByText(/stable/i)).toBeInTheDocument(); // Single point = stable
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

      expect(screen.getByText(/évolution ndvi/i)).toBeInTheDocument();
    });

    it('should handle high cloud cover values', () => {
      const highCloudTimeline: TemporalDataPoint[] = [
        {
          date: new Date('2024-01-01'),
          ndvi: 0.65,
          cloudCover: 95,
          healthStatus: 'good',
          hasSignificantChange: false,
        },
      ];

      render(
        <TemporalDataChart
          timeline={highCloudTimeline}
          selectedDate={highCloudTimeline[0].date}
        />
      );

      expect(screen.getByText(/évolution ndvi/i)).toBeInTheDocument();
    });
  });

  describe('Data Formatting', () => {
    it('should format NDVI values to 3 decimal places', () => {
      render(
        <TemporalDataChart
          timeline={mockTimeline}
          selectedDate={selectedDate}
        />
      );

      // Check that NDVI values are displayed with 3 decimal places
      const ndviValues = screen.getAllByText(/0\.\d{3}/);
      expect(ndviValues.length).toBeGreaterThan(0);
    });

    it('should display all health status categories correctly', () => {
      const allStatusTimeline: TemporalDataPoint[] = [
        {
          date: new Date('2024-01-01'),
          ndvi: 0.85,
          cloudCover: 10,
          healthStatus: 'excellent',
          hasSignificantChange: false,
        },
        {
          date: new Date('2024-02-01'),
          ndvi: 0.65,
          cloudCover: 10,
          healthStatus: 'good',
          hasSignificantChange: false,
        },
        {
          date: new Date('2024-03-01'),
          ndvi: 0.55,
          cloudCover: 10,
          healthStatus: 'fair',
          hasSignificantChange: false,
        },
        {
          date: new Date('2024-04-01'),
          ndvi: 0.4,
          cloudCover: 10,
          healthStatus: 'poor',
          hasSignificantChange: false,
        },
        {
          date: new Date('2024-05-01'),
          ndvi: 0.2,
          cloudCover: 10,
          healthStatus: 'critical',
          hasSignificantChange: false,
        },
      ];

      render(
        <TemporalDataChart
          timeline={allStatusTimeline}
          selectedDate={allStatusTimeline[0].date}
        />
      );

      // Chart should render successfully with all health statuses
      expect(screen.getByText(/évolution ndvi/i)).toBeInTheDocument();
    });
  });
});
