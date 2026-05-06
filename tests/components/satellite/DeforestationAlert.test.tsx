import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import DeforestationAlert from '@/components/satellite/DeforestationAlert';
import type { DeforestationEvent } from '@/lib/satellite/types';

// Mock deforestation event data
const mockPendingAlert: DeforestationEvent = {
  id: 'alert-1',
  parcelleId: 'parcelle-1',
  baselineDate: new Date('2020-12-31'),
  detectionDate: new Date('2024-05-15'),
  baselineNDVI: 0.75,
  currentNDVI: 0.45,
  ndviChange: -0.30,
  affectedAreaHectares: 2.5,
  affectedAreaPercent: 25.0,
  status: 'pending',
  acknowledgedBy: null,
  acknowledgedAt: null,
  acknowledgmentNotes: null,
  disputedBy: null,
  disputedAt: null,
  disputeReason: null,
  createdAt: new Date('2024-05-15'),
  updatedAt: new Date('2024-05-15'),
};

const mockAcknowledgedAlert: DeforestationEvent = {
  ...mockPendingAlert,
  id: 'alert-2',
  status: 'acknowledged',
  acknowledgedBy: 'Jean Dupont',
  acknowledgedAt: new Date('2024-05-16'),
  acknowledgmentNotes: 'Déforestation confirmée pour extension agricole autorisée',
};

const mockDisputedAlert: DeforestationEvent = {
  ...mockPendingAlert,
  id: 'alert-3',
  status: 'disputed',
  disputedBy: 'Marie Martin',
  disputedAt: new Date('2024-05-16'),
  disputeReason: 'Fausse détection - ombre de nuages',
};

const mockResolvedAlert: DeforestationEvent = {
  ...mockPendingAlert,
  id: 'alert-4',
  status: 'resolved',
};

