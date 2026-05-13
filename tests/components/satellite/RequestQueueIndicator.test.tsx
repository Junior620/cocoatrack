/**
 * Tests for RequestQueueIndicator Component
 * 
 * Tests the UI component for displaying request queue status.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RequestQueueIndicator, RequestQueueBadge } from '@/components/satellite/RequestQueueIndicator';
import * as useRequestQueueModule from '@/hooks/satellite/useRequestQueue';

// Mock the hook
vi.mock('@/hooks/satellite/useRequestQueue', () => ({
  useRequestQueue: vi.fn(),
}));

describe('RequestQueueIndicator', () => {
  const mockUseRequestQueue = vi.mocked(useRequestQueueModule.useRequestQueue);

  beforeEach(() => {
    mockUseRequestQueue.mockReturnValue({
      state: {
        statistics: {
          totalRequests: 2,
          pendingRequests: 2,
          failedRequests: 0,
          oldestRequest: new Date(),
          newestRequest: new Date(),
        },
        isRetrying: false,
        isLoading: false,
        error: null,
      },
      operations: {
        retryAll: vi.fn(),
        clear: vi.fn(),
        remove: vi.fn(),
        refresh: vi.fn(),
      },
      pendingCount: 2,
      requests: [
        {
          id: 'req1',
          url: '/api/test1',
          method: 'GET',
          headers: {},
          retryCount: 0,
          maxRetries: 5,
          nextRetryAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          lastAttemptAt: null,
          error: null,
        },
        {
          id: 'req2',
          url: '/api/test2',
          method: 'POST',
          headers: {},
          retryCount: 1,
          maxRetries: 5,
          nextRetryAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          lastAttemptAt: new Date().toISOString(),
          error: 'Network error',
          metadata: {
            parcelleId: '123',
            operation: 'ndvi-calculation',
            description: 'Calculate NDVI',
          },
        },
      ],
    });
  });

  it('should render compact badge when not showing details', () => {
    render(<RequestQueueIndicator />);

    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('pending')).toBeInTheDocument();
  });

  it('should not render when no pending requests', () => {
    mockUseRequestQueue.mockReturnValue({
      state: {
        statistics: {
          totalRequests: 0,
          pendingRequests: 0,
          failedRequests: 0,
          oldestRequest: null,
          newestRequest: null,
        },
        isRetrying: false,
        isLoading: false,
        error: null,
      },
      operations: {
        retryAll: vi.fn(),
        clear: vi.fn(),
        remove: vi.fn(),
        refresh: vi.fn(),
      },
      pendingCount: 0,
      requests: [],
    });

    const { container } = render(<RequestQueueIndicator />);
    expect(container.firstChild).toBeNull();
  });

  it('should show details panel when badge is clicked', async () => {
    render(<RequestQueueIndicator />);

    const badge = screen.getByRole('button', { name: /pending requests/i });
    fireEvent.click(badge);

    await waitFor(() => {
      expect(screen.getByText('Offline Queue')).toBeInTheDocument();
    });

    expect(screen.getByText('Pending requests:')).toBeInTheDocument();
    expect(screen.getByText('Queued Requests')).toBeInTheDocument();
  });

  it('should display request details in panel', async () => {
    render(<RequestQueueIndicator showDetailsDefault={true} />);

    expect(screen.getByText('GET')).toBeInTheDocument();
    expect(screen.getByText('POST')).toBeInTheDocument();
    expect(screen.getByText('Calculate NDVI')).toBeInTheDocument();
    expect(screen.getByText('Parcelle: 123')).toBeInTheDocument();
    expect(screen.getByText('Error: Network error')).toBeInTheDocument();
  });

  it('should call retryAll when retry button is clicked', async () => {
    const mockRetryAll = vi.fn();
    mockUseRequestQueue.mockReturnValue({
      ...mockUseRequestQueue(),
      operations: {
        retryAll: mockRetryAll,
        clear: vi.fn(),
        remove: vi.fn(),
        refresh: vi.fn(),
      },
    });

    render(<RequestQueueIndicator showDetailsDefault={true} />);

    const retryButton = screen.getByRole('button', { name: /retry all/i });
    fireEvent.click(retryButton);

    expect(mockRetryAll).toHaveBeenCalled();
  });

  it('should call clear when clear button is clicked', async () => {
    const mockClear = vi.fn();
    mockUseRequestQueue.mockReturnValue({
      ...mockUseRequestQueue(),
      operations: {
        retryAll: vi.fn(),
        clear: mockClear,
        remove: vi.fn(),
        refresh: vi.fn(),
      },
    });

    render(<RequestQueueIndicator showDetailsDefault={true} />);

    const clearButton = screen.getByRole('button', { name: /clear/i });
    fireEvent.click(clearButton);

    expect(mockClear).toHaveBeenCalled();
  });

  it('should disable retry button when retrying', () => {
    mockUseRequestQueue.mockReturnValue({
      ...mockUseRequestQueue(),
      state: {
        ...mockUseRequestQueue().state,
        isRetrying: true,
      },
    });

    render(<RequestQueueIndicator showDetailsDefault={true} />);

    const retryButton = screen.getByRole('button', { name: /retry all/i });
    expect(retryButton).toBeDisabled();
    expect(retryButton).toHaveTextContent('Retrying...');
  });

  it('should show failed requests warning', () => {
    mockUseRequestQueue.mockReturnValue({
      ...mockUseRequestQueue(),
      state: {
        ...mockUseRequestQueue().state,
        statistics: {
          totalRequests: 3,
          pendingRequests: 2,
          failedRequests: 1,
          oldestRequest: new Date(),
          newestRequest: new Date(),
        },
      },
    });

    render(<RequestQueueIndicator showDetailsDefault={true} />);

    expect(screen.getByText(/1 failed \(max retries\)/i)).toBeInTheDocument();
  });

  it('should display error message', () => {
    mockUseRequestQueue.mockReturnValue({
      ...mockUseRequestQueue(),
      state: {
        ...mockUseRequestQueue().state,
        error: new Error('Test error'),
      },
    });

    render(<RequestQueueIndicator showDetailsDefault={true} />);

    expect(screen.getByText('Test error')).toBeInTheDocument();
  });

  it('should close details panel when close button is clicked', async () => {
    render(<RequestQueueIndicator showDetailsDefault={true} />);

    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByText('Offline Queue')).not.toBeInTheDocument();
    });
  });

  it('should render at different positions', () => {
    const { rerender, container } = render(<RequestQueueIndicator position="top-left" />);
    expect(container.firstChild).toHaveClass('top-4', 'left-4');

    rerender(<RequestQueueIndicator position="top-right" />);
    expect(container.firstChild).toHaveClass('top-4', 'right-4');

    rerender(<RequestQueueIndicator position="bottom-left" />);
    expect(container.firstChild).toHaveClass('bottom-4', 'left-4');

    rerender(<RequestQueueIndicator position="bottom-right" />);
    expect(container.firstChild).toHaveClass('bottom-4', 'right-4');
  });
});

describe('RequestQueueBadge', () => {
  const mockUseRequestQueue = vi.mocked(useRequestQueueModule.useRequestQueue);

  beforeEach(() => {
    mockUseRequestQueue.mockReturnValue({
      state: {
        statistics: null,
        isRetrying: false,
        isLoading: false,
        error: null,
      },
      operations: {
        retryAll: vi.fn(),
        clear: vi.fn(),
        remove: vi.fn(),
        refresh: vi.fn(),
      },
      pendingCount: 3,
      requests: [],
    });
  });

  it('should render badge with count', () => {
    render(<RequestQueueBadge />);

    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('should not render when no pending requests', () => {
    mockUseRequestQueue.mockReturnValue({
      ...mockUseRequestQueue(),
      pendingCount: 0,
    });

    const { container } = render(<RequestQueueBadge />);
    expect(container.firstChild).toBeNull();
  });

  it('should have correct aria-label', () => {
    render(<RequestQueueBadge />);

    const badge = screen.getByRole('status');
    expect(badge).toHaveAttribute('aria-label', '3 pending requests');
  });
});
