import type { QualityGrade } from '@/types';

/** Reference humidity for net weight calculation (cacao export standard). */
export const HUMIDITY_REF = 8;

export const COMMERCIAL_TYPES = ['Tout Venant', 'G1', 'G2', 'G3', 'HS'] as const;

export type CommercialType = (typeof COMMERCIAL_TYPES)[number];

/** Same mapping as receipt import service. */
export function commercialTypeToQualityGrade(commercialType: string): QualityGrade {
  if (commercialType === 'G2' || commercialType === 'G1') return 'A';
  return 'B';
}

/** netWeight = grossWeight × (100 - humidity) / (100 - HUMIDITY_REF) */
export function calculateNetWeightFromGross(grossWeight: number, humidity: number): number {
  if (!grossWeight || grossWeight <= 0 || isNaN(humidity)) return 0;
  return Math.round(((grossWeight * (100 - humidity)) / (100 - HUMIDITY_REF)) * 100) / 100;
}

export function todayDateInputValue(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function dateInputToIso(date: string): string {
  if (!date) return new Date().toISOString();
  return new Date(`${date}T12:00:00`).toISOString();
}
