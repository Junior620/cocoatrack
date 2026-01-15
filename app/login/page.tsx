'use client';

// CocoaTrack V2 - Login Page
// Design équilibré 50/50

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import Image from 'next/image';
import { Mail, Lock, Eye, EyeOff, BarChart3, Users, FileText, ArrowRight, Shield } from 'lucide-react';

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
            className="w-full px-4 py-3.5 pr-12 text-base rounded-xl border-2 border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#234D1E] focus:ring-2 focus:ring-[#234D1E]/30 transition-all"
            placeholder="••••••••"
            disabled={isSubmitting}
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
    <div className="min-h-screen flex">
      {/* Left Panel - Green (50%) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-b from-[#234D1E] via-[#1a3a16] to-[#234D1E] p-8">
        <div className="w-full max-w-lg mx-auto flex flex-col justify-between py-8">
          {/* Logo */}
          <div>
            <div className="flex items-center gap-4 mb-6">
              <Image
                src="/logo-afrexia.png"
                alt="Afrexia"
                width={64}
                height={64}
                className="object-contain"
              />
              <Image
                src="/logo-scpb.png"
                alt="SCPB"
                width={64}
                height={64}
                className="object-contain"
              />
            </div>
            <h1 className="text-4xl font-bold text-white mb-3">CocoaTrack</h1>
            <p className="text-white/70 text-lg">Gestion intelligente des livraisons de cacao</p>
          </div>

          {/* Features */}
          <div className="space-y-4 my-12">
            <FeatureCard 
              icon={BarChart3}
              title="Analytics en temps réel"
              description="Suivez vos livraisons et performances"
              stat="+12 000 livraisons"
            />
            <FeatureCard 
              icon={Users}
              title="Gestion complète"
              description="Planteurs, livraisons et qualité"
              stat="+250 coopératives"
            />
            <FeatureCard 
              icon={FileText}
              title="Exports professionnels"
              description="Excel et PDF en un clic"
            />
          </div>

          {/* Footer */}
          <p className="text-white/50 text-sm">© 2024 CocoaTrack. Tous droits réservés.</p>
        </div>
      </div>

      {/* Right Panel - Orange with Form (50%) */}
      <div 
        className="w-full lg:w-1/2 flex items-center justify-center p-8"
        style={{
          background: 'linear-gradient(135deg, #D4842A 0%, #C9761E 50%, #B8922A 100%)',
        }}
      >
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
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
              <h2 className="text-3xl font-bold text-gray-900">Connexion</h2>
              <p className="text-gray-500 mt-2">Accédez à votre espace de gestion</p>
            </div>

            <Suspense fallback={<LoginFormFallback />}>
              <LoginForm />
            </Suspense>
          </div>

          {/* Mobile Footer */}
          <p className="lg:hidden text-center text-white/70 text-sm mt-6">
            © 2024 CocoaTrack. Tous droits réservés.
          </p>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ 
  icon: Icon, 
  title, 
  description,
  stat 
}: { 
  icon: typeof BarChart3; 
  title: string; 
  description: string;
  stat?: string;
}) {
  return (
    <div className="flex items-center gap-4 bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/10">
      <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
        <Icon className="h-6 w-6 text-[#F2C94C]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-white font-semibold">{title}</h3>
          {stat && (
            <span className="text-[#F2C94C] text-sm font-medium whitespace-nowrap">{stat}</span>
          )}
        </div>
        <p className="text-white/60 text-sm">{description}</p>
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
