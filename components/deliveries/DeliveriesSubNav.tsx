'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/deliveries', label: 'Liste' },
  { href: '/deliveries/new', label: 'Nouvelle' },
  { href: '/deliveries/waybills', label: 'Lettres de voiture' },
  { href: '/deliveries/batch', label: 'Entrée multiple' },
];

export function DeliveriesSubNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2 border-b border-gray-200 pb-3">
      {tabs.map((tab) => {
        const active =
          tab.href === '/deliveries'
            ? pathname === '/deliveries'
            : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? 'bg-primary-100 text-primary-800'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
