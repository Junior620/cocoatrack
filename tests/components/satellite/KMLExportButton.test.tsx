/**
 * Tests for KMLExportButton Component
 * 
 * Tests component rendering, modal interaction, export options, and file download.
 * 
 * Task: 5.3.3 - Write component tests
 * Acceptance Criteria:
 * - Test button rendering
 * - Test export trigger
 * - Test progress display
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { KMLExportButton } from '@/components/satellite/KMLExportButton';
import { createClient } from '@/lib/supabase/client';

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}));

// Mock fetch
global.fetch = vi.fn();

describe('KMLExportButton', () => {
  const mockSession = {
    access_token: 'mock-token',
    user: { id: 'user-123' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock Supabase auth
    (createClient as any).mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: mockSession },
          error: null,
        }),
      },
    });
  });

  describe('Component Rendering', () => {
    it('should render export button with text', () => {
      render(<KMLExportButton parcelleIds="parcelle-1" />);
      
      expect(screen.getByRole('button', { name: /exporter kml/i })).toBeInTheDocument();
    });

    it('should render export button without text when showText is false', () => {
      render(<KMLExportButton parcelleIds="parcelle-1" showText={false} />);
      
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).not.toHaveTextContent('Exporter KML');
    });

    it('should apply custom className', () => {
      render(<KMLExportButton parcelleIds="parcelle-1" className="custom-class" />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class');
    });

    it('should render with different variants', () => {
      const { rerender } = render(<KMLExportButton parcelleIds="parcelle-1" variant="primary" />);
      let button = screen.getByRole('button');
      expect(button).toHaveClass('bg-green-600');

      rerender(<KMLExportButton parcelleIds="parcelle-1" variant="outline" />);
      button = screen.getByRole('button');
      expect(button).toHaveClass('border');
    });

    it('should render with different sizes', () => {
      const { rerender } = render(<KMLExportButton parcelleIds="parcelle-1" size="sm" />);
      let button = screen.getByRole('button');
      expect(button).toHaveClass('px-3');

      rerender(<KMLExportButton parcelleIds="parcelle-1" size="lg" />);
      button = screen.getByRole('button');
      expect(button).toHaveClass('px-6');
    });
  });

  describe('Modal Interaction', () => {
    it('should open modal when button is clicked', () => {
      render(<KMLExportButton parcelleIds="parcelle-1" />);
      
      const button = screen.getByRole('button', { name: /exporter kml/i });
      fireEvent.click(button);
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Exporter en KML')).toBeInTheDocument();
    });

    it('should close modal when close button is clicked', () => {
      render(<KMLExportButton parcelleIds="parcelle-1" />);
      
      // Open modal
      fireEvent.click(screen.getByRole('button', { name: /exporter kml/i }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      
      // Close modal
      const closeButton = screen.getByRole('button', { name: /fermer/i });
      fireEvent.click(closeButton);
      
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should close modal when backdrop is clicked', () => {
      render(<KMLExportButton parcelleIds="parcelle-1" />);
      
      // Open modal
      fireEvent.click(screen.getByRole('button', { name: /exporter kml/i }));
      
      // Click backdrop
      const backdrop = screen.getByRole('dialog').previousSibling as HTMLElement;
      fireEvent.click(backdrop);
      
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should display single parcelle info in modal', () => {
      render(<KMLExportButton parcelleIds="parcelle-1" />);
      
      fireEvent.click(screen.getByRole('button', { name: /exporter kml/i }));
      
      expect(screen.getByText(/export d'une parcelle/i)).toBeInTheDocument();
    });

    it('should display batch export info in modal', () => {
      render(<KMLExportButton parcelleIds={['parcelle-1', 'parcelle-2', 'parcelle-3']} />);
      
      fireEvent.click(screen.getByRole('button', { name: /exporter kml/i }));
      
      expect(screen.getByText(/export de 3 parcelles/i)).toBeInTheDocument();
    });

    it('should not close modal during export', () => {
      (global.fetch as any).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          blob: vi.fn().mockResolvedValue(new Blob()),
          headers: new Headers(),
        }), 100))
      );

      render(<KMLExportButton parcelleIds="parcelle-1" />);
      
      fireEvent.click(screen.getByRole('button', { name: /exporter kml/i }));
      fireEvent.click(screen.getByRole('button', { name: /^exporter$/i }));
      
      // Try to close modal during export
      const closeButton = screen.getByRole('button', { name: /fermer/i });
      expect(closeButton).toBeDisabled();
    });
  });

  describe('Export Options', () => {
    it('should have NDVI option checked by default', () => {
      render(<KMLExportButton parcelleIds="parcelle-1" />);
      
      fireEvent.click(screen.getByRole('button', { name: /exporter kml/i }));
      
      const ndviCheckbox = screen.getByRole('checkbox', { name: /inclure ndvi/i });
      expect(ndviCheckbox).toBeChecked();
    });

    it('should toggle temporal data option', () => {
      render(<KMLExportButton parcelleIds="parcelle-1" />);
      
      fireEvent.click(screen.getByRole('button', { name: /exporter kml/i }));
      
      const temporalCheckbox = screen.getByRole('checkbox', { name: /données temporelles/i });
      expect(temporalCheckbox).not.toBeChecked();
      
      fireEvent.click(temporalCheckbox);
      expect(temporalCheckbox).toBeChecked();
    });

    it('should show date range inputs when temporal option is enabled', () => {
      render(<KMLExportButton parcelleIds="parcelle-1" />);
      
      fireEvent.click(screen.getByRole('button', { name: /exporter kml/i }));
      
      // Initially hidden
      expect(screen.queryByLabelText(/date de début/i)).not.toBeInTheDocument();
      
      // Enable temporal
      const temporalCheckbox = screen.getByRole('checkbox', { name: /données temporelles/i });
      fireEvent.click(temporalCheckbox);
      
      // Now visible
      expect(screen.getByLabelText(/date de début/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/date de fin/i)).toBeInTheDocument();
    });

    it('should toggle deforestation option', () => {
      render(<KMLExportButton parcelleIds="parcelle-1" />);
      
      fireEvent.click(screen.getByRole('button', { name: /exporter kml/i }));
      
      const deforestCheckbox = screen.getByRole('checkbox', { name: /alertes déforestation/i });
      expect(deforestCheckbox).not.toBeChecked();
      
      fireEvent.click(deforestCheckbox);
      expect(deforestCheckbox).toBeChecked();
    });

    it('should switch between KML and KMZ formats', () => {
      render(<KMLExportButton parcelleIds="parcelle-1" />);
      
      fireEvent.click(screen.getByRole('button', { name: /exporter kml/i }));
      
      const kmlRadio = screen.getByRole('radio', { name: /^kml$/i });
      const kmzRadio = screen.getByRole('radio', { name: /kmz/i });
      
      expect(kmlRadio).toBeChecked();
      expect(kmzRadio).not.toBeChecked();
      
      fireEvent.click(kmzRadio);
      
      expect(kmlRadio).not.toBeChecked();
      expect(kmzRadio).toBeChecked();
    });

    it('should disable all options during export', async () => {
      (global.fetch as any).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          blob: vi.fn().mockResolvedValue(new Blob()),
          headers: new Headers(),
        }), 100))
      );

      render(<KMLExportButton parcelleIds="parcelle-1" />);
      
      fireEvent.click(screen.getByRole('button', { name: /exporter kml/i }));
      fireEvent.click(screen.getByRole('button', { name: /^exporter$/i }));
      
      await waitFor(() => {
        const ndviCheckbox = screen.getByRole('checkbox', { name: /inclure ndvi/i });
        expect(ndviCheckbox).toBeDisabled();
      });
    });
  });

  describe('Export Validation', () => {
    it('should disable export button when temporal is enabled but dates are missing', () => {
      render(<KMLExportButton parcelleIds="parcelle-1" />);
      
      fireEvent.click(screen.getByRole('button', { name: /exporter kml/i }));
      
      // Enable temporal without dates
      const temporalCheckbox = screen.getByRole('checkbox', { name: /données temporelles/i });
      fireEvent.click(temporalCheckbox);
      
      const exportButton = screen.getByRole('button', { name: /^exporter$/i });
      expect(exportButton).toBeDisabled();
      
      // Show validation warning
      expect(screen.getByText(/veuillez sélectionner une plage de dates/i)).toBeInTheDocument();
    });

    it('should enable export button when temporal dates are provided', () => {
      render(<KMLExportButton parcelleIds="parcelle-1" />);
      
      fireEvent.click(screen.getByRole('button', { name: /exporter kml/i }));
      
      // Enable temporal
      const temporalCheckbox = screen.getByRole('checkbox', { name: /données temporelles/i });
      fireEvent.click(temporalCheckbox);
      
      // Fill dates
      const startDateInput = screen.getByLabelText(/date de début/i);
      const endDateInput = screen.getByLabelText(/date de fin/i);
      
      fireEvent.change(startDateInput, { target: { value: '2024-01-01' } });
      fireEvent.change(endDateInput, { target: { value: '2024-12-31' } });
      
      const exportButton = screen.getByRole('button', { name: /^exporter$/i });
      expect(exportButton).not.toBeDisabled();
    });

    it('should disable export button when all options are unchecked', () => {
      render(<KMLExportButton parcelleIds="parcelle-1" />);
      
      fireEvent.click(screen.getByRole('button', { name: /exporter kml/i }));
      
      // Uncheck NDVI (the only checked option by default)
      const ndviCheckbox = screen.getByRole('checkbox', { name: /inclure ndvi/i });
      fireEvent.click(ndviCheckbox);
      
      const exportButton = screen.getByRole('button', { name: /^exporter$/i });
      expect(exportButton).toBeDisabled();
    });
  });

  describe('Export Trigger', () => {
    it('should call API with correct parameters for single parcelle', async () => {
      const mockBlob = new Blob(['mock kml data'], { type: 'application/vnd.google-earth.kml+xml' });
      (global.fetch as any).mockResolvedValue({
        ok: true,
        blob: vi.fn().mockResolvedValue(mockBlob),
        headers: new Headers({
          'content-disposition': 'attachment; filename="export.kml"',
        }),
      });

      // Mock URL.createObjectURL
      global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
      global.URL.revokeObjectURL = vi.fn();

      render(<KMLExportButton parcelleIds="parcelle-1" />);
      
      // Open modal and export
      fireEvent.click(screen.getByRole('button', { name: /exporter kml/i }));
      
      const exportButton = screen.getByRole('button', { name: /^exporter$/i });
      fireEvent.click(exportButton);
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/satellite/export/kml',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
              Authorization: `Bearer ${mockSession.access_token}`,
            }),
            body: expect.stringContaining('parcelle-1'),
          })
        );
      });
    });

    it('should call API with correct parameters for batch export', async () => {
      const mockBlob = new Blob(['mock kml data']);
      (global.fetch as any).mockResolvedValue({
        ok: true,
        blob: vi.fn().mockResolvedValue(mockBlob),
        headers: new Headers(),
      });

      global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
      global.URL.revokeObjectURL = vi.fn();

      render(<KMLExportButton parcelleIds={['parcelle-1', 'parcelle-2']} />);
      
      fireEvent.click(screen.getByRole('button', { name: /exporter kml/i }));
      fireEvent.click(screen.getByRole('button', { name: /^exporter$/i }));
      
      await waitFor(() => {
        const fetchCall = (global.fetch as any).mock.calls[0];
        const body = JSON.parse(fetchCall[1].body);
        expect(body.parcelleIds).toEqual(['parcelle-1', 'parcelle-2']);
      });
    });

    it('should include temporal dates in API request when enabled', async () => {
      const mockBlob = new Blob(['mock kml data']);
      (global.fetch as any).mockResolvedValue({
        ok: true,
        blob: vi.fn().mockResolvedValue(mockBlob),
        headers: new Headers(),
      });

      global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
      global.URL.revokeObjectURL = vi.fn();

      render(<KMLExportButton parcelleIds="parcelle-1" />);
      
      fireEvent.click(screen.getByRole('button', { name: /exporter kml/i }));
      
      // Enable temporal and set dates
      const temporalCheckbox = screen.getByRole('checkbox', { name: /données temporelles/i });
      fireEvent.click(temporalCheckbox);
      
      fireEvent.change(screen.getByLabelText(/date de début/i), { target: { value: '2024-01-01' } });
      fireEvent.change(screen.getByLabelText(/date de fin/i), { target: { value: '2024-12-31' } });
      
      fireEvent.click(screen.getByRole('button', { name: /^exporter$/i }));
      
      await waitFor(() => {
        const fetchCall = (global.fetch as any).mock.calls[0];
        const body = JSON.parse(fetchCall[1].body);
        expect(body.options.includeTemporal).toBe(true);
        expect(body.options.startDate).toBeDefined();
        expect(body.options.endDate).toBeDefined();
      });
    });

    it('should trigger file download on successful export', async () => {
      const mockBlob = new Blob(['mock kml data']);
      (global.fetch as any).mockResolvedValue({
        ok: true,
        blob: vi.fn().mockResolvedValue(mockBlob),
        headers: new Headers({
          'content-disposition': 'attachment; filename="test-export.kml"',
        }),
      });

      const mockCreateObjectURL = vi.fn(() => 'blob:mock-url');
      const mockRevokeObjectURL = vi.fn();
      global.URL.createObjectURL = mockCreateObjectURL;
      global.URL.revokeObjectURL = mockRevokeObjectURL;

      // Mock document.createElement and appendChild
      const mockAnchor = {
        href: '',
        download: '',
        click: vi.fn(),
      };
      const originalCreateElement = document.createElement.bind(document);
      document.createElement = vi.fn((tag) => {
        if (tag === 'a') return mockAnchor as any;
        return originalCreateElement(tag);
      });

      render(<KMLExportButton parcelleIds="parcelle-1" />);
      
      fireEvent.click(screen.getByRole('button', { name: /exporter kml/i }));
      fireEvent.click(screen.getByRole('button', { name: /^exporter$/i }));
      
      await waitFor(() => {
        expect(mockAnchor.click).toHaveBeenCalled();
        expect(mockAnchor.download).toBe('test-export.kml');
      });
    });
  });

  describe('Progress Display', () => {
    it('should show progress indicator during export', async () => {
      let resolveExport: any;
      (global.fetch as any).mockImplementation(() => 
        new Promise(resolve => {
          resolveExport = resolve;
        })
      );

      render(<KMLExportButton parcelleIds="parcelle-1" />);
      
      fireEvent.click(screen.getByRole('button', { name: /exporter kml/i }));
      fireEvent.click(screen.getByRole('button', { name: /^exporter$/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/export en cours/i)).toBeInTheDocument();
      });

      // Cleanup: resolve the promise
      if (resolveExport) {
        resolveExport({
          ok: true,
          blob: vi.fn().mockResolvedValue(new Blob()),
          headers: new Headers(),
        });
      }
    });

    it('should show progress percentage', async () => {
      let resolveExport: any;
      (global.fetch as any).mockImplementation(() => 
        new Promise(resolve => {
          resolveExport = resolve;
        })
      );

      render(<KMLExportButton parcelleIds="parcelle-1" />);
      
      fireEvent.click(screen.getByRole('button', { name: /exporter kml/i }));
      fireEvent.click(screen.getByRole('button', { name: /^exporter$/i }));
      
      await waitFor(() => {
        // Progress should be visible (any percentage)
        const progressText = screen.getByText(/%$/);
        expect(progressText).toBeInTheDocument();
      });

      // Cleanup
      if (resolveExport) {
        resolveExport({
          ok: true,
          blob: vi.fn().mockResolvedValue(new Blob()),
          headers: new Headers(),
        });
      }
    });

    it('should show progress bar during export', async () => {
      let resolveExport: any;
      (global.fetch as any).mockImplementation(() => 
        new Promise(resolve => {
          resolveExport = resolve;
        })
      );

      render(<KMLExportButton parcelleIds="parcelle-1" />);
      
      fireEvent.click(screen.getByRole('button', { name: /exporter kml/i }));
      fireEvent.click(screen.getByRole('button', { name: /^exporter$/i }));
      
      await waitFor(() => {
        const progressBar = document.querySelector('.bg-green-600');
        expect(progressBar).toBeInTheDocument();
      });

      // Cleanup
      if (resolveExport) {
        resolveExport({
          ok: true,
          blob: vi.fn().mockResolvedValue(new Blob()),
          headers: new Headers(),
        });
      }
    });

    it('should display export button text during export', async () => {
      let resolveExport: any;
      (global.fetch as any).mockImplementation(() => 
        new Promise(resolve => {
          resolveExport = resolve;
        })
      );

      render(<KMLExportButton parcelleIds="parcelle-1" />);
      
      fireEvent.click(screen.getByRole('button', { name: /exporter kml/i }));
      fireEvent.click(screen.getByRole('button', { name: /^exporter$/i }));
      
      await waitFor(() => {
        // Check for the button with export in progress text
        const exportButton = screen.getByRole('button', { name: /export en cours/i });
        expect(exportButton).toBeInTheDocument();
        expect(exportButton).toBeDisabled();
      });

      // Cleanup
      if (resolveExport) {
        resolveExport({
          ok: true,
          blob: vi.fn().mockResolvedValue(new Blob()),
          headers: new Headers(),
        });
      }
    });
  });

  describe('Error Handling', () => {
    it('should display error message on export failure', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({ error: 'Export failed' }),
      });

      render(<KMLExportButton parcelleIds="parcelle-1" />);
      
      fireEvent.click(screen.getByRole('button', { name: /exporter kml/i }));
      fireEvent.click(screen.getByRole('button', { name: /^exporter$/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/export failed/i)).toBeInTheDocument();
      });
    });

    it('should display error when user is not authenticated', async () => {
      (createClient as any).mockReturnValue({
        auth: {
          getSession: vi.fn().mockResolvedValue({
            data: { session: null },
            error: null,
          }),
        },
      });

      render(<KMLExportButton parcelleIds="parcelle-1" />);
      
      fireEvent.click(screen.getByRole('button', { name: /exporter kml/i }));
      fireEvent.click(screen.getByRole('button', { name: /^exporter$/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/vous devez être connecté/i)).toBeInTheDocument();
      });
    });

    it('should reset progress on error', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({ error: 'Export failed' }),
      });

      render(<KMLExportButton parcelleIds="parcelle-1" />);
      
      fireEvent.click(screen.getByRole('button', { name: /exporter kml/i }));
      fireEvent.click(screen.getByRole('button', { name: /^exporter$/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/export failed/i)).toBeInTheDocument();
      });

      // Progress should be hidden after error
      expect(screen.queryByText(/export en cours/i)).not.toBeInTheDocument();
    });
  });

  describe('Callbacks', () => {
    it('should trigger export process when export button is clicked', async () => {
      const mockBlob = new Blob(['mock kml data']);
      
      (global.fetch as any).mockResolvedValue({
        ok: true,
        blob: vi.fn().mockResolvedValue(mockBlob),
        headers: new Headers(),
      });

      render(<KMLExportButton parcelleIds="parcelle-1" />);
      
      fireEvent.click(screen.getByRole('button', { name: /exporter kml/i }));
      fireEvent.click(screen.getByRole('button', { name: /^exporter$/i }));
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });

    it('should not call onComplete callback on export failure', async () => {
      const onComplete = vi.fn();
      
      (global.fetch as any).mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({ error: 'Export failed' }),
      });

      render(<KMLExportButton parcelleIds="parcelle-1" onComplete={onComplete} />);
      
      fireEvent.click(screen.getByRole('button', { name: /exporter kml/i }));
      fireEvent.click(screen.getByRole('button', { name: /^exporter$/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/export failed/i)).toBeInTheDocument();
      });

      expect(onComplete).not.toHaveBeenCalled();
    });
  });
});
