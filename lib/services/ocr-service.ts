/**
 * OCR Service Abstraction
 * 
 * Provides a unified interface for OCR text extraction from PDF files.
 * Supports multiple OCR backends (Tesseract local, Google Cloud Vision, AWS Textract).
 * 
 * Requirements: 4.1, 4.2, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6
 */

export interface OcrResult {
  text: string;
  confidence: number; // 0-1 score
  extractionTime: number; // milliseconds
  pageCount: number;
}

export interface OcrServiceConfig {
  timeout?: number; // milliseconds, default 30000
  maxPages?: number; // limit extraction to first N pages, default 1
  language?: string; // language code, default 'fra' for French
}

/**
 * Abstract base class for OCR services
 */
export abstract class OcrService {
  protected config: Required<OcrServiceConfig>;

  constructor(config: OcrServiceConfig = {}) {
    this.config = {
      timeout: config.timeout ?? 30000, // 30 seconds default
      maxPages: config.maxPages ?? 1, // First page only by default
      language: config.language ?? 'fra',
    };
  }

  /**
   * Check if the OCR service is available and configured
   */
  abstract isAvailable(): Promise<boolean>;

  /**
   * Extract text from a PDF file
   * @param pdfUrl - URL or path to the PDF file
   * @returns OCR result with text, confidence, and metadata
   * @throws Error if extraction fails or times out
   */
  abstract extractText(pdfUrl: string): Promise<OcrResult>;

  /**
   * Get the service name for logging
   */
  abstract getServiceName(): string;

  /**
   * Log performance metrics
   */
  protected logPerformance(
    success: boolean,
    extractionTime: number,
    error?: Error
  ): void {
    const logData = {
      service: this.getServiceName(),
      success,
      extractionTime,
      timestamp: new Date().toISOString(),
      error: error?.message,
    };

    if (success) {
      console.log('[OCR Performance]', logData);
    } else {
      console.error('[OCR Error]', logData);
    }
  }

  /**
   * Execute extraction with timeout
   */
  protected async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`OCR extraction timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }
}

/**
 * Factory function to create the appropriate OCR service based on environment
 */
export function createOcrService(config?: OcrServiceConfig): OcrService {
  const ocrProvider = process.env.OCR_PROVIDER || 'none';

  switch (ocrProvider.toLowerCase()) {
    case 'tesseract': {
      // Dynamic import to avoid circular dependency
      const { TesseractOcrService } = require('./ocr-tesseract');
      return new TesseractOcrService(config);
    }
    case 'google':
    case 'google-vision': {
      const { GoogleVisionOcrService } = require('./ocr-cloud');
      return new GoogleVisionOcrService(config);
    }
    case 'aws':
    case 'textract': {
      const { AwsTextractOcrService } = require('./ocr-cloud');
      return new AwsTextractOcrService(config);
    }
    case 'none':
    default: {
      const { NoOpOcrService } = require('./ocr-noop');
      return new NoOpOcrService(config);
    }
  }
}
