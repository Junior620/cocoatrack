'use client';

import { useQuery } from '@tanstack/react-query';
import type { PlanteurTraceabilitySummary } from '@/types/planteur-traceability';

async function fetchPlanteurTraceability(planteurId: string): Promise<PlanteurTraceabilitySummary> {
  const res = await fetch(`/api/planteurs/${planteurId}/traceability`, {
    credentials: 'include',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Échec du chargement de la traçabilité');
  }
  const json = (await res.json()) as { success: boolean; data: PlanteurTraceabilitySummary };
  return json.data;
}

/**
 * Hook React Query offline-first pour la traçabilité agrégée d'un planteur.
 */
export function usePlanteurTraceability(planteurId: string, enabled = true) {
  return useQuery({
    queryKey: ['planteur-traceability', planteurId],
    queryFn: () => fetchPlanteurTraceability(planteurId),
    enabled: enabled && !!planteurId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    networkMode: 'offlineFirst',
    retry: 2,
  });
}
