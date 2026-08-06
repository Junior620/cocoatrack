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
  GitBranch,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Truck,
  MapPinned,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { useAuth, hasPermission, type Permission } from '@/lib/auth';
import type { FactorySiteMode } from '@/types/mes';

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  permission?: Permission;
  /** primary = usinage primaire, industrial = MES, both = toujours */
  modes?: FactorySiteMode[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: 'Opérations',
    items: [
      { name: 'Tableau de bord', href: '/factory', icon: <LayoutDashboard className="h-5 w-5" /> },
      {
        name: 'Réceptions',
        href: '/factory/receipts',
        icon: <PackageOpen className="h-5 w-5" />,
        permission: 'factory:receipts:read',
        modes: ['primary', 'both'],
      },
      {
        name: 'Qualité',
        href: '/factory/quality',
        icon: <ClipboardCheck className="h-5 w-5" />,
        permission: 'factory:quality:read',
      },
      {
        name: 'Ordres',
        href: '/factory/orders',
        icon: <Cog className="h-5 w-5" />,
        permission: 'factory:orders:read',
        modes: ['primary', 'both'],
      },
      {
        name: 'Recettes',
        href: '/factory/recipes',
        icon: <FlaskConical className="h-5 w-5" />,
        permission: 'factory:orders:read',
        modes: ['industrial', 'both'],
      },
      {
        name: 'OF / MES',
        href: '/factory/production-orders',
        icon: <Cog className="h-5 w-5" />,
        permission: 'factory:orders:read',
        modes: ['industrial', 'both'],
      },
      {
        name: 'Cuves',
        href: '/factory/tanks',
        icon: <Warehouse className="h-5 w-5" />,
        permission: 'factory:stock:read',
        modes: ['industrial', 'both'],
      },
      {
        name: 'Libération',
        href: '/factory/releases',
        icon: <ClipboardCheck className="h-5 w-5" />,
        permission: 'factory:quality:read',
        modes: ['industrial', 'both'],
      },
      {
        name: 'Magasin / sacs',
        href: '/factory/wms',
        icon: <MapPinned className="h-5 w-5" />,
        permission: 'factory:stock:read',
      },
      {
        name: 'Expéditions',
        href: '/factory/dispatches',
        icon: <Truck className="h-5 w-5" />,
        permission: 'factory:stock:read',
      },
    ],
  },
  {
    label: 'Suivi',
    items: [
      {
        name: 'Stock',
        href: '/factory/stocks',
        icon: <Warehouse className="h-5 w-5" />,
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
    ],
  },
  {
    label: 'Admin',
    items: [
      {
        name: 'Paramètres',
        href: '/factory/settings',
        icon: <Settings className="h-5 w-5" />,
        permission: 'factory:settings:read',
      },
    ],
  },
];

function modeAllowed(itemModes: FactorySiteMode[] | undefined, siteMode: FactorySiteMode) {
  if (!itemModes) return true;
  if (siteMode === 'both') return true;
  return itemModes.includes(siteMode) || itemModes.includes('both');
}

export function FactoryNav() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [siteMode, setSiteMode] = useState<FactorySiteMode>('both');

  useEffect(() => {
    fetch('/api/factory/organization?view=site')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.site?.site_mode) setSiteMode(json.site.site_mode as FactorySiteMode);
      })
      .catch(() => undefined);
  }, []);

  const isActive = (href: string) => {
    if (href === '/factory') return pathname === '/factory';
    return pathname.startsWith(href);
  };

  const NavLinks = () => (
    <>
      {navGroups.map((group) => {
        const items = group.items.filter(
          (item) =>
            (!item.permission || (user && hasPermission(user.role, item.permission))) &&
            modeAllowed(item.modes, siteMode)
        );
        if (!items.length) return null;
        return (
          <div key={group.label} className="mb-4">
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-[#8B6914]">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? 'bg-[#5C4033] text-white'
                      : 'text-[#3d2b1f] hover:bg-[#f5ebe0]'
                  }`}
                >
                  {item.icon}
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );

  const subtitle =
    siteMode === 'industrial'
      ? 'Transformation industrielle'
      : siteMode === 'primary'
        ? 'Usinage primaire'
        : 'Usinage & MES';

  return (
    <>
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-[#d4c4b0] lg:bg-[#faf6f1] print:hidden">
        <div className="flex h-16 items-center gap-2 border-b border-[#d4c4b0] px-4">
          <FlaskConical className="h-7 w-7 text-[#5C4033]" />
          <div>
            <p className="text-sm font-bold text-[#5C4033]">CocoaTrack</p>
            <p className="text-xs text-[#8B6914]">{subtitle}</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-4">
          <NavLinks />
        </nav>
        <div className="border-t border-[#d4c4b0] p-4">
          <Link href="/dashboard" className="mb-2 block text-xs text-[#8B6914] hover:underline">
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

      <div className="flex items-center justify-between border-b border-[#d4c4b0] bg-[#faf6f1] px-4 py-3 lg:hidden print:hidden">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-6 w-6 text-[#5C4033]" />
          <span className="font-bold text-[#5C4033]">Usinage</span>
        </div>
        <button type="button" onClick={() => setMobileOpen(!mobileOpen)} className="p-2">
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 lg:hidden print:hidden" onClick={() => setMobileOpen(false)}>
          <nav
            className="absolute left-0 top-0 h-full w-72 overflow-y-auto bg-[#faf6f1] p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <NavLinks />
          </nav>
        </div>
      )}
    </>
  );
}
