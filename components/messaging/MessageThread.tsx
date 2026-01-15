// CocoaTrack V2 - Message Thread Component
// Displays messages in a conversation with input for sending new messages

'use client';

import { useEffect, useRef, useState } from 'react';
import { Send, Users, User, ArrowLeft, MoreVertical } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';

import { useMessages } from '@/lib/hooks/useMessaging';
import { useAuth } from '@/lib/auth';
import type { MessageWithSender } from '@/lib/api/messaging';

interface MessageThreadProps {
  conversationId: string;
  onBack?: () => void;
}

export function MessageThread({ conversationId, onBack }: MessageThreadProps) {
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { user } = useAuth();
  const {
    messages,
    conversation,
    isLoading,
    error,
    send,
    markAsRead,
    loadMore,
    totalPages,
    page,
  } = useMessages({ conversationId });

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Mark as read when viewing
  useEffect(() => {
    if (conversationId) {
      markAsRead();
    }
  }, [conversationId, markAsRead]);

  // Handle send message
  const handleSend = async () => {
    if (!newMessage.trim() || isSending) return;

    setIsSending(true);
    try {
      await send(newMessage.trim());
      setNewMessage('');
      inputRef.current?.focus();
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setIsSending(false);
    }
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Get conversation display info
  const isGroup = conversation?.type === 'group';
  const displayName = isGroup
    ? conversation?.name || 'Groupe'
    : conversation?.participants_details
        ?.filter((p) => p.id !== user?.id)
        .map((p) => p.full_name)
        .join(', ') || 'Conversation';

  const participantCount = conversation?.participants?.length || 0;

  if (!conversationId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">Sélectionnez une conversation</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white">
        {onBack && (
          <button
            onClick={onBack}
            className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full lg:hidden"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center ${
            isGroup ? 'bg-purple-100' : 'bg-blue-100'
          }`}
        >
          {isGroup ? (
            <Users className="h-5 w-5 text-purple-600" />
          ) : (
            <User className="h-5 w-5 text-blue-600" />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{displayName}</h3>
          <p className="text-xs text-gray-500">
            {isGroup ? `${participantCount} participants` : 'Conversation directe'}
          </p>
        </div>
        
        <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-full">
          <MoreVertical className="h-5 w-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Load more button */}
        {page < totalPages && (
          <div className="text-center">
            <button
              onClick={loadMore}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Charger les messages précédents
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="text-center text-gray-500">
            <div className="animate-pulse">Chargement...</div>
          </div>
        ) : error ? (
          <div className="text-center text-red-500">
            Erreur lors du chargement des messages
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>Aucun message</p>
            <p className="text-sm mt-1">Envoyez le premier message!</p>
          </div>
        ) : (
          // Reverse to show oldest first
          [...messages].reverse().map((message, index, arr) => {
            const prevMessage = arr[index - 1];
            const showDateSeparator = shouldShowDateSeparator(
              message,
              prevMessage
            );
            const showSender =
              isGroup && message.sender_id !== user?.id && shouldShowSender(message, prevMessage);

            return (
              <div key={message.id}>
                {showDateSeparator && (
                  <DateSeparator date={new Date(message.created_at)} />
                )}
                <MessageBubble
                  message={message}
                  isOwn={message.sender_id === user?.id}
                  showSender={showSender}
                />
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 bg-white">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Écrivez un message..."
            rows={1}
            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            style={{ maxHeight: '120px' }}
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || isSending}
            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

interface MessageBubbleProps {
  message: MessageWithSender;
  isOwn: boolean;
  showSender: boolean;
}

function MessageBubble({ message, isOwn, showSender }: MessageBubbleProps) {
  const time = format(new Date(message.created_at), 'HH:mm', { locale: fr });

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] ${
          isOwn ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'
        } rounded-2xl px-4 py-2`}
      >
        {showSender && (
          <p className="text-xs font-medium mb-1 opacity-75">
            {message.sender?.full_name || 'Utilisateur'}
          </p>
        )}
        <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>
        <p
          className={`text-xs mt-1 ${
            isOwn ? 'text-blue-200' : 'text-gray-400'
          }`}
        >
          {time}
        </p>
      </div>
    </div>
  );
}

function DateSeparator({ date }: { date: Date }) {
  let label: string;
  if (isToday(date)) {
    label = "Aujourd'hui";
  } else if (isYesterday(date)) {
    label = 'Hier';
  } else {
    label = format(date, 'EEEE d MMMM', { locale: fr });
  }

  return (
    <div className="flex items-center justify-center my-4">
      <span className="px-3 py-1 text-xs text-gray-500 bg-gray-100 rounded-full">
        {label}
      </span>
    </div>
  );
}

function shouldShowDateSeparator(
  current: MessageWithSender,
  previous?: MessageWithSender
): boolean {
  if (!previous) return true;
  const currentDate = new Date(current.created_at).toDateString();
  const previousDate = new Date(previous.created_at).toDateString();
  return currentDate !== previousDate;
}

function shouldShowSender(
  current: MessageWithSender,
  previous?: MessageWithSender
): boolean {
  if (!previous) return true;
  return current.sender_id !== previous.sender_id;
}

export default MessageThread;
