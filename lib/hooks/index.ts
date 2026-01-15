// CocoaTrack V2 - Custom Hooks
// Re-exports all custom hooks

export { useUrlState } from './useUrlState';
export { useSignedUrl, useSignedUrls, clearSignedUrlCache, invalidateSignedUrl } from './useSignedUrl';
export {
  useDashboardMetrics,
  useDashboardMetricsWithComparison,
  useDailyTrend,
  useTopPlanteurs,
  useTopChefPlanteurs,
  useDashboardData,
  useDashboardRealtime,
  useRefreshDashboard,
  useDeliveryLocations,
  useEntityCounts,
  dashboardKeys,
} from './useDashboard';
export {
  usePrefersReducedMotion,
  useCounterAnimation,
  useFadeIn,
  useStaggerFadeIn,
  useScrollTrigger,
  usePageTransition,
} from './useGSAP';
export {
  useNotifications,
  useUnreadNotificationCount,
  type UseNotificationsOptions,
  type UseNotificationsReturn,
} from './useNotifications';
export {
  usePushNotifications,
  type PushPermissionState,
  type UsePushNotificationsReturn,
} from './usePushNotifications';
export {
  useConversations,
  useMessages,
  useMessageableUsers,
  type UseConversationsOptions,
  type UseConversationsReturn,
  type UseMessagesOptions,
  type UseMessagesReturn,
} from './useMessaging';
