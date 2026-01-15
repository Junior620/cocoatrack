'use client';

// CocoaTrack V2 - User Management Page
// Admin-only page for managing users
// Requirements: 1.1, 4.3, 4.4

import { useEffect, useState, useCallback } from 'react';

import { ProtectedRoute } from '@/components/auth';
import { UserCreationForm } from '@/components/admin';
import { ROLE_DISPLAY_NAMES, getRoleDisplayName } from '@/lib/auth';
import { createClient } from '@/lib/supabase/client';

import type { Cooperative, Profile, UserRole } from '@/types/database.gen';

// Force dynamic rendering to avoid prerendering with missing env vars
export const dynamic = 'force-dynamic';

export default function UsersPage() {
  return (
    <ProtectedRoute requiredRoles={['admin']}>
      <UsersContent />
    </ProtectedRoute>
  );
}

// Success message type
interface SuccessMessage {
  email: string;
  emailSent: boolean;
}

function UsersContent() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [cooperatives, setCooperatives] = useState<Cooperative[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState<SuccessMessage | null>(null);

  const supabase = createClient();

  // Fetch users and cooperatives
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [usersResult, coopsResult] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('cooperatives').select('*').order('name'),
      ]);

      if (usersResult.error) throw usersResult.error;
      if (coopsResult.error) throw coopsResult.error;

      setUsers(usersResult.data || []);
      setCooperatives(coopsResult.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Update user role or cooperative
  const handleUpdateUser = async (userId: string, updates: Partial<Profile>) => {
    try {
      const { error } = await (supabase
        .from('profiles') as unknown as {
          update: (data: Partial<Profile>) => { eq: (col: string, val: string) => Promise<{ error: Error | null }> }
        })
        .update(updates)
        .eq('id', userId);

      if (error) throw error;

      // Update local state
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...updates } : u)));
      setEditingUser(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la mise à jour');
    }
  };

  // Handle successful user creation - Requirement 4.3, 4.4
  const handleUserCreated = async (user: { id: string; email: string; full_name: string; role: string }) => {
    // Close the modal
    setShowCreateModal(false);
    
    // Show success message with email info - Requirement 4.3
    setSuccessMessage({
      email: user.email,
      emailSent: true, // The API always attempts to send the email
    });
    
    // Auto-hide success message after 8 seconds
    setTimeout(() => {
      setSuccessMessage(null);
    }, 8000);
    
    // Refresh the user list - Requirement 4.4
    await fetchData();
  };

  // Dismiss success message
  const dismissSuccessMessage = () => {
    setSuccessMessage(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Create Button - Requirement 1.1 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des utilisateurs</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gérez les rôles et les coopératives des utilisateurs
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
        >
          <svg
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
          </svg>
          Créer un utilisateur
        </button>
      </div>

      {/* Success Message - Requirement 4.3 */}
      {successMessage && (
        <div className="rounded-md bg-green-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-green-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium text-green-800">
                Utilisateur créé avec succès !
              </p>
              <p className="mt-1 text-sm text-green-700">
                Un email d&apos;invitation a été envoyé à{' '}
                <strong>{successMessage.email}</strong> pour définir son mot de passe.
              </p>
            </div>
            <div className="ml-auto pl-3">
              <button
                onClick={dismissSuccessMessage}
                className="inline-flex rounded-md bg-green-50 p-1.5 text-green-500 hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2 focus:ring-offset-green-50"
              >
                <span className="sr-only">Fermer</span>
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Users Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Utilisateur
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Rôle
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Coopérative
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Statut
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="whitespace-nowrap px-6 py-4">
                  <div>
                    <div className="font-medium text-gray-900">{user.full_name}</div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  {editingUser?.id === user.id ? (
                    <select
                      value={editingUser.role}
                      onChange={(e) =>
                        setEditingUser({ ...editingUser, role: e.target.value as UserRole })
                      }
                      className="rounded-md border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500"
                    >
                      {Object.entries(ROLE_DISPLAY_NAMES).map(([role, name]) => (
                        <option key={role} value={role}>
                          {name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800">
                      {getRoleDisplayName(user.role)}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  {editingUser?.id === user.id ? (
                    <select
                      value={editingUser.cooperative_id || ''}
                      onChange={(e) =>
                        setEditingUser({
                          ...editingUser,
                          cooperative_id: e.target.value || null,
                        })
                      }
                      className="rounded-md border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500"
                    >
                      <option value="">Aucune (Admin)</option>
                      {cooperatives.map((coop) => (
                        <option key={coop.id} value={coop.id}>
                          {coop.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-sm text-gray-900">
                      {user.cooperative_id
                        ? cooperatives.find((c) => c.id === user.cooperative_id)?.name || '-'
                        : 'Toutes'}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                      user.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {user.is_active ? 'Actif' : 'Inactif'}
                  </span>
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                  {editingUser?.id === user.id ? (
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() =>
                          handleUpdateUser(user.id, {
                            role: editingUser.role,
                            cooperative_id: editingUser.cooperative_id,
                          })
                        }
                        className="text-primary-600 hover:text-primary-900"
                      >
                        Enregistrer
                      </button>
                      <button
                        onClick={() => setEditingUser(null)}
                        className="text-gray-600 hover:text-gray-900"
                      >
                        Annuler
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setEditingUser(user)}
                      className="text-primary-600 hover:text-primary-900"
                    >
                      Modifier
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {users.length === 0 && (
          <div className="py-12 text-center text-gray-500">Aucun utilisateur trouvé</div>
        )}
      </div>

      {/* User Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => setShowCreateModal(false)}
            />

            {/* Modal Panel */}
            <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Créer un utilisateur
                </h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                >
                  <span className="sr-only">Fermer</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <UserCreationForm
                onSuccess={handleUserCreated}
                onCancel={() => setShowCreateModal(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
