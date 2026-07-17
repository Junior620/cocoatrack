'use client';

import { useEffect, useState } from 'react';

interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
}

export default function HeroVideo() {
  const [shouldLoad, setShouldLoad] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const connection = (
      navigator as Navigator & { connection?: NetworkInformation }
    ).connection;
    const slowConnection =
      connection?.saveData ||
      connection?.effectiveType === 'slow-2g' ||
      connection?.effectiveType === '2g';

    if (slowConnection) return;

    const windowWithIdle = window as typeof window & {
      requestIdleCallback?: (callback: () => void) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const idleId = windowWithIdle.requestIdleCallback?.(
      () => setShouldLoad(true)
    );
    const timeoutId =
      idleId === undefined
        ? window.setTimeout(() => setShouldLoad(true), 1_500)
        : undefined;

    return () => {
      if (idleId !== undefined) {
        windowWithIdle.cancelIdleCallback?.(idleId);
      }
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  return (
    <>
      {shouldLoad && (
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="none"
          onCanPlay={() => setIsLoaded(true)}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ opacity: isLoaded ? 1 : 0, transition: 'opacity 0.5s' }}
        >
          <source src="/hero.mp4" type="video/mp4" />
        </video>
      )}
      
      {!isLoaded && (
        <div
          className="absolute inset-0 bg-gradient-to-br from-green-900 via-green-800 to-green-950"
          aria-hidden="true"
        />
      )}
    </>
  );
}
