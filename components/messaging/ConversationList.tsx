// CocoaTrack V2 - Conversation List Component
// Displays list of conversations in the inbox

'use client';

import { useState } from 'react';
import { MessageSquare, Users, User, Plus, Search } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

import { useConversations } from '@/lib/hooks/useMessaging';
import type { ConversationWithDetails } from '@/lib/api/messaging';

interface ConversationListProps {
  selectedId?: string;
  onSelect: (conversationId: string) => void;
  onNewConversation: () => void;
}

export function ConversationList({
  selectedId,
  onSelect,
  onNewConversation,
}: ConversationListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { conversations, isLoading, error } = useConversations();

  // Filter conversations by search query
  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    
    // Search in conversation name (for groups)
    if (conv.name?.toLowerCase().includes(query)) return true;
    
    // Search in participant names
    return conv.participants_details?.some((p) =>
      p.full_name.toLowerCase().includes(query)
    );
  });

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Messages</h2>
          <button
            onClick={onNewConversation}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
            title="Nouvelle conversation"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-gray-500">
            <div className="animate-pulse">Chargement...</div>
          </div>
        ) : error ? (
          <div className="p-4 text-center text-red-500">
            Erreur lors du chargement
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-8 text-center">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">
              {searchQuery ? 'Aucun résultat' : 'Aucune conversation'}
            </p>
            {!searchQuery && (
              <button
                onClick={onNewConversation}
                className="mt-4 text-sm text-blue-600 hover:text-blue-800"
              >
                Démarrer une conversation
              </button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {filteredConversations.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isSelected={selectedId === conversation.id}
                onClick={() => onSelect(conversation.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

interface ConversationItemProps {
  conversation: ConversationWithDetails;
  isSelected: boolean;
  onClick: () => void;
}

function ConversationItem({ conversation, isSelected, onClick }: ConversationItemProps) {
  const isGroup = conversation.type === 'group';
  const hasUnread = (conversation.unread_count || 0) > 0;
  
  // Get display name
  const displayName = isGroup
    ? conversation.name || 'Groupe sans nom'
    : conversation.participants_details
        ?.filter((p) => p.id !== conversation.created_by)
        .map((p) => p.full_name)
        .join(', ') || 'Conversation';

  // Get last message preview
  const lastMessagePreview = conversation.last_message
    ? conversation.last_message.body.length > 50
      ? conversation.last_message.body.substring(0, 50) + '...'
      : conversation.last_message.body
    : 'Aucun message';

  const lastMessageTime = conversation.last_message
    ? formatDistanceToNow(new Date(conversation.last_message.created_at), {
        addSuffix: true,
        locale: fr,
      })
    : '';

  return (
    <li>
      <button
        onClick={onClick}
        className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
          isSelected ? 'bg-blue-50' : ''
        }`}
      >
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div
            className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
              isGroup ? 'bg-purple-100' : 'bg-blue-100'
            }`}
          >
            {isGroup ? (
              <Users className="h-5 w-5 text-purple-600" />
            ) : (
              <User className="h-5 w-5 text-blue-600" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p
                className={`text-sm truncate ${
                  hasUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'
                }`}
              >
                {displayName}
              </p>
              {lastMessageTime && (
                <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                  {lastMessageTime}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between mt-0.5">
              <p
                className={`text-sm truncate ${
                  hasUnread ? 'text-gray-900' : 'text-gray-500'
                }`}
              >
                {lastMessagePreview}
              </p>
              {hasUnread && (
                <span className="flex-shrink-0 ml-2 w-5 h-5 bg-blue-600 text-white text-xs font-medium rounded-full flex items-center justify-center">
                  {conversation.unread_count! > 9 ? '9+' : conversation.unread_count}
                </span>
              )}
            </div>
          </div>
        </div>
      </button>
    </li>
  );
}

export default ConversationList;
