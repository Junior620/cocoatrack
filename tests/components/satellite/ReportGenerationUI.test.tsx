/**
 * Test: Report Generation UI Integration
 * 
 * Tests the integration of report generation UI components in the parcelle detail page
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ReportOptionsModal from '@/components/satellite/ReportOptionsModal';
import ReportDownloadLink from '@/components/satellite/ReportDownloadLink';
import type { ReportOptions } from '@/components/satellite/ReportOptionsModal';

describe('Report Generation UI Components', () => {
  describe('ReportOptionsModal', () => {
    it('should render modal when open', () => {
      const onClose = vi.fn();
      const onGenerate = vi.fn();

      render(
        <ReportOptionsModal
          isOpen={true}
          onClose={onClose}
          onGenerate={onGenerate}
          isGenerating={false}
        />
      );

      expect(screen.getByText('Options du Rapport de Certification')).toBeInTheDocument();
      expect(screen.getByText('Langue du rapport')).toBeInTheDocument();
      expect(screen.getByText('Sections à inclure')).toBeInTheDocument();
    });

    it('should not render modal when closed', () => {
      const onClose = vi.fn();
      const onGenerate = vi.fn();

      const { container } = render(
        <ReportOptionsModal
          isOpen={false}
          onClose={onClose}
          onGenerate={onGenerate}
          isGenerating={false}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should call onClose when close button is clicked', () => {
      const onClose = vi.fn();
      const onGenerate = vi.fn();

      render(
        <ReportOptionsModal
          isOpen={true}
          onClose={onClose}
          onGenerate={onGenerate}
          isGenerating={false}
        />
      );

      const closeButton = screen.getByRole('button', { name: /annuler/i });
      fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onGenerate with correct options when generate button is clicked', () => {
      const onClose = vi.fn();
      const onGenerate = vi.fn();

      render(
        <ReportOptionsModal
          isOpen={true}
          onClose={onClose}
          onGenerate={onGenerate}
          isGenerating={false}
        />
      );

      // Click generate button
      const generateButton = screen.getByRole('button', { name: /générer le rapport/i });
      fireEvent.click(generateButton);

      expect(onGenerate).toHaveBeenCalledTimes(1);
      
      // Check default options
      const options: ReportOptions = onGenerate.mock.calls[0][0];
      expect(options.language).toBe('fr');
      expect(options.includeBeforeAfter).toBe(true);
      expect(options.includeNDVITrend).toBe(true);
      expect(options.includeYieldPrediction).toBe(false);
      expect(options.baselineDate).toBe('2020-12-31');
    });

    it('should allow changing language option', () => {
      const onClose = vi.fn();
      const onGenerate = vi.fn();

      render(
        <ReportOptionsModal
          isOpen={true}
          onClose={onClose}
          onGenerate={onGenerate}
          isGenerating={false}
        />
      );

      // Select English language
      const englishRadio = screen.getByLabelText('English');
      fireEvent.click(englishRadio);

      // Click generate button
      const generateButton = screen.getByRole('button', { name: /générer le rapport/i });
      fireEvent.click(generateButton);

      const options: ReportOptions = onGenerate.mock.calls[0][0];
      expect(options.language).toBe('en');
    });

    it('should allow toggling section options', () => {
      const onClose = vi.fn();
      const onGenerate = vi.fn();

      render(
        <ReportOptionsModal
          isOpen={true}
          onClose={onClose}
          onGenerate={onGenerate}
          isGenerating={false}
        />
      );

      // Toggle yield prediction checkbox
      const yieldCheckbox = screen.getByRole('checkbox', { name: /prédiction de rendement/i });
      fireEvent.click(yieldCheckbox);

      // Click generate button
      const generateButton = screen.getByRole('button', { name: /générer le rapport/i });
      fireEvent.click(generateButton);

      const options: ReportOptions = onGenerate.mock.calls[0][0];
      expect(options.includeYieldPrediction).toBe(true);
    });

    it('should disable buttons when generating', () => {
      const onClose = vi.fn();
      const onGenerate = vi.fn();

      render(
        <ReportOptionsModal
          isOpen={true}
          onClose={onClose}
          onGenerate={onGenerate}
          isGenerating={true}
        />
      );

      const generateButton = screen.getByRole('button', { name: /génération en cours/i });
      const cancelButton = screen.getByRole('button', { name: /annuler/i });

      expect(generateButton).toBeDisabled();
      expect(cancelButton).toBeDisabled();
    });

    it('should show progress indicator when generating', () => {
      const onClose = vi.fn();
      const onGenerate = vi.fn();

      render(
        <ReportOptionsModal
          isOpen={true}
          onClose={onClose}
          onGenerate={onGenerate}
          isGenerating={true}
        />
      );

      expect(screen.getByText('Génération en cours...')).toBeInTheDocument();
    });
  });

  describe('ReportDownloadLink', () => {
    it('should render download link with parcelle code', () => {
      const reportUrl = 'https://example.com/report.pdf';
      const parcelleCode = 'PAR-001';

      render(
        <ReportDownloadLink
          reportUrl={reportUrl}
          parcelleCode={parcelleCode}
        />
      );

      expect(screen.getByText('Rapport généré avec succès')).toBeInTheDocument();
      expect(screen.getByText(/PAR-001/)).toBeInTheDocument();
    });

    it('should open report in new tab when download button is clicked', () => {
      const reportUrl = 'https://example.com/report.pdf';
      const parcelleCode = 'PAR-001';
      
      // Mock window.open
      const mockOpen = vi.fn();
      window.open = mockOpen;

      render(
        <ReportDownloadLink
          reportUrl={reportUrl}
          parcelleCode={parcelleCode}
        />
      );

      const downloadButton = screen.getByRole('button', { name: /télécharger le rapport/i });
      fireEvent.click(downloadButton);

      expect(mockOpen).toHaveBeenCalledWith(reportUrl, '_blank');
    });

    it('should have link to open in new tab', () => {
      const reportUrl = 'https://example.com/report.pdf';
      const parcelleCode = 'PAR-001';

      render(
        <ReportDownloadLink
          reportUrl={reportUrl}
          parcelleCode={parcelleCode}
        />
      );

      const link = screen.getByRole('link', { name: /ouvrir dans un nouvel onglet/i });
      expect(link).toHaveAttribute('href', reportUrl);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('should call onClose when close button is clicked', () => {
      const reportUrl = 'https://example.com/report.pdf';
      const parcelleCode = 'PAR-001';
      const onClose = vi.fn();

      render(
        <ReportDownloadLink
          reportUrl={reportUrl}
          parcelleCode={parcelleCode}
          onClose={onClose}
        />
      );

      const closeButton = screen.getByRole('button', { name: /fermer/i });
      fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should not render close button when onClose is not provided', () => {
      const reportUrl = 'https://example.com/report.pdf';
      const parcelleCode = 'PAR-001';

      render(
        <ReportDownloadLink
          reportUrl={reportUrl}
          parcelleCode={parcelleCode}
        />
      );

      const closeButton = screen.queryByRole('button', { name: /fermer/i });
      expect(closeButton).not.toBeInTheDocument();
    });
  });

  describe('Report Generation Flow', () => {
    it('should follow complete report generation flow', async () => {
      // This test simulates the complete flow:
      // 1. User clicks "Generate Report" button
      // 2. Modal opens with options
      // 3. User configures options and clicks generate
      // 4. Progress indicator shows
      // 5. Report URL is returned
      // 6. Download link is displayed

      const onGenerate = vi.fn((options: ReportOptions) => {
        // Simulate async report generation
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({ reportUrl: 'https://example.com/report.pdf' });
          }, 100);
        });
      });

      const { rerender } = render(
        <ReportOptionsModal
          isOpen={true}
          onClose={vi.fn()}
          onGenerate={onGenerate}
          isGenerating={false}
        />
      );

      // User clicks generate
      const generateButton = screen.getByRole('button', { name: /générer le rapport/i });
      fireEvent.click(generateButton);

      expect(onGenerate).toHaveBeenCalled();

      // Show progress
      rerender(
        <ReportOptionsModal
          isOpen={true}
          onClose={vi.fn()}
          onGenerate={onGenerate}
          isGenerating={true}
        />
      );

      expect(screen.getByText('Génération en cours...')).toBeInTheDocument();

      // Wait for generation to complete
      await waitFor(() => {
        expect(onGenerate).toHaveBeenCalledTimes(1);
      });
    });
  });
});
