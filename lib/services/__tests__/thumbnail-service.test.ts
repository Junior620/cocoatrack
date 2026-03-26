// CocoaTrack V2 - Thumbnail Service Tests
// Unit tests for PDF thumbnail generation

import { describe, it, expect } from 'vitest';
import {
  generatePdfThumbnail,
  isPdfFile,
  generateThumbnailPath,
} from '../thumbnail-service';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

describe('Thumbnail Service', () => {
  describe('isPdfFile', () => {
    it('should return true for PDF MIME type', () => {
      expect(isPdfFile('application/pdf')).toBe(true);
    });

    it('should return false for non-PDF MIME types', () => {
      expect(isPdfFile('image/jpeg')).toBe(false);
      expect(isPdfFile('image/png')).toBe(false);
      expect(isPdfFile('image/webp')).toBe(false);
      expect(isPdfFile('text/plain')).toBe(false);
    });
  });

  describe('generateThumbnailPath', () => {
    it('should generate correct thumbnail path', () => {
      const cooperativeId = 'coop-123';
      const invoiceId = 'invoice-456';
      const uuid = 'uuid-789';

      const path = generateThumbnailPath(cooperativeId, invoiceId, uuid);

      expect(path).toBe('coop-123/invoice-456/thumbnails/uuid-789_thumb.jpg');
    });

    it('should handle UUIDs with dashes', () => {
      const cooperativeId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const invoiceId = 'f1e2d3c4-b5a6-7890-cdef-123456789abc';
      const uuid = '550e8400-e29b-41d4-a716-446655440000';

      const path = generateThumbnailPath(cooperativeId, invoiceId, uuid);

      expect(path).toBe(
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890/f1e2d3c4-b5a6-7890-cdef-123456789abc/thumbnails/550e8400-e29b-41d4-a716-446655440000_thumb.jpg'
      );
    });
  });

  describe('generatePdfThumbnail', () => {
    it('should generate thumbnail for valid PDF', async () => {
      // Create a simple PDF document
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([200, 280]);
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      
      page.drawText('Test PDF', {
        x: 50,
        y: 140,
        size: 20,
        font,
        color: rgb(0, 0, 0),
      });

      const pdfBytes = await pdfDoc.save();
      const pdfBuffer = Buffer.from(pdfBytes);

      // Generate thumbnail
      const result = await generatePdfThumbnail(pdfBuffer);

      expect(result.success).toBe(true);
      expect(result.thumbnailBuffer).toBeDefined();
      expect(result.thumbnailBuffer).toBeInstanceOf(Buffer);
      expect(result.error).toBeUndefined();
    });

    it('should handle PDF with multiple pages', async () => {
      // Create a PDF with 3 pages
      const pdfDoc = await PDFDocument.create();
      pdfDoc.addPage([200, 280]);
      pdfDoc.addPage([200, 280]);
      pdfDoc.addPage([200, 280]);

      const pdfBytes = await pdfDoc.save();
      const pdfBuffer = Buffer.from(pdfBytes);

      // Generate thumbnail (should use first page only)
      const result = await generatePdfThumbnail(pdfBuffer);

      expect(result.success).toBe(true);
      expect(result.thumbnailBuffer).toBeDefined();
    });

    it('should return error for empty PDF', async () => {
      // Note: PDFDocument.create() actually creates a PDF with a default page
      // So we test with completely invalid PDF data instead
      const invalidBuffer = Buffer.from('%PDF-1.4\n%%EOF');

      const result = await generatePdfThumbnail(invalidBuffer);

      // This should fail because it's an invalid/empty PDF structure
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.errorCode).toBeDefined();
    });

    it('should return error for invalid PDF data', async () => {
      const invalidBuffer = Buffer.from('This is not a PDF');

      const result = await generatePdfThumbnail(invalidBuffer);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.errorCode).toBeDefined();
    });

    it('should handle ArrayBuffer input', async () => {
      const pdfDoc = await PDFDocument.create();
      pdfDoc.addPage([200, 280]);
      const pdfBytes = await pdfDoc.save();
      const arrayBuffer = pdfBytes.buffer;

      const result = await generatePdfThumbnail(arrayBuffer);

      expect(result.success).toBe(true);
      expect(result.thumbnailBuffer).toBeDefined();
    });
  });
});
