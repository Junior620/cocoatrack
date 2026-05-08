/**
 * Tests for ExportCSVButton component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ExportCSVButton } from '@/components/satellite/ExportCSVButton';

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn(() =>
        Promise.resolve({
          data: {
            session: {
              access_token: 'mock-token',
            },
          },
          error: null,
        })
      ),
    },
  })),
}));

// Mock fetch
global.fetch = vi.fn();

describe('ExportCSVButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render button with default text', () => {
    render(<ExportCSVButton parcelleId="test-id" />);
    
    expect(screen.getByText('Exporter CSV')).toBeInTheDocument();
  });

  it('should show loading state when exporting', async () => {
    // Mock successful fetch
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      headers: new Map([['content-disposition', 'attachment; filename="test.csv"']]),
      blob: () => Promise.resolve(new Blob(['test data'], { type: 'text/csv' })),
    });

    render(<ExportCSVButton parcelleId="test-id" />);
    
    const button = screen.getByText('Exporter CSV');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Export en cours...')).toBeInTheDocument();
    });
  });

  it('should call API with correct parameters', async () => {
    // Mock successful fetch
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      headers: new Map([['content-disposition', 'attachment; filename="test.csv"']]),
      blob: () => Promise.resolve(new Blob(['test data'], { type: 'text/csv' })),
    });

    // Mock URL.createObjectURL and related methods
    global.URL.createObjectURL = vi.fn(() => 'mock-url');
    global.URL.revokeObjectURL = vi.fn();

    render(<ExportCSVButton parcelleId="test-parcelle-id" />);
    
    const button = screen.getByText('Exporter CSV');
    fireEvent.click(button);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/satellite/export/csv?parcelleId=test-parcelle-id'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-token',
          }),
        })
      );
    });
  });

  it('should include date range in API call when provided', async () => {
    // Mock successful fetch
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      headers: new Map([['content-disposition', 'attachment; filename="test.csv"']]),
      blob: () => Promise.resolve(new Blob(['test data'], { type: 'text/csv' })),
    });

    // Mock URL methods
    global.URL.createObjectURL = vi.fn(() => 'mock-url');
    global.URL.revokeObjectURL = vi.fn();

    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-12-31');

    render(
      <ExportCSVButton
        parcelleId="test-id"
        startDate={startDate}
        endDate={endDate}
      />
    );
    
    const button = screen.getByText('Exporter CSV');
    fireEvent.click(button);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('startDate=2024-01-01'),
        expect.any(Object)
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('endDate=2024-12-31'),
        expect.any(Object)
      );
    });
  });

  it('should display error message on API failure', async () => {
    // Mock failed fetch
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Test error message' }),
    });

    render(<ExportCSVButton parcelleId="test-id" />);
    
    const button = screen.getByText('Exporter CSV');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Test error message')).toBeInTheDocument();
    });
  });

  it('should apply custom className', () => {
    render(<ExportCSVButton parcelleId="test-id" className="custom-class" />);
    
    const button = screen.getByText('Exporter CSV');
    expect(button).toHaveClass('custom-class');
  });

  it('should render with different variants', () => {
    const { rerender } = render(
      <ExportCSVButton parcelleId="test-id" variant="primary" />
    );
    
    let button = screen.getByText('Exporter CSV');
    expect(button).toHaveClass('bg-green-600');

    rerender(<ExportCSVButton parcelleId="test-id" variant="secondary" />);
    button = screen.getByText('Exporter CSV');
    expect(button).toHaveClass('bg-gray-600');

    rerender(<ExportCSVButton parcelleId="test-id" variant="outline" />);
    button = screen.getByText('Exporter CSV');
    expect(button).toHaveClass('border');
  });

  it('should render with different sizes', () => {
    const { rerender } = render(
      <ExportCSVButton parcelleId="test-id" size="sm" />
    );
    
    let button = screen.getByText('Exporter CSV');
    expect(button).toHaveClass('text-sm');

    rerender(<ExportCSVButton parcelleId="test-id" size="md" />);
    button = screen.getByText('Exporter CSV');
    expect(button).toHaveClass('text-base');

    rerender(<ExportCSVButton parcelleId="test-id" size="lg" />);
    button = screen.getByText('Exporter CSV');
    expect(button).toHaveClass('text-lg');
  });

  it('should disable button while exporting', async () => {
    // Mock slow fetch
    (global.fetch as any).mockImplementationOnce(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                headers: new Map([['content-disposition', 'attachment; filename="test.csv"']]),
                blob: () => Promise.resolve(new Blob(['test data'], { type: 'text/csv' })),
              }),
            100
          )
        )
    );

    render(<ExportCSVButton parcelleId="test-id" />);
    
    const button = screen.getByText('Exporter CSV') as HTMLButtonElement;
    fireEvent.click(button);

    await waitFor(() => {
      expect(button.disabled).toBe(true);
    });
  });
});
