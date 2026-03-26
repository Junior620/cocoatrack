// CocoaTrack V2 - Receipt Validation Schemas
// Zod schemas for receipt import data validation

import { z } from 'zod';

// =============================================================================
// ENUMS AND CONSTANTS
// =============================================================================

/**
 * Extraction method enum schema
 * Values: manual, ocr
 */
export const extractionMethodSchema = z.enum(['manual', 'ocr']);

/**
 * Payment mode enum schema
 * Values: Espèces, Autres
 */
export const paymentModeSchema = z.enum(['Espèces', 'Autres']);

/**
 * Confidence level enum schema
 * Values: low, medium, high
 */
export const confidenceLevelSchema = z.enum(['low', 'medium', 'high']);

/**
 * Maximum file size for PDF uploads (10MB in bytes)
 * Requirements: 2.4, 9.5
 */
export const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

// =============================================================================
// CUSTOM VALIDATORS
// =============================================================================

/**
 * Validate that a date is not in the future
 * Requirements: 5.13
 */
export function validateDateNotFuture(dateStr: string): boolean {
  const date = new Date(dateStr);
  const now = new Date();
  // Set time to start of day for comparison
  now.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date <= now;
}

/**
 * Validate that weight is greater than zero
 * Requirements: 5.14
 */
export function validateWeightPositive(weight: number): boolean {
  return weight > 0;
}

/**
 * Validate that humidity is between 0 and 100
 * Requirements: 5.15
 */
export function validateHumidityRange(humidity: number): boolean {
  return humidity >= 0 && humidity <= 100;
}

/**
 * Validate that price is greater than zero
 * Requirements: 5.16
 */
export function validatePricePositive(price: number): boolean {
  return price > 0;
}

// =============================================================================
// LOCATION DATA SCHEMA
// =============================================================================

/**
 * Schema for location data
 * All fields are optional
 * 
 * Requirements: 5.3, 14.5
 */
export const locationDataSchema = z.object({
  region: z
    .string()
    .max(100, 'Region must be at most 100 characters')
    .optional(),
  
  department: z
    .string()
    .max(100, 'Department must be at most 100 characters')
    .optional(),
  
  arrondissement: z
    .string()
    .max(100, 'Arrondissement must be at most 100 characters')
    .optional(),
  
  village: z
    .string()
    .max(100, 'Village must be at most 100 characters')
    .optional(),
});

export type LocationDataInput = z.infer<typeof locationDataSchema>;

// =============================================================================
// PRODUCT LINE SCHEMA
// =============================================================================

/**
 * Schema for a single product line
 * Includes validation for weight, humidity, and price
 * 
 * Requirements: 5.5, 5.7, 5.8, 5.14, 5.15, 5.16
 */
export const productLineSchema = z.object({
  commercialType: z
    .string()
    .min(1, 'Commercial type is required')
    .max(100, 'Commercial type must be at most 100 characters'),
  
  grossWeight: z
    .number()
    .positive('Gross weight must be greater than zero')
    .refine(validateWeightPositive, {
      message: 'Le poids brut doit être supérieur à zéro',
    }),
  
  humidity: z
    .number()
    .min(0, 'Humidity must be at least 0%')
    .max(100, 'Humidity must be at most 100%')
    .refine(validateHumidityRange, {
      message: "L'humidité doit être entre 0% et 100%",
    }),
  
  netWeight: z
    .number()
    .nonnegative('Net weight must be non-negative'),
  
  pricePerKg: z
    .number()
    .positive('Price per kg must be greater than zero')
    .refine(validatePricePositive, {
      message: 'Le prix doit être supérieur à zéro',
    }),
  
  amount: z
    .number()
    .nonnegative('Amount must be non-negative'),
}).refine(
  (data) => {
    // Validate net weight calculation: netWeight = grossWeight * (1 - humidity/100)
    const expectedNetWeight = data.grossWeight * (1 - data.humidity / 100);
    const tolerance = 0.01; // Allow 0.01 kg tolerance for rounding
    return Math.abs(data.netWeight - expectedNetWeight) <= tolerance;
  },
  {
    message: 'Net weight calculation is incorrect',
    path: ['netWeight'],
  }
).refine(
  (data) => {
    // Validate amount calculation: amount = netWeight * pricePerKg
    const expectedAmount = data.netWeight * data.pricePerKg;
    const tolerance = 0.01; // Allow 0.01 XAF tolerance for rounding
    return Math.abs(data.amount - expectedAmount) <= tolerance;
  },
  {
    message: 'Amount calculation is incorrect',
    path: ['amount'],
  }
);

