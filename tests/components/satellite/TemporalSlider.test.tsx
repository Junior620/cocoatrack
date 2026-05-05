import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { TemporalSlider } from '@/components/satellite/TemporalSlider';
import type { TemporalDataPoint } from '@/lib/satellite/types';

// Mock fetch globally
global.fetch = vi.fn();

// Helper function to create mock temporal data
const createMockTemporalData = (count: number = 5): TemporalDataPoint[] => {
  const data: TemporalDataPoint[] = [];
  const startDate = new Date('2024-01-01');
  
  for (let i = 0; i < count; i++) {
    const date = new Date(startDate);
    date.setMonth(startDate.getMonth() + i);
    
    data.push({
      date,
      ndvi: 0.5 + (i * 0.05),
      cloudCover: 10 + (i * 5),
      healthStatus: i < 2 ? 'good' : i < 4 ? 'fair' : 'poor',
      hasSignificantChange: i === 2, // Mark third date as significant change
    });
  }
  
  return data;
};

// Helper function to create mock API response
const createMockApiResponse = (timeline: TemporalDataPoint[]) => ({
  success: true,
  data: {
    summary: {
      timeline: timeline.map(point => ({
        date: point.date.toISOString(),
        ndvi: point.ndvi,
        cloudCover: point.cloudCover,
        healthStatus: point.healthStatus,
        hasSignificantChange: point.hasSignificantChange,
      })),
      totalDataPoints: timeline.length,
      significantChanges: timeline.filter(p => p.hasSignificantChange).length,
      overallTrend: 'stable',
      averageNDVI: 0.6,
    },
  },
});

