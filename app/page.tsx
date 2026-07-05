'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import HeroVideo from '@/components/HeroVideo';
import { useAuth } from '@/lib/auth';
import {
  getDefaultRouteForModule,
  setModuleCookie,
  type CocoaTrackModule,
} from '@/lib/utils/cocoatrack-module';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      if (accessToken) {
        router.push(`/auth/callback${window.location.hash}`);
      }
    }
  }, [router]);

  const moduleHref = (module: CocoaTrackModule) =>
    isAuthenticated ? getDefaultRouteForModule(module) : `/login?module=${module}`;

  const handleChoose = (module: CocoaTrackModule) => {
    setModuleCookie(module);
  };

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[#121810]">
      <HeroVideo />
      <div className="absolute inset-0 bg-[#0a0f0a]/70" />

      <nav className="relative z-10 flex items-center px-6 py-6 md:px-10">
        <div className="flex items-center gap-2.5">
          <img src="/logo-scpb.png" alt="CocoaTrack" className="h-9 w-auto opacity-95 md:h-10" />
          <span className="text-base font-medium tracking-tight text-white/95 md:text-lg">CocoaTrack</span>
        </div>
      </nav>

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-80px)] max-w-2xl flex-col items-center justify-center px-6 pb-16 text-center md:px-10">
        <p className="mb-5 text-[11px] font-normal uppercase tracking-[0.2em] text-white/45">
          Plateforme filière cacao
        </p>

        <h1 className="text-[1.75rem] font-semibold leading-snug tracking-tight text-white/95 md:text-4xl">
          De la fève au <span className="text-[#C9822B]">produit fini</span>
        </h1>

        <p className="mt-4 max-w-md text-sm font-normal leading-relaxed text-white/60 md:text-[15px]">
          Suivez l&apos;origine du cacao, son acheminement et sa transformation jusqu&apos;aux produits
          dérivés.
        </p>

        <div className="mt-7 flex w-full flex-col items-center gap-2.5 sm:flex-row sm:justify-center sm:gap-3">
          <ModuleCta
            href={moduleHref('traceability')}
            onChoose={() => handleChoose('traceability')}
            label="Traçabilité amont"
            variant="traceability"
          />
          <ModuleCta
            href={moduleHref('factory')}
            onChoose={() => handleChoose('factory')}
            label="Transformation usine"
            variant="factory"
          />
        </div>
      </div>
    </main>
  );
}

function ModuleCta({
  href,
  onChoose,
  label,
  variant,
}: {
  href: string;
  onChoose: () => void;
  label: string;
  variant: 'traceability' | 'factory';
}) {
  const isTrace = variant === 'traceability';

  return (
    <Link
      href={href}
      onClick={onChoose}
      className={`group inline-flex items-center gap-2 rounded-md border px-4 py-2.5 text-[13px] font-medium text-white/95 transition-colors duration-150 ${
        isTrace
          ? 'border-[#2d4a28]/80 bg-[#1e3620] hover:border-[#3d5c38] hover:bg-[#243f28]'
          : 'border-[#4a3728]/80 bg-[#3d2e24] hover:border-[#5c4536] hover:bg-[#4a3728]'
      }`}
    >
      {label}
      <ArrowRight className="h-3.5 w-3.5 text-white/40 transition-transform group-hover:translate-x-0.5 group-hover:text-white/70" />
    </Link>
  );
}
