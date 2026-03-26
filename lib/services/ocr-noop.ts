/**
 * No-Op OCR Service
 * 
 * Used when no OCR provider is configured.
 * Always returns unavailable and throws errors on extraction attempts.
 * 
 * Requirements: 13.3
 */

import { OcrService, OcrResult, OcrServiceConfig } from './ocr-service';

/**
 * No-Op OCR Service
 * 
 * This service is used when OCR_PROVIDER is not set or set to 'none'.
 * It gracefully handles the absence of OCR functionality.
 */
export class NoOpOcrService extends OcrService {
  constructor(config?: OcrServiceConfig) {
    super(config);
  }

  getServiceName(): string {
    return 'None (OCR Disabled)';
  }

  async isAvailable(): Promise<boolean> {
    return false;
  }

  async extractText(_pdfUrl: string): Promise<OcrResult> {
    throw new Error(
      'OCR service is not configured. Set OCR_PROVIDER environment variable to enable OCR extraction.'
    );
  }
}
