// CocoaTrack V2 - Push Notifications Hook
// Hook for managing push notification subscriptions

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  savePushSubscription,
  removePushSubscription,
  getUserPushSubscriptions,
  isSubscriptionRegistered,
} from '@/lib/api/push-notifications';

export type PushPermissionState = 'prompt' | 'granted' | 'denied' | 'unsupported';

export interface UsePushNotificationsReturn {
  /** Whether push notifications are supported */
  isSupported: boolean;
  /** Current permission state */
  permission: PushPermissionState;
  /** Whether the user is subscribed to push notifications */
  isSubscribed: boolean;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Subscribe to push notifications */
  subscribe: () => Promise<void>;
  /** Unsubscribe from push notifications */
  unsubscribe: () => Promise<void>;
  /** Request permission for push notifications */
  requestPermission: () => Promise<NotificationPermission>;
}

// VAPID public key - should be set in environment variables
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

/**
 * Converts a base64 string to Uint8Array for VAPID key
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length) as Uint8Array<ArrayBuffer>;
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const [permission, setPermission] = useState<PushPermissionState>('prompt');
  const [currentSubscription, setCurrentSubscription] = useState<PushSubscription | null>(null);
  const queryClient = useQueryClient();

  // Check if push notifications are supported
  const isSupported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

  // Query for checking if subscription is registered
  const { data: isRegistered = false, isLoading: isCheckingRegistration } = useQuery({
    queryKey: ['push-subscription', 'registered', currentSubscription?.endpoint],
    queryFn: async () => {
      if (!currentSubscription) return false;
      return isSubscriptionRegistered(currentSubscription);
    },
    enabled: !!currentSubscription,
  });

  // Mutation for subscribing
  const subscribeMutation = useMutation({
    mutationFn: async () => {
      if (!isSupported) {
        throw new Error('Push notifications are not supported');
      }

      // Request permission if needed
      if (Notification.permission === 'default') {
        const result = await Notification.requestPermission();
        if (result !== 'granted') {
          throw new Error('Push notification permission denied');
        }
      }

      if (Notification.permission !== 'granted') {
        throw new Error('Push notification permission not granted');
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // Save to database
      await savePushSubscription(subscription);

      return subscription;
    },
    onSuccess: (subscription) => {
      setCurrentSubscription(subscription);
      queryClient.invalidateQueries({ queryKey: ['push-subscription'] });
    },
  });

  // Mutation for unsubscribing
  const unsubscribeMutation = useMutation({
    mutationFn: async () => {
      if (!currentSubscription) {
        throw new Error('No active subscription');
      }

      // Remove from database
      await removePushSubscription(currentSubscription.endpoint);

      // Unsubscribe from push
      await currentSubscription.unsubscribe();
    },
    onSuccess: () => {
      setCurrentSubscription(null);
      queryClient.invalidateQueries({ queryKey: ['push-subscription'] });
    },
  });

  // Check permission and subscription status on mount
  useEffect(() => {
    if (!isSupported) {
      setPermission('unsupported');
      return;
    }

    // Check permission
    setPermission(Notification.permission as PushPermissionState);

    // Check existing subscription
    const checkSubscription = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setCurrentSubscription(subscription);
      } catch (error) {
        console.error('Error checking push subscription:', error);
      }
    };

    checkSubscription();
  }, [isSupported]);

  // Listen for permission changes
  useEffect(() => {
    if (!isSupported) return;

    const handlePermissionChange = () => {
      setPermission(Notification.permission as PushPermissionState);
    };

    // Some browsers support this event
    if ('permissions' in navigator) {
      navigator.permissions
        .query({ name: 'notifications' })
        .then((permissionStatus) => {
          permissionStatus.onchange = handlePermissionChange;
        })
        .catch(() => {
          // Ignore errors - not all browsers support this
        });
    }
  }, [isSupported]);

  const subscribe = useCallback(async () => {
    await subscribeMutation.mutateAsync();
  }, [subscribeMutation]);

  const unsubscribe = useCallback(async () => {
    await unsubscribeMutation.mutateAsync();
  }, [unsubscribeMutation]);

  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      throw new Error('Push notifications are not supported');
    }
    const result = await Notification.requestPermission();
    setPermission(result as PushPermissionState);
    return result;
  }, [isSupported]);

  return {
    isSupported,
    permission,
    isSubscribed: !!currentSubscription && isRegistered,
    isLoading:
      subscribeMutation.isPending ||
      unsubscribeMutation.isPending ||
      isCheckingRegistration,
    error:
      (subscribeMutation.error as Error) ||
      (unsubscribeMutation.error as Error) ||
      null,
    subscribe,
    unsubscribe,
    requestPermission,
  };
}

export default usePushNotifications;
