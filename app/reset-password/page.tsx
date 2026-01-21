'use client';

// CocoaTrack V2 - Reset Password Page
// Allows users to set a new password after clicking the reset link

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);

  const supabase = createClient();

  useEffect(() => {
    // Check if we have a valid recovery session
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session) {
        setIsValidSession(false);
        setError('Le lien de réinitialisation est invalide ou a expiré. Veuillez demander un nouveau lien.');
      } else {
        setIsValidSession(true);
      }
    };

    checkSession();
  }, [supabase.auth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        throw updateError;
      }

      setSuccess(true);

      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (isValidSession === null) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-b from-[#234D1E] to-[#1a3a16]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent" />
      </div>
    );
  }

  // Invalid session
  if (isValidSession === false) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-b from-[#234D1E] to-[#1a3a16]">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-2xl p-8 lg:p-10">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Lien invalide</h2>
              <p className="text-gray-600 mb-6">
                {error || 'Le lien de réinitialisation est invalide ou a expiré.'}
              </p>
              <Link
                href="/forgot-password"
                className="inline-flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-[#234D1E] text-white font-semibold hover:bg-[#1a3a16] transition-all"
              >
                Demander un nouveau lien
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-b from-[#234D1E] to-[#1a3a16]">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-2xl p-8 lg:p-10">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Mot de passe modifié !</h2>
              <p className="text-gray-600">
                Votre mot de passe a été modifié avec succès. Vous allez être redirigé vers le tableau de bord...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Reset password form
  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-b from-[#234D1E] to-[#1a3a16]">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <Image
              src="/logo-afrexia.png"
              alt="Afrexia"
              width={56}
              height={56}
              className="object-contain"
            />
            <Image
              src="/logo-scpb.png"
              alt="SCPB"
              width={56}
              height={56}
              className="object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold text-white">CocoaTrack</h1>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 lg:p-10">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900">Nouveau mot de passe</h2>
            <p className="text-gray-500 mt-2">
              Choisissez un mot de passe sécurisé
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-4">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Password */}
            <div>
              <label className="flex items-center gap-2 text-base font-medium text-gray-700 mb-2">
                <Lock className="h-5 w-5 text-[#234D1E]" />
                Nouveau mot de passe <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3.5 pr-12 text-base rounded-xl border-2 border-[#234D1E] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#234D1E]/30 transition-all"
                  placeholder="••••••••"
                  disabled={isSubmitting}
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  disabled={isSubmitting}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <p className="mt-1 text-sm text-gray-500">Minimum 8 caractères</p>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="flex items-center gap-2 text-base font-medium text-gray-700 mb-2">
                <Lock className="h-5 w-5 text-[#E68A1F]" />
                Confirmer le mot de passe <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3.5 pr-12 text-base rounded-xl border-2 border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#234D1E] focus:ring-2 focus:ring-[#234D1E]/30 transition-all"
                  placeholder="••••••••"
                  disabled={isSubmitting}
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  disabled={isSubmitting}
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-4 px-6 text-lg rounded-xl bg-[#234D1E] text-white font-semibold hover:bg-[#1a3a16] disabled:cursor-not-allowed transition-all shadow-lg shadow-[#234D1E]/30"
            >
              {isSubmitting ? (
                <>
                  <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Modification en cours...
                </>
              ) : (
                <>
                  Modifier le mot de passe
                  <CheckCircle className="h-5 w-5" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-white/70 text-sm mt-6">
          © 2024 CocoaTrack. Tous droits réservés.
        </p>
      </div>
    </div>
  );
}
