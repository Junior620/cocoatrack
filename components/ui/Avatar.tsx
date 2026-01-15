'use client';

// CocoaTrack V2 - Avatar Component
// Generates unique avatars using DiceBear

import { useMemo } from 'react';
import { createAvatar } from '@dicebear/core';
import { initials, botttsNeutral, thumbs } from '@dicebear/collection';

interface AvatarProps {
  name: string;
  email?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  style?: 'initials' | 'bottts' | 'thumbs';
  className?: string;
}

const sizeClasses = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-12 h-12 text-lg',
  xl: 'w-16 h-16 text-xl',
};

const sizePx = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 48,
  xl: 64,
};

export function Avatar({ 
  name, 
  email, 
  size = 'md', 
  style = 'initials',
  className = '' 
}: AvatarProps) {
  const seed = email || name;

  const avatarSvg = useMemo(() => {
    const options = {
      seed,
      size: sizePx[size],
    };

    let avatar;
    switch (style) {
      case 'bottts':
        avatar = createAvatar(botttsNeutral, {
          ...options,
          backgroundColor: ['b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdfbf'],
        });
        break;
      case 'thumbs':
        avatar = createAvatar(thumbs, {
          ...options,
          backgroundColor: ['b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdfbf'],
        });
        break;
      case 'initials':
      default:
        avatar = createAvatar(initials, {
          ...options,
          backgroundColor: ['059669', 'f59e0b', '3b82f6', '8b5cf6', 'ec4899', '14b8a6'],
          fontWeight: 600,
        });
        break;
    }

    return avatar.toDataUri();
  }, [seed, size, style]);

  return (
    <div 
      className={`${sizeClasses[size]} rounded-full overflow-hidden ring-2 ring-white shadow-sm ${className}`}
    >
      <img 
        src={avatarSvg} 
        alt={`Avatar de ${name}`}
        className="w-full h-full object-cover"
      />
    </div>
  );
}

// Avatar with status indicator
interface AvatarWithStatusProps extends AvatarProps {
  status?: 'online' | 'offline' | 'away' | 'busy';
}

const statusColors = {
  online: 'bg-emerald-500',
  offline: 'bg-gray-400',
  away: 'bg-amber-500',
  busy: 'bg-red-500',
};

export function AvatarWithStatus({ 
  status = 'online',
  ...props 
}: AvatarWithStatusProps) {
  const statusSize = {
    xs: 'w-1.5 h-1.5',
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
    xl: 'w-4 h-4',
  };

  return (
    <div className="relative inline-block">
      <Avatar {...props} />
      <span 
        className={`absolute bottom-0 right-0 block ${statusSize[props.size || 'md']} ${statusColors[status]} rounded-full ring-2 ring-white`}
      />
    </div>
  );
}

// Avatar group for showing multiple users
interface AvatarGroupProps {
  users: Array<{ name: string; email?: string }>;
  max?: number;
  size?: 'xs' | 'sm' | 'md';
}

export function AvatarGroup({ users, max = 4, size = 'sm' }: AvatarGroupProps) {
  const visibleUsers = users.slice(0, max);
  const remainingCount = users.length - max;

  const overlapClass = {
    xs: '-ml-1.5',
    sm: '-ml-2',
    md: '-ml-2.5',
  };

  return (
    <div className="flex items-center">
      {visibleUsers.map((user, index) => (
        <div 
          key={user.email || user.name} 
          className={index > 0 ? overlapClass[size] : ''}
          style={{ zIndex: visibleUsers.length - index }}
        >
          <Avatar name={user.name} email={user.email} size={size} />
        </div>
      ))}
      {remainingCount > 0 && (
        <div 
          className={`${overlapClass[size]} ${sizeClasses[size]} rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-medium ring-2 ring-white`}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  );
}
