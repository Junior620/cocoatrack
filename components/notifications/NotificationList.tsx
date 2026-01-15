// CocoaTrack V2 - Notification List Component
// Full page notification list with filtering and pagination

'use client';

import { useState } from 'react';
import { Bell, Check, CheckCheck, Trash2, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';

import { useNotifications } from '@/lib/hooks/useNotifications';
import type { Notification } from '@/types/database.gen';

interface NotificationListProps {
  /** Custom class name */
  className?: string;
}

export function NotificationList({ className = '' }: NotificationListProps) {
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  
  const {
    notifications,
    total,
    unreadCount,
    page,
    totalPages,
    isLoading,
    error,
    nextPage,
    prevPage,
    goToPage,
    markAsRead,
    markAllAsRead,
    remove,
    refresh,
  } = useNotifications({ unreadOnly: showUnreadOnly, pageSize: 20 });

  if (error) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <div className="text-center text-red-600">
          <p>Erreur lors du chargement des notifications</p>
          <button
            onClick={refresh}
            className="mt-2 text-sm text-blue-600 hover:text-blue-800"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
            <p className="text-sm text-gray-500">
              {total} notification{total !== 1 ? 's' : ''}
              {unreadCount > 0 && ` • ${unreadCount} non lue${unreadCount !== 1 ? 's' : ''}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Filter toggle */}
            <button
              onClick={() => setShowUnreadOnly(!showUnreadOnly)}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border transition-colors ${
                showUnreadOnly
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Filter className="h-4 w-4" />
              {showUnreadOnly ? 'Non lues' : 'Toutes'}
            </button>
            
            {/* Mark all as read */}
            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsRead()}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors"
              >
                <CheckCheck className="h-4 w-4" />
                Tout marquer comme lu
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Notification List */}
      <div className="divide-y divide-gray-100">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-pulse text-gray-500">Chargement...</div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center">
            <Bell className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">
              {showUnreadOnly
                ? 'Aucune notification non lue'
                : 'Aucune notification'}
            </p>
          </div>
        ) : (
          notifications.map((notification) => (
            <NotificationRow
              key={notification.id}
              notification={notification}
              onMarkAsRead={markAsRead}
              onDelete={remove}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {page} sur {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={prevPage}
              disabled={page === 1}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            
            {/* Page numbers */}
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => goToPage(pageNum)}
                    className={`w-8 h-8 text-sm rounded ${
                      page === pageNum
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            
            <button
              onClick={nextPage}
              disabled={page === totalPages}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface NotificationRowProps {
  notification: Notification;
  onMarkAsRead: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function NotificationRow({ notification, onMarkAsRead, onDelete }: NotificationRowProps) {
  const isUnread = !notification.read_at;
  const timeAgo = formatDistanceToNow(new Date(notification.created_at), {
    addSuffix: true,
    locale: fr,
  });
  const fullDate = format(new Date(notification.created_at), 'PPpp', { locale: fr });

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'delivery_created':
      case 'delivery_updated':
        return '📦';
      case 'chef_planteur_validated':
        return '✅';
      case 'chef_planteur_rejected':
        return '❌';
      case 'invoice_generated':
        return '📄';
      case 'message_received':
        return '💬';
      default:
        return '🔔';
    }
  };

  const getNotificationTypeLabel = (type: string) => {
    switch (type) {
      case 'delivery_created':
        return 'Nouvelle livraison';
      case 'delivery_updated':
        return 'Livraison modifiée';
      case 'chef_planteur_validated':
        return 'Chef planteur validé';
      case 'chef_planteur_rejected':
        return 'Chef planteur rejeté';
      case 'invoice_generated':
        return 'Facture générée';
      case 'message_received':
        return 'Nouveau message';
      default:
        return 'Notification';
    }
  };

  return (
    <div
      className={`px-6 py-4 hover:bg-gray-50 transition-colors ${
        isUnread ? 'bg-blue-50/30' : ''
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <span className="text-2xl flex-shrink-0 mt-1">
          {getNotificationIcon(notification.type)}
        </span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {getNotificationTypeLabel(notification.type)}
            </span>
            {isUnread && (
              <span className="w-2 h-2 bg-blue-500 rounded-full" />
            )}
          </div>
          <p className={`text-sm ${isUnread ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
            {notification.title}
          </p>
          {notification.body && (
            <p className="text-sm text-gray-500 mt-1">
              {notification.body}
            </p>
          )}
          <p className="text-xs text-gray-400 mt-2" title={fullDate}>
            {timeAgo}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {isUnread && (
            <button
              onClick={() => onMarkAsRead(notification.id)}
              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
              title="Marquer comme lu"
            >
              <Check className="h-5 w-5" />
            </button>
          )}
          <button
            onClick={() => onDelete(notification.id)}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
            title="Supprimer"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default NotificationList;