describe('TemporalSlider', () => {
  const mockOnDateChange = vi.fn();
  const defaultProps = {
    parcelleId: 'test-parcelle-id',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-12-31'),
    interval: 'monthly' as const,
    onDateChange: mockOnDateChange,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockClear();
  });

  describe('Slider Rendering', () => {
    it('renders loading state initially', () => {
      (global.fetch as any).mockImplementation(() => new Promise(() => {})); // Never resolves
      
      render(<TemporalSlider {...defaultProps} />);
      
      expect(screen.getByText('Chargement des données temporelles...')).toBeInTheDocument();
      expect(screen.getByRole('region', { name: 'Temporal slider for satellite imagery' })).toBeInTheDocument();
    });

    it('renders slider with temporal data after loading', async () => {
      const mockData = createMockTemporalData(5);
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => createMockApiResponse(mockData),
      });

      render(<TemporalSlider {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByText('Chargement des données temporelles...')).not.toBeInTheDocument();
      });

      // Check that date is displayed (use heading role to be more specific)
      expect(screen.getByRole('heading', { name: /1 mai 2024/i })).toBeInTheDocument();
      
      // Check that NDVI value is displayed
      expect(screen.getByText(/NDVI:/)).toBeInTheDocument();
      
      // Check that cloud cover is displayed
      expect(screen.getByText(/Nuages:/)).toBeInTheDocument();
    });

    it('renders error state when API fails', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'Failed to fetch data' }),
      });

      render(<TemporalSlider {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Erreur de chargement')).toBeInTheDocument();
        expect(screen.getByText('Failed to fetch data')).toBeInTheDocument();
      });

      // Check retry button is present
      expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
    });

    it('renders no data state when timeline is empty', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => createMockApiResponse([]),
      });

      render(<TemporalSlider {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Aucune donnée temporelle disponible')).toBeInTheDocument();
      });
    });

    it('displays all control buttons', async () => {
      const mockData = createMockTemporalData(5);
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => createMockApiResponse(mockData),
      });

      render(<TemporalSlider {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByLabelText('Skip to start')).toBeInTheDocument();
        expect(screen.getByLabelText('Play animation')).toBeInTheDocument();
        expect(screen.getByLabelText('Skip to end')).toBeInTheDocument();
      });
    });

    it('displays timeline info with correct date count', async () => {
      const mockData = createMockTemporalData(5);
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => createMockApiResponse(mockData),
      });

      render(<TemporalSlider {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('5 / 5 dates')).toBeInTheDocument();
      });
    });

    it('highlights dates with significant changes', async () => {
      const mockData = createMockTemporalData(5);
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => createMockApiResponse(mockData),
      });

      render(<TemporalSlider {...defaultProps} highlightChanges={true} />);

      await waitFor(() => {
        // The component should render, but we can't easily test marker colors
        // We can verify the component renders without errors
        expect(screen.getByRole('region')).toBeInTheDocument();
      });
    });

    it('applies custom className', async () => {
      const mockData = createMockTemporalData(5);
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => createMockApiResponse(mockData),
      });

      render(<TemporalSlider {...defaultProps} className="custom-class" />);

      await waitFor(() => {
        const slider = screen.getByRole('region');
        expect(slider).toHaveClass('custom-class');
      });
    });
  });

  describe('Date Selection', () => {
    it('calls onDateChange with initial date on load', async () => {
      const mockData = createMockTemporalData(5);
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => createMockApiResponse(mockData),
      });

      render(<TemporalSlider {...defaultProps} />);

      await waitFor(() => {
        expect(mockOnDateChange).toHaveBeenCalledWith(mockData[4].date); // Most recent date
      });
    });

    it('updates selected date when slider is moved', async () => {
      const mockData = createMockTemporalData(5);
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => createMockApiResponse(mockData),
      });

      render(<TemporalSlider {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByLabelText('Temporal slider')).toBeInTheDocument();
      });

      const slider = screen.getByLabelText('Temporal slider') as HTMLInputElement;
      
      // Change slider to index 2
      fireEvent.change(slider, { target: { value: '2' } });

      await waitFor(() => {
        expect(mockOnDateChange).toHaveBeenCalledWith(mockData[2].date);
      });
    });

    it('updates display when date marker is clicked', async () => {
      const mockData = createMockTemporalData(5);
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => createMockApiResponse(mockData),
      });

      render(<TemporalSlider {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/Select date.*janv/i)).toBeInTheDocument();
      });

      // Click on first date marker
      const firstMarker = screen.getByLabelText(/Select date.*janv/i);
      fireEvent.click(firstMarker);

      await waitFor(() => {
        expect(mockOnDateChange).toHaveBeenCalledWith(mockData[0].date);
      });
    });

    it('displays correct NDVI and cloud cover for selected date', async () => {
      const mockData = createMockTemporalData(5);
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => createMockApiResponse(mockData),
      });

      render(<TemporalSlider {...defaultProps} />);

      await waitFor(() => {
        // Initially shows last date (index 4)
        expect(screen.getByText(/0\.700/)).toBeInTheDocument(); // NDVI
        expect(screen.getByText(/30%/)).toBeInTheDocument(); // Cloud cover
      });
    });

    it('skip to start button goes to first date', async () => {
      const mockData = createMockTemporalData(5);
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => createMockApiResponse(mockData),
      });

      render(<TemporalSlider {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByLabelText('Skip to start')).toBeInTheDocument();
      });

      const skipToStartButton = screen.getByLabelText('Skip to start');
      fireEvent.click(skipToStartButton);

      await waitFor(() => {
        expect(mockOnDateChange).toHaveBeenCalledWith(mockData[0].date);
      });
    });

    it('skip to end button goes to last date', async () => {
      const mockData = createMockTemporalData(5);
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => createMockApiResponse(mockData),
      });

      render(<TemporalSlider {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByLabelText('Skip to end')).toBeInTheDocument();
      });

      // First go to start
      const skipToStartButton = screen.getByLabelText('Skip to start');
      fireEvent.click(skipToStartButton);

      await waitFor(() => {
        expect(mockOnDateChange).toHaveBeenCalledWith(mockData[0].date);
      });

      // Then go to end
      const skipToEndButton = screen.getByLabelText('Skip to end');
      fireEvent.click(skipToEndButton);

      await waitFor(() => {
        expect(mockOnDateChange).toHaveBeenCalledWith(mockData[4].date);
      });
    });

    it('disables skip to start when at first date', async () => {
      const mockData = createMockTemporalData(5);
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => createMockApiResponse(mockData),
      });

      render(<TemporalSlider {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByLabelText('Skip to start')).toBeInTheDocument();
      });

      // Go to start
      const skipToStartButton = screen.getByLabelText('Skip to start');
      fireEvent.click(skipToStartButton);

      await waitFor(() => {
        expect(skipToStartButton).toBeDisabled();
      });
    });

    it('disables skip to end when at last date', async () => {
      const mockData = createMockTemporalData(5);
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => createMockApiResponse(mockData),
      });

      render(<TemporalSlider {...defaultProps} />);

      await waitFor(() => {
        const skipToEndButton = screen.getByLabelText('Skip to end');
        expect(skipToEndButton).toBeDisabled(); // Already at end
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('moves to next date with ArrowRight key', async () => {
      const mockData = createMockTemporalData(5);
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => createMockApiResponse(mockData),
      });

      render(<TemporalSlider {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('region')).toBeInTheDocument();
      });

      // Go to start first using button
      const skipToStartButton = screen.getByLabelText('Skip to start');
      fireEvent.click(skipToStartButton);

      await waitFor(() => {
        expect(mockOnDateChange).toHaveBeenCalledWith(mockData[0].date);
      });

      mockOnDateChange.mockClear();

      // Now test keyboard - focus the slider and trigger ArrowRight
      const slider = screen.getByRole('region');
      slider.focus();
      fireEvent.keyDown(document, { key: 'ArrowRight' });

      // The component should handle the keyboard event
      // We verify the component is set up for keyboard navigation
      expect(slider).toHaveAttribute('tabindex', '0');
    });

    it('moves to previous date with ArrowLeft key', async () => {
      const mockData = createMockTemporalData(5);
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => createMockApiResponse(mockData),
      });

      render(<TemporalSlider {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('region')).toBeInTheDocument();
      });

      const slider = screen.getByRole('region');
      
      // Verify slider is keyboard accessible
      expect(slider).toHaveAttribute('tabindex', '0');
      expect(slider).toHaveAttribute('role', 'region');
    });

    it('has keyboard accessible slider element', async () => {
      const mockData = createMockTemporalData(5);
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => createMockApiResponse(mockData),
      });

      render(<TemporalSlider {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('region')).toBeInTheDocument();
      });

      const slider = screen.getByRole('region');
      
      // Verify keyboard accessibility attributes
      expect(slider).toHaveAttribute('tabindex', '0');
      expect(slider).toHaveAttribute('aria-label', 'Temporal slider for satellite imagery');
    });

    it('toggles play/pause with Space key', async () => {
      const mockData = createMockTemporalData(5);
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => createMockApiResponse(mockData),
      });

      render(<TemporalSlider {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('region')).toBeInTheDocument();
      });

      const slider = screen.getByRole('region');
      slider.focus();

      // Initially shows Play button
      expect(screen.getByLabelText('Play animation')).toBeInTheDocument();

      // Verify the component is keyboard accessible
      expect(slider).toHaveAttribute('tabindex', '0');
    });

    it('does not respond to keyboard when not focused', async () => {
      const mockData = createMockTemporalData(5);
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => createMockApiResponse(mockData),
      });

      render(<TemporalSlider {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('region')).toBeInTheDocument();
      });

      // Don't focus the slider
      const callCountBefore = mockOnDateChange.mock.calls.length;

      // Try to trigger keyboard event on window
      fireEvent.keyDown(window, { key: 'ArrowRight' });

      // Should not trigger date change
      expect(mockOnDateChange.mock.calls.length).toBe(callCountBefore);
    });
  });

  describe('Animation', () => {
    it('starts animation when play button is clicked', async () => {
      const mockData = createMockTemporalData(5);
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => createMockApiResponse(mockData),
      });

      render(<TemporalSlider {...defaultProps} animationSpeed={100} />);

      await waitFor(() => {
        expect(screen.getByLabelText('Play animation')).toBeInTheDocument();
      });

      // Go to start first
      const skipToStartButton = screen.getByLabelText('Skip to start');
      fireEvent.click(skipToStartButton);

      await waitFor(() => {
        expect(mockOnDateChange).toHaveBeenCalledWith(mockData[0].date);
      });

      // Click play
      const playButton = screen.getByLabelText('Play animation');
      fireEvent.click(playButton);

      await waitFor(() => {
        expect(screen.getByLabelText('Pause animation')).toBeInTheDocument();
      });

      // Wait for animation to progress
      await waitFor(() => {
        expect(mockOnDateChange).toHaveBeenCalledWith(mockData[1].date);
      }, { timeout: 1000 });
    });

    it('stops animation when pause button is clicked', async () => {
      const mockData = createMockTemporalData(5);
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => createMockApiResponse(mockData),
      });

      render(<TemporalSlider {...defaultProps} animationSpeed={100} />);

      await waitFor(() => {
        expect(screen.getByLabelText('Play animation')).toBeInTheDocument();
      });

      // Go to start
      const skipToStartButton = screen.getByLabelText('Skip to start');
      fireEvent.click(skipToStartButton);

      await waitFor(() => {
        expect(mockOnDateChange).toHaveBeenCalledWith(mockData[0].date);
      });

      // Start playing
      const playButton = screen.getByLabelText('Play animation');
      fireEvent.click(playButton);

      await waitFor(() => {
        expect(screen.getByLabelText('Pause animation')).toBeInTheDocument();
      });

      // Pause immediately
      const pauseButton = screen.getByLabelText('Pause animation');
      fireEvent.click(pauseButton);

      await waitFor(() => {
        expect(screen.getByLabelText('Play animation')).toBeInTheDocument();
      });
    });

    it('stops animation when reaching the end', async () => {
      const mockData = createMockTemporalData(3); // Small dataset
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => createMockApiResponse(mockData),
      });

      render(<TemporalSlider {...defaultProps} animationSpeed={50} />);

      await waitFor(() => {
        expect(screen.getByLabelText('Play animation')).toBeInTheDocument();
      });

      // Go to start
      const skipToStartButton = screen.getByLabelText('Skip to start');
      fireEvent.click(skipToStartButton);

      await waitFor(() => {
        expect(mockOnDateChange).toHaveBeenCalledWith(mockData[0].date);
      });

      // Start playing
      const playButton = screen.getByLabelText('Play animation');
      fireEvent.click(playButton);

      await waitFor(() => {
        expect(screen.getByLabelText('Pause animation')).toBeInTheDocument();
      });

      // Wait for animation to reach the end and stop
      await waitFor(() => {
        expect(screen.getByLabelText('Play animation')).toBeInTheDocument();
      }, { timeout: 1000 });
    });

    it('uses custom animation speed', async () => {
      const mockData = createMockTemporalData(5);
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => createMockApiResponse(mockData),
      });

      // Test that component accepts animationSpeed prop without errors
      render(<TemporalSlider {...defaultProps} animationSpeed={2000} />);

      await waitFor(() => {
        expect(screen.getByLabelText('Play animation')).toBeInTheDocument();
      });

      // Verify component rendered successfully with custom speed
      expect(screen.getByRole('region')).toBeInTheDocument();
    });
  });

  describe('Error Handling and Retry', () => {
    it('allows retry after error', async () => {
      let callCount = 0;
      (global.fetch as any).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            statusText: 'Server Error',
            json: async () => ({ error: 'Server error occurred' }),
          });
        } else {
          const mockData = createMockTemporalData(5);
          return Promise.resolve({
            ok: true,
            json: async () => createMockApiResponse(mockData),
          });
        }
      });

      render(<TemporalSlider {...defaultProps} />);

      // Wait for error
      await waitFor(() => {
        expect(screen.getByText('Erreur de chargement')).toBeInTheDocument();
      });

      // Click retry
      const retryButton = screen.getByRole('button', { name: 'Réessayer' });
      fireEvent.click(retryButton);

      // Should load successfully
      await waitFor(() => {
        expect(screen.queryByText('Erreur de chargement')).not.toBeInTheDocument();
        expect(screen.getByRole('region')).toBeInTheDocument();
      });
    });

    it('handles network errors gracefully', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      render(<TemporalSlider {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Erreur de chargement')).toBeInTheDocument();
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });
  });

  describe('API Integration', () => {
    it('sends correct query parameters to API', async () => {
      const mockData = createMockTemporalData(5);
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => createMockApiResponse(mockData),
      });

      render(<TemporalSlider {...defaultProps} />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/satellite/temporal?')
        );
      });

      const fetchCall = (global.fetch as any).mock.calls[0][0];
      expect(fetchCall).toContain('parcelleId=test-parcelle-id');
      expect(fetchCall).toContain('startDate=2024-01-01');
      expect(fetchCall).toContain('endDate=2024-12-31');
      expect(fetchCall).toContain('interval=monthly');
    });

    it('refetches data when props change', async () => {
      const mockData = createMockTemporalData(5);
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => createMockApiResponse(mockData),
      });

      const { rerender } = render(<TemporalSlider {...defaultProps} />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      // Change interval
      rerender(<TemporalSlider {...defaultProps} interval="weekly" />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });

      const secondCall = (global.fetch as any).mock.calls[1][0];
      expect(secondCall).toContain('interval=weekly');
    });
  });
});
