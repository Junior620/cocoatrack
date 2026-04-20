'use client';

// CocoaTrack V2 - Dashboard Template
// Forces re-render on route changes to prevent blank pages

import { PageTransition } from '@/components/ui/PageTransition';

export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
