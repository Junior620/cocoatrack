// CocoaTrack V2 - Receipt Import Types
// Types for collection receipt PDF import functionality

/**
 * Extraction method type
 */
export type ExtractionMethod = 'manual' | 'ocr';

/**
 * Payment mode type
 */
export type PaymentMode = 'Espèces' | 'Autres';

/**
 * OCR confidence level type
 */
export type ConfidenceLevel = 'low' | 'medium' | 'high';

/**
 * Result of validating a receipt number (duplicate check)
 */
export interface ReceiptNumberValidation {
  exists: boolean;
  collectionReceiptId?: string;
  deliveryIds?: string[];
}

/**
 * Result of uploading a PDF file
 */
export interface UploadResult {
  pdfUrl: string;
  fileSize: number;
  fileName: string;
}

/**
 * Result of OCR text extraction
 */
export interface ExtractionResult {
  text: string;
  confidence: number;
  extractionTime: number;
}

/**
 * Product line in a collection receipt
 * Represents a single row in the products table
 */
export interface ProductLine {
  /** Commercial type (e.g., "Tout Venant", "G2", "G1") */
  commercialType: string;
  
  /** Gross weight in kg */
  grossWeight: number;
  
  /** Humidity percentage (0-100) */
  humidity: number;
  
  /** Net weight in kg (calculated: grossWeight * (1 - humidity/100)) */
  netWeight: number;
  
  /** Price per kg in XAF */
  pricePerKg: number;
  
  /** Total amount in XAF (calculated: netWeight * pricePerKg) */
  amount: number;
}

/**
 * Location data from receipt
 */
export interface LocationData {
  region?: string;
  department?: string;
  arrondissement?: string;
  village?: string;
}

/**
 * Payment data from receipt
 */
export interface PaymentData {
  mode: PaymentMode;
  amountPaid: number;
}

/**
 * Receipt data for creation
 */
export interface ReceiptData {
  pdfUrl: string;
  pdfFileName: string;
  pdfFileSize: number;
  cooperativeId: string;
  planteurId: string;
  chefPlanteurId: string;       // ID si trouvé en BD
  chefPlanteurName?: string;    // Nom saisi manuellement (si pas d'ID)
  contractNumber: string;
  receiptNumber: string;
  campaign: string;
  transactionDate: string;
  location: LocationData;
  professionalCardNumber?: string;
  productLines: ProductLine[];
  payment: PaymentData;
  extractionMethod: ExtractionMethod;
}

/**
 * Parsed receipt from OCR
 */
export interface ParsedReceipt {
  contractNumber: string | null;
  receiptNumber: string | null;
  campaign: string | null;
  transactionDate: string | null;
  seller: string | null;
  buyer: string | null;
  professionalCard: string | null;
  location: LocationData | null;
  productLines: ProductLine[];
  payment: PaymentData | null;
  confidence: Record<string, ConfidenceLevel>;
}

/**
 * Result of creating a receipt
 */
export interface CreateReceiptResult {
  collectionReceiptId: string;
  deliveryIds: string[];
  deliveryCount: number;
}

/**
 * Duplicate receipt detection result
 */
export interface DuplicateReceipt {
  collectionReceiptId: string;
  receiptNumber: string;
  transactionDate: string;
  totalWeight: number;
  similarity: number;
}

/**
 * Collection receipt record
 */
export interface CollectionReceipt {
  id: string;
  cooperative_id: string;
  planteur_id: string;
  chef_planteur_id: string;
  contract_number: string;
  receipt_number: string;
  campaign: string;
  region: string | null;
  department: string | null;
  arrondissement: string | null;
  village: string | null;
  transaction_date: string;
  professional_card_number: string | null;
  payment_mode: PaymentMode | null;
  amount_paid: number | null;
  balance: number | null;
  pdf_url: string;
  pdf_file_name: string;
  pdf_file_size: number;
  extraction_method: ExtractionMethod;
  created_by: string;
  created_at: string;
  updated_at: string;
}