export type ProductLineInput = z.infer<typeof productLineSchema>;

// =============================================================================
// PAYMENT DATA SCHEMA
// =============================================================================

/**
 * Schema for payment data
 * 
 * Requirements: 5.10, 14.10, 14.11
 */
export const paymentDataSchema = z.object({
  mode: paymentModeSchema,
  
  amountPaid: z
    .number()
    .nonnegative('Amount paid must be non-negative'),
});

export type PaymentDataInput = z.infer<typeof paymentDataSchema>;

// =============================================================================
// RECEIPT DATA SCHEMA
// =============================================================================

/**
 * Schema for receipt data input
 * Used by POST /api/receipts/create
 * 
 * Requirements: 5.1-5.16, 7.4, 10.1
 */
export const receiptDataSchema = z.object({
  // PDF file metadata
  pdfUrl: z
    .string()
    .url('Invalid PDF URL'),
  
  pdfFileName: z
    .string()
    .min(1, 'PDF filename is required')
    .max(255, 'PDF filename must be at most 255 characters'),
  
  pdfFileSize: z
    .number()
    .int('File size must be an integer')
    .positive('File size must be positive')
    .max(MAX_PDF_SIZE_BYTES, `File size must not exceed ${MAX_PDF_SIZE_BYTES / 1024 / 1024}MB`),
  
  // Relations
  cooperativeId: z
    .string()
    .uuid('Invalid cooperative ID'),
  
  planteurId: z
    .string()
    .uuid('Invalid planteur ID'),
  
  chefPlanteurId: z
    .string()
    .uuid('Invalid chef planteur ID'),
  
  // Receipt identifiers
  contractNumber: z
    .string()
    .min(1, 'Contract number is required')
    .max(200, 'Contract number must be at most 200 characters'),
  
  receiptNumber: z
    .string()
    .min(1, 'Receipt number is required')
    .max(100, 'Receipt number must be at most 100 characters'),
  
  campaign: z
    .string()
    .min(1, 'Campaign is required')
    .max(100, 'Campaign must be at most 100 characters'),
  
  // Transaction data
  transactionDate: z
    .string()
    .refine(
      (dateStr) => {
        // Validate ISO 8601 date format
        const date = new Date(dateStr);
        return !isNaN(date.getTime());
      },
      { message: 'Invalid date format' }
    )
    .refine(validateDateNotFuture, {
      message: 'La date ne peut pas être dans le futur',
    }),
  
  // Location
  location: locationDataSchema,
  
  // Professional card (optional)
  professionalCardNumber: z
    .string()
    .max(100, 'Professional card number must be at most 100 characters')
    .optional(),
  
  // Product lines (at least one required)
  productLines: z
    .array(productLineSchema)
    .min(1, 'Veuillez ajouter au moins une ligne de produit'),
  
  // Payment
  payment: paymentDataSchema,
  
  // Extraction method
  extractionMethod: extractionMethodSchema,
}).refine(
  (data) => {
    // Validate that total amount matches sum of product line amounts
    const totalAmount = data.productLines.reduce((sum, line) => sum + line.amount, 0);
    const balance = totalAmount - data.payment.amountPaid;
    // Allow small tolerance for rounding errors
    const tolerance = 0.01;
    return Math.abs(balance) < tolerance || balance >= -tolerance;
  },
  {
    message: 'Payment amount validation failed',
  }
);

export type ReceiptDataInput = z.infer<typeof receiptDataSchema>;

// =============================================================================
// PARSED RECEIPT SCHEMA
// =============================================================================

/**
 * Schema for parsed receipt data from OCR
 * All fields are optional since OCR may not extract everything
 * 
 * Requirements: 4.4, 14.1-14.13
 */
export const parsedReceiptSchema = z.object({
  contractNumber: z.string().nullable(),
  receiptNumber: z.string().nullable(),
  campaign: z.string().nullable(),
  transactionDate: z.string().nullable(),
  seller: z.string().nullable(),
  buyer: z.string().nullable(),
  professionalCard: z.string().nullable(),
  location: locationDataSchema.nullable(),
  productLines: z.array(productLineSchema).default([]),
  payment: z.object({
    mode: paymentModeSchema.optional(),
    amountPaid: z.number().optional(),
  }).nullable(),
  confidence: z.record(z.string(), confidenceLevelSchema),
});

