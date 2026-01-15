// CocoaTrack V2 - Notification Preferences Component
// UI for managing notification categories and quiet hours
// Requirements: REQ-NOTIF-001

'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Bell, 
  BellOff, 
  Moon, 
  Package, 
  AlertTriangle, 
  Clock, 
  RefreshCw,
  Loader2,
  Check
} from 'lucide-react';

import {
  getNotificationPreferences,
  saveNotificationPreferences,
  toggleCategory,
  updateQuietHours,
  type NotificationPreferences as NotificationPreferencesType,
  type NotificationCategory,
  type QuietHours,
  CATEGORY_LABELS,
  DEFAULT_PREFERENCES,
} from '@/lib/notifications/notification-preferences';

interface NotificationPreferencesProps {
  /** Custom class name */
  className?: string;
  /** Callback when preferences change */
  onPreferencesChange?: (prefs: NotificationPreferencesType) => void;
}

/**
 * Category icon mapping
 */
const CATEGORY_ICONS: Record<NotificationCategory, React.ReactNode> = {
  livraisons: <Package className="h-5 w-5" />,
  alertes: <AlertTriangle className="h-5 w-5" />,
  rappels: <Clock className="h-5 w-5" />,
  sync: <RefreshCw className="h-5 w-5" />,
};

export function NotificationPreferences({ 
  className = '',
  onPreferencesChange,
}: NotificationPreferencesProps) {
  const [preferences, setPreferences] = useState<NotificationPreferencesType>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const prefs = await getNotificationPreferences();
        setPreferences(prefs);
      } catch (error) {
        console.error('Failed to load notification preferences:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadPreferences();
  }, []);

  // Handle category toggle
  const handleCategoryToggle = useCallback(async (category: NotificationCategory) => {
    setIsSaving(true);
    try {
      const newValue = !preferences.categories[category];
      const updated = await toggleCategory(category, newValue);
      setPreferences(updated);
      onPreferencesChange?.(updated);
      showSaveSuccess();
    } catch (error) {
      console.error('Failed to toggle category:', error);
    } finally {
      setIsSaving(false);
    }
  }, [preferences, onPreferencesChange]);

  // Handle quiet hours toggle
  const handleQuietHoursToggle = useCallback(async () => {
    setIsSaving(true);
    try {
      const updated = await updateQuietHours({ enabled: !preferences.quietHours.enabled });
      setPreferences(updated);
      onPreferencesChange?.(updated);
      showSaveSuccess();
    } catch (error) {
      console.error('Failed to toggle quiet hours:', error);
    } finally {
      setIsSaving(false);
    }
  }, [preferences, onPreferencesChange]);

  // Handle quiet hours time change
  const handleQuietHoursTimeChange = useCallback(async (
    field: 'start' | 'end',
    value: string
  ) => {
    setIsSaving(true);
    try {
      const updated = await updateQuietHours({ [field]: value });
      setPreferences(updated);
      onPreferencesChange?.(updated);
      showSaveSuccess();
    } catch (error) {
      console.error('Failed to update quiet hours:', error);
    } finally {
      setIsSaving(false);
    }
  }, [onPreferencesChange]);

  // Handle in-app notifications toggle
  const handleInAppToggle = useCallback(async () => {
    setIsSaving(true);
    try {
      const updated = await saveNotificationPreferences({ 
        inAppEnabled: !preferences.inAppEnabled 
      });
      setPreferences(updated);
      onPreferencesChange?.(updated);
      showSaveSuccess();
    } catch (error) {
      console.error('Failed to toggle in-app notifications:', error);
    } finally {
      setIsSaving(false);
    }
  }, [preferences, onPreferencesChange]);

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
            <Bell className="h-5 w-5 text-gray-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Préférences de notifications
              </h3>
              <p className="text-sm text-gray-500">
                Gérez vos notifications par catégorie
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

      {/* In-App Notifications Toggle */}
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {preferences.inAppEnabled ? (
              <Bell className="h-5 w-5 text-blue-500" />
            ) : (
              <BellOff className="h-5 w-5 text-gray-400" />
            )}
            <div>
              <p className="font-medium text-gray-900">Notifications in-app</p>
              <p className="text-sm text-gray-500">
                Afficher les notifications dans l&apos;application
              </p>
            </div>
          </div>
          <ToggleSwitch
            enabled={preferences.inAppEnabled}
            onChange={handleInAppToggle}
            disabled={isSaving}
          />
        </div>
      </div>

      {/* Category Toggles */}
      <div className="px-6 py-4 space-y-4">
        <h4 className="text-sm font-medium text-gray-700 uppercase tracking-wide">
          Catégories
        </h4>
        
        {(Object.keys(CATEGORY_LABELS) as NotificationCategory[]).map((category) => (
          <div 
            key={category}
            className="flex items-center justify-between py-2"
          >
            <div className="flex items-center gap-3">
              <div className={`${preferences.categories[category] ? 'text-blue-500' : 'text-gray-400'}`}>
                {CATEGORY_ICONS[category]}
              </div>
              <div>
                <p className="font-medium text-gray-900">
                  {CATEGORY_LABELS[category].label}
                </p>
                <p className="text-sm text-gray-500">
                  {CATEGORY_LABELS[category].description}
                </p>
              </div>
            </div>
            <ToggleSwitch
              enabled={preferences.categories[category]}
              onChange={() => handleCategoryToggle(category)}
              disabled={isSaving}
            />
          </div>
        ))}
      </div>

      {/* Quiet Hours */}
      <div className="px-6 py-4 border-t border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Moon className={`h-5 w-5 ${preferences.quietHours.enabled ? 'text-indigo-500' : 'text-gray-400'}`} />
            <div>
              <p className="font-medium text-gray-900">Heures de silence</p>
              <p className="text-sm text-gray-500">
                Désactiver les notifications pendant certaines heures
              </p>
            </div>
          </div>
          <ToggleSwitch
            enabled={preferences.quietHours.enabled}
            onChange={handleQuietHoursToggle}
            disabled={isSaving}
          />
        </div>

        {preferences.quietHours.enabled && (
          <div className="ml-8 mt-4 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label htmlFor="quiet-start" className="text-sm text-gray-600">
                De
              </label>
              <input
                id="quiet-start"
                type="time"
                value={preferences.quietHours.start}
                onChange={(e) => handleQuietHoursTimeChange('start', e.target.value)}
                disabled={isSaving}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
              />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="quiet-end" className="text-sm text-gray-600">
                à
              </label>
              <input
                id="quiet-end"
                type="time"
                value={preferences.quietHours.end}
                onChange={(e) => handleQuietHoursTimeChange('end', e.target.value)}
                disabled={isSaving}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
              />
            </div>
          </div>
        )}
      </div>

      {/* Info Footer */}
      <div className="px-6 py-4 bg-gray-50 rounded-b-lg">
        <p className="text-xs text-gray-500">
          Les heures de silence par défaut sont de 22h à 7h. 
          Pendant ces heures, vous ne recevrez pas de notifications push.
        </p>
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

export default NotificationPreferences;
