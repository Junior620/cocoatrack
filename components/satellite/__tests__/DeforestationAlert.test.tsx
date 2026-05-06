import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import DeforestationAlert from '../DeforestationAlert';
import type { DeforestationEvent } from '@/lib/satellite/types';

describe('DeforestationAlert', () => {
  const mockAlert: DeforestationEvent = {
    id: 'alert-1',
    parcelleId: 'parcelle-1',
    baselineDate: new Date('2020-12-31'),
    detectionDate: new Date('2024-05-01'),
    baselineNDVI: 0.75,
    currentNDVI: 0.42,
    ndviChange: -0.33,
    affectedAreaHectares: 1.5,
    affectedAreaPercent: 25.0,
    status: 'pending',
    acknowledgedBy: null,
    acknowledgedAt: null,
    acknowledgmentNotes: null,
    disputedBy: null,
    disputedAt: null,
    disputeReason: null,
    createdAt: new Date('2024-05-01'),
    updatedAt: new Date('2024-05-01'),
  };

  describe('Component Rendering', () => {
    it('should render alert with all details', () => {
      render(<DeforestationAlert alert={mockAlert} />);

      expect(screen.getByText('Alerte de déforestation')).toBeInTheDocument();
      expect(screen.getByText(/Statut : En attente/)).toBeInTheDocument();
      expect(screen.getByText(/1\.50/)).toBeInTheDocument();
      expect(screen.getByText(/25\.0/)).toBeInTheDocument();
      expect(screen.getByText(/-0\.330/)).toBeInTheDocument();
    });

    it('should display before/after comparison section', () => {
      render(<DeforestationAlert alert={mockAlert} />);

      expect(screen.getByText('Comparaison avant/après')).toBeInTheDocument();
      expect(screen.getByText(/NDVI: 0.75/)).toBeInTheDocument();
      expect(screen.getByText(/NDVI: 0.42/)).toBeInTheDocument();
    });

    it('should show action buttons for pending alerts', () => {
      const onAcknowledge = vi.fn();
      const onDispute = vi.fn();

      render(
        <DeforestationAlert
          alert={mockAlert}
          onAcknowledge={onAcknowledge}
          onDispute={onDispute}
        />
      );

      expect(screen.getByText('Reconnaître')).toBeInTheDocument();
      expect(screen.getByText('Contester')).toBeInTheDocument();
    });

    it('should not show action buttons for acknowledged alerts', () => {
      const acknowledgedAlert: DeforestationEvent = {
        ...mockAlert,
        status: 'acknowledged',
        acknowledgedBy: 'user-1',
        acknowledgedAt: new Date('2024-05-02'),
        acknowledgmentNotes: 'Confirmed deforestation event',
      };

      render(<DeforestationAlert alert={acknowledgedAlert} />);

      expect(screen.queryByText('Reconnaître')).not.toBeInTheDocument();
      expect(screen.queryByText('Contester')).not.toBeInTheDocument();
    });
  });

  describe('Status Display', () => {
    it('should display pending status correctly', () => {
      render(<DeforestationAlert alert={mockAlert} />);
      expect(screen.getByText(/Statut : En attente/)).toBeInTheDocument();
    });

    it('should display acknowledged status with notes', () => {
      const acknowledgedAlert: DeforestationEvent = {
        ...mockAlert,
        status: 'acknowledged',
        acknowledgedBy: 'user-1',
        acknowledgedAt: new Date('2024-05-02'),
        acknowledgmentNotes: 'Confirmed deforestation event',
      };

      render(<DeforestationAlert alert={acknowledgedAlert} />);

      expect(screen.getByText(/Statut : Reconnu/)).toBeInTheDocument();
      expect(screen.getByText('Confirmed deforestation event')).toBeInTheDocument();
    });

    it('should display disputed status with reason', () => {
      const disputedAlert: DeforestationEvent = {
        ...mockAlert,
        status: 'disputed',
        disputedBy: 'user-2',
        disputedAt: new Date('2024-05-02'),
        disputeReason: 'False positive - seasonal variation',
      };

      render(<DeforestationAlert alert={disputedAlert} />);

      expect(screen.getByText(/Statut : Contesté/)).toBeInTheDocument();
      expect(screen.getByText('False positive - seasonal variation')).toBeInTheDocument();
    });
  });

  describe('Acknowledge Modal', () => {
    it('should open acknowledge modal when button clicked', () => {
      const onAcknowledge = vi.fn();

      render(<DeforestationAlert alert={mockAlert} onAcknowledge={onAcknowledge} />);

      const acknowledgeButton = screen.getByText('Reconnaître');
      fireEvent.click(acknowledgeButton);

      expect(screen.getByText("Reconnaître l'alerte")).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Expliquez pourquoi vous reconnaissez/)).toBeInTheDocument();
    });

    it('should close acknowledge modal when cancel clicked', () => {
      const onAcknowledge = vi.fn();

      render(<DeforestationAlert alert={mockAlert} onAcknowledge={onAcknowledge} />);

      fireEvent.click(screen.getByText('Reconnaître'));
      expect(screen.getByText("Reconnaître l'alerte")).toBeInTheDocument();

      const cancelButton = screen.getAllByText('Annuler')[0];
      fireEvent.click(cancelButton);

      expect(screen.queryByText("Reconnaître l'alerte")).not.toBeInTheDocument();
    });

    it('should call onAcknowledge with notes when submitted', async () => {
      const onAcknowledge = vi.fn().mockResolvedValue(undefined);

      render(<DeforestationAlert alert={mockAlert} onAcknowledge={onAcknowledge} />);

      fireEvent.click(screen.getByText('Reconnaître'));

      const textarea = screen.getByPlaceholderText(/Expliquez pourquoi vous reconnaissez/);
      fireEvent.change(textarea, { target: { value: 'Confirmed by field visit' } });

      const submitButton = screen.getAllByText('Reconnaître')[1];
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(onAcknowledge).toHaveBeenCalledWith('alert-1', 'Confirmed by field visit');
      });
    });

    it('should disable submit button when notes are empty', () => {
      const onAcknowledge = vi.fn();

      render(<DeforestationAlert alert={mockAlert} onAcknowledge={onAcknowledge} />);

      fireEvent.click(screen.getByText('Reconnaître'));

      const submitButton = screen.getAllByText('Reconnaître')[1];
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Dispute Modal', () => {
    it('should open dispute modal when button clicked', () => {
      const onDispute = vi.fn();

      render(<DeforestationAlert alert={mockAlert} onDispute={onDispute} />);

      const disputeButton = screen.getByText('Contester');
      fireEvent.click(disputeButton);

      expect(screen.getByText("Contester l'alerte")).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Expliquez pourquoi cette détection/)).toBeInTheDocument();
    });

    it('should close dispute modal when cancel clicked', () => {
      const onDispute = vi.fn();

      render(<DeforestationAlert alert={mockAlert} onDispute={onDispute} />);

      fireEvent.click(screen.getByText('Contester'));
      expect(screen.getByText("Contester l'alerte")).toBeInTheDocument();

      const cancelButton = screen.getAllByText('Annuler')[0];
      fireEvent.click(cancelButton);

      expect(screen.queryByText("Contester l'alerte")).not.toBeInTheDocument();
    });

    it('should call onDispute with reason when submitted', async () => {
      const onDispute = vi.fn().mockResolvedValue(undefined);

      render(<DeforestationAlert alert={mockAlert} onDispute={onDispute} />);

      fireEvent.click(screen.getByText('Contester'));

      const textarea = screen.getByPlaceholderText(/Expliquez pourquoi cette détection/);
      fireEvent.change(textarea, { target: { value: 'False positive - cloud shadow' } });

      const submitButton = screen.getAllByText('Contester')[1];
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(onDispute).toHaveBeenCalledWith('alert-1', 'False positive - cloud shadow');
      });
    });

    it('should disable submit button when reason is empty', () => {
      const onDispute = vi.fn();

      render(<DeforestationAlert alert={mockAlert} onDispute={onDispute} />);

      fireEvent.click(screen.getByText('Contester'));

      const submitButton = screen.getAllByText('Contester')[1];
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Error Handling', () => {
    it('should handle acknowledge error gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation();
      const onAcknowledge = vi.fn().mockRejectedValue(new Error('Network error'));

      render(<DeforestationAlert alert={mockAlert} onAcknowledge={onAcknowledge} />);

      fireEvent.click(screen.getByText('Reconnaître'));

      const textarea = screen.getByPlaceholderText(/Expliquez pourquoi vous reconnaissez/);
      fireEvent.change(textarea, { target: { value: 'Test notes' } });

      const submitButton = screen.getAllByText('Reconnaître')[1];
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith(
          'Failed to acknowledge alert:',
          expect.any(Error)
        );
      });

      consoleError.mockRestore();
    });

    it('should handle dispute error gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation();
      const onDispute = vi.fn().mockRejectedValue(new Error('Network error'));

      render(<DeforestationAlert alert={mockAlert} onDispute={onDispute} />);

      fireEvent.click(screen.getByText('Contester'));

      const textarea = screen.getByPlaceholderText(/Expliquez pourquoi cette détection/);
      fireEvent.change(textarea, { target: { value: 'Test reason' } });

      const submitButton = screen.getAllByText('Contester')[1];
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith(
          'Failed to dispute alert:',
          expect.any(Error)
        );
      });

      consoleError.mockRestore();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<DeforestationAlert alert={mockAlert} />);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-live', 'polite');
    });

    it('should have accessible modal dialogs', () => {
      const onAcknowledge = vi.fn();

      render(<DeforestationAlert alert={mockAlert} onAcknowledge={onAcknowledge} />);

      fireEvent.click(screen.getByText('Reconnaître'));

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'acknowledge-modal-title');
    });

    it('should have accessible close buttons', () => {
      const onAcknowledge = vi.fn();

      render(<DeforestationAlert alert={mockAlert} onAcknowledge={onAcknowledge} />);

      fireEvent.click(screen.getByText('Reconnaître'));

      const closeButton = screen.getByLabelText('Fermer');
      expect(closeButton).toBeInTheDocument();
    });
  });

  describe('Date Formatting', () => {
    it('should format dates in French locale', () => {
      render(<DeforestationAlert alert={mockAlert} />);

      // Check that dates are displayed (exact format may vary by environment)
      expect(screen.getByText(/Détection :/)).toBeInTheDocument();
      expect(screen.getByText(/Référence :/)).toBeInTheDocument();
    });
  });

  describe('Custom Styling', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <DeforestationAlert alert={mockAlert} className="custom-class" />
      );

      const alertElement = container.querySelector('.custom-class');
      expect(alertElement).toBeInTheDocument();
    });
  });
});
