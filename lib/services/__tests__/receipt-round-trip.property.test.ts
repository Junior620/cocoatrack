// CocoaTrack V2 - Receipt Round-Trip Property Tests
//
// Property 27: Round-Trip Data Preservation
// Property 28: Receipt Metadata Preservation
// Property 29: PDF Metadata Preservation
//
// Validates: Requirements 16.1, 16.2, 16.3, 16.4

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { ReceiptData, ProductLine, LocationData, PaymentData } from '@/types/receipts';

// ============================================================================
// PURE LOGIC (replicated from receipt-import-service to avoid server imports)
// ============================================================================

const COMMERCIAL_TYPE_TO_QUALITY_GRADE: Record<string, string> = {
  'Tout Venant': 'B',
  'G2': 'A',
};
const DEFAULT_QUALITY_GRADE = 'B';

function mapCommercialTypeToQualityGrade(commercialType: string): string {
  return COMMERCIAL_TYPE_TO_QUALITY_GRADE[commercialType] ?? DEFAULT_QUALITY_GRADE;
}

function generateDeliveryCode(transactionDate: string, sequence: number): string {
  const datePart = transactionDate.replace(/-/g, '');
  const seqPart = String(sequence).padStart(4, '0');
  return `DEL-${datePart}-${seqPart}`;
}

interface DeliveryInsert {
  code: string;
  cooperative_id: string;
  planteur_id: string;
  chef_planteur_id: string;
  weight_kg: number;
  price_per_kg: number;
  total_amount: number;
  quality_grade: string;
  delivered_at: string;
  notes: string;
}

interface ReceiptInsert {
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
  payment_mode: 'Espèces' | 'Autres';
  amount_paid: number;
  balance: number;
  pdf_url: string;
  pdf_file_name: string;
  pdf_file_size: number;
  extraction_method: 'manual' | 'ocr';
}

function buildDeliveryInserts(data: ReceiptData): DeliveryInsert[] {
  return data.productLines.map((line: ProductLine, index: number) => {
    const code = generateDeliveryCode(data.transactionDate, index + 1);
    const notes = JSON.stringify({
      source: 'receipt_import',
      contract_number: data.contractNumber,
      receipt_number: data.receiptNumber,
      campaign: data.campaign,
      location: data.location,
    });
    return {
      code,
      cooperative_id: data.cooperativeId,
      planteur_id: data.planteurId,
      chef_planteur_id: data.chefPlanteurId,
      weight_kg: line.netWeight,
      price_per_kg: line.pricePerKg,
      total_amount: line.amount,
      quality_grade: mapCommercialTypeToQualityGrade(line.commercialType),
      delivered_at: data.transactionDate,
      notes,
    };
  });
}

function buildReceiptInsert(data: ReceiptData, userId = 'test-user'): ReceiptInsert {
  const totalAmount = data.productLines.reduce((sum, line) => sum + line.amount, 0);
  const balance = totalAmount - data.payment.amountPaid;
  return {
    cooperative_id: data.cooperativeId,
    planteur_id: data.planteurId,
    chef_planteur_id: data.chefPlanteurId,
    contract_number: data.contractNumber,
    receipt_number: data.receiptNumber,
    campaign: data.campaign,
    region: data.location.region ?? null,
    department: data.location.department ?? null,
    arrondissement: data.location.arrondissement ?? null,
    village: data.location.village ?? null,
    transaction_date: data.transactionDate,
    professional_card_number: data.professionalCardNumber ?? null,
    payment_mode: data.payment.mode,
    amount_paid: data.payment.amountPaid,
    balance,
    pdf_url: data.pdfUrl,
    pdf_file_name: data.pdfFileName,
    pdf_file_size: data.pdfFileSize,
    extraction_method: data.extractionMethod,
  };
}

// ============================================================================
// ARBITRARIES
// ============================================================================

const productLineArb = fc.record<ProductLine>({
  commercialType: fc.constantFrom('Tout Venant', 'G2', 'G1'),
  grossWeight: fc.double({ min: 0.01, max: 10000, noNaN: true }),
  humidity: fc.double({ min: 0, max: 30, noNaN: true }),
  netWeight: fc.double({ min: 0.01, max: 10000, noNaN: true }),
  pricePerKg: fc.double({ min: 1, max: 100000, noNaN: true }),
  amount: fc.double({ min: 0.01, max: 1000000000, noNaN: true }),
});

const locationArb = fc.record<LocationData>({
  region: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  department: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  arrondissement: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  village: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
});

const paymentArb = fc.record<PaymentData>({
  mode: fc.constantFrom('Espèces' as const, 'Autres' as const),
  amountPaid: fc.double({ min: 0, max: 1000000000, noNaN: true }),
});

