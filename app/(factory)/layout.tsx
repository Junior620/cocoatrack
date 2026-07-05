'use client';

import { ProtectedRoute } from '@/components/auth';
import { FactoryNav } from '@/components/factory/FactoryNav';

export default function FactoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-gray-50">
        <FactoryNav />
        <main className="flex-1 overflow-auto">
          <div className="w-full px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">{children}</div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
