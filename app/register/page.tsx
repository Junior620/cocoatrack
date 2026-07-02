// CocoaTrack V2 - Register Page (Disabled)
// Public registration is disabled - only admins can create accounts

import Link from 'next/link';
import Image from 'next/image';
import { ShieldAlert, ArrowRight, UserPlus } from 'lucide-react';

export default function RegisterPage() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background image */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "url('/cocoa-auth-bg.jpg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />
      <div className="absolute inset-0 bg-black/45" />
      <div className="pointer-events-none absolute -top-28 -right-24 h-80 w-80 rounded-full bg-white/12 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-black/10 blur-3xl" />
      
      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-5 sm:p-6">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-6">
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

          {/* Card */}
          <div className="bg-white/95 rounded-3xl shadow-2xl p-6 sm:p-8 backdrop-blur-sm border border-white/40">
            <div className="text-center">
              {/* Icon */}
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShieldAlert className="h-8 w-8 text-amber-600" />
              </div>
              
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Inscription désactivée
              </h2>
              
              <p className="text-gray-600 mb-6">
                L&apos;inscription publique n&apos;est pas disponible sur cette application.
                Seuls les administrateurs peuvent créer de nouveaux comptes.
              </p>
              
              {/* Info box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
                <div className="flex items-start gap-3">
                  <UserPlus className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">
                      Besoin d&apos;un compte ?
                    </p>
                    <p className="text-sm text-blue-700 mt-1">
                      Contactez l&apos;administrateur de votre coopérative pour qu&apos;il 
                      crée votre compte utilisateur.
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Login button */}
              <Link
                href="/login"
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-[#234D1E] text-white font-semibold hover:bg-[#1a3a16] transition-all shadow-lg shadow-[#234D1E]/30"
              >
                Aller à la connexion
                <ArrowRight className="h-5 w-5" />
              </Link>
              
              {/* Already have account */}
              <p className="text-center text-sm text-gray-500 mt-4">
                Vous avez déjà un compte ?{' '}
                <Link href="/login" className="font-semibold text-[#234D1E] hover:underline">
                  Connectez-vous
                </Link>
              </p>
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-white/70 text-sm mt-6">
            © 2024 CocoaTrack. Tous droits réservés.
          </p>
        </div>
      </div>
    </div>
  );
}
