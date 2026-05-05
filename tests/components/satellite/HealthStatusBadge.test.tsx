import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import HealthStatusBadge, {
  HealthStatus,
  TrendDirection,
  BadgeSize,
} from '@/components/satellite/HealthStatusBadge';

describe('HealthStatusBadge', () => {
  describe('Basic Rendering', () => {
    it('renders with excellent status', () => {
      render(<HealthStatusBadge status="excellent" />);
      expect(screen.getByText('Excellent')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveAttribute(
        'aria-label',
        'Health status: Excellent'
      );
    });

    it('renders with good status', () => {
      render(<HealthStatusBadge status="good" />);
      expect(screen.getByText('Good')).toBeInTheDocument();
    });

    it('renders with fair status', () => {
      render(<HealthStatusBadge status="fair" />);
      expect(screen.getByText('Fair')).toBeInTheDocument();
    });

    it('renders with poor status', () => {
      render(<HealthStatusBadge status="poor" />);
      expect(screen.getByText('Poor')).toBeInTheDocument();
    });

    it('renders with critical status', () => {
      render(<HealthStatusBadge status="critical" />);
      expect(screen.getByText('Critical')).toBeInTheDocument();
    });
  });

  describe('Color Coding', () => {
    it('applies dark green color for excellent status', () => {
      render(<HealthStatusBadge status="excellent" />);
      const badge = screen.getByRole('status');
      expect(badge).toHaveClass('bg-[#2d5016]', 'text-white');
    });

    it('applies green color for good status', () => {
      render(<HealthStatusBadge status="good" />);
      const badge = screen.getByRole('status');
      expect(badge).toHaveClass('bg-[#6FAF3D]', 'text-white');
    });

    it('applies yellow color for fair status', () => {
      render(<HealthStatusBadge status="fair" />);
      const badge = screen.getByRole('status');
      expect(badge).toHaveClass('bg-[#fbbf24]', 'text-gray-900');
    });

    it('applies orange color for poor status', () => {
      render(<HealthStatusBadge status="poor" />);
      const badge = screen.getByRole('status');
      expect(badge).toHaveClass('bg-[#E68A1F]', 'text-white');
    });

    it('applies red color for critical status', () => {
      render(<HealthStatusBadge status="critical" />);
      const badge = screen.getByRole('status');
      expect(badge).toHaveClass('bg-[#ef4444]', 'text-white');
    });
  });

  describe('Size Variants', () => {
    it('renders small size correctly', () => {
      render(<HealthStatusBadge status="good" size="sm" />);
      const badge = screen.getByRole('status');
      expect(badge).toHaveClass('px-2', 'py-0.5', 'text-xs');
    });

    it('renders medium size correctly (default)', () => {
      render(<HealthStatusBadge status="good" />);
      const badge = screen.getByRole('status');
      expect(badge).toHaveClass('px-3', 'py-1', 'text-sm');
    });

    it('renders large size correctly', () => {
      render(<HealthStatusBadge status="good" size="lg" />);
      const badge = screen.getByRole('status');
      expect(badge).toHaveClass('px-4', 'py-2', 'text-base');
    });
  });

  describe('Trend Indicators', () => {
    it('does not show trend indicator by default', () => {
      render(<HealthStatusBadge status="good" trend="improving" />);
      expect(screen.queryByLabelText('Improving')).not.toBeInTheDocument();
    });

    it('shows improving trend indicator when enabled', () => {
      render(<HealthStatusBadge status="good" showTrend trend="improving" />);
      expect(screen.getByLabelText('Improving')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveAttribute(
        'aria-label',
        'Health status: Good, trend: improving'
      );
    });

    it('shows declining trend indicator when enabled', () => {
      render(<HealthStatusBadge status="poor" showTrend trend="declining" />);
      expect(screen.getByLabelText('Declining')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveAttribute(
        'aria-label',
        'Health status: Poor, trend: declining'
      );
    });

    it('shows stable trend indicator when enabled', () => {
      render(<HealthStatusBadge status="fair" showTrend trend="stable" />);
      expect(screen.getByLabelText('Stable')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveAttribute(
        'aria-label',
        'Health status: Fair, trend: stable'
      );
    });

    it('does not show trend indicator when showTrend is false', () => {
      render(
        <HealthStatusBadge status="good" showTrend={false} trend="improving" />
      );
      expect(screen.queryByLabelText('Improving')).not.toBeInTheDocument();
    });

    it('does not show trend indicator when trend is undefined', () => {
      render(<HealthStatusBadge status="good" showTrend />);
      expect(screen.queryByLabelText('Improving')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Declining')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Stable')).not.toBeInTheDocument();
    });
  });

  describe('Custom Styling', () => {
    it('applies custom className', () => {
      render(<HealthStatusBadge status="good" className="custom-class" />);
      const badge = screen.getByRole('status');
      expect(badge).toHaveClass('custom-class');
    });

    it('preserves default classes when custom className is provided', () => {
      render(<HealthStatusBadge status="good" className="custom-class" />);
      const badge = screen.getByRole('status');
      expect(badge).toHaveClass('custom-class', 'bg-[#6FAF3D]', 'rounded-full');
    });
  });

  describe('Accessibility', () => {
    it('has role="status" for screen readers', () => {
      render(<HealthStatusBadge status="good" />);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('includes status in aria-label', () => {
      render(<HealthStatusBadge status="excellent" />);
      expect(screen.getByRole('status')).toHaveAttribute(
        'aria-label',
        'Health status: Excellent'
      );
    });

    it('includes trend in aria-label when shown', () => {
      render(<HealthStatusBadge status="good" showTrend trend="improving" />);
      expect(screen.getByRole('status')).toHaveAttribute(
        'aria-label',
        'Health status: Good, trend: improving'
      );
    });
  });

  describe('All Status and Trend Combinations', () => {
    const statuses: HealthStatus[] = [
      'excellent',
      'good',
      'fair',
      'poor',
      'critical',
    ];
    const trends: TrendDirection[] = ['improving', 'stable', 'declining'];
    const sizes: BadgeSize[] = ['sm', 'md', 'lg'];

    statuses.forEach((status) => {
      trends.forEach((trend) => {
        sizes.forEach((size) => {
          it(`renders ${status} status with ${trend} trend at ${size} size`, () => {
            render(
              <HealthStatusBadge
                status={status}
                showTrend
                trend={trend}
                size={size}
              />
            );
            expect(screen.getByRole('status')).toBeInTheDocument();
          });
        });
      });
    });
  });
});
