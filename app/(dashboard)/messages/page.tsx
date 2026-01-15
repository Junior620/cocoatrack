// CocoaTrack V2 - Messages Page
// Full messaging interface with conversation list and message thread

'use client';

import { useState } from 'react';
import { Metadata } from 'next';

import {
  ConversationList,
  MessageThread,
  NewConversationModal,
} from '@/components/messaging';

export default function MessagesPage() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [showNewConversation, setShowNewConversation] = useState(false);

  const handleConversationSelect = (conversationId: string) => {
    setSelectedConversationId(conversationId);
  };

  const handleConversationCreated = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    setShowNewConversation(false);
  };

  const handleBack = () => {
    setSelectedConversationId(null);
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      {/* Conversation List - hidden on mobile when conversation is selected */}
      <div
        className={`w-full lg:w-80 xl:w-96 flex-shrink-0 ${
          selectedConversationId ? 'hidden lg:block' : 'block'
        }`}
      >
        <ConversationList
          selectedId={selectedConversationId || undefined}
          onSelect={handleConversationSelect}
          onNewConversation={() => setShowNewConversation(true)}
        />
      </div>

      {/* Message Thread */}
      <div
        className={`flex-1 ${
          selectedConversationId ? 'block' : 'hidden lg:block'
        }`}
      >
        {selectedConversationId ? (
          <MessageThread
            conversationId={selectedConversationId}
            onBack={handleBack}
          />
        ) : (
          <div className="h-full flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <p className="text-gray-500">
                Sélectionnez une conversation pour commencer
              </p>
            </div>
          </div>
        )}
      </div>

      {/* New Conversation Modal */}
      <NewConversationModal
        isOpen={showNewConversation}
        onClose={() => setShowNewConversation(false)}
        onConversationCreated={handleConversationCreated}
      />
    </div>
  );
}
