'use client';

// CocoaTrack V2 - Enhanced Dashboard Layout
// Main layout with improved sidebar, header, and navigation

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Users,
  UsersRound,
  Truck,
  FileText,
  ClipboardList,
  Menu,
  X,
  Bell,
  MessageSquare,
  RefreshCw,
  Settings,
  ChevronRight,
  LogOut,
  Building2,
  Map,
} from 'lucide-react';

import { ProtectedRoute } from '@/components/auth';
import { useAuth, ROLE_DISPLAY_NAMES, hasPermission, type Permission } from '@/lib/auth';
import { Avatar, AvatarWithStatus } from '@/components/ui/Avatar';
import { OnlineStatus, OnlineStatusDot } from '@/components/ui/OnlineStatus';
import { QuickActionsInline } from '@/components/ui/QuickActions';
import { GlobalSearch } from '@/components/ui/GlobalSearch';
import { MobileBottomNav } from '@/components/ui/MobileBottomNav';
import { UndoProvider } from '@/components/ui/SwipeActions';
import { OfflineToastContainer, DegradedModeBanner } from '@/components/offline';
import { useDegradedMode } from '@/lib/offline/use-degraded-mode';
import { useOffline } from '@/lib/offline/use-offline';

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  permission?: Permission;
  badge?: number;
}

const navigation: NavItem[] = [
  {
    name: 'Tableau de bord',
    href: '/dashboard',
    icon: <Home className="h-5 w-5" />,
  },
  {
    name: 'Coopératives',
    href: '/cooperatives',
    icon: <Building2 className="h-5 w-5" />,
  },
  {
    name: 'Planteurs',
    href: '/planteurs',
    icon: <Users className="h-5 w-5" />,
    permission: 'planteurs:read',
  },
  {
    name: 'Parcelles',
    href: '/parcelles',
    icon: <Map className="h-5 w-5" />,
    permission: 'parcelles:read',
  },
  {
    name: 'Chef Planteurs',
    href: '/chef-planteurs',
    icon: <UsersRound className="h-5 w-5" />,
    permission: 'planteurs:read',
  },
  {
    name: 'Synthèse Planteur',
    href: '/analytics/planteurs',
    icon: <ClipboardList className="h-5 w-5" />,
    permission: 'planteurs:read',
  },
  {
    name: 'Synthèse Fournisseur',
    href: '/analytics/fournisseurs',
    icon: <ClipboardList className="h-5 w-5" />,
    permission: 'planteurs:read',
  },
  {
    name: 'Livraisons',
    href: '/deliveries',
    icon: <Truck className="h-5 w-5" />,
    permission: 'deliveries:read',
  },
  {
    name: 'Clients',
    href: '/clients',
    icon: <Building2 className="h-5 w-5" />,
  },
  {
    name: 'Récap Clients',
    href: '/clients/recap',
    icon: <ClipboardList className="h-5 w-5" />,
  },
  {
    name: 'Factures',
    href: '/invoices',
    icon: <FileText className="h-5 w-5" />,
    permission: 'invoices:read',
  },
  {
    name: 'Messages',
    href: '/messages',
    icon: <MessageSquare className="h-5 w-5" />,
  },
  {
    name: 'Notifications',
    href: '/notifications',
    icon: <Bell className="h-5 w-5" />,
  },
  {
    name: 'Synchronisation',
    href: '/sync',
    icon: <RefreshCw className="h-5 w-5" />,
  },
  {
    name: 'Audit',
    href: '/audit',
    icon: <ClipboardList className="h-5 w-5" />,
    permission: 'audit:read',
  },
  {
    name: 'Utilisateurs',
    href: '/admin/users',
    icon: <Settings className="h-5 w-5" />,
    permission: 'users:read',
  },
];

