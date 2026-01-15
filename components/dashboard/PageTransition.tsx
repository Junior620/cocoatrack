'use client';

// CocoaTrack V2 - Page Transition Component
// Provides smooth page transitions with GSAP
// Requirements: 6.7, 13.1, 13.2, 13.7

import { useEffect, useRef, ReactNode } from 'react';
import gsap from 'gsap';
import { usePrefersReducedMotion } from '@/lib/hooks/useGSAP';

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

/**
 * Page transition wrapper component
 * Animates content on mount with fade and slide effect
 * Respects prefers-reduced-motion preference
 */
export function PageTransition({ children, className = '' }: PageTransitionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (!containerRef.current) return;

    if (prefersReducedMotion) {
      // No animation for reduced motion preference
      gsap.set(containerRef.current, { opacity: 1, y: 0 });
      return;
    }

    // Animate in on mount
    gsap.fromTo(
      containerRef.current,
      { opacity: 0, y: 20 },
      {
        opacity: 1,
        y: 0,
        duration: 0.5,
        ease: 'power2.out',
      }
    );
  }, [prefersReducedMotion]);

  return (
    <div ref={containerRef} className={className} style={{ opacity: 0 }}>
      {children}
    </div>
  );
}

interface AnimatedSectionProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  animation?: 'fadeUp' | 'fadeIn' | 'scaleIn';
}

/**
 * Animated section component for scroll-triggered animations
 * Uses Intersection Observer for performance
 */
export function AnimatedSection({
  children,
  className = '',
  delay = 0,
  animation = 'fadeUp',
}: AnimatedSectionProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!sectionRef.current || prefersReducedMotion || hasAnimated.current) {
      if (sectionRef.current) {
        gsap.set(sectionRef.current, { opacity: 1, y: 0, scale: 1 });
      }
      return;
    }

    const animations = {
      fadeUp: { from: { opacity: 0, y: 30 }, to: { opacity: 1, y: 0 } },
      fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
      scaleIn: { from: { opacity: 0, scale: 0.95 }, to: { opacity: 1, scale: 1 } },
    };

    const { from, to } = animations[animation];
    gsap.set(sectionRef.current, from);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated.current) {
            hasAnimated.current = true;
            gsap.to(entry.target, {
              ...to,
              duration: 0.6,
              delay,
              ease: 'power2.out',
            });
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    observer.observe(sectionRef.current);

    return () => observer.disconnect();
  }, [animation, delay, prefersReducedMotion]);

  return (
    <div ref={sectionRef} className={className}>
      {children}
    </div>
  );
}

interface StaggerContainerProps {
  children: ReactNode;
  className?: string;
  stagger?: number;
  childSelector?: string;
}

/**
 * Container that staggers animation of its children
 */
export function StaggerContainer({
  children,
  className = '',
  stagger = 0.1,
  childSelector = '> *',
}: StaggerContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!containerRef.current || prefersReducedMotion || hasAnimated.current) {
      return;
    }

    const children = containerRef.current.querySelectorAll(childSelector);
    if (children.length === 0) return;

    gsap.set(children, { opacity: 0, y: 20 });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated.current) {
            hasAnimated.current = true;
            gsap.to(children, {
              opacity: 1,
              y: 0,
              duration: 0.5,
              stagger,
              ease: 'power2.out',
            });
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [stagger, childSelector, prefersReducedMotion]);

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
}
