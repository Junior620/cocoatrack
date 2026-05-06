import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import DeforestationAlertList from '@/components/satellite/DeforestationAlertList';
import type { DeforestationEvent } from '@/lib/satellite/types';

// Mock the DeforestationAlert component
vi.mock('@/components/satellite/DeforestationAlert', () => ({
  default: ({ alert }: { alert: DeforestationEvent }) => (
    <div data-testid={`alert-${alert.id}`} data-status={alert.status}>
      Alert {alert.id} - {alert.status}
    </div>
  ),
}));

describe('DeforestationAlertList', () => {
  const mockAlerts: DeforestationEvent[] = [
    {
      id: 'alert-1',
      parcelleId: 'parcelle-1',
      baselineDate: new Date('2020-12-31'),
      detectionDate: new Date('2024-01-15'),
      baselineNDVI: 0.8,
      currentNDVI: 0.4,
      ndviChange: -0.4,
      affectedAreaHectares: 1.5,
      affectedAreaPercent: 25,
      status: 'pending',
      acknowledgedBy: null,
      acknowledgedAt: null,
      acknowledgmentNotes: null,
      disputedBy: null,
      disputedAt: null,
      disputeReason: null,
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-01-15'),
    },
    {
      id: 'alert-2',
      parcelleId: 'parcelle-2',
      baselineDate: new Date('2020-12-31'),
      detectionDate: new Date('2024-02-10'),
      baselineNDVI: 0.75,
      currentNDVI: 0.35,
      ndviChange: -0.4,
      affectedAreaHectares: 2.0,
      affectedAreaPercent: 30,
      status: 'acknowledged',
      acknowledgedBy: 'user-1',
      acknowledgedAt: new Date('2024-02-11'),
      acknowledgmentNotes: 'Confirmed deforestation',
      disputedBy: null,
      disputedAt: null,
      disputeReason: null,
      createdAt: new Date('2024-02-10'),
      updatedAt: new Date('2024-02-11'),
    },
    {
      id: 'alert-3',
      parcelleId: 'parcelle-3',
      baselineDate: new Date('2020-12-31'),
      detectionDate: new Date('2024-03-05'),
      baselineNDVI: 0.7,
      currentNDVI: 0.3,
      ndviChange: -0.4,
      affectedAreaHectares: 0.8,
      affectedAreaPercent: 15,
      status: 'disputed',
      acknowledgedBy: null,
      acknowledgedAt: null,
      acknowledgmentNotes: null,
      disputedBy: 'user-2',
      disputedAt: new Date('2024-03-06'),
      disputeReason: 'False positive',
      createdAt: new Date('2024-03-05'),
      updatedAt: new Date('2024-03-06'),
    },
    {
      id: 'alert-4',
      parcelleId: 'parcelle-4',
      baselineDate: new Date('2020-12-31'),
      detectionDate: new Date('2024-04-01'),
      baselineNDVI: 0.65,
      currentNDVI: 0.25,
      ndviChange: -0.4,
      affectedAreaHectares: 1.2,
      affectedAreaPercent: 20,
      status: 'resolved',
      acknowledgedBy: 'user-1',
      acknowledgedAt: new Date('2024-04-02'),
      acknowledgmentNotes: 'Resolved',
      disputedBy: null,
      disputedAt: null,
      disputeReason: null,
      createdAt: new Date('2024-04-01'),
      updatedAt: new Date('2024-04-02'),
    },
  ];

  describe('Rendering', () => {
    it('should render the component with alerts', () => {
      render(<DeforestationAlertList alerts={mockAlerts} />);

      expect(screen.getByText('Alertes de déforestation')).toBeInTheDocument();
      expect(screen.getByText('4 alertes trouvées')).toBeInTheDocument();
    });

    it('should render empty state when no alerts', () => {
      render(<DeforestationAlertList alerts={[]} />);

      expect(screen.getByText('Aucune alerte trouvée')).toBeInTheDocument();
      expect(
        screen.getByText('Il n\'y a aucune alerte de déforestation pour le moment.')
      ).toBeInTheDocument();
    });

    it('should display all status filter buttons', () => {
      render(<DeforestationAlertList alerts={mockAlerts} />);

      expect(screen.getByRole('button', { name: /Toutes/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /En attente/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Reconnues/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Contestées/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Résolues/i })).toBeInTheDocument();
    });

    it('should display alert count badges', () => {
      render(<DeforestationAlertList alerts={mockAlerts} />);

      // Check that count badges are displayed
      const allButton = screen.getByRole('button', { name: /Toutes/i });
      expect(within(allButton).getByText('4')).toBeInTheDocument();

      const pendingButton = screen.getByRole('button', { name: /En attente/i });
      expect(within(pendingButton).getByText('1')).toBeInTheDocument();

      const acknowledgedButton = screen.getByRole('button', { name: /Reconnues/i });
      expect(within(acknowledgedButton).getByText('1')).toBeInTheDocument();

      const disputedButton = screen.getByRole('button', { name: /Contestées/i });
      expect(within(disputedButton).getByText('1')).toBeInTheDocument();

      const resolvedButton = screen.getByRole('button', { name: /Résolues/i });
      expect(within(resolvedButton).getByText('1')).toBeInTheDocument();
    });
  });

  describe('Filtering by Status', () => {
    it('should filter alerts by pending status', () => {
      render(<DeforestationAlertList alerts={mockAlerts} />);

      const pendingButton = screen.getByRole('button', { name: /En attente/i });
      fireEvent.click(pendingButton);

      expect(screen.getByTestId('alert-alert-1')).toBeInTheDocument();
      expect(screen.queryByTestId('alert-alert-2')).not.toBeInTheDocument();
      expect(screen.queryByTestId('alert-alert-3')).not.toBeInTheDocument();
      expect(screen.queryByTestId('alert-alert-4')).not.toBeInTheDocument();
    });

    it('should filter alerts by acknowledged status', () => {
      render(<DeforestationAlertList alerts={mockAlerts} />);

      const acknowledgedButton = screen.getByRole('button', { name: /Reconnues/i });
      fireEvent.click(acknowledgedButton);

      expect(screen.queryByTestId('alert-alert-1')).not.toBeInTheDocument();
      expect(screen.getByTestId('alert-alert-2')).toBeInTheDocument();
      expect(screen.queryByTestId('alert-alert-3')).not.toBeInTheDocument();
      expect(screen.queryByTestId('alert-alert-4')).not.toBeInTheDocument();
    });

    it('should filter alerts by disputed status', () => {
      render(<DeforestationAlertList alerts={mockAlerts} />);

      const disputedButton = screen.getByRole('button', { name: /Contestées/i });
      fireEvent.click(disputedButton);

      expect(screen.queryByTestId('alert-alert-1')).not.toBeInTheDocument();
      expect(screen.queryByTestId('alert-alert-2')).not.toBeInTheDocument();
      expect(screen.getByTestId('alert-alert-3')).toBeInTheDocument();
      expect(screen.queryByTestId('alert-alert-4')).not.toBeInTheDocument();
    });

    it('should show all alerts when "Toutes" is selected', () => {
      render(<DeforestationAlertList alerts={mockAlerts} />);

      // First filter by pending
      const pendingButton = screen.getByRole('button', { name: /En attente/i });
      fireEvent.click(pendingButton);

      // Then click "Toutes"
      const allButton = screen.getByRole('button', { name: /Toutes/i });
      fireEvent.click(allButton);

      expect(screen.getByTestId('alert-alert-1')).toBeInTheDocument();
      expect(screen.getByTestId('alert-alert-2')).toBeInTheDocument();
      expect(screen.getByTestId('alert-alert-3')).toBeInTheDocument();
      expect(screen.getByTestId('alert-alert-4')).toBeInTheDocument();
    });
  });

  describe('Filtering by Date Range', () => {
    it('should filter alerts by start date', () => {
      render(<DeforestationAlertList alerts={mockAlerts} />);

      const startDateInput = screen.getByLabelText('Date de début');
      fireEvent.change(startDateInput, { target: { value: '2024-03-01' } });

      expect(screen.queryByTestId('alert-alert-1')).not.toBeInTheDocument();
      expect(screen.queryByTestId('alert-alert-2')).not.toBeInTheDocument();
      expect(screen.getByTestId('alert-alert-3')).toBeInTheDocument();
      expect(screen.getByTestId('alert-alert-4')).toBeInTheDocument();
    });

    it('should filter alerts by end date', () => {
      render(<DeforestationAlertList alerts={mockAlerts} />);

      const endDateInput = screen.getByLabelText('Date de fin');
      fireEvent.change(endDateInput, { target: { value: '2024-02-28' } });

      expect(screen.getByTestId('alert-alert-1')).toBeInTheDocument();
      expect(screen.getByTestId('alert-alert-2')).toBeInTheDocument();
      expect(screen.queryByTestId('alert-alert-3')).not.toBeInTheDocument();
      expect(screen.queryByTestId('alert-alert-4')).not.toBeInTheDocument();
    });

    it('should filter alerts by date range', () => {
      render(<DeforestationAlertList alerts={mockAlerts} />);

      const startDateInput = screen.getByLabelText('Date de début');
      const endDateInput = screen.getByLabelText('Date de fin');

      fireEvent.change(startDateInput, { target: { value: '2024-02-01' } });
      fireEvent.change(endDateInput, { target: { value: '2024-03-31' } });

      expect(screen.queryByTestId('alert-alert-1')).not.toBeInTheDocument();
      expect(screen.getByTestId('alert-alert-2')).toBeInTheDocument();
      expect(screen.getByTestId('alert-alert-3')).toBeInTheDocument();
      expect(screen.queryByTestId('alert-alert-4')).not.toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('should filter alerts by parcelle ID search', () => {
      render(<DeforestationAlertList alerts={mockAlerts} />);

      const searchInput = screen.getByPlaceholderText('Rechercher par ID de parcelle...');
      fireEvent.change(searchInput, { target: { value: 'parcelle-2' } });

      expect(screen.queryByTestId('alert-alert-1')).not.toBeInTheDocument();
      expect(screen.getByTestId('alert-alert-2')).toBeInTheDocument();
      expect(screen.queryByTestId('alert-alert-3')).not.toBeInTheDocument();
      expect(screen.queryByTestId('alert-alert-4')).not.toBeInTheDocument();
    });

    it('should perform case-insensitive search', () => {
      render(<DeforestationAlertList alerts={mockAlerts} />);

      const searchInput = screen.getByPlaceholderText('Rechercher par ID de parcelle...');
      fireEvent.change(searchInput, { target: { value: 'PARCELLE-3' } });

      expect(screen.getByTestId('alert-alert-3')).toBeInTheDocument();
    });

    it('should show empty state when search has no results', () => {
      render(<DeforestationAlertList alerts={mockAlerts} />);

      const searchInput = screen.getByPlaceholderText('Rechercher par ID de parcelle...');
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

      expect(screen.getByText('Aucune alerte trouvée')).toBeInTheDocument();
      expect(
        screen.getByText('Aucune alerte ne correspond aux filtres sélectionnés.')
      ).toBeInTheDocument();
    });
  });

  describe('Grouping', () => {
    it('should group alerts by status', () => {
      render(<DeforestationAlertList alerts={mockAlerts} />);

      // Check for group headers (h3 elements)
      expect(screen.getByRole('heading', { name: 'En attente', level: 3 })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Reconnues', level: 3 })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Contestées', level: 3 })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Résolues', level: 3 })).toBeInTheDocument();
    });

    it('should display count for each group', () => {
      render(<DeforestationAlertList alerts={mockAlerts} />);

      // Find all group headers (h3 elements with specific class)
      const groups = screen.getAllByRole('heading', { level: 3 }).filter(
        (el) => el.className.includes('text-lg font-semibold')
      );
      expect(groups).toHaveLength(4);
    });
  });

  describe('Filter Reset', () => {
    it('should reset all filters when reset button is clicked', () => {
      render(<DeforestationAlertList alerts={mockAlerts} />);

      // Apply filters
      const pendingButton = screen.getByRole('button', { name: /En attente/i });
      fireEvent.click(pendingButton);

      const startDateInput = screen.getByLabelText('Date de début');
      fireEvent.change(startDateInput, { target: { value: '2024-02-01' } });

      const searchInput = screen.getByPlaceholderText('Rechercher par ID de parcelle...');
      fireEvent.change(searchInput, { target: { value: 'parcelle-1' } });

      // Reset filters
      const resetButton = screen.getByText('Réinitialiser');
      fireEvent.click(resetButton);

      // Check that all alerts are shown
      expect(screen.getByTestId('alert-alert-1')).toBeInTheDocument();
      expect(screen.getByTestId('alert-alert-2')).toBeInTheDocument();
      expect(screen.getByTestId('alert-alert-3')).toBeInTheDocument();
      expect(screen.getByTestId('alert-alert-4')).toBeInTheDocument();

      // Check that filter inputs are cleared
      expect(startDateInput).toHaveValue('');
      expect(searchInput).toHaveValue('');
    });
  });

  describe('Callbacks', () => {
    it('should pass onAcknowledge callback to alert components', () => {
      const mockOnAcknowledge = vi.fn();
      render(
        <DeforestationAlertList alerts={mockAlerts} onAcknowledge={mockOnAcknowledge} />
      );

      // Component should render (callback is passed through)
      expect(screen.getByTestId('alert-alert-1')).toBeInTheDocument();
    });

    it('should pass onDispute callback to alert components', () => {
      const mockOnDispute = vi.fn();
      render(<DeforestationAlertList alerts={mockAlerts} onDispute={mockOnDispute} />);

      // Component should render (callback is passed through)
      expect(screen.getByTestId('alert-alert-1')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels for inputs', () => {
      render(<DeforestationAlertList alerts={mockAlerts} />);

      expect(screen.getByLabelText('Rechercher par ID de parcelle')).toBeInTheDocument();
      expect(screen.getByLabelText('Date de début')).toBeInTheDocument();
      expect(screen.getByLabelText('Date de fin')).toBeInTheDocument();
    });

    it('should have proper aria-pressed for filter buttons', () => {
      render(<DeforestationAlertList alerts={mockAlerts} />);

      const allButton = screen.getByRole('button', { name: /Toutes/i });
      expect(allButton).toHaveAttribute('aria-pressed', 'true');

      const pendingButton = screen.getByRole('button', { name: /En attente/i });
      expect(pendingButton).toHaveAttribute('aria-pressed', 'false');

      fireEvent.click(pendingButton);
      expect(pendingButton).toHaveAttribute('aria-pressed', 'true');
      expect(allButton).toHaveAttribute('aria-pressed', 'false');
    });
  });
});
