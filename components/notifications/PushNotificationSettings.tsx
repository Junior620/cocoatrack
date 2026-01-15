// CocoaTrack V2 - Push Notification Settings Component
// UI for managing push notification subscriptions
// Requirements: REQ-NOTIF-005

'use client';

import { Bell, BellOff, AlertCircle, CheckCircle, Loader2, Inbox } from 'lucide-react';
import { usePushNotifications } from '@/lib/hooks/usePushNotifications';
import { useNotificationPermission } from '@/lib/hooks/useNotificationPermission';

interface PushNotificationSettingsProps {
  /** Custom class name */
  className?: string;
  /** Show in-app badge fallback info */
  showBadgeFallback?: boolean;
}

export function PushNotificationSettings({ 
  className = '',
  showBadgeFallback = true,
}: PushNotificationSettingsProps) {
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading: isPushLoading,
    error,
    subscribe,
    unsubscribe,
  } = usePushNotifications();

  const {
    shouldUseBadge,
    canRequest,
    isLoading: isPermissionLoading,
    requestPermission,
  } = useNotificationPermission();

  const isLoading = isPushLoading || isPermissionLoading;

  // Not supported
  if (!isSupported) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <BellOff className="h-5 w-5 text-gray-400 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-gray-700">
                Notifications push non disponibles
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Votre navigateur ne supporte pas les notifications push.
              </p>
            </div>
          </div>
        </div>
        
        {/* Badge fallback info */}
        {showBadgeFallback && (
          <BadgeFallbackInfo />
        )}
      </div>
    );
  }

  // Permission denied - show badge fallback
  if (permission === 'denied') {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="bg-red-50 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-red-800">
                Notifications bloquées
              </h3>
              <p className="text-sm text-red-600 mt-1">
                Les notifications ont été bloquées. Pour les activer, modifiez les
                paramètres de votre navigateur.
              </p>
            </div>
          </div>
        </div>
        
        {/* Badge fallback info - REQ-NOTIF-005 */}
        {showBadgeFallback && (
          <BadgeFallbackInfo />
        )}
      </div>
    );
  }

  // Subscribed
  if (isSubscribed) {
    return (
      <div className={`bg-green-50 rounded-lg p-4 ${className}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-green-800">
                Notifications activées
              </h3>
              <p className="text-sm text-green-600 mt-1">
                Vous recevrez des notifications push pour les événements importants.
              </p>
            </div>
          </div>
          <button
            onClick={unsubscribe}
            disabled={isLoading}
            className="px-3 py-1.5 text-sm text-red-600 hover:text-red-800 hover:bg-red-100 rounded-md transition-colors disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Désactiver'
            )}
          </button>
        </div>
      </div>
    );
  }

  // Not subscribed - show subscribe button
  // REQ-NOTIF-005: Only request after user action ("Activer les notifications")
  const handleActivate = async () => {
    if (permission === 'prompt' && canRequest) {
      // Request permission first (user-initiated)
      const result = await requestPermission();
      if (result.canUsePush) {
        // Then subscribe
        await subscribe();
      }
    } else if (permission === 'granted') {
      // Already have permission, just subscribe
      await subscribe();
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="bg-blue-50 rounded-lg p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Bell className="h-5 w-5 text-blue-500 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-blue-800">
                Activer les notifications push
              </h3>
              <p className="text-sm text-blue-600 mt-1">
                Recevez des notifications en temps réel pour les nouvelles livraisons,
                validations et messages.
              </p>
              {error && (
                <p className="text-sm text-red-600 mt-2">
                  Erreur: {error.message}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleActivate}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Activation...</span>
              </>
            ) : (
              <>
                <Bell className="h-4 w-4" />
                <span>Activer</span>
              </>
            )}
          </button>
        </div>
      </div>
      
      {/* Badge fallback info when push not enabled */}
      {showBadgeFallback && shouldUseBadge && (
        <BadgeFallbackInfo />
      )}
    </div>
  );
}

/**
 * Badge fallback info component
 * REQ-NOTIF-005: Fallback to in-app badge if denied
 */
function BadgeFallbackInfo() {
  return (
    <div className="bg-amber-50 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <Inbox className="h-5 w-5 text-amber-500 mt-0.5" />
        <div>
          <h3 className="text-sm font-medium text-amber-800">
            Notifications in-app disponibles
          </h3>
          <p className="text-sm text-amber-600 mt-1">
            Vous pouvez toujours voir vos notifications via le badge dans 
            l&apos;application. Consultez régulièrement la cloche de notifications.
          </p>
        </div>
      </div>
    </div>
  );
}

export default PushNotificationSettings;
