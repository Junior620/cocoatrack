'use client';

// CocoaTrack V2 - Forgot Password Page
// Allows users to request a password reset email

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Une erreur est survenue');
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-b from-[#234D1E] to-[#1a3a16]">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-2xl p-8 lg:p-10">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Email envoyé !</h2>
              <p className="text-gray-600">
                Si un compte existe avec l&apos;adresse <strong>{email}</strong>, vous recevrez un email avec les instructions pour réinitialiser votre mot de passe.
              </p>
            </div>

            <div className="space-y-4">
              <Link
                href="/login"
                className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-[#234D1E] text-white font-semibold hover:bg-[#1a3a16] transition-all"
              >
                <ArrowLeft className="h-5 w-5" />
                Retour à la connexion
              </Link>

              <p className="text-center text-sm text-gray-500">
                Vous n&apos;avez pas reçu l&apos;email ? Vérifiez vos spams ou contactez votre administrateur.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
            <h2 className="text-3xl font-bold text-gray-900">Mot de passe oublié</h2>
            <p className="text-gray-500 mt-2">
              Entrez votre email pour recevoir un lien de réinitialisation
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-4">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="flex items-center gap-2 text-base font-medium text-gray-700 mb-2">
                <Mail className="h-5 w-5 text-[#234D1E]" />
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3.5 text-base rounded-xl border-2 border-[#234D1E] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#234D1E]/30 transition-all"
                placeholder="votre.email@cooperative.com"
                disabled={isSubmitting}
              />
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
                  Envoi en cours...
                </>
              ) : (
                <>
                  Envoyer le lien
                  <Mail className="h-5 w-5" />
                </>
              )}
            </button>

            {/* Back to login */}
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 text-[#234D1E] hover:text-[#1a3a16] font-medium transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour à la connexion
            </Link>
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
