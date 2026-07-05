'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  PackageOpen,
  ClipboardCheck,
  Warehouse,
  Cog,
  FlaskConical,
  Boxes,
  GitBranch,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';

import { useAuth, hasPermission, type Permission } from '@/lib/auth';

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  permission?: Permission;
}

const navItems: NavItem[] = [
  { name: 'Tableau de bord', href: '/factory', icon: <LayoutDashboard className="h-5 w-5" /> },
  {
    name: 'Réceptions',
    href: '/factory/receipts',
    icon: <PackageOpen className="h-5 w-5" />,
    permission: 'factory:receipts:read',
  },
  {
    name: 'Qualité',
    href: '/factory/quality',
    icon: <ClipboardCheck className="h-5 w-5" />,
    permission: 'factory:quality:read',
  },
  {
    name: 'Stock fèves',
    href: '/factory/stocks',
    icon: <Warehouse className="h-5 w-5" />,
    permission: 'factory:stock:read',
  },
  {
    name: 'Ordres',
    href: '/factory/orders',
    icon: <Cog className="h-5 w-5" />,
    permission: 'factory:orders:read',
  },
  {
    name: 'Produits finis',
    href: '/factory/products',
    icon: <Boxes className="h-5 w-5" />,
    permission: 'factory:stock:read',
  },
  {
    name: 'Traçabilité',
    href: '/factory/traceability',
    icon: <GitBranch className="h-5 w-5" />,
    permission: 'factory:traceability:read',
  },
  {
    name: 'Rapports',
    href: '/factory/reports',
    icon: <BarChart3 className="h-5 w-5" />,
    permission: 'factory:reports:read',
  },
  {
    name: 'Paramètres',
    href: '/factory/settings',
    icon: <Settings className="h-5 w-5" />,
    permission: 'factory:settings:read',
  },
];

export function FactoryNav() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleItems = navItems.filter(
    (item) => !item.permission || (user && hasPermission(user.role, item.permission))
  );

  const isActive = (href: string) => {
    if (href === '/factory') return pathname === '/factory';
    return pathname.startsWith(href);
  };

  const NavLinks = () => (
    <>
      {visibleItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => setMobileOpen(false)}
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
            isActive(item.href)
              ? 'bg-[#5C4033] text-white'
              : 'text-[#3d2b1f] hover:bg-[#f5ebe0]'
          }`}
        >
          {item.icon}
          {item.name}
        </Link>
      ))}
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-[#d4c4b0] lg:bg-[#faf6f1]">
        <div className="flex h-16 items-center gap-2 border-b border-[#d4c4b0] px-4">
          <FlaskConical className="h-7 w-7 text-[#5C4033]" />
          <div>
            <p className="text-sm font-bold text-[#5C4033]">CocoaTrack</p>
            <p className="text-xs text-[#8B6914]">Transformation</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          <NavLinks />
        </nav>
        <div className="border-t border-[#d4c4b0] p-4">
          <Link
            href="/dashboard"
            className="mb-2 block text-xs text-[#8B6914] hover:underline"
          >
            ← Module traçabilité
          </Link>
          <button
            type="button"
            onClick={() => signOut()}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#5C4033] hover:bg-[#f5ebe0]"
          >
            <LogOut className="h-4 w-4" />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="flex items-center justify-between border-b border-[#d4c4b0] bg-[#faf6f1] px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-6 w-6 text-[#5C4033]" />
          <span className="font-bold text-[#5C4033]">Transformation</span>
        </div>
        <button type="button" onClick={() => setMobileOpen(!mobileOpen)} className="p-2">
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)}>
          <nav
            className="absolute left-0 top-0 h-full w-72 bg-[#faf6f1] p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <NavLinks />
          </nav>
        </div>
      )}
    </>
  );
}
