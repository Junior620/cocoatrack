'use client';

// CocoaTrack V2 - Quick Actions Button
// Floating action button with quick access to common actions

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Plus, X, Users, Truck, FileText, UserPlus } from 'lucide-react';

interface QuickAction {
  label: string;
  href: string;
  icon: React.ReactNode;
  color: string;
}

const quickActions: QuickAction[] = [
  {
    label: 'Nouvelle livraison',
    href: '/deliveries/new',
    icon: <Truck className="h-5 w-5" />,
    color: 'bg-emerald-500 hover:bg-emerald-600',
  },
  {
    label: 'Nouveau planteur',
    href: '/planteurs/new',
    icon: <UserPlus className="h-5 w-5" />,
    color: 'bg-blue-500 hover:bg-blue-600',
  },
  {
    label: 'Nouveau chef planteur',
    href: '/chef-planteurs/new',
    icon: <Users className="h-5 w-5" />,
    color: 'bg-purple-500 hover:bg-purple-600',
  },
  {
    label: 'Nouvelle facture',
    href: '/invoices/generate',
    icon: <FileText className="h-5 w-5" />,
    color: 'bg-amber-500 hover:bg-amber-600',
  },
];

export function QuickActions() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close menu on escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  return (
    <div ref={menuRef} className="relative">
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-center w-10 h-10 rounded-full shadow-lg transition-all duration-300 ${
          isOpen 
            ? 'bg-gray-800 text-white rotate-45' 
            : 'bg-primary-600 text-white hover:bg-primary-700 hover:scale-105'
        }`}
        aria-label="Actions rapides"
      >
        {isOpen ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 origin-top-right">
          <div className="rounded-xl bg-white shadow-xl ring-1 ring-black ring-opacity-5 overflow-hidden">
            <div className="p-2">
              <p className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Actions rapides
              </p>
              {quickActions.map((action, index) => (
                <Link
                  key={action.href}
                  href={action.href}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors group"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <span className={`p-2 rounded-lg text-white ${action.color} transition-transform group-hover:scale-110`}>
                    {action.icon}
                  </span>
                  <span className="font-medium">{action.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline version for header
export function QuickActionsInline() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-3 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
      >
        <Plus className="h-4 w-4" />
        <span className="hidden sm:inline">Nouveau</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 z-50">
          <div className="rounded-xl bg-white shadow-xl ring-1 ring-black ring-opacity-5 overflow-hidden">
            <div className="p-2">
              {quickActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors group"
                >
                  <span className={`p-2 rounded-lg text-white ${action.color}`}>
                    {action.icon}
                  </span>
                  <span className="font-medium">{action.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
