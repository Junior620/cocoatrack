// CocoaTrack V2 - New Conversation Modal
// Modal for starting a new conversation (direct or group)

'use client';

import { useState } from 'react';
import { X, Search, User, Users, Check, Loader2 } from 'lucide-react';

import { useMessageableUsers, useConversations } from '@/lib/hooks/useMessaging';
import type { Profile } from '@/types/database.gen';

interface NewConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConversationCreated: (conversationId: string) => void;
}

export function NewConversationModal({
  isOpen,
  onClose,
  onConversationCreated,
}: NewConversationModalProps) {
  const [mode, setMode] = useState<'direct' | 'group'>('direct');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: users = [], isLoading } = useMessageableUsers();
  const { startDirectConversation, startGroupConversation } = useConversations();

  // Filter users by search query
  const filteredUsers = users.filter((user) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.full_name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query)
    );
  });

  // Toggle user selection
  const toggleUser = (userId: string) => {
    if (mode === 'direct') {
      // Direct mode: select only one user and create conversation
      handleCreateDirect(userId);
    } else {
      // Group mode: toggle selection
      setSelectedUsers((prev) =>
        prev.includes(userId)
          ? prev.filter((id) => id !== userId)
          : [...prev, userId]
      );
    }
  };

  // Create direct conversation
  const handleCreateDirect = async (userId: string) => {
    setIsCreating(true);
    setError(null);
    try {
      const conversationId = await startDirectConversation(userId);
      onConversationCreated(conversationId);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création');
    } finally {
      setIsCreating(false);
    }
  };

  // Create group conversation
  const handleCreateGroup = async () => {
    if (selectedUsers.length < 2) {
      setError('Sélectionnez au moins 2 participants');
      return;
    }
    if (!groupName.trim()) {
      setError('Entrez un nom pour le groupe');
      return;
    }

    setIsCreating(true);
    setError(null);
    try {
      const conversationId = await startGroupConversation(
        groupName.trim(),
        selectedUsers
      );
      onConversationCreated(conversationId);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création');
    } finally {
      setIsCreating(false);
    }
  };

  // Reset and close
  const handleClose = () => {
    setMode('direct');
    setSearchQuery('');
    setSelectedUsers([]);
    setGroupName('');
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Nouvelle conversation
          </h2>
          <button
            onClick={handleClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mode selector */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => {
              setMode('direct');
              setSelectedUsers([]);
            }}
            className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 ${
              mode === 'direct'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <User className="h-4 w-4" />
            Direct
          </button>
          <button
            onClick={() => setMode('group')}
            className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 ${
              mode === 'group'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users className="h-4 w-4" />
            Groupe
          </button>
        </div>

        {/* Group name input */}
        {mode === 'group' && (
          <div className="px-4 py-3 border-b border-gray-200">
            <input
              type="text"
              placeholder="Nom du groupe"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Search */}
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher un utilisateur..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="px-4 py-2 bg-red-50 text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* User list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-gray-500">
              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {searchQuery ? 'Aucun résultat' : 'Aucun utilisateur disponible'}
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filteredUsers.map((user) => (
                <UserItem
                  key={user.id}
                  user={user}
                  isSelected={selectedUsers.includes(user.id)}
                  showCheckbox={mode === 'group'}
                  onClick={() => toggleUser(user.id)}
                  disabled={isCreating}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Footer (group mode only) */}
        {mode === 'group' && (
          <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">
                {selectedUsers.length} sélectionné(s)
              </span>
              <button
                onClick={handleCreateGroup}
                disabled={isCreating || selectedUsers.length < 2 || !groupName.trim()}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Création...
                  </>
                ) : (
                  'Créer le groupe'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface UserItemProps {
  user: Pick<Profile, 'id' | 'full_name' | 'email'>;
  isSelected: boolean;
  showCheckbox: boolean;
  onClick: () => void;
  disabled: boolean;
}

function UserItem({ user, isSelected, showCheckbox, onClick, disabled }: UserItemProps) {
  return (
    <li>
      <button
        onClick={onClick}
        disabled={disabled}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
          <User className="h-5 w-5 text-blue-600" />
        </div>

        {/* Info */}
        <div className="flex-1 text-left">
          <p className="font-medium text-gray-900">{user.full_name}</p>
          <p className="text-sm text-gray-500">{user.email}</p>
        </div>

        {/* Checkbox (group mode) */}
        {showCheckbox && (
          <div
            className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
              isSelected
                ? 'bg-blue-600 border-blue-600'
                : 'border-gray-300'
            }`}
          >
            {isSelected && <Check className="h-3 w-3 text-white" />}
          </div>
        )}
      </button>
    </li>
  );
}

export default NewConversationModal;
