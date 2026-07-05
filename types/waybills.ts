import type { QualityGrade } from '@/types';

export const WAYBILL_DOCUMENTS_BUCKET = 'waybill-documents';
export const WAYBILL_MAX_FILE_SIZE = 10 * 1024 * 1024;
export const WAYBILL_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type WaybillMimeType = (typeof WAYBILL_ALLOWED_MIME_TYPES)[number];

export interface DeliveryWaybill {
  id: string;
  code: string;
  cooperative_id: string | null;
  sender_name: string | null;
  recipient_name: string | null;
  carrier_name: string | null;
  vehicle_plate: string | null;
  driver_name: string | null;
  origin_location: string | null;
  destination_location: string | null;
  loading_date: string;
  sack_count: number | null;
  total_weight_kg: number | null;
  lot_number: string | null;
  quality_grade: QualityGrade | null;
  notes: string | null;
  document_storage_path: string | null;
  document_file_name: string | null;
  document_mime_type: string | null;
  document_file_size: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface WaybillDeliveryLink {
  id: string;
  waybill_id: string;
  delivery_id: string;
  delivery?: {
    id: string;
    code: string;
    weight_kg: number;
    planteur?: { name: string; code: string } | null;
  };
}

export interface WaybillWithDeliveries extends DeliveryWaybill {
  deliveries: WaybillDeliveryLink[];
  delivery_count: number;
  linked_weight_kg: number;
  document_url?: string | null;
}

export interface WaybillFilters {
  page?: number;
  pageSize?: number;
  cooperative_id?: string;
  loading_date_from?: string;
  loading_date_to?: string;
  search?: string;
}

export interface CreateWaybillInput {
  cooperative_id?: string;
  sender_name?: string;
  recipient_name?: string;
  carrier_name?: string;
  vehicle_plate?: string;
  driver_name?: string;
  origin_location?: string;
  destination_location?: string;
  loading_date: string;
  sack_count?: number;
  total_weight_kg?: number;
  lot_number?: string;
  quality_grade?: QualityGrade;
  notes?: string;
  delivery_ids?: string[];
}

export function generateWaybillStoragePath(
  cooperativeId: string | null | undefined,
  waybillId: string,
  uuid: string,
  filename: string
): string {
  const coopFolder = cooperativeId || 'none';
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${coopFolder}/${waybillId}/${uuid}_${safeName}`;
}
