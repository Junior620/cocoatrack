'use client';

// CocoaTrack V2 - Mobile Bottom Navigation
// REQ-RESP-001: Navigation Mobile Optimisée
// Bottom navigation for < 768px with 1-2 tap access to main actions

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Users,
  Truck,
  RefreshCw,
  Menu,
  Plus,
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
}

// Primary navigation items for bottom nav (most used actions)
const primaryNavItems: NavItem[] = [
  {
    name: 'Accueil',
    href: '/dashboard',
    icon: <Home className="h-5 w-5" />,
  },
  {
    name: 'Planteurs',
    href: '/planteurs',
    icon: <Users className="h-5 w-5" />,
  },
  {
    name: 'Livraisons',
    href: '/deliveries',
    icon: <Truck className="h-5 w-5" />,
  },
  {
    name: 'Sync',
    href: '/sync',
    icon: <RefreshCw className="h-5 w-5" />,
  },
];

interface MobileBottomNavProps {
  onMenuClick: () => void;
  pendingSyncCount?: number;
}

export function MobileBottomNav({ onMenuClick, pendingSyncCount = 0 }: MobileBottomNavProps) {
  const pathname = usePathname();

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 md:hidden safe-area-bottom"
      role="navigation"
      aria-label="Navigation principale mobile"
    >
      <div className="flex items-center justify-around h-16 px-2">
        {primaryNavItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const isSyncItem = item.href === '/sync';
          const showBadge = isSyncItem && pendingSyncCount > 0;
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`
                relative flex flex-col items-center justify-center
                min-w-[56px] min-h-[44px] px-3 py-2 rounded-lg
                transition-colors duration-200
                touch-manipulation
                ${isActive 
                  ? 'text-primary-600 bg-primary-50' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 active:bg-gray-100'
                }
              `}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="relative">
                {item.icon}
                {showBadge && (
                  <span 
                    className="absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold text-white bg-orange-500 rounded-full"
                    aria-label={`${pendingSyncCount} opérations en attente`}
                  >
                    {pendingSyncCount > 99 ? '99+' : pendingSyncCount}
                  </span>
                )}
              </span>
              <span className={`text-[10px] mt-1 font-medium ${isActive ? 'text-primary-600' : 'text-gray-500'}`}>
                {item.name}
              </span>
            </Link>
          );
        })}
        
        {/* Menu button for accessing all navigation items */}
        <button
          onClick={onMenuClick}
          className="
            flex flex-col items-center justify-center
            min-w-[56px] min-h-[44px] px-3 py-2 rounded-lg
            text-gray-500 hover:text-gray-700 hover:bg-gray-50 active:bg-gray-100
            transition-colors duration-200
            touch-manipulation
          "
          aria-label="Ouvrir le menu complet"
          aria-haspopup="true"
        >
          <Menu className="h-5 w-5" />
          <span className="text-[10px] mt-1 font-medium">Menu</span>
        </button>
      </div>
    </nav>
  );
}

// Floating Action Button for quick create actions
interface MobileFABProps {
  onClick: () => void;
  label?: string;
}

export function MobileFAB({ onClick, label = 'Nouvelle action' }: MobileFABProps) {
  return (
    <button
      onClick={onClick}
      className="
        fixed bottom-20 right-4 z-30 md:hidden
        flex items-center justify-center
        w-14 h-14 rounded-full
        bg-primary-600 text-white
        shadow-lg shadow-primary-600/30
        hover:bg-primary-700 active:bg-primary-800
        transition-all duration-200
        touch-manipulation
      "
      aria-label={label}
    >
      <Plus className="h-6 w-6" />
    </button>
  );
}

export default MobileBottomNav;
