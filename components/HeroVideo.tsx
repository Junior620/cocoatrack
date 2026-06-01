'use client';

import { useEffect, useRef, useState } from 'react';

export default function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedData = () => {
      console.log('Video loaded successfully');
      setIsLoaded(true);
      video.play().catch((error) => {
        console.error('Autoplay failed:', error);
      });
    };

    const handleError = (e: Event) => {
      console.error('Video error:', e);
      const target = e.target as HTMLVideoElement;
      if (target.error) {
        console.error('Error code:', target.error.code);
        console.error('Error message:', target.error.message);
      }
    };

    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('error', handleError);

    // Force load
    video.load();

    return () => {
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('error', handleError);
    };
  }, []);

  return (
    <>
      <video
        ref={videoRef}
        loop
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 h-full w-full object-cover"
        style={{ opacity: isLoaded ? 1 : 0, transition: 'opacity 0.5s' }}
      >
        <source src="/hero.mp4" type="video/mp4" />
      </video>
      
      {/* Loading indicator */}
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-green-900 via-green-800 to-green-950">
          <div className="text-white text-xl">Chargement...</div>
        </div>
      )}
    </>
  );
}
