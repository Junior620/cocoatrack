/**
 * PDF Compression Utility
 *
 * Compresses PDF files larger than 5MB before upload to reduce transfer time.
 *
 * Requirements: 18.2
 */

import { PDFDocument } from 'pdf-lib';

/**
 * Threshold above which compression is applied (5MB)
 * Requirements: 18.2
 */
export const PDF_COMPRESSION_THRESHOLD = 5 * 1024 * 1024; // 5MB

/**
 * Compress a PDF file if it exceeds the 5MB threshold.
 *
 * Uses pdf-lib to re-save the document with object streams enabled,
 * which removes redundant data and compresses the structure.
 * Falls back to the original file if compression fails.
 *
 * @param file - The PDF File to potentially compress
 * @returns The compressed File (or original if under threshold / on error)
 *
 * Requirements: 18.2
 */
export async function compressPdfIfNeeded(file: File): Promise<File> {
  // Skip compression for files under the threshold
  if (file.size <= PDF_COMPRESSION_THRESHOLD) {
    return file;
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer, {
      // Ignore encryption errors — fall back to original
      ignoreEncryption: true,
    });

    // Re-save with object streams (compresses cross-reference table)
    const compressedBytes = await pdfDoc.save({ useObjectStreams: true });

    // Only use compressed version if it's actually smaller
    if (compressedBytes.byteLength >= file.size) {
      return file;
    }

    const compressedFile = new File([compressedBytes.buffer as ArrayBuffer], file.name, {
      type: 'application/pdf',
      lastModified: file.lastModified,
    });

    console.log(
      `[pdf-compression] Compressed ${file.name}: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`
    );

    return compressedFile;
  } catch (err) {
    // Best-effort: return original file on any error
    console.warn('[pdf-compression] Compression failed, using original file:', err);
    return file;
  }
}
