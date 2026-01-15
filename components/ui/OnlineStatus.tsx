'use client';

// CocoaTrack V2 - Online Status Indicator
// Shows connection status with animation

import { useEffect, useState } from 'react';
import { Wifi, WifiOff, Cloud, CloudOff } from 'lucide-react';

interface OnlineStatusProps {
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export function OnlineStatus({ showLabel = true, size = 'md' }: OnlineStatusProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    // Set initial state
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowToast(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const dotSize = size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2';

  return (
    <>
      <div 
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-all duration-300 ${
          isOnline 
            ? 'bg-emerald-50 text-emerald-700' 
            : 'bg-red-50 text-red-700'
        }`}
      >
        <span className="relative flex">
          <span 
            className={`${dotSize} rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-red-500'}`}
          />
          {isOnline && (
            <span 
              className={`absolute inset-0 ${dotSize} rounded-full bg-emerald-500 animate-ping opacity-75`}
            />
          )}
        </span>
        {showLabel && (
          <span>{isOnline ? 'En ligne' : 'Hors ligne'}</span>
        )}
      </div>

      {/* Toast notification */}
      {showToast && (
        <div 
          className={`fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg transition-all duration-300 ${
            isOnline 
              ? 'bg-emerald-600 text-white' 
              : 'bg-red-600 text-white'
          }`}
        >
          {isOnline ? (
            <>
              <Cloud className="h-5 w-5" />
              <span>Connexion rétablie</span>
            </>
          ) : (
            <>
              <CloudOff className="h-5 w-5" />
              <span>Mode hors ligne activé</span>
            </>
          )}
        </div>
      )}
    </>
  );
}

// Compact version for sidebar
export function OnlineStatusDot() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <span className="relative flex h-2 w-2">
      <span 
        className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
          isOnline ? 'bg-emerald-400 animate-ping' : 'bg-red-400'
        }`}
      />
      <span 
        className={`relative inline-flex rounded-full h-2 w-2 ${
          isOnline ? 'bg-emerald-500' : 'bg-red-500'
        }`}
      />
    </span>
  );
}
