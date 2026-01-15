'use client';

// CocoaTrack V2 - URL State Hook
// Syncs filter state with URL for shareable links

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

type FilterValue = string | number | boolean | undefined;

interface UseUrlStateOptions<T extends Record<string, FilterValue>> {
  defaults?: Partial<T>;
}

export function useUrlState<T extends Record<string, FilterValue>>(
  options: UseUrlStateOptions<T> = {}
) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { defaults = {} } = options;

  // Parse current state from URL
  const state = useMemo(() => {
    const result: Record<string, FilterValue> = { ...defaults };
    
    searchParams.forEach((value, key) => {
      // Try to parse as number
      const numValue = Number(value);
      if (!isNaN(numValue) && value !== '') {
        result[key] = numValue;
      }
      // Try to parse as boolean
      else if (value === 'true') {
        result[key] = true;
      } else if (value === 'false') {
        result[key] = false;
      }
      // Keep as string
      else {
        result[key] = value;
      }
    });

    return result as T;
  }, [searchParams, defaults]);

  // Update URL with new state
  const setState = useCallback(
    (updates: Partial<T>) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        const defaultValue = (defaults as Record<string, FilterValue>)[key];
        if (value === undefined || value === '' || value === defaultValue) {
          params.delete(key);
        } else {
          params.set(key, String(value));
        }
      });

      const queryString = params.toString();
      const url = queryString ? `${pathname}?${queryString}` : pathname;
      router.push(url);
    },
    [router, pathname, searchParams, defaults]
  );

  // Reset to defaults
  const resetState = useCallback(() => {
    router.push(pathname);
  }, [router, pathname]);

  // Get a single value
  const getValue = useCallback(
    <K extends keyof T>(key: K): T[K] => {
      return state[key];
    },
    [state]
  );

  // Set a single value
  const setValue = useCallback(
    <K extends keyof T>(key: K, value: T[K]) => {
      setState({ [key]: value } as unknown as Partial<T>);
    },
    [setState]
  );

  return {
    state,
    setState,
    resetState,
    getValue,
    setValue,
  };
}
