'use client';

// CocoaTrack V2 - GSAP Animation Hooks
// Provides animation utilities with prefers-reduced-motion support
// Requirements: 6.7, 13.1, 13.2, 13.7

import { useEffect, useRef, useState, useCallback } from 'react';
import gsap from 'gsap';

/**
 * Hook to detect if user prefers reduced motion
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return prefersReducedMotion;
}

/**
 * Hook for animating a counter from 0 to target value
 */
export function useCounterAnimation(
  targetValue: number,
  duration: number = 1.5,
  enabled: boolean = true
) {
  const [displayValue, setDisplayValue] = useState(0);
  const prefersReducedMotion = usePrefersReducedMotion();
  const previousValue = useRef(0);
  const tweenRef = useRef<gsap.core.Tween | null>(null);

  useEffect(() => {
    // Skip animation if reduced motion is preferred or disabled
    if (prefersReducedMotion || !enabled) {
      setDisplayValue(targetValue);
      previousValue.current = targetValue;
      return;
    }

    // Kill any existing animation
    if (tweenRef.current) {
      tweenRef.current.kill();
    }

    // Animate from previous value to new target
    const obj = { value: previousValue.current };
    tweenRef.current = gsap.to(obj, {
      value: targetValue,
      duration,
      ease: 'power2.out',
      onUpdate: () => {
        setDisplayValue(obj.value);
      },
      onComplete: () => {
        previousValue.current = targetValue;
      },
    });

    return () => {
      if (tweenRef.current) {
        tweenRef.current.kill();
      }
    };
  }, [targetValue, duration, enabled, prefersReducedMotion]);

  return displayValue;
}

/**
 * Hook for fade-in animation on mount
 */
export function useFadeIn<T extends HTMLElement>(
  delay: number = 0,
  duration: number = 0.6
) {
  const ref = useRef<T>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (!ref.current || prefersReducedMotion) return;

    gsap.fromTo(
      ref.current,
      { opacity: 0, y: 20 },
      {
        opacity: 1,
        y: 0,
        duration,
        delay,
        ease: 'power2.out',
      }
    );
  }, [delay, duration, prefersReducedMotion]);

  return ref;
}

/**
 * Hook for staggered fade-in animation on children
 */
export function useStaggerFadeIn<T extends HTMLElement>(
  stagger: number = 0.1,
  duration: number = 0.5
) {
  const ref = useRef<T>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (!ref.current || prefersReducedMotion) return;

    const children = ref.current.children;
    if (children.length === 0) return;

    gsap.fromTo(
      children,
      { opacity: 0, y: 20 },
      {
        opacity: 1,
        y: 0,
        duration,
        stagger,
        ease: 'power2.out',
      }
    );
  }, [stagger, duration, prefersReducedMotion]);

  return ref;
}

/**
 * Hook for scroll-triggered animations
 */
export function useScrollTrigger<T extends HTMLElement>(
  animation: 'fadeIn' | 'slideUp' | 'scaleIn' = 'fadeIn',
  options: {
    start?: string;
    end?: string;
    scrub?: boolean;
    once?: boolean;
  } = {}
) {
  const ref = useRef<T>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const [isLoaded, setIsLoaded] = useState(false);

  // Dynamically import ScrollTrigger
  useEffect(() => {
    const loadScrollTrigger = async () => {
      const { ScrollTrigger } = await import('gsap/ScrollTrigger');
      gsap.registerPlugin(ScrollTrigger);
      setIsLoaded(true);
    };
    loadScrollTrigger();
  }, []);

  useEffect(() => {
    if (!ref.current || prefersReducedMotion || !isLoaded) return;

    const { start = 'top 80%', end = 'bottom 20%', scrub = false, once = true } = options;

    const animations = {
      fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
      slideUp: { from: { opacity: 0, y: 50 }, to: { opacity: 1, y: 0 } },
      scaleIn: { from: { opacity: 0, scale: 0.9 }, to: { opacity: 1, scale: 1 } },
    };

    const { from, to } = animations[animation];

    gsap.fromTo(ref.current, from, {
      ...to,
      duration: 0.8,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: ref.current,
        start,
        end,
        scrub,
        once,
      },
    });

    return () => {
      // Cleanup ScrollTrigger instances
      import('gsap/ScrollTrigger').then(({ ScrollTrigger }) => {
        ScrollTrigger.getAll().forEach((trigger) => {
          if (trigger.trigger === ref.current) {
            trigger.kill();
          }
        });
      });
    };
  }, [animation, options, prefersReducedMotion, isLoaded]);

  return ref;
}

/**
 * Hook for page transition animation
 */
export function usePageTransition() {
  const prefersReducedMotion = usePrefersReducedMotion();

  const animateIn = useCallback(
    (element: HTMLElement) => {
      if (prefersReducedMotion) {
        gsap.set(element, { opacity: 1 });
        return;
      }

      gsap.fromTo(
        element,
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: 0.5,
          ease: 'power2.out',
        }
      );
    },
    [prefersReducedMotion]
  );

  const animateOut = useCallback(
    (element: HTMLElement): Promise<void> => {
      return new Promise((resolve) => {
        if (prefersReducedMotion) {
          gsap.set(element, { opacity: 0 });
          resolve();
          return;
        }

        gsap.to(element, {
          opacity: 0,
          y: -20,
          duration: 0.3,
          ease: 'power2.in',
          onComplete: resolve,
        });
      });
    },
    [prefersReducedMotion]
  );

  return { animateIn, animateOut };
}