export type ParsedReceiptInput = z.infer<typeof parsedReceiptSchema>;

// =============================================================================
// UPLOAD VALIDATION SCHEMA
// =============================================================================

/**
 * Schema for PDF upload validation
 * 
 * Requirements: 2.2, 2.4, 9.4, 9.5
 */
export const uploadPdfSchema = z.object({
  cooperativeId: z
    .string()
    .uuid('Invalid cooperative ID'),
});

export type UploadPdfInput = z.infer<typeof uploadPdfSchema>;

// =============================================================================
// RECEIPT NUMBER VALIDATION SCHEMA
// =============================================================================

/**
 * Schema for receipt number validation
 * 
 * Requirements: 17.1
 */
export const validateReceiptNumberSchema = z.object({
  receiptNumber: z
    .string()
    .min(1, 'Receipt number is required'),
  
  cooperativeId: z
    .string()
    .uuid('Invalid cooperative ID'),
});

export type ValidateReceiptNumberInput = z.infer<typeof validateReceiptNumberSchema>;

// =============================================================================
// DUPLICATE DETECTION SCHEMA
// =============================================================================

/**
 * Schema for duplicate detection
 * 
 * Requirements: 17.5
 */
export const detectDuplicatesSchema = z.object({
  planteurId: z
    .string()
    .uuid('Invalid planteur ID'),
  
  chefPlanteurId: z
    .string()
    .uuid('Invalid chef planteur ID'),
  
  transactionDate: z
    .string()
    .refine(
      (dateStr) => {
        const date = new Date(dateStr);
        return !isNaN(date.getTime());
      },
      { message: 'Invalid date format' }
    ),
  
  totalWeight: z
    .number()
    .positive('Total weight must be positive'),
});

export type DetectDuplicatesInput = z.infer<typeof detectDuplicatesSchema>;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculate net weight from gross weight and humidity
 * Formula: netWeight = grossWeight * (1 - humidity/100)
 * 
 * Requirements: 5.7
 */
export function calculateNetWeight(grossWeight: number, humidity: number): number {
  return grossWeight * (1 - humidity / 100);
}

/**
 * Calculate line amount from net weight and price per kg
 * Formula: amount = netWeight * pricePerKg
 * 
 * Requirements: 5.8
 */
export function calculateLineAmount(netWeight: number, pricePerKg: number): number {
  return netWeight * pricePerKg;
}

/**
 * Calculate total amount from product lines
 * Formula: totalAmount = sum of all line amounts
 * 
 * Requirements: 5.9
 */
export function calculateTotalAmount(productLines: ProductLineInput[]): number {
  return productLines.reduce((sum, line) => sum + line.amount, 0);
}

/**
 * Calculate balance from total amount and amount paid
 * Formula: balance = totalAmount - amountPaid
 * 
 * Requirements: 5.11
 */
export function calculateBalance(totalAmount: number, amountPaid: number): number {
  return totalAmount - amountPaid;
}

/**
 * Map commercial type to quality grade
 * Mapping: "Tout Venant" → "B", "G2" → "A", others → "B"
 * 
 * Requirements: 7.5
 */
export function mapCommercialTypeToQualityGrade(commercialType: string): 'A' | 'B' | 'C' {
  const normalized = commercialType.trim().toLowerCase();
  
  if (normalized === 'g2') {
    return 'A';
  }
  
  // "Tout Venant" and all others default to "B"
  return 'B';
}

/**
 * Generate delivery code
 * Format: DEL-YYYYMMDD-XXXX
 * 
 * Requirements: 7.3
 */
export function generateDeliveryCode(transactionDate: string, sequence: number): string {
  const date = new Date(transactionDate);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const seq = String(sequence).padStart(4, '0');
  
  return `DEL-${year}${month}${day}-${seq}`;
}

/**
 * Validate PDF file type
 * Requirements: 2.2, 9.4
 */
export function validatePdfFileType(file: File): boolean {
  return file.type === 'application/pdf' && file.name.toLowerCase().endsWith('.pdf');
}

/**
 * Validate PDF file size
 * Requirements: 2.4, 9.5
 */
export function validatePdfFileSize(file: File): boolean {
  return file.size <= MAX_PDF_SIZE_BYTES;
}
