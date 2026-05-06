// CocoaTrack V2 - Satellite Notification Preferences Component
// UI for managing satellite imagery notification preferences
// Task 4.4.4: Create notification preferences UI

'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Satellite, 
  AlertTriangle, 
  TrendingDown,
  Bell,
  BellOff,
  Loader2,
  Check,
  Info
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export type SatelliteNotificationFrequency = 'immediate' | 'daily' | 'weekly' | 'never';
export type SatelliteNotificationSeverity = 'all' | 'critical' | 'high' | 'none';

export interface SatelliteNotificationPreferences {
  /** Enable all satellite notifications */
  enabled: boolean;
  
  /** Deforestation alert notifications */
  deforestationAlerts: {
    enabled: boolean;
    frequency: SatelliteNotificationFrequency;
    emailEnabled: boolean;
    inAppEnabled: boolean;
  };
  
  /** Health status change notifications */
  healthStatusChanges: {
    enabled: boolean;
    frequency: SatelliteNotificationFrequency;
    severityThreshold: SatelliteNotificationSeverity;
    emailEnabled: boolean;
    inAppEnabled: boolean;
  };
  
  /** NDVI calculation completion notifications */
  ndviCalculations: {
    enabled: boolean;
    emailEnabled: boolean;
    inAppEnabled: boolean;
  };
  
