/**
 * TemporalSlider Component Tests
 * 
 * Tests for the TemporalSlider component including:
 * - Component rendering
 * - Date selection
 * - Play/pause animation
 * - Keyboard navigation
 * - Loading and error states
 * 
 * Requirements: Task 3.3.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TemporalSlider } from '../TemporalSlider';

// Mock fetch
global.fetch = vi.fn();

describe('TemporalSlider', () => {
  const mockOnDateChange = vi.fn();
  const mockParcelleId = '123e4567-e89b-12d3-a456-426614174000';
  const mockStartDate = new Date('2024-01-01');
  const mockEndDate = new Date('2024-12-31');

  const mockTemporalData = {
    success: true,
    data: {
      parcelleId: mockParcelleId,
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      interval: 'monthly',
      summary: {
        timeline: [
          {
            date: '2024-01-01T00:00:00.000Z',
            ndvi: 0.65,
            cloudCover: 15,
            healthStatus: 'good',
            hasSignificantChange: false,
          },
          {
            date: '2024-02-01T00:00:00.000Z',
            ndvi: 0.70,
            cloudCover: 10,
            healthStatus: 'good',
            hasSignificantChange: false,
          },
          {
            date: '2024-03-01T00:00:00.000Z',
            ndvi: 0.45,
            cloudCover: 20,
            healthStatus: 'fair',
            hasSignificantChange: true,
          },
        ],
        trend: {
          trend: 'declining',
          changeRate: -0.05,
          dataPoints: 3,
          startDate: '2024-01-01T00:00:00.000Z',
          endDate: '2024-03-01T00:00:00.000Z',
          startNDVI: 0.65,
          endNDVI: 0.45,
        },
        significantChanges: 1,
        averageNDVI: 0.60,
        averageCloudCover: 15,
      },
    },
    cached: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockTemporalData,
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('should render loading state initially', () => {
    render(
      <TemporalSlider
        parcelleId={mockParcelleId}
        startDate={mockStartDate}
        endDate={mockEndDate}
        interval="monthly"
        onDateChange={mockOnDateChange}
      />
    );

    expect(screen.getByText(/Chargement des données temporelles/i)).toBeInTheDocument();
  });

  it('should fetch temporal data on mount', async () => {
    render(
      <TemporalSlider
        parcelleId={mockParcelleId}
        startDate={mockStartDate}
        endDate={mockEndDate}
        interval="monthly"
        onDateChange={mockOnDateChange}
      />
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/satellite/temporal')
      );
    });

    const fetchCall = (global.fetch as any).mock.calls[0][0];
    expect(fetchCall).toContain('parcelleId=' + mockParcelleId);
    expect(fetchCall).toContain('startDate=2024-01-01');
    expect(fetchCall).toContain('endDate=2024-12-31');
    expect(fetchCall).toContain('interval=monthly');
  });

  it('should display temporal data after loading', async () => {
    render(
      <TemporalSlider
        parcelleId={mockParcelleId}
        startDate={mockStartDate}
        endDate={mockEndDate}
        interval="monthly"
        onDateChange={mockOnDateChange}
      />
    );

    await waitFor(() => {
      expect(screen.queryByText(/Chargement des données temporelles/i)).not.toBeInTheDocument();
    });

    // Should display the most recent date (last in timeline)
    expect(screen.getByRole('heading', { name: /mars 2024/i })).toBeInTheDocument();
    expect(screen.getByText(/NDVI:/i)).toBeInTheDocument();
    expect(screen.getByText(/0\.450/i)).toBeInTheDocument();
  });

  it('should call onDateChange with initial date', async () => {
    render(
      <TemporalSlider
        parcelleId={mockParcelleId}
        startDate={mockStartDate}
        endDate={mockEndDate}
        interval="monthly"
        onDateChange={mockOnDateChange}
      />
    );

    await waitFor(() => {
      expect(mockOnDateChange).toHaveBeenCalledWith(
        expect.any(Date)
      );
    });

    // Should be called with the last date in timeline (most recent)
    const calledDate = mockOnDateChange.mock.calls[0][0];
    expect(calledDate.toISOString()).toBe('2024-03-01T00:00:00.000Z');
  });

  it('should highlight dates with significant changes', async () => {
    render(
      <TemporalSlider
        parcelleId={mockParcelleId}
        startDate={mockStartDate}
        endDate={mockEndDate}
        interval="monthly"
        onDateChange={mockOnDateChange}
        highlightChanges={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Changement significatif/i)).toBeInTheDocument();
    });
  });

  it('should not highlight changes when highlightChanges is false', async () => {
    render(
      <TemporalSlider
        parcelleId={mockParcelleId}
        startDate={mockStartDate}
        endDate={mockEndDate}
        interval="monthly"
        onDateChange={mockOnDateChange}
        highlightChanges={false}
      />
    );

    await waitFor(() => {
      expect(screen.queryByText(/Changement significatif/i)).not.toBeInTheDocument();
    });
  });

  it('should display error state on fetch failure', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      statusText: 'Internal Server Error',
      json: async () => ({ error: 'Failed to fetch temporal data' }),
    });

    render(
      <TemporalSlider
        parcelleId={mockParcelleId}
        startDate={mockStartDate}
        endDate={mockEndDate}
        interval="monthly"
        onDateChange={mockOnDateChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Erreur de chargement/i)).toBeInTheDocument();
      expect(screen.getByText(/Failed to fetch temporal data/i)).toBeInTheDocument();
    });

    // Should have retry button
    expect(screen.getByText(/Réessayer/i)).toBeInTheDocument();
  });

  it('should retry fetch on error retry button click', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Failed to fetch' }),
    });

    render(
      <TemporalSlider
        parcelleId={mockParcelleId}
        startDate={mockStartDate}
        endDate={mockEndDate}
        interval="monthly"
        onDateChange={mockOnDateChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Erreur de chargement/i)).toBeInTheDocument();
    });

    // Mock successful response for retry
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockTemporalData,
    });

    const retryButton = screen.getByText(/Réessayer/i);
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  it('should display play/pause button', async () => {
    render(
      <TemporalSlider
        parcelleId={mockParcelleId}
        startDate={mockStartDate}
        endDate={mockEndDate}
        interval="monthly"
        onDateChange={mockOnDateChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/Play animation/i)).toBeInTheDocument();
    });
  });

  it('should display skip buttons', async () => {
    render(
      <TemporalSlider
        parcelleId={mockParcelleId}
        startDate={mockStartDate}
        endDate={mockEndDate}
        interval="monthly"
        onDateChange={mockOnDateChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/Skip to start/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Skip to end/i)).toBeInTheDocument();
    });
  });

  it('should display timeline info', async () => {
    render(
      <TemporalSlider
        parcelleId={mockParcelleId}
        startDate={mockStartDate}
        endDate={mockEndDate}
        interval="monthly"
        onDateChange={mockOnDateChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/3 \/ 3 dates/i)).toBeInTheDocument();
    });
  });

  it('should display keyboard shortcuts help', async () => {
    render(
      <TemporalSlider
        parcelleId={mockParcelleId}
        startDate={mockStartDate}
        endDate={mockEndDate}
        interval="monthly"
        onDateChange={mockOnDateChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Raccourcis:/i)).toBeInTheDocument();
      expect(screen.getByText(/Navigation/i)).toBeInTheDocument();
      expect(screen.getByText(/Lecture\/Pause/i)).toBeInTheDocument();
    });
  });

  it('should display cloud cover percentage', async () => {
    render(
      <TemporalSlider
        parcelleId={mockParcelleId}
        startDate={mockStartDate}
        endDate={mockEndDate}
        interval="monthly"
        onDateChange={mockOnDateChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Nuages:/i)).toBeInTheDocument();
      expect(screen.getByText(/20%/i)).toBeInTheDocument();
    });
  });

  it('should display health status badge', async () => {
    render(
      <TemporalSlider
        parcelleId={mockParcelleId}
        startDate={mockStartDate}
        endDate={mockEndDate}
        interval="monthly"
        onDateChange={mockOnDateChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Moyen/i)).toBeInTheDocument(); // 'fair' status
    });
  });

  it('should display no data state when timeline is empty', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ...mockTemporalData,
        data: {
          ...mockTemporalData.data,
          summary: {
            ...mockTemporalData.data.summary,
            timeline: [],
          },
        },
      }),
    });

    render(
      <TemporalSlider
        parcelleId={mockParcelleId}
        startDate={mockStartDate}
        endDate={mockEndDate}
        interval="monthly"
        onDateChange={mockOnDateChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Aucune donnée temporelle disponible/i)).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should navigate to previous date with ArrowLeft key', async () => {
      render(
        <TemporalSlider
          parcelleId={mockParcelleId}
          startDate={mockStartDate}
          endDate={mockEndDate}
          interval="monthly"
          onDateChange={mockOnDateChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /mars 2024/i })).toBeInTheDocument();
      });

      // Clear initial onDateChange call
      mockOnDateChange.mockClear();

      // Get the slider container and focus it
      const slider = screen.getByRole('region', { name: /Temporal slider/i });
      slider.focus();

      // Press ArrowLeft to go to previous date
      fireEvent.keyDown(slider, { key: 'ArrowLeft' });

      await waitFor(() => {
        expect(mockOnDateChange).toHaveBeenCalledWith(
          expect.any(Date)
        );
      });

      // Should be called with February date (index 1)
      const calledDate = mockOnDateChange.mock.calls[0][0];
      expect(calledDate.toISOString()).toBe('2024-02-01T00:00:00.000Z');
    });

    it('should navigate to next date with ArrowRight key', async () => {
      render(
        <TemporalSlider
          parcelleId={mockParcelleId}
          startDate={mockStartDate}
          endDate={mockEndDate}
          interval="monthly"
          onDateChange={mockOnDateChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /mars 2024/i })).toBeInTheDocument();
      });

      // Click on first date marker to select it
      const slider = screen.getByRole('region', { name: /Temporal slider/i });
      slider.focus();

      // Navigate to start first
      fireEvent.keyDown(slider, { key: 'Home', bubbles: true });

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(screen.getByRole('heading', { name: /janv\. 2024/i })).toBeInTheDocument();

      mockOnDateChange.mockClear();

      // Press ArrowRight to go to next date
      fireEvent.keyDown(slider, { key: 'ArrowRight', bubbles: true });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Should be called with February date (index 1)
      expect(mockOnDateChange).toHaveBeenCalledWith(expect.any(Date));
      const calledDate = mockOnDateChange.mock.calls[0][0];
      expect(calledDate.toISOString()).toBe('2024-02-01T00:00:00.000Z');
    });

    it('should toggle play/pause with Space key', async () => {
      render(
        <TemporalSlider
          parcelleId={mockParcelleId}
          startDate={mockStartDate}
          endDate={mockEndDate}
          interval="monthly"
          onDateChange={mockOnDateChange}
          animationSpeed={100}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /mars 2024/i })).toBeInTheDocument();
      });

      const slider = screen.getByRole('region', { name: /Temporal slider/i });

      // Initially should show Play button
      expect(screen.getByLabelText(/Play animation/i)).toBeInTheDocument();

      // Focus and press Space to start playing
      slider.focus();
      fireEvent.keyDown(slider, { key: ' ', bubbles: true });

      // Wait a bit for state update
      await new Promise(resolve => setTimeout(resolve, 50));

      // Should now show Pause button
      expect(screen.getByLabelText(/Pause animation/i)).toBeInTheDocument();

      // Press Space again to pause
      fireEvent.keyDown(slider, { key: ' ', bubbles: true });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Should show Play button again
      expect(screen.getByLabelText(/Play animation/i)).toBeInTheDocument();
    });

    it('should jump to start with Home key', async () => {
      render(
        <TemporalSlider
          parcelleId={mockParcelleId}
          startDate={mockStartDate}
          endDate={mockEndDate}
          interval="monthly"
          onDateChange={mockOnDateChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /mars 2024/i })).toBeInTheDocument();
      });

      mockOnDateChange.mockClear();

      const slider = screen.getByRole('region', { name: /Temporal slider/i });
      slider.focus();

      // Press Home to jump to start
      fireEvent.keyDown(slider, { key: 'Home', bubbles: true });

      // Wait for state update
      await new Promise(resolve => setTimeout(resolve, 50));

      // Should be called with January date (index 0)
      expect(mockOnDateChange).toHaveBeenCalledWith(expect.any(Date));
      const calledDate = mockOnDateChange.mock.calls[0][0];
      expect(calledDate.toISOString()).toBe('2024-01-01T00:00:00.000Z');

      // Should display January date
      expect(screen.getByRole('heading', { name: /janv\. 2024/i })).toBeInTheDocument();
    });

    it('should jump to end with End key', async () => {
      render(
        <TemporalSlider
          parcelleId={mockParcelleId}
          startDate={mockStartDate}
          endDate={mockEndDate}
          interval="monthly"
          onDateChange={mockOnDateChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /mars 2024/i })).toBeInTheDocument();
      });

      // Navigate to start first
      const slider = screen.getByRole('region', { name: /Temporal slider/i });
      slider.focus();
      fireEvent.keyDown(slider, { key: 'Home', bubbles: true });

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(screen.getByRole('heading', { name: /janv\. 2024/i })).toBeInTheDocument();

      mockOnDateChange.mockClear();

      // Press End to jump to end
      fireEvent.keyDown(slider, { key: 'End', bubbles: true });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Should be called with March date (index 2)
      expect(mockOnDateChange).toHaveBeenCalledWith(expect.any(Date));
      const calledDate = mockOnDateChange.mock.calls[0][0];
      expect(calledDate.toISOString()).toBe('2024-03-01T00:00:00.000Z');

      // Should display March date
      expect(screen.getByRole('heading', { name: /mars 2024/i })).toBeInTheDocument();
    });

    it('should not navigate beyond start with ArrowLeft', async () => {
      render(
        <TemporalSlider
          parcelleId={mockParcelleId}
          startDate={mockStartDate}
          endDate={mockEndDate}
          interval="monthly"
          onDateChange={mockOnDateChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /mars 2024/i })).toBeInTheDocument();
      });

      const slider = screen.getByRole('region', { name: /Temporal slider/i });
      slider.focus();

      // Navigate to start
      fireEvent.keyDown(slider, { key: 'Home', bubbles: true });

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(screen.getByRole('heading', { name: /janv\. 2024/i })).toBeInTheDocument();

      mockOnDateChange.mockClear();

      // Try to navigate before start
      fireEvent.keyDown(slider, { key: 'ArrowLeft', bubbles: true });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Should not call onDateChange (already at start)
      expect(mockOnDateChange).not.toHaveBeenCalled();

      // Should still display January date
      expect(screen.getByRole('heading', { name: /janv\. 2024/i })).toBeInTheDocument();
    });

    it('should not navigate beyond end with ArrowRight', async () => {
      render(
        <TemporalSlider
          parcelleId={mockParcelleId}
          startDate={mockStartDate}
          endDate={mockEndDate}
          interval="monthly"
          onDateChange={mockOnDateChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /mars 2024/i })).toBeInTheDocument();
      });

      mockOnDateChange.mockClear();

      const slider = screen.getByRole('region', { name: /Temporal slider/i });
      slider.focus();

      // Try to navigate beyond end (already at end)
      fireEvent.keyDown(slider, { key: 'ArrowRight', bubbles: true });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Should not call onDateChange (already at end)
      expect(mockOnDateChange).not.toHaveBeenCalled();

      // Should still display March date
      expect(screen.getByRole('heading', { name: /mars 2024/i })).toBeInTheDocument();
    });

    it('should only respond to keyboard events when slider is focused', async () => {
      render(
        <div>
          <TemporalSlider
            parcelleId={mockParcelleId}
            startDate={mockStartDate}
            endDate={mockEndDate}
            interval="monthly"
            onDateChange={mockOnDateChange}
          />
          <button>Other Button</button>
        </div>
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /mars 2024/i })).toBeInTheDocument();
      });

      mockOnDateChange.mockClear();

      // Focus on other element
      const otherButton = screen.getByText('Other Button');
      otherButton.focus();

      // Press ArrowLeft (should not affect slider)
      fireEvent.keyDown(document, { key: 'ArrowLeft', bubbles: true });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Should not call onDateChange
      expect(mockOnDateChange).not.toHaveBeenCalled();
    });

    it('should prevent default behavior for keyboard shortcuts', async () => {
      render(
        <TemporalSlider
          parcelleId={mockParcelleId}
          startDate={mockStartDate}
          endDate={mockEndDate}
          interval="monthly"
          onDateChange={mockOnDateChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /mars 2024/i })).toBeInTheDocument();
      });

      const slider = screen.getByRole('region', { name: /Temporal slider/i });
      slider.focus();

      // Create event with preventDefault spy
      const event = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      slider.dispatchEvent(event);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe('Touch Gestures', () => {
    it('should handle swipe left to navigate to next date', async () => {
      render(
        <TemporalSlider
          parcelleId={mockParcelleId}
          startDate={mockStartDate}
          endDate={mockEndDate}
          interval="monthly"
          onDateChange={mockOnDateChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /mars 2024/i })).toBeInTheDocument();
      });

      // Navigate to start first
      const slider = screen.getByRole('region', { name: /Temporal slider/i });
      fireEvent.keyDown(slider, { key: 'Home', bubbles: true });

      await new Promise(resolve => setTimeout(resolve, 50));

      mockOnDateChange.mockClear();

      // Simulate swipe left (next date) - swipe distance > 50px
      fireEvent.touchStart(slider, {
        touches: [{ clientX: 200, clientY: 100 }],
      });

      fireEvent.touchMove(slider, {
        touches: [{ clientX: 100, clientY: 100 }],
      });

      fireEvent.touchEnd(slider, {
        changedTouches: [{ clientX: 100, clientY: 100 }],
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Should navigate to next date (February)
      expect(mockOnDateChange).toHaveBeenCalledWith(expect.any(Date));
      const calledDate = mockOnDateChange.mock.calls[0][0];
      expect(calledDate.toISOString()).toBe('2024-02-01T00:00:00.000Z');
    });

    it('should handle swipe right to navigate to previous date', async () => {
      render(
        <TemporalSlider
          parcelleId={mockParcelleId}
          startDate={mockStartDate}
          endDate={mockEndDate}
          interval="monthly"
          onDateChange={mockOnDateChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /mars 2024/i })).toBeInTheDocument();
      });

      mockOnDateChange.mockClear();

      const slider = screen.getByRole('region', { name: /Temporal slider/i });

      // Simulate swipe right (previous date) - swipe distance > 50px
      fireEvent.touchStart(slider, {
        touches: [{ clientX: 100, clientY: 100 }],
      });

      fireEvent.touchMove(slider, {
        touches: [{ clientX: 200, clientY: 100 }],
      });

      fireEvent.touchEnd(slider, {
        changedTouches: [{ clientX: 200, clientY: 100 }],
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Should navigate to previous date (February)
      expect(mockOnDateChange).toHaveBeenCalledWith(expect.any(Date));
      const calledDate = mockOnDateChange.mock.calls[0][0];
      expect(calledDate.toISOString()).toBe('2024-02-01T00:00:00.000Z');
    });

    it('should not navigate if swipe distance is below threshold', async () => {
      render(
        <TemporalSlider
          parcelleId={mockParcelleId}
          startDate={mockStartDate}
          endDate={mockEndDate}
          interval="monthly"
          onDateChange={mockOnDateChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /mars 2024/i })).toBeInTheDocument();
      });

      mockOnDateChange.mockClear();

      const slider = screen.getByRole('region', { name: /Temporal slider/i });

      // Simulate small swipe (below 50px threshold)
      fireEvent.touchStart(slider, {
        touches: [{ clientX: 100, clientY: 100 }],
      });

      fireEvent.touchMove(slider, {
        touches: [{ clientX: 120, clientY: 100 }],
      });

      fireEvent.touchEnd(slider, {
        changedTouches: [{ clientX: 120, clientY: 100 }],
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Should not navigate (swipe too small - only 20px)
      expect(mockOnDateChange).not.toHaveBeenCalled();
    });

    it('should not navigate if swipe is more vertical than horizontal', async () => {
      render(
        <TemporalSlider
          parcelleId={mockParcelleId}
          startDate={mockStartDate}
          endDate={mockEndDate}
          interval="monthly"
          onDateChange={mockOnDateChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /mars 2024/i })).toBeInTheDocument();
      });

      mockOnDateChange.mockClear();

      const slider = screen.getByRole('region', { name: /Temporal slider/i });

      // Simulate vertical swipe (more vertical than horizontal)
      fireEvent.touchStart(slider, {
        touches: [{ clientX: 100, clientY: 100 }],
      });

      fireEvent.touchMove(slider, {
        touches: [{ clientX: 110, clientY: 200 }],
      });

      fireEvent.touchEnd(slider, {
        changedTouches: [{ clientX: 110, clientY: 200 }],
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Should not navigate (vertical swipe)
      expect(mockOnDateChange).not.toHaveBeenCalled();
    });

    it('should not navigate beyond start with swipe right', async () => {
      render(
        <TemporalSlider
          parcelleId={mockParcelleId}
          startDate={mockStartDate}
          endDate={mockEndDate}
          interval="monthly"
          onDateChange={mockOnDateChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /mars 2024/i })).toBeInTheDocument();
      });

      const slider = screen.getByRole('region', { name: /Temporal slider/i });

      // Navigate to start
      fireEvent.keyDown(slider, { key: 'Home', bubbles: true });

      await new Promise(resolve => setTimeout(resolve, 50));

      mockOnDateChange.mockClear();

      // Try to swipe right (previous) from start
      fireEvent.touchStart(slider, {
        touches: [{ clientX: 100, clientY: 100 }],
      });

      fireEvent.touchMove(slider, {
        touches: [{ clientX: 200, clientY: 100 }],
      });

      fireEvent.touchEnd(slider, {
        changedTouches: [{ clientX: 200, clientY: 100 }],
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Should not navigate (already at start)
      expect(mockOnDateChange).not.toHaveBeenCalled();
    });

    it('should not navigate beyond end with swipe left', async () => {
      render(
        <TemporalSlider
          parcelleId={mockParcelleId}
          startDate={mockStartDate}
          endDate={mockEndDate}
          interval="monthly"
          onDateChange={mockOnDateChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /mars 2024/i })).toBeInTheDocument();
      });

      mockOnDateChange.mockClear();

      const slider = screen.getByRole('region', { name: /Temporal slider/i });

      // Try to swipe left (next) from end
      fireEvent.touchStart(slider, {
        touches: [{ clientX: 200, clientY: 100 }],
      });

      fireEvent.touchMove(slider, {
        touches: [{ clientX: 100, clientY: 100 }],
      });

      fireEvent.touchEnd(slider, {
        changedTouches: [{ clientX: 100, clientY: 100 }],
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Should not navigate (already at end)
      expect(mockOnDateChange).not.toHaveBeenCalled();
    });

    it('should display touch gesture help on mobile', async () => {
      render(
        <TemporalSlider
          parcelleId={mockParcelleId}
          startDate={mockStartDate}
          endDate={mockEndDate}
          interval="monthly"
          onDateChange={mockOnDateChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Raccourcis:/i)).toBeInTheDocument();
      });

      // Should show touch gesture instructions (using getAllByText for multiple matches)
      const glisserElements = screen.getAllByText(/Glisser/i);
      expect(glisserElements.length).toBeGreaterThan(0);
    });

    it('should have larger touch targets on mobile', async () => {
      render(
        <TemporalSlider
          parcelleId={mockParcelleId}
          startDate={mockStartDate}
          endDate={mockEndDate}
          interval="monthly"
          onDateChange={mockOnDateChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/Play animation/i)).toBeInTheDocument();
      });

      const playButton = screen.getByLabelText(/Play animation/i);

      // Check that button has touch-manipulation class
      expect(playButton.className).toContain('touch-manipulation');
    });

    it('should have touch-manipulation class on slider input', async () => {
      render(
        <TemporalSlider
          parcelleId={mockParcelleId}
          startDate={mockStartDate}
          endDate={mockEndDate}
          interval="monthly"
          onDateChange={mockOnDateChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/Temporal slider/i)).toBeInTheDocument();
      });

      const sliderInput = screen.getByLabelText(/Temporal slider/i);

      // Check that slider input has touch-manipulation class
      expect(sliderInput.className).toContain('touch-manipulation');
    });

    it('should have active state styles on buttons for touch feedback', async () => {
      render(
        <TemporalSlider
          parcelleId={mockParcelleId}
          startDate={mockStartDate}
          endDate={mockEndDate}
          interval="monthly"
          onDateChange={mockOnDateChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/Play animation/i)).toBeInTheDocument();
      });

      const playButton = screen.getByLabelText(/Play animation/i);

      // Check that button has active state styles
      expect(playButton.className).toContain('active:bg-green-800');
    });
  });
});
