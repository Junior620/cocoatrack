/**
 * Cloud OCR Service Implementations
 * 
 * Supports Google Cloud Vision and AWS Textract
 * 
 * Requirements: 4.1, 4.2, 13.1, 13.2, 13.3, 13.4, 13.5
 */

import { OcrService, OcrResult, OcrServiceConfig } from './ocr-service';

/**
 * Helper to download a PDF from Supabase Storage using a signed URL.
 * The public URL alone returns 400 for private buckets, we need to
 * exchange it for a short-lived signed URL via the service-role client.
 */
async function downloadPdf(url: string): Promise<Buffer> {
  // Extract the storage path from the Supabase public URL
  // URL format: https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
  const publicPrefix = '/storage/v1/object/public/';
  const idx = url.indexOf(publicPrefix);

  if (idx !== -1) {
    const rest = url.slice(idx + publicPrefix.length);
    const slashIdx = rest.indexOf('/');
    if (slashIdx !== -1) {
      const bucket = rest.slice(0, slashIdx);
      const filePath = decodeURIComponent(rest.slice(slashIdx + 1));

      // Use require() to match how this module is loaded (via require in ocr-service.ts)
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
      );

      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(filePath, 60); // 60-second signed URL

      if (error || !data?.signedUrl) {
        throw new Error(`Failed to create signed URL: ${error?.message ?? 'unknown'}`);
      }

      url = data.signedUrl;
    }
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download PDF: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Google Cloud Vision OCR Service
 * 
 * To use:
 * 1. Install: pnpm add @google-cloud/vision
 * 2. Set up Google Cloud credentials
 * 3. Set OCR_PROVIDER=google in .env
 * 4. Set GOOGLE_CLOUD_PROJECT_ID and GOOGLE_APPLICATION_CREDENTIALS
 */
export class GoogleVisionOcrService extends OcrService {
  constructor(config?: OcrServiceConfig) {
    super(config);
  }

  getServiceName(): string {
    return 'Google Cloud Vision';
  }

  async isAvailable(): Promise<boolean> {
    // Check if Google Cloud Vision is configured
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (!projectId || !credentials) {
      console.warn('[OCR] Google Cloud Vision not configured. Set GOOGLE_CLOUD_PROJECT_ID and GOOGLE_APPLICATION_CREDENTIALS');
      return false;
    }

    try {
      // Check if @google-cloud/vision is installed
      // const vision = await import('@google-cloud/vision');
      // return !!vision;
      
      // For now, return false since the package is not installed
      return false;
    } catch {
      return false;
    }
  }

  async extractText(pdfUrl: string): Promise<OcrResult> {
    const startTime = Date.now();

    try {
      // Validate availability
      const available = await this.isAvailable();
      if (!available) {
        throw new Error('Google Cloud Vision is not available or not configured');
      }

      // Execute extraction with timeout
      const result = await this.withTimeout(
        this.performExtraction(pdfUrl),
        this.config.timeout
      );

      const extractionTime = Date.now() - startTime;
      this.logPerformance(true, extractionTime);

      return {
        ...result,
        extractionTime,
      };
    } catch (error) {
      const extractionTime = Date.now() - startTime;
      this.logPerformance(false, extractionTime, error as Error);
      throw error;
    }
  }

  private async performExtraction(pdfUrl: string): Promise<Omit<OcrResult, 'extractionTime'>> {
    // Placeholder implementation
    // Actual implementation would:
    // 1. Download PDF from URL
    // 2. Call Google Cloud Vision API
    // 3. Extract text and confidence from response
    
    /* Example implementation:
    const vision = await import('@google-cloud/vision');
    const client = new vision.ImageAnnotatorClient();
    
    // Download PDF content
    const pdfBuffer = await downloadPdf(pdfUrl);
    
    // Perform OCR
    const [result] = await client.documentTextDetection({
      image: { content: pdfBuffer },
    });
    
    const fullText = result.fullTextAnnotation?.text || '';
    const confidence = result.fullTextAnnotation?.pages?.[0]?.confidence || 0;
    const pageCount = result.fullTextAnnotation?.pages?.length || 1;
    
    return {
      text: fullText,
      confidence,
      pageCount: Math.min(pageCount, this.config.maxPages),
    };
    */

    throw new Error('Google Cloud Vision implementation requires @google-cloud/vision to be installed');
  }
}

/**
 * AWS Textract OCR Service
 * 
 * To use:
 * 1. Install: pnpm add @aws-sdk/client-textract
 * 2. Set up AWS credentials
 * 3. Set OCR_PROVIDER=aws in .env
 * 4. Set AWS_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY
 */
export class AwsTextractOcrService extends OcrService {
  constructor(config?: OcrServiceConfig) {
    super(config);
  }

  getServiceName(): string {
    return 'AWS Textract';
  }

  async isAvailable(): Promise<boolean> {
    // Check if AWS Textract is configured
    const region = process.env.AWS_REGION;
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    if (!region || !accessKeyId || !secretAccessKey) {
      console.warn('[OCR] AWS Textract not configured. Set AWS_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY');
      return false;
    }

    try {
      // Check if @aws-sdk/client-textract is installed
      await import('@aws-sdk/client-textract');
      return true;
    } catch {
      console.warn('[OCR] @aws-sdk/client-textract not installed. Run: pnpm add @aws-sdk/client-textract');
      return false;
    }
  }

  async extractText(pdfUrl: string): Promise<OcrResult> {
    const startTime = Date.now();

    try {
      // Validate availability
      const available = await this.isAvailable();
      if (!available) {
        throw new Error('AWS Textract is not available or not configured');
      }

      // Execute extraction with timeout
      const result = await this.withTimeout(
        this.performExtraction(pdfUrl),
        this.config.timeout
      );

      const extractionTime = Date.now() - startTime;
      this.logPerformance(true, extractionTime);

      return {
        ...result,
        extractionTime,
      };
    } catch (error) {
      const extractionTime = Date.now() - startTime;
      this.logPerformance(false, extractionTime, error as Error);
      throw error;
    }
  }

  private async performExtraction(pdfUrl: string): Promise<Omit<OcrResult, 'extractionTime'>> {
    const { TextractClient, DetectDocumentTextCommand } = await import('@aws-sdk/client-textract');
    
    const client = new TextractClient({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
      requestHandler: {
        requestTimeout: 25000, // 25s per request, under our 30s total timeout
      } as never,
    });
    
    // Step 1: Download PDF
    console.log('[Textract] Downloading PDF...');
    const pdfBuffer = await downloadPdf(pdfUrl);
    console.log(`[Textract] PDF downloaded: ${(pdfBuffer.length / 1024).toFixed(1)}KB`);
    
    // Textract has a 5MB limit for synchronous operations
    const maxSize = 5 * 1024 * 1024;
    if (pdfBuffer.length > maxSize) {
      throw new Error(`PDF file too large for Textract (${(pdfBuffer.length / 1024 / 1024).toFixed(2)}MB). Maximum size is 5MB for synchronous operations.`);
    }
    
    // Step 2: Call Textract
    console.log(`[Textract] Calling DetectDocumentText (region: ${process.env.AWS_REGION})...`);
    const command = new DetectDocumentTextCommand({
      Document: { Bytes: pdfBuffer },
    });
    
    const response = await client.send(command);
    console.log(`[Textract] Response received, blocks: ${response.Blocks?.length ?? 0}`);
    
    // Extract text from LINE blocks
    const textBlocks = response.Blocks?.filter(block => block.BlockType === 'LINE') || [];
    const fullText = textBlocks.map(block => block.Text).join('\n');
    
    const confidences = textBlocks.map(block => block.Confidence || 0).filter(c => c > 0);
    const avgConfidence = confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length / 100
      : 0;
    
    return {
      text: fullText,
      confidence: avgConfidence,
      pageCount: 1,
    };
  }
}


