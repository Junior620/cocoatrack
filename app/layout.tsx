import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';

import { Providers } from './providers';
import { WebVitalsReporter } from '@/components/analytics/WebVitals';
import { getUserProfile } from '@/lib/supabase/server';

import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  preload: true,
});

export const metadata: Metadata = {
  title: {
    default: 'CocoaTrack V2',
    template: '%s | CocoaTrack V2',
  },
  description: 'Application de suivi des achats de cacao - Version 2',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'CocoaTrack',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#1f2937' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Fetch profile server-side so AuthProvider starts with data immediately
  // This eliminates the full-screen loading spinner on every page load
  const initialProfile = await getUserProfile().catch(() => null);

  return (
    <html lang="fr" className={inter.variable}>
      <body className="min-h-screen bg-gray-50 font-sans antialiased">
        <Providers initialProfile={initialProfile}>
          {children}
        </Providers>
        <WebVitalsReporter />
      </body>
    </html>
  );
}
