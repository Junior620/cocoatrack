'use client';

// CocoaTrack V2 - Login Page
// Design équilibré 50/50

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import Image from 'next/image';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Shield, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

import { useAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);

  const redirectTo = searchParams.get('redirectTo') || '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const { error } = await signIn(email, password);

    if (error) {
      setError(getErrorMessage(error));
      setIsSubmitting(false);
      return;
    }

    router.push(redirectTo);
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4" role="alert" aria-live="polite">
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
          autoComplete="email"
          inputMode="email"
          autoFocus
          className="w-full px-4 py-3.5 text-base rounded-xl border-2 border-[#234D1E] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#234D1E]/30 transition-all"
          placeholder="votre.email@cooperative.com"
          disabled={isSubmitting}
        />
      </div>

      {/* Password */}
      <div>
        <label className="flex items-center gap-2 text-base font-medium text-gray-700 mb-2">
          <Lock className="h-5 w-5 text-[#E68A1F]" />
          Mot de passe <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyUp={(e) => setIsCapsLockOn(e.getModifierState('CapsLock'))}
            autoComplete="current-password"
            className="w-full px-4 py-3.5 pr-12 text-base rounded-xl border-2 border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#234D1E] focus:ring-2 focus:ring-[#234D1E]/30 transition-all"
            placeholder="••••••••"
            disabled={isSubmitting}
          />
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-4 top-1/2 z-10 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors rounded-md p-1 focus:outline-none focus:ring-2 focus:ring-[#234D1E]/30"
            disabled={isSubmitting}
            aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            aria-pressed={showPassword}
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
        {isCapsLockOn && (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-amber-700" aria-live="polite">
            <AlertTriangle className="h-4 w-4" />
            Verr Maj est activée
          </p>
        )}
      </div>

      {/* Forgot Password Link */}
      <div className="text-right">
        <Link
          prefetch={false}
          href="/forgot-password"
          className="text-sm text-[#234D1E] hover:text-[#1a3a16] font-medium transition-colors"
        >
          Mot de passe oublié ?
        </Link>
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
            Connexion en cours...
          </>
        ) : (
          <>
            Se connecter
            <ArrowRight className="h-5 w-5" />
          </>
        )}
      </button>

      {/* Security badge */}
      <div className="flex items-center justify-center gap-2 text-sm text-gray-400 pt-2">
        <Shield className="h-4 w-4" />
        <span>Accès sécurisé</span>
      </div>

      {/* Divider */}
      <div className="relative py-2">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-4 text-sm text-gray-400">ou</span>
        </div>
      </div>

      {/* Account info */}
      <p className="text-center text-base text-gray-600">
        Besoin d&apos;un compte ? Contactez votre administrateur.
      </p>
    </form>
  );
}

function LoginFormFallback() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-20 bg-gray-100 rounded-xl" />
      <div className="h-20 bg-gray-100 rounded-xl" />
      <div className="h-14 bg-gray-200 rounded-xl" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <div
      className="relative min-h-screen flex overflow-hidden"
      style={{
        backgroundImage: "url('/cocoa-auth-bg.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-black/45" />

      <div className="relative z-10 w-full flex items-center justify-center p-5 sm:p-8">
        <div className="pointer-events-none absolute -top-28 -right-24 h-80 w-80 rounded-full bg-white/12 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-black/10 blur-3xl" />

        <div className="w-full max-w-xl">
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-4 mb-3">
              <Image
                src="/logo-afrexia.png"
                alt="Afrexia"
                width={68}
                height={68}
                className="object-contain"
              />
              <Image
                src="/logo-scpb.png"
                alt="SCPB"
                width={68}
                height={68}
                className="object-contain"
              />
            </div>
            <h1 className="text-3xl font-bold text-white">CocoaTrack</h1>
            <p className="text-white/80 mt-1">Gestion intelligente des livraisons de cacao</p>
          </div>

          {/* Form Card */}
          <div className="relative bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl p-6 sm:p-8 lg:p-10 border border-white/50 ring-1 ring-black/5">
            <div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Connexion</h2>
              <p className="text-gray-500 mt-2">Accédez à votre espace de gestion</p>
            </div>

            <Suspense fallback={<LoginFormFallback />}>
              <LoginForm />
            </Suspense>
          </div>

          <p className="text-center text-white/80 text-sm mt-6">
            © 2024 CocoaTrack. Tous droits réservés.
          </p>
        </div>
      </div>
    </div>
  );
}

function getErrorMessage(error: Error): string {
  const message = error.message.toLowerCase();
  if (message.includes('invalid login credentials')) return 'Email ou mot de passe incorrect';
  if (message.includes('email not confirmed')) return 'Veuillez confirmer votre email';
  if (message.includes('too many requests')) return 'Trop de tentatives. Réessayez plus tard';
  return 'Une erreur est survenue. Veuillez réessayer';
}
