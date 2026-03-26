# OCR Service Documentation

## Overview

The OCR service provides a unified interface for extracting text from PDF files. It supports multiple OCR backends and gracefully handles service unavailability.

## Architecture

```
OcrService (Abstract Base Class)
├── TesseractOcrService (Local OCR)
├── GoogleVisionOcrService (Google Cloud Vision)
├── AwsTextractOcrService (AWS Textract)
└── NoOpOcrService (Disabled/Fallback)
```

## Configuration

Set the `OCR_PROVIDER` environment variable to choose your OCR backend:

```bash
# No OCR (default)
OCR_PROVIDER=none

# Tesseract (local)
OCR_PROVIDER=tesseract

# Google Cloud Vision
OCR_PROVIDER=google

# AWS Textract
OCR_PROVIDER=aws
```

### Tesseract OCR (Local)

**Installation:**
```bash
pnpm add tesseract.js
```

**Configuration:**
```bash
OCR_PROVIDER=tesseract
```

**Pros:**
- Free and open source
- No external API calls
- Works offline
- No API rate limits

**Cons:**
- Lower accuracy than cloud services
- Slower processing
- Requires additional dependencies

### Google Cloud Vision

**Installation:**
```bash
pnpm add @google-cloud/vision
```

**Configuration:**
```bash
OCR_PROVIDER=google
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
```

**Setup:**
1. Create a Google Cloud project
2. Enable Cloud Vision API
3. Create a service account and download credentials
4. Set environment variables

**Pros:**
- High accuracy
- Fast processing
- Supports multiple languages
- Good with handwritten text

**Cons:**
- Requires internet connection
- Costs money (free tier available)
- Requires Google Cloud account

### AWS Textract

**Installation:**
```bash
pnpm add @aws-sdk/client-textract
```

**Configuration:**
```bash
OCR_PROVIDER=aws
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
```

**Setup:**
1. Create an AWS account
2. Create IAM user with Textract permissions
3. Get access key and secret key
4. Set environment variables

**Pros:**
- High accuracy
- Fast processing
- Good with forms and tables
- Integrates with other AWS services

**Cons:**
- Requires internet connection
- Costs money (free tier available)
- Requires AWS account

## Usage

### Basic Usage

```typescript
import { createOcrService } from '@/lib/services';

// Create service based on environment configuration
const ocrService = createOcrService();

// Check if OCR is available
const isAvailable = await ocrService.isAvailable();

if (isAvailable) {
  // Extract text from PDF
  const result = await ocrService.extractText(pdfUrl);
  
  console.log('Extracted text:', result.text);
  console.log('Confidence:', result.confidence);
  console.log('Extraction time:', result.extractionTime, 'ms');
  console.log('Pages processed:', result.pageCount);
} else {
  console.log('OCR service not available - falling back to manual entry');
}
```

### Custom Configuration

```typescript
import { createOcrService } from '@/lib/services';

const ocrService = createOcrService({
  timeout: 60000, // 60 seconds
  maxPages: 3, // Process first 3 pages
  language: 'fra', // French language
});

try {
  const result = await ocrService.extractText(pdfUrl);
  // Handle result
} catch (error) {
  if (error.message.includes('timeout')) {
    console.error('OCR extraction timed out');
  } else {
    console.error('OCR extraction failed:', error);
  }
}
```

### Direct Service Usage

```typescript
import { TesseractOcrService, GoogleVisionOcrService } from '@/lib/services';

// Use specific service directly
const tesseractService = new TesseractOcrService({
  timeout: 45000,
  maxPages: 1,
});

const googleService = new GoogleVisionOcrService({
  timeout: 30000,
  maxPages: 2,
});
```

## Error Handling

The OCR service throws errors in the following cases:

1. **Service Unavailable**: OCR provider is not configured or dependencies are missing
2. **Timeout**: Extraction exceeds the configured timeout (default 30 seconds)
3. **Network Error**: Failed to download PDF or communicate with cloud service
4. **Invalid PDF**: PDF file is corrupted or cannot be processed

```typescript
try {
  const result = await ocrService.extractText(pdfUrl);
} catch (error) {
  if (error.message.includes('not available')) {
    // Fallback to manual entry
    console.log('OCR not available - use manual entry');
  } else if (error.message.includes('timeout')) {
    // Timeout - suggest manual entry
    console.log('OCR took too long - use manual entry');
  } else {
    // Other error
    console.error('OCR failed:', error);
  }
}
```

## Performance Monitoring

The OCR service automatically logs performance metrics:

```typescript
// Success log
{
  service: 'Google Cloud Vision',
  success: true,
  extractionTime: 2345,
  timestamp: '2025-01-15T10:30:00.000Z'
}

// Error log
{
  service: 'AWS Textract',
  success: false,
  extractionTime: 30001,
  timestamp: '2025-01-15T10:30:00.000Z',
  error: 'OCR extraction timeout after 30000ms'
}
```

## Best Practices

1. **Always check availability** before attempting extraction
2. **Handle timeouts gracefully** - provide manual entry fallback
3. **Set appropriate timeouts** based on expected PDF size
4. **Limit page processing** to first page for better performance
5. **Monitor performance metrics** to optimize configuration
6. **Use cloud services for production** for better accuracy
7. **Test with real receipts** to validate extraction quality

## Testing

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createOcrService } from '@/lib/services';

describe('OCR Service', () => {
  it('should return NoOpOcrService when OCR_PROVIDER is not set', async () => {
    const service = createOcrService();
    expect(service.getServiceName()).toBe('None (OCR Disabled)');
    expect(await service.isAvailable()).toBe(false);
  });

  it('should throw error when extracting with NoOpOcrService', async () => {
    const service = createOcrService();
    await expect(service.extractText('test.pdf')).rejects.toThrow(
      'OCR service is not configured'
    );
  });

  it('should respect timeout configuration', async () => {
    const service = createOcrService({ timeout: 1000 });
    // Test timeout behavior
  });
});
```

## Requirements Mapping

- **Requirement 4.1**: OCR text extraction from PDF
- **Requirement 4.2**: Timeout handling (30 seconds)
- **Requirement 13.1**: Support for Tesseract local
- **Requirement 13.2**: Support for cloud services (Google Vision, AWS Textract)
- **Requirement 13.3**: Service availability check
- **Requirement 13.4**: Timeout configuration
- **Requirement 13.5**: Error handling and fallback
- **Requirement 13.6**: Performance logging
