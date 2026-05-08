/**
 * Unit tests for BatchReportGenerator component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BatchReportGenerator } from '@/components/satellite/BatchReportGenerator';

// Mock the useBatchReports hook
vi.mock('@/hooks/satellite/useBatchReports', () => ({
  useBatchReports: vi.fn(() => ({
    generateBatchReports: vi.fn(),
    loading: false,
    error: null,
    progress: null,
    zipUrl: null,
    reportCount: null,
    reset: vi.fn(),
  })),
}));

import { useBatchReports } from '@/hooks/satellite/useBatchReports';

describe('BatchReportGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with parcelle count', () => {
    render(<BatchReportGenerator parcelleIds={['p1', 'p2', 'p3']} />);

    expect(screen.getByText('Génération de Rapports en Lot')).toBeInTheDocument();
    expect(screen.getByText('3 parcelle(s) sélectionnée(s)')).toBeInTheDocument();
  });

  it('should render report options checkboxes', () => {
    render(<BatchReportGenerator parcelleIds={['p1']} />);

    expect(
      screen.getByLabelText('Inclure la comparaison avant/après')
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Inclure l'évolution NDVI")).toBeInTheDocument();
    expect(
      screen.getByLabelText('Inclure la prévision de rendement')
    ).toBeInTheDocument();
  });

  it('should render language selector', () => {
    render(<BatchReportGenerator parcelleIds={['p1']} />);

    const languageSelect = screen.getByLabelText('Langue du rapport');
    expect(languageSelect).toBeInTheDocument();
    expect(languageSelect).toHaveValue('fr');
  });

  it('should call generateBatchReports when generate button clicked', async () => {
    const mockGenerate = vi.fn();
    (useBatchReports as any).mockReturnValue({
      generateBatchReports: mockGenerate,
      loading: false,
      error: null,
      progress: null,
      zipUrl: null,
      reportCount: null,
      reset: vi.fn(),
    });

    render(<BatchReportGenerator parcelleIds={['p1', 'p2']} />);

    const generateButton = screen.getByText('Générer les Rapports');
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(mockGenerate).toHaveBeenCalledWith(['p1', 'p2'], expect.any(Object));
    });
  });

  it('should disable generate button when no parcelles selected', () => {
    render(<BatchReportGenerator parcelleIds={[]} />);

    const generateButton = screen.getByText('Générer les Rapports');
    expect(generateButton).toBeDisabled();
  });

  it('should show progress indicator when loading', () => {
    (useBatchReports as any).mockReturnValue({
      generateBatchReports: vi.fn(),
      loading: true,
      error: null,
      progress: { current: 2, total: 5, percentage: 40 },
      zipUrl: null,
      reportCount: null,
      reset: vi.fn(),
    });

    render(<BatchReportGenerator parcelleIds={['p1', 'p2', 'p3', 'p4', 'p5']} />);

    expect(screen.getByText('Génération en cours...')).toBeInTheDocument();
    expect(screen.getByText('2 / 5')).toBeInTheDocument();
    expect(screen.getByText('Génération des rapports PDF...')).toBeInTheDocument();
  });

  it('should show success message when reports generated', () => {
    (useBatchReports as any).mockReturnValue({
      generateBatchReports: vi.fn(),
      loading: false,
      error: null,
      progress: { current: 3, total: 3, percentage: 100 },
      zipUrl: '/storage/reports/batch-123.zip',
      reportCount: 3,
      reset: vi.fn(),
    });

    render(<BatchReportGenerator parcelleIds={['p1', 'p2', 'p3']} />);

    expect(screen.getByText('Rapports générés avec succès')).toBeInTheDocument();
    expect(
      screen.getByText(/3 rapport\(s\) de certification ont été générés/)
    ).toBeInTheDocument();
  });

  it('should show error message when generation fails', () => {
    const errorMessage = 'Failed to generate reports';
    (useBatchReports as any).mockReturnValue({
      generateBatchReports: vi.fn(),
      loading: false,
      error: new Error(errorMessage),
      progress: null,
      zipUrl: null,
      reportCount: null,
      reset: vi.fn(),
    });

    render(<BatchReportGenerator parcelleIds={['p1']} />);

    expect(screen.getByText('Erreur lors de la génération')).toBeInTheDocument();
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it('should show download button when reports ready', () => {
    (useBatchReports as any).mockReturnValue({
      generateBatchReports: vi.fn(),
      loading: false,
      error: null,
      progress: { current: 2, total: 2, percentage: 100 },
      zipUrl: '/storage/reports/batch-123.zip',
      reportCount: 2,
      reset: vi.fn(),
    });

    render(<BatchReportGenerator parcelleIds={['p1', 'p2']} />);

    expect(screen.getByText('Télécharger le ZIP')).toBeInTheDocument();
  });

  it('should trigger download when download button clicked', () => {
    (useBatchReports as any).mockReturnValue({
      generateBatchReports: vi.fn(),
      loading: false,
      error: null,
      progress: { current: 1, total: 1, percentage: 100 },
      zipUrl: '/storage/reports/batch-123.zip',
      reportCount: 1,
      reset: vi.fn(),
    });

    // Mock document.createElement and appendChild
    const mockLink = {
      href: '',
      download: '',
      click: vi.fn(),
    };
    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockReturnValue(mockLink as any);
    const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation();
    const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation();

    render(<BatchReportGenerator parcelleIds={['p1']} />);

    const downloadButton = screen.getByText('Télécharger le ZIP');
    fireEvent.click(downloadButton);

    expect(createElementSpy).toHaveBeenCalledWith('a');
    expect(mockLink.href).toBe('/storage/reports/batch-123.zip');
    expect(mockLink.click).toHaveBeenCalled();
    expect(appendChildSpy).toHaveBeenCalled();
    expect(removeChildSpy).toHaveBeenCalled();

    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });

  it('should call reset when close button clicked', () => {
    const mockReset = vi.fn();
    const mockOnClose = vi.fn();

    (useBatchReports as any).mockReturnValue({
      generateBatchReports: vi.fn(),
      loading: false,
      error: null,
      progress: { current: 1, total: 1, percentage: 100 },
      zipUrl: '/storage/reports/batch-123.zip',
      reportCount: 1,
      reset: mockReset,
    });

    render(<BatchReportGenerator parcelleIds={['p1']} onClose={mockOnClose} />);

    const closeButton = screen.getByText('Fermer');
    fireEvent.click(closeButton);

    expect(mockReset).toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should update options when checkboxes toggled', () => {
    render(<BatchReportGenerator parcelleIds={['p1']} />);

    const beforeAfterCheckbox = screen.getByLabelText(
      'Inclure la comparaison avant/après'
    ) as HTMLInputElement;
    expect(beforeAfterCheckbox.checked).toBe(true);

    fireEvent.click(beforeAfterCheckbox);
    expect(beforeAfterCheckbox.checked).toBe(false);
  });

  it('should update language when selector changed', () => {
    render(<BatchReportGenerator parcelleIds={['p1']} />);

    const languageSelect = screen.getByLabelText(
      'Langue du rapport'
    ) as HTMLSelectElement;
    expect(languageSelect.value).toBe('fr');

    fireEvent.change(languageSelect, { target: { value: 'en' } });
    expect(languageSelect.value).toBe('en');
  });

  it('should show cancel button when onClose provided', () => {
    const mockOnClose = vi.fn();
    render(<BatchReportGenerator parcelleIds={['p1']} onClose={mockOnClose} />);

    const cancelButton = screen.getByText('Annuler');
    expect(cancelButton).toBeInTheDocument();

    fireEvent.click(cancelButton);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should not show cancel button when onClose not provided', () => {
    render(<BatchReportGenerator parcelleIds={['p1']} />);

    expect(screen.queryByText('Annuler')).not.toBeInTheDocument();
  });

  it('should show info note about processing time', () => {
    render(<BatchReportGenerator parcelleIds={['p1', 'p2', 'p3']} />);

    expect(
      screen.getByText(/La génération de rapports pour 3 parcelle\(s\)/)
    ).toBeInTheDocument();
  });
});