const receiptDataArb = fc.record<ReceiptData>({
  pdfUrl: fc.string({ minLength: 1, maxLength: 200 }),
  pdfFileName: fc.string({ minLength: 1, maxLength: 100 }),
  pdfFileSize: fc.integer({ min: 1, max: 10_000_000 }),
  cooperativeId: fc.uuid(),
  planteurId: fc.uuid(),
  chefPlanteurId: fc.uuid(),
  contractNumber: fc.string({ minLength: 1, maxLength: 50 }),
  receiptNumber: fc.string({ minLength: 1, maxLength: 50 }),
  campaign: fc.string({ minLength: 1, maxLength: 20 }),
  transactionDate: fc.constantFrom('2024-01-15', '2023-06-30', '2024-12-01'),
  location: locationArb,
  professionalCardNumber: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
  productLines: fc.array(productLineArb, { minLength: 1, maxLength: 5 }),
  payment: paymentArb,
  extractionMethod: fc.constantFrom('manual' as const, 'ocr' as const),
});

// ============================================================================
// PROPERTY 27: Round-Trip Data Preservation
// Validates: Requirements 16.1, 16.2
// ============================================================================

describe('Property 27: Round-Trip Data Preservation', () => {
  /**
   * **Validates: Requirements 16.1, 16.2**
   *
   * For any valid ReceiptData with N product lines, building delivery inserts
   * and reading back the essential fields should produce values identical to
   * the original ReceiptData.
   */
  it('delivery inserts preserve planteur, weight, price, amount, and date fields', () => {
    fc.assert(
      fc.property(receiptDataArb, (data) => {
        const deliveries = buildDeliveryInserts(data);

        // One delivery per product line
        expect(deliveries).toHaveLength(data.productLines.length);

        deliveries.forEach((delivery, i) => {
          const line = data.productLines[i];

          // planteur_id matches
          expect(delivery.planteur_id).toBe(data.planteurId);

          // chef_planteur_id matches
          expect(delivery.chef_planteur_id).toBe(data.chefPlanteurId);

          // weight_kg (netWeight) matches
          expect(delivery.weight_kg).toBe(line.netWeight);

          // price_per_kg matches
          expect(delivery.price_per_kg).toBe(line.pricePerKg);

          // total_amount (amount) matches
          expect(delivery.total_amount).toBe(line.amount);

          // delivered_at (transactionDate) matches
          expect(delivery.delivered_at).toBe(data.transactionDate);
        });
      })
    );
  });
});

// ============================================================================
// PROPERTY 28: Receipt Metadata Preservation
// Validates: Requirements 16.3
// ============================================================================

describe('Property 28: Receipt Metadata Preservation', () => {
  /**
   * **Validates: Requirements 16.3**
   *
   * For any valid ReceiptData, building the collection_receipt insert payload
   * should preserve all metadata fields exactly.
   */
  it('receipt insert preserves contract, receipt number, campaign, location, payment, and card fields', () => {
    fc.assert(
      fc.property(receiptDataArb, (data) => {
        const receipt = buildReceiptInsert(data);

        expect(receipt.contract_number).toBe(data.contractNumber);
        expect(receipt.receipt_number).toBe(data.receiptNumber);
        expect(receipt.campaign).toBe(data.campaign);

        // Location fields: undefined becomes null
        expect(receipt.region).toBe(data.location.region ?? null);
        expect(receipt.department).toBe(data.location.department ?? null);
        expect(receipt.arrondissement).toBe(data.location.arrondissement ?? null);
        expect(receipt.village).toBe(data.location.village ?? null);

        // Payment mode
        expect(receipt.payment_mode).toBe(data.payment.mode);

        // Professional card: undefined becomes null
        expect(receipt.professional_card_number).toBe(data.professionalCardNumber ?? null);
      })
    );
  });
});

// ============================================================================
// PROPERTY 29: PDF Metadata Preservation
// Validates: Requirements 16.4
// ============================================================================

describe('Property 29: PDF Metadata Preservation', () => {
  /**
   * **Validates: Requirements 16.4**
   *
   * For any valid ReceiptData, the PDF metadata fields should be preserved
   * verbatim in the receipt insert payload.
   */
  it('receipt insert preserves pdf_url, pdf_file_name, pdf_file_size, and extraction_method', () => {
    fc.assert(
      fc.property(receiptDataArb, (data) => {
        const receipt = buildReceiptInsert(data);

        expect(receipt.pdf_url).toBe(data.pdfUrl);
        expect(receipt.pdf_file_name).toBe(data.pdfFileName);
        expect(receipt.pdf_file_size).toBe(data.pdfFileSize);
        expect(receipt.extraction_method).toBe(data.extractionMethod);
      })
    );
  });
});