  /** Last updated timestamp */
  updatedAt: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_SATELLITE_PREFERENCES: SatelliteNotificationPreferences = {
  enabled: true,
  deforestationAlerts: {
    enabled: true,
    frequency: 'immediate',
    emailEnabled: true,
    inAppEnabled: true,
  },
  healthStatusChanges: {
    enabled: true,
    frequency: 'daily',
    severityThreshold: 'high',
    emailEnabled: true,
    inAppEnabled: true,
  },
  ndviCalculations: {
    enabled: false,
    emailEnabled: false,
    inAppEnabled: true,
  },
  updatedAt: new Date().toISOString(),
};

const FREQUENCY_LABELS: Record<SatelliteNotificationFrequency, string> = {
  immediate: 'Immédiat',
  daily: 'Quotidien (résumé)',
  weekly: 'Hebdomadaire (résumé)',
  never: 'Jamais',
};

const SEVERITY_LABELS: Record<SatelliteNotificationSeverity, string> = {
  all: 'Tous les changements',
  critical: 'Critique uniquement (3+ catégories)',
  high: 'Élevé et critique (2+ catégories)',
  none: 'Aucun',
};

// ============================================================================
// COMPONENT
// ============================================================================

interface SatelliteNotificationPreferencesProps {
  /** Custom class name */
  className?: string;
  /** Callback when preferences change */
  onPreferencesChange?: (prefs: SatelliteNotificationPreferences) => void;
}

export function SatelliteNotificationPreferences({ 
  className = '',
  onPreferencesChange,
}: SatelliteNotificationPreferencesProps) {
  const [preferences, setPreferences] = useState<SatelliteNotificationPreferences>(DEFAULT_SATELLITE_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        // TODO: Implement API call to load preferences from database
        // For now, load from localStorage
        const stored = localStorage.getItem('satellite_notification_preferences');
        if (stored) {
          setPreferences(JSON.parse(stored));
        }
      } catch (error) {
        console.error('Failed to load satellite notification preferences:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadPreferences();
  }, []);

  // Save preferences
  const savePreferences = useCallback(async (updated: SatelliteNotificationPreferences) => {
    setIsSaving(true);
    try {
      // TODO: Implement API call to save preferences to database
      // For now, save to localStorage
      localStorage.setItem('satellite_notification_preferences', JSON.stringify(updated));
      setPreferences(updated);
      onPreferencesChange?.(updated);
      showSaveSuccess();
    } catch (error) {
      console.error('Failed to save satellite notification preferences:', error);
    } finally {
      setIsSaving(false);
    }
  }, [onPreferencesChange]);

  // Handle global toggle
  const handleGlobalToggle = useCallback(async () => {
    const updated = {
      ...preferences,
      enabled: !preferences.enabled,
      updatedAt: new Date().toISOString(),
    };
    await savePreferences(updated);
  }, [preferences, savePreferences]);

  // Handle deforestation alert settings
  const handleDeforestationToggle = useCallback(async () => {
    const updated = {
      ...preferences,
      deforestationAlerts: {
        ...preferences.deforestationAlerts,
        enabled: !preferences.deforestationAlerts.enabled,
      },
      updatedAt: new Date().toISOString(),
    };
    await savePreferences(updated);
  }, [preferences, savePreferences]);

  const handleDeforestationFrequency = useCallback(async (frequency: SatelliteNotificationFrequency) => {
    const updated = {
      ...preferences,
      deforestationAlerts: {
        ...preferences.deforestationAlerts,
        frequency,
      },
      updatedAt: new Date().toISOString(),
    };
    await savePreferences(updated);
  }, [preferences, savePreferences]);

  const handleDeforestationChannel = useCallback(async (channel: 'email' | 'inApp', enabled: boolean) => {
    const updated = {
      ...preferences,
      deforestationAlerts: {
        ...preferences.deforestationAlerts,
        [`${channel}Enabled`]: enabled,
      },
      updatedAt: new Date().toISOString(),
    };
    await savePreferences(updated);
  }, [preferences, savePreferences]);

  // Handle health status settings
  const handleHealthStatusToggle = useCallback(async () => {
    const updated = {
      ...preferences,
      healthStatusChanges: {
        ...preferences.healthStatusChanges,
        enabled: !preferences.healthStatusChanges.enabled,
      },
      updatedAt: new Date().toISOString(),
    };
    await savePreferences(updated);
  }, [preferences, savePreferences]);

  const handleHealthStatusFrequency = useCallback(async (frequency: SatelliteNotificationFrequency) => {
    const updated = {
      ...preferences,
      healthStatusChanges: {
        ...preferences.healthStatusChanges,
        frequency,
      },
      updatedAt: new Date().toISOString(),
    };
    await savePreferences(updated);
  }, [preferences, savePreferences]);

  const handleHealthStatusSeverity = useCallback(async (severityThreshold: SatelliteNotificationSeverity) => {
    const updated = {
      ...preferences,
      healthStatusChanges: {
        ...preferences.healthStatusChanges,
        severityThreshold,
      },
      updatedAt: new Date().toISOString(),
    };
    await savePreferences(updated);
  }, [preferences, savePreferences]);

  const handleHealthStatusChannel = useCallback(async (channel: 'email' | 'inApp', enabled: boolean) => {
    const updated = {
      ...preferences,
      healthStatusChanges: {
        ...preferences.healthStatusChanges,
        [`${channel}Enabled`]: enabled,
      },
      updatedAt: new Date().toISOString(),
    };
    await savePreferences(updated);
  }, [preferences, savePreferences]);

  // Handle NDVI calculation settings
  const handleNDVIToggle = useCallback(async () => {
    const updated = {
      ...preferences,
      ndviCalculations: {
        ...preferences.ndviCalculations,
        enabled: !preferences.ndviCalculations.enabled,
      },
      updatedAt: new Date().toISOString(),
    };
    await savePreferences(updated);
  }, [preferences, savePreferences]);

  const handleNDVIChannel = useCallback(async (channel: 'email' | 'inApp', enabled: boolean) => {
    const updated = {
      ...preferences,
      ndviCalculations: {
        ...preferences.ndviCalculations,
        [`${channel}Enabled`]: enabled,
      },
      updatedAt: new Date().toISOString(),
    };
    await savePreferences(updated);
  }, [preferences, savePreferences]);

  // Show save success indicator
  const showSaveSuccess = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  if (isLoading) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Chargement des préférences...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Satellite className="h-5 w-5 text-blue-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Notifications Satellite
              </h3>
              <p className="text-sm text-gray-500">
                Gérez les notifications liées à l&apos;imagerie satellite
              </p>
            </div>
          </div>
          {(isSaving || saveSuccess) && (
            <div className="flex items-center gap-2 text-sm">
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                  <span className="text-blue-600">Enregistrement...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-green-600">Enregistré</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Global Toggle */}
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {preferences.enabled ? (
              <Bell className="h-5 w-5 text-blue-500" />
            ) : (
              <BellOff className="h-5 w-5 text-gray-400" />
            )}
            <div>
              <p className="font-medium text-gray-900">Activer les notifications satellite</p>
              <p className="text-sm text-gray-500">
                Recevoir toutes les notifications liées à l&apos;imagerie satellite
              </p>
            </div>
          </div>
          <ToggleSwitch
            enabled={preferences.enabled}
            onChange={handleGlobalToggle}
            disabled={isSaving}
          />
        </div>
      </div>

      {/* Deforestation Alerts */}
      <div className={`px-6 py-4 border-b border-gray-100 ${!preferences.enabled ? 'opacity-50' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className={`h-5 w-5 ${preferences.deforestationAlerts.enabled ? 'text-red-500' : 'text-gray-400'}`} />
            <div>
              <p className="font-medium text-gray-900">Alertes de déforestation</p>
              <p className="text-sm text-gray-500">
                Notifications lors de la détection de déforestation
              </p>
            </div>
          </div>
          <ToggleSwitch
            enabled={preferences.deforestationAlerts.enabled}
            onChange={handleDeforestationToggle}
            disabled={isSaving || !preferences.enabled}
          />
        </div>

        {preferences.deforestationAlerts.enabled && preferences.enabled && (
          <div className="ml-8 space-y-4">
            {/* Frequency */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fréquence
              </label>
              <select
                value={preferences.deforestationAlerts.frequency}
                onChange={(e) => handleDeforestationFrequency(e.target.value as SatelliteNotificationFrequency)}
                disabled={isSaving}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
              >
                {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            {/* Channels */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Canaux de notification
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={preferences.deforestationAlerts.emailEnabled}
                    onChange={(e) => handleDeforestationChannel('email', e.target.checked)}
                    disabled={isSaving}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Email</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={preferences.deforestationAlerts.inAppEnabled}
                    onChange={(e) => handleDeforestationChannel('inApp', e.target.checked)}
                    disabled={isSaving}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">In-app</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Health Status Changes */}
      <div className={`px-6 py-4 border-b border-gray-100 ${!preferences.enabled ? 'opacity-50' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <TrendingDown className={`h-5 w-5 ${preferences.healthStatusChanges.enabled ? 'text-orange-500' : 'text-gray-400'}`} />
            <div>
              <p className="font-medium text-gray-900">Changements de santé des parcelles</p>
              <p className="text-sm text-gray-500">
                Notifications lors de la dégradation de la santé des parcelles
              </p>
            </div>
          </div>
          <ToggleSwitch
            enabled={preferences.healthStatusChanges.enabled}
            onChange={handleHealthStatusToggle}
            disabled={isSaving || !preferences.enabled}
          />
        </div>

        {preferences.healthStatusChanges.enabled && preferences.enabled && (
          <div className="ml-8 space-y-4">
            {/* Frequency */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fréquence
              </label>
              <select
                value={preferences.healthStatusChanges.frequency}
                onChange={(e) => handleHealthStatusFrequency(e.target.value as SatelliteNotificationFrequency)}
                disabled={isSaving}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
              >
                {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            {/* Severity Threshold */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Seuil de gravité
              </label>
              <select
                value={preferences.healthStatusChanges.severityThreshold}
                onChange={(e) => handleHealthStatusSeverity(e.target.value as SatelliteNotificationSeverity)}
                disabled={isSaving}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
              >
                {Object.entries(SEVERITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Définit le niveau de changement requis pour déclencher une notification
              </p>
            </div>

            {/* Channels */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Canaux de notification
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={preferences.healthStatusChanges.emailEnabled}
                    onChange={(e) => handleHealthStatusChannel('email', e.target.checked)}
                    disabled={isSaving}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Email</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={preferences.healthStatusChanges.inAppEnabled}
                    onChange={(e) => handleHealthStatusChannel('inApp', e.target.checked)}
                    disabled={isSaving}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">In-app</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* NDVI Calculations */}
      <div className={`px-6 py-4 ${!preferences.enabled ? 'opacity-50' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Satellite className={`h-5 w-5 ${preferences.ndviCalculations.enabled ? 'text-green-500' : 'text-gray-400'}`} />
            <div>
              <p className="font-medium text-gray-900">Calculs NDVI terminés</p>
              <p className="text-sm text-gray-500">
                Notifications lorsque les calculs NDVI sont terminés
              </p>
            </div>
          </div>
          <ToggleSwitch
            enabled={preferences.ndviCalculations.enabled}
            onChange={handleNDVIToggle}
            disabled={isSaving || !preferences.enabled}
          />
        </div>

        {preferences.ndviCalculations.enabled && preferences.enabled && (
          <div className="ml-8 space-y-4">
            {/* Channels */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Canaux de notification
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={preferences.ndviCalculations.emailEnabled}
                    onChange={(e) => handleNDVIChannel('email', e.target.checked)}
                    disabled={isSaving}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Email</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={preferences.ndviCalculations.inAppEnabled}
                    onChange={(e) => handleNDVIChannel('inApp', e.target.checked)}
                    disabled={isSaving}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">In-app</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Info Footer */}
      <div className="px-6 py-4 bg-blue-50 rounded-b-lg">
        <div className="flex gap-2">
          <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-blue-700">
            <p className="font-medium mb-1">À propos des notifications satellite</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Les alertes de déforestation sont toujours envoyées immédiatement aux gestionnaires</li>
              <li>Les résumés quotidiens sont envoyés à 8h00</li>
              <li>Les résumés hebdomadaires sont envoyés le lundi à 8h00</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TOGGLE SWITCH COMPONENT
// ============================================================================

interface ToggleSwitchProps {
  enabled: boolean;
  onChange: () => void;
  disabled?: boolean;
}

function ToggleSwitch({ enabled, onChange, disabled = false }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onChange}
      disabled={disabled}
      className={`
        relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent 
        transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        ${enabled ? 'bg-blue-600' : 'bg-gray-200'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <span
        className={`
          pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 
          transition duration-200 ease-in-out
          ${enabled ? 'translate-x-5' : 'translate-x-0'}
        `}
      />
    </button>
  );
}

export default SatelliteNotificationPreferences;
