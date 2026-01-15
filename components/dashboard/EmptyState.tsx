'use client';

// CocoaTrack V2 - Enhanced Empty State Component
// Beautiful empty states with illustrations and call-to-actions

import Link from 'next/link';
import { Plus, Users, Truck, FileText, TrendingUp } from 'lucide-react';

interface EmptyStateProps {
  type: 'dashboard' | 'planteurs' | 'deliveries' | 'chart' | 'performers';
  title?: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}

// SVG Illustrations
function DashboardIllustration() {
  return (
    <svg className="w-48 h-48" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Background circles */}
      <circle cx="100" cy="100" r="80" fill="#FEF3C7" opacity="0.5" />
      <circle cx="100" cy="100" r="60" fill="#FDE68A" opacity="0.5" />
      
      {/* Cocoa pod */}
      <ellipse cx="100" cy="105" rx="35" ry="50" fill="#92400E" />
      <ellipse cx="100" cy="105" rx="28" ry="42" fill="#B45309" />
      
      {/* Pod lines */}
      <path d="M100 55 L100 155" stroke="#92400E" strokeWidth="2" />
      <path d="M72 75 Q100 85 128 75" stroke="#92400E" strokeWidth="1.5" fill="none" />
      <path d="M70 95 Q100 105 130 95" stroke="#92400E" strokeWidth="1.5" fill="none" />
      <path d="M70 115 Q100 125 130 115" stroke="#92400E" strokeWidth="1.5" fill="none" />
      <path d="M72 135 Q100 145 128 135" stroke="#92400E" strokeWidth="1.5" fill="none" />
      
      {/* Leaf */}
      <path d="M135 70 Q160 50 150 80 Q140 110 135 70" fill="#059669" />
      <path d="M135 70 Q145 85 140 95" stroke="#047857" strokeWidth="1" fill="none" />
      
      {/* Sparkles */}
      <circle cx="50" cy="60" r="3" fill="#F59E0B" />
      <circle cx="150" cy="140" r="2" fill="#F59E0B" />
      <circle cx="45" cy="130" r="2" fill="#10B981" />
      <circle cx="160" cy="70" r="3" fill="#10B981" />
      
      {/* Chart bars at bottom */}
      <rect x="55" y="165" width="12" height="20" rx="2" fill="#D1D5DB" />
      <rect x="72" y="160" width="12" height="25" rx="2" fill="#9CA3AF" />
      <rect x="89" y="155" width="12" height="30" rx="2" fill="#6B7280" />
      <rect x="106" y="150" width="12" height="35" rx="2" fill="#F59E0B" />
      <rect x="123" y="158" width="12" height="27" rx="2" fill="#9CA3AF" />
      <rect x="140" y="163" width="12" height="22" rx="2" fill="#D1D5DB" />
    </svg>
  );
}

function ChartIllustration() {
  return (
    <svg className="w-32 h-32" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="80" width="15" height="25" rx="3" fill="#E5E7EB" />
      <rect x="30" y="65" width="15" height="40" rx="3" fill="#D1D5DB" />
      <rect x="50" y="50" width="15" height="55" rx="3" fill="#9CA3AF" />
      <rect x="70" y="35" width="15" height="70" rx="3" fill="#F59E0B" opacity="0.5" />
      <rect x="90" y="55" width="15" height="50" rx="3" fill="#D1D5DB" />
      
      {/* Trend line */}
      <path d="M17 75 L37 60 L57 45 L77 30 L97 50" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 4" />
      
      {/* Question mark */}
      <circle cx="77" cy="20" r="12" fill="#FEF3C7" />
      <text x="77" y="25" textAnchor="middle" fill="#92400E" fontSize="14" fontWeight="bold">?</text>
    </svg>
  );
}