describe('DeforestationAlert', () => {
  describe('Alert Display', () => {
    it('renders alert with all details', () => {
      render(<DeforestationAlert alert={mockPendingAlert} />);

      // Check header
      expect(screen.getByText('Alerte de déforestation')).toBeInTheDocument();
      expect(screen.getByText('Statut : En attente')).toBeInTheDocument();

      // Check alert details
      expect(screen.getByText(/Détection :/)).toBeInTheDocument();
      expect(screen.getAllByText(/15 mai 2024/).length).toBeGreaterThan(0);
      expect(screen.getByText(/Référence :/)).toBeInTheDocument();
      expect(screen.getAllByText(/31 décembre 2020/).length).toBeGreaterThan(0);
      expect(screen.getByText(/Surface affectée :/)).toBeInTheDocument();
      expect(screen.getByText(/2.50 ha/)).toBeInTheDocument();
      expect(screen.getByText(/25.0%/)).toBeInTheDocument();
      expect(screen.getByText(/Changement NDVI :/)).toBeInTheDocument();
      expect(screen.getByText(/-0.300/)).toBeInTheDocument();
    });

    it('displays before/after comparison', () => {
      render(<DeforestationAlert alert={mockPendingAlert} />);

      expect(screen.getByText('Comparaison avant/après')).toBeInTheDocument();
      expect(screen.getByText(/Avant \(31 décembre 2020\)/)).toBeInTheDocument();
      expect(screen.getByText(/Après \(15 mai 2024\)/)).toBeInTheDocument();
      expect(screen.getByText('NDVI: 0.750')).toBeInTheDocument();
      expect(screen.getByText('NDVI: 0.450')).toBeInTheDocument();
    });

    it('has proper accessibility attributes', () => {
      render(<DeforestationAlert alert={mockPendingAlert} />);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-live', 'polite');
    });

    it('applies custom className', () => {
      render(<DeforestationAlert alert={mockPendingAlert} className="custom-class" />);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('custom-class');
    });
  });

  describe('Status Colors and Icons', () => {
    it('applies pending status styling', () => {
      render(<DeforestationAlert alert={mockPendingAlert} />);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('border-amber-300', 'bg-amber-50');
      expect(screen.getByText('Statut : En attente')).toBeInTheDocument();
    });

    it('applies acknowledged status styling', () => {
      render(<DeforestationAlert alert={mockAcknowledgedAlert} />);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('border-green-300', 'bg-green-50');
      expect(screen.getByText('Statut : Reconnu')).toBeInTheDocument();
    });

    it('applies disputed status styling', () => {
      render(<DeforestationAlert alert={mockDisputedAlert} />);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('border-red-300', 'bg-red-50');
      expect(screen.getByText('Statut : Contesté')).toBeInTheDocument();
    });

    it('applies resolved status styling', () => {
      render(<DeforestationAlert alert={mockResolvedAlert} />);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('border-gray-300', 'bg-gray-50');
      expect(screen.getByText('Statut : Résolu')).toBeInTheDocument();
    });
  });

  describe('Acknowledgment Information', () => {
    it('displays acknowledgment details when acknowledged', () => {
      render(<DeforestationAlert alert={mockAcknowledgedAlert} />);

      expect(screen.getByText(/Reconnu par Jean Dupont/)).toBeInTheDocument();
      expect(screen.getByText('Déforestation confirmée pour extension agricole autorisée')).toBeInTheDocument();
      expect(screen.getByText(/Le 16 mai 2024/)).toBeInTheDocument();
    });

    it('does not display acknowledgment section for pending alerts', () => {
      render(<DeforestationAlert alert={mockPendingAlert} />);

      expect(screen.queryByText(/Reconnu par/)).not.toBeInTheDocument();
    });
  });

  describe('Dispute Information', () => {
    it('displays dispute details when disputed', () => {
      render(<DeforestationAlert alert={mockDisputedAlert} />);

      expect(screen.getByText(/Contesté par Marie Martin/)).toBeInTheDocument();
      expect(screen.getByText('Fausse détection - ombre de nuages')).toBeInTheDocument();
      expect(screen.getByText(/Le 16 mai 2024/)).toBeInTheDocument();
    });

    it('does not display dispute section for pending alerts', () => {
      render(<DeforestationAlert alert={mockPendingAlert} />);

      expect(screen.queryByText(/Contesté par/)).not.toBeInTheDocument();
    });
  });

  describe('Acknowledge Action', () => {
    it('shows acknowledge button for pending alerts', () => {
      const onAcknowledge = vi.fn();
      render(<DeforestationAlert alert={mockPendingAlert} onAcknowledge={onAcknowledge} />);

      expect(screen.getByRole('button', { name: 'Reconnaître' })).toBeInTheDocument();
    });

    it('does not show acknowledge button when callback not provided', () => {
      render(<DeforestationAlert alert={mockPendingAlert} />);

      expect(screen.queryByRole('button', { name: 'Reconnaître' })).not.toBeInTheDocument();
    });

    it('does not show acknowledge button for acknowledged alerts', () => {
      const onAcknowledge = vi.fn();
      render(<DeforestationAlert alert={mockAcknowledgedAlert} onAcknowledge={onAcknowledge} />);

      expect(screen.queryByRole('button', { name: 'Reconnaître' })).not.toBeInTheDocument();
    });

    it('opens acknowledge modal when button clicked', () => {
      const onAcknowledge = vi.fn();
      render(<DeforestationAlert alert={mockPendingAlert} onAcknowledge={onAcknowledge} />);

      const acknowledgeButton = screen.getByRole('button', { name: 'Reconnaître' });
      fireEvent.click(acknowledgeButton);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText("Reconnaître l'alerte")).toBeInTheDocument();
      expect(screen.getByLabelText('Notes de reconnaissance')).toBeInTheDocument();
    });

    it('closes acknowledge modal when cancel clicked', () => {
      const onAcknowledge = vi.fn();
      render(<DeforestationAlert alert={mockPendingAlert} onAcknowledge={onAcknowledge} />);

      // Open modal
      fireEvent.click(screen.getByRole('button', { name: 'Reconnaître' }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Close modal
      fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('closes acknowledge modal when backdrop clicked', () => {
      const onAcknowledge = vi.fn();
      render(<DeforestationAlert alert={mockPendingAlert} onAcknowledge={onAcknowledge} />);

      // Open modal
      fireEvent.click(screen.getByRole('button', { name: 'Reconnaître' }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Click backdrop
      const backdrop = document.querySelector('.fixed.inset-0.bg-black\\/50');
      expect(backdrop).toBeInTheDocument();
      fireEvent.click(backdrop!);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('closes acknowledge modal when close button clicked', () => {
      const onAcknowledge = vi.fn();
      render(<DeforestationAlert alert={mockPendingAlert} onAcknowledge={onAcknowledge} />);

      // Open modal
      fireEvent.click(screen.getByRole('button', { name: 'Reconnaître' }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Close modal via X button
      fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('disables submit button when notes are empty', () => {
      const onAcknowledge = vi.fn();
      render(<DeforestationAlert alert={mockPendingAlert} onAcknowledge={onAcknowledge} />);

      fireEvent.click(screen.getByRole('button', { name: 'Reconnaître' }));

      const submitButton = screen.getAllByRole('button', { name: 'Reconnaître' })[1];
      expect(submitButton).toBeDisabled();
    });

    it('enables submit button when notes are provided', () => {
      const onAcknowledge = vi.fn();
      render(<DeforestationAlert alert={mockPendingAlert} onAcknowledge={onAcknowledge} />);

      fireEvent.click(screen.getByRole('button', { name: 'Reconnaître' }));

      const textarea = screen.getByLabelText('Notes de reconnaissance');
      fireEvent.change(textarea, { target: { value: 'Test notes' } });

      const submitButton = screen.getAllByRole('button', { name: 'Reconnaître' })[1];
      expect(submitButton).not.toBeDisabled();
    });

    it('calls onAcknowledge with alert ID and notes', async () => {
      const onAcknowledge = vi.fn().mockResolvedValue(undefined);
      render(<DeforestationAlert alert={mockPendingAlert} onAcknowledge={onAcknowledge} />);

      // Open modal
      fireEvent.click(screen.getByRole('button', { name: 'Reconnaître' }));

      // Enter notes
      const textarea = screen.getByLabelText('Notes de reconnaissance');
      fireEvent.change(textarea, { target: { value: 'Test acknowledgment notes' } });

      // Submit
      const submitButton = screen.getAllByRole('button', { name: 'Reconnaître' })[1];
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(onAcknowledge).toHaveBeenCalledWith('alert-1', 'Test acknowledgment notes');
      });
    });

    it('closes modal after successful acknowledgment', async () => {
      const onAcknowledge = vi.fn().mockResolvedValue(undefined);
      render(<DeforestationAlert alert={mockPendingAlert} onAcknowledge={onAcknowledge} />);

      // Open modal
      fireEvent.click(screen.getByRole('button', { name: 'Reconnaître' }));

      // Enter notes and submit
      const textarea = screen.getByLabelText('Notes de reconnaissance');
      fireEvent.change(textarea, { target: { value: 'Test notes' } });
      const submitButton = screen.getAllByRole('button', { name: 'Reconnaître' })[1];
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('shows loading state during submission', async () => {
      const onAcknowledge = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );
      render(<DeforestationAlert alert={mockPendingAlert} onAcknowledge={onAcknowledge} />);

      // Open modal
      fireEvent.click(screen.getByRole('button', { name: 'Reconnaître' }));

      // Enter notes and submit
      const textarea = screen.getByLabelText('Notes de reconnaissance');
      fireEvent.change(textarea, { target: { value: 'Test notes' } });
      const submitButton = screen.getAllByRole('button', { name: 'Reconnaître' })[1];
      fireEvent.click(submitButton);

      // Check loading state
      expect(screen.getByRole('button', { name: 'Envoi...' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Annuler' })).toBeDisabled();

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('handles acknowledgment errors gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const onAcknowledge = vi.fn().mockRejectedValue(new Error('Network error'));
      render(<DeforestationAlert alert={mockPendingAlert} onAcknowledge={onAcknowledge} />);

      // Open modal
      fireEvent.click(screen.getByRole('button', { name: 'Reconnaître' }));

      // Enter notes and submit
      const textarea = screen.getByLabelText('Notes de reconnaissance');
      fireEvent.change(textarea, { target: { value: 'Test notes' } });
      const submitButton = screen.getAllByRole('button', { name: 'Reconnaître' })[1];
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith(
          'Failed to acknowledge alert:',
          expect.any(Error)
        );
      });

      // Modal should remain open on error
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      consoleError.mockRestore();
    });
  });

  describe('Dispute Action', () => {
    it('shows dispute button for pending alerts', () => {
      const onDispute = vi.fn();
      render(<DeforestationAlert alert={mockPendingAlert} onDispute={onDispute} />);

      expect(screen.getByRole('button', { name: 'Contester' })).toBeInTheDocument();
    });

    it('does not show dispute button when callback not provided', () => {
      render(<DeforestationAlert alert={mockPendingAlert} />);

      expect(screen.queryByRole('button', { name: 'Contester' })).not.toBeInTheDocument();
    });

    it('does not show dispute button for disputed alerts', () => {
      const onDispute = vi.fn();
      render(<DeforestationAlert alert={mockDisputedAlert} onDispute={onDispute} />);

      expect(screen.queryByRole('button', { name: 'Contester' })).not.toBeInTheDocument();
    });

    it('opens dispute modal when button clicked', () => {
      const onDispute = vi.fn();
      render(<DeforestationAlert alert={mockPendingAlert} onDispute={onDispute} />);

      const disputeButton = screen.getByRole('button', { name: 'Contester' });
      fireEvent.click(disputeButton);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText("Contester l'alerte")).toBeInTheDocument();
      expect(screen.getByLabelText('Raison de la contestation')).toBeInTheDocument();
    });

    it('closes dispute modal when cancel clicked', () => {
      const onDispute = vi.fn();
      render(<DeforestationAlert alert={mockPendingAlert} onDispute={onDispute} />);

      // Open modal
      fireEvent.click(screen.getByRole('button', { name: 'Contester' }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Close modal
      fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('closes dispute modal when backdrop clicked', () => {
      const onDispute = vi.fn();
      render(<DeforestationAlert alert={mockPendingAlert} onDispute={onDispute} />);

      // Open modal
      fireEvent.click(screen.getByRole('button', { name: 'Contester' }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Click backdrop
      const backdrop = document.querySelector('.fixed.inset-0.bg-black\\/50');
      expect(backdrop).toBeInTheDocument();
      fireEvent.click(backdrop!);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('closes dispute modal when close button clicked', () => {
      const onDispute = vi.fn();
      render(<DeforestationAlert alert={mockPendingAlert} onDispute={onDispute} />);

      // Open modal
      fireEvent.click(screen.getByRole('button', { name: 'Contester' }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Close modal via X button
      fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('disables submit button when reason is empty', () => {
      const onDispute = vi.fn();
      render(<DeforestationAlert alert={mockPendingAlert} onDispute={onDispute} />);

      fireEvent.click(screen.getByRole('button', { name: 'Contester' }));

      const submitButton = screen.getAllByRole('button', { name: 'Contester' })[1];
      expect(submitButton).toBeDisabled();
    });

    it('enables submit button when reason is provided', () => {
      const onDispute = vi.fn();
      render(<DeforestationAlert alert={mockPendingAlert} onDispute={onDispute} />);

      fireEvent.click(screen.getByRole('button', { name: 'Contester' }));

      const textarea = screen.getByLabelText('Raison de la contestation');
      fireEvent.change(textarea, { target: { value: 'Test reason' } });

      const submitButton = screen.getAllByRole('button', { name: 'Contester' })[1];
      expect(submitButton).not.toBeDisabled();
    });

    it('calls onDispute with alert ID and reason', async () => {
      const onDispute = vi.fn().mockResolvedValue(undefined);
      render(<DeforestationAlert alert={mockPendingAlert} onDispute={onDispute} />);

      // Open modal
      fireEvent.click(screen.getByRole('button', { name: 'Contester' }));

      // Enter reason
      const textarea = screen.getByLabelText('Raison de la contestation');
      fireEvent.change(textarea, { target: { value: 'Test dispute reason' } });

      // Submit
      const submitButton = screen.getAllByRole('button', { name: 'Contester' })[1];
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(onDispute).toHaveBeenCalledWith('alert-1', 'Test dispute reason');
      });
    });

    it('closes modal after successful dispute', async () => {
      const onDispute = vi.fn().mockResolvedValue(undefined);
      render(<DeforestationAlert alert={mockPendingAlert} onDispute={onDispute} />);

      // Open modal
      fireEvent.click(screen.getByRole('button', { name: 'Contester' }));

      // Enter reason and submit
      const textarea = screen.getByLabelText('Raison de la contestation');
      fireEvent.change(textarea, { target: { value: 'Test reason' } });
      const submitButton = screen.getAllByRole('button', { name: 'Contester' })[1];
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('shows loading state during submission', async () => {
      const onDispute = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );
      render(<DeforestationAlert alert={mockPendingAlert} onDispute={onDispute} />);

      // Open modal
      fireEvent.click(screen.getByRole('button', { name: 'Contester' }));

      // Enter reason and submit
      const textarea = screen.getByLabelText('Raison de la contestation');
      fireEvent.change(textarea, { target: { value: 'Test reason' } });
      const submitButton = screen.getAllByRole('button', { name: 'Contester' })[1];
      fireEvent.click(submitButton);

      // Check loading state
      expect(screen.getByRole('button', { name: 'Envoi...' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Annuler' })).toBeDisabled();

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('handles dispute errors gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const onDispute = vi.fn().mockRejectedValue(new Error('Network error'));
      render(<DeforestationAlert alert={mockPendingAlert} onDispute={onDispute} />);

      // Open modal
      fireEvent.click(screen.getByRole('button', { name: 'Contester' }));

      // Enter reason and submit
      const textarea = screen.getByLabelText('Raison de la contestation');
      fireEvent.change(textarea, { target: { value: 'Test reason' } });
      const submitButton = screen.getAllByRole('button', { name: 'Contester' })[1];
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith(
          'Failed to dispute alert:',
          expect.any(Error)
        );
      });

      // Modal should remain open on error
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      consoleError.mockRestore();
    });
  });

  describe('Modal Accessibility', () => {
    it('acknowledge modal has proper ARIA attributes', () => {
      const onAcknowledge = vi.fn();
      render(<DeforestationAlert alert={mockPendingAlert} onAcknowledge={onAcknowledge} />);

      fireEvent.click(screen.getByRole('button', { name: 'Reconnaître' }));

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'acknowledge-modal-title');
    });

    it('dispute modal has proper ARIA attributes', () => {
      const onDispute = vi.fn();
      render(<DeforestationAlert alert={mockPendingAlert} onDispute={onDispute} />);

      fireEvent.click(screen.getByRole('button', { name: 'Contester' }));

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'dispute-modal-title');
    });
  });

  describe('Edge Cases', () => {
    it('handles alerts with zero affected area', () => {
      const alertWithZeroArea: DeforestationEvent = {
        ...mockPendingAlert,
        affectedAreaHectares: 0,
        affectedAreaPercent: 0,
      };

      render(<DeforestationAlert alert={alertWithZeroArea} />);

      expect(screen.getByText(/0.00 ha/)).toBeInTheDocument();
      expect(screen.getByText(/0.0%/)).toBeInTheDocument();
    });

    it('handles alerts with very small NDVI changes', () => {
      const alertWithSmallChange: DeforestationEvent = {
        ...mockPendingAlert,
        baselineNDVI: 0.755,
        currentNDVI: 0.754,
        ndviChange: -0.001,
      };

      render(<DeforestationAlert alert={alertWithSmallChange} />);

      expect(screen.getByText(/-0.001/)).toBeInTheDocument();
    });

    it('handles alerts with large affected areas', () => {
      const alertWithLargeArea: DeforestationEvent = {
        ...mockPendingAlert,
        affectedAreaHectares: 125.75,
        affectedAreaPercent: 99.9,
      };

      render(<DeforestationAlert alert={alertWithLargeArea} />);

      expect(screen.getByText(/125.75 ha/)).toBeInTheDocument();
      expect(screen.getByText(/99.9%/)).toBeInTheDocument();
    });

    it('does not submit with whitespace-only notes', () => {
      const onAcknowledge = vi.fn();
      render(<DeforestationAlert alert={mockPendingAlert} onAcknowledge={onAcknowledge} />);

      fireEvent.click(screen.getByRole('button', { name: 'Reconnaître' }));

      const textarea = screen.getByLabelText('Notes de reconnaissance');
      fireEvent.change(textarea, { target: { value: '   ' } });

      const submitButton = screen.getAllByRole('button', { name: 'Reconnaître' })[1];
      expect(submitButton).toBeDisabled();
    });

    it('does not submit with whitespace-only reason', () => {
      const onDispute = vi.fn();
      render(<DeforestationAlert alert={mockPendingAlert} onDispute={onDispute} />);

      fireEvent.click(screen.getByRole('button', { name: 'Contester' }));

      const textarea = screen.getByLabelText('Raison de la contestation');
      fireEvent.change(textarea, { target: { value: '   ' } });

      const submitButton = screen.getAllByRole('button', { name: 'Contester' })[1];
      expect(submitButton).toBeDisabled();
    });
  });
});
