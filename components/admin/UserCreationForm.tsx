'use client';

// CocoaTrack V2 - User Creation Form Component
// Form for admins to create new users with role assignment
// Requirements: 1.2, 2.1, 2.2, 2.3, 2.4

import { useState } from 'react';
import { z } from 'zod';
import {
  Mail,
  User,
  Phone,
  Shield,
  AlertTriangle,
  Info,
  Loader2,
  UserPlus,
  X,
} from 'lucide-react';

import {
  createUserSchema,
  USER_ROLES,
  ROLE_DESCRIPTIONS,
  type UserRole,
  type CreateUserInput,
} from '@/lib/validations/user';

interface UserCreationFormProps {
  onSuccess: (user: { id: string; email: string; full_name: string; role: string }) => void;
  onCancel: () => void;
}

interface FormErrors {
  email?: string;
  full_name?: string;
  role?: string;
  phone?: string;
  general?: string;
}

// Role display names in French
const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
  admin: 'Administrateur',
  manager: 'Gestionnaire',
  agent: 'Agent',
  viewer: 'Lecteur',
};

// Role colors for visual distinction
const ROLE_COLORS: Record<UserRole, { bg: string; text: string; border: string }> = {
  admin: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  manager: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  agent: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  viewer: { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' },
};

export function UserCreationForm({ onSuccess, onCancel }: UserCreationFormProps) {
  const [formData, setFormData] = useState<{
    email: string;
    full_name: string;
    role: UserRole;
    phone: string;
  }>({
    email: '',
    full_name: '',
    role: 'manager', // Default role as per Requirement 2.3
    phone: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAdminConfirmation, setShowAdminConfirmation] = useState(false);

  // Handle input changes
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error for this field when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  // Validate form data
  const validateForm = (): boolean => {
    try {
      createUserSchema.parse({
        email: formData.email,
        full_name: formData.full_name,
        role: formData.role,
        phone: formData.phone || undefined,
      });
      setErrors({});
      return true;
    } catch (err) {
      if (err instanceof z.ZodError) {
        const newErrors: FormErrors = {};
        err.errors.forEach((error) => {
          const field = error.path[0] as keyof FormErrors;
          newErrors[field] = error.message;
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form
    if (!validateForm()) {
      return;
    }

    // Require confirmation for admin role (Requirement 2.4)
    if (formData.role === 'admin' && !showAdminConfirmation) {
      setShowAdminConfirmation(true);
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email.trim().toLowerCase(),
          full_name: formData.full_name.trim(),
          role: formData.role,
          phone: formData.phone.trim() || null,
        } satisfies CreateUserInput),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle specific error cases
        if (response.status === 409) {
          setErrors({ email: 'Cet email est déjà utilisé' });
        } else if (response.status === 403) {
          setErrors({ general: 'Accès non autorisé' });
        } else {
          setErrors({ general: data.error || 'Erreur lors de la création' });
        }
        return;
      }

      // Success - call the callback
      onSuccess(data.user);
    } catch {
      setErrors({ general: 'Erreur de connexion au serveur' });
    } finally {
      setIsSubmitting(false);
      setShowAdminConfirmation(false);
    }
  };

  // Cancel admin confirmation
  const handleCancelAdminConfirmation = () => {
    setShowAdminConfirmation(false);
  };

  const roleColors = ROLE_COLORS[formData.role];

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* General Error */}
      {errors.general && (
        <div className="flex items-center gap-3 rounded-lg bg-red-50 border border-red-200 p-4">
          <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{errors.general}</p>
        </div>
      )}

      {/* Admin Confirmation Dialog */}
      {showAdminConfirmation && (
        <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4">
          <div className="flex gap-3">
            <AlertTriangle className="h-6 w-6 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-amber-800">
                Confirmation requise
              </h3>
              <p className="mt-2 text-sm text-amber-700">
                Vous êtes sur le point de créer un utilisateur avec le rôle{' '}
                <strong>Administrateur</strong>. Ce rôle donne un accès complet à
                toutes les fonctionnalités du système.
              </p>
              <div className="mt-4 flex gap-3">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-500 transition-colors"
                >
                  <Shield className="h-4 w-4" />
                  Confirmer
                </button>
                <button
                  type="button"
                  onClick={handleCancelAdminConfirmation}
                  className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors"
                >
                  <X className="h-4 w-4" />
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Email Field */}
      <div className="space-y-1.5">
        <label
          htmlFor="email"
          className="flex items-center gap-2 text-sm font-medium text-gray-700"
        >
          <Mail className="h-4 w-4 text-gray-400" />
          Email <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          id="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          className={`block w-full rounded-lg px-4 py-2.5 text-sm shadow-sm transition-colors ${
            errors.email
              ? 'border-2 border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-500'
              : 'border border-gray-300 bg-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500'
          }`}
          placeholder="utilisateur@exemple.com"
          disabled={isSubmitting}
          required
        />
        {errors.email && (
          <p className="flex items-center gap-1.5 text-sm text-red-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            {errors.email}
          </p>
        )}
      </div>

      {/* Full Name Field */}
      <div className="space-y-1.5">
        <label
          htmlFor="full_name"
          className="flex items-center gap-2 text-sm font-medium text-gray-700"
        >
          <User className="h-4 w-4 text-gray-400" />
          Nom complet <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="full_name"
          name="full_name"
          value={formData.full_name}
          onChange={handleChange}
          className={`block w-full rounded-lg px-4 py-2.5 text-sm shadow-sm transition-colors ${
            errors.full_name
              ? 'border-2 border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-500'
              : 'border border-gray-300 bg-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500'
          }`}
          placeholder="Jean Dupont"
          disabled={isSubmitting}
          required
        />
        {errors.full_name && (
          <p className="flex items-center gap-1.5 text-sm text-red-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            {errors.full_name}
          </p>
        )}
      </div>

      {/* Role Selection - Requirement 2.1, 2.2 */}
      <div className="space-y-1.5">
        <label
          htmlFor="role"
          className="flex items-center gap-2 text-sm font-medium text-gray-700"
        >
          <Shield className="h-4 w-4 text-gray-400" />
          Rôle <span className="text-red-500">*</span>
        </label>
        <select
          id="role"
          name="role"
          value={formData.role}
          onChange={handleChange}
          className={`block w-full rounded-lg px-4 py-2.5 text-sm shadow-sm transition-colors border border-gray-300 bg-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500 ${
            errors.role ? 'border-2 border-red-300 bg-red-50' : ''
          }`}
          disabled={isSubmitting}
        >
          {USER_ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_DISPLAY_NAMES[role]}
            </option>
          ))}
        </select>
        {errors.role && (
          <p className="flex items-center gap-1.5 text-sm text-red-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            {errors.role}
          </p>
        )}
        {/* Role Description - Requirement 2.2 */}
        <div className={`mt-2 rounded-lg border px-3 py-2 ${roleColors.bg} ${roleColors.border}`}>
          <p className={`text-sm ${roleColors.text}`}>
            {ROLE_DESCRIPTIONS[formData.role]}
          </p>
        </div>
      </div>

      {/* Phone Field (Optional) */}
      <div className="space-y-1.5">
        <label
          htmlFor="phone"
          className="flex items-center gap-2 text-sm font-medium text-gray-700"
        >
          <Phone className="h-4 w-4 text-gray-400" />
          Téléphone <span className="text-gray-400 font-normal">(optionnel)</span>
        </label>
        <input
          type="tel"
          id="phone"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          className={`block w-full rounded-lg px-4 py-2.5 text-sm shadow-sm transition-colors ${
            errors.phone
              ? 'border-2 border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-500'
              : 'border border-gray-300 bg-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500'
          }`}
          placeholder="+237 6XX XXX XXX"
          disabled={isSubmitting}
        />
        {errors.phone && (
          <p className="flex items-center gap-1.5 text-sm text-red-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            {errors.phone}
          </p>
        )}
        <p className="text-xs text-gray-400">
          Format: +237XXXXXXXXX ou 6XXXXXXXX
        </p>
      </div>

      {/* Note about internal users - Requirement 3.1, 3.2 */}
      <div className="flex gap-3 rounded-lg bg-blue-50 border border-blue-200 p-4">
        <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700">
          Les utilisateurs internes (admin, gestionnaire, agent, lecteur) ne
          sont pas liés à une coopérative spécifique et peuvent accéder aux
          données selon leurs permissions.
        </p>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors"
          disabled={isSubmitting}
        >
          Annuler
        </button>
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:opacity-50 transition-colors"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Création...
            </>
          ) : (
            <>
              <UserPlus className="h-4 w-4" />
              Créer l&apos;utilisateur
            </>
          )}
        </button>
      </div>
    </form>
  );
}

export default UserCreationForm;