function PerformersIllustration() {
  return (
    <svg className="w-32 h-32" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Podium */}
      <rect x="10" y="70" width="30" height="40" rx="3" fill="#E5E7EB" />
      <rect x="45" y="50" width="30" height="60" rx="3" fill="#FDE68A" />
      <rect x="80" y="80" width="30" height="30" rx="3" fill="#E5E7EB" />
      
      {/* Numbers */}
      <text x="25" y="95" textAnchor="middle" fill="#6B7280" fontSize="16" fontWeight="bold">2</text>
      <text x="60" y="80" textAnchor="middle" fill="#92400E" fontSize="20" fontWeight="bold">1</text>
      <text x="95" y="100" textAnchor="middle" fill="#6B7280" fontSize="14" fontWeight="bold">3</text>
      
      {/* Crown on first place */}
      <path d="M50 40 L55 48 L60 40 L65 48 L70 40 L68 55 L52 55 Z" fill="#F59E0B" />
      
      {/* People silhouettes */}
      <circle cx="25" cy="55" r="8" fill="#9CA3AF" />
      <circle cx="60" cy="30" r="10" fill="#F59E0B" />
      <circle cx="95" cy="65" r="7" fill="#9CA3AF" />
    </svg>
  );
}

const emptyStateConfig = {
  dashboard: {
    icon: <DashboardIllustration />,
    title: 'Bienvenue sur CocoaTrack !',
    description: 'Commencez par ajouter vos premiers planteurs et enregistrer des livraisons pour voir vos statistiques.',
    actions: [
      { label: 'Ajouter un Chef Planteur', href: '/chef-planteurs/new', icon: <Users className="h-4 w-4" /> },
      { label: 'Nouvelle livraison', href: '/deliveries/new', icon: <Truck className="h-4 w-4" /> },
    ],
  },
  planteurs: {
    icon: <Users className="h-16 w-16 text-gray-300" />,
    title: 'Aucun planteur enregistré',
    description: 'Ajoutez votre premier planteur pour commencer à suivre les livraisons de cacao.',
    actions: [
      { label: 'Ajouter un planteur', href: '/planteurs/new', icon: <Plus className="h-4 w-4" /> },
    ],
  },
  deliveries: {
    icon: <Truck className="h-16 w-16 text-gray-300" />,
    title: 'Aucune livraison enregistrée',
    description: 'Enregistrez votre première livraison de cacao pour commencer le suivi.',
    actions: [
      { label: 'Nouvelle livraison', href: '/deliveries/new', icon: <Plus className="h-4 w-4" /> },
    ],
  },
  chart: {
    icon: <ChartIllustration />,
    title: 'Aucune donnée disponible',
    description: 'Les graphiques apparaîtront une fois que vous aurez enregistré des livraisons.',
    actions: [],
  },
  performers: {
    icon: <PerformersIllustration />,
    title: 'Aucune donnée disponible',
    description: 'Le classement apparaîtra après les premières livraisons.',
    actions: [],
  },
};

export function EmptyState({ 
  type, 
  title, 
  description, 
  actionLabel, 
  actionHref,
  onAction 
}: EmptyStateProps) {
  const config = emptyStateConfig[type];
  const displayTitle = title || config.title;
  const displayDescription = description || config.description;

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {/* Illustration */}
      <div className="mb-6 opacity-80">
        {config.icon}
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {displayTitle}
      </h3>

      {/* Description */}
      <p className="text-sm text-gray-500 max-w-sm mb-6">
        {displayDescription}
      </p>

      {/* Actions */}
      {(actionLabel && (actionHref || onAction)) ? (
        <div className="flex flex-wrap gap-3 justify-center">
          {actionHref ? (
            <Link
              href={actionHref}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" />
              {actionLabel}
            </Link>
          ) : (
            <button
              onClick={onAction}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" />
              {actionLabel}
            </button>
          )}
        </div>
      ) : config.actions.length > 0 ? (
        <div className="flex flex-wrap gap-3 justify-center">
          {config.actions.map((action, index) => (
            <Link
              key={index}
              href={action.href}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors shadow-sm ${
                index === 0
                  ? 'bg-primary-600 text-white hover:bg-primary-700'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {action.icon}
              {action.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// Compact empty state for smaller containers
export function EmptyStateCompact({ 
  icon, 
  message 
}: { 
  icon?: React.ReactNode; 
  message: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      {icon || (
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
          <TrendingUp className="h-6 w-6 text-gray-400" />
        </div>
      )}
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  );
}
