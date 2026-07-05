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
  useESGMetrics,
  useUninvoicedReceiptsCount,
  useReceiptPipelineStats,
  dashboardKeys,
} from './useDashboard';
export {
  useCooperativesList,
  useCooperativeGlobalStats,
  useCooperativeDetail,
  useCooperativeOperationalSummary,
  useRegions,
  cooperativeKeys,
} from './useCooperatives';
export {
  useFactoryDashboard,
  useFactoryReceipts,
  useFactoryReceipt,
  usePendingQuality,
  useFactoryStocks,
  useFactoryOrders,
  useFactoryOrder,
  useFactoryTraceability,
  useFactoryProductTypes,
  useFactoryProductionLines,
  useInvalidateFactory,
  useFactoryRealtime,
  useRefreshFactory,
  factoryKeys,
} from './useFactory';
export {
  useWaybillsList,
  useWaybillDetail,
  useWaybillForDelivery,
  useLinkedDeliveryIds,
  useInvalidateWaybills,
  waybillKeys,
} from './useWaybills';
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
