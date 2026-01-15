// CocoaTrack V2 - Notifications Page
// Full page view for all notifications with preferences

import { Metadata } from 'next';
import { NotificationList, NotificationPreferences, PushNotificationSettings } from '@/components/notifications';

export const metadata: Metadata = {
  title: 'Notifications | CocoaTrack',
  description: 'Gérez vos notifications',
};

export default function NotificationsPage() {
  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
        <p className="text-gray-500 mt-1">
          Consultez et gérez toutes vos notifications
        </p>
      </div>

      {/* Push Notification Settings */}
      <PushNotificationSettings />

      {/* Notification Preferences */}
      <NotificationPreferences />

      {/* Notification List */}
      <NotificationList />
    </div>
  );
}
