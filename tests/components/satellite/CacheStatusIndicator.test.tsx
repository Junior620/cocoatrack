/**
 * Tests for Cache Status Indicator Component
 * 
 * Requirements: Task 6.3.2
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  CacheStatusIndicator,
  CacheStatusBadge,
  CacheStatusText,
} from '@/components/satellite/CacheStatusIndicator';

describe('CacheStatusIndicator', () => {
  describe('CacheStatusIndicator', () => {
    it('should render nothing when not offline and not cached', () => {
      const { container } = render(
        <CacheStatusIndicator offline={false} cached={false} />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should render offline indicator when offline', () => {
      render(<CacheStatusIndicator offline={true} cached={false} />);

      expect(screen.getByText('Offline Mode')).toBeInTheDocument();
      expect(screen.getByRole('status', { name: 'Offline mode' })).toBeInTheDocument();
    });

    it('should render cached data indicator when cached and not stale', () => {
      const cachedAt = new Date();
      cachedAt.setDate(cachedAt.getDate() - 5); // 5 days ago

      render(
        <CacheStatusIndicator
          offline={false}
          cached={true}
          cachedAt={cachedAt}
          isStale={false}
        />
      );

      expect(screen.getByText('Cached Data')).toBeInTheDocument();
      expect(screen.getByRole('status', { name: 'Cached data' })).toBeInTheDocument();
    });

    it('should render stale data warning when cached and stale', () => {
      const cachedAt = new Date();
      cachedAt.setDate(cachedAt.getDate() - 35); // 35 days ago (stale)

      render(
        <CacheStatusIndicator
          offline={false}
          cached={true}
          cachedAt={cachedAt}
          isStale={true}
        />
      );

      expect(screen.getByText('Stale Data')).toBeInTheDocument();
      expect(screen.getByRole('alert', { name: 'Stale cached data' })).toBeInTheDocument();
    });

    it('should show cache age when showDetails is true', () => {
      const cachedAt = new Date();
      cachedAt.setDate(cachedAt.getDate() - 5); // 5 days ago

      render(
        <CacheStatusIndicator
          offline={false}
          cached={true}
          cachedAt={cachedAt}
          isStale={false}
          showDetails={true}
        />
      );

      expect(screen.getByText(/5 days ago/)).toBeInTheDocument();
    });

    it('should show stale data explanation when stale and showDetails is true', () => {
      const cachedAt = new Date();
      cachedAt.setDate(cachedAt.getDate() - 35); // 35 days ago

      render(
        <CacheStatusIndicator
          offline={false}
          cached={true}
          cachedAt={cachedAt}
          isStale={true}
          showDetails={true}
        />
      );

      expect(screen.getByText(/Data may be outdated/)).toBeInTheDocument();
      expect(screen.getByText(/more than 30 days old/)).toBeInTheDocument();
    });

    it('should show offline explanation when offline and showDetails is true', () => {
      render(
        <CacheStatusIndicator
          offline={true}
          cached={false}
          showDetails={true}
        />
      );

      // Use getAllByText since "Offline Mode" appears twice (badge + explanation)
      const offlineTexts = screen.getAllByText(/Offline Mode/);
      expect(offlineTexts.length).toBeGreaterThan(0);
      expect(screen.getByText(/currently offline/)).toBeInTheDocument();
    });

    it('should apply size classes correctly', () => {
      const { rerender } = render(
        <CacheStatusIndicator offline={true} size="sm" />
      );

      let offlineElement = screen.getByText('Offline Mode').parentElement;
      expect(offlineElement).toHaveClass('text-xs');

      rerender(<CacheStatusIndicator offline={true} size="md" />);
      offlineElement = screen.getByText('Offline Mode').parentElement;
      expect(offlineElement).toHaveClass('text-sm');

      rerender(<CacheStatusIndicator offline={true} size="lg" />);
      offlineElement = screen.getByText('Offline Mode').parentElement;
      expect(offlineElement).toHaveClass('text-base');
    });

    it('should apply custom className', () => {
      const { container } = render(
        <CacheStatusIndicator
          offline={true}
          className="custom-class"
        />
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('CacheStatusBadge', () => {
    it('should render nothing when not offline, not cached, and not stale', () => {
      const { container } = render(
        <CacheStatusBadge offline={false} cached={false} isStale={false} />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should prioritize offline status', () => {
      render(
        <CacheStatusBadge offline={true} cached={true} isStale={true} />
      );

      expect(screen.getByText('Offline')).toBeInTheDocument();
      expect(screen.queryByText('Stale')).not.toBeInTheDocument();
      expect(screen.queryByText('Cached')).not.toBeInTheDocument();
    });

    it('should show stale badge when not offline but stale', () => {
      render(
        <CacheStatusBadge offline={false} cached={true} isStale={true} />
      );

      expect(screen.getByText('Stale')).toBeInTheDocument();
      expect(screen.queryByText('Cached')).not.toBeInTheDocument();
    });

    it('should show cached badge when not offline and not stale', () => {
      render(
        <CacheStatusBadge offline={false} cached={true} isStale={false} />
      );

      expect(screen.getByText('Cached')).toBeInTheDocument();
    });

    it('should have appropriate title attributes', () => {
      const { rerender } = render(
        <CacheStatusBadge offline={true} cached={false} isStale={false} />
      );

      let badge = screen.getByText('Offline');
      expect(badge).toHaveAttribute('title', 'Offline mode - showing cached data');

      rerender(<CacheStatusBadge offline={false} cached={true} isStale={true} />);
      badge = screen.getByText('Stale');
      expect(badge).toHaveAttribute('title', 'Cached data is more than 30 days old');

      rerender(<CacheStatusBadge offline={false} cached={true} isStale={false} />);
      badge = screen.getByText('Cached');
      expect(badge).toHaveAttribute('title', 'Showing cached data');
    });
  });

  describe('CacheStatusText', () => {
    it('should render nothing when not offline, not cached, and not stale', () => {
      const { container } = render(
        <CacheStatusText offline={false} cached={false} isStale={false} />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should show offline text when offline', () => {
      render(<CacheStatusText offline={true} cached={false} />);

      expect(screen.getByText('(offline mode)')).toBeInTheDocument();
    });

    it('should show stale text with age when stale', () => {
      const cachedAt = new Date();
      cachedAt.setDate(cachedAt.getDate() - 35); // 35 days ago

      render(
        <CacheStatusText
          offline={false}
          cached={true}
          cachedAt={cachedAt}
          isStale={true}
        />
      );

      const text = screen.getByText(/cached.*may be outdated/);
      expect(text).toBeInTheDocument();
    });

    it('should show cached text with age when cached but not stale', () => {
      const cachedAt = new Date();
      cachedAt.setDate(cachedAt.getDate() - 5); // 5 days ago

      render(
        <CacheStatusText
          offline={false}
          cached={true}
          cachedAt={cachedAt}
          isStale={false}
        />
      );

      const text = screen.getByText(/cached 5 days ago/);
      expect(text).toBeInTheDocument();
    });
  });
});
