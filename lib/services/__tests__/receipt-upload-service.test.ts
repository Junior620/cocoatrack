// CocoaTrack V2 - Receipt Upload Service Tests
// Unit tests for PDF upload functionality

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  uploadPdf,
  validatePdfFile,
  validatePdfFileType,
  validatePdfFileSize,
  generateUniqueFilename,
  generateStoragePath,
  sanitizeFilename,
  calculateBackoffDelay,
  MAX_PDF_SIZE_BYTES,
  ALLOWED_PDF_MIME_TYPE,
} from '../receipt-upload-service';

// Mock Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(),
}));

describe('Receipt Upload Service', () => {
  describe('validatePdfFileType', () => {
    it('should accept valid PDF files', () => {
      const file = new File(['content'], 'receipt.pdf', {
        type: 'application/pdf',
      });
      
      expect(validatePdfFileType(file)).toBe(true);
    });

    it('should accept PDF files with uppercase extension', () => {
      const file = new File(['content'], 'receipt.PDF', {
        type: 'application/pdf',
      });
      
      expect(validatePdfFileType(file)).toBe(true);
    });

    it('should reject files without PDF extension', () => {
      const file = new File(['content'], 'receipt.jpg', {
        type: 'application/pdf',
      });
      
      expect(validatePdfFileType(file)).toBe(false);
    });

    it('should reject files without PDF MIME type', () => {
      const file = new File(['content'], 'receipt.pdf', {
        type: 'image/jpeg',
      });
      
      expect(validatePdfFileType(file)).toBe(false);
    });

    it('should reject files with neither PDF extension nor MIME type', () => {
      const file = new File(['content'], 'receipt.jpg', {
        type: 'image/jpeg',
      });
      
      expect(validatePdfFileType(file)).toBe(false);
    });
  });

  describe('validatePdfFileSize', () => {
    it('should accept files within size limit', () => {
      const file = new File(['x'.repeat(1024)], 'receipt.pdf', {
        type: 'application/pdf',
      });
      
      expect(validatePdfFileSize(file)).toBe(true);
    });

    it('should accept files at exactly 10MB', () => {
      // Create a file of exactly 10MB
      const content = new Uint8Array(MAX_PDF_SIZE_BYTES);
      const file = new File([content], 'receipt.pdf', {
        type: 'application/pdf',
      });
      
      expect(validatePdfFileSize(file)).toBe(true);
    });

    it('should reject files larger than 10MB', () => {
      // Create a file larger than 10MB
      const content = new Uint8Array(MAX_PDF_SIZE_BYTES + 1);
      const file = new File([content], 'receipt.pdf', {
        type: 'application/pdf',
      });
      
      expect(validatePdfFileSize(file)).toBe(false);
    });

    it('should reject empty files', () => {
      const file = new File([], 'receipt.pdf', {
        type: 'application/pdf',
      });
      
      expect(validatePdfFileSize(file)).toBe(false);
    });
  });

  describe('validatePdfFile', () => {
    it('should validate correct PDF file', () => {
      const file = new File(['content'], 'receipt.pdf', {
        type: 'application/pdf',
      });
      
      const result = validatePdfFile(file);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.errorCode).toBeUndefined();
    });

    it('should reject non-PDF file with correct error message', () => {
      const file = new File(['content'], 'receipt.jpg', {
        type: 'image/jpeg',
      });
      
      const result = validatePdfFile(file);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Format non supporté. Seuls les fichiers PDF sont acceptés');
      expect(result.errorCode).toBe('INVALID_FILE_TYPE');
    });

    it('should reject oversized file with correct error message', () => {
      const content = new Uint8Array(MAX_PDF_SIZE_BYTES + 1);
      const file = new File([content], 'receipt.pdf', {
        type: 'application/pdf',
      });
      
      const result = validatePdfFile(file);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Fichier trop volumineux. Taille maximale: 10MB');
      expect(result.errorCode).toBe('FILE_TOO_LARGE');
    });

    it('should reject empty file with correct error message', () => {
      const file = new File([], 'receipt.pdf', {
        type: 'application/pdf',
      });
      
      const result = validatePdfFile(file);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Le fichier est vide');
      expect(result.errorCode).toBe('EMPTY_FILE');
    });
  });

  describe('sanitizeFilename', () => {
    it('should keep valid filenames unchanged', () => {
      expect(sanitizeFilename('receipt.pdf')).toBe('receipt.pdf');
      expect(sanitizeFilename('receipt_001.pdf')).toBe('receipt_001.pdf');
      expect(sanitizeFilename('receipt-2024.pdf')).toBe('receipt-2024.pdf');
    });

    it('should replace special characters with underscores', () => {
      expect(sanitizeFilename('receipt/001.pdf')).toBe('receipt_001.pdf');
      expect(sanitizeFilename('receipt\\001.pdf')).toBe('receipt_001.pdf');
      expect(sanitizeFilename('receipt?001.pdf')).toBe('receipt_001.pdf');
      expect(sanitizeFilename('receipt*001.pdf')).toBe('receipt_001.pdf');
      expect(sanitizeFilename('receipt:001.pdf')).toBe('receipt_001.pdf');
      expect(sanitizeFilename('receipt|001.pdf')).toBe('receipt_001.pdf');
      expect(sanitizeFilename('receipt"001.pdf')).toBe('receipt_001.pdf');
      expect(sanitizeFilename('receipt<001>.pdf')).toBe('receipt_001_.pdf');
    });

    it('should truncate long filenames while preserving extension', () => {
      const longName = 'a'.repeat(250) + '.pdf';
      const sanitized = sanitizeFilename(longName);
      
      expect(sanitized.length).toBeLessThanOrEqual(200);
      expect(sanitized.endsWith('.pdf')).toBe(true);
    });
  });

  describe('generateUniqueFilename', () => {
    it('should generate filename with UUID prefix', () => {
      const filename = generateUniqueFilename('receipt.pdf');
      
      // Should match pattern: {uuid}_{filename}
      expect(filename).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_receipt\.pdf$/);
    });

    it('should generate unique filenames for same input', () => {
      const filename1 = generateUniqueFilename('receipt.pdf');
      const filename2 = generateUniqueFilename('receipt.pdf');
      
      expect(filename1).not.toBe(filename2);
    });

    it('should sanitize the original filename', () => {
      const filename = generateUniqueFilename('receipt/001.pdf');
      
      // Should contain sanitized filename
      expect(filename).toMatch(/_receipt_001\.pdf$/);
    });
  });

  describe('generateStoragePath', () => {
    it('should generate correct storage path', () => {
      const cooperativeId = 'coop-123';
      const receiptNumber = '0000004';
      const filename = 'uuid_receipt.pdf';
      
      const path = generateStoragePath(cooperativeId, receiptNumber, filename);
      
      expect(path).toBe('coop-123/receipts/0000004/uuid_receipt.pdf');
    });

    it('should sanitize receipt number in path', () => {
      const cooperativeId = 'coop-123';
      const receiptNumber = '0000/004';
      const filename = 'uuid_receipt.pdf';
      
      const path = generateStoragePath(cooperativeId, receiptNumber, filename);
      
      // Forward slash should be replaced with underscore
      expect(path).toBe('coop-123/receipts/0000_004/uuid_receipt.pdf');
    });

    it('should handle UUID-based cooperative IDs', () => {
      const cooperativeId = '550e8400-e29b-41d4-a716-446655440000';
      const receiptNumber = '0000004';
      const filename = 'a1b2c3d4_receipt.pdf';
      
      const path = generateStoragePath(cooperativeId, receiptNumber, filename);
      
      expect(path).toBe('550e8400-e29b-41d4-a716-446655440000/receipts/0000004/a1b2c3d4_receipt.pdf');
    });
  });

  describe('calculateBackoffDelay', () => {
    it('should calculate exponential backoff correctly', () => {
      const initialDelay = 1000;
      
      expect(calculateBackoffDelay(0, initialDelay)).toBe(1000); // 1000 * 2^0
      expect(calculateBackoffDelay(1, initialDelay)).toBe(2000); // 1000 * 2^1
      expect(calculateBackoffDelay(2, initialDelay)).toBe(4000); // 1000 * 2^2
      expect(calculateBackoffDelay(3, initialDelay)).toBe(8000); // 1000 * 2^3
    });

    it('should handle different initial delays', () => {
      expect(calculateBackoffDelay(0, 500)).toBe(500);
      expect(calculateBackoffDelay(1, 500)).toBe(1000);
      expect(calculateBackoffDelay(2, 2000)).toBe(8000);
    });
  });
});