// Cocoa pod SVG logo
function CocoaLogo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="10" fill="#059669" />
      <ellipse cx="20" cy="21" rx="8" ry="12" fill="#92400E" />
      <ellipse cx="20" cy="21" rx="6" ry="9" fill="#B45309" />
      <path d="M20 9 L20 33" stroke="#92400E" strokeWidth="1" />
      <path d="M14 13 Q20 15 26 13" stroke="#92400E" strokeWidth="0.75" fill="none" />
      <path d="M13 19 Q20 21 27 19" stroke="#92400E" strokeWidth="0.75" fill="none" />
      <path d="M13 25 Q20 27 27 25" stroke="#92400E" strokeWidth="0.75" fill="none" />
      <path d="M28 12 Q34 8 32 16 Q30 24 28 12" fill="#10B981" />
    </svg>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <DashboardContent>{children}</DashboardContent>
    </ProtectedRoute>
  );
}

function DashboardContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, signOut, isAuthenticated } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { isDegraded, setSessionExpired } = useDegradedMode();
  const { pendingCount } = useOffline();

  // Sync auth state with degraded mode manager
  // When user is not authenticated but we have pending ops, we're in read_only_auth mode
  React.useEffect(() => {
    setSessionExpired(!isAuthenticated);
  }, [isAuthenticated, setSessionExpired]);

  // Filter navigation items based on user permissions
  const filteredNavigation = navigation.filter((item) => {
    if (!item.permission) return true;
    if (!user) return false;
    return hasPermission(user.role, item.permission);
  });

  return (
    <UndoProvider>
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-900/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 transform bg-white shadow-2xl transition-transform duration-300 ease-in-out lg:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar
          navigation={filteredNavigation}
          pathname={pathname}
          user={user}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      {/* Desktop sidebar - Full width for xl+, compact for lg-xl */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:flex-col lg:w-20 xl:w-72">
        <Sidebar 
          navigation={filteredNavigation} 
          pathname={pathname} 
          user={user} 
          compact={true}
        />
      </div>

      {/* Main content */}
      <div className="lg:pl-20 xl:pl-72">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-gray-200 bg-white/80 backdrop-blur-md px-4 sm:px-6">
          {/* Mobile menu button */}
          <button
            type="button"
            className="p-2 text-gray-500 hover:text-gray-600 hover:bg-gray-100 rounded-lg lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <span className="sr-only">Ouvrir le menu</span>
            <Menu className="h-6 w-6" />
          </button>

          {/* Search */}
          <div className="flex-1 max-w-md">
            <GlobalSearch />
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-3">
            {/* Online status */}
            <div className="hidden sm:block">
              <OnlineStatus size="sm" />
            </div>

            {/* Quick actions */}
            <QuickActionsInline />

            {/* Notifications */}
            <button className="relative p-2 text-gray-500 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full" />
            </button>

            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-3 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <AvatarWithStatus 
                  name={user?.full_name || 'User'} 
                  email={user?.email}
                  size="sm"
                  status="online"
                />
                <div className="hidden md:block text-left">
                  <p className="text-sm font-medium text-gray-900">{user?.full_name}</p>
                  <p className="text-xs text-gray-500">
                    {user?.role ? ROLE_DISPLAY_NAMES[user.role] : ''}
                  </p>
                </div>
                <ChevronRight className={`hidden md:block h-4 w-4 text-gray-400 transition-transform ${userMenuOpen ? 'rotate-90' : ''}`} />
              </button>

              {/* User dropdown */}
              {userMenuOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setUserMenuOpen(false)} 
                  />
                  <div className="absolute right-0 mt-2 w-56 z-50 origin-top-right">
                    <div className="rounded-xl bg-white shadow-xl ring-1 ring-black ring-opacity-5 overflow-hidden">
                      <div className="p-3 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                          <Avatar name={user?.full_name || 'User'} email={user?.email} size="md" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{user?.full_name}</p>
                            <p className="text-xs text-gray-500">{user?.email}</p>
                          </div>
                        </div>
                      </div>
                      <div className="p-2">
                        <Link
                          href="/profile"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-50"
                        >
                          <Settings className="h-4 w-4" />
                          Paramètres
                        </Link>
                        <button
                          onClick={() => {
                            setUserMenuOpen(false);
                            signOut();
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-600 rounded-lg hover:bg-red-50"
                        >
                          <LogOut className="h-4 w-4" />
                          Déconnexion
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className={`p-4 sm:p-6 lg:p-8 pb-20 md:pb-4 ${isDegraded ? 'pt-20 sm:pt-22 lg:pt-24' : ''}`}>{children}</main>
      </div>

      {/* Mobile Bottom Navigation - REQ-RESP-001 */}
      <MobileBottomNav 
        onMenuClick={() => setSidebarOpen(true)} 
        pendingSyncCount={pendingCount}
      />

      {/* Offline Toast Container - REQ-OFF-006 */}
      <OfflineToastContainer position="bottom-right" />

      {/* Degraded Mode Banner - REQ-OFF-011 */}
      <DegradedModeBanner />
    </div>
    </UndoProvider>
  );
}

interface SidebarProps {
  navigation: NavItem[];
  pathname: string;
  user: { full_name: string; email: string; role: string } | null;
  onClose?: () => void;
  /** Compact mode for tablet (768-1024px) - REQ-RESP-007 */
  compact?: boolean;
}

function Sidebar({ navigation, pathname, user, onClose, compact = false }: SidebarProps) {
  return (
    <div className="flex h-full flex-col bg-white border-r border-gray-200">
      {/* Logo */}
      <div className={`flex h-16 items-center border-b border-gray-100 ${compact ? 'justify-center px-2 xl:justify-between xl:px-4' : 'justify-between px-4'}`}>
        <Link href="/dashboard" className={`flex items-center ${compact ? 'xl:gap-3' : 'gap-3'}`}>
          <CocoaLogo />
          <div className={compact ? 'hidden xl:block' : ''}>
            <span className="text-lg font-bold text-gray-900">CocoaTrack</span>
            <div className="flex items-center gap-1.5">
              <OnlineStatusDot />
              <span className="text-xs text-gray-500">v2.0</span>
            </div>
          </div>
        </Link>
        {onClose && (
          <button 
            onClick={onClose} 
            className="p-2 text-gray-500 hover:text-gray-600 hover:bg-gray-100 rounded-lg lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className={`flex-1 overflow-y-auto py-4 ${compact ? 'px-2 xl:px-3' : 'px-3'}`}>
        <div className="space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                title={compact ? item.name : undefined}
                className={`
                  group flex items-center rounded-xl text-sm font-medium transition-all duration-200
                  ${compact 
                    ? 'justify-center p-3 xl:justify-start xl:gap-3 xl:px-3 xl:py-2.5' 
                    : 'gap-3 px-3 py-2.5'
                  }
                  ${isActive
                    ? 'bg-primary-50 text-primary-700 shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }
                `}
              >
                <span className={`transition-colors flex-shrink-0 ${
                  isActive ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-600'
                }`}>
                  {item.icon}
                </span>
                <span className={`flex-1 ${compact ? 'hidden xl:block' : ''}`}>{item.name}</span>
                {item.badge && item.badge > 0 && (
                  <span className={`px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-600 rounded-full ${compact ? 'hidden xl:inline' : ''}`}>
                    {item.badge}
                  </span>
                )}
                {isActive && !compact && (
                  <span className="h-1.5 w-1.5 rounded-full bg-primary-600" />
                )}
                {isActive && compact && (
                  <span className="hidden xl:block h-1.5 w-1.5 rounded-full bg-primary-600" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* User section at bottom */}
      <div className={`border-t border-gray-100 ${compact ? 'p-2 xl:p-4' : 'p-4'}`}>
        <div className={`flex items-center rounded-xl bg-gray-50 ${compact ? 'justify-center p-2 xl:justify-start xl:gap-3 xl:p-3' : 'gap-3 p-3'}`}>
          <Avatar name={user?.full_name || 'User'} email={user?.email} size="sm" />
          <div className={`flex-1 min-w-0 ${compact ? 'hidden xl:block' : ''}`}>
            <p className="text-sm font-medium text-gray-900 truncate">{user?.full_name}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
